#!/usr/bin/env python3
"""
patch618 (BUILD 618) - Run 1/PLAN-open.md, item 2: fresh-save boot state.

Three independent changes, all about a player who has never touched this save:

(a) fresh() sets msel:null instead of msel:"home" - a brand-new save now boots
    with the system sheet CLOSED. initMapSec() already falls back to
    secOf(S.msel||"home") whenever S.msel is null (patch609, unchanged by this
    patch) - that is the ONLY fallback path, nothing new is added.

(b) #mapWrap gains a "homeonly" class while the map is showing home only - the
    same level()<8 condition sysInSec()/buildMap() already gate on (patch609/
    609b), reused verbatim rather than recomputed. #mapWrap.homeonly caps the
    square at ~30vh (down from the base 52vh) so #left (SCAN SECTOR + the
    Getting Started box) sits above the fold on a short phone once the sheet
    is no longer auto-open to fill that space. Toggled in renderMap(), the
    existing per-pass render path - a class flip on the one persistent
    #mapWrap element, not a rebuild, so tchurn2.js's DOM-identity sweep is
    unaffected.

(c) One new line in the #tut Getting Started box telling the player to tap
    their homeworld on the map to build - now that the sheet no longer opens
    itself at boot, the box has to say where the first purchase happens.
    Marked PLACEHOLDER: the owner rewrites all story/tutorial copy later
    (same convention patch613c/615 already used for this same box).

Test fallout: none of tunify2.js/tsheet2.js/tmap2.js/tzoom2.js assert a fresh
save's default S.msel - every scenario that needs the sheet open already
selects a node or sets S.msel explicitly first (confirmed by inspection before
writing this patch). No test assertion needed changing.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=617;", "const BUILD=618;", label="BUILD bump")

# ==================================================================== (a) fresh()
do(
    '    msel:"home", trip:null, hist:{iv:HIV0,a:0,d:[]}, mtab:"rate",\n',
    "    /* patch618: a brand-new save boots with the sheet CLOSED - initMapSec()\n"
    '       already falls back to secOf(S.msel||"home") whenever this is null\n'
    "       (patch609), so nothing else needs to change for the map itself to still\n"
    "       land on home's sector. */\n"
    '    msel:null, trip:null, hist:{iv:HIV0,a:0,d:[]}, mtab:"rate",\n',
    label="fresh() msel:null",
)

# ==================================================================== (b) CSS
do(
    "#mapWrap{position:relative;width:100%;aspect-ratio:1/1;max-height:52vh;margin:0 auto 10px;\n"
    "  border:1px solid rgba(120,150,255,.22);border-radius:14px;overflow:hidden;\n"
    "  background:radial-gradient(circle at 50% 50%,rgba(60,90,190,.18),rgba(6,9,22,.85) 68%)}\n",
    "#mapWrap{position:relative;width:100%;aspect-ratio:1/1;max-height:52vh;margin:0 auto 10px;\n"
    "  border:1px solid rgba(120,150,255,.22);border-radius:14px;overflow:hidden;\n"
    "  background:radial-gradient(circle at 50% 50%,rgba(60,90,190,.18),rgba(6,9,22,.85) 68%)}\n"
    "/* patch618: while the map is showing home only (level()<8 - the same condition\n"
    "   sysInSec()/buildMap() already gate on, see renderMap()), the square caps\n"
    "   smaller so #left (SCAN SECTOR + the Getting Started box) sits above the fold\n"
    "   on a short phone once the sheet no longer auto-opens to fill that space. */\n"
    "#mapWrap.homeonly{max-height:30vh}\n",
    label="mapWrap.homeonly CSS",
)

# ==================================================================== (b) JS: renderMap()
do(
    "function renderMap(){\n"
    "  initMapSec();\n",
    "function renderMap(){\n"
    "  initMapSec();\n"
    '  /* patch618: class toggle only, on the one persistent #mapWrap element - never\n'
    "     a rebuild (tchurn2.js sweeps every on-pane button for DOM-identity churn).\n"
    "     level()<8 is the exact condition sysInSec() already filters home-only on. */\n"
    '  { const w=$("#mapWrap"); if(w)w.classList.toggle("homeonly",level()<8); }\n',
    label="renderMap homeonly toggle",
)

# ==================================================================== (c) tutorial box
do(
    "        Scanning is <b style=\"color:var(--gr)\">free</b> — tap it (or press Space) to mine ore by hand.\n"
    "        Bank 10 ore and buy your first <b>Mining Drone</b>; drones mine for you forever.\n"
    "        <br><br>Every structure you build adds to your ore per second, forever.\n",
    "        Scanning is <b style=\"color:var(--gr)\">free</b> — tap it (or press Space) to mine ore by hand.\n"
    "        Bank 10 ore and buy your first <b>Mining Drone</b>; drones mine for you forever.\n"
    "        <!-- PLACEHOLDER: patch618 - a fresh save now boots with the sheet closed\n"
    "             (msel:null, Run 1/PLAN-open.md item 2), so the player needs to be told\n"
    "             where to spend that first bank of ore. Owner rewrites all story/\n"
    "             tutorial copy later. -->\n"
    "        <br><br>Tap your homeworld on the map to open it and build.\n"
    "        <br><br>Every structure you build adds to your ore per second, forever.\n",
    label="tut box new line",
)

assert h.count("const BUILD=618;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch618 applied OK")
