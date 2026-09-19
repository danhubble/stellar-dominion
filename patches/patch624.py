#!/usr/bin/env python3
"""
patch624 (BUILD 625) - owner played b624 on his phone. The drag handle (patch623)
"feels good now, leave it alone" - untouched here. But he does not like the small
`#sshScan` chip patch622 added; he wants the ORIGINAL full-size SCAN SECTOR button
instead, pinned to the BOTTOM of the sheet. Three placements were mocked at runtime
(`/home/claude/shotscanmock.js`, mock-only, touched no game file) and he picked
bottom - the approved look is `/home/claude/shots/scanopt-a-bottom.png`.

This patch REMOVES patch622's chip outright (markup, CSS, no husk left behind) and
replaces it with `#sshScanBar` > `#sshScan`, the last child of `#sysSheet`,
`position:sticky;bottom:0`, full width, carrying the owner-approved look.

Shared look, not a duplicate: `#scan` (in `#left`) and the new `#sshScan` both now
use one `.scanbtn` class for the visual (padding/radius/border/gradient/glow/label
treatment/`:active` press feedback) - one source of truth, so they cannot drift
apart the way two independently-authored rule sets eventually would. The ONE thing
deliberately left keyed to the id `#scan` specifically, untouched, is the narrow-
viewport compact override already living in `@media(max-width:760px)` - that only
applies to the #left instance (crammed into its own 2-column mobile grid at that
width); the sheet's own button has the sheet's full width to itself and is not part
of that grid, so it correctly keeps its full size at every viewport width, matching
the approved mock (which used its own, separately-authored `.mockscan` class with no
such override, at the same 390px width this patch's screenshots are taken at).

It calls the exact same `doScan(e)` #scan always has - `$("#sshScan").addEventListener
("click",e=>doScan(e));` was already wired this way by patch622 and needed no change;
neither did the one shared `clickPow()` block that updates both `#clickv` and
`#sshScanV` (both ids carry over unchanged from the chip to the new button, so the
click-wiring and the yield-text update needed zero JS edits beyond the visibility
toggle described below).

Collision with `#sysThreatActs`: that element is ALSO `position:sticky;bottom:0`
inside `#sysSheet` (DEFEND IT / LET THEM HOLD). Two sticky-bottom rows would
overlap. Resolution, exactly as asked: when a threat is showing, `#sysThreatActs`
wins and `#sshScanBar` hides; renderSysSheet() already branches on `th` (the queued
threat, or null) right where `acts.hidden` is itself set - `#sshScanBar`'s own
`.hidden` is now set in the same two branches, unconditionally, every render pass
that reaches this code (not gated behind the `dataset.h` churn key, which is about
suppressing an unnecessary innerHTML rebuild, not about hiding). This is a boolean-
attribute toggle on a node that always exists in the static markup - never a rebuild,
same idiom `#sysThreatActs`/`#sysHanWrap`/`#sysOdds` already use throughout this
render function.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=624;", "const BUILD=625;", label="BUILD bump")

# ==================================================================== CSS: #scan -> shared .scanbtn
do(
    "#scan{\n"
    "  width:100%;padding:14px 10px;border-radius:12px;cursor:pointer;\n"
    "  border:1px solid rgba(72,226,255,.45);\n"
    "  background:linear-gradient(180deg,rgba(72,226,255,.20),rgba(72,226,255,.05));\n"
    "  color:#eafcff;font:700 13px/1 system-ui;letter-spacing:.18em;\n"
    "  box-shadow:0 0 22px rgba(72,226,255,.12) inset;transition:transform .06s,box-shadow .2s\n"
    "}\n"
    "#scan:active{transform:scale(.97);box-shadow:0 0 32px rgba(72,226,255,.35) inset}\n"
    "#scan small{display:block;margin-top:5px;font:400 10px/1 ui-monospace,monospace;letter-spacing:.05em;color:#a9e9ff}\n",
    "/* patch624: factored into a shared class so #scan (in #left) and #sshScan\n"
    "   (pinned to the bottom of #sysSheet) can never drift apart - one source of\n"
    "   truth for the padding/radius/border/gradient/glow/label/:active treatment.\n"
    "   The #left-only compact override just below (inside @media(max-width:760px))\n"
    "   is still keyed to the id #scan specifically, on purpose - see the patch\n"
    "   header for why the sheet's own button must NOT inherit it. */\n"
    ".scanbtn{\n"
    "  width:100%;padding:14px 10px;border-radius:12px;cursor:pointer;\n"
    "  border:1px solid rgba(72,226,255,.45);\n"
    "  background:linear-gradient(180deg,rgba(72,226,255,.20),rgba(72,226,255,.05));\n"
    "  color:#eafcff;font:700 13px/1 system-ui;letter-spacing:.18em;\n"
    "  box-shadow:0 0 22px rgba(72,226,255,.12) inset;transition:transform .06s,box-shadow .2s\n"
    "}\n"
    ".scanbtn:active{transform:scale(.97);box-shadow:0 0 32px rgba(72,226,255,.35) inset}\n"
    ".scanbtn small{display:block;margin-top:5px;font:400 10px/1 ui-monospace,monospace;letter-spacing:.05em;color:#a9e9ff}\n",
    label=".scanbtn shared class",
)

# ==================================================================== CSS: drop the chip, add the bottom bar
do(
    "/* patch622: the sheet's own SCAN chip - #sysSheet is the scrolling ancestor\n"
    "   (overflow-y:auto), so position:sticky;top:0 (not absolute, which was confirmed\n"
    "   to scroll away with a tall #sysBuildRows) is what actually keeps it reachable\n"
    "   regardless of scroll position - see the patch header for why it is its own\n"
    "   line rather than sharing #sysInfo's <h4> line. Compact and flush left, well\n"
    "   short of .sshx's own top:10/right:12 26x26 box on the right - no hit-area\n"
    "   overlap possible. */\n"
    ".sshscan{position:sticky;top:0;z-index:3;display:inline-flex;align-items:center;gap:6px;\n"
    "  margin:2px 0 8px;padding:7px 12px;border-radius:9px;box-sizing:border-box;\n"
    "  border:1px solid rgba(72,226,255,.45);background:rgba(8,13,32,.94);\n"
    "  color:#eafcff;font:700 11px/1 system-ui;letter-spacing:.1em;cursor:pointer;\n"
    "  box-shadow:0 2px 12px -3px rgba(0,0,0,.55);transition:transform .06s}\n"
    ".sshscan:active{transform:scale(.96)}\n"
    ".sshscan svg{width:15px;height:15px;display:block;flex:none}\n"
    ".sshscan b{color:#a9e9ff;font-weight:800}\n",
    "/* patch624: the sheet's own SCAN SECTOR button, replacing patch622's chip on\n"
    "   the owner's own request (three placements mocked, bottom chosen - see the\n"
    "   patch header). position:sticky;bottom:0, same bar treatment #sysThreatActs\n"
    "   already uses right below it in the markup - full-bleed dark bar (the negative\n"
    "   margin cancels #sysSheet's own 14px side padding), .scanbtn itself inset by\n"
    "   this bar's own 14px padding. #sshScanBar (this wrapper) is what gets hidden\n"
    "   when #sysThreatActs is showing, not just the button, so no empty bar/padding\n"
    "   is left behind - see renderSysSheet() for the toggle. */\n"
    ".sshscanbot{position:sticky;bottom:0;z-index:2;margin:10px -14px 0;\n"
    "  padding:10px 14px calc(6px + env(safe-area-inset-bottom,0px));\n"
    "  background:#0a0e24;border-top:1px solid var(--line);\n"
    "  box-shadow:0 -10px 18px -8px rgba(0,0,0,.6)}\n"
    ".sshscanbot[hidden]{display:none}\n",
    label="drop chip CSS, add .sshscanbot bar CSS",
)

# ==================================================================== markup: #scan gets the shared class
do(
    '<button id="scan">SCAN SECTOR<small>free · yields <b id="clickv">+1</b> <svg class="ci ore" viewBox="0 0 48 48" id="scanIco"></svg></small></button>\n',
    '<button id="scan" class="scanbtn">SCAN SECTOR<small>free · yields <b id="clickv">+1</b> <svg class="ci ore" viewBox="0 0 48 48" id="scanIco"></svg></small></button>\n',
    label="#scan gets .scanbtn",
)

# ==================================================================== markup: drop the chip from its old spot
do(
    '          <!-- patch622: created ONCE here, never rebuilt by a render function -\n'
    "               tchurn2.js sweeps every on-pane button for DOM-identity churn. Wired\n"
    "               to the exact same doScan(e) the big #scan button uses; #sshScanIco/\n"
    '               #sshScanV are filled/updated the same way #scanIco/#clickv already are. -->\n'
    '          <button type="button" class="sshscan" id="sshScan" aria-label="Scan for ore">\n'
    '            <svg class="ci ore" viewBox="0 0 48 48" id="sshScanIco"></svg>SCAN <b id="sshScanV"></b>\n'
    "          </button>\n"
    '          <div id="sysThreat" hidden></div>\n',
    '          <div id="sysThreat" hidden></div>\n',
    label="drop chip markup",
)

# ==================================================================== markup: add the bottom-pinned button as
# the LAST child of #sysSheet, right after #sysThreatActs - #sshScan/#sshScanIco/#sshScanV ids are reused
# unchanged from the chip on purpose, so the click-wiring/icon-fill/yield-text JS below needs no edits at all.
do(
    '          <div id="sysThreatActs" class="row" hidden></div>\n'
    "        </div>\n",
    '          <div id="sysThreatActs" class="row" hidden></div>\n'
    "          <!-- patch624: created ONCE here, never rebuilt - tchurn2.js sweeps every\n"
    "               on-pane button for DOM-identity churn. #sshScanBar (this wrapper) is\n"
    "               what renderSysSheet() hides while #sysThreatActs is showing (both are\n"
    "               position:sticky;bottom:0 - mutually exclusive, never both visible).\n"
    "               #sshScan wires to the exact same doScan(e) #scan does; #sshScanIco/\n"
    "               #sshScanV fill/update the same way #scanIco/#clickv already do.\n"
    "               Starts VISIBLE (no `hidden` here), not hidden - renderSysSheet()'s own\n"
    "               `if(s.home||!act){...;return}` returns before ever reaching the block\n"
    "               that would otherwise show/hide this against #sysThreatActs, so the\n"
    "               home system never runs that logic at all (pre-existing, unrelated to\n"
    "               this patch - home's sheet has never shown #sysThreatActs either).\n"
    "               Defaulting to visible is what keeps the button present for home, same\n"
    "               as every other system's resting state once no threat is queued. -->\n"
    '          <div class="sshscanbot" id="sshScanBar">\n'
    '            <button type="button" id="sshScan" class="scanbtn" aria-label="Scan for ore">SCAN SECTOR<small>free · yields <b id="sshScanV">+1</b> <svg class="ci ore" viewBox="0 0 48 48" id="sshScanIco"></svg></small></button>\n'
    "          </div>\n"
    "        </div>\n",
    label="add #sshScanBar as last child of #sysSheet (starts visible - see comment for why)",
)

# ==================================================================== JS: show/hide #sshScanBar opposite
# #sysThreatActs - unconditional every render pass that reaches this branch, a boolean-attribute toggle on
# the one static node, never an innerHTML rebuild.
do(
    "    if(!th){\n"
    '      if(thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n'
    '      if(acts&&acts.dataset.h!==""){ acts.dataset.h=""; acts.innerHTML=""; acts.hidden=true }\n'
    "    } else {\n",
    "    if(!th){\n"
    '      if(thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n'
    '      if(acts&&acts.dataset.h!==""){ acts.dataset.h=""; acts.innerHTML=""; acts.hidden=true }\n'
    '      { const sb=$("#sshScanBar"); if(sb)sb.hidden=false; }\n'
    "    } else {\n",
    label="show scan bar when no threat",
)

do(
    "      if(acts){\n"
    "        acts.hidden=false;\n"
    '        if(acts.dataset.h!==tkey){\n'
    "          acts.dataset.h=tkey;\n"
    '          acts.innerHTML=`<button class="warn" id="sshThrGo">DEFEND IT</button>\n'
    '            <button class="ghost" id="sshThrHold">LET THEM HOLD \\u00b7 ${tod}%</button>`;\n'
    '          $("#sshThrGo").onclick=()=>{ startDefence(th.id); };\n'
    '          $("#sshThrHold").onclick=()=>{ holdLine(th.id); };\n'
    "        }\n"
    "      }\n"
    "    }\n"
    "  }\n",
    "      if(acts){\n"
    "        acts.hidden=false;\n"
    '        if(acts.dataset.h!==tkey){\n'
    "          acts.dataset.h=tkey;\n"
    '          acts.innerHTML=`<button class="warn" id="sshThrGo">DEFEND IT</button>\n'
    '            <button class="ghost" id="sshThrHold">LET THEM HOLD \\u00b7 ${tod}%</button>`;\n'
    '          $("#sshThrGo").onclick=()=>{ startDefence(th.id); };\n'
    '          $("#sshThrHold").onclick=()=>{ holdLine(th.id); };\n'
    "        }\n"
    "      }\n"
    '      { const sb=$("#sshScanBar"); if(sb)sb.hidden=true; }\n'
    "    }\n"
    "  }\n",
    label="hide scan bar when a threat is showing",
)

# ==================================================================== JS: comment upkeep only (still one
# clickPow() call feeding both readouts - #sshScanV's id is unchanged, so the code itself needed no edit)
do(
    "  /* patch622: one clickPow() call updates both yield readouts - #clickv (the big\n"
    "     #scan button) and #sshScanV (the sheet's own chip) - never two separate\n"
    "     computations of the same number. */\n",
    "  /* patch622/624: one clickPow() call updates both yield readouts - #clickv (the\n"
    "     #left button) and #sshScanV (the sheet's own bottom-pinned button, patch624 -\n"
    "     the chip patch622 first put this id on is gone, the id carried over to the\n"
    "     new button unchanged) - never two separate computations of the same number. */\n",
    label="comment upkeep",
)

assert h.count("const BUILD=625;") == 1
assert "sshscan{" not in h
assert '.sshscan"' not in h
assert "sshscanbot" in h
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch624 applied OK")
