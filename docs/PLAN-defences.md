# PLAN-defences — defence slots + the system sheet

13 Sep 2026. Base build b593. Patches start at 594. House rules unchanged (one-purpose
anchor-asserted patch scripts, pcheck + tq2 after each, full suite per batch — baseline is
`tcore2` 4 known failures — shipped `stellar-dominion.html` md5
`bcb806896f1a737146d08d7674adbce6` untouched, BUILD bump and HANDOVER entry per patch,
`mkartifact2.py` at batch end, publish by updating the existing artifact URL).

## The problem

Fortifying is one button that counts to 8. Every level is the same generic +%, so there is
no decision in it, and the map panel sits below the map so every fortify is a scroll.

Owner data point: three defences in a session, two of them delegated ("hold the line without
me"). So **the strategy has to live in the delegated odds**, not only in the mini-game. A
module that only matters when you fly the fight yourself is a module the owner will never
feel.

## Owner decisions (settled)

1. **Old defence levels are dropped.** No conversion, no refund — `S.sd`/`S.sdq` go away and
   every system starts with empty slots. (Existing saves still load; they just lose defences.)
2. **Five modules** in v1: Turret Ring, Minefield, Shield Array, Sensor Mast, Hangar.
3. **The sheet replaces the Map panel everywhere** — claim, assault, fortify, threats.
4. **Three slots from the moment you claim a system.** Cost is the gate, not unlocks.
5. Row-of-cards layout, detail strip under the row when a card is tapped (mock D/E/F,
   `fortify-mock2.html` in the bundle).

Open, not blocking: exact numbers (all TUNING-PENDING below), whether a sixth module
(Repair Dock) lands later, whether slots ever become kind-locked.

## The loop this creates

You get a day's warning → the sheet names who is coming and how they fight → you refit for
it → you fight it or let the garrison have it. Sensor Mast is what makes the rest strategic:
without it you are guessing, with it you are answering.

## Modules

Per system, 3 slots, one module each. Priced in that system's own exotic (ore worlds pay ore,
same rule `sdCostOre()` already uses). Build time as now (`SD_BUILD_BASE`/`SD_BUILD_PER`
shape). Swapping a module refunds half.

| id | name | levels | what it does (delegated) | what it does (mini-game) |
|----|------|--------|--------------------------|--------------------------|
| `tur` | Turret Ring | 1–3 | +0.6 garrison strength per level | one auto-turret per level (existing `sdTurrets` behaviour) |
| `min` | Minefield | one-use | +0.9 garrison strength while armed, spent on any attack | detonates as the first wave arrives, killing/damaging it |
| `shd` | Shield Array | 1–3 | +0.4 garrison strength per level | ×(1+0.25×lv) system hull (existing `hullMul` slot) |
| `sen` | Sensor Mast | 1 | +0.3 garrison strength | — (its value is information, see below) |
| `han` | Hangar | 1 | +garrison scaled by stationed fleet DPS vs par | stationed ships fly and fire beside you |

All five numbers TUNING-PENDING. Garrison strength feeds `holdOdds()` exactly as
`sdStrength()` does today — that function stays, it just sums modules instead of reading a
level.

**Minefield is the one with a running cost.** One use, spent whether it fires or not, so a
frontier world under pressure costs exotic every time. Everything else is fit-and-forget.

**Sensor Mast** does three things, all information: the threat's telegraph window on this
system is longer (×1.5 `THQ_LIFE`), the threat card and sheet name the attacker's archetype
and doctrine in words, and the sheet shows what the odds would become if you rearmed/upgraded
before they land ("rises to 71% if you rearm").

**Hangar** stations fleet here: those hulls come off `fleetCap` availability until you pull
them back, and defend this system. This is the straight trade — safe borders or a bigger
raiding fleet.

**Counters, in one line each** (what the sheet says when Sensor Mast is fitted):
Helion swarm many light hulls → mines and turrets. Covenant arrive heavy and slow → shields
and stationed hulls. Vasht garrisons are ambient and do not attack.

## The sheet

Replaces `#sysInfo`/`#sysAct` on the Map tab. Tap a system node → a bottom sheet slides up
over the map; the map stays where it is; nothing scrolls to reach an action. Drag down, tap
the ✕, or tap the map to close. One component, four states:

- **Unclaimed** — description, claim cost, level gate, CLAIM button (or LOCKED · LEVEL n).
- **Contested / occupied** — garrison, archetype, ships, ASSAULT / RETAKE, or the en-route
  and ENGAGE states (`S.trip`) exactly as they work now.
- **Held** — name, kind badge, ring, exotic rate; "GARRISON HOLDS n%" with a bar and one
  line of explanation; the defences row; STATION FLEET; CLOSE.
- **Under attack** — red threat block at the top (rival, clock, doctrine line if Sensor Mast
  is fitted, and what would raise the odds), then the defences row, then DEFEND IT /
  LET THEM HOLD · n%.

**Defences row**: three equal cards. Each card shows icon, name, level or state badge
(ARMED / SPENT / BUILDING with a countdown), its odds contribution (+18%), and one button
(UPGRADE / REARM / BUILD) with the cost. Tapping a card selects it and opens a detail strip
below the row: full name, cost and build time, effect line, and the two-sentence description
including what it is good against. Empty slots are dashed with a BUILD button that opens the
module picker (same row area, list of the five with cost, effect and one line of guidance;
unaffordable ones dimmed with what you are short).

Mocks: `fortify-mock2.html` states D (row), E (card tapped), F (under attack) — and
`fortify-mock.html` for the earlier column version, kept for reference only.

## State and save

- New `S.def = { <sysId>: { s:[slot0,slot1,slot2] } }`, each slot `null` or
  `{ m:"tur"|"min"|"shd"|"sen"|"han", lv:1, armed:true, q:{to,dueAt} }`.
- `S.han = { <sysId>: [n0,n1,n2] }` — ships stationed per hull class, or keep it on the slot.
  Implementer's call; whichever keeps `fleetCap` accounting in one place.
- `S.sd` / `S.sdq` are removed. `adopt()` deletes both, defences start empty, no refund.
- Everything else about rivals, threats and the defence mini-game keeps working unchanged.

## Patch plan

Three runs. I verify between each.

**Run 1 — the sheet (594–596).**
594 fold in the outstanding intro fix first: RESTART GAME must play the opening sequence and
queue `vega:boot`, same as a first boot (one shared `playOpening()`).
595 sheet component: move the existing Map panel content into a bottom sheet with all four
states, no gameplay change — fortify still works as it does today.
596 tests + screenshots for the sheet at 390px; `tmap2`/`tchurn2` updated for the new
structure, and the reasons stated.

**Run 2 — modules (597–599).**
597 `S.def`, the five module definitions, `defStrength()` replacing `sdStrength()`'s level
read, build/upgrade/rearm/swap, `adopt()` drop of `S.sd`.
598 defences row + detail strip + picker in the sheet; costs, build countdowns, state badges.
599 Sensor Mast: telegraph extension, doctrine text on the threat card and sheet, the
"rises to n%" preview.

**Run 3 — fleet and the fight (600–602).**
600 Hangar: station/recall UI, `fleetCap` accounting, stationed hulls in `defStrength()`.
601 mini-game: mines detonating on arrival, shield hull, stationed ships drawn and firing.
602 `tests/tdef2.js`, full suite, csim diff, screenshots, HANDOVER, artifact rebuild.

## Watch for

- csim must stay byte-identical: no new `Math.random()` in `tick()`'s call graph (hash off
  `S.cseed`, see patch580).
- The sheet must not break the Empire tab's "tap a row → Map" path, or `tchurn2`'s churn
  guards (the sheet rebuilds on selection, not every frame).
- `holdOdds()` must stay honest: the number on the card and the number the fight uses come
  from the same function, always.
