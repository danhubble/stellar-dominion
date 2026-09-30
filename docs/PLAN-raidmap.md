# PLAN-raidmap — raids live on the sector map

30 Sep 2026. Base b646 (`fe9259d`). Owner-approved through a playable mock
(runtime-injection over `dist/`, the way `mkfleetmock.py` did it; five rounds).

## The ask (owner)

1. The fleet buttons carry a picture of a ship.
2. Selecting a fleet must NOT move the map to the fleet's sector: the player picks
   the fleet, then picks where it should go.
3. Raids happen on the map. Small enemy groups float around each sector, harder the
   further out. Tap one for the existing threat prompt; attack, and the fleet flies
   to it across open space ("off the lanes").
4. Fleet markers become three ships in formation instead of a numbered circle.

## Decisions (owner, from the mock)

- **Map only.** The Raids tab's TARGETS list is gone; the tab keeps Fleet, Loadout,
  Crew (rival pressure moved under Fleet). Each sector chip shows how many contacts
  are in it.
- **One prompt.** Tap a contact: name, threat, what it pays, which fleet goes (a
  picker when more than one is free). `ATTACK` flies there and settles it on the map
  with a short exchange of fire — offered only when that fleet outclasses the contact
  (`canAutoResolve`). `FIGHT IT MYSELF` (and the only choice against anything
  stronger) flies there and waits; an "in position" banner on the map offers
  `ENGAGE`, which opens the battle. Nothing ever opens the battle screen by itself.
- **Open space.** After a fight the fleet stays where it fought; its button reads the
  sector ("CORE"). Tapping empty space only deselects.
- **Fleet button**: number, the buy row's own icon for the fleet's heaviest hull, where
  it is, a hull bar (green / gold / rose). Hidden on a system page.
- **Recall and repair.** A selected fleet shows `RECALL` on the map (works mid-flight).
  Fleets still mend slowly anywhere and `REPAIR` for ore still exists; docked at
  Sol Reach or a Shipyard they mend `DOCK_REP` (6x) faster.

## Model

- Contact (`S.tg[i]`): `{id, ti, name, en, dif, secs, dmg, sec, sd, off, fz, auto}`.
  No `sys`. Position is never stored or ticked: `tgPos(t, now)` is a pure function of
  the clock and the seed `sd` (two summed sines per axis), so there is no per-frame
  state, no offline catch-up, and no `Math.random()` call. `fz` freezes the clock
  while a fleet sits on it; `off` absorbs the frozen time on release.
- Fleet: `at` (system id, or `null` in open space) + `pos {sec,x,y}`; `to` (system)
  or `tg` (contact id) while flying, `o` the point the flight started, `hold` the
  contact it is sitting beside. `fleetBusy(f)` = `to || tg` — every "is it free"
  check goes through it.
- Flight: `fleetMapPos()` is a straight line from `o` to wherever the destination is
  now, by `1 - eta/tot`. Crossing sectors: first half of the clock out to the edge,
  second half in from the other side. System to system is `travelSecs()` exactly as
  before; an open-space leg is base + per-unit, or base + 30s per sector boundary.
- `newTarget(rng)` draws exactly four numbers (the old count). The sector rides on the
  strength roll; `TG_W[sec]` is the raid mix (Core row = the old mix), `TG_SEC_DIF`
  +20% strength and reward per sector out.
- `tgCap()` = 3 + 2 per sector open past the Core. The first three are the old
  `Math.random` stream; the rest come from the save's own generator (`S.tgR`).

## csim

Byte-identical. `raidTick()`'s first loop is unchanged (3 contacts, 4 draws each);
extra contacts never call `Math.random()`; the dock repair multiplier only acts on a
damaged fleet, which csim never has.

## TUNING-PENDING

`TG_SEC_DIF` (0.2), `TG_W`, `DOCK_REP` (6), `TG_FX_SECS` (2.4), the cap formula.

## Tests

`tests/traidmap2.js` (new). `tfleets2.js`, `tfleetfix2.js`, `tchurn2.js` follow the
new behaviour (no LOCATE, no `t.sys`, markers placed by transform).
