#!/usr/bin/env python3
"""
patch615 (BUILD 616) - Run 3, item 2: site view on the zoom canvas (PLAN-unify.md).

drawSite() (and its helpers siteBG/siteGhost/siteUnit) used to read a bare
module-scope `ox`/`OW`/`OH` - the old #core/#orb widget's own canvas context,
deleted by patch612 along with the widget itself. Those three identifiers no
longer exist anywhere in the file, so every one of these functions has been
dead code (a guaranteed ReferenceError if ever called) since patch612 - dead,
but syntactically valid, so nothing caught it until now. This patch refactors
all four functions to take an explicit canvas context, mirroring
drawSysScene(g,W,H,vid,t,D,compose)'s own pattern (patch602): every `ox.` call
becomes `g.` on an explicit first parameter, and OW/OH (the old widget's own,
also-deleted canvas size) become CW/CH, passed in by the caller.

A new session-only `mapSite` variable (analogous to `mapZoom`, never saved -
the plan's own "Watch for" note: "a save with S.site set: ignore it, mapSite
starts null") tracks which ore-ladder tier (a GENS index, same numbering
SITE[] and siteUnit()'s own switch already use) is open. Tapping a built (or
next-up) tier's .gi icon in #sysBuild sets it; the zoom canvas (draw()'s
existing per-frame branch) draws drawSite() instead of drawSysScene() while
it's set. Only ore-ladder tiers have site art (SITE has 14 entries, matching
GENS[0..13], the ore ladder) - a kind-ladder row's .gi icon is not tappable
and the CSS cursor:zoom-in affordance is scoped to ore-ladder rows only
(.gi.gi-site), so a rock/gas/belt/ice/void system's icons no longer look
tappable either.

#mapZoomBack is reused, not duplicated, for the "back to planet" control the
plan calls "'SYSTEM' in the bar" - relabelled to "< SYSTEM" while a site is
open (clearing mapSite, staying zoomed) and back to "< MAP" otherwise
(clearing the zoom entirely, unchanged). setMapZoom() itself always clears
mapSite too, so leaving the zoom by any of its other paths (sheet close,
outside tap, sector change, tab change - all already funnel through
setMapZoom(), unchanged by this patch) drops any open site view for free.

The old S.site/openSite() toggle (the original #core-widget mechanism) is
left completely alone - untouched, still dead, not reused. The plan's own
"Watch for" note is explicit that a legacy S.site in a save is to be ignored,
which this patch does simply by never reading it.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=615;", "const BUILD=616;", label="BUILD bump")

# ==================================================================== CSS: scope the
# cursor:zoom-in affordance to ore-ladder rows only - a kind-ladder row's .gi has no
# site art and must not look tappable.
do(
    ".g .gi{cursor:zoom-in;transition:box-shadow .15s,border-color .15s}\n"
    ".g .gi:hover{box-shadow:0 0 0 2px var(--a)}\n",
    ".g .gi{transition:box-shadow .15s,border-color .15s}\n"
    "/* patch615: only ore-ladder tiers have site art (SITE has 14 entries, matching\n"
    "   GENS[0..13]) - ladderTierRow() adds this class only when GENS[gi].kind===\"ore\",\n"
    "   so a kind-ladder row's icon no longer looks tappable either. */\n"
    ".g .gi.gi-site{cursor:zoom-in}\n"
    ".g .gi.gi-site:hover{box-shadow:0 0 0 2px var(--a)}\n",
    label="gi-site cursor scoping CSS",
)

# ==================================================================== JS: mapSite state
do(
    "let mapZoom=null, mapZoomT0=0, mzVisFrac=1;\n",
    "let mapZoom=null, mapZoomT0=0, mzVisFrac=1;\n"
    "/* patch615: which ore-ladder tier's site view is open on the zoom canvas, as a\n"
    "   GENS index (same numbering SITE[]/siteUnit() already use) - null when showing\n"
    "   the planet instead. Session-only, same reasoning as mapZoom itself: never\n"
    "   saved, always starts null (the plan's own \"Watch for\" note - a legacy S.site in\n"
    "   an old save is simply never read by any of this). */\n"
    "let mapSite=null;\n",
    label="mapSite declaration",
)

do(
    '  const nameEl=$("#mapZoomName");\n'
    "  if(nameEl){ const s=id?SYSMAP[id]:null; nameEl.textContent=s?s.n.toUpperCase():\"\"; }\n"
    "}\n"
    '$("#mapZoomBack").onclick=()=>{ setMapZoom(null); dirty=true; render(); };\n',
    '  const nameEl=$("#mapZoomName");\n'
    "  if(nameEl){ const s=id?SYSMAP[id]:null; nameEl.textContent=s?s.n.toUpperCase():\"\"; }\n"
    "  /* patch615: (re)targeting or leaving the zoom always drops any open site view -\n"
    "     it belongs to whichever system was zoomed, never survives a switch. */\n"
    "  mapSite=null; syncMapZoomBack();\n"
    "}\n"
    "/* patch615: relabelled, not duplicated - \"< SYSTEM\" (drop the site view, keep the\n"
    "   zoom) while mapSite is set, \"< MAP\" (drop the zoom entirely) otherwise. */\n"
    "function syncMapZoomBack(){\n"
    '  const b=$("#mapZoomBack"); if(b)b.textContent = mapSite!=null ? "\\u2039 SYSTEM" : "\\u2039 MAP";\n'
    "}\n"
    '$("#mapZoomBack").onclick=()=>{\n'
    "  if(mapSite!=null){ mapSite=null; syncMapZoomBack(); dirty=true; render(); return; }\n"
    "  setMapZoom(null); dirty=true; render();\n"
    "};\n",
    label="mapSite clear-on-zoom-change + back button relabel/behaviour",
)

# ==================================================================== JS: .gi tap wiring
# (ladderTierRow() - the #sysBuild row builder, generic per (sysId,gi), unchanged
# otherwise; only the .gi icon itself gains a class + a click handler.)
do(
    '  el.innerHTML=`<div class="gi">${iconFor(gi)}</div>\n',
    '  el.innerHTML=`<div class="gi${g.kind==="ore"?" gi-site":""}">${iconFor(gi)}</div>\n',
    label="ladderTierRow .gi class",
)
do(
    '  el.querySelector(".gb").onclick=ev=>{ ev.stopPropagation(); if(!ladderBuy(sysId,gi))blip(140,.08,"sine",.03); dirty=true; render(); };\n'
    "  return el;\n"
    "}\n",
    '  el.querySelector(".gb").onclick=ev=>{ ev.stopPropagation(); if(!ladderBuy(sysId,gi))blip(140,.08,"sine",.03); dirty=true; render(); };\n'
    "  /* patch615: only ore-ladder tiers have site art - see the header note by\n"
    "     .gi.gi-site in the stylesheet. Tapping it opens (or, tapping the same one\n"
    "     again, drops) the site view on the zoom canvas; mapZoom is already this same\n"
    "     sysId whenever this row can be on screen at all (renderSysBuild() only shows\n"
    "     #sysBuild for held systems, and a held system's node tap always zooms - see\n"
    "     buildMap()'s own b.onclick), so there is nothing else to set. */\n"
    '  if(g.kind==="ore"){\n'
    '    const giEl=el.querySelector(".gi");\n'
    "    if(giEl)giEl.onclick=ev=>{\n"
    "      ev.stopPropagation();\n"
    "      mapSite = mapSite===gi ? null : gi;\n"
    "      if(mapSite!=null)siteT0=performance.now();\n"
    "      syncMapZoomBack(); dirty=true; render();\n"
    "    };\n"
    "  }\n"
    "  return el;\n"
    "}\n",
    label="ladderTierRow .gi tap handler",
)

# ==================================================================== JS: refactor
# siteBG/siteGhost/siteUnit/drawSite to take an explicit context, matching
# drawSysScene(g,...)'s own pattern (patch602). Mechanical ox->g / OW,OH->CW,CH;
# the four local gradient variables that used to shadow-name themselves `g`
# (colliding with the new outer `g` context param) are renamed `gr`.

SITE_OLD = h[h.index("function siteBG(kind,t,X,Y,W,H,D,hz){"):h.index("const ORB_R0=")]
assert SITE_OLD.count("\n") > 200, f"unexpected block size: {SITE_OLD.count(chr(10))} lines"

SITE_NEW = SITE_OLD

# 1) rename the four/one colliding local gradient vars (each `const g=ox.create...`
#    together with its own immediate `g.addColorStop(...)`/`ox.fillStyle=g` uses) to
#    `gr`, BEFORE the blanket ox.->g. rename below (else it would self-collide).
_renames = [
    ('const g=ox.createLinearGradient(X,Y,X,Y+H);g.addColorStop(0,a);g.addColorStop(1,b);return g};',
     'const gr=ox.createLinearGradient(X,Y,X,Y+H);gr.addColorStop(0,a);gr.addColorStop(1,b);return gr};'),
    ('const g=ox.createRadialGradient(X+W*0.4,cy-rr*0.25,rr*0.2,X+W*0.5,cy,rr);\n'
     '    g.addColorStop(0,"#4d8bf0"); g.addColorStop(.6,"#1d3f8f"); g.addColorStop(1,"#0a1236");\n'
     '    ox.fillStyle=g; ox.beginPath(); ox.arc(X+W*0.5,cy,rr,0,6.2832); ox.fill();',
     'const gr=ox.createRadialGradient(X+W*0.4,cy-rr*0.25,rr*0.2,X+W*0.5,cy,rr);\n'
     '    gr.addColorStop(0,"#4d8bf0"); gr.addColorStop(.6,"#1d3f8f"); gr.addColorStop(1,"#0a1236");\n'
     '    ox.fillStyle=gr; ox.beginPath(); ox.arc(X+W*0.5,cy,rr,0,6.2832); ox.fill();'),
    ('const g=ox.createRadialGradient(sx0,sy0,sr*0.2,sx0,sy0,sr*2.4);\n'
     '    g.addColorStop(0,"rgba(255,232,160,.9)"); g.addColorStop(.28,"rgba(255,170,60,.45)");\n'
     '    g.addColorStop(1,"rgba(255,120,30,0)");\n'
     '    ox.fillStyle=g; ox.beginPath(); ox.arc(sx0,sy0,sr*2.4,0,6.2832); ox.fill();',
     'const gr=ox.createRadialGradient(sx0,sy0,sr*0.2,sx0,sy0,sr*2.4);\n'
     '    gr.addColorStop(0,"rgba(255,232,160,.9)"); gr.addColorStop(.28,"rgba(255,170,60,.45)");\n'
     '    gr.addColorStop(1,"rgba(255,120,30,0)");\n'
     '    ox.fillStyle=gr; ox.beginPath(); ox.arc(sx0,sy0,sr*2.4,0,6.2832); ox.fill();'),
    ('      const g=ox.createRadialGradient(0,0,u*0.04,0,0,u*0.80);\n'
     '      g.addColorStop(0,"rgba(255,240,190,.9)"); g.addColorStop(.4,"rgba(255,170,70,.38)");\n'
     '      g.addColorStop(1,"rgba(255,140,40,0)");\n'
     '      ox.fillStyle=g; ox.beginPath(); ox.arc(0,0,u*0.80,0,6.2832); ox.fill();',
     '      const gr=ox.createRadialGradient(0,0,u*0.04,0,0,u*0.80);\n'
     '      gr.addColorStop(0,"rgba(255,240,190,.9)"); gr.addColorStop(.4,"rgba(255,170,70,.38)");\n'
     '      gr.addColorStop(1,"rgba(255,140,40,0)");\n'
     '      ox.fillStyle=gr; ox.beginPath(); ox.arc(0,0,u*0.80,0,6.2832); ox.fill();'),
    ('      const g=ox.createLinearGradient(-u*0.52,0,u*0.52,0);\n'
     '      g.addColorStop(0,"rgba(255,226,150,.95)"); g.addColorStop(1,"rgba(120,90,40,.7)");\n'
     '      ox.fillStyle=g; ox.fillRect(-u*0.52,-u*0.24,u*1.04,u*0.48); ox.fillStyle=col;',
     '      const gr=ox.createLinearGradient(-u*0.52,0,u*0.52,0);\n'
     '      gr.addColorStop(0,"rgba(255,226,150,.95)"); gr.addColorStop(1,"rgba(120,90,40,.7)");\n'
     '      ox.fillStyle=gr; ox.fillRect(-u*0.52,-u*0.24,u*1.04,u*0.48); ox.fillStyle=col;'),
    ('      const g=ox.createLinearGradient(-u*0.7,0,u*0.7,0);\n'
     '      g.addColorStop(0,"rgba(120,60,255,.18)"); g.addColorStop(.5,"rgba(255,200,120,.85)");\n'
     '      g.addColorStop(1,"rgba(120,60,255,.18)");\n'
     '      ox.fillStyle=g; ox.beginPath();',
     '      const gr=ox.createLinearGradient(-u*0.7,0,u*0.7,0);\n'
     '      gr.addColorStop(0,"rgba(120,60,255,.18)"); gr.addColorStop(.5,"rgba(255,200,120,.85)");\n'
     '      gr.addColorStop(1,"rgba(120,60,255,.18)");\n'
     '      ox.fillStyle=gr; ox.beginPath();'),
]
for old, new in _renames:
    n = SITE_NEW.count(old)
    assert n == 1, f"rename anchor count {n} != 1 for {old[:50]!r}"
    SITE_NEW = SITE_NEW.replace(old, new, 1)

# 2) blanket ox. -> g. (every remaining `ox.` is a real canvas-context call; the
#    colliding local vars are already renamed off `g` above so this can't self-collide)
n_ox = SITE_NEW.count("ox.")
SITE_NEW = SITE_NEW.replace("ox.", "g.")
assert SITE_NEW.count("g.") >= n_ox

# 3) function signatures gain the explicit context param `g`, matching drawSysScene
SITE_NEW = SITE_NEW.replace(
    "function siteBG(kind,t,X,Y,W,H,D,hz){",
    "function siteBG(g,kind,t,X,Y,W,H,D,hz){", 1)
SITE_NEW = SITE_NEW.replace(
    "function siteGhost(o,u,t,k,col,D,first){",
    "function siteGhost(g,o,u,t,k,col,D,first){", 1)
SITE_NEW = SITE_NEW.replace(
    "function siteUnit(i,o,u,t,k,col,D,ground){",
    "function siteUnit(g,i,o,u,t,k,col,D,ground){", 1)

# 4) drawSite() itself: new signature (g,CW,CH,t,D,sysId,gi) - CW/CH replace the old
#    bare OW/OH (the deleted widget's own canvas size, now passed in by the caller);
#    `i`/S.site (the old #core-widget's own global tier index) become the gi/sysId
#    parameters; gCount(i) (a global count across every system) becomes
#    sysTierCount(sysId,gi) (this one system's own count - what "the zoom canvas draws
#    THIS system's site" actually requires); internal calls to siteBG/siteGhost/siteUnit
#    gain the `g` argument.
old_drawsite_head = (
    "function drawSite(t,D){\n"
    "  const i=S.site, cfg=SITE[i], col=TCOL[i%TCOL.length];\n"
    "  const padT=Math.round(OH*0.17), padB=Math.round(OH*(innerWidth<=760?0.13:0.05));\n"
    "  const X=OW*0.03, Y=padT, W=OW*0.94, H=Math.max(12,OH-padT-padB);\n"
)
new_drawsite_head = (
    "function drawSite(g,CW,CH,t,D,sysId,gi){\n"
    "  const i=gi, cfg=SITE[i], col=TCOL[i%TCOL.length];\n"
    "  const padT=Math.round(CH*0.17), padB=Math.round(CH*(innerWidth<=760?0.13:0.05));\n"
    "  const X=CW*0.03, Y=padT, W=CW*0.94, H=Math.max(12,CH-padT-padB);\n"
)
n = SITE_NEW.count(old_drawsite_head)
assert n == 1, f"drawSite head anchor count {n} != 1"
SITE_NEW = SITE_NEW.replace(old_drawsite_head, new_drawsite_head, 1)

SITE_NEW = SITE_NEW.replace(
    "  g.clearRect(0,0,OW,OH);\n  siteBG(cfg.bg,t,X,Y,W,H,D,hz);\n\n"
    "  const built=gCount(i);\n",
    "  g.clearRect(0,0,CW,CH);\n  siteBG(g,cfg.bg,t,X,Y,W,H,D,hz);\n\n"
    "  const built=sysTierCount(sysId,gi);\n",
    1)

SITE_NEW = SITE_NEW.replace(
    "  const zoom=Math.min(1,(t-siteT0)/240);\n  g.save();\n"
    "  if(zoom<1){ g.translate(OW/2,OH/2); const z=0.88+0.12*zoom;\n"
    "    g.scale(z,z); g.translate(-OW/2,-OH/2); g.globalAlpha=zoom }\n",
    "  const zoom=Math.min(1,(t-siteT0)/240);\n  g.save();\n"
    "  if(zoom<1){ g.translate(CW/2,CH/2); const z=0.88+0.12*zoom;\n"
    "    g.scale(z,z); g.translate(-CW/2,-CH/2); g.globalAlpha=zoom }\n",
    1)

SITE_NEW = SITE_NEW.replace(
    "    if(k<shown) siteUnit(i,o,u,t,k,col,D,ground);\n"
    "    else siteGhost(o,u,t,k,col,D,k===shown);\n",
    "    if(k<shown) siteUnit(g,i,o,u,t,k,col,D,ground);\n"
    "    else siteGhost(g,o,u,t,k,col,D,k===shown);\n",
    1)

do(SITE_OLD, SITE_NEW, label="siteBG/siteGhost/siteUnit/drawSite explicit-context refactor")

# ==================================================================== JS: draw() - the
# zoom-canvas per-frame branch picks drawSite() over drawSysScene() while mapSite is set.
do(
    "  if(mzx&&MZW&&mapZoom){\n"
    "    /* same entry-transition shape drawSite() already uses for its own zoom-in. Clear\n"
    "       the FULL (untransformed) canvas first - drawSysScene() does its own clearRect\n"
    "       too, but that one happens inside the scale below, so on its own it would only\n"
    "       ever clear the shrunk sub-rect and leave a stale ring round the edge while\n"
    "       zoom<1. This one is what actually keeps every frame clean. */\n"
    "    mzx.clearRect(0,0,MZW,MZH);\n"
    "    const zoom=Math.min(1,(t-mapZoomT0)/250);\n"
    "    mzx.save();\n"
    "    if(zoom<1){ mzx.translate(MZW/2,MZH/2); const z=0.88+0.12*zoom;\n"
    "      mzx.scale(z,z); mzx.translate(-MZW/2,-MZH/2); mzx.globalAlpha=zoom }\n"
    "    const bandH=MZH*mzVisFrac;\n"
    "    drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio,{cy:bandH*0.5,bandH});\n"
    "    mzx.restore(); mzx.globalAlpha=1;\n"
    "  }\n",
    "  if(mzx&&MZW&&mapZoom){\n"
    "    /* same entry-transition shape drawSite() already uses for its own zoom-in. Clear\n"
    "       the FULL (untransformed) canvas first - drawSysScene()/drawSite() do their own\n"
    "       clearRect too, but that one happens inside the scale below, so on its own it\n"
    "       would only ever clear the shrunk sub-rect and leave a stale ring round the edge\n"
    "       while zoom<1. This one is what actually keeps every frame clean. */\n"
    "    mzx.clearRect(0,0,MZW,MZH);\n"
    "    const zoom=Math.min(1,(t-mapZoomT0)/250);\n"
    "    mzx.save();\n"
    "    if(zoom<1){ mzx.translate(MZW/2,MZH/2); const z=0.88+0.12*zoom;\n"
    "      mzx.scale(z,z); mzx.translate(-MZW/2,-MZH/2); mzx.globalAlpha=zoom }\n"
    "    /* patch615: the site view, one system's one tier, replaces the planet on this\n"
    "       same canvas while mapSite is set - see setMapZoom()/syncMapZoomBack() for how\n"
    "       it's entered/left. */\n"
    "    if(mapSite!=null){\n"
    "      drawSite(mzx,MZW,MZH,t,devicePixelRatio,mapZoom,mapSite);\n"
    "    } else {\n"
    "      const bandH=MZH*mzVisFrac;\n"
    "      drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio,{cy:bandH*0.5,bandH});\n"
    "    }\n"
    "    mzx.restore(); mzx.globalAlpha=1;\n"
    "  }\n",
    label="draw() site-view branch",
)

# ==================================================================== markup: tutorial
# box last line, again - it can describe the real feature now that patch615 built it.
do(
    "        <!-- PLACEHOLDER: patch613c - the site-view zoom this used to describe has\n"
    "             no live UI hookup (Run 3/patch615 builds it); reworded to what tapping\n"
    "             a system actually does today. Owner revisits once the site view is\n"
    "             back. -->\n"
    "        <br><br>Tap any system on the map to open it.\n",
    "        <!-- patch615: the site-view zoom is back (tap a held system on the map, then\n"
    "           a built structure's icon in the sheet) - this line describes it again. -->\n"
    "        <br><br>Tap a system, then tap one of its structures, to zoom in on its site.\n",
    label="tutorial box last line reworded again",
)

# ==================================================================== window.__SD export
do(
    "  get mapMode(){return mapMode},syncMapMode,renderMapList,\n",
    "  get mapMode(){return mapMode},syncMapMode,renderMapList,\n"
    "  get mapSite(){return mapSite},drawSite,\n",
    label="window.__SD export: mapSite/drawSite",
)

assert h.count("const BUILD=616;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch615 applied OK")
