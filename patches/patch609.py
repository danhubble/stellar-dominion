#!/usr/bin/env python3
"""
patch609 — PLAN-unify.md Run 1, patch 3 of 3: the opening.

Before level 8 the map shows only Sol Reach — `sysInSec()` (the one function every
map-drawing/lookup path already goes through: `buildMap()`, `renderMap()`, the churn
sweep, etc.) now filters every non-home system out below that level, so nothing extra
had to learn about the gate. Sector chips and `#mapEdge` (the exit arrow / fleet-warning
strip) hide with it — both get a real `[hidden]` CSS rule, not just the attribute, since
both already carry their own `display` from an ID rule that would otherwise keep
out-ranking the browser's default `[hidden]{display:none}` (same reason `#sysDefWrap`
etc. each carry their own `[hidden]` rule already).

The `UNLOCK` entry for Map keeps `lv:8` — `checkUnlocks()` still queues `vega:map` at
that level exactly as before (untouched) — but its effect is now the reveal above, not
hiding a tab: `renderLevel()`'s generic "hide every tab below its own UNLOCK level" loop
now special-cases `p-map` to always stay visible (patch608 made it the default tab,
which this loop would otherwise have hidden for every player below level 8, taking the
whole tab bar down to nothing with it — confirmed on a level-1 fresh save before this
patch, `.tab[data-p="p-map"]` computed `display:none`). The `vega:map` beat's own text
is reworded to the discovery line the plan asks for ("more systems just came up on the
charts") and marked `/* PLACEHOLDER */` for the owner to rewrite, same as every other
story line in this file — the key (`vega:map`) and its `S.seen` back-fill in `adopt()`
are untouched, exactly as instructed.

A fresh save now starts with `S.msel:"home"` (was `null`) instead of a bare boot-time
special case — `renderMap()` already opens the sheet for whatever `S.msel` names, so a
fresh game lands on the map with Sol Reach selected and its sheet open with no extra
wiring. An *old* save loaded below level 8 could have `S.msel` naming some other system
from before this gate existed (the map used to show every system in a sector regardless
of level) — left alone, `renderMap()` would still find that system in `SYSMAP` and open
its sheet even though `sysInSec()` no longer draws a node for it anywhere, exactly the
"selecting an invisible node" the plan warns about. Sanitised in `adopt()`, placed after
`S=f` (like the `S.han` sanitiser just above it) because it needs `level()`, which reads
the just-adopted save's own `S.lvl` — not whatever was true before this load.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---- 1. VEGA's map beat: reworded to the discovery line, PLACEHOLDER like the rest ----
do(
    ' map:       {t:"Long-range charts are up. Other systems. Other owners, eventually.", go:"p-map"},\n',
    ' map:       {t:"More systems just came up on the charts. Some of them are already somebody\'s.", go:"p-map"}, /* PLACEHOLDER */\n',
    label="VEGA map beat",
)

# ---- 2. a fresh save starts on the map, Sol Reach selected ----
do(
    '    msel:null, trip:null, hist:{iv:HIV0,a:0,d:[]}, mtab:"rate",\n',
    '    msel:"home", trip:null, hist:{iv:HIV0,a:0,d:[]}, mtab:"rate",\n',
    label="fresh() msel default",
)

# ---- 3. sysInSec(): only home below level 8 ----
do(
    'function sysInSec(sec){ return SYS.filter(s=>s.sec===sec) }\n',
    '/* patch609: before level 8 the map shows only Sol Reach - every draw/lookup path\n'
    '   (buildMap, renderMap, the map churn sweep) already goes through this one function,\n'
    '   so gating it here is the whole reveal. */\n'
    'function sysInSec(sec){ return SYS.filter(s=>s.sec===sec && (level()>=8||s.home)) }\n',
    label="sysInSec level gate",
)

# ---- 4. sector chips hide below level 8 ----
do(
    'function renderMapChips(){\n'
    '  buildMapChips();\n'
    '  $$("#mapChips .chip").forEach(c=>c.classList.toggle("on", +c.dataset.i===mapSec));\n'
    '}\n',
    '/* patch609: nothing to switch sectors to before level 8 (sysInSec() shows only home\n'
    '   everywhere), so the chip row hides with it rather than sitting there empty/inert. */\n'
    'function renderMapChips(){\n'
    '  const host=$("#mapChips");\n'
    '  buildMapChips();\n'
    '  if(host)host.hidden = level()<8;\n'
    '  $$("#mapChips .chip").forEach(c=>c.classList.toggle("on", +c.dataset.i===mapSec));\n'
    '}\n',
    label="renderMapChips level gate",
)

# ---- 5. #mapEdge (exit arrow / fleet warnings) hides below level 8 ----
do(
    'function renderMapEdge(){\n'
    '  const host=$("#mapEdge"); if(!host)return;\n'
    '  const exit=SEC_EXIT[mapSec];\n',
    '/* patch609: the exit arrow (and every fleet/threat warning pill this same host draws)\n'
    '   only ever points at another sector - there is nothing to point at before level 8. */\n'
    'function renderMapEdge(){\n'
    '  const host=$("#mapEdge"); if(!host)return;\n'
    '  if(level()<8){ host.hidden=true; host.innerHTML=""; return; }\n'
    '  host.hidden=false;\n'
    '  const exit=SEC_EXIT[mapSec];\n',
    label="renderMapEdge level gate",
)
do(
    "#mapEdge{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}\n",
    "#mapEdge{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}\n"
    "#mapEdge[hidden],#mapChips[hidden]{display:none}\n",
    label="mapEdge/mapChips [hidden] CSS",
)

# ---- 6. renderLevel(): the map tab is always visible now, regardless of level ----
do(
    "  for(const u of UNLOCK){\n"
    "    const t=$$(\".tab\").find(x=>x.dataset.p===u.p);\n"
    "    if(t)t.style.display = L>=u.lv ? \"\" : \"none\";\n"
    "  }\n",
    "  /* patch609: the UNLOCK entry for p-map still carries lv:8 (checkUnlocks() still\n"
    "     queues vega:map off it, unchanged) but no longer hides the tab itself - patch608\n"
    "     made it the default tab, so hiding it below level 8 would take the whole bar down\n"
    "     to nothing for a brand-new player. sysInSec()'s own gate is the real reveal now. */\n"
    "  for(const u of UNLOCK){\n"
    "    if(u.p===\"p-map\")continue;\n"
    "    const t=$$(\".tab\").find(x=>x.dataset.p===u.p);\n"
    "    if(t)t.style.display = L>=u.lv ? \"\" : \"none\";\n"
    "  }\n",
    label="renderLevel p-map always visible",
)

# ---- 7. adopt(): an old save's S.msel may name a system the level-8 gate now hides ----
do(
    "  if(S.__seedXp){ delete S.__seedXp; xpSeedAll() }\n",
    "  /* patch609: an old save can carry S.msel naming a system that sysInSec() no longer\n"
    "     draws a node for below level 8 (the map used to show every system in a sector\n"
    "     regardless of level) - left alone, renderMap() would still find it in SYSMAP and\n"
    "     open its sheet on a node that isn't there. Placed after S=f, like the S.han\n"
    "     sanitiser just above, because it needs level() to read this save's OWN S.lvl. */\n"
    "  if(S.msel && S.msel!==\"home\" && level()<8) S.msel=null;\n"
    "  if(S.__seedXp){ delete S.__seedXp; xpSeedAll() }\n",
    label="adopt msel visibility sanitiser",
)

h = h.replace("const BUILD=608;", "const BUILD=609;", 1)
assert "const BUILD=609;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch609 applied OK")
