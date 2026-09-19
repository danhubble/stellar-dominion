# PLAN-pacing — the flat stretch and the Node drought

17 Sep 2026. Base build b638. Patches start at 637. House rules unchanged, with ONE
deliberate exception noted under "Watch for": this batch changes pacing on purpose, so
the csim byte-identical rule is replaced by a before/after comparison and a new baseline.

## The problem (owner, after the first run to the ending)

1. Early game is too slow. Until level 8 the whole game is "buy the next tier". Nothing
   else is going on; a new player could bounce.
2. Exotic Nodes arrive far too slowly, and nothing tells you where they come from.

## What the code says today

- `UNLOCK`: Missions lv 3, Research lv 5, Market lv 6, **Map lv 8**, **Raids lv 12**, Nexus
  lv 20. `LVXP_PTS`: lv 8 = 330 XP, lv 12 = 600 XP.
- `enRate()`: `EN_RING3=1`, `EN_RING4=3` Nodes/hour per held system (`/3600` per second).
  Both TUNING-PENDING. Ring-3 systems: 4 in Frontier, 3 in The Deep; ring-4: 3 in The
  Deep, 5 in Beyond. Core and Inner Reach produce none.
- THE PROJECT card (Nexus page) shows "60 Nodes" and nothing else. The only explanation
  is the PLACEHOLDER VEGA line ("I do not have a better name for them yet"), which fires
  only once `S.en>0` — i.e. after the player has already found them.
- Balance and rate are visible only in the exotic popup behind the header card.

## Owner decisions (to settle when we start — proposed defaults in bold)

1. **Map at level 5** instead of 8 (Research and the map arrive together; the "more
   systems on the charts" beat moves with it). Raids at **level 9** instead of 12 so the
   second loop opens before the first one goes stale. XP thresholds untouched.
2. **Node rates ×4**: `EN_RING3=4`, `EN_RING4=12`. Resonance Array (60) from one Frontier
   system: 15 h → still slow alone, ~4 h with all four Frontier systems, minutes once
   The Deep is held. Project prices unchanged for now; revisit after a second run.
3. **Tell the player.** One line under THE PROJECT header: "Nodes come from held
   systems in Frontier (N/h each), The Deep and Beyond (M/h)" read from the constants,
   never hard-coded. Each Project card shows "you make R/h · ~T to go" when R>0. The
   VEGA project line gets rewritten (owner copy — PLACEHOLDER until then) and fires when
   the first ring-3 system is *claimed*, not when the first Node lands.
4. Level-1 to level-5 stretch: no new mechanic. If the sim shows the first five levels
   still take longer than ~8 minutes of active play, bring the first Missions unlock to
   level 2 and let the first contract pay enough for the first non-drone tier. Decide on
   the numbers, not on feel.

## Patch plan (one run, four patches)

- 637 Unlock levels. `UNLOCK` map 8→5, raids 12→9. Every place that reads `level()<8`
  for the reveal (patch609: `sysInSec`, `renderMapChips`, `#mapWrap.homeonly`, the
  `checkUnlocks` beat, `adopt()`'s "S.msel in another sector below 8" clamp) must read
  the `UNLOCK` entry, not the literal — grep for `<8` and `>=8` and fix each. Old saves:
  a level-6 save that had no map suddenly has one — that's fine; a level-6 save with the
  old `vega:map` notice already seen must not get it twice (`S.seen`).
- 638 Node rates. The two constants. Nothing else.
- 639 Node explanation. The Project header line, the per-card rate/ETA line (guarded
  render, `tchurn2`), the VEGA trigger moved to first ring-3 claim, `exoEverBankedAny()`
  unchanged.
- 640 Tests, sim, ship. `tests/tpacing2.js`: unlock levels, reveal at 5, no double
  notice on an old save, rates, the header line reads the constants, ETA maths.
  `tunify2`/`topen2`/`tlockstates2`/`ttaborder2` reference level 8 — update and name
  each. Sim: run `csim4.js` before and after, keep BOTH outputs in HANDOVER with a short
  table: time to lv 5 / lv 8 / lv 12 / first raid / first Node / Resonance Array. Then
  save the new output as the baseline the byte-identical rule checks against from here.

## Watch for

- The csim exception is for THIS batch only. Nothing in the plan touches `tick()`
  beyond the two constants; if the after-sim moves anything other than the rows above,
  something else changed and it's a bug.
- `level()<8` literals: patch609 said "the map is always visible, the entry reveals
  systems" — keep that shape, just move the number to the table.
- Notices: `checkUnlocks()` queues `vega:map` at the map level. Moving the level must not
  re-queue it for players past 8 (`S.seen` / `S.unlocked` guard — check which one).
- Don't touch Project prices, XP thresholds, or building costs in this batch. One lever
  per patch, so the sim table says which lever did what.
