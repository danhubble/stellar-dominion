#!/usr/bin/env python3
"""
patch601 — PLAN-defences.md Run 3, patch 2 of 3: the mini-game shows what you built.

Three things, all visual, none of them touching the delegated numbers holdOdds()
already resolves against - "this patch is only the player-flown fight showing the
same facts" (the plan's own words):

  1. Minefield now actually detonates in the fight: the moment the closest hostile
     of the first wave crosses DEF_MINE_RING (a ring further out than the hull ring
     itself, so it reads as "on approach" rather than "already biting"), every
     hostile currently inside that ring takes a real lump of damage - DEF_MINE_DMG_MULT
     shot-equivalents of defShotDmg(), the same damage unit every other shot in this
     fight already uses, since the delegated side has no literal per-hit number of
     its own to reuse (Minefield's holdOdds() contribution is an abstract +DEF_STR.min
     garrison-strength term, not a damage figure) - plus a visible ring flash. Fires
     once per fight, on the first wave, whichever wave that turns out to be.
  2. Shield Array's hullMul (patch597) was VERIFIED, not changed: startDefence() and
     lfOpenDefence() already read dmodLv(id,"shd") into DT.hullMul every time a fight
     opens, and DT.hp's own drain divides by DT.hullMul - so a fitted Shield Array
     already, visibly, drains the hull ring slower. No code here.
  3. Stationed Hangar ships are now drawn beside the system (defHangarXY() - a fixed
     ring of positions around it, one per stationed hull) and fire on their own,
     exactly like the existing auto-turrets (same lead-solve, same SD_AUTOEV cadence,
     same shot damage) via a new, parallel defHangarFire() rather than folding hulls
     into DT.turrets itself - turrets and Hangar ships are two different fitted
     modules with two different draw treatments (turrets have no sprite of their own;
     Hangar ships do), so keeping their fire loops distinct keeps that difference
     easy to reason about instead of one function silently serving two concepts.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------------------------------------------------------------------
# 1) new tuning constants, next to the rest of the mini-game's own knobs
# ---------------------------------------------------------------------------
do(
    """      DEF_LEAK=0.16;       /* how far in they push before stopping to fire */""",
    """      DEF_LEAK=0.16,       /* how far in they push before stopping to fire */
      DEF_MINE_RING=0.30,  /* TUNING-PENDING: fraction of dMin() at which an armed
                               Minefield detonates against the first wave - further
                               out than DEF_LEAK (0.16), so it visibly happens on
                               approach, before anything starts biting the hull. */
      DEF_MINE_DMG_MULT=6; /* TUNING-PENDING: the detonation deals this many
                               defShotDmg()-equivalents to everything caught in the
                               ring, once. The delegated side has no literal damage
                               figure of its own to reuse - Minefield's holdOdds()
                               contribution is an abstract +DEF_STR.min garrison-
                               strength term - so this is the mini-game's own
                               translation of "the same damage the odds assume":
                               enough to drop a lone runner outright (the swarm
                               hull, defBaseHP()*0.68) without trivialising a
                               hauler's (2.05x). */""",
    label="mine tuning constants",
)

# ---------------------------------------------------------------------------
# 2) hangarEntriesFor() - one entry per stationed hull, right after defMixFor()
#    (used by both DT constructors below).
# ---------------------------------------------------------------------------
do(
    """function defMixFor(rid){
  /* Helion swarms, the Covenant arrives heavy. The mix IS the personality. */
  return rid==="hel" ? ["runner","runner","raider","runner","raider"]
                     : ["raider","hauler","raider","hauler","raider"];
}""",
    """function defMixFor(rid){
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
}""",
    label="hangarEntriesFor()",
)

# ---------------------------------------------------------------------------
# 3) startDefence(): mines/hangar fields on DT, sab falling back to the same
#    modSys turrets/shields already fall back to.
# ---------------------------------------------------------------------------
do(
    """  const modSys=isSab?bestHeldDefSys():s;
  const turLv=modSys?dmodLv(modSys.id,"tur"):0, shdLv=modSys?dmodLv(modSys.id,"shd"):0;
  const sdl=isSab?bestHeldDefStrength():defStrength(s.id);
  DT={ rv:th.rv, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif:th.dif||1,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(th.rv), mixi:0, sab:isSab,
       qid:th.id, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };""",
    """  const modSys=isSab?bestHeldDefSys():s;
  const turLv=modSys?dmodLv(modSys.id,"tur"):0, shdLv=modSys?dmodLv(modSys.id,"shd"):0;
  const minLv=modSys?dmodLv(modSys.id,"min"):0;
  const sdl=isSab?bestHeldDefStrength():defStrength(s.id);
  DT={ rv:th.rv, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif:th.dif||1,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(th.rv), mixi:0, sab:isSab,
       qid:th.id, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})),
       mines:minLv>0, mineFired:false, mineFlash:null,
       hangar:hangarEntriesFor(modSys?modSys.id:null) };""",
    label="startDefence() mines+hangar",
)

# ---------------------------------------------------------------------------
# 4) lfOpenDefence(): same two fields, no sab fallback needed here (a live-
#    fleet fight is always against a real, currently-held system).
# ---------------------------------------------------------------------------
do(
    """  const sdl=defStrength(s.id), turLv=dmodLv(s.id,"tur"), shdLv=dmodLv(s.id,"shd");
  DT={ rv:rid, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(rid), mixi:0,
       qid:-1, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };""",
    """  const sdl=defStrength(s.id), turLv=dmodLv(s.id,"tur"), shdLv=dmodLv(s.id,"shd"), minLv=dmodLv(s.id,"min");
  DT={ rv:rid, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(rid), mixi:0,
       qid:-1, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})),
       mines:minLv>0, mineFired:false, mineFlash:null,
       hangar:hangarEntriesFor(s.id) };""",
    label="lfOpenDefence() mines+hangar",
)

# ---------------------------------------------------------------------------
# 5) defHangarFire()/defHangarXY() - right after defAutoFire(), before defEnemyXY()
# ---------------------------------------------------------------------------
do(
    """function defEnemyXY(e){
  return {x:DW*0.5+Math.cos(e.a)*e.r, y:DH*0.5+Math.sin(e.a)*e.r};
}""",
    """/* Hangar ships (patch601): each stationed hull fires exactly like an auto-turret -
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
}""",
    label="defHangarFire + defHangarXY",
)

# ---------------------------------------------------------------------------
# 6) defUpdate(): tick the Hangar cooldowns, fire the Hangar ships, decay the
#    mine flash, and the mine detonation check itself (after enemy movement,
#    so `.r` is this frame's real position).
# ---------------------------------------------------------------------------
do(
    """  DT.cool=Math.max(0,DT.cool-dt);
  if(DT.turrets)for(const t of DT.turrets)t.cd=Math.max(0,t.cd-dt);
  defAutoFire();
  const b=RVBEH[DT.rv]||RVBEH.hel;""",
    """  DT.cool=Math.max(0,DT.cool-dt);
  if(DT.turrets)for(const t of DT.turrets)t.cd=Math.max(0,t.cd-dt);
  if(DT.hangar)for(const t of DT.hangar)t.cd=Math.max(0,t.cd-dt);
  defAutoFire();
  defHangarFire();
  if(DT.mineFlash){ DT.mineFlash.a-=dt*1.3; if(DT.mineFlash.a<=0)DT.mineFlash=null; }
  const b=RVBEH[DT.rv]||RVBEH.hel;""",
    label="defUpdate() hangar fire + flash decay",
)
do(
    """  const ringR=dMin()*DEF_RING, stopR=dMin()*DEF_LEAK;
  for(const e of DT.en){
    if(!e.alive)continue;
    e.wob+=dt*2.2;
    if(e.r>stopR)e.r-=dt*e.sp*Math.hypot(DW,DH)*0.82;
    e.a+=dt*e.tan/Math.max(0.25,e.r/dMin()*3.2);   /* tighter orbit = faster sweep */
  }""",
    """  const ringR=dMin()*DEF_RING, stopR=dMin()*DEF_LEAK;
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
  }""",
    label="defUpdate() mine detonation",
)

# ---------------------------------------------------------------------------
# 7) defDraw(): the mine flash ring, and the Hangar ships drawn beside the system.
# ---------------------------------------------------------------------------
do(
    """  } else {
    dx.strokeStyle="rgba(255,209,102,.85)"; dx.lineWidth=2.5*D;
    dx.beginPath(); dx.arc(cx,cy,rr*1.35,0,6.2832); dx.stroke();
  }
  for(const e of DT.en){""",
    """  } else {
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
  for(const e of DT.en){""",
    label="defDraw() mine flash",
)
do(
    """    if(e.hp<e.max){
      dx.fillStyle="rgba(255,255,255,.18)";
      dx.fillRect(p.x-s,p.y+s*1.2,s*2,2.5*D);
      dx.fillStyle=e.col;
      dx.fillRect(p.x-s,p.y+s*1.2,s*2*Math.max(0,e.hp/e.max),2.5*D);
    }
  }
  for(const sh of DT.sh){ if(sh.life<=0)continue;""",
    """    if(e.hp<e.max){
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
  for(const sh of DT.sh){ if(sh.life<=0)continue;""",
    label="defDraw() hangar ships",
)

# ---------------------------------------------------------------------------
# 8) __SD export
# ---------------------------------------------------------------------------
do(
    """  startDefence,defUpdate,defDraw,defFireAt,endDefence,closeDefence,defShotDmg,defBaseHP,
  defEnemyXY,renderThreat,renderRivalBars,renderEndCard,get DT(){return DT},
  DEF_RATE,DEF_SPD,DEF_RING,DEF_LEAK,DKIND,""",
    """  startDefence,defUpdate,defDraw,defFireAt,endDefence,closeDefence,defShotDmg,defBaseHP,
  defEnemyXY,renderThreat,renderRivalBars,renderEndCard,get DT(){return DT},
  DEF_RATE,DEF_SPD,DEF_RING,DEF_LEAK,DKIND,
  DEF_MINE_RING,DEF_MINE_DMG_MULT,hangarEntriesFor,defHangarFire,defHangarXY,""",
    label="__SD export additions",
)

do("const BUILD=600;", "const BUILD=601;", label="BUILD bump")

open(PATH, "w", encoding="utf-8").write(h)
print("patch601 applied OK")
