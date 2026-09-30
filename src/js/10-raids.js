/* ============================ raids ============================ */
const TGT_MAX=3, TGT_EVERY=110;
/* PLAN-raidmap. DOCK_REP (TUNING-PENDING): a fleet docked at Sol Reach or a Shipyard
   mends this many times faster than one out in the dark - what makes RECALL worth a
   trip. tgCap(): the first TGT_MAX contacts are the old stream exactly (Math.random,
   the loop csim4.js has always run); every sector the map opens adds room for two
   more, and THOSE come off the save's own little generator (S.tgR) so they never
   spend a Math.random() call csim's seeded baseline would notice. */
const DOCK_REP=6;
function tgCap(){ return TGT_MAX+2*tgMaxSec() }
function tgRand(){
  if(S.tgR==null)S.tgR=(Date.now()&0x3fffffff)|0;
  S.tgR=(S.tgR+0x6D2B79F5)|0;
  let t=Math.imul(S.tgR^S.tgR>>>15,1|S.tgR);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296;
}
function raidTick(dt){
  if(!BT){
    const rep=dt/600*Math.pow(1.30,rfl("rep"))*crewMul("eng");
    for(const f of fleets()) if(f.hp<1) f.hp=Math.min(1,f.hp+rep*(idleAtYard(f)?DOCK_REP:1));
  }
  S.tgT=(S.tgT||0)+dt;
  const every=TGT_EVERY/(Math.pow(1.22,rfl("sen"))*crewMul("nav"));
  while(S.tg.length<TGT_MAX && S.tgT>=every){ S.tgT-=every; S.tg.push(newTarget()); dirty=true; }
  if(S.tg.length>=TGT_MAX)S.tgT=Math.min(S.tgT,every);
  const cap=tgCap();
  if(S.tg.length>=TGT_MAX && S.tg.length<cap){
    S.tgX=(S.tgX||0)+dt;
    while(S.tg.length<cap && S.tgX>=every){ S.tgX-=every; S.tg.push(newTarget(tgRand)); dirty=true; }
  } else if(S.tgX) S.tgX=Math.min(S.tgX,every);
}
let BT=null;
const bcv=$("#bcv"); let bx=null,BW=0,BH=0;
let bBG=null,bVIG=null;
let bScale=Math.min(devicePixelRatio,2), bAcc=0, bFrames=0, bHold=0;
function bResize(){ if(!bcv.offsetParent){bx=null;return}
  bx=bcv.getContext("2d");
  BW=bcv.width=Math.max(2,Math.round(bcv.clientWidth*bScale));
  BH=bcv.height=Math.max(2,Math.round(bcv.clientHeight*bScale));
  bBG=null; bVIG=null; }
/* step the render scale down if frames are consistently slow; never back up mid-fight */
function bAdapt(ms){
  if(!BT||BT.done)return;
  bAcc+=ms; bFrames++; bHold-=ms;
  if(bFrames<45)return;
  const avg=bAcc/bFrames; bAcc=0; bFrames=0;
  if(avg>21 && bScale>0.85 && bHold<=0){
    bScale=Math.max(0.85,bScale-0.28); bHold=1200;
    bx=null;
  }
}
/* gradients are smooth, so a half-res bake upscales with no visible difference */
function bBake(){
  const w=Math.max(2,Math.round(BW/2)), h=Math.max(2,Math.round(BH/2));
  bBG=document.createElement("canvas"); bBG.width=w; bBG.height=h;
  const g1=bBG.getContext("2d");
  g1.fillStyle="#03040c"; g1.fillRect(0,0,w,h);
  const neb=g1.createRadialGradient(w*.5,h*.30,0,w*.5,h*.30,Math.max(w,h)*.7);
  neb.addColorStop(0,rgba(BT.T.col,.14)); neb.addColorStop(.45,rgba(BT.T.col,.04));
  neb.addColorStop(1,"rgba(0,0,0,0)");
  g1.fillStyle=neb; g1.fillRect(0,0,w,h);
  bVIG=document.createElement("canvas"); bVIG.width=w; bVIG.height=h;
  const g2=bVIG.getContext("2d");
  const vg=g2.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.35,w*.5,h*.5,Math.max(w,h)*.75);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.55)");
  g2.fillStyle=vg; g2.fillRect(0,0,w,h);
}
addEventListener("resize",()=>{bx=null;dx=null});

function engage(idx){
  const t=S.tg[idx]; if(!t)return;
  engageTarget(t, idx);
}
/* idx < 0 means the target is not one of the drifting contacts in S.tg - an assault
   builds its own target, so endBattle() must not splice it out of that list. */
function engageTarget(t, idx, f){
  /* a map contact is fought by the fleet holding beside it (passed in); an assault
     (t.sysId) passes the fleet at that system; the final battle passes its merged
     fleet. Nothing passed: the Raids tab's selected fleet. */
  f=f||curFleet();
  const dps=fleetDPS(f), hpm=fleetHPMax(f);
  if(dps<=0){ toast("Build warships before you engage."); return }
  if(f.hp<0.15){ toast("Fleet too damaged — let it repair."); return }
  /* sized off par, NOT off dps/hpm - see the par curve above. This is the line that
     used to make every purchase on this page pointless. */
  const wep = (S.cmode!=="live"&&S.cmode!=="turn");
  /* patch590: the final battle sizes wave 1 off the player's OWN fleetHPMax()/
     fleetDPS() at engage time (dps/hpm just above) rather than the raid par curve -
     see finalSpawnWave() (next to bUpdateWep) for waves 2/3's own FINAL_WAVE_MULT. */
  const totalHP = t.final ? hpm*FINAL_WAVE_MULT[0] : refDPS()*t.secs*t.dif*(wep?wepHpMul():1);
  const totalDPS = t.final ? dps*FINAL_WAVE_MULT[0] : (refHP()*t.dmg)/t.secs*(wep?WEP_INC:1);
  BT={ idx, t, T:RAIDS[t.ti], f, en:[], stars:[], el:0, cap:t.secs*3.2,
       hp:hpm*f.hp, hpm, dps, kills:0, tot:t.en,
       cd:{f:0,k:0}, buf:{f:0,k:0}, tap:0, fx:[], num:[], sh:0, done:0,
       cmb:0, cmbT:0, best:0, crits:0, taps:0, hits:0,
       /* STAGE 1 escalation: the wave sizes its reinforcements off the fight's
          own opening average, not a fresh formula, so it always reads as "more of
          this fight" rather than a differently-tuned one. */
       spawnAvgHP:totalHP/Math.max(1,t.en), spawnAvgDPS:totalDPS/Math.max(1,t.en),
       waveDone:0, pTick:0,
       /* patch590: final battle only (BT.t.final) - wave number, inter-wave
          breather timer, and the withdraw beat once the Core breaks. Harmless on
          every ordinary fight, which never reads any of these. */
       wave:1, waveBreather:0, withdraw:0, withdrawT:0, boss:null,
       allies:[] };   /* patch591: final battle only - see finalAllyJoin()/finalAlliesTick() */
  if(t.final)finalAllyJoin(1);   /* patch591: Vasht joins as the fight opens */
  const kinds=[];
  const archMix=mixFor(t);
  for(let i=0;i<t.en;i++)kinds.push(archMix?pickKindFrom(archMix):pickKind(t.ti));
  /* a board with no fused hostile is a board SHIELDS solve outright, so put a floor
     under it - the mix above this floor is still whatever the weights rolled */
  if(t.en>=2 && !kinds.some(k=>EK[k].boss) && !kinds.some(k=>EK[k].fuse))
    kinds[Math.floor(Math.random()*kinds.length)]="bomber";
  let wsum=0; for(const k of kinds)wsum+=EK[k].hp;
  for(let i=0;i<t.en;i++){
    const k=kinds[i], K=EK[k], share=K.hp/wsum;
    const hp=totalHP*share;
    const slist=sysListFor(k);
    BT.en.push({ k, hp, max:hp, dps:totalDPS*share*K.dps, alive:1,
      sys:slist.map(sk=>({k:sk, st:0, d:0, rt:0})),
      shd:0, shdT:0,
      x:.13+.74*((i+.5)/t.en), y:.17+Math.random()*.34,
      px:Math.random()*6.28, py:Math.random()*6.28, sp:(.5+Math.random()*.6)*K.sp,
      rr:K.r, wa:Math.random()*6.28, ws:0.5+Math.random()*0.7,
      shp:K.sh?hp*K.sh:0, shm:K.sh?hp*K.sh:0, rg:0,
      fz:K.fuse||0, fzm:K.fuse||0 });
  }
  /* turn mode derives its numbers from the same budget the live fight uses, so the
     two models stay balanced against each other without separate tuning */
  BT.mode = t.final ? "wep" : ((S.cmode==="live") ? "live" : (S.cmode==="turn" ? "turn" : "wep"));   /* patch590: always weapon mode */
  if(BT.mode==="wep"){
    /* guns start half charged so the fight opens with something to do */
    BT.wep=equipped().map(w=>w?{id:w.id,chg:w.chg,ch:w.chg*0.5}:null);
    BT.shdMax=pwrOf("shd"); BT.shd=BT.shdMax; BT.shdT=0; BT.paused=false;
    BT.sel=-1; BT.selSys=-1; BT.hits=[]; BT.shots=[];
    BT.hpShown=BT.hp; BT.hpHold=0; BT.lock=0;
    for(const e of BT.en){ const K=EK[e.k]||EK.grunt;
      /* nothing fires in the first moment - the player gets to read the board first */
      e.wcd = K.fuse ? (K.fuseS||FUSE_S)*0.8 : EFIRE*(0.8+Math.random()*0.9)/Math.max(0.5,K.sp); }
    if(!S.seen||typeof S.seen!=="object")S.seen={};
    if(!S.seen.aimHint){
      S.seen.aimHint=true;
      toast("Tap a hostile's ENGINES box to aim at it \u2014 engines down, nothing misses","y");
    }
  }
  if(BT.mode==="turn"){
    BT.hpShown=BT.hp; BT.hpHold=0; BT.lock=0;
    BT.round=1; BT.cp=cpTotal(); BT.ord={vol:{},scr:0,rep:0};
    BT.maxRounds=Math.round(TROUND*2.5);
    BT.pip=totalHP/(TROUND*Math.max(1,cpTotal())*0.75);
    /* split the round's damage budget across the formation by each hostile's share */
    const incTot=hpm*t.dmg/TROUND*INCK;
    const dsum=BT.en.reduce((a,e)=>a+e.dps,0)||1;
    for(const e of BT.en)e.inc=incTot*e.dps/dsum;
    for(const e of BT.en){ const K=EK[e.k]||EK.grunt; if(K.fuse)e.fuse=FUSE_N }
    telAll();
  }
  bScale=Math.min(devicePixelRatio,2); bAcc=0; bFrames=0; bHold=0;
  /* archetype tag on the fight header - only a garrison carries one, and "swarm"
     is the unlabelled default so ordinary raids read exactly as before. */
  const bArch=t.arch && t.arch!=="swarm" ? ARCH[t.arch] : null;
  $("#bName").textContent=t.name+(bArch?"  \u00b7 "+bArch.n.toUpperCase():"");
  $("#battle").classList.add("on"); $("#bRes").classList.remove("on");
  $("#battle").classList.toggle("turn",BT.mode==="turn");
  $("#battle").classList.toggle("wep",BT.mode==="wep");
  /* patch633: every fresh engage starts clean - autoResolveTarget() adds .cine back on,
     right after this call returns, only once BT.cine is actually armed. */
  $("#battle").classList.remove("cine");
  bx=null; blip(120,.35,"sawtooth",.06);
}

