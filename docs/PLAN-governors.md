# PLAN-governors — someone else runs the system

21 Sep 2026. Base b642. Owner: "I've captured all of the systems within the first
sector and can't keep up managing them." Defaults accepted 21 Sep. Ships together with
the per-fleet cap follow-up from PLAN-fleets.

## What the code says today

- Research node `auto` ("Automation Cores", `01-content.js` ~584): 10 levels, crystal
  cost `25×3.2^lv`, requires Drill 4, gates Void Cartography (`req:{id:"auto",lv:2}`).
  Its effect was retired in patch403; the only place it used to act is the comment in
  `tick()` (`06-progress.js` ~212). Buying it today does nothing.
- Building purchases go through `ladderBuy(id,gi)` (`04-actions.js`): checks
  `tierBuildable`, ore, the tier's exotic, then buys `k` tiers (`S.buy` amount).
  `ladderCost(id,gi,k)`, `ladderMaxAff(id,gi)`, `sysNextGi(id)`, `sysTierCount(id,gi)`
  exist. `xpOnBuild` and the first-drone notice fire inside `ladderBuy`.
- Per-system state: `S.sys[id]={b:{gi:count}, …}`.
- The system page BUILDINGS block is `renderSysBuild(s,held)` (`09-render.js` ~1079),
  churn-guarded.
- `tests/csim4.js` runs `tick()` for simulated hours and may buy research, including
  `auto`. It never toggles per-system flags that do not exist yet.

## Owner decisions (defaults, 21 Sep)

1. **The node becomes Governors.** `auto` is renamed in copy only (id stays `auto` so
   saves and the Void Cartography requirement are untouched): n:"Governors", d:
   `lv?"Appoint up to "+lv+" governor"+(lv>1?"s":""):"No governors yet"`, t:
   PLACEHOLDER copy. `max` 10→**3**; cost curve unchanged (25 / 80 / 256 crystal). A
   save with `S.rs.auto>3` is clamped to 3 in `adopt()`. Later Nexus levels can raise
   the count — not in this batch.
2. **What a governor does.** A system with a governor buys **the cheapest affordable
   next step on its own ladder** — either one more of an owned tier or the next reveal
   (`sysNextGi`) — **once every `GOV_EVERY=20` s** of game time (TUNING-PENDING),
   buying **one** unit (`k=1`), never "max". It spends only from a **budget**: it may
   spend at most `GOV_SHARE=0.5` (TUNING-PENDING) of the ore the empire earned since
   its last purchase — tracked as a per-governor bank `S.sys[id].gb` that accrues
   `rate()*dt*GOV_SHARE/govCount` each tick and is drawn down by purchases; it never
   touches ore the player already had. Exotic-gated tiers are bought only if the
   exotic is there too (same rule as `ladderBuy`; `ladderBuy` itself is the buy path
   — call it with `k` forced to 1, don't duplicate it). Defence modules, fleets,
   research: never.
3. **Appointing.** On a held system's page, under the BUILDINGS header: a GOVERNOR
   toggle (a `.chip` "GOVERNOR · OFF/ON"). ON is allowed while
   `govCount() < lv(S.rs,"auto")`; otherwise the chip reads "GOVERNOR · n/n" and a tap
   toasts "Research Governors for another". Home can have one. Losing a system
   (occupation) suspends its governor; it resumes on reclaim. The Empire LIST view
   marks governed systems with a small ◆ in the row.
4. **Cost.** Free once appointed. The research is the cost.
5. **Feedback.** A governor purchase shows the normal buy blip only if the system's
   page is open; otherwise silent. The system page shows "Governor bought Smelter Pod
   · 12s ago" as one line under the toggle (churn-keyed, coarse time). VEGA beat
   `vega:governor` (PLACEHOLDER) on the first appointment. Stats page: "Bought by
   governors" counter (`S.govBuys`).

Rejected: governors that also fit defences (a second automation surface, and defence
choices are the player's); an ore upkeep (fiddly, and the research cost already
gates it); governors buying "max" (would drain the bank in one tick and make the
budget meaningless).

## Batch (one run, then per-fleet cap as its own commit)

Commit 1 — node copy + clamp. Rename, `max:3`, `adopt()` clamp, `tprogresearch2`
and any test that reads the node's name/max updated and named.

Commit 2 — the governor tick. `govTick(dt)` in `06-progress.js`, called where the
patch403 comment sits (inside `tick()`, so offline catch-up covers it through the
same path as production — confirm `offlineReport()` calls `tick()`-equivalent maths
or add the governor bank accrual there explicitly; purchases during offline catch-up
are allowed, capped at one per `GOV_EVERY` of away time, max 50). Per-system fields
`gov:1`, `gb:0`, `gt:0` (timer), `gl:{gi,t}` (last buy). `govCount()`. csim: nothing
changes unless `gov` is set somewhere, which csim never does → baseline identical.
Assert that in the run.

Commit 3 — UI. The toggle chip, the last-buy line, the LIST ◆, the Stats counter,
the VEGA beat, the notice. All churn-keyed; `tchurn2` clean.

Commit 4 — per-fleet cap (PLAN-fleets follow-up). `capLeft(f)`/`capMax()` per fleet;
hangar hulls count against the fleet they were stationed from (store `from` on the
hangar entry; old entries default to fleet 1); `shipMax`, buy buttons and the strip's
"112/60" read the selected fleet. Raids par unchanged. `tfleets2` assertions: each
fleet may reach `fleetCap()` alone; hangar round-trip keeps the attribution.

Commit 5 — tests + docs. `tests/tgov2.js`: node max 3, clamp, toggle limit, one buy
per `GOV_EVERY`, budget never exceeds `GOV_SHARE` of earnings, exotic gate honoured,
occupation suspends, offline cap, csim identical. Screenshots at 390x667 and 390x844:
the toggle OFF/ON, the last-buy line, LIST with ◆, the research card.

## Watch for

- The bank accrues from `rate()`, which is the empire's ore rate — a governor on a
  poor system still gets its share. Fine for v1; per-system share later if it feels
  wrong.
- `ladderBuy` reads `S.buy` — the governor must not be affected by the player's
  ×1/×10/MAX chip. Pass an explicit `k` (add an optional third parameter, default
  today's behaviour).
- `xpOnBuild` inside `ladderBuy` grants XP for governor buys too. Intended (the
  empire grew), but the milestone toasts it can fire must not spam while the page is
  closed — check what `xpOnBuild` toasts and gate the toast on the page being open.
- No `Math.random()` in `govTick`.
