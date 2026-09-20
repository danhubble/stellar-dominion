# Brief — PLAN-fleets run 2: position, travel, the fleet bar

Repo `/home/claude/stellar-dominion`, main, clean after run 1 (`S.fl[]`, one fleet at
home, accessors `fleets()/fleet(id)/curFleet()/fleetAtSys()/mkFleet()` in
`01-content.js` ~1293). Read `README.md`, `docs/PLAN-fleets.md` decisions 3, 4, 5 and
"Run 2", `docs/BRIEF-fleets-run1.md` (the model), and `tools/mkfleetmock.py` (the
owner-approved mock — copy its look and interaction, not its code; it polls on a timer,
the real thing renders under churn keys).

Same rules as run 1 (build → pcheck → tq2 after every edit; full suite; csim
byte-identical against `docs/sim/csim-baseline.txt`; commit trailers; no BUILD bump,
no publish, never edit dist/ or patches/).

## Scope change vs the plan (coordinator decision, keep it)
Threats/DEFEND IT are NOT gated on fleet position in this run. The defence mini-game
(`startDefence`, DT) is a garrison fight and never used the fleet; gating it would
change a mechanic the owner did not ask to change. Run 2 only SHOWS which fleets are at
a threatened system in the FLEETS block. Position gates raids only.

## Commit 1 — travel
- `01-content.js` next to the accessors: `FLEET_COL`, `TRAVEL_BASE=20`,
  `TRAVEL_PER_UNIT=0.4`, `TRAVEL_PER_RING=45` (all TUNING-PENDING comments).
  `travelSecs(fromId,toId)`: same sector → `TRAVEL_BASE + TRAVEL_PER_UNIT*dist(sx,sy)`;
  different sector → `TRAVEL_BASE + TRAVEL_PER_RING*|ringA-ringB|` (ring = `SYS.ring`;
  sector = `s.sec`). `fleetSend(f,toId)`: refuses if `f.to` (already travelling),
  `toId===f.at`, unknown system, or a fight is on (`BT`/`DT`); sets `f.to, f.eta,
  f.from=f.at, f.tot=eta` (`tot` so the marker can slide); toast "1st Fleet departing
  for X · 41s"; `dirty=true`. `fleetTravelTick(dt)`: every fleet with `to`: `eta-=dt`;
  at ≤0 → `at=to, to=null, eta=0, from=null`, toast "1st Fleet arrived at X", `flag`
  the map tab. Called from `05-rivals.js:41` right after `thqTick(dt)` (same clock),
  and from `offlineReport()` (`12-save.js` ~470) with `away` — arrivals while away land
  silently (no toast, one line in the offline report if it already lists events;
  otherwise skip the line).
- Sanitise in `adopt()`: `to` must be a known system id else cleared; `eta` a number.
- `__SD`: export `travelSecs, fleetSend, fleetTravelTick, TRAVEL_*, FLEET_COL`.

## Commit 2 — raids have a place
- `newTarget()` (`01-content.js` ~1386): add `sys`: pick from revealed systems
  (`level()>=unlockLv("p-map")` ? systems in sectors ≤ the highest ring the player
  holds +1, else just home) with the existing `Math.random()` stream — the sim never
  calls `newTarget()` (grep `tests/csim4.js` to confirm before relying on it). Old
  targets without `sys` → `sys:"home"` in `adopt()`.
- `engageTarget(t,idx,f)` / `autoResolveTarget`: `f` defaults to
  `fleetAtSys(t.sys)`; if none, toast "No fleet at X" and return. `canAutoResolve(t)`
  likewise requires a fleet there.
- Raids pane target cards (`renderRaids`, `11-combat.js` ~2543+): a location line
  "near <system>" and the button: ENGAGE / AUTO as today when a fleet is there;
  otherwise one button "SEND 1st FLEET · 41s" (nearest idle fleet by `travelSecs`)
  calling `fleetSend`; while that fleet is en route to it, "ARRIVING · 32s" disabled.
  Churn key includes `t.sys`, fleet `at/to/eta` (eta rounded to seconds).

## Commit 3 — the fleet bar and map markers
- Markup (`src/index.html`): `<div id="fleetBar"></div>` directly after `#mapWrap`
  (inside `#p-map`, before `#sysSheet`). CSS in `05-map.css`: 3-column grid, gap 6px,
  8px below the map, buttons styled like `.rmode` buttons (MAP|LIST), number in the
  fleet colour, `.sel` state lit, `.locked` dim. Shown on the map view and on a
  system page (`body.syspage`) — check it does not push the system page's header
  around; if it collides, put it under `#mapZoomBar` on the page and say so.
- `renderFleetBar()` called from `render()` after `renderMap()`; churn key = for each
  fleet `id|at|to|eta_s|sel` + locked slots. Slots 2 and 3 render as "2 · LOCKED LV
  14" / "3 · LOCKED LV 20" from `FLEET_UNLOCK=[unlockLv("p-raid"),14,20]` (define it now
  in `01-content.js`; run 3 uses it). Hide the whole bar below the Raids level.
- Interaction A (runtime var `flSel=null`, not saved):
  tap a fleet button → `flSel=id`; LOCATE: `setMapSec(secOf(f.to||f.at))` if
  different; marker pulses (class). Tap the same button again → fleet card modal
  (`showModal`): name, hulls per class, integrity %, REPAIR (calls the existing
  per-fleet repair, disabled when full or unaffordable), TRANSFER placeholder button
  disabled with "run 3" tooltip text — no, omit TRANSFER entirely this run.
  With `flSel` set: node taps are intercepted (capture-phase listener on `#mapNodes`,
  `stopPropagation`) and show a `.sendchip` on that node "SEND · 41s" (or "HERE" if
  `at===id`); tapping the chip → `fleetSend`, `flSel=null`; tapping the map
  background or switching tab → `flSel=null`, chip removed. The sector swipe/chips
  still work while selected.
- Markers: in `renderMap()` after nodes are built, one `.flmark` per fleet whose
  `at` (or `to`/`from`) is in the shown sector: a 16px circle with the number, fleet
  colour, positioned at the node; travelling: a dashed SVG line in `#mapLinks` from
  `from` to `to` and the marker at `from + (to-from)*(1-eta/tot)`, with a tiny ETA
  label. Update position every frame cheaply (one transform per travelling marker —
  no DOM rebuild; build under a churn key, move under a per-frame call).
- System page FLEETS block (`renderSysPage`/`#sysSheet`, above DEFENCES): header
  "FLEETS", one line per fleet here ("1st Fleet · 5 Interceptors · 1 Frigate"), or
  "No fleet here." Churn-keyed. No buttons.

## Commit 4 — tests + docs
- `tests/tfleets2.js` (append): `travelSecs` same-sector and cross-ring numbers for
  two known pairs; `fleetSend` then `fleetTravelTick(eta+1)` lands `at`; refuses
  while travelling; `engageTarget` refused with no fleet at `t.sys`; a target card
  shows SEND when the fleet is away and ENGAGE when it is there; offline arrival
  (save with `to` set and `eta` 10, reload after `lastSeen` 60 s earlier → landed);
  fleet bar hidden below Raids level, one real + two locked buttons at level 12;
  tapping the bar button switches `mapSec` to the fleet's sector; node tap while
  selected does NOT open the system page and shows the chip; chip tap sends.
- `tchurn2` must still pass — the bar, markers, FLEETS block and target cards are
  churn-guarded.
- HANDOVER entry (short), commit messages carry the detail.

Report: four hashes, every changed existing test line with reason, deviations with
reason, and 390x667 + 390x844 screenshots (write them to `shots/fleets-r2-*.png` with
a script in `tools/shots/`, using `browser.newContext({viewport:…,isMobile:true})` —
NOT `newPage({viewport})` on a context, which ignores it): bar idle, fleet selected
with chip, mid-travel, raid card SEND state, raid card ENGAGE state, FLEETS block on a
system page. Look at each before reporting.
