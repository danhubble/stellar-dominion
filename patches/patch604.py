#!/usr/bin/env python3
"""
patch604 — PLAN-zoom.md, patch 3/3: legibility at map-zoom size.

Two things the mock exposed as real bugs in drawSysScene() (not just mock
shortcuts), both scoped to a single system's own drawing rather than the
sprite()/lane-radius maths, which stay untouched:

1. Sprite size was `D*(2.1+pos*0.20)` - a function of devicePixelRatio alone,
   tuned for the Empire tab's own small #orb widget. Blown up to a full map
   square the buildings were nearly invisible (confirmed - see
   shots/zoom-603-smoke-zoomed.png from the previous patch). Rescaled to the
   scene's own planet radius R instead, calibrated so the Empire tab's own
   appearance is unchanged:

   #core is `height:120px` (minus its 1px border = 118 CSS px) at every mobile
   width (`@media(max-width:760px)`, unconditional on width - see its CSS) and
   R's own formula is `Math.min(W*0.125,H*0.215)`, so on the Empire tab the
   0.215 (height) term is always the binding one: R = D*118*0.215 = D*25.37,
   exactly, at any mobile viewport width. That ratio is named ORB_R0 below.
   Substituting D = R/ORB_R0 into the old formula gives
   `R*(2.1+pos*0.20)/ORB_R0` - algebraically the SAME value as the old one
   at the Empire tab's own size (not just "close"), while scaling up
   properly for the much bigger map-zoom canvas. Confirmed by measurement
   (see the batch's final report) and by screenshot compare.

2. Settlement lights used `vc(2)+vc(3)` - GENS indices 2/3 (Crust Borer /
   Fabricator), which are ORE-ladder-only tiers. Home builds the ore ladder,
   so this happened to work for it, but every other system builds a
   DIFFERENT kind ladder (rock/gas/belt/ice/void) and never touches GENS
   2/3 at all - its night side could never light up. Fixed to read that
   system's own ladder (sysLadder(vid)), using its own top two tiers -
   except for `vid==="home"`, which keeps the exact original `vc(2)+vc(3)`
   unchanged: those are two specific low-mid ore-ladder tiers a real save
   plausibly has built early, not "home's own top two" (the ore ladder is
   14 tiers long; its actual top two - Xenon Array/Antimatter Loom - are
   very-late-game and would leave home's default view dark for most of a
   save, a real regression the plan's calibration requirement rules out).
   So: home's own default Empire-tab view is provably unchanged; every other
   system now lights up using the same idea the mock demonstrated on Koru
   (vc(15)+vc(16), its own rock-ladder's top two).

3. Entry transition: scale 0.88->1, alpha 0->1 over ~250ms - the same shape
   drawSite() already uses for its own zoom-in (`Math.min(1,(t-siteT0)/240)`,
   `0.88+0.12*zoom`). Tracked per zoom-open in `mapZoom`'s own setter
   (setMapZoom(), patch603) via a new `mapZoomT0` timestamp, reset every time
   a NEW system is opened (not on every re-render), read once per frame in
   draw()'s zoom-canvas branch.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------- ORB_R0 tuning constant, just above drawSysScene() ----------------
do(
    "function drawSysScene(g,W,H,vid,t,D){",
    '/* TUNING-PENDING: the Empire tab\'s #orb radius, per devicePixelRatio unit, at the\n'
    '   mobile layout - #core is height:120px (minus its 1px border = 118 CSS px) at every\n'
    '   width under the @media(max-width:760px) breakpoint, and R=Math.min(W*0.125,H*0.215)\n'
    '   is always height-bound there (0.215*118 < 0.125*any plausible mobile width), so\n'
    '   R===D*118*0.215 exactly. Sprite size below divides by this to turn "D*(...)" into\n'
    '   an R-based formula that reproduces the OLD D-based one exactly at the Empire tab\'s\n'
    "   own size, while scaling up for a bigger scene (the map zoom) - see patch604. */\n"
    "const ORB_R0=118*0.215;\n"
    "function drawSysScene(g,W,H,vid,t,D){",
    label="ORB_R0 const",
)

# ---------------- sprite size: off R, calibrated to match today's D-based size ----------------
do(
    "        lanes.push({i,a,x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr*RY,s:D*(2.1+pos*0.20)});",
    "        /* R-based, not D-based - see ORB_R0 above. Exactly reproduces the old\n"
    "           D*(2.1+pos*0.20) size at the Empire tab's own R, scales up cleanly for\n"
    "           the much bigger map-zoom canvas. */\n"
    "        lanes.push({i,a,x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr*RY,s:R*(2.1+pos*0.20)/ORB_R0});",
    label="sprite size",
)

# ---------------- settlement lights: this system's own ladder, top two tiers ----------------
do(
    "    const nl=Math.min(LIGHTS.length,vc(2)+vc(3));",
    "    /* home keeps the exact original pair (see patch604's header note for why - its\n"
    "       own ladder's true top two are late-game tiers that would leave the default\n"
    "       Empire-tab view dark); every other system uses its own ladder's top two tiers,\n"
    "       so a night side actually has something to light it up with. */\n"
    "    const litIdx=vid===\"home\"?[2,3]:ladder.slice(-2);\n"
    "    const nl=Math.min(LIGHTS.length,litIdx.reduce((sum,gi)=>sum+vc(gi),0));",
    label="settlement lights",
)

# ---------------- entry transition: track a per-open timestamp in setMapZoom() ----------------
do(
    "function setMapZoom(id){\n"
    "  mapZoom=id;\n"
    "  const wrap=$(\"#mapWrap\"); if(wrap)wrap.classList.toggle(\"zoomed\",!!id);\n"
    "  const nameEl=$(\"#mapZoomName\");\n"
    "  if(nameEl){ const s=id?SYSMAP[id]:null; nameEl.textContent=s?s.n.toUpperCase():\"\"; }\n"
    "}",
    "function setMapZoom(id){\n"
    "  /* only stamp a fresh entry-transition start when actually OPENING (or switching to\n"
    "     a different system) - closing, or an identical re-set, must not restart it. */\n"
    "  if(id&&id!==mapZoom) mapZoomT0=performance.now();\n"
    "  mapZoom=id;\n"
    "  const wrap=$(\"#mapWrap\"); if(wrap)wrap.classList.toggle(\"zoomed\",!!id);\n"
    "  const nameEl=$(\"#mapZoomName\");\n"
    "  if(nameEl){ const s=id?SYSMAP[id]:null; nameEl.textContent=s?s.n.toUpperCase():\"\"; }\n"
    "}",
    label="setMapZoom transition stamp",
)
do(
    "let mapZoom=null;\n"
    'const mapZoomCv=$("#mapZoom");',
    "let mapZoom=null, mapZoomT0=0;\n"
    'const mapZoomCv=$("#mapZoom");',
    label="mapZoomT0 state",
)

# ---------------- draw() zoom branch: apply the same scale/alpha shape drawSite() uses ----------------
do(
    "  if(mzx&&MZW&&mapZoom) drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio);",
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
    "    drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio);\n"
    "    mzx.restore(); mzx.globalAlpha=1;\n"
    "  }",
    label="draw() zoom transition",
)

# ---------------- expose the new zoom internals for patch605's tests ----------------
do(
    "  SECTORS,SEC_LANES,SEC_EXIT,secOf,sysInSec,get mapSec(){return mapSec},setMapSec,",
    "  SECTORS,SEC_LANES,SEC_EXIT,secOf,sysInSec,get mapSec(){return mapSec},setMapSec,\n"
    "  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,",
    label="__SD export additions",
)

h = h.replace("const BUILD=603;", "const BUILD=604;", 1)
assert "const BUILD=604;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch604 applied OK")
