# PLAN-ending — Stellar Dominion

11 Sep 2026. Built from STORY.md plus owner decisions in the planning chat. Base build b577.
Patches start at 578. House rules unchanged: one-purpose anchor-asserted patch scripts in
`patches/`, `pcheck.sh` + `tests/tq2.js` after each, full suite at the end of each batch
(baseline: only `tcore2` 4 known failures), shipped `stellar-dominion.html` md5
`bcb806896f1a737146d08d7674adbce6` never changes, BUILD bump per patch, HANDOVER entry per
patch, `mkartifact2.py` at end of batch. Plain `node tests/csim4.js` output must stay
byte-identical (nothing here should touch cycle-1 ore pacing; csim never buys Nexus).

## Owner decisions (settled)

1. **Nyx is the last system.** Nyx takes the L75 slot; Thanaris moves to L69.
2. **Losing the final battle** = repair and retry. The ending only plays on a win.
3. **Exotic Nodes** trickle from held ring-3 and ring-4 systems. No new verb.
4. **Opening** = short skippable text sequence on a brand-new game only.
5. **After the ending**, rivals stop attacking for good and every rival-held system becomes an
   ordinary ore claim, so free play can still finish the map.
6. **When VEGA turns**, all Nexus bonuses are suspended (greyed, "SEIZED") until the final battle
   is won, then restored.
7. **Nexus tree** gets 3 "Project" nodes bought with Exotic Nodes (modest bonuses, no runaway),
   then **???**, which needs all three plus Nyx held.
8. **Rival sabotage**: late-game threats can target home. If one lands it steals a share of
   banked Exotic Nodes. Nothing is destroyed.

Still open (owner writes, not blocking): every VEGA / rival / intro / ending line (placeholders
ship first), VEGA's real reason for needing a sovereign, whether a rival voice ever takes the
advisor slot after the ending (default: panel stays dark).

## Text lives in one place

All new player-facing story text goes in blocks next to `VEGA` (~line 4443), nowhere else:

- `VEGA` — existing beats, plus new drift beats (below).
- `RIVAL_MSG` — new: `{key:{who:"hel"|"cov"|"vsh", t:"..."}}`.
- `STORY` — new: `{ intro:[...lines], turn:[{who:"vega"|"hel"|"cov"|"vsh"|null, t:"..."}...],
  nodeHint:"You'll see.", endLast:"...", endTbc:"TO BE CONTINUED" }`.

Every placeholder line is marked `/* PLACEHOLDER */` so the owner can find them.

---

## Batch A — story layer (patches 578–581)

**578 — Nyx/Thanaris swap.** Swap `lvl`, `cost`, `dm`, `yld` between the two `SYS` entries
and move the blocks so array order stays ascending by cost/level (tmap2 checks raw order:
`tha` goes right after `sev`, `nyx` becomes the very last entry). Swap their `GARRISON` rows too
so Nyx gets the harder one (`def:20, arch:"lance"`, owner `hel`) and Thanaris gets
`def:16, arch:"fortress"`, owner `cov`. Nyx keeps its own description and gains a
placeholder second sentence about the maps stopping past it; Thanaris gets a new placeholder `d:`
(its "last charted system" line no longer fits). Sector positions (`sx,sy`) and
`SEC_LANES` unchanged. tmap2/tmapoverlap2 must stay 0.

**579 — Intro sequence.** Brand-new game only (`!had` at boot ~9382), before `vega:boot`.
Full-screen dark overlay, one `STORY.intro` line at a time (4–5 lines), tap anywhere to advance,
SKIP button top-right, fades out into the normal game, then `vega:boot` queues as now. Sets
`S.seen.intro=true`; `adopt()` back-fills it true for every loaded save so existing players never
see it. Placeholder lines: waking in a shuttle, no memory, VEGA's voice, home world gone, the
factions did it. Must not block on mobile (390px) and must not break `tq2`/`tcore2` boot checks.

**580 — Drift beats + rival speaker.**
- New VEGA beats, level-triggered in `checkUnlocks()` with matching `adopt()` back-fills:
  `drift25, drift35, drift45, drift55, drift65` (lines get subtly odder, more Nexus-keen), and
  `project` (fires the first time Exotic Nodes > 0 — wire now, it becomes live in Batch B).
- `RIVAL_MSG` beats `rv40, rv50, rv60` (level-triggered, from a random live rival — store which
  one in the notice) and `rvSab` (first sabotage threat, Batch C). Placeholders include
  "You don't know what you're feeding." and "Ask it what the last node is."
- `renderNotice()` becomes speaker-aware: a notice may carry `av` (avatar HTML) — rival notices
  show a small circle in the rival's colour with its initial, name = rival name, framed as
  "INTERCEPTED". VEGA notices unchanged. Hardcoded `av.innerHTML=VEGA_SVG` (~4538) is the
  anchor.

**581 — Dev panel.** Add rival messages to the "show any beat" select (prefix `rival:`), and a
"REPLAY INTRO" dev button. New test `tests/tstory2.js`: intro shows on fresh game and not on a
loaded save, SKIP works, each drift/rival beat fires at its level exactly once, back-fill stops
old saves being flooded, rival notice renders name + coloured avatar, Nyx is last and array order
is still monotonic.

---

## Batch B — Exotic Nodes and the Project (patches 582–585)

**582 — Exotic Nodes resource.** `S.en` (banked, float) and `S.enAll` (lifetime) in `fresh()`,
default 0 in `adopt()`. Rate: `EN_RING3=1`/hour per held ring-3 system, `EN_RING4=3`/hour per
held ring-4 system (occupied systems don't count — use `heldSystems()`/`sysHeld()`).
`enRate()` per second. Accrues in `tick(dt)` beside the EXO loop; offline catch-up in
`offlineReport()` using the same `offlineEff()` and cap as ore, shown in the welcome-back modal
when > 0. Display: one extra entry at the end of `#exoStrip` (own colour, distinct from the 4
exotics), hidden until `S.en>0 || enRate()>0`. Tunables at top of the block marked
TUNING-PENDING. Not sellable in Market.

**583 — Project nodes.** `NEXUS` entries get optional `cur:"en"` and `req` (id of the node that
must be owned first). Thread `cur` through `nexCost`/`buyNex`/`renderNex` the way `RESH` handles
`cur:"sv"`. Three new nodes, each `max:1`, shown under a "THE PROJECT" divider below the DM nodes,
hidden until `S.en>0` (first node) or its `req` is owned:
- `pj1` "Resonance Array" — 60 Nodes — ×1.25 exotic production.
- `pj2` "Deep Lattice" — 250 Nodes, req `pj1` — ×1.25 fleet damage & hull.
- `pj3` "Sovereign Key" — 900 Nodes, req `pj2` — ×1.5 ore production.
Names/effects placeholder-ish; numbers TUNING-PENDING. Multipliers go into the same functions the
existing nodes use (list of `S.nx` reads: ~2933, ~3630, ~3711, ~3735, ~4352). Locked cards reuse
the research lock look (🔒, `.locked`).

**584 — The ??? node.** `pjx`, `max:1`, 1500 Nodes, requires `pj3` owned AND Nyx held. Card title
shows "???", description shows `STORY.nodeHint`, and a short requirements line ("Requires Sovereign
Key · Requires Nyx") while locked. Buying it calls `startFinale()` — in this patch a stub that only
sets `S.end=1` and toasts; Batch D fills it in. `S.end` (0 none, 1 finale, 2 won) added to
`fresh()`/`adopt()` here.

**585 — Tests + pacing check.** `tests/tnodes2.js`: rate per ring, occupied systems excluded,
offline catch-up, save round-trip, costs/req gating, `cur:"en"` spends Nodes not DM, ??? locked
without Nyx and unlocked with it, each multiplier applies once. Print (not assert) a small table:
Nodes per day at typical holdings (3 ring-3; 7 ring-3 + 1 ring-4; 7 + 8) and days to afford each
node — goes in HANDOVER for the owner. Plain `csim4.js` byte-identical before/after.

---

## Batch C — Rival sabotage (patches 586–588)

**586 — Home-target threats.** Only once `pj1` is owned and `S.en>=10` and `S.end===0`. When
`rvMaybeThreat()` would launch, `SAB_CHANCE=0.35` (TUNING-PENDING) it targets home instead.
Queue entry gets `kind:"sab"` and `sysId:"home"`. Needs carve-outs everywhere home is currently
stripped (`adopt()` thq sanitizer ~8178 — allow home only when `kind==="sab"`; `thqPrune()`
must not drop it). Never occupies. Resolution in `holdResolve()` gets its own branch:
- Odds: `power = 1 + best sdStrength() among held systems` (your best garrison falls back to
  defend home), same weight formula as `holdOdds()`. Same rule online and offline (an offline
  absence does not auto-lose a sabotage).
- Loss: steal `SAB_STEAL=0.25` of banked `S.en` (floor), toast + result line with the amount.
- Win: normal hold rewards/pressure reduction.
- DEFEND choice plays the existing defence mini-game at home; its result routes into the same
  branch.

**587 — Copy.** Threat card for `kind:"sab"`: "<Rival> is moving on the Nexus", shows Nodes at
risk. Map marker/pill on Core page as for other threats. First sabotage queues `rival:rvSab`.

**588 — Tests.** `tests/tsabotage2.js`: no sabotage before `pj1`, sabotage can target home after,
loss steals exactly 25%, win steals nothing, never occupies, save/load keeps a live sab threat,
old-save sanitizer still strips any non-sab home entry, `S.end>0` stops new sabotage.
`trivals2`/`ttelegraph2`/`tnotices2` must stay 0.

---

## Batch D — The turn, final battle, ending (patches 589–593)

**589 — The turn.** `startFinale()` for real:
- Turn scene: full-screen overlay (same component as the intro) plays `STORY.turn` lines
  one tap at a time. VEGA lines use a red/dimmed variant of the VEGA avatar. Rough placeholder
  order: VEGA "Sufficient." → Nexus lights, a fleet launches from Sol Reach → VEGA explains briefly
  (needed a sovereign; factions were never your enemy) → rival transmissions: all three fleets
  inbound, on your side. Ends on two buttons: **ENGAGE** (starts battle) and **NOT YET** (closes;
  the game must not force it).
- `S.end=1` effects: every Nexus bonus reads 0 via one helper `nexLv(id)` that replaces the direct
  `lv(S.nx,…)` reads (Project nodes included); Nexus cards show greyed "SEIZED"; no new VEGA
  notices queue and queued VEGA notices are purged; rival threats stop (`rvTick`/`rvMaybeThreat`/
  expansion no-op when `S.end>=1`) and existing threats/live fleets are cleared.
- A pinned red card at the top of Raids and a marker on Sol Reach (Map, Core page):
  "VEGA's fleet holds Sol Reach" with **ENGAGE** (disabled with a repair hint if hull is low).
  Production keeps running.
- Reload during `S.end=1` restores all of this (no scene replay).

**590 — Final battle.** A scripted target `{final:1, name:"VEGA's Fleet", arch:"mirror", ...}`
through `engageTarget`. Always weapon mode (cmode is dev-only anyway).
- Strength scales off the player's own fleet (`fleetHPMax()`, `fleetDPS()`) so it is hard but
  winnable at any progression: wave 1 ≈ 0.6×, wave 2 ≈ 0.8×, wave 3 ≈ 1.0× plus a "VEGA Core"
  boss (TUNING-PENDING). Waves trigger when the previous wave is cleared (not on a timer).
  Ordinary reinforcement/pressure logic off for this fight.
- `mirror` archetype: enemy kinds weighted from the player's current loadout; drawn with the
  player-fleet ship shape, recoloured VEGA-red.
- Fight cap for this fight only: `FINAL_CAP=300`s. Timeout or hull 0 = loss.
- Loss: normal loss handling (fleet damage), result card says the fleet still holds Sol Reach,
  repair and try again. `S.end` stays 1.
- Win condition: boss below 25% hull → remaining hostiles break off and fly out right (not
  destroyed), result card → ending (patch 592).

**591 — Allies in the fight.** No friendly-unit system exists, so allies are a passive damage
tick: `BT.allies` list. Vasht joins at wave 1 start, Helion at wave 2, Covenant at wave 3, each
toasts "<Rival> joins the line" and adds ally DPS (each ≈ 12% of player DPS, TUNING-PENDING)
hitting a random alive hostile every ~1.5s, with a visible tracer. Ally ships drawn as a small row
of player-shape ships in rival colours behind the player fleet. Allies never take damage and never
count toward win/loss checks.

**592 — Ending and free play.** On win:
- Ending screen overlay: title card, stats (time played, level, systems held of total, all-time
  ore, raid wins, records), a strip reading END OF CHARTED SPACE with a glow, then after a beat
  `STORY.endLast` in dim text with no avatar, then `STORY.endTbc`, then **CONTINUE**.
- `S.end=2`: Nexus bonuses restored; `pjx` card shows "COMPLETE · VIEW ENDING" (reopens the ending
  screen); advisor stays dark (no VEGA beats ever again; non-VEGA notices still work); peace:
  every rival-owned system loses `owner/def/arch` at boot and on the spot so it reads as an ordinary
  ore claim (`sysOwner`/`sysContested`/`canAssault`/`sysOpen` must agree), `S.occ`/`S.lost`/threats
  cleared and occupied systems returned. Rival territory drawing stops.

**593 — Dev + tests.** Dev buttons: GIVE 2000 NODES, HOLD NYX, START FINALE, WIN FINALE, SHOW
ENDING, RESET ENDING (`S.end=0`, un-suspend). New `tests/tending2.js`: ??? triggers `S.end=1`;
Nexus multipliers read 0 while seized and return after win; no VEGA notices while `S.end>=1`;
no rival threats while `S.end>=1`; NOT YET leaves the pinned card; loss keeps `S.end=1` and allows
re-engage; 3 waves in order; allies join at waves 1/2/3 and never affect win/loss; win sets
`S.end=2`; peace makes a rival system claimable with ore; save/load at `S.end=1` and `2` restores
state; `tchurn2` still 0.

---

## Batch E — ship (after D)

Screenshots at 390px (intro, rival notice, Project nodes, sabotage card, turn scene, final battle
with allies, ending screen) looked at before publishing. `mkartifact2.py`, then publish by
updating the existing artifact URL (never a new one). Owner then rewrites all placeholder lines.
