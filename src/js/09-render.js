function checkUnlocks(){
  if(unlockedAt("p-mis"))queueNotice("vega:missions");
  if(unlockedAt("p-res"))queueNotice("vega:research");
  if(unlockedAt("p-mkt"))queueNotice("vega:stats");
  if(unlockedAt("p-map"))queueNotice("vega:map");
  if(SYS.some(s=>!s.home&&sysOpen(s)))queueNotice("vega:claimable");
  if(EXO.some(e=>exoEverBanked(e.id)))queueNotice("vega:exoBanked");
  if(unlockedAt("p-raid")){ queueNotice("vega:raids"); queueNotice("vega:raidsBuy");
    queueNotice("vega:raidsFit"); queueNotice("vega:raidsOfficers"); }
  ensureFleets();   /* PLAN-fleets run 3: pushes Fleet 2/3 the moment level 16/22 opens */
  if(crewUnlocked())queueNotice("vega:crew");
  if(unlockedAt("p-nex"))queueNotice("vega:nexus");
  if(level()>=23)queueNotice("vega:ring2");
  if(level()>=25)queueNotice("vega:drift25");
  if(level()>=31)queueNotice("vega:ring3");
  if(level()>=35)queueNotice("vega:drift35");
  if(level()>=40)queueRivalNotice("rv40");
  if(level()>=45)queueNotice("vega:drift45");
  if(level()>=50)queueRivalNotice("rv50");
  if(level()>=55)queueNotice("vega:ring4");
  if(level()>=55)queueNotice("vega:drift55");
  if(level()>=60)queueRivalNotice("rv60");
  if(level()>=65)queueNotice("vega:drift65");
  if(hasRing3Held())queueNotice("vega:project");   /* PLAN-pacing: first ring-3+ claim, not first Node */
  /* "what earns a level" - Dan's first playtest note. Fires once, after the
     player's first couple of grants, and never while a perk pick is already
     pending (that modal wins - showing "here's how" under it would be noise). */
  if((S.xpn||0)>=60 && pendingLevels()===0) queueNotice("xpHow");
}
/* one at a time: renderNotice() only ever looks at the FRONT of the queue. A second
   unlock landing on the same tick waits behind the first until it is dismissed. */
let noticeShownKey=null;   /* only rebuild the header/avatar when the front key changes */
function renderNotice(){
  const el=$("#notice"); if(!el)return;
  if(!Array.isArray(S.notifyQueue)||!S.notifyQueue.length){ el.classList.remove("on"); noticeShownKey=null; return; }
  const key=S.notifyQueue[0];
  const n=NOTICES[key];
  if(!n){ S.notifyQueue.shift(); renderNotice(); return; }  /* an unknown key can't be shown - drop it, don't get stuck */
  if(key!==noticeShownKey){
    noticeShownKey=key;
    let whoText=null, avHTML=null;
    if(key.indexOf("rival:")===0){
      const r=RIVALMAP[S.rvMsg&&S.rvMsg[key.slice(6)]];
      /* .vegaav supplies VEGA's own 44x44 + margin-right:10px box - reused here
         (not new CSS) so the rival card lines up with the VEGA one exactly. */
      if(r){ whoText=r.n+" \u00b7 INTERCEPTED"; avHTML=`<div class="vegaav rivav" style="--a:${r.col}">${rivalInitial(r)}</div>`; }
    } else if(n.who){
      whoText=n.who+" \u00b7 SHIP INTELLIGENCE"; avHTML=VEGA_SVG;
    }
    const who=$("#noticeWho");
    if(who){ who.hidden=!whoText; if(whoText)who.textContent=whoText; }
    const av=$("#noticeAv");
    if(av){ av.hidden=!avHTML; if(avHTML)av.innerHTML=avHTML; }
  }
  $("#noticeTxt").textContent=n.t;
  const go=$("#noticeGo"); if(go)go.hidden=!n.go;
  el.classList.add("on");
}
function dismissNotice(){
  if(Array.isArray(S.notifyQueue)&&S.notifyQueue.length)S.notifyQueue.shift();
  renderNotice(); save();
}
/* every slot on this one system's ore output, summed - what the collapsed row shows */
/* every ladder row on this one system, summed - what the collapsed row shows */
/* PATCH 1: filtered to kind:"ore" rows only, same reasoning as rate() above - a
   kind-ladder row's own GENS[gi].r is an exotic figure now, not ore, and must never
   show up mislabeled under ORE/S. */
function sysOreRate(id){ let r=0; for(const gi of sysLadder(id)) if(GENS[gi].kind==="ore") r+=ladderRate(id,gi); return r }
/* Rings the list actually draws rows for: everything up to one ring past the deepest
   the player has touched (held, contested, or currently open to claim). A new game has
   touched nothing, so only ring 1 is individually listed and the rest - the whole back
   half of the map - collapses into one "beyond the Verge" row, rather than dumping
   twenty-plus locked rows on a level-1 player. */
function empFurthestRing(){
  let r=0;
  for(const s of SYS){ if(s.home)continue;
    if(sysHeld(s.id)||sysContested(s)||sysOpen(s))r=Math.max(r,s.ring); }
  return Math.min(4,r+1);
}
/* PLAN-polish Parked item, decided 24 Sep (mock variant C, tools/mkmissiontagmock.py):
   the active/queued mission (one of MISSIONS.slice(S.mi,S.mi+3)) that feeds THIS
   tier, if any - matched on the mission's own `gi` field (never parsed off `d`'s
   text, see MISSIONS' own header note). At most one can match a given gi since a
   tier only ever appears once across the whole table. */
function missionForTier(gi){
  const win=MISSIONS.slice(S.mi||0,(S.mi||0)+3);
  return win.find(m=>m.gi===gi)||null;
}
/* the thin gold strip itself - flush under the row, its own bottom corners rounded,
   the row's squared off to meet it (row.classList "mstripped", 01-empire.css). Gold
   (var(--gd)) always, never the row's own --a accent - a mission is the Colonial
   Authority's claim on this tier, not the tier's own identity. */
function missionStrip(m){
  const have=Math.min(gCount(m.gi), m.need||1);
  const el=document.createElement("div"); el.className="mstrip";
  el.innerHTML=`<span><i>MISSION</i>${m.d}</span><b>${have}/${m.need||1}</b>`;
  return el;
}
/* one ladder tier row - owned (buy more) or the next reveal (greyed, dimmed via the
   .next class, never via opacity - see the header note by .g.next in the stylesheet
   for why opacity is the wrong tool here). Reuses the .g markup/CSS every structure
   row has always used. No separate picker: the row IS the buy action. Returns the
   .g element alone, or (a tier fed by a live mission) a fragment of the row plus its
   own mission strip right under it - renderSysBuild()'s rowsHost.appendChild() takes
   either the same way, and the strip rebuilds in the exact same pass as the row
   itself (its own churn key below folds in S.mi and the mission's own gCount, so a
   claim or a mission rolling over rebuilds it with no extra flicker window). */
function ladderTierRow(sysId,gi,isNext){
  const g=GENS[gi];
  const el=document.createElement("div"); el.className="g"+(isNext?" next":"");
  empSlotEls.push({el,sysId,gi});
  el.style.setProperty("--a",TCOL[gi%TCOL.length]); el.title=g.L+" \u2014 "+g.d;
  const c=sysTierCount(sysId,gi);
  const k=S.buy==="max"?Math.max(1,ladderMaxAff(sysId,gi)):S.buy;
  const cost=ladderCost(sysId,gi,k);
  const xid=ladderExoId(gi), xc=xid?GENS[gi].exoC*k:0;
  const affK = S.buy!=="max" ? true : ladderMaxAff(sysId,gi)>=1;
  const can = S.ore>=cost && (!xc||exo(xid)>=xc) && affK;
  el.classList.toggle("ok",can);
  el.style.setProperty("--p",Math.min(100,S.ore/Math.max(cost,1e-9)*100)+"%");
  el.innerHTML=`<div class="gi${g.kind==="ore"?" gi-site":""}">${iconFor(gi)}</div>
    <div class="gtxt"><div class="gn">${g.n}</div>
      <div class="gm">+${fmt(ladderGain(sysId,gi,Math.max(1,k)))} /s</div>
      <div class="gx">${fmt(ladderPerUnit(sysId,gi))} each \u00b7 ${fmt(ladderRate(sysId,gi))} total</div></div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="gcount">${c}</div>
      <button class="gb" data-cost="${cost}" ${can?"":"disabled"}><b>${fmt(cost)} ${RI('ore')}</b>
        <i>BUY ${S.buy==="max"?"\u00d7"+Math.max(0,ladderMaxAff(sysId,gi)):"\u00d7"+S.buy}</i>
        ${xc>0?`<i class="gexo" style="display:block;--a:${exoDef(xid)?exoDef(xid).col:"#fff"}">+ ${fmt(xc)} ${exoDef(xid)?exoDef(xid).n:""}</i>`:""}
      </button>
    </div>`;
  el.querySelector(".gb").onclick=ev=>{ ev.stopPropagation(); if(!ladderBuy(sysId,gi))blip(140,.08,"sine",.03); dirty=true; render(); };
  /* patch615: only ore-ladder tiers have site art - see the header note by
     .gi.gi-site in the stylesheet. Tapping it opens (or, tapping the same one
     again, drops) the site view on the zoom canvas; mapZoom is already this same
     sysId whenever this row can be on screen at all (renderSysBuild() only shows
     #sysBuild for held systems, and a held system's node tap always zooms - see
     buildMap()'s own b.onclick), so there is nothing else to set. */
  if(g.kind==="ore"){
    const giEl=el.querySelector(".gi");
    if(giEl)giEl.onclick=ev=>{
      ev.stopPropagation();
      mapSite = mapSite===gi ? null : gi;
      if(mapSite!=null)siteT0=performance.now();
      syncMapZoomBack(); dirty=true; render();
    };
  }
  const m=missionForTier(gi);
  if(!m)return el;
  el.classList.add("mstripped");
  const frag=document.createDocumentFragment();
  frag.appendChild(el); frag.appendChild(missionStrip(m));
  return frag;
}
/* PATCH 1: empDevBlock() (the pinned Extraction pseudo-row - Development level,
   DEVELOP/EXTRACTION button) is deleted outright along with the mechanic it drove.
   A held exotic system's body is now just its own kind-ladder tier rows - same
   presentation an ore-kind system's body always had, nothing pinned above it. */
/* filled slot rows set their own --p (afford progress) at build time, same as every
   other .g row always has - but renderSysBuild() only rebuilds on its own dataset.h
   key changing (a buy, a buy-chip tap, a different system opened), so ore ticking up
   between those needs its own unconditional per-frame pass, exactly like the shipped
   game's GENS.forEach in render() did. This array is what that pass walks; it is
   rebuilt every time renderSysBuild() rebuilds the sheet's own rows (patch610/611). */
let empSlotEls=[];
/* PLAN-pacing: Project cards' "you make R/h · ~T to go" line - S.en ticks every
   frame outside of dirty (same reason resProgEls/mapListEls exist below), so the
   text refreshes here on an unconditional per-frame pass instead of waiting for
   renderNex()'s own dataset-free full rebuild. Rebuilt every time renderNex() runs. */
let projEls=[];
function updateEmpBars(){
  for(const {el,sysId,gi} of empSlotEls){
    if(!el.isConnected)continue;
    const k=S.buy==="max"?Math.max(1,ladderMaxAff(sysId,gi)):S.buy;
    const cost=ladderCost(sysId,gi,k);
    const xid=ladderExoId(gi), xc=xid?GENS[gi].exoC*k:0;
    const affK = S.buy!=="max" ? true : ladderMaxAff(sysId,gi)>=1;
    const can = S.ore>=cost && (!xc||exo(xid)>=xc) && affK;
    el.classList.toggle("ok",can);
    el.style.setProperty("--p",Math.min(100,S.ore/Math.max(cost,1e-9)*100)+"%");
    const b=el.querySelector(".gb"); if(b)b.disabled=!can;
  }
  /* patch614: same split as the .g rows above - the rebuild guard in
     renderMapList() excludes S.ore, so the badge's own live affordability check
     runs here, every frame, same as ladderTierRow()'s "ok" class just above. */
  for(const {el,sysId,nextGi} of mapListEls){
    if(!el.isConnected)continue;
    const badge=el.querySelector(".ready");
    if(badge)badge.hidden = !(nextGi!=null && ladderCost(sysId,nextGi,1)<=S.ore);
  }
  for(const p of resProgEls){
    if(!p.head.isConnected)continue;
    const have=exo(p.exoId), rate=exoRate(p.exoId);
    const bk=p.head.querySelector("[data-banked]"); if(bk)bk.textContent=fmt(have);
    const rt=p.head.querySelector("[data-rate]"); if(rt)rt.textContent=fmt(rate);
    const rows=XPROG.filter(z=>z.x===p.exoId&&!INERT_PROGS.has(z.id));
    const anyAfford=rows.some(r=>{ const l=xlv(r.id); return l<r.max && have>=xpCost(r,l) });
    const badge=p.head.querySelector("[data-badge]");
    if(badge)badge.style.display=anyAfford?"inline-block":"none";
    if(p.body&&p.body.isConnected){
      p.body.querySelectorAll("[data-xp]").forEach(b=>{
        const r=xpDef(b.dataset.xp);
        b.disabled = exo(r.x) < xpCost(r);
      });
    }
  }
  for(const q of projEls){
    if(!q.el.isConnected)continue;
    const enR=enRate(), have=S.en||0, r=(enR*3600).toFixed(1);
    q.el.textContent = have>=q.cost ? `you make ${r} Nodes/h · ready`
      : `you make ${r} Nodes/h · ~${fmtT(Math.max(0,(q.cost-have)/Math.max(enR,1e-9)))} to go`;
  }
}
function render(){
  syncSysPage();
  $("#vOre").textContent=fmt(S.ore);
  $("#vRate").textContent=fmt(rate())+" /s";
  /* polish batch A #7: crystal moved from the Research-only strip into the header's
     top three - same unconditional every-render() treatment ore/dm get, not the old
     "only while Research is on" gate (renderResCryStrip() is gone, folded in here). */
  $("#vCry").textContent=fmt(S.cry);
  $("#vCryRate").textContent=anyOf(1)?fmt(cryRate())+" /s":"build a Smelter Pod";
  $("#vDm").textContent=fmt(S.dm);
  { const e=$("#vDmS"); const spent=NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:lv(S.nx,x.id)),0);
    e.textContent = spent ? spent+" Nexus levels" : "for the Nexus";
    e.title = "Spend Dark Matter in the Nexus"; }
  renderCtxCard();
  /* patch622/624: one clickPow() call updates both yield readouts - #clickv (the
     #left button) and #sshScanV (the sheet's own bottom-pinned button, patch624 -
     the chip patch622 first put this id on is gone, the id carried over to the
     new button unchanged) - never two separate computations of the same number. */
  { const cv="+"+fmt(clickPow());
    $("#clickv").textContent=cv;
    const sv=$("#sshScanV"); if(sv)sv.textContent=cv; }
  /* polish batch A #13: also hides once a system is claimed - the owner playthrough
     still had it up post-claim (claiming needs ore, not necessarily a built
     structure or 25 scans, so neither existing condition is guaranteed by then). */
  const tut=$("#tut"); if(tut&&(anyOf(0)||S.clicks>25||heldSystems().length>0))tut.remove();
  $("#kStruct").textContent=fmt(tot());
  $("#kMult").textContent="×"+fmt(globalMul());
  $("#kAll").textContent=fmt(S.all);
  $("#kDm").textContent=fmt(S.dm);
  /* a waiting reward is a state, not a moment: keep the dot until it is collected */
  if(misReady()>0)flag("p-mis");
  renderLevel();
  if($("#p-map").classList.contains("on")){ renderMap(); renderFleetBar(); }
  if($("#p-mkt").classList.contains("on"))renderMarket();
  if(devOn)devInfo();

  renderNotice();
  renderLiveFleet();
  updateEmpBars();
  /* patch610: renderGens() (the old Empire accordion) is no longer called - its
     job is renderSysBuild() now, called from renderMap() itself right after the
     sheet's own held/e computation, same place empSysRow() used to build the row
     that is now these same ladderTierRow()s inline in the sheet. The function
     stays defined (dead) until patch612 deletes it with the rest of the widget. */
  if(dirty){ dirty=false; renderRes(); renderProg(); renderNex(); renderMis(); renderAch(); renderRaids(); renderArmoury(); }
  else { softButtons(); if($("#p-res").classList.contains("on")){resMark();resInfo()} }
  if(nmLive&&$("#mask").classList.contains("on"))nmTick();
  if(rmLive&&$("#mask").classList.contains("on"))rmTick();
  if(lfPromptLive&&$("#mask").classList.contains("on"))lfPromptTick();   /* FIX 1 (2026-09-06) */
}
let mapBuilt=false, mapSec=null, mapSecBuilt=-1, mapChipsBuilt=false, mapRevealBuilt=null;
function secOf(id){ const s=SYSMAP[id]; return s?s.sec:0 }
/* patch609 (PLAN-pacing: level moved to unlockLv("p-map")): before the map unlock
   level the map shows only Sol Reach - every draw/lookup path (buildMap, renderMap,
   the map churn sweep) already goes through this one function, so gating it here is
   the whole reveal. */
function sysInSec(sec){ return SYS.filter(s=>s.sec===sec && (level()>=unlockLv("p-map")||s.home)) }
function initMapSec(){ if(mapSec==null) mapSec=secOf(S.msel||"home") }
function setMapSec(n){
  n=Math.max(0,Math.min(SECTORS.length-1,n));
  if(n===mapSec)return;
  /* patch627 (PLAN-page.md): setMapZoom(null) used to live here - deleted, not
     redirected, along with the plan's other named old close paths. #mapChips and
     the sector-swipe gesture (the only two ways to reach this) are both already
     unreachable while a page is open (body.syspage hides the chips; the swipe
     IIFE guards on the same class - see its own comment), so S.msel is already
     null in every case this actually runs post-627 - nothing left to clear. */
  mapSec=n; mapSecBuilt=-1; dirty=true; render();
}
function buildMapChips(){
  const host=$("#mapChips"); if(!host||mapChipsBuilt)return;
  host.innerHTML=SECTORS.map((s,i)=>`<button type="button" class="chip" data-i="${i}">${s.tag}</button>`).join("");
  host.querySelectorAll(".chip").forEach(c=>c.onclick=()=>setMapSec(+c.dataset.i));
  mapChipsBuilt=true;
}
/* patch609 (PLAN-pacing: level moved to unlockLv("p-map")): nothing to switch sectors
   to before the map unlock level (sysInSec() shows only home everywhere), so the chip
   row hides with it rather than sitting there empty/inert. */
function renderMapChips(){
  const host=$("#mapChips");
  buildMapChips();
  if(host)host.hidden = level()<unlockLv("p-map");
  $$("#mapChips .chip").forEach(c=>c.classList.toggle("on", +c.dataset.i===mapSec));
}
/* ---- per-sector canvas backdrop: seeded, cheap, drawn once per sector switch (not
   every render tick) - see /home/claude/sd/map-mock.html, same five looks. ---- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function mapDrawStars(cx,W,H,rng,n,opts){
  opts=opts||{};
  for(let i=0;i<n;i++){
    const x=rng()*W, y=rng()*H, r=(opts.rmin||0.4)+rng()*(opts.rspread||1.1);
    const br=(opts.brmin||0.25)+rng()*(opts.brspread||0.55);
    cx.beginPath();cx.arc(x,y,r,0,7);
    cx.fillStyle=`rgba(${opts.col||"221,229,255"},${br.toFixed(2)})`;
    cx.fill();
  }
}
const MAP_BACKDROPS=[
 function(cx,W,H){ /* Core: violet/blue nebula tint */
  const rng=mulberry32(1001);
  const g=cx.createRadialGradient(W*0.5,H*0.5,20,W*0.5,H*0.5,W*0.7);
  g.addColorStop(0,"rgba(70,60,150,.30)");g.addColorStop(0.5,"rgba(50,30,110,.20)");g.addColorStop(1,"rgba(4,5,13,0)");
  cx.fillStyle="#080a1c";cx.fillRect(0,0,W,H);
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
  for(let i=0;i<4;i++){
    const bx=rng()*W,by=rng()*H,br=90+rng()*140;
    const bg=cx.createRadialGradient(bx,by,0,bx,by,br);
    const hue=i%2?"120,90,220":"70,140,220";
    bg.addColorStop(0,`rgba(${hue},.16)`);bg.addColorStop(1,"rgba(0,0,0,0)");
    cx.fillStyle=bg;cx.beginPath();cx.arc(bx,by,br,0,7);cx.fill();
  }
  mapDrawStars(cx,W,H,rng,90,{});
 },
 function(cx,W,H){ /* Inner Reach: dense star cluster near centre */
  const rng=mulberry32(2002);
  cx.fillStyle="#070b1e";cx.fillRect(0,0,W,H);
  const g=cx.createRadialGradient(W*0.5,H*0.5,10,W*0.5,H*0.5,W*0.55);
  g.addColorStop(0,"rgba(60,100,200,.18)");g.addColorStop(1,"rgba(4,5,13,0)");
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
  for(let i=0;i<160;i++){
    const a=rng()*6.28, d=Math.pow(rng(),1.6)*180;
    const x=W*0.45+Math.cos(a)*d, y=H*0.5+Math.sin(a)*d*0.7;
    const r=0.4+rng()*1.3, br=0.3+rng()*0.6;
    cx.beginPath();cx.arc(x,y,r,0,7);cx.fillStyle=`rgba(200,225,255,${br.toFixed(2)})`;cx.fill();
  }
  mapDrawStars(cx,W,H,rng,60,{});
 },
 function(cx,W,H){ /* Frontier: near-black void, sparse dim stars only */
  const rng=mulberry32(3003);
  cx.fillStyle="#020208";cx.fillRect(0,0,W,H);
  const g=cx.createRadialGradient(W*0.5,H*0.5,0,W*0.5,H*0.5,W*0.75);
  g.addColorStop(0,"rgba(10,14,28,.4)");g.addColorStop(1,"rgba(0,0,0,.85)");
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
  mapDrawStars(cx,W,H,rng,34,{rmin:0.3,rspread:0.7,brmin:0.15,brspread:0.35});
 },
 function(cx,W,H){ /* The Deep: dark red-brown tint + small angular wreck fragments */
  const rng=mulberry32(4004);
  cx.fillStyle="#0a0710";cx.fillRect(0,0,W,H);
  const g=cx.createRadialGradient(W*0.5,H*0.5,10,W*0.5,H*0.5,W*0.7);
  g.addColorStop(0,"rgba(120,40,40,.14)");g.addColorStop(1,"rgba(4,5,13,0)");
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
  for(let i=0;i<26;i++){
    const x=rng()*W,y=rng()*H,s=4+rng()*10,rot=rng()*6.28;
    cx.save();cx.translate(x,y);cx.rotate(rot);
    cx.strokeStyle=`rgba(255,140,90,${(0.1+rng()*0.22).toFixed(2)})`;cx.lineWidth=1;
    cx.beginPath();cx.moveTo(-s,0);cx.lineTo(0,-s*0.5);cx.lineTo(s,0.2*s);cx.lineTo(0.2*s,s);cx.closePath();cx.stroke();
    cx.restore();
  }
  mapDrawStars(cx,W,H,rng,50,{brmin:0.15,brspread:0.3});
 },
 function(cx,W,H){ /* Beyond: mostly black, one faint spiral-galaxy glow, tucked in a corner */
  const rng=mulberry32(5005);
  cx.fillStyle="#030309";cx.fillRect(0,0,W,H);
  const gx=W*0.72,gy=H*0.28;
  cx.save();cx.translate(gx,gy);cx.rotate(-0.4);
  const gg=cx.createRadialGradient(0,0,0,0,0,120);
  gg.addColorStop(0,"rgba(255,240,220,.5)");gg.addColorStop(0.3,"rgba(180,160,255,.18)");gg.addColorStop(1,"rgba(0,0,0,0)");
  cx.scale(1,0.34);cx.beginPath();cx.arc(0,0,120,0,7);cx.fillStyle=gg;cx.fill();
  cx.restore();
  for(let a=0;a<3;a++){
    cx.save();cx.translate(gx,gy);cx.rotate(-0.4+a*0.9);cx.scale(1,0.34);
    cx.strokeStyle="rgba(200,190,255,.10)";cx.lineWidth=6;
    cx.beginPath();cx.arc(0,0,60+a*22,0.2,2.6);cx.stroke();
    cx.restore();
  }
  mapDrawStars(cx,W,H,rng,70,{brmin:0.2,brspread:0.45});
 }
];
function drawMapBg(sec){
  const cv=$("#mapBg"); if(!cv)return;
  const cx=cv.getContext("2d"); if(!cx)return;
  (MAP_BACKDROPS[sec]||MAP_BACKDROPS[0])(cx,cv.width,cv.height);
}
/* exit lane out to the next sector (or the end-of-map flag on the last one).
   patch568 adds the rival-fleet/trip warnings into this same #mapEdge host. */
/* patch609 (PLAN-pacing: level moved to unlockLv("p-map")): the exit arrow (and every
   fleet/threat warning pill this same host draws) only ever points at another sector -
   there is nothing to point at before the map unlock level. */
function renderMapEdge(){
  const host=$("#mapEdge"); if(!host)return;
  if(level()<unlockLv("p-map")){ host.hidden=true; host.innerHTML=""; return; }
  host.hidden=false;
  const exit=SEC_EXIT[mapSec];
  let html = exit
    ? `<div class="edgearrow" style="top:calc(${(SYSMAP[exit.from]||{sy:50}).sy}% - 20px)">${exit.label}</div>`
    : `<div class="endflag">END OF CHARTED SPACE</div>`;
  /* rival inbound fleet (LF) and the item-4 travelling fleet (S.trip) draw on their
     OWN target's sector page (the badge/marker below); elsewhere, a small pill points
     toward wherever they actually are, so nothing threatening goes unseen just
     because the player is looking at a different page. */
  if(LF){
    const s=SYSMAP[LF.sysId];
    if(s && s.sec!==mapSec){
      const left=s.sec<mapSec;
      html+=`<div class="edgewarn${left?" left":""}" style="top:16%">⚠ FLEET INBOUND — ${
        s.n.toUpperCase()} (${(SECTORS[s.sec]||{tag:"?"}).tag})</div>`;
    }
  }
  const trip=S.trip;
  if(trip){
    const s=SYSMAP[trip.sysId];
    if(s && s.sec!==mapSec){
      const left=s.sec<mapSec;
      const arrived=tripArrived(trip);
      html+=`<div class="edgewarn trip${left?" left":""}" style="top:40%">${
        arrived?"FLEET ARRIVED":"FLEET EN ROUTE"} — ${
        s.n.toUpperCase()} (${(SECTORS[s.sec]||{tag:"?"}).tag})</div>`;
    }
  }
  /* STAGE C: a live sab threat always targets home (Core), so this only ever needs to
     point back toward Core from whichever other sector the player is looking at. */
  const sabTh=thq().find(q=>q.kind==="sab");
  if(sabTh){
    const s=SYSMAP.home;
    if(s && s.sec!==mapSec){
      const left=s.sec<mapSec;
      html+=`<div class="edgewarn${left?" left":""}" style="top:64%">⚠ THE NEXUS IS UNDER THREAT — ${
        (SECTORS[s.sec]||{tag:"?"}).tag}</div>`;
    }
  }
  /* patch589: "the turn" - VEGA's fleet holds Sol Reach (Core) while S.end===1.
     Mutually exclusive with the sab pill just above in practice (a sabotage threat
     cannot exist once S.end>=1 - rvMaybeThreat() no-ops and startFinale() clears
     S.thq outright), so the same screen slot is safe to reuse. */
  if(S.end===1){
    const s=SYSMAP.home;
    if(s && s.sec!==mapSec){
      const left=s.sec<mapSec;
      html+=`<div class="edgewarn${left?" left":""}" style="top:64%">⚠ VEGA'S FLEET HOLDS SOL REACH — ${
        (SECTORS[s.sec]||{tag:"?"}).tag}</div>`;
    }
  }
  host.innerHTML=html;
}
function buildMap(){
  const host=$("#mapNodes"), svg=$("#mapLinks");
  if(!host||!svg)return;
  initMapSec();
  host.innerHTML=""; svg.innerHTML="";
  drawMapBg(mapSec);
  drawTerritory(svg,mapSec);
  const list=sysInSec(mapSec);
  const byId={}; for(const s of list)byId[s.id]=s;
  for(const [a,b] of (SEC_LANES[mapSec]||[])){
    const A=byId[a], B=byId[b]; if(!A||!B)continue;
    const ln=document.createElementNS("http://www.w3.org/2000/svg","line");
    ln.setAttribute("x1",A.sx); ln.setAttribute("y1",A.sy);
    ln.setAttribute("x2",B.sx); ln.setAttribute("y2",B.sy);
    ln.dataset.a=a; ln.dataset.b=b; svg.appendChild(ln);
  }
  for(const s of list){
    const b=document.createElement("button");
    b.className="mnode"; b.dataset.s=s.id;
    b.style.left=s.sx+"%"; b.style.top=s.sy+"%";
    b.style.setProperty("--a", s.res?exoDef(s.res).col:"#5ce6a5");
    if(s.owner)b.classList.add("rival");
    b.innerHTML=`<span class="mdot"></span><span class="mlab">${s.n}</span>`;
    b.onclick=()=>{ S.msel=s.id; dirty=true; render(); };  /* patch627: the derivation zooms it */
    host.appendChild(b);
  }
  renderMapEdge();
  mapBuilt=true; mapSecBuilt=mapSec; mapRevealBuilt=level()>=unlockLv("p-map");
}
/* ==================== PLAN-fleets run 2: the fleet bar ====================
   Interaction "A" (PLAN-fleets.md decision 5, revised after the owner played
   mkfleetmock.py): flSel is a runtime-only var, never saved - a page reload
   always comes up with nothing selected, same as any other transient UI pick
   (defSel, mapSite, ...) in this file. sendChipSys is the node a selected
   fleet's SEND chip is currently sitting on, cleared right along with flSel. */
let flSel=null, sendChipSys=null;
function fleetDeselect(){ flSel=null; sendChipSys=null; }
function fleetBarTap(id){
  const f=fleet(id); if(!f)return;
  if(f.to){ openFleetCard(id); return; }         /* travelling: nothing to select, just view */
  if(flSel===id){ openFleetCard(id); fleetDeselect(); }
  else {
    flSel=id; sendChipSys=null;
    const fsec=secOf(f.to||f.at);
    if(fsec!==mapSec)setMapSec(fsec);
    /* LOCATE means "look at the sector the fleet is in" - a system page zoomed
       into some OTHER system's own planet scene hides #mapNodes entirely
       (#mapWrap.zoomed), so there would be nothing left to tap a node on. Back
       out to the sector map itself; the fleet bar stays visible either way. */
    if(S.msel)S.msel=null;
  }
  dirty=true; render();
}
function openFleetCard(id){
  const f=fleet(id); if(!f)return;
  const col=FLEET_COL[id-1]||FLEET_COL[0];
  const status = f.to
    ? "EN ROUTE TO "+((SYSMAP[f.to]||{}).n||f.to).toUpperCase()+" · "+Math.max(0,Math.ceil(f.eta))+"s"
    : "AT "+((SYSMAP[f.at]||{}).n||f.at).toUpperCase();
  const hulls=SHIPS.map((sp,i)=>f.sh[i]?f.sh[i]+" "+sp.n+(f.sh[i]===1?"":"s"):null).filter(Boolean).join(" · ")||"No ships";
  const rc=repairCost(f);
  const canRepair=fleetCount(f)>0 && f.hp<1 && S.ore>=rc;
  /* run 3: TRANSFER only makes sense with another idle fleet standing right here -
     otherIdleFleetsAt() is empty while travelling too, so this never shows for a
     fleet mid-flight. */
  const mates=otherIdleFleetsAt(f);
  const canTransfer=mates.length>0;
  showModal(`<h3 style="color:${col}">${f.n}</h3>
    <p class="fcloc">${status}</p>
    <div class="fchulls">${hulls}</div>
    <div class="fcint">Integrity <b>${Math.round(f.hp*100)}%</b></div>
    <div class="row">
      <button id="fcRepair" ${canRepair?"":"disabled"}>REPAIR · ${fmt(rc)} ORE</button>
      <button id="fcTransfer" class="transfer" ${canTransfer?"":"disabled"}>TRANSFER</button>
    </div>`,
    ()=>{
      const rb=$("#fcRepair"); if(rb)rb.onclick=()=>{ if(repairFleet(f)){ hideModal(); render(); save(); } };
      const tb=$("#fcTransfer");
      if(tb&&!tb.disabled)tb.onclick=()=>{ hideModal(); transferModal(f, mates[0]); };
    });
}
/* run 3 (decision 6, PLAN-fleets.md): both fleets must already be idle at the same
   system - checked again here, not just by the callers, since a modal can sit open
   for a while and either fleet could have been sent off in the meantime (a repaint
   underneath does not close this modal). Moving one hull per tap, same idiom every
   other +/- stepper in the game uses (hanModal's hanstep). */
function transferModal(a,b){
  const live=()=>!!(a&&b&&!a.to&&!b.to&&a.at===b.at);
  const rowsHTML=()=>SHIPS.map((sp,i)=>`<div class="trow">
      <span class="trlab">${sp.n}</span>
      <button type="button" class="trbtn" data-i="${i}" data-d="-1" ${a.sh[i]>0?"":"disabled"}>−</button>
      <b class="trval">${a.sh[i]} / ${b.sh[i]}</b>
      <button type="button" class="trbtn" data-i="${i}" data-d="1" ${b.sh[i]>0?"":"disabled"}>+</button>
    </div>`).join("");
  const wire=()=>{
    $$("#trRows .trbtn").forEach(bt=>{
      bt.onclick=()=>{
        const i=+bt.dataset.i, d=+bt.dataset.d;
        if(d<0){ if(a.sh[i]>0){ a.sh[i]--; b.sh[i]++ } }
        else { if(b.sh[i]>0){ b.sh[i]--; a.sh[i]++ } }
        dirty=true;
        const rows=$("#trRows"); if(rows)rows.innerHTML=rowsHTML();
        wire();
      };
    });
  };
  const body = live()
    ? `<h3>TRANSFER</h3>
       <p class="fcloc">${a.n} ↔ ${b.n} at ${(SYSMAP[a.at]||{}).n||a.at}</p>
       <div id="trRows">${rowsHTML()}</div>
       <div class="row" style="margin-top:10px"><button id="trDone">DONE</button></div>`
    : `<h3>TRANSFER</h3><p class="fcloc">One of these fleets is no longer here.</p>
       <div class="row"><button id="trDone">CLOSE</button></div>`;
  showModal(body, ()=>{
    if(live())wire();
    const done=$("#trDone"); if(done)done.onclick=()=>{ hideModal(); dirty=true; render(); save(); };
  });
}
/* run on the SAME 3-slot layout run 3 will fill in - a slot with no real fleet
   object yet (2/3, this run) always renders LOCKED regardless of level; run 3
   adds the fleet the moment the level gates it, which is exactly what makes it
   stop being locked here without this file changing again. The button DOM is
   only rebuilt when the structural key changes (id/travelling-vs-not/
   destination/selected) - never on the eta countdown alone, which would hand
   tchurn2 a fresh button object every second a fleet is en route; the live
   "AT X" / "→ X 41s" text is written into a nested .fstat span every call
   instead, the same idiom #sysTripCd's own countdown uses. */
function renderFleetBar(){
  const host=$("#fleetBar"); if(!host)return;
  if(level()<RAIDLV){
    if(!host.hidden){ host.hidden=true; host.dataset.h=""; host.innerHTML=""; }
    return;
  }
  host.hidden=false;
  const structKey=[1,2,3].map(id=>{
    const f=fleet(id), lv=FLEET_UNLOCK[id-1];
    if(!f||level()<lv)return "L"+id+":"+lv;
    return id+(f.to?"T"+f.to:"A"+f.at)+(flSel===id?"S":"");
  }).join(",");
  if(host.dataset.h!==structKey){
    host.dataset.h=structKey;
    let html="";
    for(let id=1;id<=3;id++){
      const f=fleet(id), lv=FLEET_UNLOCK[id-1];
      if(!f||level()<lv){
        html+=`<button type="button" class="fbtn locked" disabled>
          <span class="fnum">${id}</span><span class="fstat">LOCKED LV ${lv}</span></button>`;
      } else {
        html+=`<button type="button" class="fbtn${flSel===id?" sel":""}" data-fl="${id}">
          <span class="fnum" style="color:${FLEET_COL[id-1]||FLEET_COL[0]}">${id}</span>
          <span class="fstat"></span></button>`;
      }
    }
    host.innerHTML=html;
    host.querySelectorAll("[data-fl]").forEach(b=>{ b.onclick=()=>fleetBarTap(+b.dataset.fl); });
  }
  for(let id=1;id<=3;id++){
    const f=fleet(id), lv=FLEET_UNLOCK[id-1];
    if(!f||level()<lv)continue;
    const btn=host.querySelector('[data-fl="'+id+'"]'); if(!btn)continue;
    const stat=btn.querySelector(".fstat"); if(!stat)continue;
    const label = f.to
      ? "→ "+((SYSMAP[f.to]||{}).n||f.to).toUpperCase()+" "+Math.max(0,Math.ceil(f.eta))+"s"
      : "AT "+((SYSMAP[f.at]||{}).n||f.at).toUpperCase();
    if(stat.textContent!==label)stat.textContent=label;
  }
}
/* markers + the SEND confirm chip. Structure (lines, marker DOM) is rebuilt only
   under a churn key that excludes eta - see renderFleetBar()'s own comment, same
   reasoning; travelling markers then SLIDE via a plain transform/left/top write
   every call, no rebuild, which is what makes this cheap to run every render()
   pass (renderMap() already does, ~11Hz while the map tab is open). */
function renderFleetMarkers(){
  const svg=$("#fleetLines"), host=$("#fleetMarkers");
  if(!svg||!host)return;
  const list=sysInSec(mapSec), byId={};
  for(const s of list)byId[s.id]=s;
  const fls=fleets();
  const key=mapSec+"|"+fls.map(f=>f.id+":"+(f.to?"T"+f.from+">"+f.to:"A"+f.at)+(flSel===f.id?"S":"")).join(",");
  if(host.dataset.h!==key){
    host.dataset.h=key;
    svg.innerHTML=""; host.innerHTML="";
    /* run 3: with three fleets, two can idle at the same node at once (most often
       home) - stacked exactly on top of each other they'd read as one marker. Each
       additional one at a node already claimed steps 14px further right, added on
       top of the badge offset below via calc() (a plain % offset can't express a
       fixed pixel step independent of the map's own on-screen size). */
    const stackAt={};
    fls.forEach(f=>{
      const col=FLEET_COL[f.id-1]||FLEET_COL[0];
      if(f.to){
        const A=byId[f.from], B=byId[f.to];
        if(A&&B){
          const ln=document.createElementNS("http://www.w3.org/2000/svg","line");
          ln.setAttribute("x1",A.sx); ln.setAttribute("y1",A.sy);
          ln.setAttribute("x2",B.sx); ln.setAttribute("y2",B.sy);
          ln.setAttribute("stroke",col); ln.dataset.fl=f.id;
          svg.appendChild(ln);
        }
        if(A||B){
          const m=document.createElement("div");
          m.className="flmark trav"; m.dataset.fl=f.id;
          m.style.background=col; m.textContent=f.id;
          host.appendChild(m);
          const e=document.createElement("div");
          e.className="fleta"; e.dataset.fle=f.id;
          host.appendChild(e);
        }
      } else {
        const s=byId[f.at];
        if(s){
          const stack=stackAt[f.at]=(stackAt[f.at]||0)+1;
          const m=document.createElement("div");
          m.className="flmark"+(flSel===f.id?" sel":""); m.dataset.fl=f.id;
          m.style.background=col; m.textContent=f.id;
          /* badge offset - see mkfleetmock.py's own note - plus a 14px step right
             for every marker already stacked at this node. */
          m.style.left="calc("+(s.sx+6)+"% + "+((stack-1)*14)+"px)"; m.style.top=(s.sy-6)+"%";
          host.appendChild(m);
        }
      }
    });
  }
  fls.forEach(f=>{
    if(!f.to)return;
    const A=byId[f.from], B=byId[f.to]; if(!A||!B)return;
    const prog=f.tot>0 ? Math.min(1,Math.max(0,1-f.eta/f.tot)) : 0;
    const x=A.sx+(B.sx-A.sx)*prog, y=A.sy+(B.sy-A.sy)*prog;
    const m=host.querySelector('.flmark[data-fl="'+f.id+'"]');
    if(m){ m.style.left=x+"%"; m.style.top=y+"%"; }
    const e=host.querySelector('[data-fle="'+f.id+'"]');
    if(e){ e.style.left=x+"%"; e.style.top=y+"%"; e.textContent=Math.max(0,Math.ceil(f.eta))+"s"; }
  });
  renderSendChip(byId);
}
function renderSendChip(byId){
  const host=$("#fleetMarkers"); if(!host)return;
  let chip=host.querySelector(".sendchip");
  const node=sendChipSys?byId[sendChipSys]:null;
  const f=flSel!=null?fleet(flSel):null;
  if(flSel==null || !node || !f){
    if(chip)chip.remove();
    return;
  }
  const here = !f.to && f.at===sendChipSys;
  const text = here ? "HERE" : "SEND · "+Math.round(travelSecs(f.at,sendChipSys))+"s";
  if(!chip){
    chip=document.createElement("div"); chip.className="sendchip";
    chip.onclick=()=>{
      const ff=flSel!=null?fleet(flSel):null;
      if(ff && sendChipSys && !here)fleetSend(ff, sendChipSys);
      fleetDeselect(); dirty=true; render();
    };
    host.appendChild(chip);
  }
  chip.style.left=node.sx+"%"; chip.style.top=node.sy+"%";
  chip.textContent=text;
}
/* system page FLEETS block (decision 5) - a plain list, above DEFENCES; sending is
   the fleet bar's job, so this never draws a button. Churn-guarded on which
   fleets are actually here plus their hull mix, same idiom as everything else on
   this sheet. */
function renderSysFleets(s){
  const wrap=$("#sysFleets"); if(!wrap)return;
  if(!s){ if(wrap.dataset.h!==""){ wrap.dataset.h=""; wrap.innerHTML=""; } return; }
  const here=fleets().filter(f=>!f.to&&f.at===s.id);
  const key=s.id+"|"+here.map(f=>f.id+":"+f.sh.join(",")).join("|");
  if(wrap.dataset.h===key)return;
  wrap.dataset.h=key;
  const rows = here.length
    ? here.map(f=>{
        const parts=SHIPS.map((sp,i)=>f.sh[i]?f.sh[i]+" "+sp.n+(f.sh[i]===1?"":"s"):null).filter(Boolean).join(" · ")||"No ships";
        return `<div class="flrow"><span class="flname" style="color:${FLEET_COL[f.id-1]||FLEET_COL[0]}">${f.n}</span>
          <span class="flhulls">${parts}</span></div>`;
      }).join("")
    : '<div class="flempty">No fleet here.</div>';
  wrap.innerHTML=`<div class="sechead">Fleets</div>${rows}`;
}
/* patch607 - the header context card. Reads S.msel -> SYSMAP[..].res -> exoDef, same
   chain empSysRow()/updateOrbBadge() already read for the same purpose. Runs every
   render() tick, unconditionally, like the ore/DM cards it sits beside - it is meant
   to answer "what am I looking at" from any tab, not just the map (plan's own note:
   "that is intended - it tells you what you last looked at"). Written into the same
   #vCtxVal/#vCtxName/#vCtxRate nodes every time (textContent, never innerHTML) -
   nothing here ever rebuilds the button, so it costs nothing extra for tchurn2 to
   sample it.
   patch609c - review fix: name+rate used to share one #vCtxSub line
   ("IRIDIUM +0.1/s") which overflowed and ellipsis-truncated the rate for longer
   exotic names - the same overflow class patch582b fixed for #exoStrip. Same fix
   reused: name and rate now write into their own stacked lines (#vCtxName over
   #vCtxRate, inside the .ctxnums column) so each line only has to fit the WIDER of
   the two strings, not their sum. Also replaces the old bare "—"/"—" empty state
   (read as broken/unloaded, see HANDOVER) with the exact copy unify-mock.html
   already ships for these two cases: a selected system with no exotic (e.g. home)
   reads "NO EXOTIC HERE" (mock's ctx2), nothing selected reads "MAP ONLY" (mock's
   3rd screen) - the value line stays "—" either way. #vCtxRate always gets a real
   character (a non-breaking space when there is no rate) rather than "" - an empty
   text node can collapse to zero height, which would make the card taller with an
   exotic than without one. */
function renderCtxCard(){
  const dot=$("#ctxDot"), val=$("#vCtxVal"), name=$("#vCtxName"), rate=$("#vCtxRate"), card=$("#ctxCard");
  if(!dot||!val||!name||!rate||!card)return;
  /* patch630: gates whether the card can be TAPPED, independent of what it is
     currently showing - a held system with no exotic or nothing selected are
     both still tappable once anything has ever been banked, per the plan. */
  card.classList.toggle("tappable", exoEverBankedAny());
  const s = S.msel ? SYSMAP[S.msel] : null;
  const ex = s && s.res ? exoDef(s.res) : null;
  if(!ex){
    card.style.setProperty("--a","var(--dim)");
    val.textContent="—";
    /* patch609c follow-up: "NO EXOTIC HERE" (unify-mock.html's ctx2 copy) is 5px too
       wide for this card's real column at 390px (measured: 76px needed, 71px to give
       it) - the mock never hit that limit because it never rendered the card at real
       width/font. Same fix as the rate-line overflow above: split across the two
       stacked lines instead of shrinking the font or truncating the words - "NO
       EXOTIC" / "HERE" reads the same as one phrase and both halves fit with room to
       spare. patch613b: "MAP ONLY" told the player nothing to DO - replaced with an
       instruction, "TAP A"/"SYSTEM" across the same two stacked lines (measured:
       both fit well inside the column patch609c already proved out, same nbsp-strut
       idiom, card height unchanged - confirmed by direct measurement, same method
       patch609c used for its own width checks, not assumed from the shorter string). */
    if(s){ name.textContent="NO EXOTIC"; rate.textContent="HERE"; }
    else{ name.textContent="TAP A"; rate.textContent="SYSTEM"; }
    return;
  }
  card.style.setProperty("--a",ex.col);
  const r=exoRate(ex.id);
  val.textContent=fmt(exo(ex.id));
  name.textContent=ex.n.toUpperCase();
  rate.textContent = r>0 ? "+"+fmt(r)+"/s" : "\u00A0";
}
/* ---------------- market (item 5, patch563) ----------------
   Sell-only. One shared volume-tax "heat" counter per output currency
   (S.mkt.heat.sv for every sale that pays out Salvage, .dm for Dark Matter) -
   computed lazily from a stored {v,t} pair rather than ticked every frame: v is the
   markup fraction as of timestamp t, decaying by half every 10 minutes. */
const MKT_HALFLIFE_MS=10*60*1000;
function mktHeat(counter){
  const h=S.mkt&&S.mkt.heat&&S.mkt.heat[counter]; if(!h||!h.v)return 0;
  const halvings=Math.max(0,(Date.now()-h.t)/MKT_HALFLIFE_MS);
  return h.v*Math.pow(0.5,halvings);
}
function mktHeatMul(counter){ return 1+mktHeat(counter); }
function mktBump(counter){
  if(!S.mkt||typeof S.mkt!=="object")S.mkt={heat:{sv:{v:0,t:0},dm:{v:0,t:0}},sold:false};
  S.mkt.heat[counter]={ v:mktHeat(counter)+0.12, t:Date.now() };
}
/* base (pre-heat) prices, straight from the plan. rate()/cryRate() are guarded with
   ||0 defensively (neither should ever be NaN, but a price feeding straight into a
   division - mktAmount()'s bal/price - must never be allowed to become 0 or NaN
   itself); svCryPrice() additionally gets a floor (20 crystal per salvage, the same
   idea as ore's 200) since cryRate() is legitimately 0 early (no Smelter Pod yet),
   which without a floor would price crystal at 0 - free salvage. */
function svOrePrice(){ return Math.max(200, 90*(rate()||0)); }        /* ore per 1 salvage */
function svCryPrice(){ return Math.max(20, 90*(cryRate()||0)); }      /* crystal per 1 salvage */
function svExoPrice(){ return 8; }                                    /* any exotic per 1 salvage, flat */
function dmOrePrice(){ return Math.max(5000, 20*60*(rate()||0)); }    /* ore per 1 Dark Matter */
function mktBasePrice(kind,counter){
  if(counter==="dm")return dmOrePrice();
  if(kind==="ore")return svOrePrice();
  if(kind==="cry")return svCryPrice();
  return svExoPrice();
}
function mktPrice(kind,counter){ return mktBasePrice(kind,counter)*mktHeatMul(counter); }
function mktBal(kind){ return kind==="ore"?S.ore : kind==="cry"?S.cry : exo(kind); }
function mktResLabel(kind){ return kind==="ore"?"Ore" : kind==="cry"?"Crystal" : (exoDef(kind)?exoDef(kind).n:kind); }
function mktAmount(kind,counter){
  const price=mktPrice(kind,counter); if(!(price>0))return 0;
  const bal=mktBal(kind);
  return mktBuy==="max" ? Math.max(0,Math.floor(bal/price)) : mktBuy;   /* patch636: own state, not S.buy - see mktBuy's own comment */
}
/* the one function that actually moves resources - shared by every SELL button and
   exported for tests. amount is a count of OUTPUT units (Salvage or Dark Matter);
   the resource cost is computed from the live (heat-inclusive) price at call time. */
function sellRes(kind,counter,amount){
  amount=Math.max(0,Math.floor(amount||0)); if(amount<=0)return false;
  const price=mktPrice(kind,counter); if(!(price>0))return false;
  const cost=amount*price, bal=mktBal(kind);
  if(bal+1e-6<cost)return false;
  if(kind==="ore")S.ore-=cost;
  else if(kind==="cry")S.cry-=cost;
  else S.exo[kind]=Math.max(0,(S.exo[kind]||0)-cost);
  if(counter==="sv"){ S.sv=(S.sv||0)+amount; S.svAll=(S.svAll||0)+amount; }
  else { S.dm=(S.dm||0)+amount; S.dmAll=(S.dmAll||0)+amount; }         /* dmAll, like every other DM source */
  mktBump(counter);
  if(!S.mkt||typeof S.mkt!=="object")S.mkt={heat:{sv:{v:0,t:0},dm:{v:0,t:0}},sold:false};
  S.mkt.sold=true;
  blip(600,.12,"sine",.04);
  toast("Sold "+fmt(cost)+" "+mktResLabel(kind)+" for "+fmt(amount)+" "+(counter==="sv"?"salvage":"Dark Matter"),"g");
  dirty=true; renderMarket(); return true;
}
/* which resources currently have a live SALVAGE card - ore always, crystal once any
   Smelter output exists, each exotic once it is held or being produced (patch630:
   the same per-item "held" test the old #exoStrip used before it became the
   context-card modal - see exoModal()). */
function mktSvKinds(){
  const ks=["ore"];
  if(cryRate()>0||S.cry>0)ks.push("cry");
  for(const e of EXO) if(exo(e.id)>0||exoRate(e.id)>0) ks.push(e.id);
  return ks;
}
function mktCardSkeleton(kind,counter){
  const d=document.createElement("div"); d.className="card mktcard";
  d.dataset.kind=kind; d.dataset.counter=counter;
  d.innerHTML=`<h5>${mktResLabel(kind)}</h5>
    <p class="mktprice"></p>
    <p class="mktheat"></p>
    <p class="mktget">you get <b class="mktgetv"></b></p>
    <button class="mktsell"></button>`;
  d.querySelector(".mktsell").onclick=()=>{
    if(!sellRes(kind,counter,mktAmount(kind,counter)))blip(140,.08,"sine",.03);
  };
  return d;
}
/* rebuilds card DOM (and rewires each SELL button) ONLY when the set of sellable
   resources actually changes - dataset.h guard, same idiom as patch538/546/548 -
   because renderMarket() below runs every render() tick while the pane is open and
   prices move every tick too; rebuilding the button node itself every tick would
   swap it out from under an in-flight tap. */
function buildMarket(){
  const svHost=$("#mktSv"), dmHost=$("#mktDm"); if(!svHost||!dmHost)return;
  const kinds=mktSvKinds(), key=kinds.join(",");
  if(svHost.dataset.h!==key){
    svHost.dataset.h=key; svHost.innerHTML="";
    for(const kind of kinds) svHost.appendChild(mktCardSkeleton(kind,"sv"));
  }
  if(dmHost.dataset.h!=="dm"){
    dmHost.dataset.h="dm"; dmHost.innerHTML="";
    dmHost.appendChild(mktCardSkeleton("ore","dm"));
  }
}
function renderMarket(){
  buildMarket();
  $$(".mktcard").forEach(d=>{
    const kind=d.dataset.kind, counter=d.dataset.counter;
    const price=mktPrice(kind,counter), k=mktAmount(kind,counter), cost=k*price;
    const bal=mktBal(kind), can=k>=1 && bal+1e-6>=cost;
    const outName=counter==="sv"?"Salvage":"Dark Matter";
    d.querySelector(".mktprice").textContent=fmt(price)+" "+mktResLabel(kind)+" = 1 "+outName;
    const heatPct=Math.round(mktHeat(counter)*100);
    d.querySelector(".mktheat").textContent = heatPct>0 ? "price up "+heatPct+"% \u2014 cooling" : "";
    d.querySelector(".mktgetv").textContent = "+"+fmt(k)+" "+outName;
    const btn=d.querySelector(".mktsell");
    btn.textContent="SELL "+fmt(Math.ceil(cost))+" "+mktResLabel(kind);
    btn.disabled=!can;
  });
}
/* ---------------------------------------------------------------------
   patch598: the defences row, detail strip and module picker. Selection
   is UI-only (never saved) - `defSel` is null, {slot,mode:"detail"} for a
   tap on a filled card, or {slot,mode:"pick"} for a tap on an empty one.
   Reset whenever the sheet is pointed at a different system (or closed).
--------------------------------------------------------------------- */
let defSel=null, defSelSys=null;
/* patch626 (PLAN-page.md): sheetScroll/sheetScrollSys/restoreSheetScroll()
   (patch611's per-system sheet-scroll memory) and sheetState/setSheetState()/
   syncSheetState() (patch620/623's FULL/PEEK three-state machine) are deleted
   here - #sysSheet is in-flow page content now, not an independently-scrolling,
   independently-heighted overlay, so neither had anything left to manage. #view's
   own existing paneScroll{} (see the tab-click handler) covers what per-pane
   scroll memory the page needs. */
/* patch600 polish: small line-icon glyphs (fortify-mock2.html's own style - 24x24,
   stroke=currentColor, no fill) in place of the old three-letter text labels.
   Colour comes from DEF_COLOR via CSS currentColor, same as everywhere else that
   already keys off --a. Turret Ring/Minefield are the mock's own two example
   icons, used verbatim; Shield Array/Sensor Mast/Hangar (not in the mock) are new,
   drawn in the same visual language. */
const DEF_GLYPH={
 tur:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2"/>',
 min:'<circle cx="12" cy="12" r="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8"/>',
 shd:'<path d="M12 3l7 3.2v5.3c0 4.6-3 7.6-7 8.7-4-1.1-7-4.1-7-8.7V6.2z"/>',
 sen:'<path d="M12 21v-9M7.8 9.6a5.2 5.2 0 018.4 0M4.6 6.6a9.4 9.4 0 0114.8 0"/><circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none"/>',
 han:'<path d="M4 20h16M6 20v-6.5a6 6 0 0112 0V20"/><path d="M9.5 20l1-4h3l1 4"/>',
 shy:'<path d="M4 18l8-13 8 13"/><path d="M4 18h16"/><path d="M9 18v-4h6v4"/>'
};
function defIconHTML(m){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DEF_GLYPH[m]||""}</svg>`; }
const DEF_ICON=DEF_GLYPH;   /* kept as an alias so the existing __SD export name still resolves */
const DEF_COLOR={ tur:"var(--cy)", min:"var(--gd)", shd:"var(--vi)", sen:"var(--gr)", han:"var(--sv)", shy:"#ffb45c" };
function defClearSel(){ defSel=null; defSelSys=null; }
/* the balance this system can actually spend on its own defences right now -
   its own exotic if it produces one, ore otherwise (same rule dmodPrice() uses). */
function defBalanceLabel(s){
  const ex=s.res?exoDef(s.res):null;
  return fmt(ex?exo(s.res):S.ore)+" "+(ex?ex.n.toUpperCase():"ORE");
}
/* a single card's own odds contribution - "what holdOdds() would be WITHOUT this
   slot" subtracted from what it is WITH it, so the number on the card is always
   traceable to the exact function the fight itself resolves against. Without a
   live threat, this previews against a flat reference weight (Helion, dif 1) so
   the row still means something before anyone is actually inbound. */
function defCardPct(s,slotIdx){
  const th=thqAtSys(s.id)||{rv:"hel",dif:1,sysId:s.id};
  const full=Math.round(holdOdds(th)*100);
  const without=Math.round(holdOdds(th,defStrength(s.id,slotIdx))*100);
  return full-without;
}
function renderSysOdds(s){
  const host=$("#sysOdds"); if(!host)return;
  if(s.home||!sysHeld(s.id)){
    if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true }
    return;
  }
  host.hidden=false;
  const th=thqAtSys(s.id)||{rv:"hel",dif:1,sysId:s.id};
  const pct=Math.round(holdOdds(th)*100), key="odds|"+pct;
  if(host.dataset.h!==key){
    host.dataset.h=key;
    host.innerHTML=`<div class="odds"><span>Garrison holds</span><b>${pct}%</b></div>
      <div class="obar"><i style="width:${pct}%"></i></div>
      <div class="onote">What your defences manage on their own, if you let them fight it without you.</div>`;
  }
}
function defCardHTML(s,i,slot){
  if(!slot){
    const sel=!!(defSel&&defSel.slot===i&&defSel.mode==="pick");
    return `<div class="sc empty${sel?" sel":""}" data-slot="${i}" data-empty="1">
      <div class="si">+</div>
      <div class="n">Empty</div><div class="lv">SLOT ${i+1}</div>
      <div class="e" style="color:var(--dim)">\u2014</div>
      <button type="button" data-slot="${i}">BUILD</button>
    </div>`;
  }
  const def=DEF_MODULES[slot.m]||{n:slot.m,maxLv:1,oneUse:false};
  const sel=!!(defSel&&defSel.slot===i&&defSel.mode==="detail");
  const building=!!slot.q;
  const spent=slot.m==="min"&&!slot.armed&&!building;
  const armed=slot.m==="min"&&slot.armed;
  let badge="";
  if(building)badge=`<span class="tag">BUILDING</span>`;
  else if(armed)badge=`<span class="tag ok">ARMED</span>`;
  else if(spent)badge=`<span class="tag bad">SPENT</span>`;
  const lvText = building ? `<span class="cardcd" data-slot="${i}"></span>`
    : slot.m==="han" ? hanCount(s.id)+"/"+HAN_CAP+" SHIPS"
    : def.oneUse ? (slot.armed?"ONE USE":"EMPTY")
    : "LV "+slot.lv+"/"+def.maxLv;
  const pct = spent ? 0 : defCardPct(s,i);
  const pctTxt = (pct>=0?"+":"")+pct+"%";
  let btnHTML;
  if(building){
    btnHTML=`<button type="button" disabled><span class="cardcd" data-slot="${i}"></span></button>`;
  } else if(def.oneUse && !slot.armed){
    btnHTML=`<button type="button" class="warn" data-act="rearm" data-slot="${i}">${dmodPrice(s,slot.lv)} \u00b7 REARM</button>`;
  } else if(!def.oneUse && slot.lv<def.maxLv){
    btnHTML=`<button type="button" data-act="up" data-slot="${i}">${dmodPrice(s,slot.lv)} \u00b7 UP</button>`;
  } else {
    btnHTML=`<button type="button" disabled>MAXED</button>`;
  }
  return `<div class="sc${sel?" sel":""}" data-slot="${i}" style="--a:${DEF_COLOR[slot.m]||"var(--cy)"}">${badge}
    <div class="si">${defIconHTML(slot.m)}</div>
    <div class="n">${def.n}</div><div class="lv">${lvText}</div>
    <div class="e"${spent?' style="color:var(--rd)"':""}>${pctTxt}</div>
    ${btnHTML}
  </div>`;
}
/* patch631: tapping an EMPTY slot opens this instead of expanding #sysDefDetail
   inline - called directly, imperatively, from the slot's own tap handler in
   renderSysDef(), NEVER from render() (11Hz - must not be able to reopen a modal
   the player already dismissed). Same DEF_MODULES/DEF_COLOR/defIconHTML/
   dmodPrice calls and .pk/.pki/.pkb/.pkn/.pkg markup the old inline branch used -
   only the host changed. defSel keeps its usual {slot,mode} shape so the empty
   card underneath still shows its .sel highlight (defCardHTML(), unchanged)
   while the modal is open, cleared back to null on both exits. */
function openDefPicker(s,i){
  const price=dmodPrice(s,0), unit=s.res?exoDef(s.res).n.toUpperCase():"ORE";
  const rows=Object.keys(DEF_MODULES).map(id=>{
    const def=DEF_MODULES[id];
    const afford=s.res?exo(s.res)>=price:S.ore>=price;
    const usable=!def.disabled&&afford;
    const short = def.disabled?"Not available yet"
      : !afford?("Need "+fmt(price)+" "+unit+" \u2014 short "+fmt(Math.max(0,price-(s.res?exo(s.res):S.ore)))+" "+unit)
      : def.guidance;
    return `<div class="pk${usable?"":" dim"}" data-m="${id}" style="--a:${DEF_COLOR[id]}">
      <div class="pki">${defIconHTML(id)}</div>
      <div class="pkb">
        <div class="pkn">${def.n}<span>${price} ${unit}</span></div>
        <div class="pkg">${short}</div>
      </div>
    </div>`;
  }).join("");
  /* showModal() (which sets #mask.on) has to run BEFORE the defSel+render() below -
     renderDefDetail()'s own self-heal check (see its comment) drops defSel the
     instant it sees "pick" without #mask.on, and #mask is not .on yet until this
     call returns; reversing this order would have the very first render() below
     undo the defSel this same function just set. */
  showModal(`<h3>Fit a module \u2014 slot ${i+1}</h3>
    <div id="defPickRows">${rows}</div>
    <div class="row"><button id="defPickCancel">CANCEL</button></div>`,
    ()=>{
      $("#defPickCancel").onclick=()=>{ hideModal(); defSel=null; render(); };
      $("#defPickRows").querySelectorAll(".pk").forEach(el=>{
        el.onclick=()=>{
          const m=el.dataset.m, def=DEF_MODULES[m]; if(!def||def.disabled)return;
          const afford=s.res?exo(s.res)>=price:S.ore>=price;
          if(!afford)return;
          if(dmodBuild(s,i,m)){ hideModal(); defSel=null; render(); save(); }
        };
      });
    });
  defSel={slot:i,mode:"pick"}; render();
}
function renderDefDetail(s,slots){
  const host=$("#sysDefDetail"); if(!host)return;
  /* patch631: the stale-"pick"-after-a-backdrop-close self-heal used to live here -
     moved to the top of renderSysDef(), the one and only caller, so it lands
     before that function's own churn-guarded .sel class instead of one render()
     tick after it (see the comment there). defSel is already healed by the time
     this runs. */
  if(!defSel){ if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true } return; }
  if(defSel.mode==="pick"){
    /* patch631: the picker is a modal now (openDefPicker(), opened imperatively
       from the slot's own tap handler - render() must never reopen it, it runs
       at 11Hz). This host has nothing left to show for "pick", same cleanup as
       the !defSel branch just above. */
    if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true }
    return;
  }
  const i=defSel.slot, slot=slots[i];
  if(!slot){ defSel=null; if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true } return; }
  host.hidden=false;
  const def=DEF_MODULES[slot.m];
  const key="detail|"+slot.m+":"+slot.lv+":"+(slot.armed?1:0)+":"+(slot.q?1:0);
  if(host.dataset.h!==key){
    host.dataset.h=key;
    const unit=s.res?exoDef(s.res).n.toUpperCase():"ORE";
    const costLine = slot.q ? "Building\u2026"
      : dmodPrice(s,slot.lv)+" "+unit+" \u00b7 "+dmodBuildSecs(slot.lv)+"s";
    const pctPer=Math.round((DEF_STR[slot.m]||0)*100);
    const effect = slot.m==="han" ? "Garrison bonus scales with the fleet you station here \u2014 see STATION FLEET"
      : def.oneUse ? "Breaks the first wave \u00b7 +"+pctPer+"% hold while armed"
      : "+"+pctPer+"% hold per level"
        +(slot.m==="shd"?" \u00b7 +"+Math.round(SHD_HULL_PER*100)+"% hull/level"
          :slot.m==="tur"?" \u00b7 1 turret/level":"");
    host.innerHTML=`<div class="detail" style="--a:${DEF_COLOR[slot.m]}">
      <div class="dn">${def.n}<span>${costLine}</span></div>
      <div class="de">${effect}</div>
      <p>${def.desc}</p>
      ${slot.q?"":`<div class="acts"><button type="button" id="sshDefSwap">SWAP MODULE</button></div>`}
    </div>`;
    const swapBtn=$("#sshDefSwap");
    if(swapBtn)swapBtn.onclick=()=>{ if(dmodSwap(s,i)){ defSel=null; render(); save(); } };
  }
}
/* patch610 - the BUILDINGS section: this system's own ladder, same .g rows the old
   accordion always used (ladderTierRow() untouched, see its own header comment).
   Held systems and home only - nothing built yet on an unclaimed one. Rebuild guard
   mirrors #sysDefRow's own dataset.h idiom one section down: a real change to what
   the rows should say (a buy landing, a buy-chip tap, a different system opened)
   rebuilds; ore ticking up between those doesn't (updateEmpBars(), every tick,
   unconditionally - see render()). Only one system's sheet is ever open, so this
   does the same reset-then-rebuild empSlotEls used to get from renderGens() every
   dirty tick, just scoped to the one system on screen instead of all of them. */
function renderSysBuild(s,held){
  const wrap=$("#sysBuild"), rowsHost=$("#sysBuildRows"), countEl=$("#sysBuildCount");
  if(!wrap||!rowsHost)return;
  if(!held){
    wrap.hidden=true;
    if(rowsHost.dataset.h!==""){ rowsHost.dataset.h=""; rowsHost.innerHTML=""; }
    return;
  }
  wrap.hidden=false;
  /* PLAN-polish batch B item 5: tiers below sysT0(id) are skipped outright - never
     shown, never bought - so the BUILDINGS list (and its "N of M tiers" count) is
     built from the visible slice of the ladder, not the whole thing. */
  const t0=sysT0(s.id);
  const ladder=sysLadder(s.id).filter(gi=>gi>=t0);
  const owned=ladder.filter(gi=>sysTierCount(s.id,gi)>0).length;
  const countTxt=owned+" of "+ladder.length+" tiers";
  if(countEl&&countEl.textContent!==countTxt)countEl.textContent=countTxt;
  let nextGi=null;
  for(const gi of ladder){ if(sysTierCount(s.id,gi)<=0){ nextGi=gi; break; } }
  /* the mission strip (Parked item, decided 24 Sep) needs its own rebuild trigger
     folded in here: which tiers are fed by the current mission window (S.mi can
     advance with no ladder count on THIS system changing at all) and each fed
     tier's own empire-wide gCount (a claim on a DIFFERENT system still moves it). */
  const misKey=MISSIONS.slice(S.mi||0,(S.mi||0)+3).map(m=>m.gi!=null?m.gi+":"+gCount(m.gi):"").join(",");
  const key=s.id+"|"+ladder.map(gi=>sysTierCount(s.id,gi)).join(",")+"|"+S.buy+"|"+nextGi+"|"+misKey;
  if(rowsHost.dataset.h!==key){
    /* patch611, retargeted patch626: #view is the scrolling ancestor now (the
       page itself is in-flow - see #sysSheet's own CSS comment) and a shorter
       rebuilt content can clamp ITS scrollTop on its own; reassert the exact
       value right after, every time, regardless of cause. */
    const viewEl=$("#view"), prevTop=viewEl?viewEl.scrollTop:0;
    rowsHost.dataset.h=key;
    empSlotEls=[];
    rowsHost.innerHTML="";
    let shownNext=false, nextRowEl=null;
    for(const gi of ladder){
      if(sysTierCount(s.id,gi)>0){ rowsHost.appendChild(ladderTierRow(s.id,gi,false)); }
      else if(!shownNext){ nextRowEl=ladderTierRow(s.id,gi,true); rowsHost.appendChild(nextRowEl); shownNext=true; }
      else break;
    }
    /* polish batch A #2: the very first time a second tier row (Smelter Pod, right
       after the first Mining Drone) becomes visible, it can sit below the fold on a
       small screen - scroll it into view instead of restoring the old scroll
       position. One-time only (S.seen guard), any later reveal keeps the old
       restore-scrollTop behaviour. */
    if(!S.seen)S.seen={};
    if(owned===1 && nextRowEl && !S.seen.tierReveal1){
      S.seen.tierReveal1=true;
      if(viewEl)nextRowEl.scrollIntoView({block:"nearest"});
    } else if(viewEl)viewEl.scrollTop=prevTop;
  }
}
/* PLAN-governors owner decision 3: the GOVERNOR toggle chip, under the BUILDINGS
   header. The button itself is churn-guarded the same way every other rebuilt row in
   this file is (dataset.h); the last-buy line under it is plain textContent, updated
   every render() pass with no rebuild - same idiom #flLoc (09-render.js) already
   uses for a coarse, always-live clock, never itself a churn risk since tchurn2 only
   fingerprints <button> elements. */
function renderSysGov(s,held){
  const wrap=$("#sysGov"); if(!wrap)return;
  if(!held){
    if(!wrap.hidden){ wrap.hidden=true; wrap.dataset.h=""; wrap.innerHTML=""; }
    return;
  }
  const st=sysState(s.id);
  if(!st){
    if(!wrap.hidden){ wrap.hidden=true; wrap.dataset.h=""; wrap.innerHTML=""; }
    return;
  }
  const cap=lv(S.rs,"auto"), cnt=govCount(), on=!!st.gov;
  /* hidden until at least one Governors level is researched - same "nothing to show
     yet" gate exoEverBankedAny()/the PROGRAMMES tab use, and what keeps a brand-new
     save's first BUY row exactly where it was before this feature existed
     (topen2.js's own pinned-scan-bar layout assertion). */
  if(cap<=0 && !on){
    if(!wrap.hidden){ wrap.hidden=true; wrap.dataset.h=""; wrap.innerHTML=""; }
    return;
  }
  wrap.hidden=false;
  const key=s.id+"|"+on+"|"+cap+"|"+cnt;
  if(wrap.dataset.h!==key){
    wrap.dataset.h=key;
    const label = on ? "GOVERNOR · ON" : (cnt>=cap ? "GOVERNOR · "+cnt+"/"+cap : "GOVERNOR · OFF");
    wrap.innerHTML=`<button type="button" class="chip gov${on?" on":""}" id="sysGovBtn">${label}</button>
      <div id="sysGovLast" class="sysGovLast" hidden></div>`;
    $("#sysGovBtn").onclick=()=>{
      if(govSetAppointed(s.id,!on)){ save(); render(); }
      else { blip(140,.08,"sine",.03); render(); }
    };
  }
  const lastEl=$("#sysGovLast");
  if(lastEl){
    /* PLAN-polish batch C #2 (Governors v2): a governor now does two kinds of
       thing (buy a tier, or fit a module into an empty slot) - the line shows
       whichever happened more recently, same plain textContent-every-render idiom
       (never a churn risk - tchurn2 only fingerprints <button>). */
    const buyT=(st.gl&&GENS[st.gl.gi])?st.gl.t:-1;
    const fitT=(st.gfl&&DEF_MODULES[st.gfl.m])?st.gfl.t:-1;
    if(fitT>buyT && fitT>=0){
      const agoS=Math.max(0,(Date.now()-st.gfl.t)/1000);
      lastEl.hidden=false;
      lastEl.textContent="Governor fitted "+DEF_MODULES[st.gfl.m].n+" · "+fmtT2(agoS)+" ago";
    } else if(buyT>=0){
      const agoS=Math.max(0,(Date.now()-st.gl.t)/1000);
      lastEl.hidden=false;
      lastEl.textContent="Governor bought "+GENS[st.gl.gi].n+" · "+fmtT2(agoS)+" ago";
    } else if(!lastEl.hidden){ lastEl.hidden=true; lastEl.textContent=""; }
  }
}
function renderSysDef(s){
  const wrap=$("#sysDefWrap"), head=$("#sysDefHead"), row=$("#sysDefRow");
  if(!wrap)return;
  /* patch631 (moved here from renderDefDetail(), same render() pass this used to
     lag a tick behind): #mask's own generic backdrop-tap-to-close (see its own
     onclick, wired once near the other one-time wiring) closes ANY modal,
     including this one, without knowing defSel exists - self-heal here rather
     than teaching a generic handler about one feature's state. Has to run
     BEFORE rowKey below, which bakes defSel into the cards' own churn-guarded
     .sel class (renderDefDetail() ran after that guard, so the heal landed one
     render() tick too late for .sel to notice on the same pass - a real if
     brief stuck highlight). */
  if(defSel && defSel.mode==="pick" && !$("#mask").classList.contains("on")) defSel=null;
  if(s.home||!sysHeld(s.id)){
    wrap.hidden=true;
    if(head&&head.dataset.h!==""){ head.dataset.h=""; head.innerHTML="" }
    if(row&&row.dataset.h!==""){ row.dataset.h=""; row.innerHTML="" }
    const detail=$("#sysDefDetail");
    if(detail&&detail.dataset.h!==""){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    return;
  }
  if(defSelSys!==s.id){ defSelSys=s.id; defSel=null; }
  wrap.hidden=false;
  const slots=dmodSlots(s.id);
  const filled=slots.filter(Boolean).length;
  /* patch621: gated only while nothing is filled yet AND this system's own exotic
     has never once been banked - dmodBuild()/dmodUpgrade() price a slot in exactly
     that exotic (dmodPrice()), so with none banked every Empty card's BUILD button
     is a dead control. Ore-kind systems (s.res===null) price in plain ore instead -
     never gated, there is nothing to wait for. Permanent once cleared, same
     exoEverBanked() one-way semantics as #exoStrip (patch613c). */
  const gated = !!(s.res && !exoEverBanked(s.res) && filled===0);
  /* both keys below carry the gate flag, not just filled - filled stays 0 across
     the banking moment itself, so without this the churn guard would never notice
     the transition and the real cards would never appear the first time the
     exotic is banked. */
  const headKey="head|"+filled+"|"+defBalanceLabel(s)+"|g"+(gated?s.res:"0");
  if(head.dataset.h!==headKey){
    head.dataset.h=headKey;
    head.innerHTML=`<span>Defences</span><span>${filled} of 3 slots \u00b7 ${defBalanceLabel(s)}</span>`
      +(gated?`<div class="defgatehint"><!-- PLACEHOLDER: patch621, owner rewrites all story/tutorial copy later -->Bank ${exoDef(s.res).n.toLowerCase()} here to fit defences.</div>`:"");
  }
  const rowKey = gated
    ? "gated|"+s.res
    : slots.map(sl=>sl?(sl.m+":"+sl.lv+":"+(sl.armed?1:0)+":"+(sl.q?1:0)):"e").join("|")
      +"|sel="+(defSel?defSel.slot+":"+defSel.mode:"-");
  if(row.dataset.h!==rowKey){
    row.dataset.h=rowKey;
    row.innerHTML = gated ? "" : slots.map((sl,i)=>defCardHTML(s,i,sl)).join("");
    if(!gated){
      row.querySelectorAll(".sc").forEach(el=>{
        el.onclick=()=>{
          const i=+el.dataset.slot;
          if(el.dataset.empty){ openDefPicker(s,i); return; }   /* patch631: modal, opened here - never from render() */
          const mode="detail";
          defSel=(defSel&&defSel.slot===i&&defSel.mode===mode)?null:{slot:i,mode};
          render();
        };
      });
      row.querySelectorAll("[data-act]").forEach(btn=>{
        btn.onclick=(ev)=>{
          ev.stopPropagation();
          const i=+btn.dataset.slot, act=btn.dataset.act;
          let ok=false;
          if(act==="up")ok=dmodUpgrade(s,i);
          else if(act==="rearm")ok=dmodRearm(s,i);
          if(ok){ render(); save(); }
        };
      });
    }
  }
  /* live countdown text, independent of the structural guard above - same idiom
     as #sysFort's own .fortcd used to be (tchurn2: never rebuild for a tick). */
  row.querySelectorAll(".cardcd").forEach(el=>{
    const i=+el.dataset.slot, sl=slots[i];
    if(sl&&sl.q) el.textContent=Math.max(0,Math.ceil((sl.q.dueAt-Date.now())/1000))+"s";
  });
  renderDefDetail(s,slots);
}
/* STATION FLEET row - shown only once this system carries a built+armed Hangar
   (dmodLv>0). Separate from the defences row's own per-card buttons: the Hangar's
   card just reads BUILT/MAXED like Sensor Mast's does, all the actual interaction
   (picking hull classes, how many) lives in this one button + its modal, per the
   plan's own "STATION FLEET ... opens the stationing UI". */
function renderSysHan(s){
  const wrap=$("#sysHanWrap"); if(!wrap)return;
  if(s.home||!sysHeld(s.id)||dmodLv(s.id,"han")<=0){
    if(!wrap.hidden||wrap.dataset.h!==""){ wrap.hidden=true; wrap.dataset.h=""; wrap.innerHTML=""; }
    return;
  }
  wrap.hidden=false;
  const used=hanCount(s.id), key="han|"+used;
  if(wrap.dataset.h!==key){
    wrap.dataset.h=key;
    wrap.innerHTML=`<button type="button" class="ghost" id="sysHanBtn">STATION FLEET${used?" \u00b7 "+used+"/"+HAN_CAP:""}</button>`;
    $("#sysHanBtn").onclick=()=>hanModal(s.id);
  }
}
function hanRowHTML(sysId,i){
  const owned=curFleet().sh[i]||0, stationed=hanFleet(sysId)[i]||0, left=hanLeft(sysId);
  const canAdd=owned>0&&left>0, canSub=stationed>0;
  return `<div class="hanrow">
    <div class="hi" style="color:${SHIPS[i].col}"><svg viewBox="0 0 48 48">${SHIPS[i].ic}</svg></div>
    <div style="min-width:0;flex:1">
      <div class="hn">${SHIPS[i].n}</div>
      <div class="hd2">${fmt(SHIPS[i].dps)} dps \u00b7 ${fmt(SHIPS[i].hp)} hull \u00b7 ${owned} in fleet</div>
    </div>
    <div class="hanstep">
      <button type="button" data-hstep="-1" data-i="${i}" ${canSub?"":"disabled"}>\u2212</button>
      <span class="hcnt">${stationed}</span>
      <button type="button" data-hstep="1" data-i="${i}" ${canAdd?"":"disabled"}>+</button>
    </div>
  </div>`;
}
function hanModalHTML(sysId){
  const s=SYSMAP[sysId], used=hanCount(sysId);
  const th=thqAtSys(sysId)||{rv:"hel",dif:1,sysId};
  const pct=Math.round(holdOdds(th)*100);
  return `<div class="nmh" style="--a:${DEF_COLOR.han};--a2:rgba(255,255,255,.06)">
      <div class="nmt" style="color:${DEF_COLOR.han}">${defIconHTML("han")}</div>
      <div style="min-width:0"><h3 style="margin:0 0 2px;color:${DEF_COLOR.han}">Hangar \u2014 ${s.n}</h3>
        <div class="nmm">${used} of ${HAN_CAP} stationed</div></div>
    </div>
    <p>Stationed hulls fight beside the garrison and come off your raiding fleet until recalled \u2014 they still cost fleet capacity either way.</p>
    <div id="hanRows">${[0,1,2].map(i=>hanRowHTML(sysId,i)).join("")}</div>
    <div class="rrow" style="margin-top:8px"><span>Garrison holds</span><b>${pct}%</b></div>
    <div class="row" style="margin-top:10px"><button id="hanRecallAll" class="ghost">RECALL ALL</button><button id="hanDone">DONE</button></div>`;
}
function hanModal(sysId){
  showModal(hanModalHTML(sysId), ()=>hanModalWire(sysId));
}
function hanModalWire(sysId){
  const refresh=()=>{ $("#modal").innerHTML=hanModalHTML(sysId); hanModalWire(sysId); render(); };
  $("#modal").querySelectorAll("[data-hstep]").forEach(btn=>{
    btn.onclick=()=>{
      const i=+btn.dataset.i, step=+btn.dataset.hstep;
      const did = step>0 ? stationHan(sysId,i,1) : recallHan(sysId,i,1);
      if(did){ save(); refresh(); }
    };
  });
  const ra=$("#hanRecallAll"); if(ra)ra.onclick=()=>{ if(recallHanAll(sysId)){ save(); refresh(); } };
  const done=$("#hanDone"); if(done)done.onclick=()=>{ hideModal(); render(); };
}
/* patch626 (PLAN-page.md): mapZoomMeasure()/mzVisFrac used to live here - real
   measured layout for how much of #mapWrap a not-yet-closed #sysSheet was
   currently covering, so the zoomed planet could shrink into whatever band was
   still visible above it. Deleted: the map square is a dedicated 34vh page header
   now (see #mapWrap's own CSS comment) that the page content flows below, never
   over, so the planet always gets the whole thing - see drawSysScene()'s own
   comment and draw()'s zoom branch. */
/* patch614: rows for the LIST sub-view - sysInSec(mapSec), unheld branch recovered
   verbatim from patch612.py's own deleted empSysRow() (see this file's header
   note), held branch a new non-expandable variant of the same row (no accordion -
   "a tap is the same as tapping the node", never mind that empSysRow()'s accordion
   is gone anyway). Every row's tap does exactly what a map-node tap does
   (buildMap()'s own b.onclick, unchanged) plus drops back to mapMode="map", so
   #mapMode being hidden while zoomed can never strand the player in list mode -
   the only way INTO list mode is the toggle itself, and the only way it flips to
   list also clears any zoom (see the button wiring at the bottom of the file). */
function mapNodeTapEquivalent(id){
  S.msel=id; mapMode="map"; syncMapMode();  /* patch627: the derivation zooms it */
  dirty=true; render();
}
/* claimable / contested / locked row - patch612.py's empSysRow(), unheld branch,
   verbatim (DOM-construction style kept as-is), only the onclick swapped for the
   node-tap-equivalent above (the original called gotoTab("p-map") because it lived
   on the old Empire tab; LIST is already on the map, so there is nowhere to go). */
function listOpenRow(s){
  const id=s.id;
  const claimable=sysOpen(s);
  const contested=sysContested(s) && level()>=s.lvl;
  const el=document.createElement("div");
  if(claimable){
    el.className="sysrow2 claimable";
    el.innerHTML=`<div class="sysrow2-main">
        <span class="sysname">${s.n}</span>
        <span class="kindbadge" style="--a:var(--gr)">CLAIM READY</span></div>
      <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span><span><b>${fmt(s.cost)}</b> ORE</span></div>`;
  } else if(contested){
    const rv=RIVALMAP[sysOwner(s)], at=assaultTarget(s);
    const occ=sysOccupied(id), weak=occ&&occWeakMul(id)<1;
    el.className="sysrow2 contested"+(occ?" occ":"");
    el.innerHTML=`<div class="sysrow2-main">
        <span class="rivalmark" style="--a:${rv.col}" title="${rv.n}">${occ?"\u26e8":"\u2694"}</span>
        <span class="sysname">${s.n}</span>
        <span class="kindbadge" style="--a:var(--rd)">${occ?"RETAKE":"INVADE"}</span></div>
      <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span>
        <span style="color:${rv.col}">${rv.n.toUpperCase()}</span>
        <span><b>${at.en}</b> SHIPS \u00b7 \u00d7${fmt(s.def)}${weak?" \u00b7 WEAKENED":""}</span></div>`;
  } else {
    el.className="sysrow2 locked";
    el.innerHTML=`<div class="sysrow2-main"><span class="lockicon">\ud83d\udd12</span>
        <span class="sysname">${s.n}</span></div>
      <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span><span>${fmt(s.cost)} ORE</span></div>`;
  }
  el.onclick=()=>mapNodeTapEquivalent(id);
  return el;
}
/* held row - kind-tinted, NOT expandable (see header note). New markup, not a
   port: the original empSysRow() held branch built an accordion header
   (empOpen/empAccordionTap, both gone) - only its stat line and the five --a-*
   custom properties (KIND_INFO tinting, same as the sheet's own held-row CSS
   comment) are reused, plus a NEXT TIER READY badge the original never had. */
let mapListEls=[];
function listHeldRow(s){
  const id=s.id;
  const kind=KIND_INFO[s.kind]||KIND_INFO.mixed;
  const ladder=sysLadder(id);
  const owned=ladder.filter(gi=>sysTierCount(id,gi)>0).length;
  const ex=s.res?exoDef(s.res):null;
  const nextGi=sysNextGi(id);
  const el=document.createElement("div");
  el.className="sysrow2 held kindtint";
  el.style.setProperty("--a",kind.col);
  el.style.setProperty("--a-wash","rgba("+kind.rgb+",.12)");
  el.style.setProperty("--a-wash-body","rgba("+kind.rgb+",.06)");
  el.style.setProperty("--a-border","rgba("+kind.rgb+",.55)");
  el.style.setProperty("--a-text",kind.txt);
  const gov=sysState(id)&&sysState(id).gov;
  el.innerHTML=`<div class="sysrow2-main">
      <span class="sysname">${s.n}${gov?' <span class="govmark" title="Governed">\u25c6</span>':''}</span>
      <span class="kindbadge" style="--a:${kind.col}">${kind.n}</span>
      <span class="kindbadge ready" style="--a:var(--gr)" hidden>\u25cf NEXT TIER READY</span></div>
    <div class="sysrow2-stats">
      <span>${ex?ex.n.toUpperCase():"\u2014"}</span>
      <span><b>${owned}/${ladder.length}</b> TIERS</span>
      <span><b>${fmt(sysOreRate(id))}</b> ORE/S</span>
      ${ex?`<span><b>${fmt(sysExoRate(id))}</b> ${ex.n.toUpperCase()}/S</span>`:""}
    </div>`;
  el.onclick=()=>mapNodeTapEquivalent(id);
  mapListEls.push({el,sysId:id,nextGi});
  return el;
}
function listSysRow(s){ return (s.home||sysHeld(s.id)) ? listHeldRow(s) : listOpenRow(s); }
/* patch614: rebuilt only when the key actually changes - same dataset.h idiom as
   every other rebuild-guarded block in this file (renderSysBuild, renderMapChips,
   ...). Deliberately excludes S.ore (which changes every frame) - the live NEXT
   TIER READY affordability check is updated separately, per row, from
   updateEmpBars() (mapListEls), the same split renderSysBuild()/ladderTierRow()
   already use for their own "can afford" state. */
function renderMapList(){
  const host=$("#mapList"); if(!host)return;
  if(mapMode!=="list")return;
  const list=sysInSec(mapSec);
  const key=mapSec+"|"+list.map(s=>{
    if(s.home||sysHeld(s.id)){
      const ladder=sysLadder(s.id);
      const gov=sysState(s.id)&&sysState(s.id).gov?1:0;
      return s.id+"h"+ladder.map(gi=>sysTierCount(s.id,gi)>0?1:0).join("")+"g"+gov;
    }
    const claimable=sysOpen(s), contested=sysContested(s)&&level()>=s.lvl;
    return s.id+(claimable?"c":contested?"w"+(sysOccupied(s.id)?1:0):"l");
  }).join("|");
  if(host.dataset.h===key)return;
  host.dataset.h=key;
  mapListEls=[];
  host.innerHTML="";
  for(const s of list)host.appendChild(listSysRow(s));
}
function renderMap(){
  initMapSec();
  /* patch618: class toggle only, on the one persistent #mapWrap element - never
     a rebuild (tchurn2.js sweeps every on-pane button for DOM-identity churn).
     level()<unlockLv("p-map") is the exact condition sysInSec() already filters
     home-only on. */
  { const w=$("#mapWrap"); if(w)w.classList.toggle("homeonly",level()<unlockLv("p-map")); }
  /* patch609b: a map-unlock-level crossing changes what sysInSec() returns for the
     SAME sector, which the mapSecBuilt check alone can't see - force the same rebuild
     a sector change already gets. */
  if(!mapBuilt||mapSecBuilt!==mapSec||mapRevealBuilt!==(level()>=unlockLv("p-map")))buildMap();
  renderMapChips();
  renderMapList();
  for(const s of sysInSec(mapSec)){
    const el=$$("#mapNodes .mnode").find(x=>x.dataset.s===s.id); if(!el)continue;
    const held=s.home||sysHeld(s.id), open=sysOpen(s), foe=sysContested(s);
    el.classList.toggle("home",!!s.home);
    el.classList.toggle("held",held);
    el.classList.toggle("open",open);
    el.classList.toggle("foe",foe);
    el.classList.toggle("locked",!held&&!open&&!foe);
    el.classList.toggle("sdfort",held&&!s.home&&dmodSlots(s.id).some(Boolean));
    el.classList.toggle("occ",!!sysOccupied(s.id));           /* STAGE 2 */
    /* STAGE C: the !s.home guard predates any threat being able to target home at all -
       a sab entry (patch586) is the one legitimate case, and LF (the other half of this
       same check) structurally never targets home, so dropping the guard cannot light
       this up for anything else. */
    el.classList.toggle("incoming",held&&(!!thqAtSys(s.id)||(LF&&LF.sysId===s.id)||(!!s.home&&S.end===1)));  /* STAGE 2 (2C) + STAGE 3 live fleet + STAGE C sab + patch589 the turn */
    if(foe)el.style.setProperty("--a",RIVALMAP[sysOwner(s)].col);
    else if(s.res)el.style.setProperty("--a",exoDef(s.res).col);
    el.classList.toggle("sel",S.msel===s.id);
    const wantBadge = held&&!s.home&&LF&&LF.sysId===s.id;
    let badge=el.querySelector(".fleetbadge");
    if(wantBadge && !badge){
      badge=document.createElement("div"); badge.className="fleetbadge";
      badge.textContent="FLEET INBOUND"; el.insertBefore(badge, el.firstChild);
    } else if(!wantBadge && badge){ badge.remove(); }
    $$("#mapLinks line").forEach(x=>{
      if(x.dataset.a!==s.id&&x.dataset.b!==s.id)return;
      const other=SYSMAP[x.dataset.a===s.id?x.dataset.b:x.dataset.a];
      const oheld=other&&(other.home||sysHeld(other.id));
      const ofoe=other&&sysContested(other);
      x.classList.toggle("held",held&&oheld);
      x.classList.toggle("foe",foe||ofoe);
    });
  }
  refreshTerritory();
  renderTripMarker();
  renderMapEdge();
  renderFleetMarkers();       /* PLAN-fleets run 2 - after nodes are built/positioned */
  /* patch628b: this used to also declare `sheet` (a $("#sysSheet") lookup) for
     the two classList("open") toggles just below, now deleted along with
     body.syspage's own second writer - see this patch's own header. #sysSheet's
     visibility is body.syspage #sysSheet{display:block} now, syncSysPage()'s
     derivation (called at the top of every render(), before this function
     runs) already set body.syspage correctly by the time this line runs. */
  const info=$("#sysInfo"), act=$("#sysAct"), thrBox=$("#sysThreat");
  if(!info)return;
  const s=S.msel?SYSMAP[S.msel]:null;
  if(!s){
    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }
    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }
    const buildWrap=$("#sysBuild");
    if(buildWrap&&!buildWrap.hidden){
      buildWrap.hidden=true;
      const rowsHost=$("#sysBuildRows"); if(rowsHost){ rowsHost.dataset.h=""; rowsHost.innerHTML=""; }
    }
    const govWrap=$("#sysGov");
    if(govWrap&&!govWrap.hidden){ govWrap.hidden=true; govWrap.dataset.h=""; govWrap.innerHTML=""; }
    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }
    defClearSel();
    const oddsBox=$("#sysOdds"); if(oddsBox&&oddsBox.dataset.h!==""){ oddsBox.dataset.h=""; oddsBox.innerHTML=""; oddsBox.hidden=true }
    const defWrap=$("#sysDefWrap");
    if(defWrap&&!defWrap.hidden){
      defWrap.hidden=true;
      const head=$("#sysDefHead"), row=$("#sysDefRow"), detail=$("#sysDefDetail");
      if(head){ head.dataset.h=""; head.innerHTML="" }
      if(row){ row.dataset.h=""; row.innerHTML="" }
      if(detail){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    }
    const hanWrap=$("#sysHanWrap");
    if(hanWrap&&!hanWrap.hidden){ hanWrap.hidden=true; hanWrap.dataset.h=""; hanWrap.innerHTML=""; }
    renderSysFleets(null);
    return;
  }
  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;
  renderSysBuild(s,held);
  renderSysGov(s,held);
  let rows="";
  if(s.home){
    rows=`<div class="sysrow"><span>Structures</span><b>${fmt(tot())}</b></div>
      <div class="sysrow"><span>Output</span><b>${fmt(rate())} /s</b></div>`;
    /* patch598 polish fix: dropped the "Incoming fleet" row here - #sysThreat's own
       red block (held systems, home included) already says rival + clock, so this
       was saying the same thing twice. */
  } else {
    rows=`<div class="sysrow"><span>Yields</span><b style="color:${e?e.col:"var(--cy)"}">${e?e.n:"Ore"}</b></div>`;
    if(held){
      /* patch598: the old one-line "Defences" summary is gone - the row of cards
         below (#sysDefRow) is now the one true, detailed picture of what is fitted.
         The "Incoming fleet" row that used to sit here is gone too, same polish fix
         as the home branch above - #sysThreat's own red block already says it. */
      /* STAGE 3: the live fleet gets its own row too, gold not red, so this one
         reads as the different mechanism it is even when both are visible together.
         FIX 2 (2026-09-06): both rows now name the rival too, same as every other
         combat-adjacent row on this panel (occupied/contested) already does - see
         patch485's own top-of-file note on why "archetype" itself does not apply
         to an inbound attack on a held system. */
      if(LF&&LF.sysId===s.id){ const lfrv=RIVALMAP[LF.rv];
        rows+=`<div class="sysrow"><span style="color:var(--gd)">Live fleet</span><b style="color:var(--gd)">${
          lfrv?lfrv.n+" \u00b7 ":""}${lfClock((LF.dueAt-Date.now())/1000)}</b></div>`; }
    } else if(sysOccupied(s.id)){
      /* STAGE 2: occupied - not claimable, so no claim price to show. Garrison and
         archetype intel mirror the ordinary contested block below one-for-one. */
      const rv=RIVALMAP[sysOccupied(s.id)];
      const gt=assaultTarget(s), garch=ARCH[gt.arch];
      const weak=occWeakMul(s.id)<1;
      rows+=`<div class="sysrow"><span>Status</span><b style="color:var(--rd)">Occupied${
          weak?" \u00b7 garrison weakened":""}</b></div>
        <div class="sysrow"><span>Garrison</span><b style="color:${rv.col}">${
          gt.en} ships \u00b7 \u00d7${fmt(s.def)} strength</b></div>`;
      if(garch)rows+=`<div class="sysrow"><span>Archetype</span><b style="color:${rv.col}">${
        garch.n} \u2014 ${garch.tag}</b></div>`;
    } else {
      rows+=`<div class="sysrow"><span>Claim cost</span><b>${fmt(s.cost)} ore</b></div>
        <div class="sysrow"><span>Pays on claim</span><b style="color:var(--gd)">${fmt(s.dm)} Dark Matter</b></div>
        <div class="sysrow"><span>Requires</span><b>Level ${s.lvl}</b></div>`;
      if(sysContested(s)){
        const rv=RIVALMAP[sysOwner(s)];
        const gt=assaultTarget(s), garch=ARCH[gt.arch];
        rows+=`<div class="sysrow"><span>Garrison</span><b style="color:${rv.col}">${
          gt.en} ships \u00b7 \u00d7${s.def} strength</b></div>`;
        if(garch)rows+=`<div class="sysrow"><span>Archetype</span><b style="color:${rv.col}">${
          garch.n} \u2014 ${garch.tag}</b></div>`;
        rows+=`<div class="sysrow"><span>Reinforcements</span><b>${waveTFor(assaultTarget(s))}s into the fight</b></div>`;
      }
    }
  }
  const rvid=sysOwner(s), rv=rvid?RIVALMAP[rvid]:null;
  const owner = rv ? ("HELD BY "+rv.n) : (held?"Yours":(s.owner?"Driven off \u2014 unclaimed":"Unclaimed"));
  const ih=`<h4 style="color:${e?e.col:"var(--gr)"}">${s.n}</h4>
    <div class="sysmeta" ${rv?`style="color:${rv.col}"`:""}>${
      s.home?"HOME SYSTEM":"RING "+s.ring} \u00b7 ${owner.toUpperCase()}</div>
    <div class="sysd">${s.d}${rv?" <b style=\"color:"+rv.col+"\">"+rv.t+"</b>":""}</div>${rows}`;
  if(info.dataset.h!==ih){ info.dataset.h=ih; info.innerHTML=ih }
  if(s.home||!act){
    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }
    return;
  }
  if(sysContested(s)){
    const trip=S.trip, myTrip=trip&&trip.sysId===s.id, otherTrip=!!(trip&&!myTrip);
    if(myTrip && !tripArrived(trip)){
      const secsLeft=Math.max(0,Math.ceil((trip.dueAt-Date.now())/1000));
      const ah=`<button class="ghost" id="sysTripCd" disabled>EN ROUTE \u00b7 <span class="tripcd"></span></button>`;
      if(act.dataset.h!==ah){ act.dataset.h=ah; act.innerHTML=ah }
      const cd=act.querySelector(".tripcd"); if(cd)cd.textContent=secsLeft+"s";
    } else if(myTrip && tripArrived(trip)){
      const gt=assaultTarget(s), auto=canAutoResolve(gt);
      const ah = auto
        ? `<button class="foe" id="sysWar">ENGAGE \u00b7 AUTO-RESOLVE</button>
           <button class="ghost" id="sysWarManual" style="margin-top:8px">ENGAGE \u00b7 FIGHT IT ANYWAY</button>`
        : `<button class="foe" id="sysWar">ENGAGE</button>`;
      if(act.dataset.h!==ah){
        act.dataset.h=ah; act.innerHTML=ah;
        $("#sysWar").onclick=()=>{ S.trip=null; if(auto)autoResolveTarget(gt,-1); else engageTarget(gt,-1); render(); save() };
        if(auto)$("#sysWarManual").onclick=()=>{ S.trip=null; engageTarget(assaultTarget(s),-1); render(); save() };
      }
    } else {
      const can=canAssault(s)&&!otherTrip;
      let why=sysOccupied(s.id)?"RETAKE SYSTEM":"ASSAULT GARRISON";   /* STAGE 2 */
      if(level()<s.lvl)why="LOCKED \u00b7 LEVEL "+s.lvl;
      else if(fleetDPS()<=0)why="NO FLEET \u00b7 BUILD WARSHIPS";
      else if(curFleet().hp<0.15)why="FLEET TOO DAMAGED";
      else if(otherTrip)why="FLEET AWAY";
      const ah=`<button class="foe" id="sysWar" ${can?"":"disabled"}>${why}</button>`;
      if(act.dataset.h!==ah){
        act.dataset.h=ah; act.innerHTML=ah;
        $("#sysWar").onclick=()=>{ if(launchAssault(s)){ render(); save() } };
      }
    }
  } else if(!held){
    const can=level()>=s.lvl&&S.ore>=s.cost;
    const ah=`<button id="sysClaim" ${can?"":"disabled"}>${
      level()<s.lvl ? "LOCKED \u00b7 LEVEL "+s.lvl : "CLAIM \u00b7 "+fmt(s.cost)+" ORE"}</button>`;
    if(act.dataset.h!==ah){
      act.dataset.h=ah; act.innerHTML=ah;
      $("#sysClaim").onclick=()=>{ if(claimSystem(s)){ queueFirstAmbush(s); render(); save() } };
    }
  } else {
    /* patch598: FORTIFY is retired - the defences row (renderSysDef(), below)
       replaces it outright, so #sysAct has nothing left to show for a held,
       non-home system. */
    if(act.dataset.h!==""){ act.dataset.h=""; act.innerHTML=""; }
  }
  renderSysOdds(s);
  renderSysFleets(s);
  renderSysDef(s);
  renderSysHan(s);
  /* patch595: under attack - the 4th sheet state. Only a held system (home
     included) can carry a queued threat (thqAtSys()) - same DEFEND IT / LET
     THEM HOLD choice the Raids tab's #thrCard already offers, calling the
     exact same startDefence()/holdLine(); this is a second entry point onto
     those, not a second mechanism, so holdOdds() stays the one true number. */
  if(thrBox){
    const th=held?thqAtSys(s.id):null;
    const acts=$("#sysThreatActs");
    if(!th){
      if(thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }
      if(acts&&acts.dataset.h!==""){ acts.dataset.h=""; acts.innerHTML=""; acts.hidden=true }
      { const sb=$("#sshScanBar"); if(sb)sb.hidden=false; }
    } else {
      const trv=RIVALMAP[th.rv], tod=Math.round(holdOdds(th)*100);
      /* patch599: Sensor Mast is the one gate for the doctrine line AND the
         "rises to n%" preview - both computed via defBestPreview()/holdOdds()
         itself, never a parallel estimate, and both simply absent without one. */
      const hasSen=th.kind!=="sab"&&hasSensorMast(s.id);
      const preview=hasSen?defBestPreview(s):null;
      const prevPct=preview?Math.round(holdOdds(th,defStrength(s.id)+preview.gain)*100):null;
      const tkey=th.id+"|"+tod+"|"+(prevPct!==null?prevPct:"-");
      thrBox.hidden=false;
      if(thrBox.dataset.h!==tkey){
        thrBox.dataset.h=tkey;
        const doctrine=hasSen&&STORY.doctrine&&STORY.doctrine[th.rv];
        thrBox.innerHTML=`<div class="thrc${th.t<3600?" soon":""}">
          <h5>UNDER ATTACK<span class="thrt" id="sshThrCd">${thqClock(th.t)} left</span></h5>
          <div class="who" style="color:${trv?trv.col:"var(--rd)"}">${trv?trv.n:"Hostiles"}</div>
          ${doctrine?`<p>${doctrine}</p>`:""}
          ${preview?`<div class="rec">${preview.verb} lifts you to ${prevPct}%.</div>`:""}
        </div>`;
      }
      const tcd=thrBox.querySelector("#sshThrCd"); if(tcd)tcd.textContent=thqClock(th.t)+" left";
      if(acts){
        acts.hidden=false;
        if(acts.dataset.h!==tkey){
          acts.dataset.h=tkey;
          acts.innerHTML=`<button class="warn" id="sshThrGo">DEFEND IT</button>
            <button class="ghost" id="sshThrHold">LET THEM HOLD \u00b7 ${tod}%</button>`;
          $("#sshThrGo").onclick=()=>{ startDefence(th.id); };
          $("#sshThrHold").onclick=()=>{ holdLine(th.id); };
        }
      }
      { const sb=$("#sshScanBar"); if(sb)sb.hidden=true; }
    }
  }
}
function renderLevel(){
  const L=level(), pend=pendingLevels();
  const rl=$("#runlbl");
  rl.textContent="Level "+L+(pend>1?" +"+pend:"");
  rl.classList.toggle("ready",pend>0);
  rl.style.setProperty("--p", (pend>0?100:Math.round(lvProgress()*100))+"%");
  rl.title = pend>0 ? "Level up ready — tap to choose a perk"
           : Math.round(lvProgress()*100)+"% to level "+(earnedLevel()+1);
  /* patch609: the UNLOCK entry for p-map still carries its own lv (checkUnlocks()
     still queues vega:map off it, unchanged) but no longer hides the tab itself -
     patch608 made it the default tab, so hiding it below the map unlock level would
     take the whole bar down to nothing for a brand-new player. sysInSec()'s own gate
     is the real reveal now. */
  for(const u of UNLOCK){
    if(u.p==="p-map")continue;
    const t=$$(".tab").find(x=>x.dataset.p===u.p);
    if(t)t.style.display = L>=u.lv ? "" : "none";
  }
}
function softButtons(){
  $$("[data-cost]").forEach(b=>{
    const need=parseFloat(b.dataset.cost), cur=b.dataset.cur==="cry"?S.cry:b.dataset.cur==="dm"?S.dm:S.ore;
    b.disabled=cur<need;
    b.closest(".card")&&b.closest(".card").classList.toggle("ok",cur>=need);
  });
}
/* the header cards carry no names any more, so the name (and everything else worth
   knowing about a currency) lives one tap away. Ticks live, like the research popup. */
const RESDEF={
 ore:{n:"Ore", cur:"var(--cy)", ic:"ore",
   d:"The working currency of the empire. Structures, warships and ore-upgrades are all priced in ore.",
   rows:()=>[["Held",fmt(S.ore)],["Throughput",fmt(rate())+" /s"],
             ["Level",level()+(pendingLevels()?" \u00b7 "+pendingLevels()+" ready to claim":"")],
             ...PERKS.filter(p=>pkl(p.id)>0).map(p=>[p.n+" \u00d7"+pkl(p.id), p.d(pkl(p.id))]),
             ["Structures",fmt(tot())],
             ["Systems held",String(heldSystems().length)+" / "+String(SYS.length-1)],
             ["Manual scan","+"+fmt(clickPow())],
             ["Bought by governors",String(S.govBuys||0)]],
   f:"Ore is never reset. Prices are fixed — what a structure costs today is what it costs forever."},
 cry:{n:"Crystal", cur:"var(--vi)", ic:"cry",
   d:"Shed as slag by your smelters. Crystal buys Research \u2014 and nothing else.",
   rows:()=>[["Held",fmt(S.cry)],["Rate",anyOf(1)?fmt(cryRate())+" /s":"locked"],
             ["Source",anyOf(1)?"smelting byproduct":"build a Smelter Pod"],
             ["Research levels",String(RESH.reduce((a,r)=>a+lv(S.rs,r.id),0))+" / "+
               String(RESH.reduce((a,r)=>a+r.max,0))]],
   f:"Crystal and the research it buys are permanent."},
 sv:{n:"Salvage", cur:"var(--sv)", ic:"sv",
   d:"Stripped from wrecks. Buys permanent refits for your fleet and pays the crew that man it.",
   rows:()=>[["Held",fmt(S.sv||0)],["Stripped all-time",fmt(S.svAll||0)],
             ["Raids won",String(S.wins||0)],["Crew on the roster",String((S.crew||[]).length)],
             ["Bridge",onBridge().length+" / "+bridgeSlots()],
             ["Best hit chain",(S.bestCmb||0)+"\u00d7"]],
   f:"Salvage buys refits and pays crew. Both are permanent."},
 dm:{n:"Dark Matter", cur:"var(--gd)", ic:"dm",
   d:"Paid out by missions, and by claiming new systems. Spends in the Nexus on permanent empire-wide bonuses.",
   rows:()=>[["Held",fmt(S.dm)],["Earned all-time",fmt(S.dmAll)],
             ["Nexus levels",String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:lv(S.nx,x.id)),0))+" / "+
               String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:x.max),0))],
             ["Missions done",String(misDone())+" / "+String(MISSIONS.length)]],
   f:"The scarcest currency in the game. Nothing here is ever bought with money."},
 /* patch630: not a single currency (no one cur/ic fits four different-coloured
    exotics), so only rows() is given - exoModal() writes its own header instead
    of calling resourceModal(), and rmTick() (unchanged) only ever reads rows(). */
 exo:{ rows:()=>{
   const rows=EXO.map(e=>[
     `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${e.col};margin-right:7px;vertical-align:middle"></i>${e.n}`,
     fmt(exo(e.id))+(exoRate(e.id)>0?"  +"+fmt(exoRate(e.id))+"/s":"")
   ]);
   const enR=enRate(), enHave=S.en||0;
   if(enR>0||enHave>0) rows.push([
     `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${EN_COL};margin-right:7px;vertical-align:middle"></i>Exotic Nodes`,
     fmt(enHave)+(enR>0?"  +"+fmt(enR)+"/s":"")
   ]);
   return rows;
 } }
};
let rmLive=null;
function rmTick(){
  if(!rmLive)return;
  const host=$("#rmRows"); if(!host)return;
  host.innerHTML=RESDEF[rmLive].rows()
    .map(([a,b])=>`<div class="rrow"><span>${a}</span><b>${b}</b></div>`).join("");
}
function resourceModal(k){
  const D=RESDEF[k]; if(!D)return;
  rmLive=k;
  showModal(`<div class="nmh" style="--a:${D.cur};--a2:rgba(255,255,255,.06)">
      <div class="nmt">${RI(D.ic,"")}</div>
      <div style="min-width:0"><h3 style="margin:0 0 2px;color:${D.cur}">${D.n}</h3>
        <div class="nmm">Currency</div></div>
    </div>
    <p>${D.d}</p>
    <div id="rmRows" style="margin-top:10px"></div>
    <div class="rmore">${D.f}</div>
    <div class="row"><button id="rmClose">CLOSE</button></div>`,
    ()=>{ $("#rmClose").onclick=hideModal; rmTick(); });
}
/* patch630: the #exoStrip replacement. Same rmLive/rmTick()/showModal()/hideModal()
   idiom resourceModal() uses for the four currencies - render()'s own existing
   `if(rmLive&&mask.on)rmTick();` line (unchanged) keeps this live at the same
   11Hz. Own plain <h3> header instead of resourceModal()'s .nmh icon box: there
   is no single colour/icon for "every exotic", so it does not try to force one. */
function exoModal(){
  if(!exoEverBankedAny())return;   /* nothing to show before anything has ever been banked */
  rmLive="exo";
  showModal(`<h3>Exotic Balances</h3>
    <p>Every exotic your empire has ever banked, and the Exotic Nodes claiming ring-3/4 systems can produce.</p>
    <div id="rmRows" style="margin-top:10px"></div>
    <div class="row"><button id="rmClose">CLOSE</button></div>`,
    ()=>{ $("#rmClose").onclick=hideModal; rmTick(); });
}
let resSel=null;
let resMode="tree";           /* which half of the Research tab is showing - "tree" or
                                  "prog". Not persisted: presentation-only, always opens
                                  on the tech tree, same as the tab itself always did. */
let raidMode="targets";       /* which sub-tab of the Raids tab is showing. Session-only,
                                  same reasoning as resMode above. */
let mapMode="map";            /* patch614: "map" or "list" - which half of the Map tab is
                                  showing. Session-only, same reasoning as resMode/raidMode -
                                  never saved, always opens on the map itself. */
let mktBuy=1;                 /* patch636: which AMOUNT chip is selected on the Market page -
                                  its own state so the Market's ×1K/×10K/MAX choice never
                                  fights the buildings/Nexus chips' S.buy, or vice versa.
                                  Session-only, same reasoning as resMode/raidMode/mapMode
                                  above - never saved, always opens on ×1. */
const RAID_PANES={targets:"#rpTargets",fleet:"#rpFleet",loadout:"#rpLoadout",crew:"#rpCrew"};
function syncRaidMode(){
  $$(".rmbtn[data-rd]").forEach(x=>x.classList.toggle("on",x.dataset.rd===raidMode));
  for(const k in RAID_PANES){ const el=$(RAID_PANES[k]); if(el)el.hidden=(k!==raidMode); }
}
/* patch614: mirrors syncResMode()/syncRaidMode() - toggles the two buttons plus which
   of #mapWrap/#mapList is visible. Rows themselves are renderMapList()'s job, called
   from renderMap() every pass (own key-guard, see there) - this just decides which
   panel is on screen. */
function syncMapMode(){
  $$(".rmbtn[data-mm]").forEach(x=>x.classList.toggle("on",x.dataset.mm===mapMode));
  const wrap=$("#mapWrap"), list=$("#mapList");
  if(wrap)wrap.hidden = mapMode==="list";
  if(list)list.hidden = mapMode!=="list";
}
function resCost(r,l){ return r.c*Math.pow(r.cg,l) }
/* Which currency a branch is bought with. Everything historic is crystal; the war branch
   is salvage. Kept as three tiny helpers rather than sprinkling `r.cur==="sv"?...:...`
   through five render sites, because the fifth one is always the one you miss. */
function resCur(r){ return r.cur||"cry" }
function resBal(r){ return resCur(r)==="sv" ? (S.sv||0) : S.cry }
function resIncome(r){ return resCur(r)==="sv" ? 0 : cryRate() }
function curBranch(){ return RESH[Math.min(RESH.length-1,Math.max(0,S.rtab|0))] }
function renderRes(){
  // branch chips
  const tabs=$("#resTabs"); tabs.innerHTML="";
  RESH.forEach((r,i)=>{
    const l=lv(S.rs,r.id), locked=resLocked(r);
    const b=document.createElement("button");
    b.className="rchip"+(i===(S.rtab|0)?" on":"")+(locked?" lk":"");
    b.style.setProperty("--a",r.col); b.style.setProperty("--a2",rgba(r.col,.16));
    b.innerHTML=`<svg viewBox="0 0 48 48">${r.ic}</svg><span>${r.n}</span><b>${l}/${r.max}</b>`;
    b.onclick=()=>{ S.rtab=i; resSel=null; dirty=true; render(); save(); };
    tabs.appendChild(b);
  });
  if(resTabsHsUpd)resTabsHsUpd();
  const r=curBranch(), l=lv(S.rs,r.id), locked=resLocked(r), max=l>=r.max;
  // nodes
  const host=$("#treeGrid"); host.innerHTML="";
  host.style.setProperty("--a",r.col); host.style.setProperty("--a2",rgba(r.col,.18));
  const bi=RESH.indexOf(r);
  for(let k=1;k<=r.max;k++){
    const el=document.createElement("div");
    let cls="rn";
    if(locked)cls+=" lockb far"; else if(k<=l)cls+=" got"; else if(k===l+1)cls+=" next"; else cls+=" far";
    el.className=cls; el.dataset.k=k;
    el.innerHTML=`<div class="tile"><svg viewBox="0 0 48 48">${glyphFor(bi,k)}</svg><span class="k">${k}</span></div>
      <div class="nm">${(RNAMES[r.id]||[])[k-1]||("Level "+k)}</div>`;
    el.onclick=()=>{ resSel=k; resInfo(); resMark(); nodeModal(r,k); };
    el.onmouseenter=()=>{ resSel=k; resInfo(); resMark(); };
    host.appendChild(el);
  }
  layoutTree();
  resInfo(); resMark();
  requestAnimationFrame(()=>{layoutTree();drawTreeLines()});
}
/* ---------------- Research tab: exotic programmes (Stage 1 / v3) ----------------
   Moved here from the Empire accordion (patch416-428) - same XPROG data, same costs,
   same exoEverBanked() gate, unmodified. No accordion: every banked programme's cards
   just render open, so empOpen/empAccordionTap stay system-rows-only on Empire. */
let resProgEls=[];
function renderProg(){
  const host=$("#progList"); if(!host)return;
  resProgEls=[];
  host.innerHTML="";
  if(!EXO.some(e=>exoEverBanked(e.id))){
    const d=document.createElement("div");
    d.className="sysrow2 beyond";
    d.textContent="Bank an exotic resource to unlock its programme.";
    host.appendChild(d);
    return;
  }
  for(const e of EXO) if(exoEverBanked(e.id)) host.appendChild(progRow(e.id));
}
function progRow(exoId){
  const e=exoDef(exoId), have=exo(exoId), rate=exoRate(exoId);
  /* polish batch A #11: INERT_PROGS rows (Command Lattice) never get a card here -
     see its own header note (01-content.js). */
  const rows=XPROG.filter(z=>z.x===exoId&&!INERT_PROGS.has(z.id));
  const anyAfford=rows.some(r=>{ const l=xlv(r.id); return l<r.max && have>=xpCost(r,l) });
  const wrap=document.createElement("div");
  const head=document.createElement("div");
  head.className="sysrow2 held expanded proghead";
  head.dataset.sys="x:"+exoId;
  head.innerHTML=`<div class="sysrow2-main">
      <span class="sysname" style="color:${e.col}">${e.n.toUpperCase()} PROGRAMME</span>
      <span class="kindbadge" data-badge style="--a:var(--gr);display:${anyAfford?"inline-block":"none"}">UPGRADE</span>
    </div>
    <div class="sysrow2-stats">
      <span><b data-banked>${fmt(have)}</b> BANKED</span>
      <span><b data-rate>${fmt(rate)}</b> /S</span>
    </div>`;
  wrap.appendChild(head);
  const body=document.createElement("div"); body.className="sysbody";
  let h='<div class="grid">';
  for(const r of rows){
    const l=xlv(r.id), max=l>=r.max, c=xpCost(r,l);
    h+=`<div class="card${max?" done":""}"><h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>
      <p>${r.t}</p><div class="eff">${r.d(l)}${max?"":" \u2192 "+r.d(l+1)}</div>
      ${max?"<button disabled>MAXED</button>"
           :`<button data-xp="${r.id}">${fmt(c)} ${e.n}</button>`}</div>`;
  }
  h+="</div>";
  body.innerHTML=h;
  body.querySelectorAll("[data-xp]").forEach(b=>{
    const r=xpDef(b.dataset.xp);
    b.disabled = exo(r.x) < xpCost(r);
    b.onclick=()=>{ if(buyXp(r)){ dirty=true; render(); save() } };
  });
  wrap.appendChild(body);
  resProgEls.push({head,body,exoId});
  return wrap;
}
/* applies resMode to the sub-tab buttons and shows/hides the matching pane - the one
   place that does this, so the click handler and the exoBanked notice's go() (which
   jumps straight to PROGRAMMES) can't drift out of sync with each other. */
function syncResMode(){
  $$(".rmbtn[data-rm]").forEach(x=>x.classList.toggle("on",x.dataset.rm===resMode));
  const t=$("#resTreePane"), pr=$("#resProgPane");
  if(t)t.hidden = resMode!=="tree";
  if(pr)pr.hidden = resMode!=="prog";
}
function layoutTree(){
  const host=$("#treeGrid"); if(!host||!host.offsetParent)return;
  const w=host.clientWidth||600;
  const tile=innerWidth<=760?60:74, gap=innerWidth<=760?6:10;
  const cols=Math.max(2,Math.min(8,Math.floor((w+gap)/(tile+22+gap))));
  host.style.gridTemplateColumns="repeat("+cols+",1fr)";
  [...host.children].forEach((el,i)=>{
    const row=Math.floor(i/cols), inRow=i%cols;
    el.style.gridRow=(row+1);
    el.style.gridColumn=((row%2)?(cols-inRow):(inRow+1));
  });
}
function resMark(){
  const r=curBranch(), l=lv(S.rs,r.id), aff=resBal(r)>=resCost(r,l);
  $$("#treeGrid .rn").forEach(n=>{
    n.classList.toggle("sel", resSel===+n.dataset.k);
    if(n.classList.contains("next"))n.classList.toggle("rich",aff);
  });
}
function resInfo(){
  const box=$("#rinfo"); if(!box)return;
  const r=curBranch(), l=lv(S.rs,r.id), locked=resLocked(r);
  const k=resSel||Math.min(r.max,l+1);
  const nm=(RNAMES[r.id]||[])[k-1]||("Level "+k);
  const cost=resCost(r,k-1);
  const state = k<=l ? "RESEARCHED" : (locked ? "LOCKED" : (k===l+1 ? "NEXT UP" : "QUEUED"));
  let act="";
  if(k<=l) act=`<span class="lv" style="color:var(--gr)">✓ RESEARCHED</span>`;
  else if(locked) act=`<span class="warnt">🔒 ${resReqText(r)}</span>`;
  else if(k>l+1) act=`<span class="lv">Research node ${l+1} first</span>`;
  else act=`<button id="riBuy" ${resBal(r)>=cost?"":"disabled"}>RESEARCH · ${fmt(cost)} ${RI(resCur(r))}</button>`;
  const html=`<div class="ri-t"><span style="color:${r.col}">${nm}</span>
      <span class="lv">${r.n.toUpperCase()} · NODE ${k}/${r.max} · ${state}</span></div>
    <div class="ri-b">${r.t}</div>
    <div class="ri-e">${r.d(Math.max(0,k-1))} → ${r.d(k)}</div>
    <div class="ri-a">${act}</div>`;
  /* render() calls resInfo() every ~90ms while the Research tab is open (see the
     HANDOVER note on why), so without this guard #riBuy was a brand-new element
     10x/second - a real mousedown/mouseup (unlike Playwright's instant click) landed
     on two different buttons and never fired. The string only actually changes when
     the selected node, level, lock state or affordability changes - exactly when a
     rebuild is wanted. */
  if(box.dataset.h===html)return;
  box.dataset.h=html;
  box.innerHTML=html;
  const bt=$("#riBuy"); if(bt)bt.onclick=()=>buyRes(r);
}
function nodeModal(r,k){
  const l=lv(S.rs,r.id), locked=resLocked(r), cost=resCost(r,k-1);
  const bi=RESH.indexOf(r), nm=(RNAMES[r.id]||[])[k-1]||("Level "+k);
  const state = k<=l ? ["RESEARCHED","var(--gr)"] : locked ? ["LOCKED","var(--rd)"]
              : k===l+1 ? ["NEXT UP","var(--cy)"] : ["QUEUED","var(--dim)"];
  let act;
  if(k<=l) act=`<button id="nmClose">CLOSE</button>`;
  else if(locked) act=`<button id="nmClose">CLOSE</button>`;
  else if(k>l+1) act=`<button id="nmClose">CLOSE</button>`;
  else act=`<button id="nmClose">CLOSE</button><button id="nmBuy" ${resBal(r)>=cost?"":"disabled"}>RESEARCH · ${fmt(cost)} ${RI(resCur(r))}</button>`;
  showModal(`<div class="nmh" style="--a:${r.col};--a2:${rgba(r.col,.18)}">
      <div class="nmt"><svg viewBox="0 0 48 48">${glyphFor(bi,k)}</svg></div>
      <div style="min-width:0">
        <h3 style="margin:0 0 2px;color:${r.col}">${nm}</h3>
        <div class="nmm">${r.n} · Node ${k}/${r.max} · <b style="color:${state[1]}">${state[0]}</b></div>
      </div></div>
    <p style="margin:12px 0 0">${r.t}</p>
    <div class="nme">${r.d(Math.max(0,k-1))} <span style="color:var(--dim)">→</span> ${r.d(k)}</div>
    ${locked?`<p style="color:var(--rd);margin-top:10px">🔒 ${resReqText(r)}</p>`:""}
    ${(!locked&&k>l+1)?`<p style="color:var(--mut);margin-top:10px">Research node ${l+1} (${(RNAMES[r.id]||[])[l]||""}) first.</p>`:""}
    ${(k>l&&!locked&&k===l+1)?`<div class="nmbal" id="nmBal"></div>`:""}
    <div class="row">${act}</div>`,()=>{
      $("#nmClose").onclick=hideModal;
      const bt=$("#nmBuy"); if(bt)bt.onclick=()=>{ buyRes(r); hideModal(); };
      nmLive={r,k,cost}; nmTick();
    });
}
let nmLive=null;
function nmTick(){
  if(!nmLive)return;
  const bal=$("#nmBal"), bt=$("#nmBuy");
  const cur=resCur(nmLive.r);
  const have=resBal(nmLive.r), need=nmLive.cost, ok=have>=need;
  if(bt)bt.disabled=!ok;
  if(!bal)return;
  /* salvage has no passive rate - it is won, not produced - so there is no honest ETA */
  const rate=resIncome(nmLive.r);
  const eta=(!ok&&rate>0)?fmtT((need-have)/rate):null;
  bal.innerHTML=`<span>Cost</span><b>${fmt(need)} ${RI(cur)}</b>
    <span class="sep">·</span><span>You have</span>
    <b style="color:${ok?'var(--gr)':'var(--rd)'}">${fmt(have)} ${RI(cur)}</b>
    ${ok?'':`<span class="nmneed">short ${fmt(need-have)}${eta?` · ~${eta}`:""}</span>`}`;
}
function drawTreeLines(){
  const svg=$("#treeLines"), wrap=$("#tree"), host=$("#treeGrid");
  if(!svg||!wrap||!host||!wrap.offsetParent)return;
  const wr=wrap.getBoundingClientRect();
  svg.setAttribute("viewBox","0 0 "+wr.width+" "+wr.height);
  const r=curBranch(), l=lv(S.rs,r.id);
  const pts=[...host.querySelectorAll(".rn .tile")].map(t=>{
    const b=t.getBoundingClientRect();
    return {x:b.left-wr.left+b.width/2, y:b.top-wr.top+b.height/2, w:b.width};
  });
  let out="";
  for(let i=0;i<pts.length-1;i++){
    const A=pts[i], B=pts[i+1];
    const dx=B.x-A.x, dy=B.y-A.y, len=Math.hypot(dx,dy)||1, ux=dx/len, uy=dy/len;
    const a={x:A.x+ux*A.w/2, y:A.y+uy*A.w/2, w:A.w};
    const b={x:B.x-ux*B.w/2, y:B.y-uy*B.w/2, w:B.w};
    const done=(i+2)<=l;
    const col=done?r.col:"rgba(120,150,220,.9)";
    const op=done?.75:.22;
    let d;
    if(Math.abs(a.y-b.y)<4||Math.abs(a.x-b.x)<4){ d=`M${a.x} ${a.y} L${b.x} ${b.y}`; }
    else{
      const out2=(a.x>b.x?1:-1)*(a.w*0.8);
      d=`M${a.x} ${a.y} C ${a.x+out2} ${a.y}, ${b.x+out2} ${b.y}, ${b.x} ${b.y}`;
    }
    out+=`<path d="${d}" fill="none" stroke="${col}" stroke-width="${done?3:2}" stroke-linecap="round"
      opacity="${op}" ${done?"":'stroke-dasharray="5 6"'}/>`;
  }
  svg.innerHTML=out;
}
addEventListener("resize",()=>requestAnimationFrame(()=>{layoutTree();drawTreeLines()}));
function renderArmoury(){
  const ab=$("#ammoBar");
  if(ab){
    const c=ammoCost(AMMO_LOT);
    ab.innerHTML=`<div><div class="amn">${fmt(S.ammo||0)} rockets</div>
      <div class="amd">Spent one per Rocket Pod shot</div></div>
      <button id="buyAmmo">+${AMMO_LOT} \u00b7 ${fmt(c)} ORE</button>`;
    const bb=$("#buyAmmo");
    bb.disabled=S.ore<c;
    bb.onclick=()=>{ if(buyAmmo(AMMO_LOT)){ renderAll(); save() } };
  }
  const sb=$("#wepSlots"), host=$("#armoury");
  if(!sb||!host)return;
  const hp=hardpoints(), sl=wepSlots();
  sb.innerHTML=sl.map((id,i)=>{
    const w=id?WEPMAP[id]:null;
    return `<div class="sl${w?" on":""}" data-slot="${i}">${w?w.n:"EMPTY"}</div>`;
  }).join("");
  host.innerHTML=WEAPONS.map(w=>{
    const own=wepOwned(w.id), fitted=sl.indexOf(w.id)>=0;
    const per=w.shots?`${w.shots}\u00d7 `:(w.all?"all \u00b7 ":"");
    const meta=`${per}${Math.round(w.mul*100)}% dmg \u00b7 ${w.chg}s \u00b7 ${
      Math.round(w.acc*100)}% acc${w.pierce?" \u00b7 pierces":""}`;
    let act;
    if(!own) act=`<button data-buy="${w.id}">${fmt(w.cost)} ${RI('sv')}</button>`;
    else if(fitted) act=`<button data-unfit="${w.id}">UNFIT</button>`;
    else act=`<button class="fit" data-fit="${w.id}">FIT</button>`;
    return `<div class="armr" style="--a:${w.pierce?"#48e2ff":w.all?"#ff8fd0":"#ffd166"}">
      <div class="ai">${w.chg}s</div>
      <div style="min-width:0"><div class="an">${w.n}</div><div class="ad">${meta}</div></div>
      <div class="aa">${act}</div></div>`;
  }).join("");
  host.querySelectorAll("[data-buy]").forEach(b=>{
    const w=WEPMAP[b.dataset.buy];
    b.disabled=S.sv<w.cost;
    b.onclick=()=>{ if(buyWeapon(w)){ renderAll(); save() } };
  });
  host.querySelectorAll("[data-fit]").forEach(b=>{
    b.onclick=()=>{ const sl2=wepSlots(); let k=sl2.indexOf(null);
      if(k<0)k=hardpoints()-1;                 /* full: replace the last hardpoint */
      if(equipWeapon(b.dataset.fit,k)){ renderAll(); save() } };
  });
  host.querySelectorAll("[data-unfit]").forEach(b=>{
    b.onclick=()=>{ const k=wepSlots().indexOf(b.dataset.unfit);
      if(k>=0&&equipWeapon(null,k)){ renderAll(); save() } };
  });
  sb.querySelectorAll("[data-slot]").forEach(d=>{
    d.onclick=()=>{ const i=+d.dataset.slot;
      if(wepSlots()[i]&&equipWeapon(null,i)){ renderAll(); save() } };
  });
}
function renderNex(){
  const host=$("#nex"); host.innerHTML="";
  const seized=S.end===1;   /* patch589: every card, DM or Project, freezes at the turn */
  NEXUS.forEach(r=>{
    if(r.cur==="en")return;   /* Project nodes render in their own block below */
    const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l);
    const d=document.createElement("div"); d.className="card"+(max?" done":"")+(seized?" seized":"");
    d.innerHTML=`<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>
      <p>${r.t}</p><div class="eff">${r.d(l)}${max?"":" → "+r.d(l+1)}</div>
      ${seized?'<button disabled>SEIZED</button>':max?'<button disabled>MAXED</button>':`<button data-cost="${c}" data-cur="dm">${fmt(c)} ${RI('dm')}</button>`}`;
    if(!max&&!seized)d.querySelector("button").onclick=()=>buyNex(r);
    host.appendChild(d);
  });
  /* THE PROJECT (patch583): hidden entirely until the first Exotic Node - same
     "ever produced/held" test the strip uses, so it can never go hidden again once
     shown (spending the bank to 0 does not stop a held ring-3/4 system producing). */
  const proj=NEXUS.filter(r=>r.cur==="en");
  projEls=[];
  if(proj.length && ((S.en||0)>0 || enRate()>0)){
    const head=document.createElement("div");
    head.className="sechead pjhead"; head.textContent="THE PROJECT";
    host.appendChild(head);
    /* PLAN-pacing: "nothing tells you where they come from" - one line, built from
       the rate constants and the sector names, never hard-coded numbers. */
    const secName=k=>{ const sec=SECTORS.find(x=>x.key===k); return sec?sec.n:k; };
    const expl=document.createElement("p"); expl.className="pjexpl";
    expl.textContent=`Nodes come from held systems in ${secName("frontier")} `
      +`(${EN_RING3}/h each), ${secName("deep")} and ${secName("beyond")} (${EN_RING4}/h).`;
    host.appendChild(expl);
    proj.forEach(r=>{
      /* patch592: the game is won - pjx stops reading as just another MAXED card
         and offers its way back into the ending screen instead. */
      if(r.id==="pjx" && S.end===2){
        const l=lv(S.nx,r.id);
        const d=document.createElement("div"); d.className="card done";
        d.innerHTML=`<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>
          <p>${STORY.nodeHint}</p><div class="eff">COMPLETE</div>
          <button>COMPLETE \u00b7 VIEW ENDING</button>`;
        d.querySelector("button").onclick=()=>showEnding();
        host.appendChild(d);
        return;
      }
      const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l), locked=nexLocked(r);
      const desc = r.id==="pjx" ? STORY.nodeHint : r.t;
      const d=document.createElement("div");
      d.className="card"+(max?" done":"")+(locked&&!seized?" locked":"")+(seized?" seized":"");
      d.innerHTML = seized
        ? `<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5><p>${desc}</p><div class="eff">SEIZED</div><button disabled>SEIZED</button>`
        : `<h5>${locked?"\ud83d\udd12 ":""}${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>
        <p>${desc}</p>
        ${locked?`<div class="eff">${nexReqText(r)}</div><button disabled>LOCKED</button>`
          :`<div class="eff">${r.d(l)}${max?"":" → "+r.d(l+1)}</div>
            ${max?'<button disabled>MAXED</button>':`<button data-cost="${c}" data-cur="en">${fmt(c)} Nodes</button>`}`}`;
      if(!max&&!locked&&!seized)d.querySelector("button").onclick=()=>buyNex(r);
      /* PLAN-pacing: "you make R/h · ~T to go" - only where it means anything
         (producing, buyable, not already maxed/locked/seized). Text itself is
         refreshed every frame by updateEmpBars() (projEls), not rebuilt here. */
      if(enRate()>0 && !max && !locked && !seized){
        const eta=document.createElement("p"); eta.className="pjeta";
        d.appendChild(eta);
        projEls.push({el:eta, cost:c});
      }
      host.appendChild(d);
    });
  }
  softButtons();
}
/* ---------------- claiming a contract, as a moment ----------------
   claimMission() pays out and sets dirty, and the frame loop's dirty branch rebuilds this
   list from empty - so a claimed card is destroyed on the next frame unless something
   holds the rebuild off. misFxUntil is that hold, and it is a TIMESTAMP on purpose: a
   boolean cleared by a callback stays set when the callback never runs, and a list frozen
   showing an already-claimed card is worse than the instant disappearance being fixed. */
const MISFX=1060;              /* the whole sequence, card tap to card gone */
let misFxUntil=0;
function misFxHold(ms){ misFxUntil=Math.max(misFxUntil,Date.now()+ms) }
function misFxEnd(){ misFxUntil=0; renderMis() }
function lowMotion(){
  try{ return matchMedia("(prefers-reduced-motion:reduce)").matches }catch(e){ return false }
}
/* where each reward is going: the header card for that resource */
function misChip(k){ return $(k==="dm" ? ".rcard.c-dm" : ".rcard.c-cry") }
/* One reward, arcing from the card to the resource it becomes. Driven by a CSS animation
   rather than a transition started on the next frame, so it does not depend on a frame
   ever arriving - the element animates from the moment it is inserted. */
function flyReward(from, to, html, delay){
  if(!from||!to)return;
  const a=from.getBoundingClientRect(), b=to.getBoundingClientRect();
  const f=document.createElement("div");
  f.className="rwfly"; f.innerHTML=html;
  f.style.left=(a.left+a.width/2)+"px";
  f.style.top =(a.top +a.height/2)+"px";
  f.style.setProperty("--dx",((b.left+b.width/2)-(a.left+a.width/2))+"px");
  f.style.setProperty("--dy",((b.top +b.height/2)-(a.top +a.height/2))+"px");
  f.style.animationDelay=delay+"ms";
  document.body.appendChild(f);
  setTimeout(()=>{
    f.remove();
    /* restart the pulse even if this chip was hit moments ago */
    to.classList.remove("land"); void to.offsetWidth; to.classList.add("land");
    setTimeout(()=>to.classList.remove("land"),460);
  }, delay+620);
}
/* The sequence on one card. The payout has already happened; this is only the telling. */
function misClaimFx(card, m, delay){
  if(!card||!m)return;
  const slow=lowMotion();
  setTimeout(()=>{
    if(!card.isConnected)return;
    const eff=card.querySelector(".eff")||card;
    const btn=card.querySelector("button.misclaim");
    card.classList.add("claimed");
    if(btn){ btn.disabled=true; btn.classList.add("done"); btn.textContent="CLAIMED \u2713" }
    /* two notes rising, rather than the single blip a purchase gets */
    blip(760,.10,"square",.045);
    setTimeout(()=>blip(1180,.16,"square",.045),95);
    if(!slow){
      let d=90;
      if(m.r.c){  flyReward(eff, misChip("cry"), "+"+fmt(m.r.c) +" "+RI("cry"), d); d+=110 }
      if(m.r.dm){ flyReward(eff, misChip("dm"),  "+"+fmt(m.r.dm)+" "+RI("dm"),  d) }
    }
    setTimeout(()=>{
      if(!card.isConnected)return;
      /* lock the measured height first: a card at height:auto cannot animate to zero */
      card.style.maxHeight=card.scrollHeight+"px";
      void card.offsetHeight;
      card.classList.add("gone");
      card.style.maxHeight="0px";
    }, slow?200:740);
  }, delay);
}
function renderMis(){
  const host=$("#mis");
  /* a claim is playing out on cards that are already on screen - leave them alone */
  if(Date.now()<misFxUntil)return;
  host.innerHTML="";
  /* anything finished and unpaid comes first, with the reward on a button */
  const q=(S.miq||[]).slice().sort((a,b)=>a-b);
  if(q.length>1){
    const all=document.createElement("button"); all.className="misall";
    all.textContent="CLAIM ALL ("+q.length+")";
    all.onclick=()=>{
      if(all.disabled)return;
      const cards=[...host.querySelectorAll(".card.rdy")];
      const ms=q.map(i=>MISSIONS[i]);
      if(!claimAllMissions())return;
      /* a cascade rather than one blink, tightened when there are a lot so claiming
         eight contracts does not become a cutscene */
      const step=q.length>5?60:110, span=step*Math.max(0,q.length-1);
      all.disabled=true; all.textContent="CLAIMED \u2713";
      misFxHold(MISFX+span);
      ms.forEach((m,k)=>misClaimFx(cards[k],m,k*step));
      setTimeout(misFxEnd, MISFX+span);
    };
    host.appendChild(all);
  }
  q.forEach(i=>{
    const m=MISSIONS[i]; if(!m)return;
    const rw=[m.r.c?fmt(m.r.c)+" "+RI("cry"):null,m.r.dm?fmt(m.r.dm)+" "+RI("dm"):null].filter(Boolean).join(" + ");
    const d=document.createElement("div"); d.className="card rdy";
    d.innerHTML=`<h5>Ready to claim</h5><p>${m.d}</p><div class="eff">Reward: ${rw}</div>`;
    const btn=document.createElement("button"); btn.className="misclaim"; btn.textContent="CLAIM";
    btn.onclick=()=>{
      if(btn.disabled)return;
      if(!claimMission(i))return;
      /* the rebuild is held for the next second, so anything DERIVED from the list is
         stale until it runs - fix the one summary by hand rather than letting it
         advertise a contract the player can see being claimed */
      const allb=host.querySelector(".misall");
      if(allb&&!allb.disabled){
        const left=(S.miq||[]).length;
        if(left>1)allb.textContent="CLAIM ALL ("+left+")";
        else allb.style.display="none";
      }
      misFxHold(MISFX);
      misClaimFx(d,m,0);
      setTimeout(misFxEnd,MISFX);
    };
    d.appendChild(btn); host.appendChild(d);
  });
  if(S.mi>=MISSIONS.length){
    if(!q.length)host.innerHTML='<div class="card done"><h5>All missions fulfilled</h5><p>The Colonial Authority has nothing left to ask of you.</p></div>';
    return;
  }
  MISSIONS.slice(S.mi,S.mi+3).forEach((m,k)=>{
    const d=document.createElement("div"); d.className="card"+(k===0?" ok":"");
    const rw=[m.r.c?fmt(m.r.c)+" "+RI("cry"):null,m.r.dm?fmt(m.r.dm)+" "+RI("dm"):null].filter(Boolean).join(" + ");
    d.innerHTML=`<h5>${k===0?"▶ Active":"Queued"}</h5><p>${m.d}</p><div class="eff">Reward: ${rw}</div>`;
    host.appendChild(d);
  });
  const done=document.createElement("div"); done.className="card done";
  done.innerHTML=`<h5>Completed</h5><p>${misDone()} of ${MISSIONS.length} missions fulfilled.</p>`;
  host.appendChild(done);
}
/* ---------------- stats ---------------- */
function fmtT2(s){ return s<60 ? Math.round(s)+"s"
  : s<3600 ? Math.round(s/60)+"m" : (s/3600).toFixed(s<36000?1:0)+"h" }
/* polish batch A #8: renderStats() (the KPI tiles + production history chart, the
   "graphs" half of "Records & Graphs") is gone along with #kpis/#mchips/#chartBox
   - the owner playthrough flagged the whole stats page, and ACHS/checkAchs() turned
   out to be real, named milestones worth keeping (each grants a permanent global
   bonus - see renderAch() right below), so only the achievements half survives,
   reachable the same way (Market's ghost link, retitled "Achievements" in
   index.html) rather than gone outright. histTick()/MEAS/the hist* sampling
   functions and the save format's own S.hist are untouched - deleting the save
   field for a page that might come back was more risk than it was worth for a
   fixes batch; they just have no UI reading them any more. */
function renderAch(){
  const host=$("#ach"); host.innerHTML="";
  ACHS.forEach(a=>{
    const g=!!S.ac[a.id];
    const d=document.createElement("div"); d.className="ach"+(g?" got":"");
    d.innerHTML=`<b>${g?a.n:"???"}</b><span>${a.d} · +${Math.round(a.b*100)}% global</span>`;
    host.appendChild(d);
  });
}
function renderAll(){ dirty=true; render(); }

