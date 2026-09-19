/* ============================ progression checks ============================ */
/* A finished contract is queued, not paid. The reward is collected on the Missions
   page, for the same reason levels are: a payout the player never saw happen is not a
   reward, it is a number that changed. The pointer still advances, so leaving one
   unclaimed never blocks the contracts behind it. */
function checkMissions(){
  let guard=0;
  if(!Array.isArray(S.miq))S.miq=[];
  while(S.mi<MISSIONS.length && MISSIONS[S.mi].k(S) && guard++<50){
    const m=MISSIONS[S.mi];
    S.miq.push(S.mi); S.mi++;
    toast("Contract ready — "+m.d,"g"); blip(880,.2,"square",.05);
    flag("p-mis"); dirty=true;
  }
}
function misDone(){ return Math.max(0,(S.mi||0)-((S.miq&&S.miq.length)||0)) }
function misReady(){ return (S.miq&&S.miq.length)||0 }
function claimMission(i){
  if(!Array.isArray(S.miq))return false;
  const at=S.miq.indexOf(i); if(at<0)return false;
  const m=MISSIONS[i]; if(!m)return false;
  if(m.r.c){S.cry+=m.r.c} if(m.r.dm){S.dm+=m.r.dm;S.dmAll+=m.r.dm}
  S.miq.splice(at,1);
  grantXp("ms:"+i, XPV.mission(i), m.d);
  toast("Claimed — "+m.d,"g"); blip(1240,.18,"square",.05);
  checkAchs(); dirty=true; save();
  return true;
}
function claimAllMissions(){
  let c=0; while(S.miq&&S.miq.length){ if(!claimMission(S.miq[0]))break; c++ }
  return c;
}
/* Nothing is ever forced. A new level only announces itself; the player claims it
   when they want to, which is what keeps time away from turning into a wall of popups. */
function checkLevel(){
  const e=earnedLevel();
  if(!S.lvSeen||S.lvSeen<1)S.lvSeen=1;
  if(e<=S.lvSeen)return;
  S.lvSeen=e; dirty=true;
  blip(880,.3,"square",.05);
  const pend=pendingLevels();
  toast(pend>1 ? pend+" levels ready \u2014 tap the LEVEL chip"
               : "Level "+e+" ready \u2014 tap the LEVEL chip", "y");
  if(pend>0)queueNotice("lvClaim");
}
function lvModal(){
  if(pendingLevels()<1)return;
  const offer=lvOffer(), nextL=level()+1, pend=pendingLevels();
  /* PLAN-pacing: Research and Map now tie at lv 5 - UNLOCK can carry more than one
     entry for the same lv, so this must list all of them, not just the first find(). */
  const opens=UNLOCK.filter(u=>u.lv===nextL);
  showModal(`<h3 class="lvup">Level ${nextL}</h3>
    ${opens.map(un=>`<p class="lvun">This one also opens <b class="lvup">${un.n}</b> \u2014 ${un.d}</p>`).join("")}
    <p>Choose one. It is permanent.</p>
    <div id="lvPicks">${offer.map(id=>{
      const p=PERKS.find(x=>x.id===id), have=pkl(id);
      return `<button class="lvpick" data-p="${id}" style="--a:${p.col}">
        <b>${p.n}</b><span class="lvpi">${p.inc}</span>
        <span class="lvpt">${p.t}</span>
        ${have?`<span class="lvph">already taken ${have}\u00d7 \u2192 becomes ${p.d(have+1)}</span>`:""}
      </button>`}).join("")}</div>
    ${pend>1?`<p class="lvmore">${pend-1} more level${pend>2?"s":""} waiting after this one.</p>`:""}
    <div class="row"><button id="lvLater" class="ghost">LATER</button></div>`,
    ()=>{
      $$("#lvPicks .lvpick").forEach(b=>b.onclick=()=>{
        if(!takeLevel(b.dataset.p))return;
        hideModal();
        if(pendingLevels()>0) setTimeout(lvModal,200);
        else { render(); save(); }
      });
      $("#lvLater").onclick=hideModal;
    });
}
/* Read-only companion to lvModal(): opened by the header chip when nothing is
   pending (lvModal() itself is unchanged and still owns the pending>0 case).
   Shows progress toward the next level, every perk picked (grouped by the level
   it was picked at, with an honest "before this was tracked" bucket for picks
   made before S.pkLog existed), and the handful of bonuses the game hands out
   automatically at a level with no player choice involved - see HANDOVER for the
   list and the reasoning behind what is/isn't in it. */
/* the XP grant a not-yet-first tier gi would pay on system id right now, without
   paying it - same short-circuit as xpOnBuild()'s global-first/per-system-first
   split, just read-only. 0 if that first is already banked everywhere it can be. */
function xpAmtForBuild(id,gi){
  const g=GENS[gi]; if(!g)return 0;
  const lad=LADDERS[g.kind]||[], pos=lad.indexOf(gi);
  const base = g.kind==="ore" ? (XPV.tierFirst[pos]||0) : (XPV.kindFirst[pos]||0);
  if(!S.xf["tf:"+gi]) return base;
  if(!S.xf["sf:"+id+":"+gi]) return Math.round(base*XPV.sysFirstMul);
  return 0;
}
/* Up to 3 currently-doable XP sources, cheapest first. Honest: every candidate here
   is something the player could act on RIGHT NOW, not "eventually" - a locked
   research node, a system whose level requirement isn't met yet, or a raid-win
   threshold already banked are all left out rather than shown as false promises. */
function xpNext(){
  const out=[];
  let bestBuild=null;
  for(const s of builtSystems()){
    const gi=sysNextGi(s.id); if(gi==null)continue;
    const amt=xpAmtForBuild(s.id,gi); if(amt<=0)continue;
    if(!bestBuild||amt<bestBuild.amt) bestBuild={label:GENS[gi].n+" on "+s.n, amt, p:S.ore/ladderCost(s.id,gi,1), sub:fmt(ladderCost(s.id,gi,1))+" ore"};
  }
  if(bestBuild) out.push(bestBuild);
  const nextSys=SYS.find(s=>!s.home&&!sysHeld(s.id)&&level()>=s.lvl);
  if(nextSys){
    const amt=(S.xf.cl1?0:XPV.claim1)+(S.xf["cl:"+nextSys.id]?0:(XPV.claim[nextSys.ring]||0));
    if(amt>0) out.push({label:"Claim "+nextSys.n, amt, p:S.ore/nextSys.cost, sub:fmt(nextSys.cost)+" ore"});
  }
  if((S.mi||0)<MISSIONS.length){
    const amt=XPV.mission(S.mi);
    if(amt>0){
      const already=(S.miq||[]).includes(S.mi);
      const m=MISSIONS[S.mi]; out.push({label:already?"Claim contract: "+m.d:m.d, amt, p:already?1:(m.p?m.p(S):(m.k(S)?1:0))});
    }
  }
  if(unlockedAt("p-raid")){
    const w=S.wins||0;
    const rwT=Object.keys(XPV.raidWin).map(Number).sort((a,b)=>a-b).find(t=>t>w&&!S.xf["rw:"+t]);
    if(rwT!==undefined) out.push({label:rwT+(rwT===1?" raid won":" raids won"), amt:XPV.raidWin[rwT], p:w/rwT, sub:w+"/"+rwT});
    else if(w>=200){
      const nrep=200+XPV.raidWinEvery*(Math.floor((w-200)/XPV.raidWinEvery)+1);
      if(!S.xf["rwr:"+nrep]) out.push({label:nrep+" raids won", amt:XPV.raidWinRepeat});
    }
  }
  let bestRes=null;
  for(const r of RESH){
    const l=lv(S.rs,r.id); if(l>=r.max||resLocked(r))continue;
    const c=resCost(r,l);
    if(!bestRes||c<bestRes.cost) bestRes={label:r.n+" "+(l+1), amt:XPV.research, cost:c, p:resBal(r)/c, sub:fmt(c)+" crystal"};
  }
  if(bestRes) out.push(bestRes);
  const mileT=MILE.find(t=>tot()<t&&!S.xf["mi:"+t]);
  if(mileT!==undefined) out.push({label:"Reach "+mileT+" structures", amt:XPV.mile, p:tot()/mileT, sub:fmt(tot())+"/"+mileT});
  let bestUnit=null;
  for(const s of builtSystems()){
    for(const gi of sysLadder(s.id)){
      const n=sysTierCount(s.id,gi); if(n<=0)continue;
      for(const t in XPV.unit){ const tt=+t;
        if(n<tt&&!S.xf["um:"+s.id+":"+gi+":"+tt]){
          if(!bestUnit||n>bestUnit.n) bestUnit={n, label:tt+" \u00d7 "+GENS[gi].n, amt:XPV.unit[tt], p:n/tt, sub:n+"/"+tt};
          break;
        }
      }
    }
  }
  if(bestUnit) out.push(bestUnit);
  return out.sort((a,b)=>(b.p||0)-(a.p||0)).slice(0,6);
}
function lvSummary(){
  const L=level(), e=earnedLevel(), b=xpNeed(e+1);
  const need=Math.max(0,b-(S.xpn||0));
  const pct=lvProgress()*100;

  /* S.pkLog is still written in takeLevel() and validated in adopt() for a possible
     future "career" view, but nothing reads it here any more - cumulative counts
     come straight from S.pk, which was always accurate. */
  const perkBlock=PERKS.filter(pk=>pkl(pk.id)>0).map(pk=>
    `<div class="rrow"><span style="color:${pk.col}">${pk.n} ×${pkl(pk.id)}</span><b>${pk.d(pkl(pk.id))}</b></div>`
  ).join("") || '<div class="rrow"><span>No perks chosen yet</span><b></b></div>';

  const unlockRows=UNLOCK.map(u=>
    `<div class="rrow"><span>Level ${u.lv} — ${u.n}</span><b>${L>=u.lv?"unlocked":"locked"}</b></div>`
  ).join("");
  const dmBonus=Math.round(L*6);
  const nextRows=xpNext().map(x=>{ const q=Math.max(0,Math.min(1,x.p||0));
    const hits=need>0&&x.amt>=need;
    return `<div class="xprow${q>=1?" ready":""}"><div class="l"><span>${x.label}</span><b>+${x.amt} XP${hits?" → level "+(e+1):""}</b></div>
      <div class="xpbar"><i style="width:${Math.round(q*100)}%"></i></div>
      <div class="s">${q>=1?"ready":(x.sub||Math.round(q*100)+"%")}</div></div>`}).join("")
    || '<div class="rrow"><span>Nothing within reach right now</span><b></b></div>';

  showModal(`<h3 class="lvup">Level ${L}</h3>
    <div class="xplvl"><div class="xpbar xplvlbar"><i style="width:${pct.toFixed(0)}%"></i></div>
      <div class="l"><span>${need>0?"Level "+(e+1):"Level "+(e+1)+" ready"}</span><b>${(S.xpn||0)-xpNeed(e)} / ${b-xpNeed(e)} XP</b></div></div>
    <p>Earns XP — any of these count</p>
    <div id="lvSumNext">${nextRows}</div>
    <p>Perks (cumulative)</p>
    <div id="lvSumPicks">${perkBlock}</div>
    <p>Unlocks by level</p>
    <div id="lvSumAuto">${unlockRows}
      <div class="rrow"><span>Dark Matter from raids</span><b>+${dmBonus}% (+6% per level)</b></div>
    </div>
    <div class="row"><button id="lvSumClose" class="ghost">CLOSE</button></div>`,
    ()=>{ $("#lvSumClose").onclick=hideModal; });
}
function checkAchs(){
  for(const a of ACHS) if(!S.ac[a.id]&&a.k(S)){
    S.ac[a.id]=1; toast("Record unlocked — "+a.n,"y"); blip(1046,.25,"sine",.05);
    grantXp("ac:"+a.id, XPV.record, null);
    flag("p-mkt"); dirty=true;                /* Records live behind Market's ghost link now */
  }
}
function flag(p){ const t=$$(".tab").find(t=>t.dataset.p===p); if(t&&!t.classList.contains("on"))t.classList.add("alert"); }

/* ============================ loop ============================ */
let dirty=true, autoAcc=0;
function tick(dt){
  const prod=rate()*dt;
  if(prod>0){ S.ore+=prod; S.all+=prod; }
  for(const e of EXO){ const r=exoRate(e.id); if(r>0)S.exo[e.id]=exo(e.id)+r*dt;
    if(exo(e.id)>0)(S.exoSeen=S.exoSeen||{})[e.id]=true; }
  const enR=enRate(); if(enR>0){ S.en+=enR*dt; S.enAll+=enR*dt; }
  const c=cryRate(); if(c>0)S.cry+=c*dt;
  const ov=nexLv("ovs");
  if(ov>0){ autoAcc+=dt*ov*3; while(autoAcc>=1){autoAcc-=1; const v=clickPow(); S.ore+=v;S.all+=v;S.clicks++;} }
  /* EMPIRE2: the "auto" research node's buy-toggle is retired - see the note at the top
     of patch403. The node itself still purchases and levels; this is just where its old
     per-tier auto-purchase used to run. */
  raidTick(dt);
  rvTick(dt);
  histTick(dt);
  dmodComplete();
  tripTick();
  checkLevel(); checkMissions(); checkAchs(); checkUnlocks(); xpTick();
}
/* nine flag lookups per tick - cheap; tot() is already called elsewhere per frame */
function xpTick(){ const c=tot(); for(const t of MILE) if(c>=t) grantXp("mi:"+t, XPV.mile, t+" structures"); }
function xpOnWins(){ const w=S.wins||0;
  for(const t in XPV.raidWin) if(w>=+t) grantXp("rw:"+t, XPV.raidWin[t], w+" raids won");
  if(w>200 && w%XPV.raidWinEvery===0) grantXp("rwr:"+w, XPV.raidWinRepeat, w+" raids won"); }
function xpOnDef(quiet){ const w=S.defw||0;
  for(const t in XPV.defHeld) if(w>=+t) grantXp("dw:"+t, XPV.defHeld[t], quiet?null:(w+" defences held")); }
let lastT=performance.now(), lastSave=Date.now(), lastRender=0;
/* Everything the game does happens in here, so an exception used to end the session:
   the next frame was never scheduled and the page sat there looking frozen while its
   buttons still worked. The next frame is now scheduled from a finally, so one bad
   frame costs a frame. */
let frameErrs=0, firstErr=null;
function lastError(){ return firstErr }
function frame(now){
  try{
    const rawMs=now-lastT;                    /* real frame interval, not JS work */
    const dt=Math.min(.25,rawMs/1000); lastT=now;
    tick(dt);
    if(BT){ bUpdate(dt); bDraw(); bAdapt(rawMs); }
    if(DT){ defUpdate(dt); defDraw(); }
    /* STAGE 3: telegraphed LIVE fleets - reached ONLY from here, i.e. ONLY from
       requestAnimationFrame(frame). csim4.js never calls frame(); it calls
       G.tick(1) directly, 500,000+ times, and never once reaches this line. */
    lfCheckExpiry();
    lfMaybeLaunch(dt);
    if(now-lastRender>90){ lastRender=now; render(); }
    if(Date.now()-lastSave>15000){ lastSave=Date.now(); save(); }
  }catch(e){
    frameErrs++;
    if(!firstErr){
      firstErr={ msg:(e&&e.message)||String(e), stack:(e&&e.stack)||"",
                 where:BT?("battle:"+(BT.mode||"?")):"empire", at:Math.round(now) };
      try{ localStorage.setItem("sd_err", JSON.stringify(firstErr)) }catch(_){}
    }
    /* say it once, loudly enough to be reported, then stop shouting */
    if(frameErrs===1)toast("Something went wrong — the game kept going. Details in the dev panel.","r");
    if(frameErrs<=3&&window.console)console.error("SD frame error",e);
  }finally{
    requestAnimationFrame(frame);
  }
}

