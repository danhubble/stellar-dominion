#!/usr/bin/env python3
"""
patch619 (BUILD 620) - Patch A: finish the 390x667 case.

patch618b trimmed #tut and recovered real room for #right (the map pane), but at
390x667 #mapWrap.homeonly's own max-height:30vh (200px at that viewport height)
still exceeded the 173px #view actually had to give it - the square was clipped
39% off its own bottom, needing an in-pane scroll to see the rest (measured and
reported in HANDOVER, not fixed at the time per the coordinator's own
instruction not to invent a second change without checking in first).

Fix, exactly as instructed: drop the cap from 30vh to 25vh. At 667 that is 167px
(fits inside the 173px #view had); at 844 it is 211px (still comfortably inside
#view's much larger 350px there, so nothing regresses at the taller size which
was already fully visible).
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=619;", "const BUILD=620;", label="BUILD bump")

do(
    "#mapWrap.homeonly{max-height:30vh}\n",
    "/* patch619: dropped from 30vh - at 390x667 that was 200px against only 173px of\n"
    "   usable #view (measured in HANDOVER after patch618b), clipping the square's own\n"
    "   bottom 39% without a scroll. 25vh is 167px at 667 (fits) and 211px at 844\n"
    "   (still well inside #view's 350px there, so the already-fine taller case is\n"
    "   untouched). */\n"
    "#mapWrap.homeonly{max-height:25vh}\n",
    label="homeonly cap 30vh->25vh",
)

assert h.count("const BUILD=620;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch619 applied OK")
