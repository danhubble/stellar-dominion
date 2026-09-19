#!/usr/bin/env python3
"""
patch620 (BUILD 621) - Patch B / PLAN-open.md Run 2 item 1: the sheet's rest
heights.

Owner's complaint: the grab handle looks draggable and is, but the only gesture
is "drag down 70px, closes" - drag up does nothing, there is no half-height
rest, and the hit area is 38x4px.

Rewrites the #sshGrab IIFE (patch595) as a three-state machine - FULL (today's
max-height:58vh, unchanged), PEEK (a new #sysSheet.peek class, max-height:26vh -
title row + first build row, zoomed planet visible above), CLOSED (today's
existing off-screen close via S.msel=null, untouched, still the same
translateY(110%) rule and the same .dragging transition override).

- sheetState is a new session-only variable (never saved, same idiom as
  sheetScroll/sheetScrollSys just above it) - resets to "full" every time the
  sheet transitions from closed to open (a node tap, a LIST row tap, a notice's
  "TAKE ME THERE", anything that sets S.msel from null - all funnel through the
  same renderMap() open-branch already, so one reset site covers every one of
  them).
- Drag down: FULL -> PEEK on the first 70px past-threshold release; PEEK -> a
  real close (same S.msel=null path as before) on the next one. Drag up: PEEK ->
  FULL past a 50px release. A release with under 8px of total movement (TAP_SLOP,
  same "didn't really move" idea the sector-swipe/outside-tap guards elsewhere in
  this file already use) toggles FULL/PEEK directly - the plan's "a tap toggles
  FULL/PEEK".
- setSheetState()/syncSheetState() are the only things that touch the "peek"
  class or call mapZoomMeasure() for this - called from the grab handler AND
  from the open-reset site, so the zoomed planet recomposes into the visible
  band the moment the state actually changes, not just on the next unrelated
  render pass.
- The hit area: #sshGrab's rendered box grows to 78x28 (padding, not a redraw of
  the visible bar) via background-clip:content-box, so the 4x38 bar painted
  inside it looks identical to today while the invisible padding around it is
  what actually catches the pointer. Centred (margin:auto), nowhere near
  .sshx's own top:10/right:12 26x26 box - no overlap.
- #sysThreatActs (DEFEND IT / LET THEM HOLD) reachability in PEEK: checked with
  Playwright before writing this docstring, including the worst case (sheet
  already PEEKed, then a threat appears on the same still-selected system) -
  both buttons stayed fully on-screen at both 390x667 and 390x844 in every case
  (position:sticky;bottom:0 keeps them pinned to the sheet's own scrollport
  regardless of its overall height). No FULL-forcing was needed, so none was
  added - see HANDOVER for the exact numbers.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=620;", "const BUILD=621;", label="BUILD bump")

# ==================================================================== CSS: #sysSheet.peek
do(
    "#sysSheet.open{transform:translateY(0);pointer-events:auto}\n"
    "#sysSheet.dragging{transition:none}\n",
    "#sysSheet.open{transform:translateY(0);pointer-events:auto}\n"
    "#sysSheet.dragging{transition:none}\n"
    "/* patch620: the PEEK rest height - title row + first build row, planet visible\n"
    "   above. A class, not a second element - the closed-state transform and the\n"
    "   .dragging override above are untouched, still apply exactly as before. */\n"
    "#sysSheet.peek{max-height:26vh}\n",
    label="sysSheet.peek CSS",
)

# ==================================================================== CSS: grab hit area
do(
    ".sshgrab{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.22);\n"
    "  margin:2px auto 6px;cursor:grab;touch-action:none}\n",
    "/* patch620: hit area enlarged to ~78x28 via padding (was the bare 38x4 visible\n"
    "   bar itself) - background-clip:content-box keeps the painted bar exactly the\n"
    "   same 38x4 it always was, the padding around it is invisible but still part of\n"
    "   the element's own box, so it still catches the pointer. Centred, well clear of\n"
    "   .sshx's own top:10/right:12 26x26 box - no hit-area overlap. */\n"
    ".sshgrab{width:38px;height:4px;padding:12px 20px;box-sizing:content-box;\n"
    "  background:rgba(255,255,255,.22);background-clip:content-box;\n"
    "  border-radius:2px;margin:2px auto 2px;cursor:grab;touch-action:none}\n",
    label="sshgrab hit area CSS",
)

# ==================================================================== JS: sheetState
do(
    "let sheetScroll={}, sheetScrollSys=null;\n",
    "let sheetScroll={}, sheetScrollSys=null;\n"
    "/* patch620: the sheet's rest height - \"full\"|\"peek\". Session-only, never saved,\n"
    "   same reasoning as sheetScroll/sheetScrollSys just above - resets to \"full\"\n"
    "   wherever the sheet is (re)opened, see the reset at the sheet.classList.add(\n"
    "   \"open\") site in renderMap(). CLOSED is not a third value here - it is the\n"
    "   sheet's existing S.msel=null/.open-removed path, untouched by this. */\n"
    "let sheetState=\"full\";\n"
    "/* patch620: #sysThreatActs (DEFEND IT / LET THEM HOLD) is position:sticky;bottom:0\n"
    "   inside the sheet, so it stays pinned to the bottom of the sheet's own scrollport\n"
    "   regardless of the sheet's overall height - checked empirically with Playwright\n"
    "   before this shipped, including the worst case (already PEEKed, then a threat\n"
    "   appears on the same system): both buttons stayed fully on-screen at 390x667 and\n"
    "   390x844 in every case (see HANDOVER for the exact numbers). No FULL-forcing\n"
    "   needed, so none was added - PEEK behaves identically whether or not a threat is\n"
    "   showing, exactly as the plan describes it. */\n"
    "function setSheetState(next){\n"
    "  if(sheetState===next)return;\n"
    "  sheetState=next;\n"
    "  syncSheetState();\n"
    "}\n"
    "function syncSheetState(){\n"
    "  const sheet=$(\"#sysSheet\"); if(sheet)sheet.classList.toggle(\"peek\",sheetState===\"peek\");\n"
    "  /* recompose the zoomed planet into the newly-visible band immediately, not on\n"
    "     whatever the next unrelated render() pass happens to be. */\n"
    "  if(mapZoom)mapZoomMeasure();\n"
    "}\n",
    label="sheetState/setSheetState/syncSheetState",
)

# ==================================================================== JS: reset to FULL
# whenever the sheet transitions from closed to open (renderMap()'s own single open
# site - every path that sets S.msel from null funnels through this same render pass).
do(
    "  if(sheet)sheet.classList.add(\"open\");\n"
    "  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;\n",
    "  if(sheet && !sheet.classList.contains(\"open\")){\n"
    "    /* patch620: opening the sheet always resets to FULL - the state does not\n"
    "       follow from whatever height a previously-viewed system was left at. */\n"
    "    sheetState=\"full\"; syncSheetState();\n"
    "  }\n"
    "  if(sheet)sheet.classList.add(\"open\");\n"
    "  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;\n",
    label="reset sheetState to full on open",
)

# ==================================================================== JS: #sshGrab IIFE rewrite
do(
    "(function(){\n"
    '  const sheet=document.querySelector("#sysSheet"), grab=document.querySelector("#sshGrab");\n'
    "  if(!sheet||!grab)return;\n"
    "  let y0=null, dy=0, dragging=false;\n"
    '  grab.addEventListener("pointerdown",e=>{\n'
    '    if(!sheet.classList.contains("open"))return;\n'
    '    y0=e.clientY; dy=0; dragging=true; sheet.classList.add("dragging");\n'
    "    try{ grab.setPointerCapture(e.pointerId); }catch(_){}\n"
    "  });\n"
    '  grab.addEventListener("pointermove",e=>{\n'
    "    if(!dragging||y0==null)return;\n"
    '    dy=Math.max(0,e.clientY-y0); sheet.style.transform="translateY("+dy+"px)";\n'
    "  });\n"
    "  const release=()=>{\n"
    "    if(!dragging)return;\n"
    '    dragging=false; sheet.classList.remove("dragging"); sheet.style.transform="";\n'
    "    if(dy>70){ S.msel=null; setMapZoom(null); dirty=true; render(); }\n"
    "    y0=null; dy=0;\n"
    "  };\n"
    '  grab.addEventListener("pointerup",release);\n'
    '  grab.addEventListener("pointercancel",release);\n'
    "})();\n",
    "/* patch620: FULL/PEEK/CLOSED three-state grab handle, replacing the old\n"
    "   \"drag down 70px, closes, nothing else\" gesture. dy is signed (negative =\n"
    "   dragged UP) so release can tell the two directions apart; the live visual\n"
    "   transform mid-drag only ever follows the downward half of that (there is\n"
    "   nothing further \"open\" than FULL to visually reveal by dragging up) - same\n"
    "   on-screen feel as before while actually dragging down. TAP_SLOP is the same\n"
    "   \"didn't really move\" idea the sector-swipe/outside-tap guards elsewhere in this\n"
    "   file already use. */\n"
    "(function(){\n"
    '  const sheet=document.querySelector("#sysSheet"), grab=document.querySelector("#sshGrab");\n'
    "  if(!sheet||!grab)return;\n"
    "  const TAP_SLOP=8, STEP_DOWN=70, STEP_UP=50;\n"
    "  let y0=null, dy=0, dragging=false;\n"
    '  grab.addEventListener("pointerdown",e=>{\n'
    '    if(!sheet.classList.contains("open"))return;\n'
    '    y0=e.clientY; dy=0; dragging=true; sheet.classList.add("dragging");\n'
    "    try{ grab.setPointerCapture(e.pointerId); }catch(_){}\n"
    "  });\n"
    '  grab.addEventListener("pointermove",e=>{\n'
    "    if(!dragging||y0==null)return;\n"
    "    dy=e.clientY-y0;\n"
    '    sheet.style.transform="translateY("+Math.max(0,dy)+"px)";\n'
    "  });\n"
    "  const release=()=>{\n"
    "    if(!dragging)return;\n"
    '    dragging=false; sheet.classList.remove("dragging"); sheet.style.transform="";\n'
    "    if(Math.abs(dy)<TAP_SLOP){\n"
    '      setSheetState(sheetState==="full"?"peek":"full");\n'
    "    } else if(dy>STEP_DOWN){\n"
    '      if(sheetState==="full")setSheetState("peek");\n'
    "      else { S.msel=null; setMapZoom(null); dirty=true; render(); }\n"
    "    } else if(dy<-STEP_UP){\n"
    '      setSheetState("full");\n'
    "    }\n"
    "    y0=null; dy=0;\n"
    "  };\n"
    '  grab.addEventListener("pointerup",release);\n'
    '  grab.addEventListener("pointercancel",release);\n'
    "})();\n",
    label="sshGrab three-state IIFE",
)

# ==================================================================== window.__SD export
do(
    "  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,mapZoomMeasure,get mzVisFrac(){return mzVisFrac},\n",
    "  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,mapZoomMeasure,get mzVisFrac(){return mzVisFrac},\n"
    "  get sheetState(){return sheetState},setSheetState,\n",
    label="window.__SD export: sheetState/setSheetState",
)

assert h.count("const BUILD=621;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch620 applied OK")
