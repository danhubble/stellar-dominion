#!/usr/bin/env python3
"""
patch613c (BUILD 614) - two small fixes from the owner's second patch613b review:

1. #exoStrip is now gated on the same "ever banked" test each of its own entries
   already uses (exoEverBanked()), applied to the whole strip - before anything has
   ever been banked (a fresh save's first hour) it used to render as four dim,
   number-less dots, pure clutter pushing the map down. Once anything has ever been
   banked (or Exotic Nodes have, the strip's own existing 5th-entry condition) it stays
   visible forever - exoEverBanked() is already permanent (S.exoSeen never clears), so
   this needed no new state, just reading the existing gate one level higher up.
2. The tutorial box's last line described tapping a structure to zoom onto its own
   site - that feature has had zero live UI hookup since before Run 2 even started
   (Run 3/patch615 is what actually builds it). Reworded to what tapping a system does
   today (opens the sheet), marked as placeholder copy for the owner to revisit once
   the site view actually returns.

Item 1 changes real, tested behaviour, not just wiring - one assertion in tnodes2.js
needed updating as a direct consequence (flagged here, not silently edited): it asserted
a fresh save's #exoStrip renders 4 entries at zero balance ("5th entry hidden, the other
4 always shown"). That was true before this patch and is the exact thing this patch
changes on purpose - a fresh save now renders ZERO entries, strip hidden outright.
Reworded to assert the new, intended behaviour instead of the old one.
"""

PATHS = {
    "html": "/home/claude/stellar-dominion-empire2.html",
    "tnodes2": "/home/claude/tests/tnodes2.js",
}
_cache = {name: open(p, encoding="utf-8").read() for name, p in PATHS.items()}


def do(anchor, new, count=1, label=None, file="html"):
    h = _cache[file]
    n = h.count(anchor)
    assert n == count, f"[{file}] anchor count {n} != {count} for {label or anchor[:60]!r}"
    _cache[file] = h.replace(anchor, new, count)


do("const BUILD=613;", "const BUILD=614;", label="BUILD bump")

# --- CSS: explicit [hidden] rule - #exoStrip sets its own display:flex, which would
#     otherwise outrank the UA stylesheet's [hidden]{display:none}, same pattern
#     #sysBuild/#sysDefWrap/etc already use one section up. ---
do(
    "#exoStrip{display:flex;gap:10px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden;align-items:center}\n",
    "#exoStrip{display:flex;gap:10px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden;align-items:center}\n"
    "#exoStrip[hidden]{display:none}\n",
    label="exoStrip[hidden] CSS",
)

# --- JS: gate the whole strip on "ever banked anything", not per-entry only ---
do(
    "function renderExoStrip(){\n"
    "  const strip=$(\"#exoStrip\");\n"
    "  if(!strip)return;\n"
    "  /* patch582b: number and rate stack in their own column now (.exnums) so one\n"
    "     item's width only has to fit the wider of the two strings, not their sum -\n"
    "     see the patch header for the overlap this replaced. */\n"
    "  let html=EXO.map(e=>{\n"
    "    const r=exoRate(e.id), have=exo(e.id), held=r>0||have>0;\n"
    "    return `<div class=\"exi${held?\" held\":\"\"}\" style=\"--a:${e.col}\" title=\"${e.n}\">\n"
    "      <i class=\"exdot\"></i>${held?`<div class=\"exnums\"><b>${fmt(have)}</b><span>${r>0?\"+\"+fmt(r)+\"/s\":\"\"}</span></div>`:\"\"}</div>`;\n"
    "  }).join(\"\");\n"
    "  /* Exotic Nodes: a 5th strip entry, own colour, hidden until the first ring-3/4\n"
    "     claim ever produces or produced one - see enRate()'s header comment. */\n"
    "  const enR=enRate(), enHave=S.en||0;\n"
    "  if(enR>0||enHave>0){\n"
    "    html+=`<div class=\"exi held\" style=\"--a:${EN_COL}\" title=\"Exotic Nodes\">\n"
    "      <i class=\"exdot\"></i><div class=\"exnums\"><b>${fmt(enHave)}</b><span>${enR>0?\"+\"+fmt(enR)+\"/s\":\"\"}</span></div></div>`;\n"
    "  }\n"
    "  strip.innerHTML=html;\n"
    "}\n",
    "function renderExoStrip(){\n"
    "  const strip=$(\"#exoStrip\");\n"
    "  if(!strip)return;\n"
    "  const enR=enRate(), enHave=S.en||0;\n"
    "  /* patch613c: the strip itself, not just each entry, is gated on \"ever banked\" -\n"
    "     before that it is four dim, number-less dots, pure clutter in the first hour\n"
    "     and it pushes the map down for nothing. Same permanent test exoEverBanked()\n"
    "     already gives each entry below, exactly one level higher, plus the Exotic\n"
    "     Nodes condition this function already had - once true it stays true forever\n"
    "     (S.exoSeen never clears), so no new state, no un-hiding once shown. */\n"
    "  const everBankedAnything = EXO.some(e=>exoEverBanked(e.id)) || enR>0 || enHave>0;\n"
    "  strip.hidden = !everBankedAnything;\n"
    "  if(!everBankedAnything)return;\n"
    "  /* patch582b: number and rate stack in their own column now (.exnums) so one\n"
    "     item's width only has to fit the wider of the two strings, not their sum -\n"
    "     see the patch header for the overlap this replaced. */\n"
    "  let html=EXO.map(e=>{\n"
    "    const r=exoRate(e.id), have=exo(e.id), held=r>0||have>0;\n"
    "    return `<div class=\"exi${held?\" held\":\"\"}\" style=\"--a:${e.col}\" title=\"${e.n}\">\n"
    "      <i class=\"exdot\"></i>${held?`<div class=\"exnums\"><b>${fmt(have)}</b><span>${r>0?\"+\"+fmt(r)+\"/s\":\"\"}</span></div>`:\"\"}</div>`;\n"
    "  }).join(\"\");\n"
    "  /* Exotic Nodes: a 5th strip entry, own colour, hidden until the first ring-3/4\n"
    "     claim ever produces or produced one - see enRate()'s header comment. */\n"
    "  if(enR>0||enHave>0){\n"
    "    html+=`<div class=\"exi held\" style=\"--a:${EN_COL}\" title=\"Exotic Nodes\">\n"
    "      <i class=\"exdot\"></i><div class=\"exnums\"><b>${fmt(enHave)}</b><span>${enR>0?\"+\"+fmt(enR)+\"/s\":\"\"}</span></div></div>`;\n"
    "  }\n"
    "  strip.innerHTML=html;\n"
    "}\n",
    label="renderExoStrip whole-strip gate",
)

# --- markup: tutorial box's stale site-view line, reworded + marked placeholder ---
do(
    "        <br><br>Tap any structure to zoom the system view onto its site.\n",
    "        <!-- PLACEHOLDER: patch613c - the site-view zoom this used to describe has\n"
    "             no live UI hookup (Run 3/patch615 builds it); reworded to what tapping\n"
    "             a system actually does today. Owner revisits once the site view is\n"
    "             back. -->\n"
    "        <br><br>Tap any system on the map to open it.\n",
    label="tutorial box last line reworded",
)

# ==================================================================== tnodes2.js
do(
    "// ---------- #exoStrip: 5th entry hidden until S.en>0 || enRate()>0 ----------\n"
    " const stripHidden=await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   G.adopt(G.fresh());\n"
    "   G.renderExoStrip();\n"
    "   return document.querySelectorAll('#exoStrip .exi').length;\n"
    " });\n"
    " ok('#exoStrip has only the 4 EXO entries when S.en===0 and enRate()===0 (fresh save)', stripHidden===4, stripHidden);\n",
    "// ---------- #exoStrip: whole strip hidden until anything has ever been banked;\n"
    " //            once shown, 5th entry (Exotic Nodes) hidden until S.en>0 || enRate()>0\n"
    " // patch613c: this used to assert a fresh save still renders 4 EXO entries at zero\n"
    " // balance (only the 5th, Nodes, entry was gated) - that was the exact behaviour\n"
    " // patch613c changed on purpose (see HANDOVER): a fresh save now hides the strip\n"
    " // outright, nothing rendered, not four dim placeholder dots.\n"
    " const stripHidden=await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   G.adopt(G.fresh());\n"
    "   G.renderExoStrip();\n"
    "   const el=document.getElementById('exoStrip');\n"
    "   return { count:el.querySelectorAll('.exi').length, hidden:el.hidden };\n"
    " });\n"
    " ok('#exoStrip stays hidden entirely until anything has ever been banked (fresh save)',\n"
    "    stripHidden.count===0 && stripHidden.hidden===true, stripHidden);\n",
    label="tnodes2 fresh-save exoStrip assertion",
    file="tnodes2",
)

assert _cache["html"].count("const BUILD=614;") == 1

for name, path in PATHS.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(_cache[name])
print("patch613c applied OK")
