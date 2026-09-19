# PLAN-unify — the map IS the empire

15 Sep 2026. Base build b606. Patches start at 607. House rules unchanged (one-purpose
anchor-asserted patch scripts, pcheck + tq2 after each, full suite per batch, shipped
`stellar-dominion.html` md5 `bcb806896f1a737146d08d7674adbce6` untouched, BUILD bump and
HANDOVER entry per patch, `mkartifact2.py` at batch end, publish by updating the existing
artifact URL).

## The problem

Two tabs now describe the same systems. Empire is the accordion where you buy buildings;
Map is where you claim, defend, and (since b606) zoom into a planet and see those same
buildings orbiting. Empire still feels overwhelming even after the tint pass. And the
header always shows ore / crystal / Dark Matter, when a rock world spends iridium and a
gas world spends helium — the currency you need is the one you cannot see.

## Owner decisions (settled, 15 Sep)

1. **One tab, named EMPIRE, is the map.** The old Empire accordion tab is removed. The
   Map pane becomes the first tab and takes the name. Sector chips stay. A **MAP | LIST**
   toggle sits beside them: LIST shows that sector's systems as rows; tap a row and it
   behaves exactly like tapping the node.
2. **The sheet gets a BUILDINGS section** above DEFENCES: this system's ladder as the
   existing `.g` buy rows (owned tiers + the one next tier, same rule the accordion uses
   today). Buy-multiplier chips (×1/×10/×100/MAX) live in that section's header. Sheet
   scroll position is remembered per system; on first open it scrolls to the newest owned
   tier, not the top.
3. **The planet widget (`#core`/`#orb`) goes.** The map zoom replaced it. The site view
   (zoom into one structure tier) moves onto the zoom canvas: tap a building's icon in the
   sheet → the canvas swaps to that tier's site, `‹ SYSTEM` returns.
4. **Header: ore, Dark Matter, context card.** Crystal leaves the header and gets a small
   balance strip at the top of the Research tab (it is spent nowhere else). The third
   card shows the exotic of the selected system (`S.msel`), its balance and rate; "—" when
   nothing is selected or the system has no exotic (home).
5. **Map from the start.** Before level 8 only Sol Reach is on it, sector chips and the
   exit arrow hidden. At level 8 the other systems appear and the existing `vega:map`
   beat carries the story line ("more systems on the charts" — PLACEHOLDER, owner
   rewrites). The `UNLOCK` entry for the map therefore stops hiding a tab and starts
   revealing systems.
6. **Stats pane:** leave as is this batch (already behind Market's "Records & graphs"
   link). Owner may drop the chart later; Records stay.

Rejected: Empire as a standalone ledger tab ("a tab you never open"); camera-zoom map.

## Mocks

`unify-mock.html` / `shots/unify-1-map-koru.png` is the approved look for the sheet
(BUILDINGS then DEFENCES). `shots/unify-3-empire-new.png` is the approved row style for
LIST view. `shots/unify-2-map-home.png` shows home's 14-tier sheet — accepted, on the
condition that decision 2's scroll rules hold. Numbers in the mocks are invented.

## Patch plan

Three runs. I verify between each. Every run ends with pcheck, tq2, full suite, csim diff,
md5, and screenshots at 390×844 read with the Read tool.

**Run 1 — header, tabs, opening (607–609).**
- 607 Header. Remove the crystal `.rcard`; add a crystal balance strip at the top of
  `#p-res` (balance, rate, tap → `resourceModal("cry")`). Third card becomes the context
  card: reads `S.msel` → `SYSMAP[..].res` → `exoDef`, shows name, balance, `+rate/s`, dot
  in the exotic's colour, tap → nothing for now. "—" state when no exotic. `render()`
  updates it every tick like the other two.
- 608 Tabs. Map pane (`#p-map`) becomes the first tab, label EMPIRE. Old `#p-emp` tab
  button and pane are hidden (`display:none`, not deleted yet — Run 2 removes them, this
  keeps every test that references `p-emp` runnable until then). Every `gotoTab("p-emp")`
  / `flag("p-emp")` caller retargets to `p-map` (grep: VEGA `firstClaim.go`, `lfLaunch`,
  `applyCore`, `render()`'s exo-strip line, `empSysRow` onclick). Default tab on boot is
  `p-map`. `paneNeedsTop` unchanged.
- 609 Opening. `buildMap()`/`sysInSec()` show only home while `level()<8`; sector chips
  and `#mapEdge` hidden then. `UNLOCK` map entry keeps `lv:8` but its effect is the reveal
  (the tab is always visible). `checkUnlocks()` still queues `vega:map` at level 8; its
  text is reworded to the discovery beat (PLACEHOLDER). `renderLevel()` no longer hides
  `p-map`. A fresh save boots to the map with Sol Reach selected and the sheet open.

**Run 2 — buildings in the sheet, old tab gone (610–613).**
- 610 BUILDINGS section. New `#sysBuild` between `#sysInfo` and `#sysOdds` with a header
  row (label, "n of m tiers", the buy chips) and the rows. Rows come from
  `ladderTierRow(sysId,gi,isNext)` unchanged — it already registers into `empSlotEls`, so
  `updateEmpBars()` keeps the affordability/progress live every tick. Rebuild guard: a
  `dataset.h` key on `sysId | owned counts | S.buy | next gi`, same idiom as `#sysDefRow`
  (tchurn2 will catch anything else). Held systems and home only. `renderGens()`'s job
  moves here; the old accordion is no longer rendered.
- 611 Scroll rules. `sheetScroll[sysId]` remembered on `#sysSheet` scroll (throttled);
  restored on open; first open of a system scrolls so the newest owned row is at the
  top of the visible area. Closing the sheet keeps the memory.
- 612 Remove `#p-emp`, `#core`, `#orb`, `#coreTog`, `#orbBadge`, `#siteHud`, `placeCore`,
  `applyCore`, `orbResize` + its ResizeObserver, `empSysRow`, `empAccordionTap`,
  `renderGens`, `empViewSys`, `updateOrbBadge`, `empOpen`. `draw()` keeps the starfield
  and the map-zoom target only. `S.core` / `S.site` stay in the save shape (adopt() keeps
  sanitising them; nothing reads `S.core`). `#left` keeps the scan button, the empire mini
  stats and the tutorial box. `__SD` export: drop the dead names, keep everything tests
  still need, add `sheetScroll`, `renderSysBuild`.
- 613 Tests. Retire `tcore2.js` and `torbfollow2.js` to `tests/retired/` (both test the
  widget that no longer exists — say so in HANDOVER). Update `tmap2`, `tsheet2`, `tchurn2`
  (sample `p-map` with the sheet open and buildings shown), `tlockstates2`, `ttaborder2`,
  `tscrolldevfix2`, `tprogresearch2`, `ttree2`, `tzoom2` for the new tab order, the
  level-8 reveal and the missing `p-emp`. Every changed assertion is named in HANDOVER
  with the reason. Baseline after this run: **0 failures everywhere.**

**Run 3 — list view, site view, ship (614–616).**
- 614 MAP | LIST toggle beside the sector chips (`.rmode` pattern, session-only like
  `resMode`). LIST replaces the map square with rows for `sysInSec(mapSec)`: held rows in
  the kind-tinted `.sysrow2` style (name, kind badge, exotic, n/m tiers, ore/s, exotic/s,
  green NEXT TIER READY badge when `ladderCost(id, sysNextGi(id), 1) <= S.ore`), claimable
  / contested / locked rows as `empSysRow()` drew them. Row tap = node tap. Sheet and zoom
  behave identically from either view.
- 615 Site view on the zoom canvas. `drawSite()` takes an explicit context like
  `drawSysScene()` does (patch602 pattern); tapping a `.gi` icon in `#sysBuild` sets a
  runtime `mapSite` and the zoom canvas draws it; `‹ SYSTEM` in the bar returns to the
  planet; closing the sheet or zoom clears it. Ore-ladder tiers only (`SITE` has 14
  entries; kind tiers have no site art — icons on those rows are not tappable).
- 616 `tests/tunify2.js` (header context card, level-8 reveal, buildings in the sheet,
  buy from the sheet, scroll memory, LIST toggle, site view), full suite, csim diff,
  screenshots, HANDOVER, artifact rebuild.

## Watch for

- csim byte-identical: none of this touches `tick()`. No new `Math.random()`.
- tchurn2 now samples the sheet with buy buttons in it. Rebuild rows only on the key
  above; affordability is a class/disabled toggle on existing nodes (`updateEmpBars`).
- `ladderBuy()` → `dirty=true; render()` rebuilds everything flagged dirty; the sheet's
  scroll position must survive that (restore in `renderSysBuild` after a rebuild).
- `NOTICES["vega:claimable"].go` and `empSysRow`'s tap both set `S.msel` then `gotoTab`
  — with one tab this is just `S.msel=…; render()`. Keep the zoom opening on it.
- Old saves: `S.msel` may name a system in another sector; `initMapSec()` already follows
  it. A save with `S.site` set: ignore it, `mapSite` starts null.
- The context card reads `S.msel` on every tab. That is intended — it tells you what you
  last looked at.
