#!/usr/bin/env python3
"""
patch607 — PLAN-unify.md Run 1, patch 1 of 3: the header.

Removes the crystal `.rcard` from the header (crystal is spent nowhere but Research,
so it no longer earns a permanent slot in the three-card strip everyone sees on every
tab) and gives it a small balance+rate strip of its own at the top of `#p-res`, above
`#resMode` — same `.rcard.c-cry` look the header card had, just relocated, so no new
CSS was needed for its colour/icon treatment. The freed third header slot becomes the
context card: reads `S.msel` (whatever system the player last looked at, on the map or
anywhere else) and shows that system's exotic — name+rate in `.sub`, balance in `.val`,
a small dot in the exotic's own colour. `render()` updates both new pieces every tick,
exactly like it already does for ore/DM (`renderCtxCard()` unconditionally; the crystal
strip's `renderResCryStrip()` only while `#p-res` is the active pane, since — unlike the
header — it only exists there).

Deliberately NOT touched here (that's patch608, the Tabs patch, per the plan's own
split): the `#p-emp`-gated line right below this one in `render()` that also calls
`renderExoStrip()`/`updateOrbBadge()`, `applyCore()`'s own `#p-emp` check, and every
other `p-emp`/`flag("p-emp")` caller the plan names. Grepped for `.rcard.c-cry` uses
elsewhere: `misChip("cry")` (mission-reward fly animation target) still resolves to
this file's `.rcard.c-cry` — now the Research strip once it exists, or nothing before
the player has ever opened Research, same as `flyReward()`'s own existing
`if(!from||!to)return;` guard already handles for a missing target. Not a crash either
way; left alone, out of this patch's scope.

Context card content: the plan's own text asks for "name, balance, +rate/s, dot in the
exotic's colour" — three pieces of text in a two-line (`val`+`sub`) card. Put balance in
`.val` (matches ore/DM's own big-number slot) and folded name+rate into one `.sub` line
("IRIDIUM +12/s"), same overflow-ellipsis `.sub` already has for a long name at narrow
width. `unify-mock.html`'s own approved header card only shows name in `.sub` (no rate) —
its own numbers are invented per the brief, and the plan's prose is more specific than
the mock's simplified markup, so the mock's LOOK (three-card grid, val/sub two-liner,
dot-tinted card) is matched exactly; its content is extended to fit what the plan asks
for content-wise.

"Tappable is optional — if tapping does nothing, do not make it look tappable" (owner
instruction): the context card gets no `data-res` (so the existing
`$$(".rcard[data-res]").forEach(...)` click-wiring skips it — genuinely inert, not just
unwired) and three small CSS overrides neutralise the generic `.rcard` affordances that
would otherwise suggest it's a button: default cursor (not pointer), no hover-brighten,
and no "quiet dot" top-right (`.rcard:after` — a `.c-ctx` card doesn't get its own colour
rule for that pseudo-element today, so left as-is it would just show a stray grey mark).
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---- 1. header markup: drop the crystal card, add the context card ----
do(
    '    <button class="rcard c-ore" data-res="ore" title="Ore — tap for detail"><div class="ricon" id="riOre"></div><div><div class="val" id="vOre">0</div><div class="sub" id="vRate">0 /s</div></div></button>\n'
    '    <button class="rcard c-cry" data-res="cry" title="Crystal — tap for detail"><div class="ricon" id="riCry"></div><div><div class="val" id="vCry">0</div><div class="sub" id="vCryR">locked</div></div></button>\n'
    '    <button class="rcard c-dm" data-res="dm" title="Dark Matter — tap for detail"><div class="ricon" id="riDm"></div><div><div class="val" id="vDm">0</div><div class="sub" id="vDmS">for the Nexus</div></div></button>\n',
    '    <button class="rcard c-ore" data-res="ore" title="Ore — tap for detail"><div class="ricon" id="riOre"></div><div><div class="val" id="vOre">0</div><div class="sub" id="vRate">0 /s</div></div></button>\n'
    '    <button class="rcard c-dm" data-res="dm" title="Dark Matter — tap for detail"><div class="ricon" id="riDm"></div><div><div class="val" id="vDm">0</div><div class="sub" id="vDmS">for the Nexus</div></div></button>\n'
    '    <!-- patch607: the context card. No data-res (see the header note above) — the\n'
    '         generic .rcard[data-res] click-wiring skips it, so tapping it really is inert. -->\n'
    '    <button class="rcard c-ctx" id="ctxCard" title="Selected system"><div class="ricon"><i class="exdot" id="ctxDot"></i></div><div><div class="val" id="vCtxVal">—</div><div class="sub" id="vCtxSub">—</div></div></button>\n',
    label="header res cards",
)

# ---- 2. CSS: neutralise tap affordances on the context card, size its dot, and give
#    the new Research crystal strip a little breathing room below it ----
do(
    ".c-ore .val{color:var(--cy)} .c-cry .val{color:var(--vi)} .c-dm .val{color:var(--gd)}\n",
    ".c-ore .val{color:var(--cy)} .c-cry .val{color:var(--vi)} .c-dm .val{color:var(--gd)}\n"
    "/* patch607: the context card reads S.msel, not a fixed currency, and per the owner's\n"
    "   own instruction is not tappable today - these three overrides undo the generic\n"
    "   .rcard affordances (pointer cursor, hover brighten, the top-right \"more\" dot) so it\n"
    "   doesn't visually promise a tap that does nothing. */\n"
    ".c-ctx{cursor:default}\n"
    ".c-ctx:hover{border-color:var(--line);background:linear-gradient(180deg,rgba(30,40,80,.45),rgba(12,16,36,.45))}\n"
    ".c-ctx:after{content:none}\n"
    ".c-ctx .ricon{display:flex;align-items:center;justify-content:center}\n"
    ".c-ctx .exdot{width:12px;height:12px;border-radius:50%;background:var(--a,var(--dim));flex:none;opacity:1;transition:background .15s,opacity .15s}\n"
    ".c-ctx .val{color:var(--a,var(--txt))}\n"
    ".c-ctx .sub{color:var(--a,var(--mut))}\n"
    "#resCryStrip{margin-bottom:10px}\n",
    label="context card CSS",
)

# ---- 3. markup: the crystal strip at the top of Research, above #resMode ----
do(
    '      <div class="pane" id="p-res">\n'
    '        <div id="resMode" class="rmode">\n',
    '      <div class="pane" id="p-res">\n'
    '        <div id="resCryStrip"></div>\n'
    '        <div id="resMode" class="rmode">\n',
    label="p-res crystal strip host",
)

# ---- 4. render(): drop the now-gone #vCry/#vCryR writes, add the context card ----
do(
    '  $("#vOre").textContent=fmt(S.ore);\n'
    '  $("#vRate").textContent=fmt(rate())+" /s";\n'
    '  $("#vCry").textContent=fmt(S.cry);\n'
    '  $("#vCryR").textContent=anyOf(1)?fmt(cryRate())+" /s":"build a Smelter Pod";\n'
    '  $("#vDm").textContent=fmt(S.dm);\n',
    '  $("#vOre").textContent=fmt(S.ore);\n'
    '  $("#vRate").textContent=fmt(rate())+" /s";\n'
    '  $("#vDm").textContent=fmt(S.dm);\n',
    label="render() drop vCry",
)
do(
    '  $("#clickv").textContent="+"+fmt(clickPow());\n',
    '  renderCtxCard();\n'
    '  $("#clickv").textContent="+"+fmt(clickPow());\n',
    label="render() add renderCtxCard call",
)
do(
    '  if($("#p-emp").classList.contains("on")){ renderExoStrip(); updateOrbBadge(); }\n',
    '  if($("#p-emp").classList.contains("on")){ renderExoStrip(); updateOrbBadge(); }\n'
    '  if($("#p-res").classList.contains("on"))renderResCryStrip();\n',
    label="render() add renderResCryStrip call",
)

# ---- 5. the two new render functions, next to renderExoStrip() ----
do(
    "function renderExoStrip(){\n",
    "/* patch607 - the header context card. Reads S.msel -> SYSMAP[..].res -> exoDef, same\n"
    "   chain empSysRow()/updateOrbBadge() already read for the same purpose. Runs every\n"
    "   render() tick, unconditionally, like the ore/DM cards it sits beside - it is meant\n"
    "   to answer \"what am I looking at\" from any tab, not just the map (plan's own note:\n"
    "   \"that is intended - it tells you what you last looked at\"). Written into the same\n"
    "   #vCtxVal/#vCtxSub nodes every time (textContent, never innerHTML) - nothing here\n"
    "   ever rebuilds the button, so it costs nothing extra for tchurn2 to sample it. */\n"
    "function renderCtxCard(){\n"
    "  const dot=$(\"#ctxDot\"), val=$(\"#vCtxVal\"), sub=$(\"#vCtxSub\"), card=$(\"#ctxCard\");\n"
    "  if(!dot||!val||!sub||!card)return;\n"
    "  const s = S.msel ? SYSMAP[S.msel] : null;\n"
    "  const ex = s && s.res ? exoDef(s.res) : null;\n"
    "  if(!ex){\n"
    "    card.style.setProperty(\"--a\",\"var(--dim)\");\n"
    "    val.textContent=\"—\"; sub.textContent=\"—\";\n"
    "    return;\n"
    "  }\n"
    "  card.style.setProperty(\"--a\",ex.col);\n"
    "  const r=exoRate(ex.id);\n"
    "  val.textContent=fmt(exo(ex.id));\n"
    "  sub.textContent=ex.n.toUpperCase()+(r>0?\" +\"+fmt(r)+\"/s\":\"\");\n"
    "}\n"
    "/* patch607 - the crystal strip at the top of Research. Skeleton built once (the\n"
    "   dataset.h guard tchurn2 exists to enforce - see its own header note), the live\n"
    "   balance/rate written into that same node's existing children every tick after -\n"
    "   same two-step idiom buildMarket()/renderMarket() already use just below. */\n"
    "function renderResCryStrip(){\n"
    "  const host=$(\"#resCryStrip\"); if(!host)return;\n"
    "  if(host.dataset.h!==\"cry\"){\n"
    "    host.dataset.h=\"cry\";\n"
    "    host.innerHTML='<button type=\"button\" class=\"rcard c-cry\" id=\"resCryBtn\" title=\"Crystal — tap for detail\">"
    "<div class=\"ricon\" id=\"resCryIcon\"></div><div><div class=\"val\" id=\"resCryVal\">0</div>"
    "<div class=\"sub\" id=\"resCryRate\">0 /s</div></div></button>';\n"
    "    $(\"#resCryIcon\").innerHTML=RI(\"cry\",\"\");\n"
    "    $(\"#resCryBtn\").onclick=()=>resourceModal(\"cry\");\n"
    "  }\n"
    "  $(\"#resCryVal\").textContent=fmt(S.cry);\n"
    "  $(\"#resCryRate\").textContent=anyOf(1)?fmt(cryRate())+\" /s\":\"build a Smelter Pod\";\n"
    "}\n"
    "function renderExoStrip(){\n",
    label="new render functions",
)

# ---- 6. boot: #riCry no longer exists in the header ----
do(
    '$("#riOre").innerHTML=RI("ore","");$("#riCry").innerHTML=RI("cry","");$("#riDm").innerHTML=RI("dm","");\n',
    '$("#riOre").innerHTML=RI("ore","");$("#riDm").innerHTML=RI("dm","");\n',
    label="boot riCry init",
)

h = h.replace("const BUILD=606;", "const BUILD=607;", 1)
assert "const BUILD=607;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch607 applied OK")
