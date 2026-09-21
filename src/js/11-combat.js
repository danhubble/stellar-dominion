/* ============================ defence: hold the centre ============================ */
const dcv=$("#dcv"); let dx=null, DW=0, DH=0, DT=null;
const DEF_RATE=1.9,        /* shots per second at base - the fire budget everything sizes off */
      DEF_SPD=0.62,        /* shot travel, in screen-heights per second */
      DEF_HIT=0.030,       /* shot hit radius, fraction of the smaller screen edge */
      DEF_RING=0.13,       /* once inside this, a hostile is chewing on the system */
      DEF_DRAIN=0.062,     /* system hull lost per second per hostile in the ring */
      DEF_LEAK=0.16,       /* how far in they push before stopping to fire */
      DEF_MINE_RING=0.22,  /* TUNING-PENDING: fraction of dMin() at which an armed
                               Minefield detonates against the first wave - further
                               out than DEF_LEAK (0.16, where hostiles stop and start
                               biting), and clear of the Hangar ships' own fixed draw
                               radius (2.6*DEF_RING=0.338) so the flash and the ships
                               read as two separate things, not one overlapping ring. */
      DEF_MINE_DMG_MULT=6; /* TUNING-PENDING: the detonation deals this many
                               defShotDmg()-equivalents to everything caught in the
                               ring, once. The delegated side has no literal damage
                               figure of its own to reuse - Minefield's holdOdds()
                               contribution is an abstract +DEF_STR.min garrison-
                               strength term - so this is the mini-game's own
                               translation of "the same damage the odds assume":
                               enough to drop a lone runner outright (the swarm
                               hull, defBaseHP()*0.68) without trivialising a
                               hauler's (2.05x). */
function dResize(){
  dx=dcv.getContext("2d");
  /* clientWidth is 0 until the overlay has been laid out. The simulation cannot run in a
     zero-sized world, so fall back to the viewport rather than to nothing. */
  const cw=dcv.clientWidth||innerWidth, ch=dcv.clientHeight||innerHeight;
  DW=dcv.width=Math.max(2,Math.round(cw*bScale));
  DH=dcv.height=Math.max(2,Math.round(ch*bScale));
}
function dMin(){ return Math.min(DW,DH) }
/* one shot kills a plain hostile for a player at par, and the same shot kills faster for
   a player who has actually invested. Same blended reference the raids use. */
/* Point Defence Grid is the answer to a question the player asked outright: was there
   any research that raised base defence damage? There was not - every node was economic. */
function defShotDmg(){ return refDPS()/DEF_RATE*0.55*Math.pow(1.13,lv(S.rs,"pdef")) }
function defBaseHP(){  return Math.max(1,parDPS()/DEF_RATE*0.55) }
const DKIND={
  runner:{hp:0.68, sp:1.70, tan:1.30, r:0.85, col:"#5ce6a5"},
  raider:{hp:1.00, sp:1.00, tan:0.95, r:1.00, col:"#ffb45c"},
  hauler:{hp:2.05, sp:0.78, tan:0.45, r:1.35, col:"#ff8fd0"}
};
function defMixFor(rid){
  /* Helion swarms, the Covenant arrives heavy. The mix IS the personality. */
  return rid==="hel" ? ["runner","runner","raider","runner","raider"]
                     : ["raider","hauler","raider","hauler","raider"];
}
/* one entry per hull actually stationed at sysId's Hangar - each fires and is
   drawn exactly like defAutoFire()'s own DT.turrets entries, just from its own
   position (defHangarXY()) instead of dead centre. Empty/no Hangar -> []. */
function hangarEntriesFor(sysId){
  if(!sysId)return [];
  const fl=hanFleet(sysId), arr=[];
  for(let i=0;i<3;i++) for(let k=0;k<fl[i];k++) arr.push({hull:i, cd:SD_AUTOEV*(0.35+arr.length*0.3)});
  return arr;
}
function startDefence(id,f){
  /* f: reserved for PLAN-fleets run 2+ (the fleet defending, once travel gates DEFEND
     IT to a fleet that can arrive in time) - the defence mini-game itself (DT) never
     reads S.sh/S.fhp today, so nothing here uses f yet. */
  const th = (id===undefined) ? thq()[0] : thqAt(id);
  if(!th)return false;
  const isSab=th.kind==="sab";
  const s=SYSMAP[th.sysId]; if(!s||(!isSab&&!sysHeld(s.id))){ thqDrop(th.id); return false }
  const b=RVBEH[th.rv]||RVBEH.hel;
  bScale=Math.min(devicePixelRatio,2);
  /* home has no defences of its own - "your best garrison falls back to defend home"
     (owner decision 8), same fallback holdOdds() uses. Its tur/shd LEVELS (not just
     its strength number) fall back the same way, so the mini-game's own turret count
     and hull bonus match whichever system is actually helping. */
  const modSys=isSab?bestHeldDefSys():s;
  const turLv=modSys?dmodLv(modSys.id,"tur"):0, shdLv=modSys?dmodLv(modSys.id,"shd"):0;
  const minLv=modSys?dmodLv(modSys.id,"min"):0;
  const sdl=isSab?bestHeldDefStrength():defStrength(s.id);
  DT={ rv:th.rv, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif:th.dif||1,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(th.rv), mixi:0, sab:isSab,
       qid:th.id, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})),
       mines:minLv>0, mineFired:false, mineFlash:null,
       hangar:hangarEntriesFor(modSys?modSys.id:null) };
  $("#dName").textContent=(RIVALMAP[th.rv]?RIVALMAP[th.rv].n:"Hostiles")+" — "+s.n;
  $("#dMeta").textContent = sdl>0
    ? b.flav+"  \u00b7  DEFENCES "+dmodSummary(modSys?modSys.id:null)
    : b.flav;
  $("#dRes").classList.remove("on");
  $("#defence").classList.add("on");
  dResize();                 /* before the first update, not after it */
  blip(120,.4,"sawtooth",.06);
  dirty=true;
  return true;
}
/* Difficulty is PRESSURE, never toughness. Shots-to-kill has to stay flat, because the
   player's answer to it - fire rate - is nearly flat across the whole game: 1.9/s at the
   start, 2.4/s at level 50. Scale hit points with level and the fight gets strictly
   harder no matter what the player builds. So a deeper system and a higher level send
   MORE of them, FASTER, and each one still dies to the same number of shots. */
function defPress(){ return Math.min(1.85, 1+(((DT&&DT.dif)||1)-1)*0.45) }
function defSpawn(){
  const b=RVBEH[DT.rv]||RVBEH.hel;
  const k=DT.mix[DT.mixi++%DT.mix.length], K=DKIND[k];
  /* off the diagonal, so they enter from beyond the edge on every bearing rather than
     appearing in open space in the middle of a tall screen */
  const a=Math.random()*6.2832, R=Math.hypot(DW,DH)*0.54;
  const hp=defBaseHP()*K.hp*b.hard;
  DT.en.push({ k, a, r:R, hp, max:hp,
               sp:K.sp*(0.115+0.018*Math.min(3,DT.wave/6)),   /* inward, screens/sec */
               tan:K.tan*(Math.random()<0.5?-1:1)*0.28,        /* the sideways drift */
               rr:K.r, col:K.col, alive:1, wob:Math.random()*6.2832 });
}
/* one place that knows the fire rate, so the reload ring and the trigger cannot disagree */
function defRate(){ return DEF_RATE*(1+0.14*(hardpoints()-2)) }
function defFireAt(px,py){
  if(!DT||DT.done||DT.paused)return false;
  if(DT.cool>0)return false;
  const cx=DW*0.5, cy=DH*0.5;
  let vx=px-cx, vy=py-cy;
  const m=Math.hypot(vx,vy); if(m<1)return false;
  const sp=DEF_SPD*DH;
  DT.sh.push({x:cx,y:cy,vx:vx/m*sp,vy:vy/m*sp,life:2.6});
  DT.cool=1/defRate();
  blip(660,.05,"square",.03);
  return true;
}
/* An automated turret picks the nearest hostile and leads it exactly. It is not meant to
   win the fight - it is meant to be visibly on your side while you deal with the rest. */
function defAutoFire(){
  if(!DT||DT.done||!DT.turrets||!DT.turrets.length)return 0;
  const cx=DW*0.5, cy=DH*0.5, spd=DEF_SPD*DH;
  let fired=0;
  for(const t of DT.turrets){
    if(t.cd>0)continue;
    let best=null, bd=Infinity;
    for(const e of DT.en){ if(e.alive&&e.r<bd){ bd=e.r; best=e } }
    if(!best)continue;
    /* solve the lead the same way a good player would, two passes on a spiral */
    let tt=0, r=best.r, a=best.a;
    for(let k=0;k<2;k++){
      r=Math.max(0,best.r - tt*best.sp*Math.hypot(DW,DH)*0.82);
      a=best.a + tt*best.tan/Math.max(0.25,(r/dMin())*3.2);
      tt=Math.hypot(Math.cos(a)*r, Math.sin(a)*r)/spd;
    }
    const tx=cx+Math.cos(a)*r, ty=cy+Math.sin(a)*r;
    const vx=tx-cx, vy=ty-cy, m=Math.hypot(vx,vy)||1;
    DT.sh.push({x:cx,y:cy,vx:vx/m*spd,vy:vy/m*spd,life:2.6,auto:1});
    t.cd=SD_AUTOEV;
    fired++;
  }
  return fired;
}
/* Hangar ships (patch601): each stationed hull fires exactly like an auto-turret -
   same lead-solve, same SD_AUTOEV cadence, same shot damage - but from its own
   drawn position beside the system (defHangarXY(), shared with defDraw() so the
   shot visibly comes from the ship firing it) instead of dead centre. A parallel
   function to defAutoFire() rather than folding hulls into DT.turrets: turrets and
   Hangar ships are two different fitted modules with two different draw treatments
   (turrets have no sprite of their own; Hangar ships do). */
function defHangarXY(i,n){
  const cx=DW*0.5, cy=DH*0.5, rad=dMin()*DEF_RING*2.6;
  const ang=-1.5708+(i+0.5)*(6.2832/Math.max(1,n));
  return {x:cx+Math.cos(ang)*rad, y:cy+Math.sin(ang)*rad};
}
function defHangarFire(){
  if(!DT||DT.done||!DT.hangar||!DT.hangar.length)return 0;
  const spd=DEF_SPD*DH, n=DT.hangar.length;
  let fired=0;
  for(let i=0;i<n;i++){
    const t=DT.hangar[i]; if(t.cd>0)continue;
    let best=null, bd=Infinity;
    for(const e of DT.en){ if(e.alive&&e.r<bd){ bd=e.r; best=e } }
    if(!best)continue;
    const o=defHangarXY(i,n);
    let tt=0, r=best.r, a=best.a;
    for(let k=0;k<2;k++){
      r=Math.max(0,best.r - tt*best.sp*Math.hypot(DW,DH)*0.82);
      a=best.a + tt*best.tan/Math.max(0.25,(r/dMin())*3.2);
      const ex=DW*0.5+Math.cos(a)*r, ey=DH*0.5+Math.sin(a)*r;
      tt=Math.hypot(ex-o.x, ey-o.y)/spd;
    }
    const ex=DW*0.5+Math.cos(a)*r, ey=DH*0.5+Math.sin(a)*r;
    const vx=ex-o.x, vy=ey-o.y, m=Math.hypot(vx,vy)||1;
    DT.sh.push({x:o.x,y:o.y,vx:vx/m*spd,vy:vy/m*spd,life:2.6,auto:1});
    t.cd=SD_AUTOEV;
    fired++;
  }
  return fired;
}
function defEnemyXY(e){
  return {x:DW*0.5+Math.cos(e.a)*e.r, y:DH*0.5+Math.sin(e.a)*e.r};
}
function defUpdate(dt){
  if(!DT)return;
  if(!DW||!DH)dResize();     /* belt and braces: a rotate or a restore can zero these */
  if(DT.done){ DT.el+=dt; return }
  if(DT.paused)return;
  DT.el+=dt;
  DT.cool=Math.max(0,DT.cool-dt);
  if(DT.turrets)for(const t of DT.turrets)t.cd=Math.max(0,t.cd-dt);
  if(DT.hangar)for(const t of DT.hangar)t.cd=Math.max(0,t.cd-dt);
  defAutoFire();
  defHangarFire();
  if(DT.mineFlash){ DT.mineFlash.a-=dt*1.3; if(DT.mineFlash.a<=0)DT.mineFlash=null; }
  const b=RVBEH[DT.rv]||RVBEH.hel;
  /* waves arrive faster as the clock runs down: the pressure has to build or holding
     out for forty seconds is just forty seconds of the same thing */
  DT.spawnT-=dt;
  if(DT.spawnT<=0){
    DT.wave++;
    const every=Math.max(0.34, (1.55 - DT.el/DT.secs*0.85)/(b.wave*defPress()));
    DT.spawnT=every;
    defSpawn();
    if(DT.el>DT.secs*0.5&&Math.random()<0.22)defSpawn();
  }
  const ringR=dMin()*DEF_RING, stopR=dMin()*DEF_LEAK;
  for(const e of DT.en){
    if(!e.alive)continue;
    e.wob+=dt*2.2;
    if(e.r>stopR)e.r-=dt*e.sp*Math.hypot(DW,DH)*0.82;
    e.a+=dt*e.tan/Math.max(0.25,e.r/dMin()*3.2);   /* tighter orbit = faster sweep */
  }
  /* Minefield (patch601): detonates once, against the first wave to cross the mine
     ring - real damage, in the same defShotDmg() unit every shot in this fight
     already uses, landing on everything currently inside the ring at once. */
  if(DT.mines && !DT.mineFired){
    let closest=Infinity;
    for(const e of DT.en){ if(e.alive)closest=Math.min(closest,e.r); }
    if(closest<=dMin()*DEF_MINE_RING){
      DT.mineFired=true;
      DT.mineFlash={a:1};
      const dmg=defShotDmg()*DEF_MINE_DMG_MULT;
      for(const e of DT.en){
        if(!e.alive)continue;
        const p=defEnemyXY(e);
        e.hp-=dmg;
        DT.fx.push({x:p.x,y:p.y,a:1,c:"#ffd166"});
        if(e.hp<=0){ e.alive=0; DT.kills++; }
      }
      blip(200,.22,"square",.08);
    }
  }
  /* shots */
  for(const sh of DT.sh){
    if(sh.life<=0)continue;
    sh.x+=sh.vx*dt; sh.y+=sh.vy*dt; sh.life-=dt;
    if(sh.x<-40||sh.y<-40||sh.x>DW+40||sh.y>DH+40)sh.life=0;
    const hitR=dMin()*DEF_HIT;
    for(const e of DT.en){
      if(!e.alive)continue;
      const p=defEnemyXY(e);
      const rr=hitR+dMin()*0.026*e.rr;
      if((sh.x-p.x)*(sh.x-p.x)+(sh.y-p.y)*(sh.y-p.y)<=rr*rr){
        sh.life=0;
        e.hp-=defShotDmg();
        DT.fx.push({x:p.x,y:p.y,a:1,c:e.col});
        if(e.hp<=0){ e.alive=0; DT.kills++; blip(880,.10,"square",.04) }
        else blip(420,.05,"triangle",.03);
        break;
      }
    }
  }
  if(DT.sh.length>90)DT.sh=DT.sh.filter(s=>s.life>0);
  /* anything inside the ring is eating the system */
  let biting=0;
  for(const e of DT.en){ if(e.alive&&e.r<=ringR*1.35)biting++ }
  if(biting>0){ DT.hp-=dt*DEF_DRAIN*biting/(DT.hullMul||1); DT.leaked+=dt*biting }
  DT.hp=Math.max(0,DT.hp);
  for(const f of DT.fx){ f.a-=dt*2.4 }
  if(DT.fx.length>60)DT.fx=DT.fx.filter(f=>f.a>0);
  if(DT.hp<=0)return endDefence("lost");
  if(DT.el>=DT.secs)return endDefence("held");
}
function defDraw(){
  if(!DT)return;
  if(dx===null)dResize();
  if(!dx)return;
  const D=bScale, cx=DW*0.5, cy=DH*0.5, M=dMin();
  dx.fillStyle="#03040c"; dx.fillRect(0,0,DW,DH);
  /* the system: a disc with its own hull ring */
  const rr=M*DEF_RING;
  const g=dx.createRadialGradient(cx,cy,0,cx,cy,rr*1.9);
  g.addColorStop(0,"rgba(72,226,255,.30)"); g.addColorStop(1,"rgba(72,226,255,0)");
  dx.fillStyle=g; dx.beginPath(); dx.arc(cx,cy,rr*1.9,0,6.2832); dx.fill();
  dx.fillStyle="#0a1430"; dx.beginPath(); dx.arc(cx,cy,rr,0,6.2832); dx.fill();
  dx.strokeStyle=DT.hp>0.5?"#48e2ff":DT.hp>0.25?"#ffd166":"#ff6b8a";
  dx.lineWidth=3*D; dx.beginPath();
  dx.arc(cx,cy,rr,-1.5708,-1.5708+6.2832*Math.max(0,DT.hp)); dx.stroke();
  /* the line they must not cross */
  dx.strokeStyle="rgba(255,255,255,.10)"; dx.lineWidth=1*D;
  dx.beginPath(); dx.arc(cx,cy,M*DEF_LEAK,0,6.2832); dx.stroke();
  /* the reload ring - the player has to feel the fire rate */
  if(DT.cool>0){
    dx.strokeStyle="rgba(255,209,102,.55)"; dx.lineWidth=2.5*D;
    const f=1-DT.cool*defRate();
    dx.beginPath(); dx.arc(cx,cy,rr*1.35,-1.5708,-1.5708+6.2832*Math.max(0,Math.min(1,f)));
    dx.stroke();
  } else {
    dx.strokeStyle="rgba(255,209,102,.85)"; dx.lineWidth=2.5*D;
    dx.beginPath(); dx.arc(cx,cy,rr*1.35,0,6.2832); dx.stroke();
  }
  /* Minefield detonation flash (patch601) - a bright ring at the mine radius,
     fading out over about a second. */
  if(DT.mineFlash && DT.mineFlash.a>0){
    dx.strokeStyle="rgba(255,209,102,"+Math.max(0,DT.mineFlash.a)+")";
    dx.lineWidth=4*D;
    dx.beginPath(); dx.arc(cx,cy,M*DEF_MINE_RING,0,6.2832); dx.stroke();
  }
  for(const e of DT.en){
    if(!e.alive)continue;
    const p=defEnemyXY(e), s=M*0.026*e.rr*(1+Math.sin(e.wob)*0.05);
    dx.save(); dx.translate(p.x,p.y); dx.rotate(Math.atan2(cy-p.y,cx-p.x)+1.5708);
    dx.fillStyle=e.col; dx.globalAlpha=0.92;
    dx.beginPath(); dx.moveTo(0,-s); dx.lineTo(s*0.78,s*0.8); dx.lineTo(0,s*0.42);
    dx.lineTo(-s*0.78,s*0.8); dx.closePath(); dx.fill();
    dx.globalAlpha=1; dx.restore();
    if(e.hp<e.max){
      dx.fillStyle="rgba(255,255,255,.18)";
      dx.fillRect(p.x-s,p.y+s*1.2,s*2,2.5*D);
      dx.fillStyle=e.col;
      dx.fillRect(p.x-s,p.y+s*1.2,s*2*Math.max(0,e.hp/e.max),2.5*D);
    }
  }
  /* Hangar ships (patch601), drawn beside the system - same triangle shape a
     hostile's is drawn with, coloured by hull class, at the fixed screen position
     their own shots already fire from (defHangarXY()). */
  if(DT.hangar&&DT.hangar.length){
    const n=DT.hangar.length;
    for(let i=0;i<n;i++){
      const o=defHangarXY(i,n), sp=SHIPS[DT.hangar[i].hull], s2=M*0.020;
      dx.save(); dx.translate(o.x,o.y); dx.rotate(Math.atan2(cy-o.y,cx-o.x)+1.5708);
      dx.fillStyle=sp.col; dx.globalAlpha=0.95;
      dx.beginPath(); dx.moveTo(0,-s2); dx.lineTo(s2*0.72,s2*0.78); dx.lineTo(0,s2*0.34); dx.lineTo(-s2*0.72,s2*0.78); dx.closePath(); dx.fill();
      dx.globalAlpha=1; dx.restore();
    }
  }
  for(const sh of DT.sh){ if(sh.life<=0)continue;
    /* your shots are gold, the turrets' are the system's own cyan - so you can see the
       thing you built doing work */
    dx.fillStyle=sh.auto?"#48e2ff":"#ffd166";
    dx.beginPath(); dx.arc(sh.x,sh.y,(sh.auto?2.2:2.6)*D,0,6.2832); dx.fill(); }
  for(const f of DT.fx){ if(f.a<=0)continue;
    dx.strokeStyle=f.c; dx.globalAlpha=Math.max(0,f.a); dx.lineWidth=2*D;
    dx.beginPath(); dx.arc(f.x,f.y,M*0.030*(1.4-f.a),0,6.2832); dx.stroke();
    dx.globalAlpha=1; }
  /* the two bars */
  const hpEl=$("#dHpF"), tmEl=$("#dTmF");
  if(hpEl){ hpEl.style.width=(DT.hp*100)+"%";
    const bar=$(".dhp"); bar.classList.toggle("hurt",DT.hp<=.55&&DT.hp>.25);
    bar.classList.toggle("crit",DT.hp<=.25);
    $("#dHpT").textContent="SYSTEM "+Math.round(DT.hp*100)+"%"; }
  if(tmEl){ const left=Math.max(0,DT.secs-DT.el);
    tmEl.style.width=(100*left/DT.secs)+"%";
    $("#dTmT").textContent="HOLD "+Math.ceil(left)+"s · "+DT.kills+" DOWN"; }
}
function endDefence(how){
  if(!DT||DT.done)return; DT.done=1;
  const s=SYSMAP[DT.sysId], b=RVBEH[DT.rv]||RVBEH.hel, rv=RIVALMAP[DT.rv];
  if(s)dmodConsumeMines(s.id);   /* player-flown resolution - spent whether it fired or not */
  let sv=0, ex=0, exId=s?s.res:null, taken=false, sab=0;
  if(how==="held"){
    S.defw=(S.defw||0)+1; xpOnDef();
    if(S.defw===1)queueNotice("vega:firstHold");
    sv=Math.round(svReward({ti:3,dif:DT.dif})*1.15);
    if(exId){ ex=Math.max(1,Math.round(sysExoRate(s.id)*90*DT.dif)); }
    S.sv=(S.sv||0)+sv; S.svAll=(S.svAll||0)+sv;
    if(ex&&exId){ S.exo[exId]=(S.exo[exId]||0)+ex }
    /* driving them off buys real quiet, not a token pause */
    rvOf(DT.rv).cd=Math.max(rvOf(DT.rv).cd, b.cool*1.6);
    rvOf(DT.rv).p=Math.max(0, rvOf(DT.rv).p-18);
  } else {
    S.defl=(S.defl||0)+1;
    if(DT.sab){
      /* Nothing to occupy at home - a share of the bank is stolen instead, same rule
         as the "hold the line without me" road (holdResolve()). */
      sab=Math.floor(SAB_STEAL*(S.en||0));
      S.en=Math.max(0,(S.en||0)-sab);
    } else {
      /* A fight you were shown, chose to enter and lost costs the system - the player's own
         answer, and the one case where it is unambiguous. Never your last one, though:
         being reduced to nothing by a single bad minute is an ending, not a setback, and
         stage 1 has no shields to prevent it.
         STAGE 2: "costs the system" now means occupied, not deleted - occupySystem()
         leaves S.sys[s.id] and the exotic stockpile completely untouched, replacing both
         the old delete-and-neutral-claim AND the old 28% stockpile haircut outright.
         This is the endDefence side of the reconciliation HANDOVER documents; the
         delegated/offline side is holdResolve() (patch462) and rvMoveAway() (patch461). */
      const last=heldSystems().length<=1;
      if(s&&!last){
        taken=occupySystem(s.id, DT.rv);
        S.msel=null;
      }
    }
    rvOf(DT.rv).cd=Math.max(rvOf(DT.rv).cd, b.cool*0.8);
  }
  thqDrop(DT.qid);
  const held=how==="held";
  const ttl=held?"System Held":"Defences Overrun";
  const col=held?"var(--gr)":"var(--rd)";
  const sub=held
    ? (rv?rv.n:"They")+" broke off and withdrew."
    : taken
      ? (rv?rv.n:"They")+" occupy "+(s?s.n:"the system")+" now \u2014 retake it on the map."
      : (rv?rv.n:"They")+" stripped what they could carry and left.";
  let rows=`<div class="rline"><span>Hostiles destroyed</span><b>${DT.kills}</b></div>`;
  rows+=`<div class="rline"><span>System integrity</span><b>${Math.round(DT.hp*100)}%</b></div>`;
  if(sv>0)rows+=`<div class="rline"><span>Salvage stripped</span><b style="color:var(--sv)">${fmt(sv)} ${RI('sv')}</b></div>`;
  if(ex>0)rows+=`<div class="rline"><span>${exoDef(exId)?exoDef(exId).n:"Exotics"} secured</span><b>${fmt(ex)}</b></div>`;
  if(!held)rows+=`<div class="rline"><span style="color:var(--rd)">Losses</span><b style="color:var(--rd)">${
    DT.sab ? (sab>0 ? fmt(sab)+" Nodes stolen" : "nothing \u2014 no Nodes banked")
    : taken ? (s?s.n:"the system")+" \u2014 occupied, buildings intact" : "nothing \u2014 the garrison held the ground itself"}</b></div>`;
  $("#dRes").innerHTML=`<div class="rescard"><h3 style="color:${col}">${ttl}</h3>
    <div class="rsub">${sub}</div>${rows}
    <button id="dDone">RETURN TO EMPIRE</button></div>`;
  $("#dRes").classList.add("on");
  $("#dDone").onclick=closeDefence;
  if(taken){ toast((rv?rv.n:"They")+" now occupy "+(s?s.n:"a system")+" \u2014 retake it on the map","r"); flag("p-map") }
  blip(held?880:150,.4,held?"square":"sawtooth",.06);
  checkAchs(); dirty=true; save();
}
function closeDefence(){ DT=null; $("#defence").classList.remove("on"); dirty=true; render(); save(); }
/* STAGE 3: the live fleet's own resolution - see the constants block above
   (rvMoveAway region) for the full design note on why this is a separate
   mechanism from the thq pipeline and the offline action budget. Every function
   here is reached only from frame() (lfCheckExpiry, called from patch473's hook)
   or from boot (lfSettleMarkOnLoad) - never from tick()/rvTick(). */
/* FIX 1 (2026-09-06): the arrival-choice prompt's own timer/live-tick state.
   Declared here, right before the one function every LF resolution path already
   calls, so cleanup can live in exactly one place - see lfClear()'s own note. */
let lfPromptTimer=null, lfPromptLive=false;
function lfClearPromptTimer(){ if(lfPromptTimer){ clearTimeout(lfPromptTimer); lfPromptTimer=null } }
function lfClear(){ LF=null; S.lfMark=null; lfClearPromptTimer(); lfPromptLive=false; }
/* test-only helper: force the in-flight fleet's due time so a test can assert
   expiry behaviour without waiting out a real 30-60s countdown. No production
   code path calls this - see ttelegraph2.js. */
function lfSetDue(ms){ if(LF)LF.dueAt=ms; if(S.lfMark)S.lfMark.dueAt=ms; }
/* The "never the player's last system" guard, the same rule occupySystem's other
   two callers (endDefence, rvMoveAway) already apply - checked here too since
   this is a third, independent path to the same occupySystem() call. */
function lfOccupy(sysId, rid){
  const s=SYSMAP[sysId];
  if(!s||!sysHeld(s.id)||heldSystems().length<=1)return false;
  dmodConsumeMines(sysId);   /* the live-fleet offline-occupy path also resolves an attack */
  return occupySystem(s.id, rid);
}
/* 2C: "If the ETA expires while offline, it resolves per 2A into occupation - no
   simulated battle needed in v1." Calls occupySystem() directly rather than the
   thq/holdResolve offline branch (patch462) - this mechanism never touches S.thq
   at all, by design, so there is nothing to route through holdResolve() here. */
function lfResolveOffline(){
  if(!LF)return;
  const s=SYSMAP[LF.sysId], rid=LF.rv;
  if(lfOccupy(LF.sysId, rid)){
    const rv=RIVALMAP[rid];
    toast((rv?rv.n:"They")+" now occupy "+(s?s.n:"a system")+" \u2014 retake it on the map","r");
    flag("p-map"); dirty=true; save();
  }
  lfClear();
}
/* 2C: "enough to open the fight prepared" - the real tactical defence overlay,
   the same machinery startDefence() builds for the pre-existing thq mechanic.
   Deliberately NOT a call to startDefence() itself (that function reads from
   S.thq, which this mechanism never touches) - qid:-1 so endDefence()'s
   thqDrop(DT.qid) is a harmless no-op, and every other field mirrors
   startDefence() exactly, so endDefence()'s win/loss handling - including the
   already-reconciled occupySystem() path on a loss (patch463/464) - needs no
   changes at all to serve this second caller. */
function lfOpenDefence(){
  if(!LF)return;
  const s=SYSMAP[LF.sysId];
  if(!s||!sysHeld(s.id)){ lfClear(); return }
  const rid=LF.rv, b=RVBEH[rid]||RVBEH.hel;
  const dif=1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012;   /* same formula rvMaybeThreat uses */
  bScale=Math.min(devicePixelRatio,2);
  const sdl=defStrength(s.id), turLv=dmodLv(s.id,"tur"), shdLv=dmodLv(s.id,"shd"), minLv=dmodLv(s.id,"min");
  DT={ rv:rid, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(rid), mixi:0,
       qid:-1, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})),
       mines:minLv>0, mineFired:false, mineFlash:null,
       hangar:hangarEntriesFor(s.id) };
  $("#dName").textContent=(RIVALMAP[rid]?RIVALMAP[rid].n:"Hostiles")+" \u2014 "+s.n;
  $("#dMeta").textContent = sdl>0
    ? b.flav+"  \u00b7  DEFENCES "+dmodSummary(s.id)
    : b.flav;
  $("#dRes").classList.remove("on");
  $("#defence").classList.add("on");
  dResize();
  blip(120,.4,"sawtooth",.06);
  lfClear();
  dirty=true;
}
/* FIX 1 (2026-09-06): "arrival is a choice, never a pull" - the modal this builds,
   and the 15s no-answer auto-resolve. Only ever called from lfCheckExpiry() below,
   the same one-call-site discipline every other STAGE 3 function here follows.
   See patch481's own top-of-file note for the one place this deliberately stops
   short of the task's exact wording (no repel-chance roll gets added to "Let
   defences hold" - it is, and stays, unconditional occupation). */
function lfPromptChoice(){
  if(!LF||LF.prompted)return;
  const s=SYSMAP[LF.sysId];
  if(!s||!sysHeld(s.id)){ lfClear(); return }        /* mirrors lfOpenDefence()'s own guard */
  LF.prompted=true;
  LF.promptDueAt=Date.now()+15000;
  const rid=LF.rv, b=RVBEH[rid]||RVBEH.hel, rv=RIVALMAP[rid];
  const sdl=defStrength(s.id);
  showModal(`<h3 style="color:#ffe9b8">Fleet Arriving \u2014 ${s.n}</h3>
    <div style="font:700 11px/1.3 ui-monospace,monospace;color:${rv?rv.col:"var(--gd)"}">${rv?rv.n:"Hostiles"}</div>
    <p>${b.flav}</p>
    <p>${sdl>0
      ? "Defences are up ("+dmodSummary(s.id)+"), but this is a live strike \u2014 walk away and the system will be lost, unless you defend it yourself."
      : "No defences here \u2014 walk away and the system will be lost, unless you defend it yourself."}</p>
    <p class="mhint" id="lfPromptCd"></p>
    <div class="row">
      <button id="lfDefendBtn">DEFEND ${s.n.toUpperCase()}</button>
      <button id="lfHoldBtn" class="ghost">LET DEFENCES HOLD</button>
    </div>`,
    ()=>{
      $("#lfDefendBtn").onclick=()=>{ lfClearPromptTimer(); lfPromptLive=false; hideModal(); lfOpenDefence(); };
      $("#lfHoldBtn").onclick=()=>{ lfClearPromptTimer(); lfPromptLive=false; hideModal(); lfResolveOffline(); };
      lfPromptLive=true; lfPromptTick();
    });
  lfPromptTimer=setTimeout(()=>{
    lfPromptTimer=null;
    if(!LF||!LF.prompted)return;                    /* already answered/cleared in the meantime */
    if($("#lfHoldBtn"))hideModal();                  /* only close it if it's still OUR modal on screen */
    lfPromptLive=false;
    lfResolveOffline();
  },15000);
}
/* The modal's own live "deciding on its own in Ns" line - same live-tick pattern
   resourceModal()/nodeModal() already use (nmLive/rmLive + nmTick()/rmTick()),
   wired into render() the same way in the next patch. */
function lfPromptTick(){
  if(!lfPromptLive||!LF||!LF.prompted||!LF.promptDueAt)return;
  const el=$("#lfPromptCd"); if(!el)return;
  const left=Math.max(0,Math.ceil((LF.promptDueAt-Date.now())/1000));
  el.textContent="Deciding on its own in "+left+"s if you do nothing.";
}
/* Called once every frame() (patch473) - a live fleet that expires while the tab
   is genuinely hidden (backgrounded/minimised, not merely re-rendered) is treated
   the same as one that expires with the tab fully closed: 2C's "if the ETA
   expires while offline, it resolves into occupation" - the player was not there
   to fight it either way.
   FIX 1 (2026-09-06): expiry while VISIBLE no longer pulls the player straight
   into lfOpenDefence() - lfPromptChoice() offers DEFEND / LET DEFENCES HOLD
   instead, only falling back to instant occupation if the tab goes hidden
   before either the player answers or the prompt's own 15s timer does. */
function lfCheckExpiry(){
  if(!LF)return;
  if(Date.now()<LF.dueAt)return;
  const hidden=typeof document!=="undefined" && document.hidden;
  if(LF.prompted){
    /* The choice is already on screen. Normally nothing to do here at all - the
       15s auto-timeout (a real setTimeout, independent of frame()/rAF - see
       lfPromptChoice()) or a button click resolves it, and frame() itself stops
       running while genuinely hidden anyway. This only defends the rare edge
       case of frame() still getting a tick while hidden (some browsers throttle
       rAF rather than fully pausing it): don't leave an unanswerable prompt on
       screen, resolve it the same way the timeout would. */
    if(hidden){ lfClearPromptTimer(); lfPromptLive=false; lfResolveOffline(); }
    return;
  }
  if(hidden){ lfResolveOffline(); return; }
  lfPromptChoice();
}
/* Boot-time-only (patch473): a live fleet essentially never survives a reload on
   its own (it is not part of S), but the player should never be able to escape
   one just by closing the tab at the right moment (2C, point 5) - so a tiny
   marker IS persisted (S.lfMark). A marker whose ETA has not yet passed is
   restored as a live, still-ticking LF, so the countdown keeps counting across a
   reload rather than silently resetting; one whose ETA has already passed
   resolves straight to occupation, exactly like the offline path above. */
function lfSettleMarkOnLoad(){
  const m=S.lfMark; if(!m||typeof m!=="object")return;
  if(!SYSMAP[m.sysId]||SYSMAP[m.sysId].home||RVACT.indexOf(m.rv)<0){ S.lfMark=null; return }
  if(Date.now()<m.dueAt){ LF={ rv:m.rv, sysId:m.sysId, dueAt:m.dueAt }; return }
  lfOccupy(m.sysId, m.rv);
  S.lfMark=null;
}
dcv.addEventListener("pointerdown",e=>{
  if(!DT||DT.done)return;
  const r=dcv.getBoundingClientRect();
  defFireAt((e.clientX-r.left)*bScale,(e.clientY-r.top)*bScale);
});
$("#dQuit").onclick=()=>{ if(DT&&!DT.done)endDefence("lost") };
/* What the garrison manages without you. Defences and development against the weight of
   the attack; shown to the player before they choose, because a gamble you cannot price
   is not a decision. */
function holdOdds(th,strOverride){
  if(!th)return 0;
  const b=RVBEH[th.rv]||RVBEH.hel;
  let power;
  if(th.kind==="sab"){
    power=1+(strOverride!==undefined?strOverride:heldSystems().reduce((m,s)=>Math.max(m,defStrength(s.id)),0));
  } else {
    const s=SYSMAP[th.sysId]; if(!s)return 0;
    power=1+(strOverride!==undefined?strOverride:defStrength(s.id));
  }
  const weight=(th.dif||1)*1.55*(b.hard||1);
  return Math.max(0.05, Math.min(0.95, power/(power+weight)));
}
function holdLine(id){
  const th=thqAt(id); if(!th)return null;
  thqDrop(id);
  return holdResolve(th, false, false);
}
/* One resolution for both roads: the player choosing to sit it out, and the clock
   running out while they were away. They are the same event and must not drift apart. */
/* `offline` (STAGE 2): true only from a genuine offline catch-up (offlineReport()
   -> thqTick(away,true,true)) - see patch461's scope note for exactly why the two
   branches below differ instead of sharing one occupation-based outcome. */
function holdResolve(th, auto, quiet, offline){
  if(!th)return null;
  const isSab=th.kind==="sab";
  const s=SYSMAP[th.sysId]; if(!s)return null;
  if(!isSab && !sysHeld(s.id))return null;
  if(!isSab)dmodConsumeMines(s.id);   /* delegated hold or offline expiry - either resolution */
  const b=RVBEH[th.rv]||RVBEH.hel, rv=RIVALMAP[th.rv];
  /* STAGE C: "same rule online and offline" (owner decision 8) - an absent player is
     not deemed to have lost a Nexus raid just because nobody was watching, the way an
     unattended HELD system auto-occupies under 2C below. The odds roll (and whether
     it happens at all) is otherwise identical to the ordinary branch. */
  const odds=(isSab||!offline)?holdOdds(th):0;
  const won=isSab ? Math.random()<odds : (!offline&&Math.random()<odds);
  let sv=0, ex=0, occ=false, sab=0; const exId=isSab?null:s.res;
  if(won){
    S.defw=(S.defw||0)+1; xpOnDef(quiet);
    if(S.defw===1)queueNotice("vega:firstHold");
    /* about half of what flying it yourself pays: enough to be worth doing, never enough
       to make the mini-game pointless */
    sv=Math.round(svReward({ti:3,dif:th.dif||1})*0.55);
    if(exId)ex=Math.max(1,Math.round(sysExoRate(s.id)*45*(th.dif||1)));
    S.sv=(S.sv||0)+sv; S.svAll=(S.svAll||0)+sv;
    if(ex&&exId)S.exo[exId]=(S.exo[exId]||0)+ex;
    rvOf(th.rv).cd=Math.max(rvOf(th.rv).cd, b.cool);
    rvOf(th.rv).p=Math.max(0, rvOf(th.rv).p-8);
  } else if(offline){
    S.defl=(S.defl||0)+1;
    /* STAGE 2: an offline-expired fleet always occupies (2C: "no simulated battle
       needed in v1") - buildings/stockpile untouched, occupySystem() is the whole
       effect. Never the player's last system. csim4.js never reaches this branch
       (it never calls offlineReport()), so the economy sim is unaffected. */
    const last=heldSystems().length<=1;
    if(!last)occ=occupySystem(s.id, th.rv);
    rvOf(th.rv).cd=Math.max(rvOf(th.rv).cd, b.cool*0.8);
  } else if(isSab){
    S.defl=(S.defl||0)+1;
    /* Nothing is destroyed and nothing is occupied (home can never be) - a share of
       the bank is stolen instead, same 25% whether this resolved online or during an
       offline catch-up. */
    sab=Math.floor(SAB_STEAL*(S.en||0));
    S.en=Math.max(0,(S.en||0)-sab);
    rvOf(th.rv).cd=Math.max(rvOf(th.rv).cd, b.cool*0.8);
  } else {
    S.defl=(S.defl||0)+1;
    /* ONLINE delegated loss - UNCHANGED from before Stage 2, on purpose. "A delegated
       loss NEVER costs the system. You did not decline a fight you could see going
       badly - you chose not to be there, and the garrison did what it could." This
       still leaves the pre-existing stockpile haircut technically in tension with
       2A's "never touch stockpiles" for this one specific choice - a deliberate,
       flagged exception; see HANDOVER for the csim4 evidence that forced it. */
    if(exId&&S.exo[exId])S.exo[exId]=Math.max(0,S.exo[exId]*0.80);
    rvOf(th.rv).cd=Math.max(rvOf(th.rv).cd, b.cool*0.8);
  }
  /* kept for the player to read rather than flashed past - especially the ones that
     resolved while they were asleep */
  if(!Array.isArray(S.thrRep))S.thrRep=[];
  S.thrRep.push({won, occ, sys:s.n, rv:th.rv, sv, ex, sab:isSab, sabAmt:sab, auto:!!auto});
  S.thrRep=S.thrRep.slice(-8);
  if(!quiet){
    toast(won ? s.n+" held \u2014 the garrison drove them off"
              : isSab ? (sab>0 ? (rv?rv.n:"They")+" stole "+fmt(sab)+" Nodes from "+s.n
                                : (rv?rv.n:"They")+" struck "+s.n+" \u2014 nothing to take")
              : occ ? (rv?rv.n:"They")+" have occupied "+s.n+" \u2014 retake it on the map"
              : s.n+" was hit \u2014 defences and stores damaged", won?"g":"r");
    blip(won?760:170,.32,won?"square":"sawtooth",.05);
    checkAchs(); dirty=true; renderAll(); save();
  } else { checkAchs(); dirty=true }
  return {won, occ, sv, ex, sab, odds};
}
/* the threat card: the Raids page has to shout about this or it will be missed */
function thqClock(t){
  const h=Math.floor(t/3600), m=Math.floor((t%3600)/60);
  return h>0 ? h+"h "+m+"m" : Math.max(1,m)+"m";
}
/* patch589: the pinned "the turn has come" card, top of Raids, live throughout
   S.end===1 (later Batch D patches replace it with the battle/ending surfaces).
   ENGAGE is disabled with a repair hint below the same 0.15 hull threshold the
   ordinary raid/assault ENGAGE buttons already use - see this patch's header. */
function renderEndCard(){
  const host=$("#endCard"); if(!host)return;
  if(S.end!==1){ if(host.innerHTML)host.innerHTML=""; return; }
  /* patch589b: a no-fleet check takes priority over the hull one, same order the
     Map's own ASSAULT button already uses (empSysAction(), "NO FLEET" before
     "FLEET TOO DAMAGED") - this card must not offer a fight that cannot start. */
  const mf=mergeFleetsForFinal();
  const noShips=fleetDPS(mf)<=0, lowHull=!noShips&&mf.hp<0.15;
  host.innerHTML=`<div class="thrc endc">
    <h5>VEGA'S FLEET HOLDS SOL REACH</h5>
    <p>The turn has come. Production keeps running \u2014 the final battle is yours to choose, whenever you're ready.</p>
    <button class="thrgo" id="endEngage" ${(noShips||lowHull)?"disabled":""}>ENGAGE</button>
    ${noShips?'<div class="thrnote">No fleet \u2014 build warships first.</div>'
      :lowHull?'<div class="thrnote">Fleet too damaged \u2014 let it repair.</div>':""}
  </div>`;
  const b=$("#endEngage"); if(b)b.onclick=()=>startFinalBattle();
}
function renderThreat(){
  const host=$("#thrCard"); if(!host)return;
  thqPrune();
  const q=thq();
  if(!q.length){ host.innerHTML=""; return }
  /* soonest to expire first: the queue is a to-do list, so it sorts by deadline */
  const list=q.slice().sort((a,b)=>a.t-b.t);
  host.innerHTML=list.map(th=>{
    const s=SYSMAP[th.sysId], rv=RIVALMAP[th.rv], b=RVBEH[th.rv]||RVBEH.hel;
    const od=Math.round(holdOdds(th)*100);
    const soon=th.t<3600;
    /* STAGE C (patch587): a sab card names the Nexus, not a system, and shows what a
       loss would actually take rather than home's own (always 0, see patch586)
       defence level - the same number holdResolve()/endDefence() would really steal. */
    if(th.kind==="sab"){
      const atRisk=Math.floor(SAB_STEAL*(S.en||0));
      const bestSd=bestHeldDefStrength();
      return `<div class="thrc sab${soon?" soon":""}" data-q="${th.id}">
        <h5>INCOMING — THE NEXUS<span class="thrt">${thqClock(th.t)} left</span></h5>
        <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>
        <p>${rv?rv.n:"A rival"} is moving on the Nexus. ${atRisk>0
          ? fmt(atRisk)+" Nodes at risk."
          : "No Nodes banked \u2014 nothing to lose yet."} Hold for ${b.secs} seconds.</p>
        <button class="thrgo" data-q="${th.id}">DEFEND THE NEXUS</button>
        <button class="thrhold" data-q="${th.id}">HOLD THE LINE WITHOUT ME · ${od}%</button>
        <div class="thrnote">${bestSd>0
          ? "Your strongest garrison falls back to defend it."
          : "No garrison to fall back on \u2014 fortify a system, or fly it yourself."}
          When the clock runs out the garrison fights it for you.</div>
        </div>`;
    }
    const dl=defStrength(s.id);
    const hasSen=hasSensorMast(s.id);
    return `<div class="thrc${soon?" soon":""}" data-q="${th.id}">
      <h5>INCOMING — ${s.n}<span class="thrt">${thqClock(th.t)} left</span></h5>
      <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>
      <p>${b.flav} Hold the system for ${b.secs} seconds. Your shots take time to arrive — aim ahead of them.</p>
      ${hasSen&&STORY.doctrine&&STORY.doctrine[th.rv]?`<p>${STORY.doctrine[th.rv]}</p>`:""}
      <button class="thrgo" data-q="${th.id}">DEFEND ${s.n.toUpperCase()}</button>
      <button class="thrhold" data-q="${th.id}">HOLD THE LINE WITHOUT ME · ${od}%</button>
      <div class="thrnote">${dl
        ? dmodSummary(s.id)+" fitted. Fighting it yourself pays roughly twice as much, and only you can lose the system."
        : "No defences here \u2014 the garrison will struggle. Fortify it on the map, or fly it yourself."}
        When the clock runs out the garrison fights it for you.</div>
      </div>`;
  }).join("");
  host.querySelectorAll(".thrgo").forEach(b=>{
    b.onclick=()=>startDefence(+b.dataset.q);
  });
  host.querySelectorAll(".thrhold").forEach(b=>{
    b.onclick=()=>{ holdLine(+b.dataset.q); renderThreat() };
  });
}
/* pressure, shown rather than hidden: escalation the player cannot see is just bad luck */
/* FIX 2 (2026-09-06): "Empire shows only a compact banner" - the full .thrc.live
   card (rival name, a full descriptive paragraph, a countdown) was the one piece
   of combat detail that had crept onto Empire; #thrCard/#rvBars live on Raids,
   never here (see patch483's own top-of-file audit note). Down to rival, system,
   ETA, nothing more, on one line - tapping it jumps to the Map tab and selects
   the targeted system there, the exact S.msel+gotoTab("p-map") pattern every
   other "go inspect this system" entry point in the game already uses (see
   empSysRow()'s contested-row onclick). The full detail this used to show
   (archetype flavour text, defence level) still lives on the Map tab's own
   per-system panel - see FIX 2's Map-tab patch. */
function renderLiveFleet(){
  const host=$("#lfBanner"); if(!host)return;
  if(!LF){ if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML="" } return }
  const s=SYSMAP[LF.sysId], rv=RIVALMAP[LF.rv];
  /* the button itself only changes with the event (a new rival, a new target system) -
     the countdown ticks every frame but must not rebuild the node for it, so it is
     written into .lfmini-cd directly, outside this guard. */
  const key=LF.rv+"|"+LF.sysId;
  if(host.dataset.h!==key){
    host.dataset.h=key;
    host.innerHTML=`<button type="button" class="lfmini">
        <span class="lfmini-dot"></span>
        <span class="lfmini-txt"><b style="color:${rv?rv.col:"var(--gd)"}">${rv?rv.n:"Hostiles"}</b> \u2192 ${s?s.n:LF.sysId}</span>
        <span class="lfmini-cd"></span>
      </button>`;
    const btn=host.querySelector(".lfmini");
    if(btn)btn.onclick=()=>{ S.msel=LF.sysId; gotoTab("p-map"); };
  }
  const left=(LF.dueAt-Date.now())/1000;
  const cd=host.querySelector(".lfmini-cd"); if(cd)cd.textContent=lfClock(left);
}
function renderRivalBars(){
  const host=$("#rvBars"); if(!host)return;
  /* patch592: hides at S.end>=1, not only once peace is final at S.end===2 - per
     the plan's own wording for this patch. Rivals already go quiet at S.end===1
     (patch589), so a pressure gauge stuck at whatever it read the instant the
     turn came has nothing true left to show even before the game is fully won. */
  const wrap=$("#rvPressureWrap");
  if(S.end>=1){ if(wrap)wrap.hidden=true; host.innerHTML=""; return }
  if(wrap)wrap.hidden=false;
  if(!rvAwake()){ host.innerHTML=""; return }
  host.innerHTML=RVACT.map(id=>{
    const rv=RIVALMAP[id], p=rvPressure(id)/RV_MAX, met=rvKnown(id);
    const first=rvFirstSystem(id);
    if(!met)return `<div class="rvrow"><span class="rvn" style="color:${rv.col};opacity:.45">${rv.n}</span>
      <span class="rvb"></span>
      <span class="rvp">${first?"L"+first.lvl:"—"}</span></div>`;
    return `<div class="rvrow"><span class="rvn" style="color:${rv.col}">${rv.n}</span>
      <span class="rvb"><i style="width:${Math.round(p*100)}%;background:${rv.col}"></i></span>
      <span class="rvp">${Math.round(p*100)}%</span></div>`;
  }).join("");
}
function comboMul(){ return 1+Math.min(BT.cmb,20)*0.05 }   /* up to x2 for a clean chain */
/* ---------------- turn mode ---------------- */
/* off power, not hull count: counting hulls made Interceptor swarms the cheapest
   route to max command points, which inverts the whole tier ladder */
function cpTotal(){ return 5+Math.min(5,Math.floor(shipPower()/CP_PER))+Math.floor(xlv("comm")/3) }
function ordSpent(){ const o=BT.ord; let v=o.scr+o.rep;
  for(const k in o.vol)v+=o.vol[k]; return v }
function cpLeft(){ return Math.max(0,BT.cp-ordSpent()) }
function volOn(i){ return (BT.ord.vol[i]||0) }
function addVolley(i){
  const e=BT.en[i];
  if(!BT||BT.done||BT.mode!=="turn"||!e||!e.alive||cpLeft()<1)return false;
  BT.ord.vol[i]=volOn(i)+1; blip(680,.06,"square",.04); return true;
}
function addOrder(k){
  if(!BT||BT.done||BT.mode!=="turn"||cpLeft()<1)return false;
  if(k==="scr")BT.ord.scr++; else if(k==="rep")BT.ord.rep++; else return false;
  blip(k==="scr"?420:560,.07,"sine",.04); return true;
}
function clearOrders(){ if(BT)BT.ord={vol:{},scr:0,rep:0} }
/* ---------------- weapon mode ---------------- */
function wepReady(i){ const w=BT&&BT.wep&&BT.wep[i]; return !!(w&&w.ch>=w.chg) }
function livingFoes(){ return BT?BT.en.filter(e=>e.alive).length:0 }
/* the selected hostile, skipping to another if the one you picked has died */
function bTarget(){
  if(!BT)return -1;
  if(BT.sel>=0&&BT.en[BT.sel]&&BT.en[BT.sel].alive)return BT.sel;
  for(let i=0;i<BT.en.length;i++)if(BT.en[i].alive){BT.sel=i;return i}
  return -1;
}
function fireWeapon(i){
  if(!BT||BT.done||BT.mode!=="wep"||BT.withdraw)return false;   /* patch590: no firing once the Core has broken off */
  const w=BT.wep[i]; if(!w||w.ch<w.chg)return false;
  if(!wepOnline(i)){ toast("That hardpoint has no power"); return false }
  const D=WEPMAP[w.id]; if(!D)return false;
  const tg=bTarget(); if(tg<0)return false;
  /* an empty rack is not a misfire - the gun stays charged so the shot is not lost */
  if(D.ammo&&!(S.ammo>0)){ toast("No rockets \u2014 buy more under Raids \u203a Loadout"); return false }
  if(D.ammo)S.ammo=Math.max(0,S.ammo-1);
  w.ch=0;
  const targets = D.all ? BT.en.map((e,k)=>k).filter(k=>BT.en[k].alive) : [tg];
  const aimSys = (!D.all && BT.selSys>=0) ? BT.selSys : -1;
  const shots=D.shots||1;
  let anyHit=false;
  for(const k of targets){
    for(let s=0;s<shots;s++){
      const e=BT.en[k]; if(!e||!e.alive)continue;
      /* accuracy first, then the target's own evasion - a Lancer is hard to hit with
         anything, and a sloppy gun makes it worse */
      /* engines down means a sitting target - the reward for aiming at them */
      const hit=(e.sys&&e.sys.some(x=>x.k==="eng")&&!sysUp(e,"eng")) ? true
        : Math.random() < D.acc*(1-evadeOf(e));
      if(!hit){ BT.fx.push({t:"miss",x:e.x*BW,y:e.y*BH,a:1,n:1}); continue }
      const crit=Math.random()<D.crit*(1+0.14*rfl("crt"));
      const dmg=fleetDPS(BT.f)*D.mul*(crit?2.4:1)*crewMul("gun");
      /* their screens block whole shots too, unless the gun pierces */
      if(!D.pierce && e.shd>0){
        const wasFinal=e.shd===1;
        e.shd--; e.shdT=0;
        if((D.fx||"bolt")==="shell"){
          /* patch557: a blocked shell still has to fly there - the block fx/sound
             pop when it LANDS (bFade), not at the muzzle, same as a shell that
             actually deals damage does. */
          const fx=fireFx(D, e, crit);
          if(fx){ fx.blk=1; fx.wasFinal=wasFinal?1:0; fx.blkTarget=k; }
        } else {
          /* beam/bolt/spray are instant - draw the shot now (it was never drawn at
             all for a blocked shot before this patch), then resolve the block. */
          fireFx(D, e, crit);
          shieldBlockFx(e, wasFinal);
        }
        continue;
      }
      if((D.fx||"bolt")==="shell"){
        /* the shot is real (the roll above already happened) but the damage is not
           applied until the shell actually lands - see bFade()'s "shell" branch */
        const fx=fireFx(D, e, crit);
        if(fx) fx.pend={k, dmg, crit:crit?1:0, aimSys};
        anyHit=true;
      } else {
        if(aimSys>=0 && sysAt(e,aimSys) && sysAt(e,aimSys).st<2) hitSystem(k, aimSys, dmg);
        else hitEnemy(k, dmg, crit?1:0);
        anyHit=true;
        fireFx(D, e, crit);
      }
    }
  }
  sfx(fireCueFor(D));
  if(anyHit){ BT.cmb++; BT.cmbT=0; BT.best=Math.max(BT.best||0,BT.cmb) }
  dirty=true; return true;
}
/* a hostile's shot: one bolt, on its own clock, drawn by the patch82 animation */
function foeFire(e){
  const K=EK[e.k]||EK.grunt;
  const raw=!!K.fuse;                         /* a Charger's breach ignores screens AND evasion */
  /* they roll to hit exactly as you do - being the only side that can whiff was the
     single most unfair-feeling thing in the fight */
  const miss = !raw && Math.random() >= (K.acc||0.8)*(1-fleetEvade(BT.f));
  /* a shield layer stops the shot WHOLE, whatever its size, then is gone until it
     rebuilds. A breach ignores them, which is what a breach is for. */
  const blocked = !miss && !raw && BT.shd>0;
  if(blocked){
    const wasFinal=BT.shd===1;
    BT.shd--; BT.shdT=0;
    if(wasFinal){ BT.fx.push({t:"shshatter",x:BW*0.5,y:playerY(),a:1,r:0});
      sfx("shieldShatter"); }
  }
  const d = (miss||blocked) ? 0 : (raw ? BT.hpm*(K.rawBlast||WEP_BLAST) : e.dps*EFIRE);
  if(!miss)BT.hits.push({x:e.x,y:e.y,raw:raw?1:0,d});
  BT.fx.push({t:"shot",x:e.x*BW,y:e.y*BH,ty:playerY(),p:0,w:0,dur:SHOT_T,
              d,raw:raw?1:0,miss:miss?1:0,blk:blocked?1:0,a:1});
  BT.hp-=d;
  if(!miss)BT.hpHold=Math.max(BT.hpHold||0,SHOT_T+0.05);
  sfx("foeShot");
}
/* each weapon draws itself. A shell actually travels, which is the whole reason the
   Rocket Pod looked like a laser before. */
function fireFx(D,e,crit){
  const ex=e.x*BW, ey=e.y*BH, sy=playerY(), sx=BW*0.5;
  const kind=D.fx||"bolt";
  let fx=null;
  if(kind==="shell"){
    fx={t:"shell",x:sx,y:sy,tx:ex,ty:ey,p:0,dur:0.34,a:1,
        big:D.chg>=5?1:0,c:crit?1:0};
    BT.fx.push(fx);
  } else if(kind==="beam"){
    fx={t:"lance",x:ex,y:ey,a:1,c:crit?1:0};
    BT.fx.push(fx);
  } else if(kind==="spray"){
    for(let q=0;q<3;q++)
      BT.fx.push({t:"beam",x:ex+(Math.random()*36-18),y:ey+(Math.random()*30-15),
                  a:1,c:0});
  } else {
    fx={t:"beam",x:ex,y:ey,a:1,c:crit?1:0};
    BT.fx.push(fx);
  }
  return fx;
}
/* the shield-block flourish (fx + floating "BLOCKED" text + sound), shared by an
   instant block (beam/bolt/spray - resolves the moment the shot fires) and a shell's
   landing (patch557 - a blocked shell now flies to the target and pops there,
   instead of vanishing at the muzzle with no projectile at all). */
function shieldBlockFx(e,wasFinal){
  if(wasFinal){ BT.fx.push({t:"shshatter",x:e.x*BW,y:e.y*BH,a:1,r:0});
    sfx("shieldShatter"); }
  else{ BT.fx.push({t:"shbreak",x:e.x*BW,y:e.y*BH,a:1,r:0});
    sfx("shieldBlock"); }
  BT.num.push({x:e.x*BW,y:e.y*BH,v:0,a:1,sy:"BLOCKED"});
}
/* ---------------- the final battle (patch590) ----------------
   Three scripted waves through the ordinary wep-mode simulation (bUpdateWep, right
   below), sized off the player's OWN fleetHPMax()/fleetDPS() at engage time
   (BT.hpm/BT.dps - fixed for the whole fight, exactly like every ordinary fight
   already treats them) rather than the raid par curve. Wave 1 spawns through
   engageTarget() itself (its own t.final branch, above); waves 2/3 spawn here, on
   the same hostile-object shape as engageTarget()'s own spawn loop and the STAGE 1
   reinforcement block below - duplicated rather than shared, matching how that
   reinforcement block already duplicates engageTarget()'s loop instead of
   factoring it out. */
const FINAL_WAVE_MULT=[0.6,0.8,1.0], FINAL_WAVE_EN=[4,5,5];   /* TUNING-PENDING */
const FINAL_BOSS_HP_SHARE=0.35;   /* TUNING-PENDING - VEGA Core's share of wave 3's HP/DPS budget */
const FINAL_BREATHER_S=2;         /* TUNING-PENDING - pause between waves */
const FINAL_BOSS_BREAK=0.25;      /* owner decision: the Core breaking off (and winning the fight) triggers here */
const FINAL_WITHDRAW_T=1.5;       /* owner decision: ~1.5s fly-out before the result card */
const FINAL_CAP=300;              /* owner decision: this fight only - see finalBattleTick() */
function finalHostileObj(k,hp,dps,i,n,boss){
  const K=EK[k]||EK.grunt, slist=sysListFor(k);
  return { k, hp, max:hp, dps, alive:1,
    sys:slist.map(sk=>({k:sk, st:0, d:0, rt:0})),
    shd:0, shdT:0,
    x: boss ? 0.5 : .15+.7*((i+.5)/Math.max(1,n)),
    y: boss ? .16 : .18+Math.random()*.30,
    px:Math.random()*6.28, py:Math.random()*6.28, sp:(.5+Math.random()*.6)*K.sp,
    rr:K.r, wa:Math.random()*6.28, ws:0.5+Math.random()*0.7,
    shp:K.sh?hp*K.sh:0, shm:K.sh?hp*K.sh:0, rg:0,
    fz:K.fuse||0, fzm:K.fuse||0,
    wcd:(K.fuse?(K.fuseS||FUSE_S)*0.8:EFIRE*(0.8+Math.random()*0.9)/Math.max(0.5,K.sp)),
    boss:!!boss };
}
/* ---------------- allies in the fight (patch591) ----------------
   No friendly-unit system exists anywhere else in the game, so an ally is a
   passive damage tick, not a real combatant - BT.allies is a plain list, read only
   by finalAlliesTick() and bDraw() below. Nothing in any win/loss check (BT.en/
   BT.hp are the only things either one ever reads) or any targeting code reads it,
   so an ally can neither affect the outcome nor ever be hit itself. */
const FINAL_ALLY_ORDER=["vsh","hel","cov"];   /* owner decision: join order, wave 1/2/3 */
const ALLY_DPS_FRAC=0.12;   /* TUNING-PENDING - each ally's sustained dps as a fraction of BT.dps */
const ALLY_IV=1.5;          /* TUNING-PENDING - seconds between an ally's hits */
function finalAllyJoin(wave){
  const rv=FINAL_ALLY_ORDER[wave-1]; if(!rv)return;
  const r=RIVALMAP[rv]; if(!r)return;
  BT.allies.push({ rv, col:r.col, iv:0 });
  toast(STORY.allyJoin.replace("{rival}",r.n),"y");
}
/* where the ally row sits: just above the player fleet (playerY(), fy) - the bottom
   HUD overlay (.bh-bot, position:absolute) only ever starts at fy and below, so a
   row drawn above it never overlaps, 390px included. Shared by finalAlliesTick()
   (as the tracer's own origin point) and bDraw() so they can never drift apart. */
/* patch591c: was a full-width row (BW*(0.5+index*0.11)) of 0.62*fr ships - near-
   invisible at 390px. Now a tight cluster at fr (the player fleet's own ship size)
   off to one side, close enough together that they read as a formation rather than
   scattered points. The vertical gap to playerY() - not the horizontal range - is
   what has always kept this row clear of the fleet below it (unchanged principle,
   just nudged up slightly for the now-larger ships), so clustering to one side
   cannot introduce a new overlap with the (up to 13-wide) player row. */
function allyRowY(){ return playerY()-Math.min(BW,BH)*0.115 }
function allyRowX(i,n){ const fr=Math.min(BW,BH)*0.017; return BW*0.22+(i-(n-1)/2)*fr*2.3 }
/* fires each ally on its own ALLY_IV clock at a random ALIVE hostile, through
   hitEnemy() - the SAME shared function every player hit already goes through, so
   an ally hit respects hostile shields exactly like a player hit, and can trigger
   finalBossBreakCheck() exactly like a player hit too (the Core doesn't care who
   broke it). Never reached during the withdraw beat - bUpdateWep() returns before
   finalBattleTick() (which calls this) ever runs while BT.withdraw is set, so
   allies stop firing the instant the Core breaks off, same as every hostile. */
function finalAlliesTick(dt){
  if(!BT.allies||!BT.allies.length)return;
  const perHit=BT.dps*ALLY_DPS_FRAC*ALLY_IV, n=BT.allies.length;
  for(let ai=0;ai<n;ai++){
    const a=BT.allies[ai];
    a.iv=(a.iv||0)-dt;
    if(a.iv>0)continue;
    a.iv+=ALLY_IV;
    const live=BT.en.filter(e=>e.alive); if(!live.length)continue;
    const tgt=live[Math.floor(Math.random()*live.length)], idx=BT.en.indexOf(tgt);
    hitEnemy(idx,perHit,0);
    BT.fx.push({t:"allyshot", x:allyRowX(ai,n), y:allyRowY(), tx:tgt.x*BW, ty:tgt.y*BH, a:1, col:a.col});
  }
}
function finalSpawnWave(wave){
  BT.wave=wave;
  const totalHP=BT.hpm*FINAL_WAVE_MULT[wave-1], totalDPS=BT.dps*FINAL_WAVE_MULT[wave-1];
  const n=FINAL_WAVE_EN[wave-1], hasBoss=wave>=3;
  const bossHP=hasBoss?totalHP*FINAL_BOSS_HP_SHARE:0, bossDPS=hasBoss?totalDPS*FINAL_BOSS_HP_SHARE:0;
  const restHP=totalHP-bossHP, restDPS=totalDPS-bossDPS;
  const mix=mirrorMix();
  const kinds=[]; for(let i=0;i<n;i++)kinds.push(pickKindFrom(mix));
  if(n>=2 && !kinds.some(k=>EK[k].fuse))kinds[Math.floor(Math.random()*kinds.length)]="bomber";
  let wsum=0; for(const k of kinds)wsum+=EK[k].hp;
  for(let i=0;i<n;i++){
    const k=kinds[i], K=EK[k], share=K.hp/wsum;
    BT.en.push(finalHostileObj(k, restHP*share, restDPS*share*K.dps, i, n, false));
  }
  if(hasBoss){
    const K=EK.boss;
    const bh=finalHostileObj("boss", bossHP, bossDPS*K.dps, 0, 1, true);
    BT.en.push(bh); BT.boss=bh;
  }
  BT.tot+=n+(hasBoss?1:0);
  toast(STORY.battleWave.replace("{n}",wave),"y");
  finalAllyJoin(wave);   /* patch591 - Helion at wave 2, Covenant at wave 3 */
}
/* the VEGA Core breaks off instead of dying - checked wherever a hostile's hp
   actually changes (hitEnemy/hitSystem below), before either one's own kill check,
   so an overkill hit that also crosses 0 still reads as a break-off, never a kill. */
function finalBossBreakCheck(e){
  if(!BT||!BT.t||!BT.t.final||BT.withdraw||!e.boss)return false;
  if(e.hp/e.max < FINAL_BOSS_BREAK){ startFinalWithdraw(); return true }
  return false;
}
function startFinalWithdraw(){
  BT.withdraw=1; BT.withdrawT=0;
  toast("VEGA's Core breaks \u2014 the fleet withdraws","y");
}
/* everything else the final battle needs once the ordinary wep-mode sim for this
   frame has run (charging/shields/repair/hostile behaviour, all unchanged above):
   wave-clear detection, the inter-wave breather, and FINAL_CAP. Never reached
   during the withdraw beat - bUpdateWep() returns before this runs whenever
   BT.withdraw is set, so queueWin()/endBattle("timeout") cannot fire mid-withdraw. */
function finalBattleTick(dt){
  finalAlliesTick(dt);   /* patch591 */
  if(BT.waveBreather>0){
    BT.waveBreather-=dt;
    if(BT.waveBreather<=0)finalSpawnWave(BT.wave+1);
    return;
  }
  if(!BT.en.some(e=>e.alive)){
    if(BT.wave<3){ BT.waveBreather=FINAL_BREATHER_S; return }
    endBattle("win");   /* edge case: wave 3 cleared outright, the Core never broke 25% */
    return;
  }
  if(BT.hp<=0){ endBattle("lost"); return }
  if(BT.el>=FINAL_CAP){ endBattle("lost"); return }   /* owner decision: timeout is a loss here, not a partial win */
}
function bUpdateWep(dt){
  /* a true freeze, both sides, like FTL's: nothing charges, nothing fires, no clock.
     It buys thinking time without removing any threat. */
  if(BT.paused){ bFade(dt); return }
  BT.el+=dt;
  /* patch590: the withdraw beat - the Core has broken off, every hostile flies out,
     nothing fires, nothing charges, nothing can be killed. Returns before any of
     the ordinary per-frame logic below, so queueWin()/timeout cannot fire here. */
  if(BT.t && BT.t.final && BT.withdraw){
    BT.withdrawT+=dt;
    /* patch591d: exit RIGHT, not up - the old e.y-=dt*0.55 could carry a hostile
       straight off the top edge, over the header/RETREAT button. x now carries
       the exit (same 0.55/s rate, still clear of BW well inside FINAL_WITHDRAW_T
       for anything that did not already start near the right edge); the small
       sinusoidal wobble moves to y instead, where no amount of amplitude can
       ever reach the header. */
    for(const e of BT.en){ if(e.alive){ e.x+=dt*0.55; e.y+=Math.sin(BT.el*3+e.px)*dt*0.05; } }
    bFade(dt);
    if(BT.withdrawT>=FINAL_WITHDRAW_T)endBattle("finalwin");
    return;
  }
  /* only powered hardpoints charge - an unpowered gun is dead weight, which is what
     makes the weapons/shields trade real */
  BT.wep.forEach((w,i)=>{ if(!w)return;
    if(wepOnline(i))w.ch=Math.min(w.chg,w.ch+dt);
    else w.ch=Math.min(w.ch, w.chg*0.999);      /* holds its charge, cannot finish */
  });
  /* shields rebuild a layer at a time */
  BT.shdMax=pwrOf("shd");
  if(BT.shd<BT.shdMax){ BT.shdT+=dt;
    if(BT.shdT>=SHD_T){ BT.shdT=0; BT.shd++;
      BT.fx.push({t:"shup",x:BW*0.5,y:playerY(),a:1}) } }
  else BT.shd=Math.min(BT.shd,BT.shdMax);
  /* repair power mends the hull continuously */
  if(pwrOf("rep")>0&&BT.hp<BT.hpm)
    BT.hp=Math.min(BT.hpm, BT.hp+BT.hpm*REP_HULL*pwrOf("rep")*dt*crewMul("eng"));
  for(const e of BT.en){
    if(!e.alive)continue;
    const K=EK[e.k]||EK.grunt;
    e.wa+=dt*e.ws;
    if(K.regen&&e.shp<=0){ e.rg+=dt;
      if(e.rg>=K.regen){ e.shp=e.shm; e.rg=0;
        BT.fx.push({t:"shup",x:e.x*BW,y:e.y*BH,a:1}) } }
    if(K.heal){ for(const o of BT.en){ if(o===e||!o.alive)continue;
      o.hp=Math.min(o.max,o.hp+o.max*K.heal*dt) } }
    /* their systems: screens rebuild, repair crews work, guns need to be working */
    if(e.sys){
      const shdN=sysUp(e,"shd")?2:0;
      if(e.shd<shdN){ e.shdT+=dt;
        if(e.shdT>=SHD_T){ e.shdT=0; e.shd++ } }
      else e.shd=Math.min(e.shd,shdN);
      /* a working repair bay brings downed systems back - which is why it is the first
         thing worth killing */
      if(sysUp(e,"rep")){
        for(const s of e.sys){ if(s.st!==1)continue;
          s.rt+=dt;
          if(s.rt>=SYS_REP){ s.rt=0; s.st=0; s.d=0;
            BT.fx.push({t:"shup",x:e.x*BW,y:e.y*BH,a:1}) } }
        if(e.hp<e.max)e.hp=Math.min(e.max,e.hp+e.max*0.010*dt);
      }
    }
    /* every hostile is on its own firing clock; a Charger's is its fuse */
    if(!sysUp(e,"gun")&&!(EK[e.k]||EK.grunt).fuse){ e.wcd=Math.max(e.wcd,0.5); }
    else e.wcd-=dt;
    if(e.wcd<=0){
      foeFire(e);
      e.wcd = K.fuse ? (K.fuseS||FUSE_S) : EFIRE*(0.85+Math.random()*0.3)/Math.max(0.5,K.sp);
    }
    e.px+=dt*e.sp*0.9; e.py+=dt*e.sp*1.3;
    e.x+=Math.sin(e.px)*dt*0.024; e.y+=Math.cos(e.py)*dt*0.017;
    e.x=Math.max(.09,Math.min(.91,e.x)); e.y=Math.max(.13,Math.min(.56,e.y));
  }
  BT.cmbT+=dt; if(BT.cmb>0&&BT.cmbT>3.5)BT.cmb=0;
  /* STAGE 1 escalation: a light pressure tick every PRESSURE_IV seconds up to
     WAVE_T, then one reinforcement wave. Both are one-shot-per-threshold (pTick
     only advances forward, waveDone latches), so a paused/slow frame cannot fire
     either twice. */
  if(!BT.t.final && !BT.waveDone){   /* patch590: ordinary reinforcement/pressure off for the final battle */
    const tick=Math.floor(BT.el/PRESSURE_IV);
    if(tick>(BT.pTick||0) && BT.el<waveTFor(BT.t)){
      BT.pTick=tick;
      BT.hp=Math.max(0,BT.hp-BT.hpm*PRESSURE_DMG);
      BT.fx.push({t:"impact",x:BW*0.5,y:playerY(),a:1,r:0,raw:1});
      BT.hpHold=Math.max(BT.hpHold||0,0.3);
      blip(140,.3,"sawtooth",.06);
    }
    if(BT.el>=waveTFor(BT.t)){
      BT.waveDone=1;
      const archMix=mixFor(BT.t);
      for(let q=0;q<WAVE_ADD;q++){
        const k=archMix?pickKindFrom(archMix):pickKind(BT.t.ti), K=EK[k]||EK.grunt;
        const hp=(BT.spawnAvgHP||BT.hpm*0.1)*WAVE_HP_MULT;
        const slist=sysListFor(k);
        BT.en.push({ k, hp, max:hp, dps:(BT.spawnAvgDPS||BT.dps*0.1)*WAVE_DPS_MULT*K.dps, alive:1,
          sys:slist.map(sk=>({k:sk, st:0, d:0, rt:0})),
          shd:0, shdT:0,
          x:.15+.7*Math.random(), y:.15+Math.random()*.10,
          px:Math.random()*6.28, py:Math.random()*6.28, sp:(.5+Math.random()*.6)*K.sp,
          rr:K.r, wa:Math.random()*6.28, ws:0.5+Math.random()*0.7,
          shp:K.sh?hp*K.sh:0, shm:K.sh?hp*K.sh:0, rg:0,
          fz:K.fuse||0, fzm:K.fuse||0,
          wcd:(K.fuse?(K.fuseS||FUSE_S)*0.8:EFIRE*(0.8+Math.random()*0.9)/Math.max(0.5,K.sp)) });
      }
      BT.tot+=WAVE_ADD;
      toast("Reinforcements arrive \u2014 "+WAVE_ADD+" more hostiles","r");
      sfx("waveIn");
    }
  }
  bFade(dt);
  if(BT.t && BT.t.final)return finalBattleTick(dt);   /* patch590 - see above */
  if(!BT.en.some(e=>e.alive))queueWin(dt);
  else if(BT.hp<=0)endBattle("lost");
  else if(BT.el>=WEP_CAP)endBattle("timeout");
}
/* telegraphs are rolled once per round and shown before you allocate, so the board
   can be answered rather than guessed at */
function rollTel(e){
  const K=EK[e.k]||EK.grunt;
  if(K.fuse){ e.fuse=(e.fuse||0)-1;
    return e.fuse<=0 ? {k:"boom"} : {k:"charge",n:e.fuse} }
  if(K.heal) return {k:"mend"};
  if(K.sh && e.shp<=0) return {k:"screen"};
  if(K.sp>=2) return {k:"volley"};
  if(K.boss) return (e.shp<=0) ? {k:"screen"} : {k:"volley"};
  return {k:"strike"};
}
function telAll(){
  for(const e of BT.en){ if(e.alive)e.tel=rollTel(e) }
}
function incomingOf(e){
  const t=e.tel&&e.tel.k;
  if(t==="volley")return (e.inc||0)*2.2;
  if(t==="strike")return (e.inc||0)*1.0;
  if(t==="boom")return BT.hpm*(EK[e.k].blast||0.26);
  return 0;                                    /* screening and mending do no damage */
}
function forecastIncoming(){
  let v=0; for(const e of BT.en){ if(e.alive)v+=incomingOf(e) }
  return v;
}
/* SHIELDS only answer ordinary fire. A detonation is reported separately because the
   player has to solve it a different way - by killing the Charger first. */
function isRaw(e){ return !!(e.tel && e.tel.k==="boom") }
function forecastSplit(){
  let shield=0, raw=0;
  for(const e of BT.en){ if(!e.alive)continue;
    if(isRaw(e)) raw+=incomingOf(e); else shield+=incomingOf(e) }
  return {shield, raw};
}
function evadeOf(e){
  const K=EK[e.k]||EK.grunt;
  let ev=K.ev||0;
  /* their engines, while they still have them - K.evEng overrides the default
     0.14 swing so Ghost's Phantom can be dramatically harder to hit until its
     engines go down, without changing any other kind's existing tuning. */
  if(sysUp(e,"eng"))ev+=(K.evEng!==undefined?K.evEng:0.14);
  return Math.min(0.8,ev);
}
/* ---------------- enemy systems ----------------
   Derived from the archetype rather than authored again: a Bulwark carries the screens,
   a Mender the repair bay, a Lancer the engines, a Flagship the lot. */
const SYS_N={gun:"GUNS", shd:"SCREENS", eng:"ENGINES", rep:"REPAIR"};
const SYS_COL={gun:"#ffd166", shd:"#48e2ff", eng:"#5ce6a5", rep:"#ff8fd0"};
function sysListFor(k){
  const K=EK[k]||EK.grunt;
  if(K.boss)return ["gun","shd","eng","rep"];
  if(K.sh&&K.heal)return ["gun","shd","rep","eng"];  /* Fortress's Warden: both */
  if(K.sh)  return ["gun","shd","eng"];
  if(K.heal)return ["gun","rep","eng"];
  if(K.ev>=0.3)return ["gun","eng"];
  return ["gun","eng"];
}
/* 0 = working, 1 = down and repairable, 2 = destroyed for the fight */
function sysUp(e,k){
  if(!e||!e.sys)return false;
  const s=e.sys.find(x=>x.k===k);
  return !!s && s.st===0;
}
function sysAt(e,i){ return e&&e.sys?e.sys[i]:null }
/* damage into a system: enough accumulated and it breaks a stage */
function hitSystem(ei,si,dmg){
  const e=BT.en[ei]; if(!e||!e.alive)return false;
  const s=sysAt(e,si); if(!s||s.st>=2)return false;
  s.d=(s.d||0)+dmg;
  const need=e.max*SYS_HP;
  if(s.d>=need){
    s.d=0;
    /* guns can be silenced, never removed - an enemy that can never shoot again made
       the rest of the fight a formality. Every other system still escalates 1 -> 2. */
    const gunCap = s.k==="gun" && s.st>=1;
    if(!gunCap) s.st++;
    e.hp-=e.max*SYS_BLEED;                    /* breaking it hurts the hull a little too */
    BT.fx.push({t:"sysbreak",x:e.x*BW,y:e.y*BH,a:1,r:0,c:SYS_COL[s.k]});
    BT.num.push({x:e.x*BW,y:e.y*BH-16*devicePixelRatio,v:0,a:1,
                 sy:(gunCap?"DOWN ":(s.st>=2?"DESTROYED ":"DOWN "))+SYS_N[s.k]});
    sfx(s.k==="eng" ? "engOut" : ((!gunCap&&s.st>=2) ? "sysDestroyed" : "sysDown"));
    if(s.k==="shd"&&s.st>=1){
      const wasFinal=e.shd===1;
      e.shd=0;
      if(wasFinal){ BT.fx.push({t:"shshatter",x:e.x*BW,y:e.y*BH,a:1,r:0});
        sfx("shieldShatter"); }
    }
    if(finalBossBreakCheck(e))return true;   /* patch590 - before the kill check, never after */
    if(e.hp<=0){ e.alive=0; BT.kills++;
      BT.fx.push({t:"boom",x:e.x*BW,y:e.y*BH,a:1,r:0}); sfx("foeDead") }
    return true;
  }
  return false;
}
/* one roll per pip: over-committing on an evasive hull is a real hedge, not a rounding
   error */
function landedPips(e,pips){
  const ev=evadeOf(e); if(ev<=0)return pips;
  let land=0; for(let q=0;q<pips;q++) if(Math.random()>=ev) land++;
  return land;
}
function screenCut(pips){ return Math.min(SCR_MAX, pips*SCR_CUT) }
/* where your fleet sits on the board - the point incoming fire travels to */
function playerY(){ return BH*(BH/BW>1.5?0.74:0.82) }
const SHOT_T=0.40, SHOT_STAG=0.085;   /* travel time, and the gap between bolts */
function resolveRound(){
  if(!BT||BT.done||BT.mode!=="turn")return false;
  const o=BT.ord;
  /* 1. your volleys land first, so a target you kill never gets to act */
  BT.shots=[];                       /* what happened, for the resolve animation */
  for(const k in o.vol){
    const i=+k, pips=o.vol[k]; if(!pips)continue;
    const e=BT.en[i]; if(!e||!e.alive)continue;
    const land=landedPips(e,pips);
    if(land>0)hitEnemy(i, BT.pip*land*crewMul("gun"), 1);
    if(land<pips)BT.shots.push({i, miss:pips-land});
  }
  /* 2. survivors act on the telegraph you were shown */
  const vary=()=>1+(Math.random()*2-1)*INC_VAR;
  let incShield=0, incRaw=0, mend=0;
  BT.hits=[];                        /* per-attacker, for the resolve animation */
  for(const e of BT.en){
    if(!e.alive||!e.tel)continue;
    const t=e.tel.k, K=EK[e.k]||EK.grunt;
    if(t==="screen"){ e.shp=e.shm; BT.fx.push({t:"shup",x:e.x*BW,y:e.y*BH,a:1}) }
    else if(t==="mend"){ mend+=K.heal||0.05 }
    else if(t==="boom"){ const d=incomingOf(e)*vary();
      /* it survives and re-arms: ignoring a Charger has to keep costing, or ignoring it
         is the correct play */
      incRaw+=d; e.fuse=FUSE_N;
      BT.hits.push({x:e.x,y:e.y,raw:1,d});
      BT.fx.push({t:"blast",x:e.x*BW,y:e.y*BH,a:1,r:0}) }
    else { const d=incomingOf(e)*vary();
      if(d>0){ incShield+=d; BT.hits.push({x:e.x,y:e.y,raw:0,d}) } }
  }
  if(mend>0)for(const e of BT.en){ if(e.alive)e.hp=Math.min(e.max,e.hp+e.max*mend) }
  /* 3. SHIELDS cut ordinary fire only - a detonation goes straight through, which is
        why a Charger has to be shot rather than weathered */
  const cut=screenCut(o.scr);
  BT.lastInc=incShield*(1-cut)+incRaw;
  BT.lastRaw=incRaw;
  for(const hh of BT.hits) if(!hh.raw) hh.d*=(1-cut);
  BT.hp-=BT.lastInc;
  if(o.rep>0)BT.hp=Math.min(BT.hpm,BT.hp+BT.hpm*REP_PIP*o.rep*crewMul("eng"));
  /* the picture of the round: bolts inbound, misses where shots were dodged. State is
     already settled above; this only decides what the player watches. */
  if(BT.mode==="turn"){
    const FY=playerY();
    let slot=0;
    for(const hh of BT.hits){
      if(!(hh.d>0))continue;
      BT.fx.push({t:"shot", x:hh.x*BW, y:hh.y*BH, ty:FY, p:0, w:slot*SHOT_STAG,
                  dur:SHOT_T, d:hh.d, raw:hh.raw, a:1});
      slot++;
    }
    for(const ms of (BT.shots||[])){
      const e=BT.en[ms.i]; if(!e)continue;
      BT.fx.push({t:"miss", x:e.x*BW, y:e.y*BH, a:1, n:ms.miss});
    }
    /* hold the bar until the first bolt lands, then let it chase */
    BT.hpHold=SHOT_T+0.05;
    if(BT.hpShown===undefined)BT.hpShown=BT.hpm;
    BT.lock=SHOT_T+slot*SHOT_STAG+0.25;
  }
  BT.round++;
  BT.cp=cpTotal();
  clearOrders();
  telAll();
  blip(300,.18,"triangle",.05);
  if(!BT.en.some(e=>e.alive))queueWin(1/60);
  else if(BT.hp<=0)endBattle("lost");
  else if(BT.round>BT.maxRounds)endBattle("timeout");
  dirty=true;
  return true;
}
function bTapAt(cx,cy){
  if(!BT||BT.done||BT.tap>0)return;
  BT.taps++;
  let best=-1,bd=1e9;
  for(let i=0;i<BT.en.length;i++){ const e=BT.en[i]; if(!e.alive)continue;
    const d=Math.hypot(e.x*BW-cx,e.y*BH-cy)/(e.rr||1); if(d<bd){bd=d;best=i} }
  const R=Math.min(BW,BH)*0.034;
  if(best<0 || bd>R*2.6){                       /* a miss breaks the chain */
    BT.fx.push({t:"miss",x:cx,y:cy,a:1});
    if(BT.cmb>0)blip(110,.06,"sine",.03);
    BT.cmb=0; BT.tap=0.10; return;
  }
  const e=BT.en[best];
  const ang=Math.atan2(cy-e.y*BH, cx-e.x*BW);
  let dd=Math.abs(((ang-e.wa+Math.PI*3)%6.2832)-Math.PI);
  const crit=dd<(0.62+rfl("crt")*0.085);        /* landed inside the drawn weak-point arc */
  BT.hits++; BT.cmb++; BT.cmbT=0;
  if(BT.cmb>BT.best)BT.best=BT.cmb;
  if(crit)BT.crits++;
  const dmg=BT.dps*0.42*(BT.buf.f>0?2.5:1)*comboMul()*(crit?2.5:1)*crewMul("gun");
  hitEnemy(best,dmg,crit?2:1);
  if(crit){ e.wa=Math.random()*6.28 }   /* hitEnemy() below plays the "crit" cue itself */
  BT.tap=0.15;
}
function hitEnemy(i,dmg,manual){
  const e=BT.en[i]; if(!e||!e.alive)return;
  let shown=dmg;
  let shieldBroke=false;
  if(e.shp>0){                                  /* shields soak first; crits chew them faster */
    const to=Math.min(e.shp, dmg*(manual===2?2:1));
    e.shp-=to;
    const spill=Math.max(0,dmg-to);
    e.hp-=spill*0.35;                           /* a little bleeds through */
    if(e.shp<=0){ e.shp=0; e.rg=0;
      BT.fx.push({t:"shbreak",x:e.x*BW,y:e.y*BH,a:1,r:0});
      sfx("shieldBlock"); shieldBroke=true; }
  } else e.hp-=dmg;
  if(manual){
    BT.num.push({x:e.x*BW,y:e.y*BH,v:shown,a:1,c:manual===2});
    BT.fx.push({t:"beam",x:e.x*BW,y:e.y*BH,a:1,c:manual===2});
  }
  if(finalBossBreakCheck(e))return;   /* patch590 - before the kill check, never after */
  if(e.hp<=0){ e.alive=0; BT.kills++;
    BT.fx.push({t:"boom",x:e.x*BW,y:e.y*BH,a:1,r:0});
    sfx("foeDead");
    const K=EK[e.k];
    if(K&&K.split&&!e.nosplit){                 /* hydras leave two smaller pieces behind */
      for(let q=0;q<K.split;q++){
        BT.en.push({ k:"grunt", hp:e.max*0.4, max:e.max*0.4, dps:e.dps*0.5, alive:1,
          x:Math.max(.09,Math.min(.91,e.x+(q?0.06:-0.06))), y:e.y,
          px:Math.random()*6.28, py:Math.random()*6.28, sp:1.25, rr:0.72,
          wa:Math.random()*6.28, ws:1.1, shp:0, shm:0, rg:0, fz:0, fzm:0, nosplit:1 });
      }
      BT.tot+=K.split;
      BT.fx.push({t:"split",x:e.x*BW,y:e.y*BH,a:1});
    }
  } else if(!shieldBroke){
    /* one hit-sound per landed shot - a shield break or a kill (above) already said
       something happened, so this only plays on a plain hit. */
    sfx(manual===2?"crit":"hitHull");
  }
}
function bUpdate(dt){
  if(!BT)return;
  if(BT.done){ BT.el+=dt; return }
  if(BT.cine)return bUpdateCine(dt);   /* patch633: the auto-resolve clip - see its own comment */
  if(BT.mode==="turn")return bUpdateTurn(dt);
  if(BT.mode==="wep")return bUpdateWep(dt);
  return bUpdateLive(dt);
}
/* patch633: the auto-resolve clip. autoResolveTarget() arms BT.cine (see its own
   comment) instead of the old instant kill; bUpdate() routes here every frame in its
   place until endBattle() sets BT.done (bUpdate()'s own BT.done check then stops this
   being reached again - no second "clip over" flag needed). Beats, by BT.cine.t:
     0.35s          - enemy volley: up to three alive hostiles push the same "shot" fx
                      foeFire() pushes, d:0 (visual only - the real cost lands once,
                      next). bFade() (below) carries it to the existing player-impact
                      fx/sfx on its own, same as a real shot.
     0.35+SHOT_T    - the cost lands: BT.hp -= AUTO_FHP_COST*BT.hpm, exactly what the
                      old flat S.fhp subtraction in endBattle() used to take (see its
                      own do() below) - taken off BT.hp instead so it rides the same
                      hp->fhp conversion a real hit would.
     0.9s -> ~2.0s  - fleet volley: alive hostiles left->right, boss (EK[k].boss) last,
                      one shot every ~0.22s (compressed past five targets so the clip
                      still clears by ~2.6s), rotating the fitted weapons, each an
                      overkill hitEnemy() so the target always dies - the real boom/
                      sound/kills++/hydra split all fire from there, same as a real
                      kill. Hydra pieces join the queue as they spawn.
     +0.25s after   - cineFinish(): the safety net (everyone dead, kills=tot, charge
     the last kill    the cost if a skip landed before it charged itself), then
                      endBattle("win").
   bFade() (shared, unmodified, with bUpdateWep()/bUpdateTurn()) runs every frame here
   too - it is what ages every fx pushed above, chases hpShown toward BT.hp so the hull
   bar visibly dips, and actually lands a shell's f.pend on arrival, exactly like a
   real shot. */
function bUpdateCine(dt){
  /* canAutoResolve() never offers this for t.final - its own win/loss model lives in
     finalBattleTick()/endFinalBattle(), and endBattle() dispatches ANY "how" straight
     into the finale branch once BT.t.final is set, so a scripted "everyone dies, call
     endBattle('win')" would be read as the game's own ending. No UI path can reach
     this - guarded anyway: fall through to the real sim rather than ever mis-resolve a
     fight this clip was not built for. */
  if(BT.t&&BT.t.final)return bUpdateWep(dt);
  if(lowMotion()){ cineFinish(); return }   /* skip straight to the card, first frame in */
  BT.el+=dt;
  const c=BT.cine; c.t+=dt;

  /* patch635: the board was frozen for the whole clip otherwise - bUpdateCine() moved
     nothing between beats. Same light drift bUpdateTurn() applies just below (its own
     comment: "nothing moves until RESOLVE... only the drifting motion... tick, so the
     board stays alive to look at"), copied verbatim - just the motion, nothing else
     from turn mode (no round clock, no input handling, any of that). Every hostile
     this clip ever drives already carries px/py/sp/rr/wa/ws at spawn - the initial
     spawn, the STAGE 1 wave spawn and the hydra-split spawn all set the full set - so
     this never runs against an enemy missing a field it reads. */
  for(const e of BT.en){ if(!e.alive)continue;
    e.px+=dt*e.sp*0.5; e.py+=dt*e.sp*0.7;
    e.x+=Math.sin(e.px)*dt*0.010; e.y+=Math.cos(e.py)*dt*0.008;
    e.x=Math.max(.09,Math.min(.91,e.x)); e.y=Math.max(.13,Math.min(.56,e.y));
    e.wa+=dt*e.ws*0.4;
  }

  if(!c.evolley && c.t>=0.35){
    c.evolley=1;
    const alive=BT.en.filter(e=>e.alive), n=Math.min(3,alive.length);
    for(let q=0;q<n;q++){
      const e=alive[Math.floor(q*alive.length/n)];
      /* patch635: exactly one shot (the first) carries the real cost as its own d, so
         its arrival prints "-<cost>" through the ordinary bFade() path - the rest stay
         d:0, visual only, same as before (and, since patch635's own bFade() guard
         below, no longer print a stray "-0" when they land). The cost still lands
         separately, once, at the unchanged line just below (0.35+SHOT_T) - this does
         not change when or how much is charged, only what one shot's own arrival
         displays. */
      BT.fx.push({t:"shot",x:e.x*BW,y:e.y*BH,ty:playerY(),p:0,w:0,dur:SHOT_T,
                  d:q===0?AUTO_FHP_COST*BT.hpm:0,raw:0,miss:0,blk:0,a:1});
      sfx("foeShot");
    }
  }
  if(!c.charged && c.t>=0.35+SHOT_T){ c.charged=1; BT.hp-=AUTO_FHP_COST*BT.hpm; }

  if(!c.queue && c.t>=0.9){
    const fitted=(BT.wep||[]).filter(Boolean).map(w=>w.id);
    c.wepIds=fitted.length?fitted:["pulse"]; c.wepIdx=0;
    c.queue=[];
    for(let i=0;i<BT.en.length;i++)if(BT.en[i].alive)c.queue.push(i);
    c.queue.sort((a,b)=>{
      const ba=!!(EK[BT.en[a].k]||EK.grunt).boss, bb=!!(EK[BT.en[b].k]||EK.grunt).boss;
      return ba!==bb ? (ba?1:-1) : BT.en[a].x-BT.en[b].x;
    });
    /* more than five targets: compress below the ordinary 0.22s so the volley still
       clears in roughly the same span (5 * 0.22s == 1.1s) whatever the count */
    c.iv=Math.min(0.22,1.1/Math.max(1,c.queue.length));
    c.nextShot=0.9; c.knownLen=BT.en.length;
  }
  while(c.queue && c.queue.length && c.t>=c.nextShot){
    c.nextShot+=c.iv;
    const i=c.queue.shift(), e=BT.en[i];
    if(!e||!e.alive)continue;
    const D=WEPMAP[c.wepIds[c.wepIdx%c.wepIds.length]]; c.wepIdx++;
    /* an overkill hit, same shape as a real one, just guaranteed lethal - the auto-
       resolve already promised this win (canAutoResolve gated it); this only shows it
       happening. e.hp+e.shp+1 alone is NOT enough: hitEnemy() only lets 0.35x of
       whatever is left over after shields through to hull (see its own comment), so a
       shielded hostile would soak the "+1" and survive with most of its hull intact -
       *10 clears that discount with room to spare, whatever shield e is carrying.
       Shell still travels its own dur before it lands (bFade()'s existing f.pend arm,
       the same one a real shell shot uses); everything else is instant, same as a
       real non-shell hit (fireWeapon(), above). */
    const ov=(e.hp+e.shp+1)*10;
    if((D.fx||"bolt")==="shell"){
      const fx=fireFx(D,e,false);
      if(fx)fx.pend={k:i, dmg:ov, crit:0, aimSys:-1};
    } else {
      fireFx(D,e,false);
      hitEnemy(i, ov, 0);
    }
  }
  bFade(dt);
  if(c.queue)while(c.knownLen<BT.en.length){ c.queue.push(c.knownLen); c.knownLen++ }   /* hydra pieces join the queue, from either firing path above */

  if(c.queue && !c.queue.length && !BT.en.some(e=>e.alive)){
    if(c.killT===undefined)c.killT=c.t;
    if(c.t-c.killT>=0.25)cineFinish();
  }
}
/* the skip path (bcv pointerdown, below) and the natural end of the queue above both
   land here: force the board dead (nothing left to animate), charge the integrity
   cost if the clip was skipped before it charged itself (0.35+SHOT_T, above), then
   the ordinary win. */
function cineFinish(){
  if(!BT||BT.done)return;
  for(const e of BT.en)e.alive=0;
  BT.kills=BT.tot;
  if(BT.cine && !BT.cine.charged){ BT.hp-=AUTO_FHP_COST*BT.hpm; BT.cine.charged=1 }
  $("#battle").classList.remove("cine");
  endBattle("win");
}
/* turn mode has no clock: nothing moves until RESOLVE. Only the drifting motion and
   the effect fades tick, so the board stays alive to look at while you think. */
function bUpdateTurn(dt){
  BT.el+=dt;
  for(const e of BT.en){ if(!e.alive)continue;
    e.px+=dt*e.sp*0.5; e.py+=dt*e.sp*0.7;
    e.x+=Math.sin(e.px)*dt*0.010; e.y+=Math.cos(e.py)*dt*0.008;
    e.x=Math.max(.09,Math.min(.91,e.x)); e.y=Math.max(.13,Math.min(.56,e.y));
    e.wa+=dt*e.ws*0.4;
  }
  bFade(dt);
}
function bFade(dt){
  /* bolts in flight: hold at full alpha until they land, then hand off to an impact */
  for(const f of BT.fx){
    if(f.t==="shell"){
      f.p=Math.min(1,f.p+dt/f.dur);
      if(f.p>=1&&!f.landed){ f.landed=1; f.a=0;
        if(f.blk){
          /* patch557: a blocked shell pops its shield fx/sound on arrival, not at
             the muzzle - it never gets a "boom", nothing was actually breached. */
          const e=BT.en[f.blkTarget];
          if(e&&e.alive) shieldBlockFx(e, f.wasFinal);
        } else {
          if(f.pend){
            const e=BT.en[f.pend.k];
            if(e&&e.alive){
              const {dmg,crit,aimSys}=f.pend;
              if(aimSys>=0 && sysAt(e,aimSys) && sysAt(e,aimSys).st<2) hitSystem(f.pend.k, aimSys, dmg);
              else hitEnemy(f.pend.k, dmg, crit);
            }
          }
          BT.fx.push({t:"boom",x:f.tx,y:f.ty,a:1,r:0});
          blip(f.big?150:300,.12,"sawtooth",.05);
        }
      }
      continue;
    }
    if(f.t!=="shot")continue;
    if(f.w>0){ f.w-=dt; continue }
    f.p=Math.min(1,f.p+dt/f.dur);
    if(f.p>=1&&!f.landed){
      f.landed=1; f.a=0;
      if(f.miss||f.blk){
        BT.num.push({x:BW*0.5+(Math.random()*70-35)*devicePixelRatio,
                     y:f.ty-16*devicePixelRatio, v:0, a:1, pl:1,
                     ms:f.miss?1:0, bk:f.blk?1:0});
        if(f.blk){ BT.fx.push({t:"shblock",x:BW*0.5,y:f.ty,a:1,r:0});
          sfx("shieldBlock") }
      } else {
        BT.fx.push({t:"impact", x:BW*0.5, y:f.ty, a:1, raw:f.raw, r:0});
        /* patch635: a real shot with d===0 is always a miss or a block (foeFire()'s
           own d is (miss||blocked)?0:<positive> - there is no other way to get a
           zero) and that combination is already handled by the branch just above
           (f.miss||f.blk) - so this guard can only ever fire on the clip's own
           synthetic zero-cost volley shots (bUpdateCine(), miss:0/blk:0 by
           construction), never in real play. Skips only the NUMBER - the impact fx
           and the hit sound still play for every shot, same as before. */
        if(!(f.d===0 && !f.miss && !f.blk)){
          BT.num.push({x:BW*0.5+(Math.random()*54-27)*devicePixelRatio,
                       y:f.ty-14*devicePixelRatio, v:f.d, a:1, pl:1, raw:f.raw});
        }
        sfx("playerHit");
      }
    }
  }
  if(BT.hpHold>0)BT.hpHold-=dt;
  if(BT.lock>0)BT.lock-=dt;
  /* the displayed hull chases the real one, but only once the bolts have arrived */
  if(BT.hpShown===undefined)BT.hpShown=BT.hp;
  if(BT.hpHold<=0){
    const d=BT.hp-BT.hpShown;
    BT.hpShown += Math.abs(d)<BT.hpm*0.004 ? d : d*Math.min(1,dt*7);
  }
  for(const f of BT.fx){
    if(f.t==="shot"||f.t==="shell")continue;
    if(f.t==="lance")f.a-=dt*0.6;               /* a lance lingers */
    if(f.t==="shblock")f.r+=dt*Math.min(BW,BH)*0.10;
    if(f.t==="sysbreak")f.r+=dt*Math.min(BW,BH)*0.16;
    f.a-=dt*(f.t==="shblock"?2.6:f.t==="impact"?2.4:f.t==="boom"?1.6:f.t==="blast"?1.1:f.t==="shbreak"?2.2:f.t==="shshatter"?1.8:f.t==="inc"?1.9:f.t==="split"?2.4:5);
    if(f.t==="impact")f.r+=dt*Math.min(BW,BH)*0.30;
    if(f.t==="boom")f.r+=dt*Math.min(BW,BH)*0.16;
    if(f.t==="blast")f.r+=dt*Math.min(BW,BH)*0.55;
    if(f.t==="shbreak")f.r+=dt*Math.min(BW,BH)*0.22;
    if(f.t==="shshatter")f.r+=dt*Math.min(BW,BH)*0.22;
  }
  BT.fx=BT.fx.filter(f=>f.a>0);
  for(const nn of BT.num){ nn.y-=dt*38*devicePixelRatio; nn.a-=dt*1.2 }
  BT.num=BT.num.filter(nn=>nn.a>0);
}
function bUpdateLive(dt){
  BT.el+=dt;
  BT.tap=Math.max(0,BT.tap-dt);
  BT.cd.f=Math.max(0,BT.cd.f-dt); BT.cd.k=Math.max(0,BT.cd.k-dt);
  BT.buf.f=Math.max(0,BT.buf.f-dt); BT.buf.k=Math.max(0,BT.buf.k-dt);
  const live=BT.en.filter(e=>e.alive);
  // auto fire at the weakest live enemy
  if(live.length){
    let tg=0,bh=1e99;
    for(let i=0;i<BT.en.length;i++){ const e=BT.en[i]; if(e.alive&&e.hp<bh){bh=e.hp;tg=i} }
    const d=BT.dps*dt*(BT.buf.f>0?2.5:1);
    hitEnemy(tg,d,0);
    BT.sh=(BT.sh||0)+dt;
    if(BT.sh>0.12){ BT.sh=0; const e=BT.en[tg];
      if(e.alive)BT.fx.push({t:"auto",x:e.x*BW,y:e.y*BH,a:1}); }
    // incoming
    let inc=0; for(const e of live)inc+=e.dps;
    BT.hp-=inc*dt*(BT.buf.k>0?0.35:1);
    BT.ish=(BT.ish||0)+dt;
    if(BT.ish>0.42){ BT.ish=0; const e=pick(live);
      BT.fx.push({t:"inc",x:e.x*BW,y:e.y*BH,a:1}); }
  }
  // combo decays if you stop landing hits
  BT.cmbT+=dt;
  if(BT.cmb>0&&BT.cmbT>2.4){ BT.cmb=0 }
  // archetype behaviour
  for(const e of BT.en){ if(!e.alive)continue;
    const K=EK[e.k]||EK.grunt;
    e.wa+=dt*e.ws;                                   /* the weak point keeps moving */
    if(K.regen&&e.shp<=0){ e.rg+=dt;                 /* the flagship rebuilds its screen */
      if(e.rg>=K.regen){ e.shp=e.shm; e.rg=0;
        BT.fx.push({t:"shup",x:e.x*BW,y:e.y*BH,a:1}); blip(420,.2,"sine",.05) } }
    if(K.heal){                                      /* menders patch up everything else */
      for(const o of BT.en){ if(o===e||!o.alive)continue;
        o.hp=Math.min(o.max,o.hp+o.max*K.heal*dt) }
    }
    if(K.fuse){                                      /* chargers detonate on the fleet */
      e.fz-=dt;
      if(e.fz<=0){
        BT.hp-=BT.hpm*K.blast*(BT.buf.k>0?0.35:1);
        BT.fx.push({t:"blast",x:e.x*BW,y:e.y*BH,a:1,r:0});
        e.alive=0; BT.kills++; sfx("foeDead");
      }
    }
  }
  // motion
  for(const e of BT.en){ if(!e.alive)continue;
    e.px+=dt*e.sp*0.9; e.py+=dt*e.sp*1.3;
    e.x+=Math.sin(e.px)*dt*0.028*(e.sp>1.5?2.2:1); e.y+=Math.cos(e.py)*dt*0.020*(e.sp>1.5?2.2:1);
    e.x=Math.max(.09,Math.min(.91,e.x)); e.y=Math.max(.13,Math.min(.56,e.y));
  }
  for(const f of BT.fx){
    f.a-=dt*(f.t==="boom"?1.6:f.t==="blast"?1.1:f.t==="shbreak"?2.2:f.t==="shshatter"?1.8:f.t==="inc"?1.9:f.t==="split"?2.4:5);
    if(f.t==="boom")f.r+=dt*Math.min(BW,BH)*0.16;
    if(f.t==="blast")f.r+=dt*Math.min(BW,BH)*0.55;
    if(f.t==="shbreak")f.r+=dt*Math.min(BW,BH)*0.22;
    if(f.t==="shshatter")f.r+=dt*Math.min(BW,BH)*0.22;
  }
  BT.fx=BT.fx.filter(f=>f.a>0);
  for(const n of BT.num){ n.y-=dt*38*devicePixelRatio; n.a-=dt*1.2 }
  BT.num=BT.num.filter(n=>n.a>0);
  if(!live.length)queueWin(dt);
  else if(BT.hp<=0)endBattle("lost");
  else if(BT.el>BT.cap)endBattle("timeout");
}
/* the last enemy dying doesn't cut straight to the result card - fx keep animating
   and nothing hostile is left to fire, so a short pause reads as a beat, not a freeze */
function queueWin(dt){
  if(!BT||BT.done)return;
  if(BT.winT===undefined)BT.winT=0.8;
  BT.winT-=dt;
  if(BT.winT<=0)endBattle("win");
}
function endBattle(how){
  if(BT.done)return; BT.done=1;
  if(BT.t && BT.t.final)return endFinalBattle(how);   /* patch590: no raid/assault reward or claim logic applies */
  const t=BT.t, T=BT.T, frac=BT.kills/BT.tot, f=BT.f;
  const full=raidReward(t);
  let o=0,c=0,m=0,lost=[0,0,0];
  let sv=0;
  if(how==="win"){ o=full.o; c=full.c; m=full.m; S.wins=(S.wins||0)+1; xpOnWins();
    if(S.wins===1)queueNotice("vega:firstWin");
    sv=svReward(t);
    if(T.boss)S.flags=(S.flags||0)+1;
    if(BT.hp>=BT.hpm*0.999)S.flawless=1;
    if(BT.auto){ o*=AUTO_YIELD; c*=AUTO_YIELD; m*=AUTO_YIELD; sv=Math.floor(sv*AUTO_YIELD); S.flawless=0; } }
  else if(how==="lost"){
    for(let i=0;i<3;i++){ if(f.sh[i]>0)lost[i]=Math.max(1,Math.ceil(f.sh[i]*0.25)); f.sh[i]-=lost[i]; }
    S.losses=(S.losses||0)+1; f.hp=0.35;
    o=full.o*frac*0.35; c=full.c*frac*0.35; sv=Math.floor(svReward(t)*frac*0.3);
  } else { o=full.o*frac*0.6; c=full.c*frac*0.6; if(full.m&&frac>=1)m=full.m;
    sv=Math.floor(svReward(t)*frac*0.6); }
  if(how!=="lost")f.hp=Math.max(0.05,BT.hp/BT.hpm);
  if(how==="win"&&BT.auto&&!(BT.cine&&BT.cine.charged))f.hp=Math.max(0.05,f.hp-AUTO_FHP_COST);   /* patch633: the clip already took this off BT.hp (BT.cine.charged) - f.hp=max(0.05,BT.hp/BT.hpm) just above already carries it into f.hp, so this flat subtraction would otherwise double-charge it */
  S.ore+=o; S.all+=o; S.cry+=c; if(m){S.dm+=m;S.dmAll+=m}
  if(sv>0){ S.sv=(S.sv||0)+sv; S.svAll=(S.svAll||0)+sv }
  if(BT.best>(S.bestCmb||0))S.bestCmb=BT.best;
  S.plunder=(S.plunder||0)+o;
  if(BT.idx>=0) S.tg.splice(BT.idx,1);
  /* an assault that succeeds drives the garrison off; the system is then bought
     at its ordinary price, so the fight gates it and the cost still bites */
  if(how==="win" && BT.t && BT.t.sysId){
    const sid=BT.t.sysId;
    if(S.occ&&S.occ[sid]){
      /* STAGE 2: retaking occupied ground. S.sys[sid] was never touched while it sat
         occupied, so clearing the mark (and its weakened-garrison timestamp) IS the
         whole "restore" - production resumes on the very next render, instantly,
         because sysHeld()/heldSystems() simply start counting it again. No re-claim,
         no S.taken - this was always yours. */
      delete S.occ[sid];
      if(S.occAt)delete S.occAt[sid];
      /* still provokes, at half strength - reclaiming your own ground is a smaller
         insult than a fresh conquest, but not nothing */
      if(BT.t.rival)rvProvoke(BT.t.rival, (RVBEH[BT.t.rival]||{assault:0}).assault*0.5);
      const sy=SYSMAP[sid];
      if(sy)toast(sy.n+" retaken \u2014 production restored","g");
    } else {
      if(!S.taken||typeof S.taken!=="object")S.taken={};
      S.taken[sid]=1;
      grantXp("aw:"+sid, XPV.assault[SYSMAP[sid].ring]||0, "Drove the garrison off "+SYSMAP[sid].n);
      if(S.lost)delete S.lost[sid];      /* won it back */
      /* this is the provocation. Everything else is background irritation. */
      if(BT.t.rival)rvProvoke(BT.t.rival, (RVBEH[BT.t.rival]||{assault:0}).assault);
      const sy=SYSMAP[sid];
      if(sy)toast(sy.n+" is open \u2014 claim it on the map","y");
    }
  }
  const ttl = how==="win"?(BT.auto?"Auto-Resolved":"Victory"):how==="lost"?"Fleet Broken":"Withdrew";
  const col = how==="win"?"var(--gr)":how==="lost"?"var(--rd)":"var(--gd)";
  const sub = how==="win"?(BT.auto?"The fleet outclassed them - resolved without a fight you needed to play.":"All hostiles destroyed."):
              how==="lost"?"Your line collapsed. Survivors limped home.":
              "You pulled out with what you could carry.";
  let rows=`<div class="rline"><span>Hostiles destroyed</span><b>${BT.kills} / ${BT.tot}</b></div>`;
  if(o>0)rows+=`<div class="rline"><span>Ore salvaged</span><b>${fmt(o)} ${RI('ore')}</b></div>`;
  if(c>0)rows+=`<div class="rline"><span>Crystal recovered</span><b>${fmt(c)} ${RI('cry')}</b></div>`;
  if(m>0)rows+=`<div class="rline"><span>Dark Matter</span><b>${fmt(m)} ${RI('dm')}</b></div>`;
  if(sv>0)rows+=`<div class="rline"><span>Salvage stripped</span><b style="color:var(--sv)">${fmt(sv)} ${RI('sv')}</b></div>`;
  if(BT.taps>0)rows+=`<div class="rline"><span>Best chain \u00b7 crits</span><b>${BT.best}\u00d7 \u00b7 ${BT.crits}</b></div>`;
  const anyLost=lost.reduce((a,b)=>a+b,0);
  if(anyLost)rows+=`<div class="rline"><span style="color:var(--rd)">Ships lost</span><b style="color:var(--rd)">${
    lost.map((n,i)=>n?n+"× "+SHIPS[i].n:null).filter(Boolean).join(", ")}</b></div>`;
  rows+=`<div class="rline"><span>Fleet integrity</span><b>${Math.round(f.hp*100)}%</b></div>`;
  $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:${col}">${ttl}</h3>
    <div class="rsub">${sub}</div>${rows}
    <button id="bDone">RETURN TO EMPIRE</button></div>`;
  $("#bRes").classList.add("on");
  $("#bDone").onclick=closeBattle;
  sfx(how==="win"?"win":"loss");
  dirty=true;
}
/* PLAN-fleets run 1, decision 8: the final battle takes every fleet - it is the one
   fight that ignores position, all fleets recalled to the Core on engage. Fought
   with a TEMPORARY merged fleet (never itself pushed into S.fl); mergeFleetsForFinal()
   builds it, unmergeAfterFinal() (called from endFinalBattle(), below) writes the
   result back: integrity uniformly (the merged fleet fought as one, so it comes home
   as one number) and any hull losses split proportionally, per class, off however
   much of that class each real fleet actually contributed. */
function mergeFleetsForFinal(){
  const src=fleets();
  const sh=[0,0,0];
  for(const fl of src)for(let i=0;i<3;i++)sh[i]+=fl.sh[i]||0;
  const hp=src.length?Math.min(...src.map(fl=>Math.max(0,Math.min(1,fl.hp||0)))):1;
  return { id:0, n:"Combined Fleet", sh, hp, at:"home", to:null, eta:0,
    _final:{ sh0:sh.slice(), src:src.map(fl=>({id:fl.id, sh:fl.sh.slice()})) } };
}
function unmergeAfterFinal(mf){
  const rec=mf&&mf._final; if(!rec)return;
  for(let i=0;i<3;i++){
    const before=rec.sh0[i];
    const lost=Math.max(0,before-(mf.sh[i]||0));
    let assigned=0;
    for(let k=0;k<rec.src.length;k++){
      const s=rec.src[k], fl=fleet(s.id); if(!fl)continue;
      const isLast=k===rec.src.length-1;
      let take = isLast ? Math.max(0,lost-assigned)
                         : (before>0?Math.round(lost*(s.sh[i]/before)):0);
      if(!isLast)assigned+=take;
      take=Math.min(take, fl.sh[i]||0);
      fl.sh[i]=(fl.sh[i]||0)-take;
    }
  }
  const hp=Math.max(0.05,Math.min(1,mf.hp));
  for(const fl of fleets())fl.hp=hp;
}
/* patch590: the final battle's own result branch - a scripted, one-off fight has no
   loot and does not touch S.tg/S.taken/S.occ, so it never runs through the ordinary
   raid/assault reward or claim logic above (per the code map: "give it its own
   result branch"). how is "lost" (hull 0 or FINAL_CAP - both read the same, per the
   plan) or "finalwin" (the withdraw beat finished). */
function endFinalBattle(how){
  const mf=BT.f;
  if(how==="lost"){
    for(let i=0;i<3;i++){ if(mf.sh[i]>0){ const l=Math.max(1,Math.ceil(mf.sh[i]*0.25)); mf.sh[i]-=l } }
    S.losses=(S.losses||0)+1; mf.hp=0.35;
    unmergeAfterFinal(mf);
    $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--rd)">${STORY.battleLossT}</h3>
      <div class="rsub">${STORY.battleLoss}</div>
      <div class="rline"><span>Hostiles destroyed</span><b>${BT.kills} / ${BT.tot}</b></div>
      <div class="rline"><span>Fleet integrity</span><b>${Math.round(mf.hp*100)}%</b></div>
      <button id="bDone">RETURN TO EMPIRE</button></div>`;
    $("#bRes").classList.add("on"); $("#bDone").onclick=closeBattle;
    sfx("loss"); dirty=true; save();
    return;
  }
  /* how==="finalwin" - S.end stays 1 until finaleWon() runs, so every seized
     Nexus/advisor/rival surface (patch589) stays exactly as it was through this
     card; only tapping the one button below moves S.end to 2. */
  mf.hp=Math.max(0.05,BT.hp/BT.hpm);
  unmergeAfterFinal(mf);
  $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--gr)">${STORY.battleWinT}</h3>
    <div class="rsub">${STORY.battleWin}</div>
    <button id="bFinaleDone">CONTINUE</button></div>`;
  $("#bRes").classList.add("on");
  $("#bFinaleDone").onclick=()=>{ finaleWon(); closeBattle(); };
  sfx("win"); dirty=true; save();
}
/* ---------------- peace (patch592) ----------------
   Owner decision 5: once the game is won, every rival-held system becomes an
   ordinary ore claim so free play can still finish the map. GARRISON (the table
   itself) is never mutated or deleted - only the SYS objects' own s.owner/s.def/
   s.arch (set from it once, in the loop right after GARRISON's own definition,
   ~line 2344) are cleared here and restored from that SAME table by revertPeace()
   (patch593's RESET ENDING), so peace is fully reversible for testing without
   ever touching GARRISON's own data. sysOwner()/sysContested()/canAssault()/
   sysOpen() all read s.owner (or its S.occ/S.lost/S.taken overlays) directly, so
   clearing it here is the one change every one of them - and the Map/Empire UI
   built on them - needs to agree a former GARRISON system is now open ground.
   drawTerritory() also reads s.owner directly (SYS.filter(s=>s.owner===rv.id)),
   so rival territory drawing stops here too, for free - no separate check needed
   there. Applied both at the win (finaleWon()) and on every boot at S.end===2
   (adopt(), above) - the GARRISON loop reruns at every fresh page parse
   regardless of S.end, so a real reload needs this to run again once the save
   (and S.end) is actually known. Deliberately leaves S.taken alone (a beaten
   GARRISON system already reads as an ordinary claim via sysOwner()'s own taken
   check, peace or not) and does not attempt to resurrect S.lost's rival-expansion
   history on revertPeace() - only GARRISON ownership is asked to be reversible,
   per the plan's own wording. */
function applyPeace(){
  for(const s of SYS){ if(GARRISON[s.id]){ delete s.owner; delete s.def; delete s.arch } }
  S.lost={};
  S.occ={}; S.occAt={};
  S.thq=[];
  lfClear();
}
function revertPeace(){
  for(const s of SYS){ const g=GARRISON[s.id]; if(g){ s.owner=g.o; s.def=g.def; s.arch=g.arch } }
}
/* ---------------- the ending (patch592) ----------------
   Its own overlay (#endScene) rather than reusing #scene/playScene() outright -
   every stage here is a different SHAPE of content (a title, a stat block, a
   glowing text strip, dim narration, a CONTINUE button), not one more line of
   dialogue - but it reuses the exact overlay/fade CSS (.scene) and the game's
   own stat-row look (.wipebox/.wr, restartDialog()'s pattern, ~line 10034)
   rather than inventing new visual language. Tap anywhere advances; SKIP
   (top-right, same placement/behaviour as the intro/turn scene) jumps straight
   to the final CONTINUE stage - "SKIP jumps to CONTINUE", per the plan. Freely
   re-openable (the pjx COMPLETE card below, or patch593's SHOW ENDING dev
   button) since it only ever READS S - nothing here is a one-shot effect, so
   reopening it can never replay or re-grant anything. */
/* patch593b: 5 stages, not 6 - the final one shows STORY.endTbc AND the CONTINUE
   button together (endStageHTML(4) still returns endTbc; endRender()'s own
   `last = endStage>=END_STAGES-1` needs no separate change), not endTbc alone
   for one tap and then a bare button against empty space. */
const END_STAGES=5, END_STRIP_BEAT_MS=1800;   /* TUNING-PENDING - the glow strip's own pause */
let endOn=false, endStage=0, endTimer=null;
/* time played: S.t0 is a real start timestamp on every save written after this
   patch (fresh()) and null on an old one adopt() could not vouch for (see the
   adopt() sanitizer above) - shown as an em-dash rather than guessing. Systems
   held mirrors devInfo()'s own "X/Y" expression (SYS.length-1 - every non-home
   system) so the two can never quietly disagree. Records: the same
   Object.keys(S.ac).length restartDialog() already shows - a bare count, per
   the plan's own wording (not "X of Y", unlike systems held). */
function endStats(){
  return {
    time: S.t0 ? fmtT((Date.now()-S.t0)/1000) : "\u2014",
    lvl: level(),
    held: heldSystems().length, total: SYS.length-1,
    all: fmt(S.all),
    wins: S.wins||0,
    records: Object.keys(S.ac||{}).length
  };
}
function endStageHTML(n){
  if(n===0)return `<div class="endtitle">${STORY.endTitle}</div>`;
  if(n===1){
    const st=endStats();
    return `<div class="wipebox endstats">
      <div class="wr"><span>Time played</span><b>${st.time}</b></div>
      <div class="wr"><span>Level</span><b>${st.lvl}</b></div>
      <div class="wr"><span>Systems held</span><b>${st.held}/${st.total}</b></div>
      <div class="wr"><span>All-time ore</span><b>${st.all} ${RI('ore')}</b></div>
      <div class="wr"><span>Raid wins</span><b>${st.wins}</b></div>
      <div class="wr"><span>Records</span><b>${st.records}</b></div>
    </div>`;
  }
  if(n===2)return `<div class="endstrip">${STORY.endStrip}</div>`;
  if(n===3)return `<div class="endlast">${STORY.endLast}</div>`;
  if(n===4)return `<div class="endtbc">${STORY.endTbc}</div>`;
  return "";
}
/* the strip (stage 2) also auto-advances after a short beat, per the plan
   ("with a slow glow ... after a beat STORY.endLast") - a tap still works too
   (endAdvance() always clears the pending timer first), so nobody is stuck
   waiting on mobile if they'd rather just tap through. */
function endRender(){
  const body=$("#endBody"); if(body)body.innerHTML=endStageHTML(endStage);
  const last=endStage>=END_STAGES-1;
  const hint=$("#endHint"); if(hint)hint.hidden=last;
  const skip=$("#endSkip"); if(skip)skip.hidden=last;
  const btn=$("#endContinue"); if(btn)btn.hidden=!last;
  if(endTimer){ clearTimeout(endTimer); endTimer=null }
  if(endStage===2)endTimer=setTimeout(endAdvance,END_STRIP_BEAT_MS);
}
function endAdvance(){
  if(!endOn)return;
  if(endTimer){ clearTimeout(endTimer); endTimer=null }
  if(endStage>=END_STAGES-1)return;
  endStage++; endRender();
}
function endSkip(){ if(!endOn)return; endStage=END_STAGES-1; endRender(); }
function endClose(){
  if(!endOn)return;
  endOn=false;
  if(endTimer){ clearTimeout(endTimer); endTimer=null }
  const el=$("#endScene"); if(!el)return;
  el.classList.add("closing"); el.onclick=null; el.style.pointerEvents="none";
  let done=false;
  const finish=()=>{ if(done)return; done=true;
    el.classList.remove("on","closing"); el.innerHTML=""; el.style.pointerEvents="" };
  el.addEventListener("transitionend",finish,{once:true});
  setTimeout(finish,400);
}
function showEnding(){
  const el=$("#endScene"); if(!el)return;
  endOn=true; endStage=0;
  el.innerHTML='<button id="endSkip" class="sceneskip">SKIP</button>'+
    '<div class="scenewrap"><div id="endBody" class="endbody"></div>'+
    '<div id="endHint" class="scenehint">TAP TO CONTINUE</div>'+
    '<button id="endContinue" class="endcontinue" hidden>CONTINUE</button></div>';
  el.classList.remove("closing"); el.classList.add("on");
  $("#endSkip").onclick=e=>{ e.stopPropagation(); endSkip(); };
  $("#endContinue").onclick=e=>{ e.stopPropagation(); endClose(); };
  el.onclick=()=>endAdvance();
  endRender();
}
/* patch590/592: the win branch of endFinalBattle()'s own result card calls this
   (via #bFinaleDone) - now the real thing: peace, then the ending screen. */
function finaleWon(){
  S.end=2;
  applyPeace();
  dirty=true; save();
  showEnding();
}
function closeBattle(){ BT=null; $("#battle").classList.remove("on"); dirty=true; render(); save(); }

function bDraw(){
  if(!BT)return;
  if(bx===null){ bResize(); if(bx)bStars(); }
  if(!bx||!BW)return;
  const D=devicePixelRatio;
  // backdrop (baked once per engagement/resize)
  if(!bBG)bBake();
  bx.drawImage(bBG,0,0,BW,BH);
  for(const st of BT.stars){
    st.y+=st.z*22*D*0.016; if(st.y>BH)st.y=-2;
    bx.globalAlpha=.25+.6*st.z; bx.fillStyle=st.z>.7?"#cfe4ff":"#7d96d8";
    bx.fillRect(st.x,st.y,st.r*D,st.r*D*2.2);
  }
  bx.globalAlpha=1;
  const fy=playerY(), R=Math.min(BW,BH)*0.034;

  // incoming tracers
  for(const f of BT.fx){ if(f.t!=="inc")continue;
    bx.globalAlpha=Math.max(0,f.a)*.9; bx.strokeStyle="#ff6b8a"; bx.lineWidth=2*D;
    const t=1-f.a, x=f.x+(BW*0.5-f.x)*t, y=f.y+(fy-f.y)*t;
    bx.beginPath(); bx.moveTo(x,y); bx.lineTo(x-(BW*0.5-f.x)*0.05,y-(fy-f.y)*0.05); bx.stroke();
  }
  bx.globalAlpha=1;

  // player fleet
  const n=Math.min(13,Math.max(1,fleetCount(BT.f))), fr=Math.min(BW,BH)*0.017;
  for(let i=0;i<n;i++){
    const fx=BW*(0.5+((i-(n-1)/2)*0.058)), bob=Math.sin(BT.el*2+i)*fr*0.25;
    bx.save(); bx.translate(fx,fy+bob);
    bx.shadowColor="#48e2ff"; bx.shadowBlur=10*D;
    bx.fillStyle="#9fe6ff";
    bx.beginPath(); bx.moveTo(0,-fr*1.5); bx.lineTo(fr,fr*.9); bx.lineTo(0,fr*.35); bx.lineTo(-fr,fr*.9);
    bx.closePath(); bx.fill(); bx.shadowBlur=0;
    bx.fillStyle="rgba(120,220,255,.5)";
    bx.fillRect(-fr*.22,fr*.9,fr*.44,fr*(.5+.4*Math.abs(Math.sin(BT.el*9+i))));
    bx.restore();
  }

  // allies (patch591): a small row of player-shape ships in each rival's own
  // colour, just above the player fleet - see allyRowX/allyRowY (shared with the
  // ally-fire tracer below), never overlapping the bottom HUD overlay at any width.
  if(BT.t&&BT.t.final&&BT.allies&&BT.allies.length){
    /* patch591c: fr (player-ship size), not ar=fr*0.62 - see allyRowX/Y above. */
    const an=BT.allies.length, ay=allyRowY();
    for(let i=0;i<an;i++){
      const a=BT.allies[i], ax=allyRowX(i,an), bob=Math.sin(BT.el*2+i*1.7)*fr*0.2;
      bx.save(); bx.translate(ax,ay+bob);
      bx.shadowColor=a.col; bx.shadowBlur=8*D;
      bx.fillStyle=a.col;
      bx.beginPath(); bx.moveTo(0,-fr*1.5); bx.lineTo(fr,fr*.9); bx.lineTo(0,fr*.35); bx.lineTo(-fr,fr*.9);
      bx.closePath(); bx.fill(); bx.shadowBlur=0;
      bx.restore();
    }
  }

  // mender tethers, drawn under everything so they read as support beams
  for(const e of BT.en){ if(!e.alive||!(EK[e.k]&&EK[e.k].heal))continue;
    for(const o of BT.en){ if(o===e||!o.alive)continue;
      bx.globalAlpha=.20+.12*Math.sin(BT.el*4); bx.strokeStyle="#5ce6a5"; bx.lineWidth=1.6*D;
      bx.beginPath(); bx.moveTo(e.x*BW,e.y*BH); bx.lineTo(o.x*BW,o.y*BH); bx.stroke(); }
  }
  bx.globalAlpha=1;

  // enemies
  const critArc=0.62+rfl("crt")*0.085;
  for(let i=0;i<BT.en.length;i++){ const e=BT.en[i]; if(!e.alive)continue;
    const K=EK[e.k]||EK.grunt, rr=e.rr||1, ER=R*rr;
    const x=e.x*BW, y=e.y*BH;
    /* patch591c: VEGA's fleet draws in one consistent red regardless of mix kind -
       the shape below was already the player's own hull, flipped (BT.t.final skips
       every per-kind branch, boss included - "same shape, boss larger" was already
       true via e.rr); only the colour was still leaking the ordinary per-kind EK
       palette (green/yellow/red), which read as "the usual enemy glyphs" instead of
       a mirror of your own fleet. */
    const col=(BT.t&&BT.t.final)?"#ff4d5e":K.boss?"#ff5f6d":e.k==="swift"?"#ffd166":e.k==="heal"?"#5ce6a5":
              e.k==="bomber"?"#ff9a6b":e.k==="split"?"#b07cff":BT.T.col;
    bx.save(); bx.translate(x,y); bx.rotate(Math.sin(e.px)*0.18);
    bx.shadowColor=col; bx.shadowBlur=12*D;
    bx.fillStyle=col;
    bx.beginPath();
    if(BT.t&&BT.t.final){                           /* patch590: VEGA's fleet mirrors your own hull */
      bx.moveTo(0,ER*1.5); bx.lineTo(ER,-ER*.9); bx.lineTo(0,-ER*.35); bx.lineTo(-ER,-ER*.9);
    } else if(e.k==="swift"){                              /* needle */
      bx.moveTo(0,ER*1.15); bx.lineTo(ER*.42,-ER*.25); bx.lineTo(0,-ER*.95);
      bx.lineTo(-ER*.42,-ER*.25);
    } else if(e.k==="warden"){                      /* Fortress: blunt, wide, armoured plate */
      bx.moveTo(-ER*.62,ER*.82); bx.lineTo(ER*.62,ER*.82); bx.lineTo(ER*.98,ER*.05);
      bx.lineTo(ER*.66,-ER*.78); bx.lineTo(-ER*.66,-ER*.78); bx.lineTo(-ER*.98,ER*.05);
    } else if(e.k==="phantom"){                     /* Ghost: slim fuselage, swept-back wings */
      bx.moveTo(0,ER*1.25); bx.lineTo(ER*.16,-ER*.1); bx.lineTo(ER*.9,-ER*.6);
      bx.lineTo(0,-ER*.3); bx.lineTo(-ER*.9,-ER*.6); bx.lineTo(-ER*.16,-ER*.1);
    } else if(e.k==="impaler"){                     /* Lance: long hull, one spike down the spine */
      bx.moveTo(0,ER*1.6); bx.lineTo(ER*.08,ER*.7); bx.lineTo(ER*.5,ER*.15);
      bx.lineTo(ER*.3,-ER*.5); bx.lineTo(ER*.12,-ER*.95); bx.lineTo(-ER*.12,-ER*.95);
      bx.lineTo(-ER*.3,-ER*.5); bx.lineTo(-ER*.5,ER*.15); bx.lineTo(-ER*.08,ER*.7);
    } else if(K.boss){                              /* slab-sided command hull */
      bx.moveTo(0,ER*.95); bx.lineTo(ER*.62,ER*.30); bx.lineTo(ER*1.0,-ER*.30);
      bx.lineTo(ER*.42,-ER*.42); bx.lineTo(0,-ER*.92); bx.lineTo(-ER*.42,-ER*.42);
      bx.lineTo(-ER*1.0,-ER*.30); bx.lineTo(-ER*.62,ER*.30);
    } else {
      bx.moveTo(0,ER); bx.lineTo(ER*.55,ER*.1); bx.lineTo(ER*1.05,-ER*.5);
      bx.lineTo(ER*.35,-ER*.42); bx.lineTo(0,-ER*.78); bx.lineTo(-ER*.35,-ER*.42);
      bx.lineTo(-ER*1.05,-ER*.5); bx.lineTo(-ER*.55,ER*.1);
    }
    bx.closePath(); bx.fill(); bx.shadowBlur=0;
    bx.fillStyle="rgba(4,6,16,.85)";
    bx.beginPath(); bx.ellipse(0,ER*.05,ER*.22,ER*.34,0,0,6.2832); bx.fill();
    if(K.fuse){                                     /* charger core brightens as it winds up */
      const w=1-Math.max(0,e.fz)/e.fzm;
      bx.fillStyle="rgba(255,120,90,"+(0.35+0.65*w)+")";
      bx.beginPath(); bx.arc(0,0,ER*(.22+.30*w),0,6.2832); bx.fill();
    }
    bx.restore();

    const p=Math.max(0,e.hp/e.max), RR=ER*1.5;
    bx.strokeStyle="rgba(255,255,255,.13)"; bx.lineWidth=3.2*D;
    bx.beginPath(); bx.arc(x,y,RR,0,6.2832); bx.stroke();
    bx.strokeStyle=p>.5?"#5ce6a5":p>.22?"#ffd166":"#ff6b8a"; bx.lineWidth=3.2*D;
    bx.beginPath(); bx.arc(x,y,RR,-1.5708,-1.5708+6.2832*p); bx.stroke();

    // weak point: the seam worth aiming at
    if(e.shp<=0){
      bx.strokeStyle="#fff"; bx.lineWidth=4.6*D; bx.globalAlpha=.28;
      bx.beginPath(); bx.arc(x,y,RR,e.wa-critArc,e.wa+critArc); bx.stroke();
      bx.strokeStyle="#ffd166"; bx.lineWidth=2.6*D;
      bx.globalAlpha=.75+.25*Math.sin(BT.el*7);
      bx.beginPath(); bx.arc(x,y,RR,e.wa-critArc,e.wa+critArc); bx.stroke();
      bx.globalAlpha=1;
    }

    // shield screen
    if(e.shp>0){
      const sp=e.shp/e.shm, SR=ER*1.95;
      bx.strokeStyle="rgba(120,200,255,"+(0.30+0.5*sp)+")"; bx.lineWidth=2.4*D;
      bx.beginPath();
      for(let q=0;q<6;q++){ const a=q*1.0472+BT.el*0.4;
        const px=x+Math.cos(a)*SR, py=y+Math.sin(a)*SR; q?bx.lineTo(px,py):bx.moveTo(px,py) }
      bx.closePath(); bx.stroke();
      bx.fillStyle="rgba(120,200,255,"+(0.05+0.07*sp)+")"; bx.fill();
    }

    // their systems, and which one you are aimed at
    if(BT.mode==="wep"&&e.sys&&e.alive){
      const nsy=e.sys.length, sw=13*D, gap=3*D;
      const tot=nsy*sw+(nsy-1)*gap, sx0=x-tot/2;
      for(let q=0;q<nsy;q++){
        const s=e.sys[q], px=sx0+q*(sw+gap);
        const py=y+RR*1.5;
        bx.globalAlpha = s.st>=2?0.30:1;
        bx.fillStyle = s.st>=2?"#555" : s.st===1?"rgba(255,107,138,.35)" : SYS_COL[s.k];
        bx.fillRect(px,py,sw,4.5*D);
        if(s.st===0&&s.d>0){                    /* progress toward breaking it */
          bx.fillStyle="#fff";
          bx.fillRect(px,py,sw*Math.min(1,s.d/(e.max*SYS_HP)),4.5*D);
        }
        if(i===BT.sel&&q===BT.selSys){
          bx.strokeStyle="#fff"; bx.lineWidth=1.6*D;
          bx.strokeRect(px-1.5*D,py-1.5*D,sw+3*D,7.5*D);
        }
        bx.globalAlpha=1;
      }
      /* their screens, drawn like yours */
      if(e.shd>0){
        bx.strokeStyle="rgba(127,216,255,.55)"; bx.lineWidth=2*D;
        bx.beginPath(); bx.arc(x,y,RR*1.9,0,6.2832); bx.stroke();
        bx.fillStyle="rgba(127,216,255,.85)";
        bx.font="700 "+(9*D)+"px ui-monospace,monospace"; bx.textAlign="center";
        bx.fillText(e.shd+"", x+RR*1.9, y-RR*1.6); bx.textAlign="left";
      }
    }
    // who your guns are pointed at
    if(BT.mode==="wep"&&i===BT.sel&&e.alive){
      bx.strokeStyle="#ffd166"; bx.lineWidth=2.2*D; bx.globalAlpha=.9;
      const q=RR*1.5, c=RR*0.6;
      for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
        bx.beginPath();
        bx.moveTo(x+sx*q, y+sy*q-sy*c); bx.lineTo(x+sx*q, y+sy*q);
        bx.lineTo(x+sx*q-sx*c, y+sy*q); bx.stroke();
      }
      bx.globalAlpha=1;
      if(BT.selSys>=0&&e.sys&&e.sys[BT.selSys]){
        const s=e.sys[BT.selSys];
        bx.fillStyle="#ffd166"; bx.font="800 "+(9.5*D)+"px system-ui";
        bx.textAlign="center";
        bx.fillText("\u25b8 "+SYS_N[s.k], x, y-RR*1.9); bx.textAlign="left";
      }
    }
    // telegraph: what this hostile does when you resolve
    if(BT.mode==="turn"&&e.tel){
      const T=TEL[e.tel.k]||TEL.strike;
      const label=e.tel.k==="charge" ? "CHARGING "+e.tel.n : T.n;
      bx.font="800 "+(9.5*D)+"px system-ui"; bx.textAlign="center";
      const tw=bx.measureText(label).width, ty=y-RR*1.55;
      bx.fillStyle="rgba(4,6,16,.78)";
      bx.fillRect(x-tw/2-5*D, ty-9*D, tw+10*D, 13*D);
      bx.fillStyle=T.col; bx.fillText(label,x,ty);
      /* the odds are part of the decision, so they belong on the board */
      const ev=evadeOf(e);
      if(ev>=0.08){
        bx.font="700 "+(8.5*D)+"px ui-monospace,monospace";
        bx.fillStyle="rgba(200,215,255,.62)";
        bx.fillText("EVA "+Math.round(ev*100)+"%", x, ty-11*D);
        bx.font="800 "+(9.5*D)+"px system-ui";
      }
      // assigned volley pips sit under the hull so the board reads top to bottom
      const vp=volOn(i);
      if(vp>0){
        bx.fillStyle="#ffd166";
        for(let q=0;q<vp;q++){
          bx.beginPath();
          bx.arc(x-(vp-1)*4*D+q*8*D, y+RR*1.45, 2.6*D, 0, 6.2832); bx.fill();
        }
      }
      bx.textAlign="left";
    }
    // charger countdown
    if(K.fuse&&BT.mode==="wep"&&e.wcd>0){
      const f=Math.max(0,Math.min(1,e.wcd/(K.fuseS||FUSE_S)));
      bx.strokeStyle="#ff9a6b"; bx.lineWidth=3*D;
      bx.beginPath(); bx.arc(x,y,RR*1.28,-1.5708,-1.5708+6.2832*(1-f)); bx.stroke();
      bx.fillStyle="#ff9a6b"; bx.font="700 "+(10*D)+"px ui-monospace,monospace";
      bx.textAlign="center"; bx.fillText(Math.ceil(e.wcd)+"s",x,y-RR*1.6);
      bx.textAlign="left";
    }
    if(K.fuse&&e.fz>0&&BT.mode==="live"){
      const f=e.fz/e.fzm;
      bx.strokeStyle="#ff6b8a"; bx.lineWidth=3*D;
      bx.beginPath(); bx.arc(x,y,RR*1.28,-1.5708,-1.5708+6.2832*f); bx.stroke();
      bx.fillStyle="#ff9a6b"; bx.font="700 "+(10*D)+"px ui-monospace,monospace";
      bx.textAlign="center"; bx.fillText(Math.ceil(e.fz)+"s",x,y-RR*1.6);
      bx.textAlign="left";
    }
  }

  // beams / booms / misses
  for(const f of BT.fx){
    bx.globalAlpha=Math.max(0,f.a);
    if(f.t==="boom"){
      bx.strokeStyle=BT.T.col; bx.lineWidth=3.5*D;
      bx.beginPath(); bx.arc(f.x,f.y,f.r,0,6.2832); bx.stroke();
      bx.strokeStyle="#fff"; bx.lineWidth=1.6*D;
      bx.beginPath(); bx.arc(f.x,f.y,f.r*.55,0,6.2832); bx.stroke();
    } else if(f.t==="blast"){
      bx.strokeStyle="#ff6b8a"; bx.lineWidth=5*D;
      bx.beginPath(); bx.arc(f.x,f.y,f.r,0,6.2832); bx.stroke();
      bx.fillStyle="rgba(255,107,138,"+(Math.max(0,f.a)*.18)+")";
      bx.fillRect(0,0,BW,BH);
    } else if(f.t==="shbreak"){
      bx.strokeStyle="#7fd8ff"; bx.lineWidth=3*D;
      bx.beginPath();
      for(let q=0;q<6;q++){ const a=q*1.0472;
        const px=f.x+Math.cos(a)*f.r, py=f.y+Math.sin(a)*f.r; q?bx.lineTo(px,py):bx.moveTo(px,py) }
      bx.closePath(); bx.stroke();
    } else if(f.t==="shshatter"){
      /* the last layer doesn't just fade - it breaks: the hex ring, a flash inside it,
         and 6 shards flying outward from its vertices */
      bx.strokeStyle="#7fd8ff"; bx.lineWidth=3*D;
      bx.beginPath();
      for(let q=0;q<6;q++){ const a=q*1.0472;
        const px=f.x+Math.cos(a)*f.r, py=f.y+Math.sin(a)*f.r; q?bx.lineTo(px,py):bx.moveTo(px,py) }
      bx.closePath(); bx.stroke();
      bx.fillStyle="rgba(127,216,255,"+(Math.max(0,f.a)*.25)+")"; bx.fill();
      bx.strokeStyle="rgba(223,250,255,"+Math.max(0,f.a)+")"; bx.lineWidth=2*D;
      for(let q=0;q<6;q++){ const a=q*1.0472, len=8*D+f.r*0.5;
        const x0=f.x+Math.cos(a)*f.r, y0=f.y+Math.sin(a)*f.r;
        const x1=f.x+Math.cos(a)*(f.r+len), y1=f.y+Math.sin(a)*(f.r+len);
        bx.beginPath(); bx.moveTo(x0,y0); bx.lineTo(x1,y1); bx.stroke();
      }
    } else if(f.t==="shup"){
      bx.strokeStyle="#7fd8ff"; bx.lineWidth=2.4*D;
      bx.beginPath(); bx.arc(f.x,f.y,Math.min(BW,BH)*0.07*(1.6-f.a),0,6.2832); bx.stroke();
    } else if(f.t==="split"){
      bx.strokeStyle="#b07cff"; bx.lineWidth=2.6*D;
      bx.beginPath(); bx.arc(f.x,f.y,Math.min(BW,BH)*0.05*(1.5-f.a),0,6.2832); bx.stroke();
    } else if(f.t==="miss"){
      bx.strokeStyle="rgba(255,255,255,.45)"; bx.lineWidth=2*D;
      bx.beginPath(); bx.arc(f.x,f.y,20*D*(1.4-f.a),0,6.2832); bx.stroke();
      if(f.n){ bx.fillStyle="rgba(255,255,255,.75)";
        bx.font="800 "+(10*D)+"px system-ui"; bx.textAlign="center";
        bx.fillText(f.n>1?("MISS \u00d7"+f.n):"MISS", f.x, f.y-24*D); bx.textAlign="left" }
    } else if(f.t==="shot"){
      if(f.w>0)continue;
      /* a bolt with a trail, so the eye can follow which hostile fired it */
      const px=f.x+(BW*0.5-f.x)*f.p, py=f.y+(f.ty-f.y)*f.p;
      const tx=f.x+(BW*0.5-f.x)*Math.max(0,f.p-0.16), ty2=f.y+(f.ty-f.y)*Math.max(0,f.p-0.16);
      bx.strokeStyle=f.raw?"rgba(255,255,255,.95)":"rgba(255,154,107,.9)";
      bx.lineWidth=(f.raw?4.5:2.6)*D; bx.lineCap="round";
      bx.beginPath(); bx.moveTo(tx,ty2); bx.lineTo(px,py); bx.stroke();
      bx.fillStyle=f.raw?"#fff":"#ff9a6b";
      bx.beginPath(); bx.arc(px,py,(f.raw?4.2:2.6)*D,0,6.2832); bx.fill();
      bx.lineCap="butt";
    } else if(f.t==="shell"){
      const px=f.x+(f.tx-f.x)*f.p, py=f.y+(f.ty-f.y)*f.p;
      const q=Math.max(0,f.p-0.18);
      const tx=f.x+(f.tx-f.x)*q, ty=f.y+(f.ty-f.y)*q;
      bx.strokeStyle=f.c?"#fff1b8":"#ffb45c";
      bx.lineWidth=(f.big?4.5:2.8)*D; bx.lineCap="round";
      bx.beginPath(); bx.moveTo(tx,ty); bx.lineTo(px,py); bx.stroke(); bx.lineCap="butt";
      bx.fillStyle=f.c?"#fff":"#ffd166";
      bx.beginPath(); bx.arc(px,py,(f.big?4.4:3)*D,0,6.2832); bx.fill();
    } else if(f.t==="lance"){
      bx.strokeStyle=f.c?"#dffaff":"#7fd8ff";
      bx.globalAlpha=Math.max(0,f.a)*0.9;
      bx.lineWidth=(f.c?7:5)*D; bx.lineCap="round";
      bx.beginPath(); bx.moveTo(BW*.5,playerY()); bx.lineTo(f.x,f.y); bx.stroke();
      bx.strokeStyle="#fff"; bx.lineWidth=1.6*D;
      bx.beginPath(); bx.moveTo(BW*.5,playerY()); bx.lineTo(f.x,f.y); bx.stroke();
      bx.lineCap="butt";
    } else if(f.t==="sysbreak"){
      bx.strokeStyle=f.c||"#fff"; bx.lineWidth=3*D;
      bx.beginPath(); bx.arc(f.x,f.y,14*D+f.r,0,6.2832); bx.stroke();
    } else if(f.t==="shblock"){
      bx.strokeStyle="rgba(127,216,255,.9)"; bx.lineWidth=3*D;
      bx.beginPath();
      for(let q=0;q<6;q++){ const a=q*1.0472;
        const px=f.x+Math.cos(a)*(26*D+f.r), py=f.y+Math.sin(a)*(26*D+f.r);
        q?bx.lineTo(px,py):bx.moveTo(px,py) }
      bx.closePath(); bx.stroke();
    } else if(f.t==="impact"){
      /* the hit itself: a ring on the fleet, red-white when SHIELDS could not stop it */
      bx.strokeStyle=f.raw?"rgba(255,255,255,.95)":"rgba(255,107,138,.85)";
      bx.lineWidth=(f.raw?4:2.6)*D;
      bx.beginPath(); bx.arc(f.x,f.y,f.r+6*D,0,6.2832); bx.stroke();
      if(f.raw){ bx.fillStyle="rgba(255,180,140,"+(Math.max(0,f.a)*.20)+")";
        bx.fillRect(0,0,BW,BH) }
    } else if(f.t==="beam"||f.t==="auto"){
      const col=f.t==="beam"?(f.c?"#fff1b8":"#ffd166"):"#7fd8ff";
      bx.strokeStyle=col; bx.globalAlpha=Math.max(0,f.a)*(f.t==="beam"?0.95:0.5);
      bx.lineWidth=(f.t==="beam"?(f.c?6.5:4):1.7)*D; bx.lineCap="round";
      bx.beginPath(); bx.moveTo(BW*.5,fy-fr); bx.lineTo(f.x,f.y); bx.stroke(); bx.lineCap="butt";
    } else if(f.t==="allyshot"){          /* patch591: a rival-coloured tracer from the ally row */
      bx.strokeStyle=f.col||"#5ce6a5"; bx.globalAlpha=Math.max(0,f.a)*0.85;
      bx.lineWidth=3*D; bx.lineCap="round";
      bx.beginPath(); bx.moveTo(f.x,f.y); bx.lineTo(f.tx,f.ty); bx.stroke(); bx.lineCap="butt";
    }
  }
  bx.globalAlpha=1;
  for(const nb of BT.num){ bx.globalAlpha=Math.max(0,nb.a);
    /* damage TO you reads hot and sits on your fleet; damage you deal stays gold */
    bx.fillStyle=nb.sy?"#fff":nb.bk?"#7fd8ff":nb.ms?"rgba(200,215,255,.75)"
      :nb.pl?(nb.raw?"#fff":"#ff6b8a"):(nb.c?"#fff1b8":"#ffd166");
    bx.font="700 "+((nb.sy?11:nb.ms||nb.bk?12:nb.pl?(nb.raw?19:15):(nb.c?19:14))*D)+"px ui-monospace,monospace";
    bx.textAlign="center";
    bx.fillText(nb.sy?nb.sy:nb.bk?"BLOCKED":nb.ms?"MISS":((nb.c?"CRIT ":"-")+fmt(nb.v)),nb.x,nb.y); }
  bx.globalAlpha=1;
  // vignette (baked)
  if(bVIG)bx.drawImage(bVIG,0,0,BW,BH);

  // hud
  const live=BT.en.filter(e=>e.alive).length;
  $("#bMeta").textContent = live+" hostile"+(live===1?"":"s")+" · "+
    (BT.mode==="turn" ? (Math.max(0,BT.maxRounds-BT.round+1)+" rounds left")
                      : (Math.max(0,Math.ceil(BT.cap-BT.el))+"s"));
  /* STAGE 1 escalation strip: counts down to the wave while it is still coming,
     flags the moment it lands, then gets out of the way for the rest of the fight. */
  const escEl=$("#bEsc");
  if(escEl){
    /* patch591b: the final battle turns this whole mechanic off (patch590 never
       sets BT.waveDone for it) - the strip must not keep counting down to a
       reinforcement wave that can now never arrive. */
    if(BT.mode!=="wep"||(BT.t&&BT.t.final)){ escEl.classList.remove("on"); }
    else if(!BT.waveDone){
      escEl.classList.add("on"); escEl.classList.remove("hit");
      escEl.textContent="\u26a0 REINFORCEMENTS · "+Math.max(0,Math.ceil(waveTFor(BT.t)-BT.el))+"s";
    } else if(BT.el<waveTFor(BT.t)+2.5){
      escEl.classList.add("on","hit"); escEl.textContent="\u26a0 REINFORCEMENTS ARRIVED";
    } else escEl.classList.remove("on");
  }
  const cb=$("#bCombo");
  if(BT.cmb>=2){ cb.classList.add("on");
    cb.innerHTML=BT.cmb+"\u00d7<small>CHAIN \u00b7 \u00d7"+comboMul().toFixed(2)+" DAMAGE</small>";
    const g=Math.min(1,BT.cmb/20);
    cb.style.color="rgb("+Math.round(255)+","+Math.round(209-60*g)+","+Math.round(102+120*g)+")";
  } else cb.classList.remove("on");
  /* the bar shows hpShown, which waits for the bolts to arrive; the readout shows the
     truth, so the number and the picture agree by the time anyone reads them */
  const hpReal=Math.max(0,BT.hp/BT.hpm);
  const hp=Math.max(0,Math.min(1,(BT.hpShown===undefined?BT.hp:BT.hpShown)/BT.hpm));
  const bar=$(".bhp"); bar.classList.toggle("hurt",hp<=.55&&hp>.25); bar.classList.toggle("crit",hp<=.25);
  $("#bHpF").style.width=(hp*100)+"%";
  $("#bHpT").textContent="HULL "+Math.round((BT.mode==="turn"?hp:hpReal)*100)+"%"
    +(BT.mode==="wep"&&BT.shdMax>0 ? "   \u25c6".repeat(BT.shd)+"\u25c7".repeat(Math.max(0,BT.shdMax-BT.shd)) : "");
  if(BT.mode==="turn")bTurnHud();
  if(BT.mode==="wep"){ bPwrBar(); bWepBar() }
  const fb=$("#abFocus"), kb=$("#abFlak");
  $("#cdFocus").textContent=BT.cd.f>0?Math.ceil(BT.cd.f):"";
  $("#cdFocus").style.display=BT.cd.f>0?"grid":"none";
  $("#cdFlak").textContent=BT.cd.k>0?Math.ceil(BT.cd.k):"";
  $("#cdFlak").style.display=BT.cd.k>0?"grid":"none";
  fb.classList.toggle("rdy",BT.cd.f<=0); fb.classList.toggle("act",BT.buf.f>0);
  kb.classList.toggle("rdy",BT.cd.k<=0); kb.classList.toggle("act",BT.buf.k>0);
}
function bTurnHud(){
  const left=cpLeft(), tot=BT.cp;
  $("#trRound").textContent="ROUND "+BT.round;
  $("#trCp").textContent=left+" / "+tot;
  let pips=""; for(let i=0;i<tot;i++)pips+=`<i class="${i<left?"on":""}"></i>`;
  $("#trPips").innerHTML=pips;
  /* what you will take if you resolve as things stand - the number the allocation
     is answering */
  const FS=forecastSplit(), cut=screenCut(BT.ord.scr);
  const net=FS.shield*(1-cut)+FS.raw, totInc=FS.shield+FS.raw;
  /* the unblockable share is called out on its own: it is the part SHIELDS cannot
     answer, and the whole point of the round */
  $("#trInc").innerHTML = totInc>0
    ? ("INCOMING "+Math.round(net/BT.hpm*100)+"% hull"
       +(FS.raw>0?` <b style="color:#ff9a6b">\u00b7 ${Math.round(FS.raw/BT.hpm*100)}% UNBLOCKABLE</b>`
                 :(cut>0?" (\u2212"+Math.round(cut*100)+"%)":"")))
    : "NO INCOMING";
  $("#trInc").style.color = net>=BT.hp ? "#ff5f6d" : net>BT.hpm*0.2 ? "#ff9a6b" : "var(--mut)";
  /* SHIELDS are dead weight in a round that is purely a detonation - say so */
  $("#trScr").classList.toggle("useless", FS.shield<=0 && FS.raw>0);
  $("#trScr").querySelector("b").textContent=BT.ord.scr;
  $("#trRep").querySelector("b").textContent=BT.ord.rep;
  $("#trScr").disabled=left<1; $("#trRep").disabled=left<1;
}
function bPwrBar(){
  const host=$("#bPwr"); if(!host)return;
  if(host.childElementCount!==PWR_SYS.length+1){
    host.innerHTML=PWR_SYS.map(p=>
      `<div class="pw" data-p="${p.id}" style="--a:${p.col}">
         <span class="pn">${p.n}</span><span class="pp"></span>
         <span class="pio"><i>\u2212</i><i>+</i></span>
         <button class="phalf pdn" data-d="-1" aria-label="less ${p.n}"></button>
         <button class="phalf pup" data-d="1" aria-label="more ${p.n}"></button>
       </div>`).join("")
      +`<div id="bPwrFree"></div>`;
    /* left half takes a point, right half adds one. The commonest move in a fight is
       shifting ONE point, so that is the move the control has to make trivial. */
    host.querySelectorAll(".phalf").forEach(b=>{
      b.onclick=(ev)=>{ ev.stopPropagation();
        addPower(b.parentNode.dataset.p, +b.dataset.d) };
    });
  }
  /* free power is the number that decides whether a tap will do anything, so it gets
     to be the loud one */
  const pb=$("#bPause");
  if(pb){ pb.classList.toggle("on",!!BT.paused);
    pb.textContent = BT.paused ? "PAUSED \u00b7 TAP TO RESUME" : "PAUSE" }
  const tot=powerTotal();
  PWR_SYS.forEach((p,i)=>{
    const el=host.children[i], v=pwrOf(p.id);
    el.classList.toggle("hot",v>0);
    const pp=el.querySelector(".pp");
    if(pp.childElementCount!==tot){
      pp.innerHTML=Array.from({length:tot},()=>"<i></i>").join("");
    }
    [...pp.children].forEach((c,k)=>c.className=k<v?"on":"");
  });
  $("#bPwrFree").innerHTML=pwrFree()+"<br>FREE";
}
/* long-press on a button is a context menu to the browser and a held fire button to
   the player; the player wins everywhere except the save box */
document.addEventListener("contextmenu",function(ev){
  const t=ev.target;
  if(t&&t.closest&&t.closest("textarea,input"))return;
  ev.preventDefault();
},false);
function bWepBar(){
  const host=$("#bWep"); if(!host)return;
  /* Keyed on WHAT is fitted, not on how many slots there are. Filling an empty hardpoint
     leaves the count unchanged, so a count-based key left the new gun showing as EMPTY -
     and an EMPTY tile is disabled, so it could not be fired either. */
  const sig=BT.wep.map(w=>w?w.id:"-").join(",");
  if(host.dataset.sig!==sig){
    host.dataset.sig=sig;
    host.innerHTML=BT.wep.map((w,i)=>{
      if(!w)return `<button class="wp empty" disabled><span>EMPTY</span><b>\u2014</b></button>`;
      const D=WEPMAP[w.id];
      return `<div class="wp${D.ammo?" ammo":""}" data-w="${i}"><i class="fill"></i>
        <span>${D.n.replace(/ .*/,"")}</span><b>${D.chg}s</b>
        <button class="wfire" aria-label="fire ${D.n}"></button>
        <button class="wtog" aria-label="power ${D.n}"></button></div>`;
    }).join("");
    host.querySelectorAll(".wfire").forEach(b=>{
      b.onclick=(ev)=>{ ev.stopPropagation(); fireWeapon(+b.parentNode.dataset.w) };
    });
    host.querySelectorAll(".wtog").forEach(b=>{
      /* the dot is the power switch - tapping the body still fires */
      b.onclick=(ev)=>{ ev.stopPropagation(); armWeapon(+b.parentNode.dataset.w) };
    });
  }
  BT.wep.forEach((w,i)=>{
    const el=host.children[i]; if(!el||!w)return;
    /* if the tile and the weapon ever disagree again, skip rather than throw: this line
       used to run inside the frame loop and take the whole game down with it */
    const fill=el.querySelector("i.fill"); if(!fill)return;
    const p=Math.min(1,w.ch/w.chg), D=WEPMAP[w.id];
    const off = !wepOnline(i);
    const dry = off || (D.ammo && !(S.ammo>0));
    fill.style.height=(p*100)+"%";
    el.classList.toggle("rdy",p>=1&&!dry);
    el.classList.toggle("dry",!!dry);
    el.classList.toggle("off",!!off);
    /* a charged gun should read as "fire me", not as a percentage; an ammo weapon
       shows what is left in the rack instead, because that is the binding constraint */
    el.querySelector("b").textContent =
      off ? "NO POWER"
      : dry ? "NO AMMO"
      : D.ammo ? (p>=1 ? "FIRE \u00b7 "+S.ammo : (w.chg-w.ch).toFixed(1)+"s")
      : (p>=1 ? "FIRE" : (w.chg-w.ch).toFixed(1)+"s");
  });
}
function bStars(){
  BT.stars=[]; const c=Math.min(150,Math.floor(BW*BH/26000));
  for(let i=0;i<c;i++)BT.stars.push({x:Math.random()*BW,y:Math.random()*BH,z:Math.random()*.8+.2,r:Math.random()*1.3+.4});
}
bcv.addEventListener("pointerdown",e=>{
  if(!BT||BT.done)return;
  if(BT.cine){ cineFinish(); return }   /* patch633: tap anywhere skips the clip straight to the card */
  const r=bcv.getBoundingClientRect();
  const x=(e.clientX-r.left)*(BW/r.width), y=(e.clientY-r.top)*(BH/r.height);
  if(BT.mode==="turn")bTapTurn(x,y);
  else if(BT.mode==="wep")bTapWep(x,y);
  else bTapAt(x,y);
});
/* in weapon mode a tap picks who your guns are pointed at */
function bTapWep(cx,cy){
  let best=-1,bd=1e9;
  for(let i=0;i<BT.en.length;i++){ const e=BT.en[i]; if(!e.alive)continue;
    const d=Math.hypot(e.x*BW-cx,e.y*BH-cy)/(e.rr||1); if(d<bd){bd=d;best=i} }
  const R=Math.min(BW,BH)*0.034;
  if(best<0||bd>R*3.4)return;
  /* tapping the one you already have selected walks through its systems, then back to
     the hull - one finger, no menus */
  if(best===BT.sel){
    const e=BT.en[best], nsys=(e&&e.sys)?e.sys.length:0;
    let nx=BT.selSys+1;
    while(nx<nsys && e.sys[nx].st>=2)nx++;      /* skip what is already wrecked */
    BT.selSys = nx>=nsys ? -1 : nx;
  } else { BT.sel=best; BT.selSys=-1 }
  blip(640,.05,"sine",.03); dirty=true;
}
/* in turn mode a tap assigns a volley pip to the nearest hostile */
function bTapTurn(cx,cy){
  let best=-1,bd=1e9;
  for(let i=0;i<BT.en.length;i++){ const e=BT.en[i]; if(!e.alive)continue;
    const d=Math.hypot(e.x*BW-cx,e.y*BH-cy)/(e.rr||1); if(d<bd){bd=d;best=i} }
  const R=Math.min(BW,BH)*0.034;
  if(best<0||bd>R*3.2)return;
  if(!addVolley(best))blip(140,.06,"sine",.03);
  dirty=true;
}
$("#abFocus").onclick=()=>{ if(BT&&!BT.done&&BT.cd.f<=0){BT.buf.f=5;BT.cd.f=16;blip(700,.15,"square",.05)} };
$("#abFlak").onclick=()=>{ if(BT&&!BT.done&&BT.cd.k<=0){BT.buf.k=5;BT.cd.k=22;blip(420,.15,"sine",.05)} };
$("#bRetreat").onclick=()=>{ if(BT&&!BT.done)endBattle("timeout") };
$("#flFix").onclick=()=>{ if(repairFleet()){ renderAll(); save() } };
/* run 3: same TRANSFER the fleet card modal offers, reachable from the Raids pane's
   own fleet strip too - always against curFleet() (the tab currently selected) and
   the nearest idle fleet sitting at its own system. */
$("#flTransfer").onclick=()=>{
  const cf=curFleet(), mates=otherIdleFleetsAt(cf);
  if(mates.length)transferModal(cf, mates[0]);
};
$("#bPause").onclick=()=>{ if(BT&&!BT.done){ BT.paused=!BT.paused; dirty=true } };
$("#trScr").onclick=()=>{ if(addOrder("scr"))dirty=true };
$("#trRep").onclick=()=>{ if(addOrder("rep"))dirty=true };
$("#bClear").onclick=()=>{ clearOrders(); dirty=true };
$("#bResolve").onclick=()=>{ if(!BT||!(BT.lock>0))resolveRound() };

/* the tab row above the fleet strip - one .chip per fleet in fleets() (just "1" in
   run 1; run 3 adds locked placeholders for 2/3). Tapping sets S.flSel and
   re-renders. Churn-guarded on the fleet ids + S.flSel, same idiom every other
   rendered block in this game uses (tchurn2). */
function renderFleetTabs(){
  const host=$("#flTabs"); if(!host)return;
  const fls=fleets();
  const key=fls.map(f=>f.id).join(",")+"|"+S.flSel;
  if(host.dataset.h===key)return;
  host.dataset.h=key;
  host.innerHTML=fls.map(f=>
    `<button type="button" class="chip${f.id===S.flSel?" on":""}" data-fl="${f.id}">${f.n}</button>`
  ).join("");
  host.querySelectorAll("[data-fl]").forEach(b=>{
    b.onclick=()=>{ S.flSel=+b.dataset.fl; dirty=true; render(); };
  });
}
function renderRaids(){
  renderEndCard(); renderThreat(); renderRivalBars(); renderFleetTabs();
  const cf=curFleet();
  const st=$("#flStat");
  const pw=shipPower(), cp=fleetCap(), over=pw>cp;
  const thinCap=cp>0&&pw<cp*0.7;
  st.innerHTML=fmt(fleetDPS(cf))+" dps · "+fmt(fleetHPMax(cf))+" hull"
    +` <b class="flcap${over?" over":thinCap?" thin":""}">⚡${pw}/${cp}</b>`;
  /* PLAN-fleets run 3 (BRIEF commit 2): where the selected tab's own fleet actually
     is - independent of the ENGAGE/AUTO fleet a target card uses (that is always
     fleetAtSys(t.sys), never this tab). Plain textContent, same idiom the fleet
     bar's .fstat span uses - no churn key needed, it is not a DOM rebuild. */
  const loc=$("#flLoc");
  if(loc)loc.textContent = cf.to
    ? "→ "+((SYSMAP[cf.to]||{}).n||cf.to).toUpperCase()+" · "+Math.max(0,Math.ceil(cf.eta))+"s"
    : "AT "+((SYSMAP[cf.at]||{}).n||cf.at).toUpperCase();
  const hp=cf.hp, bar=$(".fl-hp");
  bar.classList.toggle("hurt",hp<=.6&&hp>.3); bar.classList.toggle("crit",hp<=.3);
  $("#flHp").style.width=(hp*100)+"%";
  $("#flHpT").textContent=fleetCount(cf)?("FLEET INTEGRITY "+Math.round(hp*100)+"%"+(hp<1?" · repairing":"")):"NO SHIPS";
  /* the single most useful thing the page can say to someone losing every fight */
  const wn=$("#flWarn");
  if(wn){
    const pw=shipPower(), cp=fleetCap(), thin=cp>0&&pw<cp*0.7;
    wn.classList.toggle("on",thin);
    if(thin)wn.innerHTML=`Your fleet is using <b>${pw} of ${cp}</b> command capacity.
      Hostiles are sized against a full one, so raids will go badly until you build more
      \u2014 heavier hulls give far more per point of capacity.`;
  }
  const fx=$("#flFix"), rc=repairCost(cf);
  fx.classList.toggle("hide", !fleetCount(cf) || hp>=1);
  fx.disabled = S.ore<rc || hp>=1;
  fx.textContent = "REPAIR \u00b7 "+fmt(rc)+" ORE";
  /* run 3: TRANSFER next to REPAIR - only meaningful with another idle fleet at
     curFleet()'s own system, same rule the fleet card modal's button uses. */
  const ftBtn=$("#flTransfer");
  if(ftBtn)ftBtn.disabled = otherIdleFleetsAt(cf).length===0;
  const host=$("#flShips"); host.innerHTML="";
  /* run 3 (decision 6): no idle fleet at home right now - a BUY still queues (see
     buyShip()'s own comment), it just doesn't land in curFleet() immediately. Said
     plainly on the button rather than silently landing somewhere the player can't
     see yet. */
  const noHomeIdle=!fleets().some(fl=>!fl.to&&fl.at==="home");
  SHIPS.forEach((sp,i)=>{
    const d=document.createElement("div"); d.className="shp"; d.style.setProperty("--a",sp.col);
    const k=S.sell?Math.min(S.buy==="max"?cf.sh[i]:S.buy,cf.sh[i]):(S.buy==="max"?Math.max(1,shipMax(i)):S.buy);
    const c=S.sell?(k>0?0.5*sp.b*Math.pow(sp.g,shipTotal(i)-k)*(Math.pow(sp.g,k)-1)/(sp.g-1):0):shipCost(i,k);
    const fits=k*sp.pw<=capLeft();
    const can=S.sell?(k>0&&!cf.to):(S.ore>=c&&fits);
    d.innerHTML=`<div class="si"><svg viewBox="0 0 48 48">${sp.ic}</svg></div>
      <div><div class="sn">${sp.n}</div>
        <div class="sd">${fmt(sp.dps*fleetMult())} dps · ${fmt(sp.hp*fleetMult())} hull · ⚡${sp.pw}</div></div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="sc">${cf.sh[i]}</div>
        <button class="gb"><b>${S.sell||fits?fmt(c)+" ore":"NO CAPACITY"}</b><i>${
          S.sell?"SCRAP ×"+k:(noHomeIdle?"DELIVERS AT SOL REACH":"BUY ×"+k)}</i></button>
      </div>`;
    const bt=d.querySelector("button"); bt.disabled=!can;
    bt.onclick=()=>{ if(S.sell)sellShip(i,k); else buyShip(i,k); render(); };
    host.appendChild(d);
  });
  const th=$("#tgts"); th.innerHTML="";
  if(!S.tg.length){
    th.innerHTML='<div class="card"><h5>No contacts</h5><p>Long-range scans are running. A new target appears every couple of minutes.</p></div>';
  }
  S.tg.forEach((t,i)=>{
    const T=RAIDS[t.ti], rw=raidReward(t);
    const dps=fleetDPS(cf), hpm=fleetHPMax(cf);
    const eHP=dps*t.secs*t.dif, eDPS=(hpm*t.dmg)/t.secs;
    const risk=riskOf(t);
    const rews=[rw.o?fmt(rw.o)+" "+RI('ore'):null,rw.c?fmt(rw.c)+" "+RI('cry'):null,rw.m?fmt(rw.m)+" "+RI('dm'):null,
      "~"+SVBASE[t.ti]*Math.round(t.dif)+" "+RI('sv')].filter(Boolean).join(" · ");
    const d=document.createElement("div"); d.className="tcard"; d.style.setProperty("--a",T.col);
    /* PLAN-fleets run 2 (decision 3): a raid is somewhere, and engaging it needs a
       fleet actually there - hereFleet, not curFleet(). None there yet: offer to
       SEND the nearest idle one, or say ARRIVING if one is already en route (never
       a second SEND stacked on top of the first). */
    const sysName=(SYSMAP[t.sys]||{}).n||t.sys;
    const hereFleet=fleetAtSys(t.sys);
    let actHtml, auto=false;
    if(hereFleet){
      auto=canAutoResolve(t,hereFleet);
      actHtml = auto
        ? '<button>AUTO-RESOLVE</button><button class="ghost" style="margin-top:6px">FIGHT IT ANYWAY</button>'
        : "<button>ENGAGE</button>";
    } else {
      const enRoute=fleetTravelingTo(t.sys);
      if(enRoute) actHtml=`<button disabled>ARRIVING · ${Math.max(0,Math.ceil(enRoute.eta))}s</button>`;
      else {
        const nf=nearestIdleFleetTo(t.sys);
        actHtml = nf
          ? `<button>SEND ${nf.n.toUpperCase()} · ${Math.round(travelSecs(nf.at,t.sys))}s</button>`
          : `<button disabled>ALL FLEETS BUSY</button>`;
      }
    }
    d.innerHTML=`<h5>${t.name} <span class="risk" style="color:${risk[1]}">${risk[0]}</span></h5>
      <div class="tloc">near ${sysName}</div>
      <div class="tm">${T.boss?"FLAGSHIP · single heavy target":t.en+" hostiles"} · ~${Math.round(t.secs*t.dif)}s engagement<br>
        they can strip ~${Math.round(t.dmg*100)}% of a full hull · reinforcements at ${waveTFor(t)}s</div>
      <div class="tr">${rews||"—"}</div>
      ${actHtml}`;
    const btns=d.querySelectorAll("button");
    if(hereFleet){
      btns.forEach(bb=>bb.disabled=bb.disabled||dps<=0||cf.hp<0.15);
      if(auto){ btns[0].onclick=()=>autoEngage(i); btns[1].onclick=()=>engage(i); }
      else btns[0].onclick=()=>engage(i);
    } else if(!btns[0].disabled){
      const nf=nearestIdleFleetTo(t.sys);
      btns[0].onclick=()=>{ if(nf)fleetSend(nf,t.sys); render(); };
    }
    th.appendChild(d);
  });
  // salvage chip
  $("#svChip").innerHTML=RI("sv","ci sv")+fmt(S.sv||0);

  // refits
  const rh=$("#refits"); rh.innerHTML="";
  REFIT.forEach(r=>{
    const l=rfl(r.id), max=l>=r.max, c=refitCost(r);
    const d=document.createElement("div");
    d.className="rfc"+(max?" done":""); d.style.setProperty("--a",r.col);
    d.innerHTML=`<h5>${r.n}<span class="lv">Lv ${l}/${r.max}</span></h5>
      <p>${r.t}</p>
      <div class="eff">${r.d(l)}${max?"":" \u2192 "+r.d(l+1)}</div>
      ${max?'<button disabled>MAXED</button>':
        `<button ${S.sv>=c?"":"disabled"}>${fmt(c)} ${RI('sv')}</button>`}`;
    if(!max)d.querySelector("button").onclick=()=>buyRefit(r);
    rh.appendChild(d);
  });

  // crew
  const wrap=$("#crewWrap"), sub=$("#crewSub");
  wrap.style.display="";                       /* bridge/roster (Deckhands) show from the start */
  {
    const slots=bridgeSlots();
    sub.textContent=onBridge().length+"/"+slots+" on the bridge"
      +(slots<3?" \u00b7 next slot at "+(slots===1?40:150)+" wins":"");
    const bh=$("#bridge"); bh.innerHTML="";
    for(let i=0;i<3;i++){
      const open=i<slots, id=S.bridge[i], c=open?(S.crew||[]).find(x=>x.id===id):null;
      const R=c?ROLES.find(r=>r.id===c.role):null;
      const d=document.createElement("div");
      d.className="bslot"+(c?" full":"")+(open?"":" lock");
      d.style.setProperty("--a",R?R.col:"var(--dim)");
      d.style.setProperty("--a2",R?rgba(R.col,.14):"rgba(255,255,255,.03)");
      d.innerHTML = !open ? `<span class="bempty">LOCKED \u00b7 ${i===1?40:150} WINS</span>`
        : c ? `<div class="bi">${R.n.slice(0,3).toUpperCase()}</div>
               <div style="min-width:0"><div class="bn">${c.n}</div>
                 <div class="be">${RAR[c.r].n} ${R.n} \u00b7 ${R.d(c.deck?1:RAR[c.r].m)}</div></div>`
            : `<span class="bempty">EMPTY BERTH</span>`;
      if(c)d.onclick=()=>assignCrew(c.id);
      bh.appendChild(d);
    }
    const ro=$("#roster"); ro.innerHTML="";
    (S.crew||[]).forEach(c=>{
      const R=ROLES.find(r=>r.id===c.role), on=S.bridge.indexOf(c.id)>=0;
      const d=document.createElement("div");
      d.className="crw"+(on?" on":""); d.style.setProperty("--a",R.col);
      d.style.setProperty("--a2",rgba(R.col,.13));
      d.innerHTML=`<div style="min-width:0">
          <div class="cn">${c.n}</div>
          <div class="cr" style="color:${RAR[c.r].col}">${RAR[c.r].n.toUpperCase()} \u00b7 ${R.n.toUpperCase()}</div>
          <div class="ce">${R.d(c.deck?1:RAR[c.r].m)}</div></div>
        <div class="cb">
          <button data-a>${on?"STAND DOWN":"ASSIGN"}</button>
          ${c.deck?"":`<button data-d>SELL ${dismissValue(c)}</button>`}</div>`;
      d.querySelector("[data-a]").onclick=()=>assignCrew(c.id);
      const dd=d.querySelector("[data-d]"); if(dd)dd.onclick=()=>dismissCrew(c.id);
      ro.appendChild(d);
    });
    const candHead=$("#candHead"), pool=$("#candPool"), rb=$("#btnRefreshCrew");
    if(!crewUnlocked()){
      candHead.textContent="Candidates \u2014 unlocks after 5 raid wins \u00b7 "+(S.wins||0)+"/5";
      pool.innerHTML=""; rb.style.display="none"; $("#hireNote").textContent="";
    } else {
      candHead.textContent="Candidates";
      ensureCrewPool();
      pool.innerHTML="";
      (S.crewPool||[]).forEach(cand=>{
        const R=ROLES.find(r=>r.id===cand.role), hc=hireCost(), can=S.sv>=hc;
        const d=document.createElement("div");
        d.className="crw cand"; d.style.setProperty("--a",R.col);
        d.style.setProperty("--a2",rgba(R.col,.13));
        d.innerHTML=`<div style="min-width:0">
            <div class="cn">${cand.n}</div>
            <div class="cr" style="color:${RAR[cand.r].col}">${RAR[cand.r].n.toUpperCase()} \u00b7 ${R.n.toUpperCase()}</div>
            <div class="ce">${R.d(RAR[cand.r].m)}</div></div>
          <div class="cb"><button ${can?"":"disabled"}>HIRE ${fmt(hc)}</button></div>`;
        d.querySelector("button").onclick=()=>{ if(!hireCandidate(cand.id))blip(140,.08,"sine",.03) };
        pool.appendChild(d);
      });
      rb.style.display="";
      const rc=crewRefreshCost();
      rb.disabled=S.sv<rc;
      rb.innerHTML="REFRESH \u00b7 "+fmt(rc)+" salvage";
      $("#hireNote").textContent="Roster "+(S.crew||[]).filter(c=>!c.deck).length+" \u00b7 each hire costs more";
    }
  }

  $("#raidHint").textContent = fleetCount(cf)? "Tap the glowing seam on a hostile for a critical. Chain hits without missing to build a damage multiplier."
    : "Build warships below, then engage a target.";
  raidSubFlags();
}
/* Sub-tab alert dots for the Raids tab: cheap affordability/attention checks, same shape
   as the checks renderRaids() already does per-row above — nothing new is computed, just
   summarised into one bool per sub-tab. Runs every dirty frame, so kept O(rows). */
function raidSubFlags(){
  const f={targets:false,fleet:false,loadout:false,crew:false};
  { const cf=curFleet(); f.targets = S.tg.length>0 && fleetCount(cf)>0 && cf.hp>=0.15; }
  f.fleet   = SHIPS.some((sp,i)=> sp.pw<=capLeft() && S.ore>=shipCost(i,1));
  f.loadout = wepSlots().some(s=>!s) && WEAPONS.some(w=>wepOwned(w.id)&&wepSlots().indexOf(w.id)<0)
           || WEAPONS.some(w=>!wepOwned(w.id)&&S.sv>=w.cost)
           || REFIT.some(r=>rfl(r.id)<r.max&&S.sv>=refitCost(r));
  f.crew    = crewUnlocked() && ( S.sv>=hireCost()
           || (onBridge().length<bridgeSlots() && (S.crew||[]).some(c=>S.bridge.indexOf(c.id)<0)) );
  $$(".rmbtn[data-rd]").forEach(b=>b.classList.toggle("alert", f[b.dataset.rd] && b.dataset.rd!==raidMode));
}

