#!/usr/bin/env python3
"""
patch600b — review fix, same BUILD as patch600 (convention: 581b/587b/591b/593b/
595b/595c/595d): the sticky DEFEND IT / LET THEM HOLD footer's own top edge wasn't
opaque enough.

Screenshotting the under-attack state (600-04) showed the defences row's own card
buttons (MAXED / n · UP) bleeding through the footer's top few pixels - the fade-in
gradient (transparent -> #0a0e24 by 38%) was meant to soften a hard edge, but at
sticky's very first stuck frame (scrollTop still 0, tall content) the footer sits
directly on top of the last row of cards with no scroll having happened yet, so
"softened" just meant "translucent over real buttons" instead. Swapped for a flat
opaque fill plus a top border and an upward drop-shadow - a normal floating sticky
bar look, fully masking whatever scrolls under it with a visible seam instead of a
blend.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do(
    "#sysThreatActs{position:sticky;bottom:0;margin:10px -14px 0;padding:10px 14px 4px;\n  background:linear-gradient(180deg,rgba(10,14,36,0) 0%,#0a0e24 38%,#0a0e24 100%);z-index:2}",
    "#sysThreatActs{position:sticky;bottom:0;margin:10px -14px 0;padding:12px 14px 10px;\n  background:#0a0e24;border-top:1px solid var(--line);box-shadow:0 -10px 18px -8px rgba(0,0,0,.6);z-index:2}",
    label="sticky footer opaque fix",
)

open(PATH, "w", encoding="utf-8").write(h)
print("patch600b applied OK")
