/* ============================ starfield + core ============================ */
const sky=$("#sky"),sx=sky.getContext("2d");
let stars=[],W=0,H=0;
function resize(){
  W=sky.width=innerWidth*devicePixelRatio; H=sky.height=innerHeight*devicePixelRatio;
  sky.style.width=innerWidth+"px"; sky.style.height=innerHeight+"px";
  stars=[]; const n=Math.min(260,Math.floor(innerWidth*innerHeight/5200));
  for(let i=0;i<n;i++)stars.push({x:Math.random()*W,y:Math.random()*H,z:Math.random()*.85+.15,r:Math.random()*1.5+.3,p:Math.random()*6.28});
}
addEventListener("resize",resize); resize();
/* patch603: map zoom canvas - same per-frame drawSysScene()/sprite() as #orb, on its
   own context/size, since only one of #orb (Empire tab) / #mapZoom (Map tab, zoomed)
   is ever visible at a time - see draw(). `mapZoom` itself (a system id, or null) is
   runtime-only and never saved: a reload always comes back on the plain map. */
let mapZoom=null, mapZoomT0=0;
/* patch615: which ore-ladder tier's site view is open on the zoom canvas, as a
   GENS index (same numbering SITE[]/siteUnit() already use) - null when showing
   the planet instead. Session-only, same reasoning as mapZoom itself: never
   saved, always starts null (the plan's own "Watch for" note - a legacy S.site in
   an old save is simply never read by any of this). */
let mapSite=null;
const mapZoomCv=$("#mapZoom"); let mzx=null, MZW=0, MZH=0, mzChk=0;
function mapZoomResize(){
  if(!mapZoomCv||!mapZoomCv.offsetParent){mzx=null;return}
  const w=Math.round(mapZoomCv.clientWidth*devicePixelRatio),
        h=Math.round(mapZoomCv.clientHeight*devicePixelRatio);
  if(w<8||h<8){mzx=null;return}
  if(mapZoomCv.width!==w)mapZoomCv.width=w;
  if(mapZoomCv.height!==h)mapZoomCv.height=h;
  MZW=mapZoomCv.width; MZH=mapZoomCv.height;
  mzx=mapZoomCv.getContext("2d");
}
if(window.ResizeObserver) new ResizeObserver(()=>{mzx=null}).observe(mapZoomCv);
addEventListener("pageshow",()=>{mzx=null});
document.addEventListener("visibilitychange",()=>{ if(!document.hidden)mzx=null });
/* patch627 (PLAN-page.md, "one fact"): the only remaining caller is
   syncSysPage()'s own derivation - node taps, claiming, tab changes, sector
   changes and every close path all funnel through S.msel + render() now, never
   through this directly. Just the canvas cross-fade (#mapWrap .zoomed - patch628b
   dropped the redundant #p-map .zoomed toggle that used to sit beside it here,
   dead since patch627 moved its one CSS reader to body.syspage; grep confirmed
   nothing reads #p-map.zoomed any more) and the site-view bookkeeping -
   #mapZoomName moved to syncSysPage() itself
   (it needs to read on ANY page, zoomed or not; keying it to this function's own
   `id` argument would blank it on an unclaimed system's page, which is never
   zoomed - see syncSysPage()'s own comment). */
function setMapZoom(id){
  /* only stamp a fresh entry-transition start when actually OPENING (or switching to
     a different system) - closing, or an identical re-set, must not restart it. */
  if(id&&id!==mapZoom) mapZoomT0=performance.now();
  mapZoom=id;
  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);
  /* patch615: (re)targeting or leaving the zoom always drops any open site view -
     it belongs to whichever system was zoomed, never survives a switch. */
  mapSite=null; syncMapZoomBack();
}
/* patch627 (PLAN-page.md, "one fact"), single-writer-corrected by patch628b:
   the single source of truth for whether a system page is showing, called once
   per render() pass (see its own call site, right at the top of render() -
   before renderMap() and everything else that reads body.syspage or mapZoom
   this frame). Nothing else may toggle body.syspage, #sysSheet's visibility
   (body.syspage #sysSheet{display:block} - see its own CSS comment), or call
   setMapZoom() - renderMap() used to duplicate the first two, deleted there,
   not here (see HANDOVER). */
let pageShownId=null;
function syncSysPage(){
  const on = !!S.msel && $("#p-map").classList.contains("on");
  document.body.classList.toggle("syspage", on);
  const nameEl=$("#mapZoomName");
  if(nameEl){ const s=on?SYSMAP[S.msel]:null; nameEl.textContent=s?s.n.toUpperCase():""; }
  const want = on && (sysHeld(S.msel)||sysOccupied(S.msel)) ? S.msel : null;
  if(want!==mapZoom) setMapZoom(want);
  /* patch628b (coordinator overruled patch627's own transition-based rule here):
     the page scrolls to top when the SELECTED SYSTEM changes, not when the tab
     changes - every other pane restores its own scroll on return (paneScroll),
     and the owner asked for this one to behave the same way ("the list stays
     where it was"). pageShownId tracks which system's page last reset the
     scroll, so entering a page for a NEW id, switching to a DIFFERENT id while
     one is already open (LIST row, TAKE ME THERE, the live-fleet banner, a
     plain node tap and claimSystem() all just set S.msel and render(), so this
     covers all of them for free), and closing (S.msel back to null) each reset
     once; a tab-away-then-back (S.msel unchanged) does not - the tab handler's
     own paneScroll restores that case now, same as any other pane (see its own
     comment - the two guards patch627 added there for the old transition rule
     are gone). */
  if(on){
    if(pageShownId!==S.msel){
      const view=$("#view");
      if(view){ try{ view.scrollTo({top:0,behavior:"instant"}) }catch(_){ view.scrollTop=0 } }
      pageShownId=S.msel;
    }
  } else if(!S.msel && pageShownId!==null){
    const view=$("#view");
    if(view){ try{ view.scrollTo({top:0,behavior:"instant"}) }catch(_){ view.scrollTop=0 } }
    pageShownId=null;
  }
}
/* patch615: relabelled, not duplicated - "< SYSTEM" (drop the site view, keep the
   zoom) while mapSite is set, "< MAP" (drop the zoom entirely) otherwise. */
function syncMapZoomBack(){
  const b=$("#mapZoomBack"); if(b)b.textContent = mapSite!=null ? "\u2039 SYSTEM" : "\u2039 MAP";
}
$("#mapZoomBack").onclick=()=>{
  if(mapSite!=null){ mapSite=null; syncMapZoomBack(); dirty=true; render(); return; }
  /* patch627 (PLAN-page.md): S.msel=null is the whole close now - the derivation
     (syncSysPage(), called from the render() right here) clears body.syspage and
     the zoom together, one fact, so there is nothing left for this handler to set
     directly. */
  S.msel=null; dirty=true; render();
};
const CONT=[{x:-.30,y:-.26,rx:.46,ry:.27,a:-.45},{x:.28,y:.10,rx:.40,ry:.22,a:.35},
            {x:-.10,y:.44,rx:.34,ry:.16,a:.10},{x:.44,y:-.42,rx:.24,ry:.13,a:-.20}];
const LIGHTS=(()=>{const L=[];let sd=7;const rnd=()=>(sd=(sd*1103515245+12345)&0x7fffffff)/0x7fffffff;
  let guard=0;
  while(L.length<52&&guard++<9000){const x=rnd()*2-1,y=rnd()*2-1; if(x*x+y*y>.80)continue;
    const night=Math.pow(Math.max(0,(x+y+2)/4),2.2);       // 0 = day side, 1 = night side
    if(rnd()>0.04+0.96*night)continue;
    L.push({x,y,p:rnd()*6.28,s:.55+rnd()*.75,n:.35+.65*night});}
  return L})();
function rgba(hex,a){const n=parseInt(hex.slice(1),16);
  return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+a+")"}
/* Orbiting structures, drawn as small realistic satellites: dark metal bodies and
   blue solar panels lit from the same upper-left sun as the planet (PLANETS in
   13b-planets.js), plus one tiny blinking beacon in the tier's own colour so tiers
   can still be told apart. Five silhouettes, picked by position in the system's own
   ladder. Craft on the far side of the orbit are dimmed. */
function sprite(g,o,D){
  const i=o.i, s=o.s, TAU=6.2832;
  const kk=GENS[i]&&GENS[i].kind, other=kk&&kk!=="ore"&&LADDERS[kk];
  const tier=other?LADDERS[kk].indexOf(i):i;
  const acc=other&&KIND_INFO[kk]?KIND_INFO[kk].col:TCOL[i%TCOL.length];
  g.save(); g.translate(o.x,o.y);
  g.globalAlpha=Math.sin(o.a)<0?.5:1;
  const rot=o.a*.5+i*.9; g.rotate(rot);
  const c=Math.cos(rot), sn=Math.sin(rot), lx=-.94*c-.33*sn, ly=.94*sn-.33*c;   /* sun, local frame */
  const grad=(a,b,m)=>{ const gr=g.createLinearGradient(lx*s*1.2,ly*s*1.2,-lx*s*1.2,-ly*s*1.2);
    gr.addColorStop(0,a); gr.addColorStop(.45,m); gr.addColorStop(1,b); return gr };
  const metal=grad("#eef2f8","#1f2533","#8791a4"), panel=grad("#5d8fd8","#0a1428","#27477e");
  const lw=Math.max(.7,s*.1);
  const panels=(x0,w,h)=>{ g.fillStyle=panel;
    g.fillRect(-x0-w,-h/2,w,h); g.fillRect(x0,-h/2,w,h);
    g.strokeStyle="rgba(170,200,240,.35)"; g.lineWidth=lw*.6; g.beginPath();
    g.moveTo(-x0-w/2,-h/2); g.lineTo(-x0-w/2,h/2); g.moveTo(x0+w/2,-h/2); g.lineTo(x0+w/2,h/2); g.stroke();
    g.strokeStyle="#6b7385"; g.lineWidth=lw; g.beginPath(); g.moveTo(-x0,0); g.lineTo(x0,0); g.stroke() };
  switch(((tier%5)+5)%5){
    case 0: panels(s*.45,s*1.1,s*.55); g.fillStyle=metal; g.fillRect(-s*.45,-s*.4,s*.9,s*.8); break;
    case 1: panels(s*.3,s*.7,s*.45); g.fillStyle=metal;
      g.beginPath(); g.roundRect?g.roundRect(-s*.32,-s*1.05,s*.64,s*2.1,s*.3):g.rect(-s*.32,-s*1.05,s*.64,s*2.1); g.fill(); break;
    case 2: g.fillStyle=metal; g.fillRect(-s*.6,-s*.5,s*1.2,s*1);
      g.strokeStyle=metal; g.lineWidth=lw*1.4; g.beginPath(); g.arc(0,-s*.95,s*.5,.35,TAU/2-.35); g.stroke();
      g.lineWidth=lw; g.beginPath(); g.moveTo(0,-s*.5); g.lineTo(0,-s*.75); g.stroke(); break;
    case 3: g.strokeStyle=metal; g.lineWidth=Math.max(1,s*.28);
      g.beginPath(); g.arc(0,0,s*1.05,0,TAU); g.stroke();
      g.lineWidth=lw; g.beginPath(); g.moveTo(-s*1.05,0); g.lineTo(s*1.05,0); g.moveTo(0,-s*1.05); g.lineTo(0,s*1.05); g.stroke();
      g.fillStyle=metal; g.beginPath(); g.arc(0,0,s*.35,0,TAU); g.fill(); break;
    default: panels(s*.2,s*.55,s*.9); g.fillStyle=metal;
      g.fillRect(-s*.2,-s*.25,s*.4,s*.5); g.fillRect(-s*1.55,-s*.12,s*.3,s*.24); g.fillRect(s*1.25,-s*.12,s*.3,s*.24);
  }
  /* beacon: short blink, staggered so a lane never flashes in unison */
  const ph=((performance.now()/1100+i*.37+o.a*.5)%1+1)%1;
  if(ph<.16){ const a=1-ph/.16;
    g.globalAlpha*=a; g.fillStyle=rgba(acc,.35); g.beginPath(); g.arc(0,0,Math.max(1.6,s*.55),0,TAU); g.fill();
    g.fillStyle=acc; g.beginPath(); g.arc(0,0,Math.max(.8,s*.18),0,TAU); g.fill(); }
  g.restore(); g.globalAlpha=1;
}
let ang=0, orbChk=0;

