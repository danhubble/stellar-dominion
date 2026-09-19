# PLAN — September 10 batch (six items from the owner's playtest)

For the implementation session (Sonnet). Read `README.md` and the last ~300 lines of `HANDOVER.md` first; current build is **b560**, patches run to 560. House rules unchanged: one-purpose patch scripts `patches/patch561.py`+, anchor-asserted; never edit `stellar-dominion.html`; after each patch `./pcheck.sh`, `node tests/tq2.js`, full suite (baseline: tmap2 1 failure, tcore2 4, rest clean); `mkartifact2.py`; HANDOVER entry; bump `BUILD`. **Publish by updating the existing artifact URL** `https://claude.ai/code/artifact/00e6face-32de-4431-8c56-06e4482bf0f2` — do not create a new one.

Order below is deliberate: small fixes first, then the two mid-size features, then the two big ones. Stop for the owner's playtest after items 1, 6, 5 (a day's work), and again after 4. Items 2 and 3 are the large ones and each deserves its own design pass with him before code.

---

## 1. Exotic dots wrap onto a second line (fix)

`#exoStrip` (CSS ~954) is `display:flex; flex-wrap:wrap` and each dot+number grows as the number changes width, so the fourth wraps and un-wraps as digits come and go. Fix: `flex-wrap:nowrap; overflow:hidden`, each item `flex:1 1 0; min-width:0`, the number in a `font-variant-numeric:tabular-nums` span with a fixed `min-width` sized for the widest short form `fmt()` produces (e.g. `999.9K` → about 6ch). Check `renderExoStrip()` (~4346) only rewrites text when it changes (churn rule from patch538/546/548 — `tchurn2` covers Empire so it should already be fine, but confirm). Also the same dots under the orb (`updateOrbBadge`). One patch.

## 6. Crew: start with a default crew, see candidates before hiring (fix + small feature)

Today the bridge is empty until 5 wins and hiring is a blind roll. Change:
- **Default crew.** On fresh save and on migration for saves with an empty roster: three "Deckhand" crew, one per bridge slot the player has, with `mul` 1.00 (no bonus), rarity "Standard", non-dismissable (no SELL button), shown on the bridge so the roster is never empty. They are placeholders: hiring a real crew member into a full bridge replaces a Deckhand (pick the Deckhand first, never a real hire).
- **Visible candidates.** Replace "RECRUIT — rolls a random role" with a candidate row: three rolled candidates shown as cards (name, role, rarity, the exact bonus text `R.d(RAR[c.r].m)`), each with a HIRE button at the current `hireCost()`. Candidates persist in `S.crewPool` (regenerated when empty, or on a paid REFRESH at half hire cost). Hiring removes that card and rolls a replacement. `rollCrew()` is reused; `crewUnlocked()` gate (5 wins) stays for real hires; the Deckhands are there from the start.
- Tests: `tcrew`-style checks if present; `tcombat2` `crewMul` must be 1.00 with Deckhands only.

## 5. Market tab (replaces Stats in the tab bar)

The owner never opens Stats. Put **Market** in that slot; move Stats behind a small "Records & graphs" link at the bottom of the Market pane (the code stays, only the tab entry moves; `UNLOCK` entry for `p-ach` becomes Market at the same level 6, with `d:` copy updated; the `stats` VEGA line becomes the market line — rewrite it: "A broker has opened a channel. Anything we dig up, someone out there wants.").
Market v1 = **sell only**, three counters:
- **Salvage** (the scarce one): sell ore, crystal or any exotic. Price anchored to the player's economy so it stays relevant: `1 salvage = ore worth 90 s of current rate()`, `1 salvage = crystal worth 90 s of cryRate()`, `1 salvage = 8 units of any exotic`. Floor so a level-1 player can't farm: minimum 200 ore per salvage.
- **Dark Matter**: `1 DM = ore worth 20 min of rate()`, minimum 5,000 ore. No exotic→DM.
- **Volume tax**: each sale adds `+12%` to that counter's price for the next sale, decaying back by half every 10 minutes (`S.mkt.heat[counter]`, timestamps, computed lazily). Shows on the card ("price up 24% — cooling").
- UI: three cards, each with amount chips (×1 ×10 ×100 MAX) mirroring the buy bar, a live "you get N" line, SELL button. Guard the churn rule (build strings, `dataset.h`).
- csim: add nothing; note in HANDOVER that the sim doesn't sell.
- `xpNext`/deeds: no XP for selling (a per-unit source is exactly what deeds-XP forbids). One record: "First sale" +15 via the existing records list if easy.

## 4. Travel time for fleets; fortify takes time

- **Assault travel.** `engageTarget(assaultTarget(s),-1)` from the Map becomes: launch → `S.trip={sysId, kind:"assault", t0, dueAt}`, travel time `= 25 s + 15 s × ring` (ring 1 = 40 s … ring 4 = 85 s). The fleet is shown moving along the lane on the Map (a small triangle interpolated between home and the target; reuse the telegraphed-fleet marker code from `renderLiveFleet`/Stage 2). On arrival: toast + Map row button turns into ENGAGE (arrival is a choice, per the existing rule; the fight starts only when tapped; the fleet waits up to 10 min then returns). Only one trip at a time; raids from the Raids tab are unaffected (they're local). Retreat/return trips are instant for now. `S.trip` survives reload (`adopt()` sanitize; `offlineReport()` resolves arrivals).
- **Fortify build time.** `buySysDef()` deducts cost, then sets `S.sdq[id]={to:level+1, dueAt}` with `20 s + 5 s × current level`; `sdLv()` stays at the old level until due; the Map panel shows "Fortifying · 18s" and disables the button until done; one queue per system. `holdOdds`/`sdStrength` read `sdLv()` so an attack during the build uses the old level. `offlineReport()` completes due queues.
- Tests: `tdef`/`ttelegraph2` may assert instant fortify — update; add checks: fortify queue completes after `dueAt`; trip arrival exposes ENGAGE; reload mid-trip keeps the trip.

## 2. Collapse (reintroduce, as the long game) — design first

Owner's call after reaching ~40: the game slows enough that starting over feels good, and he's restarted many times without minding. So collapse comes back as the loop. This reverses the 7-Sep "finite arc + ending" framing; keep the *ending* idea for a final scripted collapse later, but the loop is what ships. HANDOVER's "Collapse (ascension) has been removed" section (~line 2032) lists exactly what was deleted — read it; the shape below is new, don't resurrect price inflation.

Proposal to confirm with the owner before building:
- **Name**: Collapse. VEGA frames it as the empire overreaching and the map resetting; rivals return.
- **When**: available from level 30 (the Nexus button "COLLAPSE" appears), no cap.
- **What resets**: every system except home, all buildings on all systems, ore/crystal/exotics/salvage, fleet & weapons & crew (Deckhands back), research, programmes, level → 1, XP → 0, perks cleared, missions restart, rivals reset.
- **What carries**: Dark Matter and every Nexus purchase (the Nexus is the permanent layer — that's what it was built for), records, VEGA beats seen, `S.wins` history as a stat only.
- **What you gain**: a **Legacy** counter = highest level reached this run − 20, floored at 0, added to `S.legacy`. Each Legacy point: +2% all production and −1% structure cost, permanent (multiplicative with the existing stack — small on purpose; the real prize is the DM payout). **Payout**: DM = `5 × (level − 20)² ` at collapse (level 40 → 2,000 DM; level 50 → 4,500) — enough to buy meaningful Nexus levels each cycle. Nexus costs may need a curve review once cycles exist.
- **Cycle count** `S.cyc` shown on the level chip as a small roman numeral; VEGA has one extra line per cycle start ("Cycle II. Same rock. We know more this time.").
- **Pacing check**: run csim4 across two cycles (first 40 levels twice); second cycle should reach ring 3 in roughly 60% of the time.
- Implementation size: medium-large. Migration: none needed (new fields default). Tests: a `tcollapse2.js` covering reset/carry lists exactly.

## 3. Map: sectors instead of one wheel — design first

Owner: the wheel of planets around Sol Reach is boring; wants variation; zooming failed on mobile before. Proposal: **no zoom, no pan — sectors as pages.**
- The map becomes 5 sector pages: **Core** (home + ring 1), **Inner Reach** (ring 2), **Frontier** (ring 3 west), **The Deep** (ring 3 east + ring 4 west), **Beyond** (ring 4). Swipe or tap chips to switch; each page is a full-width hand-laid layout of its 4–6 systems with lanes drawn between them and one lane exiting to the next sector (so travel time in item 4 can later count lane hops).
- Each sector gets its own backdrop: a nebula tint, a star cluster, a dark void, a wreck field, a distant galaxy — canvas-drawn, seeded, cheap.
- System markers keep today's states (held / claimable / locked / rival) and the existing panel; nothing about claiming changes. The current `x,y` in `SYS` are replaced by per-sector coordinates (`sec`, `sx`, `sy`) — a data-only change plus a new renderer; `tmap2`/`tmapoverlap2` will need their assumptions updated (they check the raw array and overlaps).
- The rival "inbound fleet" marker and the item-4 travelling fleet draw on whichever sector page contains the target, with a small edge indicator on other pages.
- Do a static mock (four PNGs at 390 wide, one per sector) for the owner before writing the renderer.

---

## Suggested session plan

1. Patches 561–563: item 1, item 6, item 5. Publish. Owner plays.
2. Patch 564–565: item 4. Publish. Owner plays.
3. Item 2: confirm the design list above with the owner (10-minute chat), then build with a csim two-cycle check.
4. Item 3: mock first, then build.
