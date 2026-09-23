# PLAN-polish — wrapping up

23 Sep 2026. Base b643. Owner played a fresh save through to level 15 and listed what
he saw. No new content systems beyond what is here; the game is being finished.

## Batch A — fixes (one run)

1. First level-up prompts twice (two messages) → one message.
2. After the first Mining Drone, scroll so the newly revealed Smelter Pod row is visible
   (first reveal only; `S.seen` guard).
3. "contracts" → "missions" in every player-facing string (VEGA lines, toasts, headers).
4. VEGA "TAKE ME THERE" for `vega:map` lands on the MAP (close any system page:
   `S.msel=null`), not the current system. For `vega:raids`, if a level-up modal is
   pending, the modal must not swallow the navigation — navigate first, then show it.
5. VEGA lines when Raids open (PLACEHOLDER, owner rewrites): buy ships, fit weapons,
   officers. Two or three short beats, queued.
6. First salvage earned: pulse/highlight the salvage counter (`.rcard.land` idiom) when
   VEGA's salvage line fires.
7. Header cards: ore · crystal · dark matter back in the top three; the Nexus/context
   card moves (owner: "I miss having the crystal there"). Keep the context card
   reachable — put it where the crystal strip was on the Research tab, or as a fourth
   narrow card; mock at 390x667 first, one screenshot is enough.
8. Remove Records & Graphs (stats page) and its notification dot. Replace the far-right
   tab with ACHIEVEMENTS if achievements exist as data (`checkAchs()` — check what it
   records); otherwise just remove.
9. Remove TRANSFER from the Raids tab (keep it on the fleet card).
10. "DELIVERS AT SOL REACH" → "NO SHIPYARD HERE" (PLACEHOLDER).
11. Remove Command Lattice from the helium programme (turn mode is dev-only). Refund
    nothing; `adopt()` drops `S.xp.comm`.
12. Buy button says where the ship lands when it is not the selected fleet.
13. Getting Started box: hide once the player has claimed a system.

## Batch B — pacing (numbers only, csim before/after table, new baseline)

1. Level 2→3 XP lower (`LVXP_PTS[3]`).
2. One level per event: `grantXp` never advances more than one level at a time; surplus
   banks toward the next (owner: levelled twice from four missions at once, twice
   again on the first claim).
3. Market unlock → level 9 (with Raids), so salvage has a use when it appears.
4. Fleet 2 → level 16, Fleet 3 → level 22 (owner: "should come in later").
5. New systems start their ladder at a tier that matches the economy: on claim, the
   first visible tier is the lowest one whose cost is ≥ ~1% of current ore/s × 60 —
   Drakshold at millions of ore starts on Crust Borers, not Mining Drones. Lower tiers
   are skipped, not hidden-then-bought.

## Batch C — features (one run)

1. **Shipyard** building: a defence-slot module or a ladder tier on ring ≥1 systems;
   a fleet at a system with a Shipyard can buy ships there. Buy routing: selected fleet
   if it is at a shipyard system (home counts), else queue as today.
2. **Governors v2**: chain to 6 (Nexus levels raise it further), governors may also fit
   the cheapest affordable defence module in an empty slot (once per 60 s), budget
   share 0.5→0.75. Owner: "more involved, fine if they spend more".
3. **First-planet ambush**: a small scripted threat on the first claimed system,
   arriving 90 s after the claim, with a VEGA line pointing at DEFENCES. One-time,
   `S.seen` guarded, weak enough to hold with one module.

## Parked

- Fleet must be present to claim (owner: leave it).
- Mission tag on building tabs (needs a mock; maybe later).
- Owner copy pass (all PLACEHOLDER lines) — coordinator pulls them into one file.
