# Brief — PLAN-fleets run 1: the state model

Repo `/home/claude/stellar-dominion`, branch main, clean at "PLAN-fleets: fleet button
locates the fleet". Read `README.md` (Workflow) and `docs/PLAN-fleets.md` decisions 1, 2,
6, 7, 8 and "Run 1". This run changes NO visible behaviour: one fleet, at home, plays
exactly as b640. It only moves the fleet into `S.fl[]` so runs 2 and 3 can add
position and more fleets without touching 50 sites again.

Rules (same as the pacing run)
- Edit `src/`, `python3 build.py`, then `bash tools/pcheck.sh && node tests/tq2.js`.
  Full suite: `cd tests && bash ../tools/runall.sh` (clean = only `SWEEP DONE` plus the
  three no-count files). Sim: `node tests/csim4.js > /tmp/c.txt && cmp /tmp/c.txt
  docs/sim/csim-baseline.txt` — MUST be identical; csim never fights but does buy
  ships and read `S.sh` via `__SD` — check `grep -n "sh\|fhp\|fleet" tests/csim4.js`
  first and keep whatever it reads working.
- Commits with trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01KtysoD2g8NwPFeacL27KVd`. Do not
  bump `BUILD`, do not touch `dist/` by hand or `patches/`, do not publish.
- Churn guard idiom `if(el.dataset.h!==key){…}` for anything rendered; `tchurn2`.

The model
```
S.fl = [ { id:1, n:"1st Fleet", sh:[a,b,c], hp:1, at:"home", to:null, eta:0 } ]
```
- `fresh()`: `fl:[mkFleet(1)]`, no `sh`, no `fhp`. `mkFleet(id)` lives next to
  `fleetDPS` in `01-content.js`. Fleet colours: `FLEET_COL=["#48e2ff","#a878ff","#ffd166"]`
  (cyan, violet, gold — the three ship colours) exported for run 2.
- Accessors, all in `01-content.js` next to the existing ones:
  `fleets()` → `S.fl` (self-healing: if missing/empty, create fleet 1),
  `fleet(id)`, `curFleet()` → the fleet the Raids pane is showing (`S.flSel`, an id,
  default 1, saved), `fleetAtSys(sysId)` → first idle fleet whose `at===sysId` (run 2
  uses it; here every fleet is at home).
- `fleetDPS(f)`, `fleetHPMax(f)`, `fleetCount(f)`: `f` optional, default `curFleet()`.
  `shipPower()`, `capLeft()`, `capMax()`, `shipMax()`: EMPIRE-WIDE — sum over
  `fleets()` plus stationed hangar hulls exactly as today's `S.sh`+hangar sum.
  `shipCost(i,k)` prices off the empire-wide owned count of class `i` (sum across
  fleets) so the cost curve is unchanged. `buyShip(i,k)` adds to `curFleet()` when it
  is at home, else to the first fleet at home, else queues (decision 6 — in run 1 every
  fleet is at home, so implement the routing and leave the queue as a TODO comment,
  not code). `sellShip(i,k)` sells from `curFleet()`. Repair (`repairCost`/`repair`,
  ~1291–1300) is per fleet: `repairCost(f)`, `repairFleet(f)`; the passive repair in
  `10-raids.js:4` loops every fleet.
- Hangars (`03-defence.js` 81–115): `stationHan` takes hulls from `curFleet()`;
  `recallHan`/`recallHanAll` return them to the first fleet at that system, else the
  fleet at home, else fleet 1. `12-save.js` 352–368 (the offline "fold back into S.sh"
  path) → fleet 1.
- Combat: `engageTarget(t,idx,f)`, `autoResolveTarget(t,idx,f)`, `autoEngage(idx)` →
  `curFleet()`; `BT.f=f` (the fleet in the fight); every `S.fhp` read/write inside
  `11-combat.js` (695, 1759–1765, 1813, 1829–1843, 2550, 2607, 2708) becomes `BT.f.hp`
  / `f.hp`; the loss branch that scraps 25% of hulls (1759, 1829) scraps from `BT.f`.
  `startDefence(id,f)` same. `canAutoResolve(t,f)`, `fightOdds(t,f)` (815), the
  contested-claim check at `03-defence.js:465` uses `curFleet()`. Final battle
  (decision 8): `t.final` engages with a TEMPORARY merged fleet `{sh:sum, hp:min}`;
  on end, integrity is written back to every fleet and losses are split
  proportionally — write `mergeFleetsForFinal()` / `unmergeAfterFinal()` and test it.
- Raids pane (`11-combat.js` ~2543–2720): a tab row `#flTabs` ABOVE the fleet strip
  with one `.chip` per fleet in `fleets()` (just "1" for now; run 3 adds locked
  placeholders); tapping sets `S.flSel` and re-renders. The strip, buy rows, repair
  button and target buttons all read `curFleet()`. Render the tab row under a churn
  key of the fleet ids + `S.flSel`.
- Missions (`01-content.js:692+`): "Field 20 warships" sums across fleets; the
  `fleetCount()` reads elsewhere (`(s.sh||[])`) likewise.
- `adopt()` (`12-save.js`): if `o.sh` or `o.fhp` present and no `o.fl` → build
  `[{id:1,n:"1st Fleet",sh:o.sh||[0,0,0],hp:o.fhp??1,at:"home",to:null,eta:0}]` and
  drop the old keys; if `o.fl` present, sanitise each fleet (numbers, arrays of 3,
  `at` a known system id else "home"). Save format: `S.fl` and `S.flSel` are plain
  state, nothing special.
- `__SD` export (`17-boot.js`): drop nothing that tests use without replacing it —
  grep `tests/*.js` for `S.sh`, `S.fhp`, `fleetDPS`, `fleetHPMax`, `fleetCount`,
  `engageTarget`, `autoEngage`, `buyShip`, `sellShip`, `repair` and update each
  fixture to `S.fl[0].sh` / `S.fl[0].hp`. 51 lines in tests reference `S.sh`/`S.fhp`.
  Name every changed test line in the commit message with the reason ("fixture moved
  to S.fl[0]"). Do NOT weaken an assertion; if one fails for a real reason, stop and
  report.
- `16-dev.js` dev tools that give ships / set integrity → fleet 1 / `curFleet()`.

Tests
- New `tests/tfleets2.js` (run 1 part): fresh save has one fleet at home with
  `sh=[0,0,0]`, `hp=1`; old save `{sh:[3,1,0],fhp:.6}` adopts to `S.fl[0]` and the old
  keys are gone; `buyShip` lands in `S.fl[0]`; `shipCost` equals the b640 formula for
  the same total count; `stationHan`/`recallHan` round-trip through `S.fl[0]`;
  `engageTarget` sets `BT.f===S.fl[0]` and `endBattle("timeout")` writes `S.fl[0].hp`;
  a save with `fl` missing self-heals on load; final-battle merge/unmerge with two
  fleets (`S.fl` built by hand in the test) puts integrity and losses back sensibly.
- Full suite clean, csim identical.

Commits: (1) accessors + state + adopt + buy/sell/repair/hangar; (2) combat + final
battle merge; (3) Raids pane tab row + tests. Report: the three hashes, every changed
test line with reason, anything deviated with reason. No plan recap.
