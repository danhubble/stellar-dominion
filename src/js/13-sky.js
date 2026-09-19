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
function sprite(g,o,D){
  const i=o.i,s=o.s,c=TCOL[i%TCOL.length];
  g.save(); g.translate(o.x,o.y);
  g.globalAlpha=.45+.55*(0.5+0.5*Math.sin(o.a));
  g.fillStyle=c; g.strokeStyle=c; g.lineWidth=Math.max(1,s*0.34);
  const kkind=GENS[i]&&GENS[i].kind;
  if(kkind&&kkind!=="ore"){
    const tier=LADDERS[kkind].indexOf(i);
    const kc=KIND_INFO[kkind]?KIND_INFO[kkind].col:c;
    g.fillStyle=kc; g.strokeStyle=kc;
    switch(kkind){
      case "rock":{
        const hexPath=r=>{ g.beginPath();
          for(let k=0;k<6;k++){ const a=k*1.0472+o.a; const px=Math.cos(a)*r, py=Math.sin(a)*r; k?g.lineTo(px,py):g.moveTo(px,py); }
          g.closePath(); };
        hexPath(s*1.1); g.fill();
        if(tier===1){ g.globalAlpha*=.7; hexPath(s*.55); g.stroke(); }
        else if(tier===2){
          g.globalAlpha*=.55; g.beginPath();
          for(let k=0;k<6;k++){ const a=k*1.0472+o.a+0.524; const px=Math.cos(a)*s*1.1, py=Math.sin(a)*s*1.1; k?g.lineTo(px,py):g.moveTo(px,py); }
          g.closePath(); g.fill();
        }
        break;}
      case "gas":
        g.beginPath(); g.arc(0,0,s*.85,0,6.2832); g.fill();
        if(tier===1){
          g.globalAlpha*=.55; g.beginPath();
          g.moveTo(-s*1.3,-s*.35); g.lineTo(s*1.3,-s*.35);
          g.moveTo(-s*1.3,s*.35); g.lineTo(s*1.3,s*.35); g.stroke();
        } else if(tier===2){
          g.globalAlpha*=.6; g.beginPath(); g.arc(0,0,s*1.4,0,6.2832); g.stroke();
        } else {
          g.globalAlpha*=.55; g.beginPath(); g.moveTo(-s*1.3,0); g.lineTo(s*1.3,0); g.stroke();
        }
        break;
      case "belt":{
        const n=tier===0?3:tier===1?4:5, rr=s*1.1;
        for(let k=0;k<n;k++){ const a=k*(6.2832/n)+o.a; g.beginPath(); g.arc(Math.cos(a)*rr,Math.sin(a)*rr,s*.4,0,6.2832); g.fill(); }
        break;}
      case "ice":{
        const pts=tier===1?6:4;
        g.beginPath();
        for(let k=0;k<pts;k++){
          const a=k*(6.2832/pts)+o.a, a2=a+(3.1416/pts);
          const ax=Math.cos(a)*s*1.4, ay=Math.sin(a)*s*1.4;
          const bx=Math.cos(a2)*s*.45, by=Math.sin(a2)*s*.45;
          k?g.lineTo(ax,ay):g.moveTo(ax,ay); g.lineTo(bx,by);
        }
        g.closePath(); g.fill();
        if(tier===2){ g.globalAlpha*=.5; g.beginPath(); g.arc(0,0,s*1.7,0,6.2832); g.stroke(); }
        break;}
      case "void":
        g.globalAlpha*=.9; g.fillStyle="#05060f";
        g.beginPath(); g.arc(0,0,s*.8,0,6.2832); g.fill();
        g.strokeStyle=kc; g.lineWidth=Math.max(1,s*0.22); g.globalAlpha=.85;
        g.beginPath(); g.arc(0,0,s*1.0,0,6.2832); g.stroke();
        if(tier===1){
          g.globalAlpha*=.6; g.beginPath(); g.arc(0,0,s*1.5,0,6.2832); g.stroke();
        } else if(tier===2){
          g.globalAlpha=.9; g.fillStyle=kc;
          for(let k=0;k<3;k++){ const a=k*2.094+o.a; g.beginPath(); g.arc(Math.cos(a)*s*1.9,Math.sin(a)*s*1.9,s*.3,0,6.2832); g.fill(); }
        }
        break;
    }
    g.restore(); g.globalAlpha=1; return;
  }
  switch(i){
    case 0: g.rotate(o.a+1.57); g.beginPath(); g.moveTo(0,-s*1.3); g.lineTo(s*.85,s*.8); g.lineTo(-s*.85,s*.8); g.closePath(); g.fill(); break;
    case 1: g.rotate(o.a+1.57); g.beginPath(); g.roundRect?g.roundRect(-s*.7,-s*1.5,s*1.4,s*3,s*.5):g.rect(-s*.7,-s*1.5,s*1.4,s*3); g.fill(); break;
    case 2: g.fillRect(-s*.9,-s*.9,s*1.8,s*1.8); break;
    case 3: g.beginPath(); g.moveTo(0,-s*1.2); g.lineTo(s*1.2,0); g.lineTo(0,s*1.2); g.lineTo(-s*1.2,0); g.closePath(); g.fill(); break;
    case 4: g.beginPath(); g.arc(0,0,s*1.05,0,6.2832); g.stroke(); break;
    case 5: g.beginPath(); g.arc(0,0,s*.75,0,6.2832); g.fill();
            g.beginPath(); g.moveTo(-s*1.6,0); g.lineTo(s*1.6,0); g.moveTo(0,-s*1.6); g.lineTo(0,s*1.6); g.globalAlpha*=.55; g.stroke(); break;
    case 6: g.beginPath(); g.arc(0,0,s*.6,0,6.2832); g.fill();
            g.globalAlpha*=.6; g.beginPath(); g.arc(0,0,s*1.35,0,6.2832); g.stroke(); break;
    case 7: g.beginPath(); g.ellipse(0,0,s*1.5,s*.7,o.a,0,6.2832); g.stroke();
            g.beginPath(); g.arc(0,0,s*.5,0,6.2832); g.fill(); break;
    case 8: g.beginPath(); g.ellipse(0,0,s*1.6,s*.6,o.a*.6,0,6.2832); g.fill();
            g.globalAlpha=1; g.fillStyle="#05060f"; g.beginPath(); g.arc(0,0,s*.65,0,6.2832); g.fill(); break;
    default:{ g.beginPath();
      for(let k=0;k<5;k++){ const a1=o.a+k*1.2566, a2=a1+0.6283;
        g.lineTo(Math.cos(a1)*s*1.5,Math.sin(a1)*s*1.5); g.lineTo(Math.cos(a2)*s*.6,Math.sin(a2)*s*.6); }
      g.closePath(); g.fill(); }
  }
  g.restore(); g.globalAlpha=1;
}
let ang=0, orbChk=0;

