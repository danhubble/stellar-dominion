#!/usr/bin/env python3
"""
patch635 (BUILD 637) - PLAN-clip.md follow-up: three things from the coordinator's own
mid-clip screenshot (clipv-mid.png), after independently verifying 633/634.

1. A stray "-00"/"-0" floating number at the fleet. Root cause: the 0.35s enemy-volley
   beat (bUpdateCine(), patch633) pushes up to three "shot" fx all with d:0 (visual
   only - the real cost was meant to land separately, once, via the explicit
   BT.hp-=AUTO_FHP_COST*BT.hpm line at 0.35+SHOT_T). Checked first, per the
   coordinator's own instruction, whether bFade()'s shot-arrival branch subtracts d
   from BT.hp on landing or only displays it: read it directly (the branch at
   `if(f.p>=1&&!f.landed)`) - it is display-only. It pushes an "impact" fx, a
   BT.num floating-number entry (v:f.d), and a sound; it never touches BT.hp. Only
   foeFire() does that, at fire time (`BT.hp-=d`, right there in foeFire itself) - a
   real-shot path this clip never calls. So a d:0 shot's arrival was always going to
   print "-0" once it landed (three of them landing within the same frame or two,
   since all three share the same dur, is exactly the "-00" the screenshot shows) -
   and, just as important, giving one shot a nonzero d cannot double-charge anything,
   since arrival never subtracts from BT.hp in the first place.

   Fixed two ways, both needed:
   - Exactly one shot in the volley (q===0) now carries the real cost as its own d
     (AUTO_FHP_COST*BT.hpm), so its arrival prints the real "-<cost>" number through
     the ordinary bFade() path instead of a fabricated number bolted on elsewhere.
     The cost itself still lands exactly once, separately, at the existing
     0.35+SHOT_T line below - completely unchanged, so nothing here is double-
     charged (proved in tclip2.js: the fixture's own S.fhp is still exactly 0.97,
     not 0.94 or anything else).
   - bFade()'s own arrival branch gains one guard: skip pushing the number (not the
     impact fx, not the sound - just the number) when d===0 and it is neither a miss
     nor a block. Per the coordinator's own reasoning: a real shot with d===0 is
     ALWAYS a miss or a block (foeFire()'s own d is `(miss||blocked) ? 0 :
     <something positive>` - there is no third way to get a zero out of it), and that
     combination is already handled by the branch just above this one
     (`if(f.miss||f.blk)`), so this guard can only ever fire on the clip's own
     synthetic zero-cost shots (miss:0, blk:0 by construction) - it changes nothing
     in real, non-clip play. Belt-and-braces alongside the first fix: even the
     (up to two) remaining d:0 shots in the volley can no longer print a stray "-0"
     on their own, whatever else changes about the volley later.

2. Header noise: "⚠ REINFORCEMENTS · Ns" (#bEsc, class .bh-esc) kept counting down
   during the clip - a 2.5s cutscene has no reinforcement wave. bDraw()'s own hud code
   toggles .on/.hit on #bEsc every frame purely off BT.waveDone/BT.el, with no idea
   .cine exists, so a same-specificity CSS override (the #bWep/#bPwr/#bTip/#bPause
   approach) would still race it depending on rule order vs whichever class bDraw()
   last touched. Used the OTHER approach already in this file instead (#bRetreat's) -
   strictly higher specificity, order-independent: `#battle.cine #bEsc{display:none}`
   (2 IDs + 1 class) beats `.bh-esc.on`/`.bh-esc.hit` (2 classes each) regardless of
   which one bDraw() add()s most recently. #bName and #bMeta (the hostile count) are
   untouched - the plan only ever asked for the reinforcements line.

3. The formation was frozen for the whole clip - bUpdateCine() moved nothing between
   beats, so hostiles hung motionless. Fixed by copying bUpdateTurn()'s own drift block
   verbatim (its px/py sine drift, the same x/y clamp bounds, the wa rotation - nothing
   else from turn mode, no round clock, no input) to the top of bUpdateCine(), so the
   board breathes the same way an ordinary turn-mode fight's board already does while
   the player is thinking. Every hostile this clip ever drives already carries
   px/py/sp/rr/wa/ws at spawn (checked at every BT.en.push() site - the initial spawn,
   the STAGE 1 wave spawn, and the hydra-split spawn all set the full set), so this
   never runs against an enemy missing the fields it reads.

tests/tclip2.js: new section B2 confirms, in order - exactly one shot in the 0.35s
volley carries the real cost as its own d (the other(s) stay 0); no BT.num entry ever
reads v===0 while the clip plays, driven all the way to done (the "-00" bug's own
signature - if this regresses, this is what would catch it); and the fixture's own
S.fhp is still exactly 0.97 (hand: max(0.05, 1-0.03)), not skewed by moving the cost
onto a shot's own d. Existing section B's own fhpMatches assertion is untouched - it
was never wrong, this only adds the hard-coded 0.97 check the coordinator asked for
alongside it, in the same driven-to-completion shape.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=636;", "const BUILD=637;", label="BUILD bump")

# ==================================================================== CSS: #battle.cine
# hides #bEsc (the "REINFORCEMENTS" clock) - strictly higher specificity than the bare
# .bh-esc.on/.bh-esc.hit rules bDraw() toggles every frame (2 IDs + 1 class beats 2
# classes), same order-independent approach #bRetreat already uses just below it, and
# for the same reason: bDraw()'s own hud code keeps adding/removing .on/.hit with no
# idea .cine exists, so a same-specificity/order-wins override would still race it.
do(
    ".bh-esc.hit{color:#ff5f6d}",
    ".bh-esc.hit{color:#ff5f6d}\n"
    "#battle.cine #bEsc{display:none}"
    "   /* patch635: a 2.5s cutscene has no reinforcement clock - bDraw() toggles .on/.hit on this every frame regardless of .cine, so (like #bRetreat below) this needs strictly higher specificity rather than a same-specificity, order-dependent override */",
    label="CSS: hide #bEsc (REINFORCEMENTS clock) during .cine",
)

# ==================================================================== JS: bUpdateCine()
# gains the same light drift bUpdateTurn() applies, at the very top (after the two early
# returns, before the beat logic) - copied verbatim, nothing else from turn mode.
do(
    """  BT.el+=dt;
  const c=BT.cine; c.t+=dt;

  if(!c.evolley && c.t>=0.35){""",
    """  BT.el+=dt;
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

  if(!c.evolley && c.t>=0.35){""",
    label="bUpdateCine(): drift the formation (bUpdateTurn()'s own block, verbatim)",
)

# ==================================================================== JS: exactly one
# shot in the enemy volley carries the real cost as its own d, instead of all three
# being d:0 - its arrival then prints the real number through the ordinary bFade()
# path. The cost itself still lands separately, once, at the unchanged 0.35+SHOT_T line
# right after this block - bFade()'s arrival never touches BT.hp (checked - see the
# docstring), so this cannot double-charge it.
do(
    """  if(!c.evolley && c.t>=0.35){
    c.evolley=1;
    const alive=BT.en.filter(e=>e.alive), n=Math.min(3,alive.length);
    for(let q=0;q<n;q++){
      const e=alive[Math.floor(q*alive.length/n)];
      BT.fx.push({t:"shot",x:e.x*BW,y:e.y*BH,ty:playerY(),p:0,w:0,dur:SHOT_T,
                  d:0,raw:0,miss:0,blk:0,a:1});
      sfx("foeShot");
    }
  }""",
    """  if(!c.evolley && c.t>=0.35){
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
  }""",
    label="bUpdateCine(): one volley shot carries the real cost as its own d",
)

# ==================================================================== JS: bFade()'s
# shot-arrival branch skips the floating NUMBER (not the impact fx, not the sound) when
# d===0 and it is neither a miss nor a block - a combination that never occurs in real
# play (see the docstring), so this only ever changes the clip's own synthetic d:0
# volley shots.
do(
    """      } else {
        BT.fx.push({t:"impact", x:BW*0.5, y:f.ty, a:1, raw:f.raw, r:0});
        BT.num.push({x:BW*0.5+(Math.random()*54-27)*devicePixelRatio,
                     y:f.ty-14*devicePixelRatio, v:f.d, a:1, pl:1, raw:f.raw});
        sfx("playerHit");
      }""",
    """      } else {
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
      }""",
    label="bFade(): skip a stray zero-value number on arrival (real play unaffected)",
)

assert h.count("const BUILD=637;") == 1
assert h.count("#battle.cine #bEsc{display:none}") == 1
assert h.count("d:q===0?AUTO_FHP_COST*BT.hpm:0,raw:0,miss:0,blk:0,a:1});") == 1
assert h.count("d:0,raw:0,miss:0,blk:0,a:1});") == 0   # the old unconditional zero is gone
assert h.count("if(!(f.d===0 && !f.miss && !f.blk)){") == 1
drift_block = """  for(const e of BT.en){ if(!e.alive)continue;
    e.px+=dt*e.sp*0.5; e.py+=dt*e.sp*0.7;
    e.x+=Math.sin(e.px)*dt*0.010; e.y+=Math.cos(e.py)*dt*0.008;
    e.x=Math.max(.09,Math.min(.91,e.x)); e.y=Math.max(.13,Math.min(.56,e.y));
    e.wa+=dt*e.ws*0.4;
  }"""
assert h.count(drift_block) == 2   # bUpdateTurn()'s own (unchanged) + the new one in bUpdateCine()
# ordering: the drift block sits between bUpdateCine()'s own header and the evolley beat
assert (h.index("function bUpdateCine(dt){")
        < h.index(drift_block)
        < h.index("if(!c.evolley && c.t>=0.35){"))
# ordering: bFade()'s guard sits inside bFade() itself, after cineFinish() (textually,
# same file order as before - bFade() was never moved)
assert h.index("function cineFinish(){") < h.index("if(!(f.d===0 && !f.miss && !f.blk)){") < h.index("function bUpdateLive(dt){")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch635 applied OK")
