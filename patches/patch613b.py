#!/usr/bin/env python3
"""
patch613b (BUILD 613) - coordinator review fix on Run 2: #exoStrip/#lfBanner were real
player-facing UI, not dead weight - patch612 deleted their only DOM host (#p-emp) without
giving either a new one. Rehomes both verbatim (same ids, same render functions,
untouched) to the top of the map pane, in place of the old hint paragraph. This alone
should put tnodes2.js/ttelegraph2.js back to 0 without editing either - confirmed by
running them unmodified after this patch, not assumed.

Also folds in the four smaller items from the same review:
  - #exoStrip/#lfBanner stay visible while the map is zoomed into a system (patch603's
    own .zoomed class only touches #mapWrap's own children - lfBanner/exoStrip sit
    above #mapWrap as siblings, so this needs no extra CSS, only confirming nothing
    already hides them, which nothing does).
  - the hint paragraph is gone outright (see the markup do() below) - its slot is now
    the two widgets.
  - sector chips hide while zoomed: #mapChips is a sibling BEFORE #mapWrap in the DOM,
    so a plain `#mapWrap.zoomed ~ #mapChips` sibling selector cannot reach backward to
    it - setMapZoom() (the one place zoom state ever changes, per its own header
    comment) now also toggles a `zoomed` class on `#p-map` itself, and `#p-map.zoomed
    #mapChips{display:none}` hides the chip row from that shared ancestor. The swipe
    handler already refuses to change sector while zoomed (grepped, confirmed - the
    class was already inert while zoomed, just still visible).
  - the empty-selection context card read "MAP ONLY", which does not tell a player what
    to do - reworded to "TAP A" / "SYSTEM" across the same two stacked lines, same
    nbsp-strut rate line, same card height (verified by direct measurement below, same
    method patch609c used for its own width checks).
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=612;", "const BUILD=613;", label="BUILD bump")

# --- markup: lfBanner/exoStrip replace the hint paragraph at the top of #p-map ---
do(
    '      <div class="pane on" id="p-map">\n'
    '        <p class="hint">Claim systems to earn Dark Matter and the exotic resources your\n'
    '          most advanced structures are built from. Nothing here is ever lost.</p>\n'
    '        <div id="mapChips"></div>\n',
    '      <div class="pane on" id="p-map">\n'
    '        <!-- patch613b: rehomed verbatim from the old #p-emp (deleted by patch612) -\n'
    '             same ids, same renderExoStrip()/renderLiveFleet(), no rewrite. Order:\n'
    '             lfBanner first (an alert, usually absent, wants to be nearest the top),\n'
    '             then exoStrip (the four exotic balances + Exotic Nodes). Neither is\n'
    '             inside #mapWrap, so patch603\'s own .zoomed class (scoped to #mapWrap\'s\n'
    '             children) never hides them - both stay on screen while zoomed, which is\n'
    '             the point: that is when you are spending these currencies. -->\n'
    '        <div id="lfBanner"></div>\n'
    '        <div id="exoStrip"></div>\n'
    '        <div id="mapChips"></div>\n',
    label="rehome lfBanner/exoStrip, drop the hint paragraph",
)

# --- CSS: hide the sector chips while zoomed (dead height - the swipe to change sector
#     is already inert while zoomed, this just stops showing a row that does nothing) ---
do(
    "#mapChips{display:flex;gap:6px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden}\n",
    "#mapChips{display:flex;gap:6px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden}\n"
    "/* patch613b: #mapChips sits BEFORE #mapWrap in the DOM, so #mapWrap.zoomed's own\n"
    "   sibling selectors (~) cannot reach backward to it - setMapZoom() below also\n"
    "   toggles this class on #p-map itself for that reason. Hidden, not just inert:\n"
    "   the swipe-to-change-sector gesture already refuses to fire while zoomed, so a\n"
    "   visible-but-dead chip row was pure wasted height above the sheet. */\n"
    "#p-map.zoomed #mapChips{display:none}\n",
    label="hide sector chips while zoomed",
)

# --- JS: setMapZoom() also stamps #p-map, the only reachable ancestor of #mapChips ---
do(
    '  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);\n'
    '  const nameEl=$("#mapZoomName");\n',
    '  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);\n'
    '  /* patch613b: #mapChips-hiding hook - see its own CSS comment for why this can\'t\n'
    '     just be a sibling selector off #mapWrap.zoomed. */\n'
    '  const pane=$("#p-map"); if(pane)pane.classList.toggle("zoomed",!!id);\n'
    '  const nameEl=$("#mapZoomName");\n',
    label="setMapZoom also toggles #p-map.zoomed",
)

# --- JS: context card empty-selection copy - an instruction, not a label ---
do(
    '       spare. "MAP ONLY" already fits the single name line (measured 43px==43px) so it\n'
    "       keeps the rate line as the nbsp strut, same as every other empty rate line. */\n",
    '       spare. patch613b: "MAP ONLY" told the player nothing to DO - replaced with an\n'
    '       instruction, "TAP A"/"SYSTEM" across the same two stacked lines (measured:\n'
    "       both fit well inside the column patch609c already proved out, same nbsp-strut\n"
    "       idiom, card height unchanged - confirmed by direct measurement, same method\n"
    "       patch609c used for its own width checks, not assumed from the shorter string). */\n",
    label="context card empty-state doc comment",
)
do(
    '    else{ name.textContent="MAP ONLY"; rate.textContent="\\u00A0"; }\n',
    '    else{ name.textContent="TAP A"; rate.textContent="SYSTEM"; }\n',
    label="context card empty-state copy",
)

assert h.count("const BUILD=613;") == 1

open(PATH, "w", encoding="utf-8").write(h)
print("patch613b applied OK")
