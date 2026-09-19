#!/usr/bin/env python3
"""
patch622 (BUILD 623) - Patch D / owner's real-phone note: "In the beginning I'm
having to close the screen, tap a few times to manually get ore, open the screen
back again." Early game the loop is scan -> buy -> scan, and the sheet covers
#scan in #left the whole time it's open.

Adds a compact SCAN chip (#sshScan) pinned to the top of #sysSheet, wired to the
exact same doScan(e) code path #scan already uses - NOT a second implementation,
NOT a second `#clickv`-style updater (see below). Shown at every game stage, per
the owner's own choice, not gated to early game.

Placement note (read before assuming this duplicates the plan word-for-word): the
brief describes it as "in the same row as the system name, opposite .sshx." A
literal shared text line with the system name is not reachable without either (a)
editing renderMap()'s own #sysInfo template string, which would put the button
inside content that gets torn down and rebuilt on every real change - a violation
of the "create once, only toggle" rule this exact patch is also required to
follow - or (b) a float/sticky combination that behaves inconsistently across
browsers. Chosen instead: #sshScan is its own persistent line, its own
`position:sticky;top:0`, immediately above #sysThreat/#sysInfo (so it reads as
this header block, not a separate screen), flush left - the mirror side from
`.sshx`'s own top:10/right:12. At the common scrollTop:0 case (sheet just
opened - what both requested screenshots show) it sits in the exact same visual
band .sshx already occupies; unlike `.sshx` (position:absolute, confirmed with a
Playwright probe before writing this to ALSO scroll away with sheet content once
#sysBuildRows grows tall enough to overflow - a pre-existing bug, out of scope,
left alone) `#sshScan`'s own `position:sticky` keeps it reachable regardless of
scroll position, which is the actual requirement ("never scrolls out of reach").
Narrow enough (compact chip, well under half the sheet's width) that it can never
reach `.sshx`'s own hit box, and it never shares a text line with `<h4>`, so the
system name can never be squeezed into an ellipsis by it - the constraint is met
by construction, not by measuring a close call.

`doScan(ev)` itself needed no changes: it already reads `ev.clientX/clientY` for
the floating "+N" feedback, so tapping the chip already puts the float at the
chip, not at wherever #scan happens to be - confirmed by reading the function
before writing this, not assumed.

`#clickv` (the existing yield text on the big #scan button) is updated from one
spot in the main render loop. `#sshScanV` (the chip's own yield text) is updated
from that SAME spot, same `clickPow()` call, not a second computation - if that
number ever changes shape, both update together by construction.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=622;", "const BUILD=623;", label="BUILD bump")

# ==================================================================== CSS
do(
    ".sshx{position:absolute;top:10px;right:12px;border:1px solid var(--line);border-radius:8px;\n"
    "  width:26px;height:26px;background:rgba(255,255,255,.05);color:var(--mut);\n"
    "  font:700 12px/1 system-ui;cursor:pointer}\n"
    ".sshx:hover{color:var(--txt);border-color:var(--line2)}\n",
    ".sshx{position:absolute;top:10px;right:12px;border:1px solid var(--line);border-radius:8px;\n"
    "  width:26px;height:26px;background:rgba(255,255,255,.05);color:var(--mut);\n"
    "  font:700 12px/1 system-ui;cursor:pointer}\n"
    ".sshx:hover{color:var(--txt);border-color:var(--line2)}\n"
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
    label="sshscan CSS",
)

# ==================================================================== markup
do(
    '          <button type="button" class="sshx" id="sshClose" aria-label="Close">✕</button>\n'
    '          <div id="sysThreat" hidden></div>\n',
    '          <button type="button" class="sshx" id="sshClose" aria-label="Close">✕</button>\n'
    "          <!-- patch622: created ONCE here, never rebuilt by a render function -\n"
    "               tchurn2.js sweeps every on-pane button for DOM-identity churn. Wired\n"
    "               to the exact same doScan(e) the big #scan button uses; #sshScanIco/\n"
    '               #sshScanV are filled/updated the same way #scanIco/#clickv already are. -->\n'
    '          <button type="button" class="sshscan" id="sshScan" aria-label="Scan for ore">\n'
    '            <svg class="ci ore" viewBox="0 0 48 48" id="sshScanIco"></svg>SCAN <b id="sshScanV"></b>\n'
    "          </button>\n"
    '          <div id="sysThreat" hidden></div>\n',
    label="sshScan markup",
)

# ==================================================================== JS: icon fill (one-time, same site as #scanIco's own)
do(
    '$("#scanIco").innerHTML=RES_ICON.ore;\n',
    '$("#scanIco").innerHTML=RES_ICON.ore;\n'
    '$("#sshScanIco").innerHTML=RES_ICON.ore;\n',
    label="sshScanIco fill",
)

# ==================================================================== JS: click wiring (same doScan(e) path, not a
# reimplementation)
do(
    '$("#scan").addEventListener("click",e=>doScan(e));\n',
    '$("#scan").addEventListener("click",e=>doScan(e));\n'
    '$("#sshScan").addEventListener("click",e=>doScan(e));\n',
    label="sshScan click wiring",
)

# ==================================================================== JS: yield text - one spot updates both
do(
    '  $("#clickv").textContent="+"+fmt(clickPow());\n',
    "  /* patch622: one clickPow() call updates both yield readouts - #clickv (the big\n"
    "     #scan button) and #sshScanV (the sheet's own chip) - never two separate\n"
    "     computations of the same number. */\n"
    '  { const cv="+"+fmt(clickPow());\n'
    '    $("#clickv").textContent=cv;\n'
    '    const sv=$("#sshScanV"); if(sv)sv.textContent=cv; }\n',
    label="sshScanV yield text",
)

assert h.count("const BUILD=623;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch622 applied OK")
