#!/usr/bin/env python3
"""
patch618b (BUILD 619) - review fix on patch618: #tut was crushing the map pane at
short phone heights.

The coordinator's verification at 390x667 (in addition to the 390x844 screenshots
Run 1 shipped with) found #right (the whole map pane, including #mapWrap and the
MAP|LIST toggle) squeezed down to a 59px-tall sliver, with #view (the map square
itself) at 24px - effectively invisible, the toggle clipped in half. Root cause,
per the coordinator: under @media(max-width:760px), #left is flex:0 0 auto at
order:3 - sized purely by its own content, taking whatever height it needs and
starving #right (flex:1 1 auto) of whatever is left. #tut (the Getting Started
box) was five paragraphs tall; patch618 (Run 1, item 2c) added a sixth line on
top of that, making it worse. patch618's own #mapWrap.homeonly cap (max-height:
30vh) cannot fix this - the constraint at this viewport height was never the map
square, it was #left's content height pushing #right's available space to
near-zero.

Fix: trim #tut down to only what a brand-new player needs right now - scanning
is free, buy the first Mining Drone, tap your homeworld to build. The "every
structure adds ore/levels/LEVEL button" paragraph and the "tap a system's
structure to open its site view" paragraph are DELETED outright, not reworded -
per renderCtxCard()/the main render loop (~line 5498), #tut removes itself the
instant the player builds anything at all or clicks 25 times, whichever comes
first, so on a real playthrough those later paragraphs are almost never read:
the box is gone again well before a player would scroll down to them. Their
only real effect was height, and height is exactly what was crushing #right at
short viewports. Remaining copy kept PLACEHOLDER, same as before - the owner
rewrites all of this later regardless of length.

Verified numerically after this patch (see HANDOVER for the actual rects) at
both 390x667 (the size that motivated this whole batch) and 390x844.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=618;", "const BUILD=619;", label="BUILD bump")

# ==================================================================== markup: #tut
do(
    "      <div style=\"font-size:11px;color:var(--mut);line-height:1.5\">\n"
    "        Scanning is <b style=\"color:var(--gr)\">free</b> — tap it (or press Space) to mine ore by hand.\n"
    "        Bank 10 ore and buy your first <b>Mining Drone</b>; drones mine for you forever.\n"
    "        <!-- PLACEHOLDER: patch618 - a fresh save now boots with the sheet closed\n"
    "             (msel:null, Run 1/PLAN-open.md item 2), so the player needs to be told\n"
    "             where to spend that first bank of ore. Owner rewrites all story/\n"
    "             tutorial copy later. -->\n"
    "        <br><br>Tap your homeworld on the map to open it and build.\n"
    "        <br><br>Every structure you build adds to your ore per second, forever.\n"
    "        Firsts earn <b style=\"color:var(--gd)\">levels</b> — a new kind of structure, a\n"
    "        milestone, a claimed system, a contract. Tap <b>LEVEL</b> at the top to see\n"
    "        what's within reach. Claim a level whenever you\n"
    "        like and pick a perk — levels also open up the rest of the game.\n"
    "        <!-- patch615: the site-view zoom is back (tap a held system on the map, then\n"
    "           a built structure's icon in the sheet) - this line describes it again. -->\n"
    "        <br><br>Tap a system, then tap one of its structures, to zoom in on its site.\n"
    "      </div>\n",
    "      <!-- PLACEHOLDER: patch618b - #tut removes itself the instant the player\n"
    "           builds anything or clicks 25 times (renderCtxCard()'s caller, ~line 5498),\n"
    "           so on a real playthrough this box is gone again long before a longer\n"
    "           version would ever be scrolled to - trimmed to only what a brand-new\n"
    "           player needs right now (see HANDOVER for the full reasoning: the deleted\n"
    "           paragraphs' only real effect was height, and height was crushing the map\n"
    "           pane at short viewports). Owner rewrites all story/tutorial copy later. -->\n"
    "      <div style=\"font-size:11px;color:var(--mut);line-height:1.5\">\n"
    "        Scanning is <b style=\"color:var(--gr)\">free</b> — tap it (or press Space) to mine ore by hand.\n"
    "        Bank 10 ore and buy your first <b>Mining Drone</b>; drones mine for you forever.\n"
    "        <br><br>Tap your homeworld on the map to open it and build.\n"
    "      </div>\n",
    label="tut box trimmed to three sentences",
)

assert h.count("const BUILD=619;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch618b applied OK")
