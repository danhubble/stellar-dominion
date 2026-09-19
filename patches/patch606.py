#!/usr/bin/env python3
"""
patch606 — PLAN-zoom.md batch 1, close-out: tests + ship, plus two review notes
folded in from the patch605 sign-off.

Review note 1: on a full-ladder system (see shots/zoom-b2-b-home-full-ladder.png)
the "SOL REACH" title sits on top of the outermost orbit sprites - `#mapZoomBar`'s
own backing (`linear-gradient(180deg,rgba(4,6,16,.85),rgba(4,6,16,0))`) fades all
the way to fully transparent by the bottom of the bar, which is right where the
name text sits (`align-items:center`), so a bright sprite passing directly behind
it reads through with no contrast underneath.

Chose "give the bar a subtle backing" over "nudge the scene down a few px": the
scene nudge would mean reserving a fixed top margin inside `bandH` for `cy`'s own
placement while leaving `R`'s own formula reading the *full* `bandH` (so it does
not shrink the planet, per the instruction) - two different quantities derived
from the same band, one extra thing to keep in sync on every future band-shape
change, for a problem that is really just "the text doesn't have enough contrast
under it". A CSS-only backing fixes the actual legibility problem directly, never
touches `drawSysScene()` or the compose maths patch605 just finished, and provably
cannot shrink the planet since it doesn't touch the canvas at all - the cheaper
and steadier fix, per the instruction's own tie-break. Changed the gradient's
bottom stop from fully transparent to a still-fairly-dark `rgba(4,6,16,.55)`, so
the bar keeps real contrast under the text at every scroll/scene state instead of
fading to nothing exactly where it matters, while the top stays as it was and the
fade itself is still visibly a fade, not a hard-edged box - "subtle", not a solid
panel.

Review note 2 -> the actual "605 (tests, ship)" work from PLAN-zoom.md, renumbered
606 by the owner: new tests/tzoom2.js (not a patch to the HTML - a new test file,
following tmap2.js's pattern) covers open-on-claimed-tap, sheet-only-on-unclaimed-
tap, back-button-closes-zoom-keeps-sheet, sheet-close-closes-zoom, sector-change-
closes-zoom, tab-change-closes-zoom, zoom-does-not-survive-save/reload, and the
sector swipe being inert while zoomed (checked against a positive control - the
same swipe DOES move the sector when not zoomed - so the "inert" result is proven
against a working swipe, not a broken one). No new __SD exports were needed for
it - mapZoom/setMapZoom/gotoTab/setMapSec/dismissNotice/claimSystem/sysOpen were
all already on the export from patch603-605 or earlier batches.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do(
    "#mapZoomBar{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:7px;\n"
    "  padding:8px 8px;z-index:6;background:linear-gradient(180deg,rgba(4,6,16,.85),rgba(4,6,16,0));\n"
    "  opacity:0;pointer-events:none;transition:opacity .2s ease}",
    "#mapZoomBar{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:7px;\n"
    "  padding:8px 8px;z-index:6;\n"
    "  /* patch606: bottom stop was fully transparent, fading to nothing exactly where the\n"
    "     name text sits (align-items:center) - a bright orbit sprite on a full-ladder\n"
    "     system read straight through with no contrast under it. Kept as a visible fade\n"
    "     (still a gradient, still \"subtle\"), just never all the way to zero. */\n"
    "  background:linear-gradient(180deg,rgba(4,6,16,.85),rgba(4,6,16,.55));\n"
    "  opacity:0;pointer-events:none;transition:opacity .2s ease}",
    label="mapZoomBar backing",
)

h = h.replace("const BUILD=605;", "const BUILD=606;", 1)
assert "const BUILD=606;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch606 applied OK")
