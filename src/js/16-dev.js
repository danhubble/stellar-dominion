/* ============================ dev tools ============================
   Session only - never written to the save, so it cannot leak into a save code. */
let devOn=false, devTaps=0, devTapT=0;
function devGrantLevels(k){
  S.xpn=Math.max(S.xpn||0, xpNeed(level()+k));
  S.lvSeen=earnedLevel();
  let guard=0;
  while(pendingLevels()>0 && guard++<600){
    const o=lvOffer(); if(!takeLevel(o[0]))break;
  }
  toast("DEV \u2014 level "+level(),"y");
}
function devAction(k){
  if(k==="l1")devGrantLevels(1);
  else if(k==="l5")devGrantLevels(5);
  else if(k==="l25")devGrantLevels(25);
  else if(k==="ore"){ S.ore=Math.max(1e6,(S.ore||0)*100); toast("DEV \u2014 ore \u00d7100","y") }
  else if(k==="exo"){ for(const e of EXO)S.exo[e.id]=Math.max(exo(e.id),500);
    toast("DEV \u2014 exotics filled","y") }
  else if(k==="mode"){ S.cmode=(S.cmode==="wep")?"turn":(S.cmode==="turn"?"live":"wep");
    toast("DEV \u2014 combat: "+S.cmode,"y") }
  else if(k==="str"){
    /* one unit of the next revealed tier on every held system - the ladder equivalent
       of "fill every empty slot". A dev grant, so it does not charge ore or exotics. */
    let did=0;
    for(const s of builtSystems()){
      const gi=sysNextGi(s.id); if(gi==null)continue;
      const st=sysState(s.id); if(!st.b||typeof st.b!=="object")st.b={};
      st.b[gi]=(st.b[gi]||0)+1; did++;
    }
    toast("DEV \u2014 "+did+" new tiers placed","y") }
  else if(k==="atk"){
    /* the real path, not a special case: meet anyone unmet, fill the angriest rival's
       meter and clear their cooldown, then let rvMaybeThreat despatch as it normally would */
    if(!heldSystems().length){ toast("DEV \u2014 claim a system first","y") }
    else {
      for(const id of RVACT)rvOf(id).seen=1;
      const before=thq().length;
      let best=RVACT[0], bp=-1;
      for(const id of RVACT){ const p=rvOf(id).p; if(p>bp){bp=p;best=id} }
      rvOf(best).p=RV_MAX; rvOf(best).cd=0; S.thrCd=0;
      rvMaybeThreat();
      toast(thq().length>before?"DEV \u2014 fleet inbound":"DEV \u2014 no target found","y");
    }
  }
  else if(k==="sys"){ let c=0;
    for(const s of SYS){ if(s.home||sysHeld(s.id))continue; S.sys[s.id]={b:{}}; c++ }
    toast("DEV \u2014 claimed "+c+" systems","y") }
  else if(k==="vega"){
    /* clears every vega:* S.seen key (and any of its beats still sitting in the queue)
       so the owner can re-trigger every beat on demand while editing VEGA's lines -
       does not touch lvClaim/xpHow or any other S.seen key. */
    if(S.seen&&typeof S.seen==="object"){
      for(const key in S.seen) if(key.indexOf("vega:")===0) delete S.seen[key];
    }
    if(Array.isArray(S.notifyQueue))S.notifyQueue=S.notifyQueue.filter(key=>key.indexOf("vega:")!==0);
    toast("DEV \u2014 VEGA beats reset","y");
  }
  else if(k==="introReplay"){
    /* preview only - does not set S.seen.intro or queue vega:boot when it ends,
       same "does not persist" rule SHOW/REPLAY ALL already use for VEGA beats */
    playScene(STORY.intro,{skip:true,onDone:()=>toast("DEV \u2014 intro replay done","y")});
  }
  else if(k==="startFinale"){
    /* gets to the turn fast for testing, without a real Nodes grind - grants
       pj1-pj3 and holds Nyx if needed, then calls the real thing. Deliberately does
       NOT set S.nx.pjx itself: S.end===1 already shows every Nexus card SEIZED
       regardless of pjx's own owned/locked state, so the two are never visually
       inconsistent. */
    S.nx.pj1=Math.max(S.nx.pj1||0,1);
    S.nx.pj2=Math.max(S.nx.pj2||0,1);
    S.nx.pj3=Math.max(S.nx.pj3||0,1);
    if(!sysHeld("nyx"))S.sys.nyx={b:{}};
    startFinale();
  }
  else if(k==="giveNodes"){
    S.en=(S.en||0)+2000; S.enAll=Math.max(S.enAll||0,S.en);
    toast("DEV \u2014 +2000 Exotic Nodes","y");
  }
  else if(k==="holdNyx"){
    if(!sysHeld("nyx"))S.sys.nyx={b:{}};
    toast("DEV \u2014 Nyx held","y");
  }
  else if(k==="winFinale"){
    /* calls the real thing directly, from any state - a fast path to the ending
       screen for testing that skips the whole scripted fight (and the turn, if
       S.end were still 0 - finaleWon() does not care what it was). */
    finaleWon();
  }
  else if(k==="showEnding"){
    /* preview only, same "does not persist" rule REPLAY INTRO already uses for
       VEGA beats - does not touch S.end, so it can be opened from any state
       (including one the real game would never reach, e.g. before the turn). */
    showEnding();
  }
  else if(k==="resetEnding"){
    /* every suspension above reads S.end live (nexLv/queueNotice/renderNex/the
       rival ticks), so un-setting it is most of the restore; clearing S.nx.pjx
       lets the owner buy (and re-trigger) the turn again for testing. patch592's
       revertPeace() is the other half once S.end has reached 2 - GARRISON is
       never mutated, only ever read from, so this hands every system's owner/
       def/arch straight back (harmless, a no-op comparison aside, to call when
       peace was never applied in the first place - S.end<2 the whole session). */
    S.end=0;
    if(S.nx)S.nx.pjx=0;
    revertPeace();
    toast("DEV \u2014 ending reset","y");
  }
  dirty=true; renderAll(); save(); devInfo();
}
function devInfo(){
  const e=$("#devInfo"); if(!e)return;
  const mb=$$("#devp .dvb").find(b=>b.dataset.dev==="mode");
  if(mb)mb.textContent="COMBAT: "+S.cmode.toUpperCase();
  let err=firstErr;
  if(!err){ try{ err=JSON.parse(localStorage.getItem("sd_err")||"null") }catch(_){} }
  e.textContent="b"+BUILD+" \u00b7 L"+level()+" \u00b7 earned L"+earnedLevel()
    +" \u00b7 xp "+(S.xpn||0)
    +" \u00b7 "+heldSystems().length+"/"+(SYS.length-1)+" systems"
    +" \u00b7 "+fmt(rate())+"/s"
    +(err ? "\nLAST ERROR ("+err.where+"): "+err.msg
            +"\n"+String(err.stack||"").split("\n").slice(0,3).join("\n")
          : "\nno errors recorded");
}
function devToggle(on){
  devOn=on;
  $("#devp").classList.toggle("on",devOn);
  if(devOn){ devInfo(); toast("Dev tools on \u2014 not saved","y") }
}
$("#devClose").onclick=()=>devToggle(false);
$$("#devp .dvb").forEach(b=>b.onclick=()=>devAction(b.dataset.dev));
/* VEGA dev row: preview any one card from a level-1 save without meeting its real
   trigger - kept off the generic .dvb wiring above (SHOW/NEXT use their own handlers,
   not devAction()) so picking a beat never forces an extra save. */
(function(){
  const sel=$("#devVegaSel"); if(!sel)return;
  for(const k in VEGA){ const o=document.createElement("option"); o.value=k; o.textContent=k; sel.appendChild(o); }
  for(const k in RIVAL_MSG){ const o=document.createElement("option"); o.value="rival:"+k; o.textContent="rival:"+k; sel.appendChild(o); }
  function show(optVal){
    if(!optVal)return;
    const isRival=optVal.indexOf("rival:")===0;
    const full=isRival?optVal:"vega:"+optVal;
    if(!S.seen||typeof S.seen!=="object")S.seen={};
    delete S.seen[full];
    if(isRival)queueRivalNotice(optVal.slice(6)); else queueNotice(full);
    /* the picked card must appear NOW, not queue behind whatever else is already
       waiting (a level-1 save already has vega:boot queued the moment it loads) */
    if(Array.isArray(S.notifyQueue)){
      const i=S.notifyQueue.indexOf(full);
      if(i>0){ S.notifyQueue.splice(i,1); S.notifyQueue.unshift(full); }
    }
    dirty=true; render();
  }
  $("#devVegaShow").onclick=()=>show(sel.value);
  $("#devVegaNext").onclick=()=>{
    const opts=[...sel.options];
    const i=(opts.findIndex(o=>o.value===sel.value)+1+opts.length)%opts.length;
    sel.selectedIndex=i;
    show(opts[i].value);
  };
})();

/* five taps on the title: works on touch, and nobody hits it by accident */
$(".brand h1").addEventListener("click",()=>{
  const t=Date.now();
  if(t-devTapT>1200)devTaps=0;
  devTapT=t; devTaps++;
  if(devTaps>=5){ devTaps=0; devToggle(!devOn) }
});

