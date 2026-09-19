#!/usr/bin/env python3
"""
patch609b (same BUILD, review fix) — the level-8 reveal didn't show up live.

Found while smoke-testing patch609: `renderMap()`'s rebuild guard
(`if(!mapBuilt||mapSecBuilt!==mapSec)buildMap();`) only ever rebuilds on a genuine
sector change, so a player sitting on the map tab when they cross level 8 kept seeing
just Sol Reach until they swapped sectors and back (forcing a rebuild by accident) - the
reveal was real underneath (`sysInSec()` already returned every system) but nothing
re-drew the node list to show it. Confirmed on a live page: bumping S.lvl to 8 and
calling render() with mapSec unchanged left `#mapNodes` at 1 node until a manual
`buildMap()`.

Fixed with one more piece of build-state to compare, `mapRevealBuilt` (mirrors
`mapBuilt`/`mapSecBuilt` exactly - set at the end of `buildMap()`, checked at the top of
`renderMap()`), so a level-8 crossing forces the same rebuild a sector change already
does, with no new polling loop.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do(
    "let mapBuilt=false, mapSec=null, mapSecBuilt=-1, mapChipsBuilt=false;\n",
    "let mapBuilt=false, mapSec=null, mapSecBuilt=-1, mapChipsBuilt=false, mapRevealBuilt=null;\n",
    label="mapRevealBuilt decl",
)
do(
    "  renderMapEdge();\n"
    "  mapBuilt=true; mapSecBuilt=mapSec;\n"
    "}\n",
    "  renderMapEdge();\n"
    "  mapBuilt=true; mapSecBuilt=mapSec; mapRevealBuilt=level()>=8;\n"
    "}\n",
    label="buildMap sets mapRevealBuilt",
)
do(
    "  if(!mapBuilt||mapSecBuilt!==mapSec)buildMap();\n",
    "  /* patch609b: a level-8 crossing changes what sysInSec() returns for the SAME\n"
    "     sector, which the mapSecBuilt check alone can't see - force the same rebuild a\n"
    "     sector change already gets. */\n"
    "  if(!mapBuilt||mapSecBuilt!==mapSec||mapRevealBuilt!==(level()>=8))buildMap();\n",
    label="renderMap rebuild guard",
)

assert "const BUILD=609;" in h  # same BUILD - review fix, not a new patch number

open(PATH, "w", encoding="utf-8").write(h)
print("patch609b applied OK")
