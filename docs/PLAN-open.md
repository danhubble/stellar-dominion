# PLAN-open — the first five minutes

15 Sep 2026. Base build b616. Patches start at 617. House rules unchanged (one-purpose
anchor-asserted patch scripts, pcheck + tq2 after each, full suite per batch, shipped
`stellar-dominion.html` md5 `bcb806896f1a737146d08d7674adbce6` untouched, BUILD bump and
HANDOVER entry per patch, `mkartifact2.py` at batch end, publish by updating the existing
artifact URL).

## The problem

Owner played a fresh save on b616 and found four things wrong with the opening, all of
them about a player who has never seen the game before.

1. The prologue scene text is left-aligned while its own TAP TO CONTINUE is centred, so
   the screen reads as broken. (`shots/fresh-1-intro.png`)
2. Boot lands on the map with Sol Reach selected and the sheet open. The sheet is
   `max-height:58vh` and `#left` (SCAN SECTOR + the Getting Started box) is the last
   thing in the column, so on any viewport shorter than ~844px the one button the
   tutorial and VEGA both tell you to press is underneath the sheet.
   (`shots/fresh-2-boot.png`)
3. `.sshgrab` looks like a drag handle and is one — but the only gesture it supports is
   "drag down 70px to close". Drag up does nothing, there is no half-height rest, and the
   hit area is 38x4px. This is also the open question left over from PLAN-unify: the sheet
   covers the planet you just zoomed into.
4. A just-claimed system shows three Empty defence slots with live BUILD buttons before
   the player has banked a single unit of that system's exotic, so all three are dead
   controls. (`shots/fresh-3-defences.png`)

## Owner decisions (settled, 15 Sep)

1. Prologue text is centred when the line has no speaker. Lines with a VEGA avatar keep
   their current left-aligned card — the avatar is what makes that layout read.
2. A brand-new save boots with the sheet CLOSED. `fresh()` sets `msel:null` instead of
   `"home"`. The map square also shrinks while only home is on it, so SCAN SECTOR and the
   Getting Started box are above the fold. The Getting Started text gains one line saying
   to tap the homeworld to build (PLACEHOLDER wording, owner rewrites). Auto-open is not
   restored later — once the player has tapped a node once, the map behaves as it does
   today.
3. The sheet gets three rest heights: FULL (today's 58vh), PEEK (~26vh — title row and
   the first build row, planet visible above), CLOSED. Drag down steps FULL → PEEK →
   CLOSED; drag up steps back; a tap on the handle toggles FULL/PEEK. The handle keeps its
   4px bar but gains a ~28px invisible hit area.
4. DEFENCES stays in the sheet but its three cards are hidden until the system's exotic
   has ever been banked (`exoEverBanked()`, the same gate patch613c uses for the exo
   strip) or a slot is already filled. Until then the section shows its header plus one
   dim line naming what is needed. Not hidden outright — the player should know defences
   exist.

## Patch plan

Two runs. I verify between them.

**Run 1 — the opening (617–618).**
- 617 Prologue alignment. `playScene()` already knows whether a line has a speaker
  (`const has=!!n.who`). Add/remove a class on `.scenecard` from that flag and centre the
  card's text when it is absent. No JS behaviour change, no new state.
- 618 Boot state. `fresh()` → `msel:null`. `#mapWrap` gains a class while
  `sysInSec(mapSec)` is home-only (the `level()<8` condition patch609 already computes)
  capping it to ~30vh. One new line in the `#tut` box. Anything that assumed a fresh save
  boots with the sheet open — check `tunify2.js`, `tsheet2.js`, `tmap2.js` — is updated
  and the changed assertion is named in HANDOVER with the reason.

**Run 2 — sheet and defences (619–620).**
- 619 Sheet snap. Rewrite the `#sshGrab` IIFE (~11373) as a three-state machine. State is
  runtime-only, not saved, and resets to FULL whenever the sheet is opened from a node
  tap. PEEK is a class on `#sysSheet` setting `max-height` and `transform`, so the closed
  transform and the `.dragging` override still work unchanged. `mapZoomMeasure()` reads
  the sheet's rendered top already — it must be called when the state changes so the
  zoomed planet recomposes into the larger visible band.
- 620 Defence gate. `renderSysDef()` grows one branch before the slots loop: when
  `!exoEverBanked(r) && filled===0`, render the header plus a single dim line and leave
  `#sysDefRow` empty. Both the header key and the row key must include the gate so the
  churn guard flips correctly the first time the exotic is banked.

## Watch for

- csim byte-identical: none of this is in `tick()`'s call graph. No new `Math.random()`.
- `tchurn2` sweeps every button in the on-pane. 620 removes buttons rather than rebuilding
  them, which is fine, but the gate must be part of the `dataset.h` key or the cards will
  never come back.
- 619 changes the sheet's height at rest. `#sysThreatActs` is `position:sticky;bottom:0`
  inside it — check DEFEND IT / LET THEM HOLD is still reachable in PEEK, or force FULL
  whenever `#sysThreat` is showing.
- 618's `msel:null` means `initMapSec()` falls back to `secOf("home")`. That path already
  exists; confirm it, do not add a second one.
- The tutorial line and the prologue copy are PLACEHOLDER. Owner rewrites all story text
  in a later pass.
