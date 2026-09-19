#!/usr/bin/env python3
"""
patch605 — review fix (PLAN-zoom.md batch 1): the planet was positioned for the
wrong box.

`drawSysScene()`'s `cy=H*0.52`/`R=Math.min(W*0.125,H*0.215)` are right for the
Empire tab's `#orb` (nothing overlaps it), but on the Map tab `#sysSheet` is
`position:fixed;bottom:0;max-height:58vh` and can overlap the BOTTOM half (or
more) of `#mapWrap` once it's open - the mock never caught this because it
laid the two out stacked, not overlapping. Composing the scene for the whole
square left the planet's own centre sitting low, partly behind the sheet, with
a dead band under the `‹ MAP` bar above it.

Fix: `drawSysScene()` takes an optional last argument, `compose` - `{cy,bandH}`
- describing the part of the square that is actually visible above the sheet.
The Empire tab's own call site is untouched (no argument passed, so `cy`/`R`
fall through to the exact original expressions - byte-identical to before);
only the map-zoom call site computes and passes one.

`bandH`/the band itself is real measured layout (`#sysSheet`/`#mapWrap`
`getBoundingClientRect()`), not a guess, read from `renderMap()` (already
running on every real state change, never inside `draw()`'s 60Hz loop) and
cached in `mzVisFrac` - see `mapZoomMeasure()`'s own header comment for why
that one function covers every way the sheet can be open, closed, or dragged,
including the one live bug this went looking for and found: `endDefence()`
loses a system and sets `S.msel=null` directly (line ~7605), never touching
`mapZoom` - so a lost-while-zoomed defence fight is a real, reachable case of
"zoom stays open, sheet is gone" that composing purely off `S.msel` would have
missed. Left that call site alone (not forcing a zoom-close there too) since
the coordinator's ask was specifically for the RENDER to cope with this state,
and it is arguably the better experience anyway - the player just watched
their system get taken; snapping the map shut under them on top of that would
be one more thing happening at once, not a kindness.

A second, independent bug the same review caught: the orbit lanes' own radius
shape (`rr=R*(1.82+pos*0.20)`, untouched since patch604 only ever touched
sprite SIZE, never lane radius) was never checked against a LONG ladder on the
much bigger, roughly-square zoom canvas - fine on the wide Empire-tab widget
(plenty of horizontal room to absorb it), not fine here: a fully-built home
(the only 14-tier ladder in the game - every other kind is 3 tiers) pushes its
outermost lane past half the square's own side. Capped `R` (zoom only, again
via `compose`) so the WORST CASE for this system's own ladder length - not
just what is currently built, so the planet never visibly resizes the moment
a new tier finishes - always fits inside the visible band on both axes.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------- drawSysScene(): compose argument, band-based cy/R, ladder-length cap ----------------
do(
    "function drawSysScene(g,W,H,vid,t,D){\n"
    "  g.clearRect(0,0,W,H);\n"
    "  const cx=W/2, cy=H*0.52, RY=0.55, R=Math.min(W*0.125,H*0.215);\n"
    "  ang+=0.0042;\n",
    "function drawSysScene(g,W,H,vid,t,D,compose){\n"
    "  g.clearRect(0,0,W,H);\n"
    "  /* compose (map-zoom only - the Empire tab call passes nothing, so cy/R below are\n"
    "     its EXACT original expressions, untouched): {cy,bandH}, the part of the square\n"
    "     that is actually visible above #sysSheet (which can overlap the bottom of\n"
    "     #mapWrap once open) instead of the whole H. See mapZoomMeasure() and draw()'s\n"
    "     zoom branch. */\n"
    "  const bandH=compose?compose.bandH:H;\n"
    "  const cx=W/2, cy=compose?compose.cy:H*0.52, RY=0.55;\n"
    "  let R=Math.min(W*0.125,bandH*0.215);\n"
    "  ang+=0.0042;\n",
    label="drawSysScene signature + band-based cy/R",
)

do(
    '  const evs=vid==="home"?null:SYSMAP[vid];\n'
    "  const vc=gi=>sysTierCount(vid,gi);\n"
    "\n"
    "    // galactic backdrop (tier 10)\n",
    '  const evs=vid==="home"?null:SYSMAP[vid];\n'
    "  const vc=gi=>sysTierCount(vid,gi);\n"
    "  /* this system's own ladder - moved up from the orbit-lanes loop below (which still\n"
    "     uses this same `ladder`, not a second lookup) so its LENGTH is available for the\n"
    "     safety cap right here. */\n"
    "  const ladder=sysLadder(vid);\n"
    "  if(compose && ladder.length>1){\n"
    "    /* zoom-only: cap R so the OUTERMOST possible lane - this system's full ladder,\n"
    "       not just what is currently built, so the planet never visibly resizes the\n"
    "       moment a new tier finishes - stays inside the visible band on both axes. Only\n"
    "       home's 14-tier ore ladder ever actually binds this; every other kind is 3\n"
    "       tiers and already comfortably inside the size above. */\n"
    "    const maxRingMul=1.82+(ladder.length-1)*0.20;\n"
    "    const hHalf=(W/2)*0.94, vHalf=Math.min(cy,bandH-cy)*0.94;\n"
    "    R=Math.min(R, Math.min(hHalf,vHalf/RY)/maxRingMul);\n"
    "  }\n"
    "\n"
    "    // galactic backdrop (tier 10)\n",
    label="ladder-length safety cap",
)

do(
    "    const lanes=[];\n"
    "    const ladder=sysLadder(vid);\n"
    "    for(let pos=0;pos<ladder.length;pos++){\n",
    "    const lanes=[];\n"
    "    for(let pos=0;pos<ladder.length;pos++){\n",
    label="drop the now-duplicate ladder lookup",
)

# ---------------- mzVisFrac state + mapZoomMeasure() ----------------
do(
    "let mapZoom=null, mapZoomT0=0;",
    "let mapZoom=null, mapZoomT0=0, mzVisFrac=1;",
    label="mzVisFrac state",
)
do(
    "  SECTORS,SEC_LANES,SEC_EXIT,secOf,sysInSec,get mapSec(){return mapSec},setMapSec,\n"
    "  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,",
    "  SECTORS,SEC_LANES,SEC_EXIT,secOf,sysInSec,get mapSec(){return mapSec},setMapSec,\n"
    "  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,mapZoomMeasure,get mzVisFrac(){return mzVisFrac},",
    label="__SD export additions (605)",
)

do(
    "function renderMap(){",
    "/* Real measured layout for the map-zoom composition above, not a guess - see\n"
    "   drawSysScene()'s own `compose` comment. Called only from renderMap() (already\n"
    "   running on every real state change, never inside draw()'s 60Hz loop) and only\n"
    "   while actually zoomed, so this is at most renderMap()'s own render cadence, not a\n"
    "   per-frame cost. #sysSheet's closed-state transform (translateY(110%)) naturally\n"
    "   reports as being off the bottom of #mapWrap once measured, so there is no separate\n"
    "   \"is the sheet open\" branch here - one geometry read covers every way the sheet can\n"
    "   be open, closed, dragged, or (see patch605's own header note - endDefence() losing\n"
    "   a system) cleared out from under the zoom by something else entirely. */\n"
    "function mapZoomMeasure(){\n"
    '  const wrapEl=$("#mapWrap"), sheetEl=$("#sysSheet");\n'
    "  if(!wrapEl||!sheetEl)return;\n"
    "  const wrapRect=wrapEl.getBoundingClientRect();\n"
    "  if(wrapRect.height<8)return;                 /* mid-layout; keep the last good value */\n"
    "  const localTop=sheetEl.getBoundingClientRect().top-wrapRect.top;\n"
    "  /* floored, not left to shrink to nothing - an almost-fully-covered square should\n"
    "     still show a small planet, not one degenerating toward invisible. */\n"
    "  mzVisFrac=Math.max(0.34, Math.min(1, localTop/wrapRect.height));\n"
    "}\n"
    "function renderMap(){",
    label="mapZoomMeasure()",
)

do(
    "  }\n"
    "}\n"
    "function renderLevel(){",
    "  }\n"
    "  if(mapZoom)mapZoomMeasure();\n"
    "}\n"
    "function renderLevel(){",
    label="call mapZoomMeasure() from renderMap() (normal exit)",
)

do(
    '    const hanWrap=$("#sysHanWrap");\n'
    '    if(hanWrap&&!hanWrap.hidden){ hanWrap.hidden=true; hanWrap.dataset.h=""; hanWrap.innerHTML=""; }\n'
    "    return;\n"
    "  }",
    '    const hanWrap=$("#sysHanWrap");\n'
    '    if(hanWrap&&!hanWrap.hidden){ hanWrap.hidden=true; hanWrap.dataset.h=""; hanWrap.innerHTML=""; }\n'
    "    /* this function has two exits - the sheet-closed early return right here, and the\n"
    "       normal end below - mapZoomMeasure() has to run from BOTH, or \"sheet just closed,\n"
    "       zoom stays open\" (the exact case this patch exists for) would keep reading a stale\n"
    "       band forever, since this return skips the one at the bottom entirely. */\n"
    "    if(mapZoom)mapZoomMeasure();\n"
    "    return;\n"
    "  }",
    label="call mapZoomMeasure() from renderMap() (sheet-closed early exit)",
)

# ---------------- draw()'s zoom branch: pass compose ----------------
do(
    "    if(zoom<1){ mzx.translate(MZW/2,MZH/2); const z=0.88+0.12*zoom;\n"
    "      mzx.scale(z,z); mzx.translate(-MZW/2,-MZH/2); mzx.globalAlpha=zoom }\n"
    "    drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio);\n"
    "    mzx.restore(); mzx.globalAlpha=1;\n",
    "    if(zoom<1){ mzx.translate(MZW/2,MZH/2); const z=0.88+0.12*zoom;\n"
    "      mzx.scale(z,z); mzx.translate(-MZW/2,-MZH/2); mzx.globalAlpha=zoom }\n"
    "    const bandH=MZH*mzVisFrac;\n"
    "    drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio,{cy:bandH*0.5,bandH});\n"
    "    mzx.restore(); mzx.globalAlpha=1;\n",
    label="draw() zoom branch compose",
)

h = h.replace("const BUILD=604;", "const BUILD=605;", 1)
assert "const BUILD=605;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch605 applied OK")
