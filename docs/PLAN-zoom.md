# PLAN-zoom — tap a system on the map, zoom into the planet

14 Sep 2026. Base build b601. Patches start at 602. House rules unchanged (one-purpose
anchor-asserted patch scripts, pcheck + tq2 after each, full suite per batch — baseline is
`tcore2` 4 known failures — shipped `stellar-dominion.html` md5
`bcb806896f1a737146d08d7674adbce6` untouched, BUILD bump and HANDOVER entry per patch,
`mkartifact2.py` at batch end, publish by updating the existing artifact URL).

## The problem

On the Map tab a system is a coloured dot. Nothing you build on it is ever visible from
there — the only place the game draws a planet with its buildings in orbit is the Empire
tab's `#orb` canvas, and that is a small widget you have to drill into. Tapping a system
should show you the place.

## Owner decision (settled)

Mock state **A**, `zoom-mock.html` / `shots/zoom-a.png`: the map square itself becomes the
planet. Options B (camera push-in) and C (small window in the sheet) were rejected — B is
mostly empty space at that zoom, C makes the planet too small to read on a phone.

## What it looks like

Tap a claimed system node → the map layers cross-fade out and the same square fills with
that system's planet scene: planet disc tinted by kind, continents, terminator, settlement
lights, and its built tiers orbiting. A `‹ MAP` back button sits top-left and the system
name top-centre. The bottom sheet opens underneath exactly as it does today — this replaces
only the map square, nothing about the sheet changes.

Back out via the `‹ MAP` button, closing the sheet, switching sector, or leaving the tab.

- Claimed systems only (held or rival-occupied). An unclaimed system opens the sheet and
  leaves the map alone — you have not been there, so there is nothing to look at.
- Zoom state is runtime-only. It is not saved, so a reload comes back on the map.
- The sector swipe gesture is off while zoomed.

## How it is built

The scene already exists: `draw()`'s `else if(ox&&OW)` system branch (~10868–10958) draws
exactly this, keyed off `vid` from `empViewSys()`, with `sprite(o)` (~10409) for the
orbiting tiers. Both write to the `ox`/`OW`/`OH` globals.

`#core` is hidden unless the Empire tab is on, so while the map zoom is open the orb canvas
is not visible. The same per-frame draw therefore routes to whichever canvas is showing —
no second loop, no extra cost.

## Patch plan

**602 — refactor, no visible change.** Extract that branch and `sprite()` into
`drawSysScene(g, W, H, vid, t, D)` and `sprite(g, o, D)` taking an explicit 2D context.
`draw()` calls `drawSysScene(ox, OW, OH, vid, t, devicePixelRatio)`. The Empire tab must
look pixel-identical afterwards — screenshot before and after and compare.

**603 — the zoom view.** `#mapZoom` canvas + `#mapZoomBar` (back button, system name)
inside `#mapWrap`; runtime `mapZoom` state; node tap sets it when the system is claimed;
back button, sheet close, sector change and tab change clear it; swipe gesture guarded;
CSS cross-fade of `#mapBg`/`#mapLinks`/`#mapNodes`; `draw()` targets the zoom canvas while
it is open.

**604 — legibility at size.** Two things the mock exposed:
- `sprite()` sizes itself off `devicePixelRatio` alone, tuned for the ~230px Empire widget.
  Blown up to a full map square the buildings are nearly invisible. Scale sprite size off
  the scene's own planet radius `R` instead, with the Empire tab's current appearance as
  the calibration point — it must not visibly change there.
- Settlement lights use `vc(2)+vc(3)`, which are ORE-ladder indices, so any non-home system
  never lights up its night side. Use that system's own `sysLadder()` upper two tiers.
- Entry transition: scale 0.88→1 and alpha 0→1 over ~250ms, the same shape `drawSite()`
  already uses.

**605 — tests and ship.** `tests/tzoom2.js`, full suite, csim diff, screenshots at 390px,
HANDOVER, `mkartifact2.py`.

## Watch for

- csim byte-identical: everything here is in `draw()`, never in `tick()`'s call graph. No
  new `Math.random()` anywhere.
- `tchurn2` sweeps every `<button>` in the on-pane for DOM identity churn. The back button
  lives inside the Map pane: create it once in markup and only toggle classes/text, never
  rebuild it in `renderMap()`.
- The map's sector swipe IIFE (~10981) and the three sheet-close paths (~11009–11041) all
  need to know about the zoom.
- `orbResize()` and its `ResizeObserver` are wired to `#orb` only; the zoom canvas needs its
  own sizing on open, on resize and on devicePixelRatio change.
