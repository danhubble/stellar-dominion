#!/usr/bin/env python3
"""
patch633 (BUILD 635) - PLAN-clip.md: the auto-resolve battle clip.

Owner decision (16 Sep): "give more of a punch to the auto resolve", Advance Wars
style. A ~2.5s scripted clip on the existing battle screen, then the existing result
card. Honest - the real fleet's fitted weapons, the real hostiles, the real 3%
integrity cost, never a random light show. Tap anywhere to skip to the card. No
pacing impact (csim4.js never auto-resolves - verified again below, byte-identical).

What changed:

1. autoResolveTarget(): the old instant kill (mark every hostile dead, endBattle("win")
   the same frame - the player saw the battle screen for one frame with the result
   card already stamped over it) is replaced by arming BT.cine={t:0} and adding the
   new #battle.cine class. engageTarget() itself (spawn, mode, DOM) is completely
   unchanged - reused exactly as before.

2. bUpdate(): routes to the new bUpdateCine(dt) whenever BT.cine is set, in place of
   the ordinary per-mode sim (bUpdateWep/bUpdateTurn/bUpdateLive) - checked right after
   the existing BT.done early-return, before the mode dispatch, so the real sim (enemy
   fire, weapon charge, STAGE 1 waves) never runs during the clip.

3. bUpdateCine(dt) (new, next to bUpdate()): drives the clip's beats off BT.cine.t -
   an enemy volley at 0.35s (visual only, reusing foeFire()'s own "shot" fx shape and
   bFade()'s existing shot-arrival -> impact-fx/sfx conversion), the real AUTO_FHP_COST
   landing once at 0.35+SHOT_T, then a fleet volley from 0.9s rotating the fitted
   weapons through fireFx()/hitEnemy() (an overkill hit, so every shot is lethal - the
   win was already decided by canAutoResolve() before the clip ever started; this only
   shows it happening), hostiles ordered left-to-right with any boss (EK[k].boss) last,
   the interval compressed past five targets so the clip still clears in roughly the
   same span. Hydra splits join the firing queue as they spawn, from either firing path
   (an immediate non-shell hit or a shell's own bFade()-driven arrival). bFade() itself
   (shared, unmodified, with bUpdateWep()/bUpdateTurn()) runs every cine frame too - it
   ages every fx pushed above, chases hpShown toward BT.hp so the hull bar visibly dips,
   and is what actually lands a shell's f.pend on arrival, exactly like a real shot.
   canAutoResolve() never offers this for the final battle (its own win/loss model lives
   in finalBattleTick()/endFinalBattle(), and endBattle() dispatches any "how" straight
   into the finale branch once BT.t.final is set) - no UI path can reach this, guarded
   anyway at the top: BT.t.final falls through to the real bUpdateWep() sim instead of
   ever mis-resolving a fight this clip was not built for. Reduced motion
   (prefers-reduced-motion, via the existing lowMotion()) skips straight to the card on
   the first cine frame.

4. cineFinish() (new): the shared landing spot for both the natural end of the queue
   above and the skip path below - forces the board dead, charges AUTO_FHP_COST if the
   clip was skipped before it charged itself naturally, clears #battle.cine, then the
   ordinary endBattle("win"). BT.done (set by endBattle()) is still the only "clip over"
   flag - bUpdate()'s own BT.done check already stops bUpdateCine() being reached again,
   so nothing new was added for that.

5. endBattle(): the flat `S.fhp=Math.max(0.05,S.fhp-AUTO_FHP_COST)` subtraction on a win
   is now conditional on `!(BT.cine&&BT.cine.charged)` - the clip already took the same
   cost off BT.hp (step 3), and the line just above it
   (`S.fhp=Math.max(0.05,BT.hp/BT.hpm)`) already carries that into S.fhp, so applying
   the flat subtraction too would double-charge it. Algebraically identical to the old
   path: hp=hpm*(fhpBefore-COST) -> S.fhp=max(0.05,fhpBefore-COST), the same formula the
   old code computed in two steps (S.fhp=fhpBefore, then S.fhp-=COST).

6. Skip: bcv's pointerdown handler calls cineFinish() and returns before the mode
   dispatch whenever BT.cine is set - tap anywhere ends the clip immediately.

7. CSS: `#battle.cine` hides `#bWep`/`#bPwr`/`#bTip` (the weapon rack, power rack and
   tip - the screen should read as a cutscene, not a paused fight) and `#bRetreat` (a
   retreat mid-clip would pay out as "Withdrew", which is wrong - the fleet already won
   this; tap-to-skip is the only exit while it runs). The header (#bName), hull bar and
   canvas are untouched by any of this - they draw exactly as a real fight would.
   `.cine` is added only once BT.cine is actually armed (autoResolveTarget(), after
   engageTarget() returns) and cleared on every fresh engageTarget() call (so a manual
   fight right after an auto-resolved one never inherits it) and again in cineFinish()
   (so the result card's own screen is not hiding #bRetreat underneath it).

Nothing here runs inside tick()'s call graph - bUpdateCine() only ever runs from
bUpdate(), which only ever runs from frame()'s own requestAnimationFrame loop while BT
is set, and csim4.js never calls engageTarget()/autoResolveTarget() at all (grepped
again below, same as the plan's own note). Math.random() is not used anywhere in this
patch (fireFx(D,e,false)/hitEnemy(i,dmg,0) are both called with fixed, non-random
arguments throughout) - the clip's outcome is exactly the deterministic win
canAutoResolve() already promised, never a fresh roll.

tests/tcombat2.js and tests/trivals2.js both called autoResolveTarget() and then read
the result (S.taken/S.fhp, or S.occ/sysHeld()/rate()) on the very same tick - genuinely
invalidated by this patch, since the win no longer lands synchronously. Both fixed
(same tests, same assertions, now driving bUpdate() to BT.done first) as part of
patch634 alongside the new tests/tclip2.js - see that patch's own HANDOVER entry.
"""
import re

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=634;", "const BUILD=635;", label="BUILD bump")

# ==================================================================== CSS: #battle.cine hides the weapon
# rack, power rack and tip - the clip reads as a cutscene, not a paused fight. Header (#bName), hull bar
# and canvas (#bcv) are untouched - same specificity as the #battle.wep rules just above (2 IDs + 1 class),
# source-order-wins since this comes after all three of them.
do(
    "#battle.wep .bab,#battle.wep #bTip{display:none}",
    """#battle.wep .bab,#battle.wep #bTip{display:none}
#battle.cine #bWep,#battle.cine #bPwr,#battle.cine #bTip{display:none}   /* patch633: the clip reads as a cutscene, not a paused fight - weapon rack, power rack and tip hidden while it runs; header (#bName), hull bar and canvas (#bcv) stay, per the plan */""",
    label="CSS: hide #bWep/#bPwr/#bTip during .cine",
)

# ==================================================================== CSS: #battle.cine hides #bRetreat -
# a retreat mid-clip would pay out as "Withdrew", which is wrong (the fleet already won this). Strictly
# higher specificity than the bare #bRetreat rule (2 IDs + 1 class vs 1 ID) - wins regardless of order.
do(
    """#bRetreat{border:1px solid rgba(255,107,138,.55);background:rgba(255,107,138,.12);color:#ffd0da;
  border-radius:9px;padding:9px 14px;cursor:pointer;font:700 11px/1 system-ui;letter-spacing:.16em}""",
    """#bRetreat{border:1px solid rgba(255,107,138,.55);background:rgba(255,107,138,.12);color:#ffd0da;
  border-radius:9px;padding:9px 14px;cursor:pointer;font:700 11px/1 system-ui;letter-spacing:.16em}
#battle.cine #bRetreat{display:none}   /* patch633: a retreat mid-clip would pay out as "Withdrew", which is wrong - the fleet already won this; tap-to-skip (cineFinish()) is the only exit while it runs */""",
    label="CSS: hide #bRetreat during .cine",
)

# ==================================================================== JS: autoResolveTarget() arms
# BT.cine instead of the old instant kill. engageTarget() itself is completely untouched here.
do(
    """function autoResolveTarget(t, idx){
  if(!canAutoResolve(t))return false;
  engageTarget(t, idx);
  if(!BT)return false;
  BT.auto=1;
  for(const e of BT.en)e.alive=0;
  BT.kills=BT.tot;
  endBattle("win");
  return true;
}""",
    """function autoResolveTarget(t, idx){
  if(!canAutoResolve(t))return false;
  engageTarget(t, idx);
  if(!BT)return false;
  BT.auto=1;
  /* patch633: the old instant kill (kill everyone, endBattle("win") the same frame) is
     replaced by a ~2.5s scripted clip - see bUpdateCine(), next to bUpdate() - so the
     player sees their own fitted weapons and the real hostiles trade shots, not a
     single frame of the battle screen with the result card already stamped over it. */
  BT.cine={t:0};
  $("#battle").classList.add("cine");
  return true;
}""",
    label="autoResolveTarget(): arm BT.cine instead of the instant kill",
)

# ==================================================================== JS: engageTarget() clears .cine on
# every fresh engage, so a manual fight right after an auto-resolved one never inherits it.
do(
    """  $("#battle").classList.add("on"); $("#bRes").classList.remove("on");
  $("#battle").classList.toggle("turn",BT.mode==="turn");
  $("#battle").classList.toggle("wep",BT.mode==="wep");
  bx=null; blip(120,.35,"sawtooth",.06);""",
    """  $("#battle").classList.add("on"); $("#bRes").classList.remove("on");
  $("#battle").classList.toggle("turn",BT.mode==="turn");
  $("#battle").classList.toggle("wep",BT.mode==="wep");
  /* patch633: every fresh engage starts clean - autoResolveTarget() adds .cine back on,
     right after this call returns, only once BT.cine is actually armed. */
  $("#battle").classList.remove("cine");
  bx=null; blip(120,.35,"sawtooth",.06);""",
    label="engageTarget(): clear .cine on every fresh engage",
)

# ==================================================================== JS: bUpdate() routes to the new
# bUpdateCine(dt) whenever BT.cine is set, checked right after the existing BT.done early-return and
# before the mode dispatch - the real sim never runs during the clip. bUpdateCine()/cineFinish() themselves
# defined right here, next to bUpdate(), per the plan ("one bUpdateCine(dt), one cineFinish()").
do(
    """function bUpdate(dt){
  if(!BT)return;
  if(BT.done){ BT.el+=dt; return }
  if(BT.mode==="turn")return bUpdateTurn(dt);
  if(BT.mode==="wep")return bUpdateWep(dt);
  return bUpdateLive(dt);
}
/* turn mode has no clock: nothing moves until RESOLVE. Only the drifting motion and
   the effect fades tick, so the board stays alive to look at while you think. */
function bUpdateTurn(dt){""",
    """function bUpdate(dt){
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

  if(!c.evolley && c.t>=0.35){
    c.evolley=1;
    const alive=BT.en.filter(e=>e.alive), n=Math.min(3,alive.length);
    for(let q=0;q<n;q++){
      const e=alive[Math.floor(q*alive.length/n)];
      BT.fx.push({t:"shot",x:e.x*BW,y:e.y*BH,ty:playerY(),p:0,w:0,dur:SHOT_T,
                  d:0,raw:0,miss:0,blk:0,a:1});
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
function bUpdateTurn(dt){""",
    label="bUpdate(): route to bUpdateCine(); bUpdateCine()+cineFinish() themselves",
)

# ==================================================================== JS: endBattle()'s flat
# AUTO_FHP_COST subtraction no longer double-charges a clip that already took it off BT.hp.
do(
    '  if(how==="win"&&BT.auto)S.fhp=Math.max(0.05,S.fhp-AUTO_FHP_COST);',
    '  if(how==="win"&&BT.auto&&!(BT.cine&&BT.cine.charged))S.fhp=Math.max(0.05,S.fhp-AUTO_FHP_COST);   /* patch633: the clip already took this off BT.hp (BT.cine.charged) - S.fhp=max(0.05,BT.hp/BT.hpm) just above already carries it into S.fhp, so this flat subtraction would otherwise double-charge it */',
    label="endBattle(): flat AUTO_FHP_COST subtraction conditional on the clip not having already charged it",
)

# ==================================================================== JS: bcv's pointerdown handler -
# tap anywhere skips the clip straight to the card, before the ordinary mode dispatch.
do(
    """bcv.addEventListener("pointerdown",e=>{
  if(!BT||BT.done)return;
  const r=bcv.getBoundingClientRect();
  const x=(e.clientX-r.left)*(BW/r.width), y=(e.clientY-r.top)*(BH/r.height);
  if(BT.mode==="turn")bTapTurn(x,y);
  else if(BT.mode==="wep")bTapWep(x,y);
  else bTapAt(x,y);
});""",
    """bcv.addEventListener("pointerdown",e=>{
  if(!BT||BT.done)return;
  if(BT.cine){ cineFinish(); return }   /* patch633: tap anywhere skips the clip straight to the card */
  const r=bcv.getBoundingClientRect();
  const x=(e.clientX-r.left)*(BW/r.width), y=(e.clientY-r.top)*(BH/r.height);
  if(BT.mode==="turn")bTapTurn(x,y);
  else if(BT.mode==="wep")bTapWep(x,y);
  else bTapAt(x,y);
});""",
    label="bcv pointerdown: skip the clip on tap",
)

assert h.count("const BUILD=635;") == 1
assert h.count("function bUpdateCine(dt){") == 1
assert h.count("function cineFinish(){") == 1
assert h.count('BT.cine={t:0};') == 1
assert h.count('$("#battle").classList.add("cine");') == 1
assert h.count('$("#battle").classList.remove("cine");') == 2
assert h.count('#battle.cine #bRetreat{display:none}') == 1
assert h.count('#battle.cine #bWep,#battle.cine #bPwr,#battle.cine #bTip{display:none}') == 1
assert h.count('if(BT.cine)return bUpdateCine(dt);') == 1
assert h.count('if(BT.cine){ cineFinish(); return }') == 1
assert h.count('if(BT.t&&BT.t.final)return bUpdateWep(dt);') == 1
assert h.count('if(lowMotion()){ cineFinish(); return }') == 1
# ordering: bUpdate -> its own cine dispatch line -> bUpdateCine -> cineFinish -> bUpdateTurn (unchanged,
# the next function in the file)
assert (h.index('function bUpdate(dt){')
        < h.index('if(BT.cine)return bUpdateCine(dt);')
        < h.index('function bUpdateCine(dt){')
        < h.index('function cineFinish(){')
        < h.index('function bUpdateTurn(dt){'))
# the old instant-kill shape is gone from autoResolveTarget - replaced by arming BT.cine
assert 'for(const e of BT.en)e.alive=0;\n  BT.kills=BT.tot;\n  endBattle("win");\n  return true;' not in h
assert 'if(how==="win"&&BT.auto&&!(BT.cine&&BT.cine.charged))S.fhp=Math.max(0.05,S.fhp-AUTO_FHP_COST);' in h
# csim4.js never engages/auto-resolves a fight - unchanged claim, checked again here the same way the plan did
_csim = open("/home/claude/tests/csim4.js", encoding="utf-8").read()
assert "engageTarget(" not in _csim and "autoResolveTarget(" not in _csim and "autoEngage(" not in _csim

with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch633 applied OK")
