#!/usr/bin/env python3
"""
patch634 (BUILD 636) - PLAN-clip.md: tests + ship for the auto-resolve clip (patch633).

One small CSS fix, found during this patch's own screenshot verification (not by the
coordinator) - folded in here rather than given its own patch number, same precedent
patch629/630/631's own three ship-prep fixes used: `#bPause` was not in the plan's own
list of things `#battle.cine` hides (#bWep/#bPwr/#bTip/#bRetreat), and the mid-clip
screenshot below shows why it should have been - it sits there fully visible and
tappable throughout the clip, but bUpdateCine() never reads BT.paused (only
bUpdateWep() does), so tapping it is a dead, silently-ignored no-op that can even leave
the button showing a misleading "paused" (.on) visual while the clip keeps running
underneath it regardless. Directly against the plan's own framing ("the screen reads
as a cutscene, not a paused fight") - fixed the same way the other three: an
`#battle.cine #bPause{display:none}` override, positioned after the existing
`#battle.wep #bPause{display:block}` rule it overrides (same specificity, 2 IDs + 1
class, source-order-wins - identical mechanism patch633 already used three times over).

The rest of this patch's own content - the BUILD bump - carries no other functional
change to the game; patch633 already carries the clip itself, in full. This patch's
main content is the test coverage that goes with it:

- tests/tclip2.js (new): drives BT.cine through window.__SD.bUpdate() with a fixed dt,
  the same way tests/tcombat2.js drives bUpdateWep() directly, rather than waiting real
  wall-clock time (except for the one real tap on #bcv, which is deliberately a real
  Playwright click - the actual user-facing skip path, not a direct function call).
  Covers: the clip arms instead of winning the same frame (#bRes not yet .on, BT.done
  still 0); driven to completion - every hostile dead, BT.kills===BT.tot, #bRes.on,
  title "Auto-Resolved", S.fhp matching the hand-computed max(0.05,fhpBefore-
  AUTO_FHP_COST) exactly; a real tap on #bcv at t=0.1s (before the clip has charged the
  cost on its own) ends it immediately with the identical numbers; a hydra
  (BT.en[i].k="split", forced directly per the plan's own fallback - pickKind()'s RNG
  makes rolling one on demand unreliable) still ends with everything dead and
  BT.kills===BT.tot; #bRetreat hidden mid-clip, visible again once the card is up;
  prefers-reduced-motion skips straight to the card on the first frame; the t.final
  guard in bUpdateCine() (defensive - no UI path can reach it) never mis-resolves a
  final battle even if BT.cine were force-armed on one. All PASS, no flakiness found
  over repeated runs (the shield-hostile bug below was caught and fixed by this same
  repeated-run testing, before this patch was written).

- tests/tcombat2.js and tests/trivals2.js: both called autoResolveTarget() and read the
  result (S.taken/S.fhp, or S.occ/sysHeld()/rate()) on the same tick - genuinely
  invalidated by patch633 (the win no longer lands synchronously). Both now drive
  window.__SD.bUpdate() to BT.done first, same pattern as tclip2.js; tcombat2.js's own
  assertion label for the auto-resolve case (previously "grants the win instantly...
  without playing the fight") no longer described what happens and was reworded to
  match, plus one new assertion (BT.cine actually arms) - no assertion was weakened or
  deleted, only widened to cover the new async shape.

A real bug in patch633 was caught here, before this patch was ever written, by running
tests/trivals2.js repeatedly rather than once: an "overkill" hit of exactly
e.hp+e.shp+1 is NOT actually lethal against a shielded hostile - hitEnemy() only lets
0.35x of whatever is left over after shields soak their share through to hull (see its
own comment), so a shielded target would absorb the "+1" and survive with most of its
hull intact, leaving the clip's queue permanently unable to declare a win. Fixed in
patch633.py itself (not here - the bug never shipped) by multiplying the overkill by
10x, comfortably clearing that discount with margin to spare regardless of how much
shield a target is carrying; see patch633's own HANDOVER entry and code comment for the
full account. Confirms the house rule earns its keep: "any failure is yours until
proven otherwise, never test noise" - this one very nearly was mistaken for exactly
that (an intermittent, RNG-seeded failure) before the actual mechanism was found.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=635;", "const BUILD=636;", label="BUILD bump")

do(
    "#battle.wep #bPause{display:block}",
    "#battle.wep #bPause{display:block}\n"
    "#battle.cine #bPause{display:none}"
    "   /* patch634: found during this patch's own screenshot verification - see docstring */",
    label="CSS: hide #bPause during .cine (found during screenshot verification)",
)

assert h.count("const BUILD=636;") == 1
assert h.count("#battle.cine #bPause{display:none}") == 1
assert h.index("#battle.wep #bPause{display:block}") < h.index("#battle.cine #bPause{display:none}")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch634 applied OK")
