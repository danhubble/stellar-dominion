# Brief — PLAN-fleets run 3: fleets 2 and 3

Repo `/home/claude/stellar-dominion`, main, clean at "Release b641". Read `README.md`,
`docs/PLAN-fleets.md` (decisions 1, 6, 8), `docs/BRIEF-fleets-run1.md` and
`docs/BRIEF-fleets-run2.md` (what exists: `S.fl[]`, `fleets()/fleet()/curFleet()/
fleetAtSys()/mkFleet()`, `FLEET_UNLOCK`, `FLEET_COL`, `travelSecs/fleetSend/
fleetTravelTick`, `#fleetBar` + `renderFleetBar()`, markers, `#flTabs` on the Raids
pane, `mergeFleetsForFinal()`). Same rules as before: build → pcheck → tq2 after every
edit, full suite, csim byte-identical vs `docs/sim/csim-baseline.txt`, commit trailers,
no BUILD bump, no publish, never edit dist/ or patches/, churn keys on everything
rendered.

## Commit 1 — unlocking fleets 2 and 3
- `fleetSlots()` = number of fleets the player may have: count of `FLEET_UNLOCK`
  entries ≤ `level()`. `ensureFleets()` (called from `adopt()` after sanitising and
  from the level-up path — find where `takeLevel()` or `checkUnlocks()` runs): while
  `fleets().length < fleetSlots()` push `mkFleet(nextId)` at "home" and queue a notice
  `vega:fleet2` / `vega:fleet3` (PLACEHOLDER lines in `08-story.js` NOTICES/VEGA, `go:
  "p-map"`, seen-guarded like the others; mark them seen in `adopt()` for saves that
  already have those fleets so an old level-22 save does not get two notices on load —
  actually it should get them once, since the fleets are new to that save; give it
  ONE combined toast "2nd and 3rd Fleet commissioned at Sol Reach" instead and mark
  both notices seen. Decide and say which you did.)
- The level-up modal (`lvModal`, `06-progress.js`) lists "This one also opens 2nd
  Fleet" for a level in `FLEET_UNLOCK` (index ≥1), same styling as the UNLOCK lines.
- Fleet bar: slots ≤ `fleetSlots()` are real buttons; the rest stay "LOCKED LV n".
  Never show fewer real buttons than `fleets().length`.
- Names: "1st Fleet", "2nd Fleet", "3rd Fleet" (`ordFleet(id)` helper), colours from
  `FLEET_COL`.

## Commit 2 — TRANSFER and purchase routing
- Fleet card modal (the second tap on a selected bar button, run 2): add TRANSFER,
  enabled when another idle fleet (`!to`) is at the same system. `transferModal(a,b)`:
  three rows (Interceptor / Frigate / Dreadnought), each `− [a n] ⇄ [b n] +`, moving
  one hull per tap (long-press not needed), DONE closes. Both fleets stay put. Also
  reachable from the Raids pane fleet strip: a small TRANSFER button next to REPAIR
  when applicable.
- `buyShip(i,k)` routing (decision 6): `curFleet()` if it is at home and idle; else
  the first idle fleet at home; else queue on `S.flQ=[a,b,c]` (counts) and the buy
  button says "DELIVERS AT SOL REACH" (PLACEHOLDER) — the queue lands into the first
  fleet that arrives at home (in `fleetTravelTick` arrival, and on load if a fleet is
  at home). `shipCost` keeps pricing off the empire-wide count INCLUDING the queue.
  `sellShip` sells from `curFleet()` only when it is idle (travelling fleets can't sell).
- Raids pane `#flTabs`: one tab per real fleet; the selected tab's strip shows
  "AT <system>" / "→ <system> · 32s"; ENGAGE/AUTO on a target card use the fleet AT
  the target's system (run 2 already does — confirm), independent of the selected tab.

## Commit 3 — three fleets everywhere
- Map: markers for all fleets (run 2 handles N already — confirm with three; two
  fleets at one node stack side by side, not on top of each other: offset each
  additional marker 14px right).
- Per-fleet clip/auto-resolve: `autoResolveTarget(t,idx,f)` uses the fleet at the
  target (run 2) — assert with two fleets in a test.
- Final battle merge with 3 fleets (run 1's merge) — test it with three.
- The FLEETS block on a system page lists every fleet here.
- Missions "Field 20 warships" sums all fleets + the queue.

## Commit 4 — tests, screenshots, docs
- `tests/tfleets2.js` (append): level 13 → 1 slot, 14 → 2, 20 → 3; an old level-22
  save with one fleet gains two on load (at home, hp 1, empty) and only one toast;
  `lvModal` at 13→14 mentions 2nd Fleet; transfer moves hulls both ways and refuses
  when the fleets are apart; buyShip lands in the fleet at home, queues when none is
  home, queue lands on arrival; shipCost includes the queue; three markers render;
  two fleets at one node are offset; tchurn2 still clean.
- Screenshots via a script in `tools/shots/` with `browser.newContext({viewport,
  isMobile:true})` at 390x667 AND 390x844 to `shots/fleets-r3-*.png`: bar with three
  real fleets, three markers (two stacked at home), transfer modal, Raids tabs with
  fleet 2 selected showing "→ X · 32s", level-up modal at 14. Look at each.
- Short HANDOVER entry; the detail lives in commit messages.

Report: four hashes, changed existing test lines with reasons, deviations with
reasons, screenshot paths. No plan recap.
