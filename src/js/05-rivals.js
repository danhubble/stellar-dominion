/* ============================ rivals ============================ */
function rvOf(id){ const r=S.rv[id]||(S.rv[id]={p:0,cd:0,seen:0,w:0,mv:RIVAL_MOVE_CAP});
  if(typeof r.w!=="number")r.w=0;   /* saves from before patch141 */
  if(typeof r.mv!=="number")r.mv=RIVAL_MOVE_CAP;   /* STAGE 2: action-budget token bucket,
     spent only by rvMoveAway() (offline) - see the scope note above */
  return r }
/* Their nearest system by level: the one that puts them on your map, and so the one
   whose level decides when you have met them. */
function rvFirstSystem(rid){
  let best=null;
  for(const s of SYS){ if(s.owner!==rid)continue; if(!best||s.lvl<best.lvl)best=s }
  return best;
}
function rvKnown(rid){ return !!rvOf(rid).seen }
/* First contact. They do not wait to be provoked - seeing them IS the provocation, which
   is what makes finding a new faction on the map an event rather than scenery. */
function rvMeet(rid){
  const r=rvOf(rid); if(r.seen)return false;
  r.seen=1;
  queueNotice("vega:rival");
  const rv=RIVALMAP[rid], b=RVBEH[rid];
  r.p=Math.max(r.p, RV_MAX);          /* hostile on sight */
  r.cd=Math.max(r.cd, RV_GRACE);      /* but the warning arrives before the fleet does */
  toast((rv?rv.n:"A rival")+" has found you \u2014 they are hostile","r");
  blip(140,.5,"sawtooth",.06);
  flag("p-map"); dirty=true;
  return true;
}
function rvPressure(id){ return Math.min(RV_MAX, rvOf(id).p) }
function rvAwake(){ return level()>=DEFLV }
/* Every held system is an insult to Helion and, more mildly, to the Covenant. Taking one
   OFF them is the real provocation - that is the "they react to you" the player asked
   for, and it means a cautious player is genuinely left alone. */
function rvProvoke(rid, amount){
  if(RVACT.indexOf(rid)<0)return;
  rvOf(rid).p += amount;
  dirty=true;
}
function rvTick(dt){
  thqPrune();
  thqTick(dt);
  fleetTravelTick(dt);   /* PLAN-fleets run 2: same clock as thqTick - never csim's
    economy path, since csim never calls fleetSend() so no S.fl entry ever has `to` set */
  if(S.end>=1)return;   /* patch589: rivals go quiet once the turn has come */
  if(!rvAwake())return;
  /* have we come within reach of anyone new? */
  for(const id of RVACT){
    if(rvOf(id).seen)continue;
    const first=rvFirstSystem(id);
    if(first&&level()>=first.lvl)rvMeet(id);
  }
  const held=heldSystems().length;
  /* Flatter than it was. With a two-hour floor doing most of the work for a large
     empire, this mostly decides how much SLOWER a small one is attacked - so the band
     between a two-system empire and a nine-system one is about 4h against 2h, rather
     than the 5x spread a steeper curve gave. */
  /* holding nothing means there is nothing to resent: state the guarantee rather than
     leaving it to fall out of the curve */
  const weight = held<1 ? 0 : 1+Math.min(3,(held-1)*0.5);
  S.thrCd=Math.max(0,(S.thrCd||0)-dt);
  for(const id of RVACT){
    const b=RVBEH[id], r=rvOf(id);
    r.cd=Math.max(0,r.cd-dt);
    if(weight>0)r.p+=dt*(b.perSys*weight)/60;
    r.p=Math.min(RV_MAX*1.5,r.p);
    r.w+=dt;                       /* uncapped, unlike pressure - see the sort below */
    r.ew=(r.ew||0)+dt;             /* and the same again for expansion */
    r.mv=Math.min(RIVAL_MOVE_CAP, r.mv+dt/RIVAL_MOVE_SECS);   /* STAGE 2: action budget */
  }
  rvMaybeThreat();
  const took=rvMaybeExpand(dt);
  if(took){
    const s=SYSMAP[took.sysId], rv=RIVALMAP[took.rv];
    toast((rv?rv.n:"A rival")+" has taken "+s.n+" \u2014 assault it to take it back","y");
    blip(190,.34,"sawtooth",.05);
  }
}
/* Who they come for. Helion goes where the ore is; the Covenant goes for whatever you
   hold closest to their own space. Both read off systems you actually hold, so an empire
   of one quiet system is never worth a fleet. */
function rvTargetFor(rid){
  const held=heldSystems();
  if(!held.length)return null;
  const b=RVBEH[rid];
  /* skip anything already under attack: a rival that always returns its single best
     target can never queue a second fleet, because the duplicate is refused */
  const busy={}; for(const q of thq())busy[q.sysId]=1;
  let best=null, bv=-Infinity;
  for(const s of held){
    if(busy[s.id])continue;
    const v = b.pick==="rich" ? sysExoRate(s.id) : (s.ring*100 + s.lvl);
    if(v>bv){ bv=v; best=s }
  }
  return best;
}
/* STAGE 2: the OFFLINE-only occupation mechanic's own targeting - frontier systems
   ONLY (interior and home are structurally excluded, see frontierSystems()), and
   weighted by defence too: dividing by 1+defStrength() favours the weakest-defended
   system among the ones they want, rather than only ever the single richest/deepest
   one regardless of how hard it would be to hold - "weakest-defended frontier system
   with the exotic they want", per the brief, in one line. A deliberately separate
   function from rvTargetFor() rather than a modification of it - see the scope note
   above (and HANDOVER) for exactly why. */
function rvFrontierTargetFor(rid){
  const held=frontierSystems();
  if(!held.length)return null;
  const b=RVBEH[rid];
  let best=null, bv=-Infinity;
  for(const s of held){
    const want = b.pick==="rich" ? sysExoRate(s.id) : (s.ring*100 + s.lvl);
    const v = want/(1+defStrength(s.id));
    if(v>bv){ bv=v; best=s }
  }
  return best;
}
/* ---- rivals taking neutral ground ----
   Only ever systems nobody holds. What the player loses is a purchase they had not made
   yet, not a system they own - so this can happen while they are asleep without being
   the kind of interruption they cannot answer. */
function freeSystems(){
  return SYS.filter(s=>!s.home && !sysHeld(s.id) && !sysOwner(s));
}
/* Systems belonging to a faction that is not one of the two promoted rivals - the Vasht
   Collective. This is where the war between the big two starts, and none of it costs the
   player anything they own. */
function ambientSystems(){
  return SYS.filter(s=>{
    if(s.home||sysHeld(s.id))return false;
    const o=sysOwner(s);
    return !!o && RVACT.indexOf(o)<0;
  });
}
/* And what the OTHER promoted rival holds. Sixteen systems sit between Helion and the
   Covenant, so this is the tier that keeps the border moving once Vasht has been carved
   up - and like Vasht, none of it is the player's. */
function rivalHeldSystems(rid){
  return SYS.filter(s=>{
    if(s.home||sysHeld(s.id))return false;
    const o=sysOwner(s);
    return !!o && o!==rid && RVACT.indexOf(o)>=0;
  });
}
function rvExpandTarget(rid){
  const b=RVBEH[rid];
  const pick=list=>{
    let best=null, bv=-Infinity;
    for(const s of list){
      /* the same character they attack with: Helion wants the richest ground, the
         Covenant wants whatever lies deepest toward their own space. sysExoRate reads 0
         for anything unheld, so rank on the system's own base yield rather than the live
         one. */
      const v = b.pick==="rich" ? (s.yld||0)*100 - s.ring : (s.ring*100 + s.lvl);
      if(v>bv){ bv=v; best=s }
    }
    return best;
  };
  /* Eating the ambient faction is preferred over taking neutral ground: it costs the
     player nothing at all, and it is the half of this that will still be firing in the
     late game, when there is no unowned ground left on the map. */
  const amb=ambientSystems();
  if(amb.length>RV_AMBMIN){ const t=pick(amb); if(t)return t }

  /* then each other: the endless supply, and still nothing the player owns */
  const foe=rivalHeldSystems(rid);
  if(foe.length){ const t=pick(foe); if(t)return t }

  const free=freeSystems();
  if(free.length<=RV_FREEMIN)return null;
  /* leave the obvious next purchase alone: whatever is cheapest among the systems the
     player could actually claim today. Taking that is the one move that would feel like
     the game reaching into the player's plans. */
  const buyable=free.filter(s=>level()>=s.lvl).sort((a,b)=>a.cost-b.cost);
  const spare=buyable[0]||null;
  const pool=free.filter(s=>s!==spare);
  return pool.length ? pick(pool) : null;
}
function rvMaybeExpand(dt){
  if(S.end>=1)return null;   /* patch589: rivals stop expanding once the turn has come */
  S.rvExp=Math.max(0,(S.rvExp||0)-dt);
  if(S.rvExp>0)return null;
  /* whoever has gone longest without taking anything, so the two of them share the map
     rather than one of them eating it */
  const ready=RVACT.filter(id=>rvOf(id).seen).sort((a,b)=>(rvOf(b).ew||0)-(rvOf(a).ew||0));
  for(const id of ready){
    const s=rvExpandTarget(id);
    if(!s)continue;
    if(!S.lost||typeof S.lost!=="object")S.lost={};
    S.lost[s.id]=id;
    rvOf(id).ew=0;
    S.rvExp=RV_EXPAND;
    const rv=RIVALMAP[id];
    if(!Array.isArray(S.thrRep))S.thrRep=[];
    S.thrRep.push({sys:s.n, rv:(rv?rv.n:id), claim:true});
    dirty=true;
    return {rv:id, sysId:s.id};
  }
  return null;
}
function thq(){ if(!Array.isArray(S.thq))S.thq=[]; return S.thq }
function thqAt(id){ return thq().find(q=>q.id===id)||null }
/* the map code wants "is there a live threat AGAINST this system", which is keyed by
   sysId, not by a threat entry's own id - thqAt(s.id) (a string) could never match
   q.id (always numeric) and silently returned null/false everywhere it was tried;
   see patch587b's own header for how this was actually found and confirmed. */
function thqAtSys(sysId){ return thq().find(q=>q.sysId===sysId)||null }
function thqDrop(id){ const q=thq(); const i=q.findIndex(x=>x.id===id); if(i>=0)q.splice(i,1) }
/* an attack aimed at a system you no longer hold cannot be fought or defended, so it is
   quietly withdrawn rather than sitting on the page as an impossible card */
function thqPrune(){
  const q=thq();
  for(let i=q.length-1;i>=0;i--){
    if(q[i].kind==="sab")continue;   /* home is never "held" the way a claim is - see holdOdds() */
    if(!sysHeld(q[i].sysId))q.splice(i,1);
  }
}
function rvMaybeThreat(){
  if(S.end>=1)return;   /* patch589: also guarded here directly - the dev panel's
     SEND A FLEET button calls this outside rvTick() */
  if(DT||BT)return;
  if(thq().length>=THQ_MAX)return;
  if((S.thrCd||0)>0)return;      /* whoever sent the last one, the map gets a breather */
  /* Longest wait first, not array order. With a shared cooldown this loop decides WHO
     attacks, not merely whether anyone does, and a fixed order hands every slot to
     whichever rival charges fastest - permanently. Ranked on `w` rather than pressure
     because pressure is capped: a player who provokes both rivals pins both to the
     ceiling, where pressure can no longer tell them apart. Time since the last fleet
     has no ceiling, so it always can. */
  const ready=RVACT.slice().sort((a,b)=>rvOf(b).w-rvOf(a).w);
  for(const id of ready){
    const b=RVBEH[id], r=rvOf(id);
    if(r.p<RV_MAX||r.cd>0)continue;
    const s=rvTargetFor(id); if(!s)continue;
    /* never two fleets converging on the same system - it reads as a bug, not a war */
    if(thq().some(q=>q.sysId===s.id))continue;
    /* STAGE C: sabotage - an eligible launch (pj1 owned, a real bank of Nodes, no
       finale running) has a SAB_CHANCE chance of turning on the Nexus instead of the
       held system it was about to hit. Every condition here has to hold before
       Math.random() is ever called, so a save that never buys pj1 (every csim4.js
       run, by construction) draws nothing extra from the shared stream - see the
       patch header. */
    let sysId=s.id, sab=false;
    if(S.end===0 && nexOwned("pj1") && (S.en||0)>=SAB_EN_MIN &&
       !thq().some(q=>q.sysId==="home") && Math.random()<SAB_CHANCE){
      sysId="home"; sab=true;
    }
    r.p=0; r.cd=b.cool; r.w=0;
    S.thqSeq=Math.max(1,(S.thqSeq||1))+1;
    /* patch599: a Sensor Mast on the system actually being targeted (never checked
       for a sab entry - it redirects to home, which never carries one) buys x1.5
       THQ_LIFE, stamped once here so it survives save/load untouched (see adopt()). */
    const life = (!sab && hasSensorMast(s.id)) ? Math.round(THQ_LIFE*1.5) : THQ_LIFE;
    const entry={ id:S.thqSeq, rv:id, sysId,
                  dif:1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012, t:life, life };
    if(sab)entry.kind="sab";
    thq().push(entry);
    queueNotice("vega:threat");
    if(sab)queueRivalNotice("rvSab");
    S.thrCd=RV_MINGAP;
    toast(b.warn+" "+(sab?SYSMAP.home.n:s.n)+" \u2014 you have a day to answer","r");
    blip(150,.5,"sawtooth",.06);
    flag("p-raid"); dirty=true;
    return;
  }
}
/* Catch the war up for the time the game was shut. rvTick only runs with the page open,
   so without this the rivals would expand only while somebody was watching - and a
   six-hourly move that requires an audience is a move that never happens. Stepped rather
   than passed one enormous dt, because each call makes at most one move and the expansion
   wait has to accumulate in between for the two rivals to take turns. */
function rvExpandAway(secs){
  let left=Math.max(0,secs), moves=0;
  while(left>0 && moves<RV_AWAYMAX){
    const step=Math.min(left, RV_EXPAND);
    for(const id of RVACT){ const r=rvOf(id); r.ew=(r.ew||0)+step }
    if(rvMaybeExpand(step))moves++;
    left-=step;
  }
  return moves;
}
/* STAGE 2: catches the ACTION BUDGET up for time away, the same way rvExpandAway()
   already catches expansion up. Bounded on two independent axes at once, which is
   the entire design of a token bucket: the while-loop can fire at most
   RIVAL_MOVE_CAP times no matter how large `secs` is (regardless-of-absence-length),
   and it needs RIVAL_MOVE_SECS of elapsed time per token to ever fire at all (the
   one-move-per-RIVAL_MOVE_HOURS pacing). Gated on r.p>=RV_MAX like the (separate,
   untouched) live thq path is: pressure does not accrue while away (rvTick never
   runs), so only a rival who was already essentially ready to move when the player
   left can spend banked tokens - a quiet empire returns to a quiet map, however
   long the absence. Deliberately never called from anywhere but offlineReport(). */
function rvMoveAway(secs){
  if(S.end>=1)return 0;   /* patch589: rivals stop taking systems once the turn has come */
  let moves=0;
  for(const id of RVACT){
    const r=rvOf(id); if(!r.seen)continue;
    r.mv=Math.min(RIVAL_MOVE_CAP, r.mv+secs/RIVAL_MOVE_SECS);
    const b=RVBEH[id];
    while(r.mv>=1 && r.p>=RV_MAX){
      if(heldSystems().length<=1)break;         /* never the player's last system */
      const s=rvFrontierTargetFor(id); if(!s)break;
      r.mv-=1;
      occupySystem(s.id, id);
      r.cd=Math.max(r.cd, b.cool*0.8);
      if(!Array.isArray(S.thrRep))S.thrRep=[];
      S.thrRep.push({occ:true, sys:s.n, rv:id});
      S.thrRep=S.thrRep.slice(-8);
      moves++; dirty=true;
    }
  }
  return moves;
}
/* ======================= STAGE 3: telegraphed LIVE fleets ======================= */
/* LF holds the one in-flight live fleet, if any - a plain runtime object,
   deliberately NOT part of S (a 30-60s window essentially never survives a
   reload - see the constants comment above for why S.lfMark, a tiny persisted
   marker, is enough). Every function below is reached only from frame()
   (lfMaybeLaunch/lfCheckExpiry, patch472/473) or from boot (lfSettleMarkOnLoad,
   patch472/473) - never from tick()/rvTick(), so none of it can fire during
   csim4.js. Verify: csim4.js calls G.tick(1) directly and never frame(). */
let LF=null;
function lfCdOf(id){ return (S.lfCd&&S.lfCd[id])||0 }
function lfClock(secs){ return Math.max(0,Math.ceil(secs))+"s" }
/* Called every frame() with its real, clamped elapsed time - so S.lfCd only ever
   advances while the tab is open and being drawn. That is a deliberate property,
   not an oversight: an absence never "owes" a live fleet the moment the player
   returns (the offline mechanic, above, already covers catching up while away -
   this one simply does not run at all while away, by construction). */
function lfMaybeLaunch(dt){
  if(S.end>=1)return;                   /* patch589: no new live fleets once the turn has come */
  if(LF||DT||BT)return;                 /* one at a time, and never mid-fight */
  if(!rvAwake())return;
  if(!S.lfCd||typeof S.lfCd!=="object")S.lfCd={};
  for(const id of RVACT)S.lfCd[id]=Math.max(0,(S.lfCd[id]||0)-dt);
  if(heldSystems().length<=1)return;    /* never risk the player's last system */
  const ready=RVACT.filter(id=>{ const r=rvOf(id); return r.seen && r.p>=RV_MAX && lfCdOf(id)<=0 })
                    .sort((a,b)=>rvOf(b).w-rvOf(a).w);
  for(const id of ready){
    /* the SAME frontier + weakest-defended targeting the offline mechanic uses
       (2B, rvFrontierTargetFor) - this is the same idea, only with a live
       countdown instead of an instant offline resolution. Never a system already
       carrying its own thq countdown too - two independent fleets converging on
       one system would read as a bug, not a war (same rule rvMaybeThreat uses). */
    const s=rvFrontierTargetFor(id); if(!s)continue;
    if(thq().some(q=>q.sysId===s.id))continue;
    lfLaunch(id, s);
    return;
  }
}
function lfLaunch(rid, s){
  const eta=LIVE_FLEET_ETA_MIN+Math.random()*(LIVE_FLEET_ETA_MAX-LIVE_FLEET_ETA_MIN);
  const dueAt=Date.now()+eta*1000;
  LF={ rv:rid, sysId:s.id, dueAt };
  if(!S.lfCd||typeof S.lfCd!=="object")S.lfCd={};
  S.lfCd[rid]=LIVE_FLEET_COOL_SECS;
  S.lfMark={ sysId:s.id, rv:rid, dueAt };
  const rv=RIVALMAP[rid];
  toast((rv?rv.n:"A rival")+" fleet detected \u2014 inbound to "+s.n+", "+Math.ceil(eta)+"s to intercept","r");
  blip(160,.45,"sawtooth",.06);
  flag("p-map"); dirty=true;
}
/* Run the clocks. Anything that runs out is fought by the garrison on the defences you
   built, and the outcome is kept for the player to read - never silently applied. */
/* `offline` (STAGE 2) marks a genuine offline catch-up pass (only offlineReport()
   passes it) vs the ordinary per-frame tick while the page is open - it is the one
   thing holdResolve() needs to know to skip the odds roll and go straight to
   occupation, per 2C. Every existing call site passes 2 args, so `offline` is
   undefined (falsy) there and this is a no-op change to the live path. */
function thqTick(dt, quiet, offline){
  const q=thq();
  let fired=0;
  for(let i=q.length-1;i>=0;i--){
    q[i].t-=dt;
    if(q[i].t>0)continue;
    const e=q[i]; q.splice(i,1);
    holdResolve(e, true, quiet, offline);
    fired++;
  }
  return fired;
}
