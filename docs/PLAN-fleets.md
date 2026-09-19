# PLAN-fleets — fleets have a place

19 Sep 2026. Base b640. First feature under the repo workflow (README "Workflow"):
one commit per step, full suite per run, csim baseline byte-identical (nothing here is
in `tick()`'s economy path — travel is a new clock, checked separately).

## The problem (owner, after the first run to the ending)

"A fleet always seems to come from the homeworld — fleet position should be tracked."
"Allow the player to make more than one fleet. Maybe a maximum of three… buttons maybe
in the map view." And, for later: missions on fleets, commanders, governors.

## What the code says today

- ONE fleet, everywhere at once: `S.sh=[interceptors,frigates,dreadnoughts]`,
  `S.fhp` integrity, `S.wep` fitted weapons, `S.bridge` crew. `fleetDPS()`/
  `fleetHPMax()` read `S.sh`. 26 sites read `S.sh`, 24 read `S.fhp`.
- Raid targets (`S.tg`, up to 3, one every 110 s) have no location. Threats (`S.thq`)
  are at a system; DEFEND IT → `startDefence(th.id)` fights with the whole fleet
  wherever it is. Rival live fleets (`LF`) already travel: 30–60 s ETA with a toast.
- Hangars already station hulls at a system (`stationHan`/`recallHan`), moving
  them OUT of `S.sh`. That is the seed of "a fleet has a place".
- Map nodes: `#mapNodes .mnode[data-s]`, one sector shown at a time (`mapSec`),
  systems have `sx,sy` (0–100) inside the sector and a `ring` 0–4.

## Owner decisions (proposed defaults in bold — settle before run 1)

1. **Up to three fleets.** Fleet 1 exists from the Raids unlock. Fleet 2 at **level
   14**, Fleet 3 at **level 20**, announced by the level-up modal like a pane
   unlock (one new `UNLOCK`-style table, `FLEET_UNLOCK=[9,14,20]` — index 0 reads
   `unlockLv("p-raid")`). No purchase; levels are the game's pacing lever.
2. **What a fleet is.** `S.fl=[{id:1, n:"1st Fleet", sh:[a,b,c], hp:1, at:"home",
   to:null, eta:0}]`. `at` is a system id; `to`/`eta` while travelling. `S.sh`/`S.fhp`
   are DELETED, not mirrored: `fleetDPS(f)`, `fleetHPMax(f)`, `engageTarget(t,idx,f)`
   take the fleet. The fleet cap (`fleetCap()`) is empire-wide: total hulls across
   all fleets, as today. Weapons (`S.wep`) and the bridge crew stay empire-wide in
   v1 — every fleet fights with the same doctrine. Commanders (next plan) are where
   fleets diverge.
3. **Where things happen.** A raid target gets a system: `t.sys`, picked from
   systems the player can see (revealed sectors), weighted toward the frontier
   ring of what they hold. Engaging needs a fleet AT that system — the target card
   says where it is and offers "SEND nth FLEET · 40s" if none is there, ENGAGE if
   one is. A threat at a held system is fought by a fleet AT that system; DEFEND IT
   offers the same send-or-fight choice; if no fleet can arrive before the threat
   clock, the button says so and only LET THEM HOLD (garrison) remains — this is
   the point of position. Hangars unchanged (stationed hulls are the garrison).
4. **Travel time.** Same sector: **20 s + 0.4 s per map unit** between the two nodes
   (typical 30–50 s, same feel as the rival fleets' 30–60 s). Crossing sectors:
   **+45 s per ring boundary**. Nexus/Research speed perks are NOT in v1 (one lever
   later). Travel runs on the same clock as threats (`thqTick`'s dt), works offline
   (arrivals resolve on return like everything else), and is shown as a moving
   marker on the sector map plus an ETA on the fleet card.
5. **Buttons in the map view.** Each fleet is a small marker on its system's node
   (numbered 1/2/3, in the fleet's colour). On a system page a FLEETS row lists
   fleets here (tap → fleet card) and one SEND button per fleet elsewhere (with the
   ETA). Travelling fleets draw a dotted line and a marker sliding along it. The
   Raids pane keeps the fleet strip but becomes per-fleet tabs (1 · 2 · 3) with
   the same strip inside each, plus "AT <system>" / "→ <system> · 32s".
6. **Moving hulls between fleets.** Only when both are at the same system: a
   TRANSFER modal with three +/− rows (one per hull class). Buying a hull adds it
   to the fleet you are looking at (the Raids pane's selected tab) if that fleet
   is at home; otherwise to the fleet at home; if none is home, the purchase is
   queued to Fleet 1 and lands when it next reaches home (PLACEHOLDER copy on
   the button: "delivers at Sol Reach"). Repair (`#flFix`) is per fleet, anywhere.
7. **Old saves.** `adopt()` builds `S.fl=[{sh:S.sh, hp:S.fhp, at:"home"}]` from the
   old fields and deletes them. Stationed hangar hulls are untouched. Missions
   "Field 20 warships" reads the sum across fleets.
8. **The final battle** takes every fleet — it is the one fight that ignores
   position (all fleets are recalled to the Core on engage, no travel). The
   auto-resolve clip is per fleet and unchanged.

Rejected: buying fleets with Dark Matter (one more shop); per-fleet weapon racks
in v1 (three of everything on a phone screen); travel measured in minutes (this is
an idle game with 110 s target spawns — a 5-minute transit would mean raids expire
before you arrive).

## Mock first

A runtime-injection mock on b640 (the way `mkpagemock.py` did it), no game logic:
three fleet markers on the Frontier map, a SEND flow with a sliding marker and ETA
countdown, a system page FLEETS row, a raid card in the two states (send / engage),
and the Raids pane's 1·2·3 tabs. Owner plays it on the phone and says yes/no to
decisions 3, 5 and 6 before any real code. Published as a separate throwaway
artifact and deleted after.

## Runs (after the mock)

Run 1 — state model (MAX effort: 50 call sites move). `S.fl`, `adopt()` migration,
`fleetDPS(f)`/`fleetHPMax(f)`/`engageTarget(t,idx,f)`/`startDefence(id,f)`/
`autoResolveTarget(t,idx,f)`, cap across fleets, buy/sell/repair per fleet, the
Raids pane tabs, `__SD` export. Behaviour identical to today with one fleet at home
(the suite must pass with only fixture changes: `S.sh`→`S.fl[0].sh`, named in the
commit). csim identical.

Run 2 — position and travel. `t.sys` on targets, `fleetTravel(f, sysId)`, the
travel clock, arrival toast, engage/defend gating, offline arrivals, map markers
and the sliding line, the FLEETS row, SEND buttons. `tests/tfleets2.js`: travel
time maths for same-sector and cross-sector, arrival lands `at`, engage refused
when away, DEFEND IT refused when no fleet can make it, offline arrival on reload.

Run 3 — fleets 2 and 3. `FLEET_UNLOCK`, level-up announcement, TRANSFER modal,
purchase routing, three markers, per-fleet clip. Screenshots at 390x667 and
390x844 of: map with three markers, a travelling fleet, the Raids tabs, the
transfer modal, a raid card in both states.

## Watch for

- csim byte-identical after every run: travel must live in its own tick function
  called next to `thqTick`, never inside the economy maths.
- `tchurn2`: fleet markers and the FLEETS row are rebuilt only under a `dataset.h`
  key that includes each fleet's `at`/`to`/hull counts.
- The page layout (PLAN-page) is untouched — the FLEETS row is one more block in
  `#sysSheet`, above DEFENCES.
- No `Math.random()` in travel. Target system selection uses the existing
  `newTarget()` RNG stream — it is already random and outside csim's claims path,
  but confirm csim never calls `newTarget()` (grep) before adding a draw to it.
- `holdResolve()` (offline/auto threat resolution) must not assume a fleet is
  present: the garrison-only path is the default when none is.
