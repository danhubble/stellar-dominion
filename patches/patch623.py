#!/usr/bin/env python3
"""
patch623 (BUILD 624) - Patch E / owner's real-phone note: "the pull down tab is
quite clunky and doesn't always work, sometimes I'm pressing it to go down but
nothing happens." Four separate causes, all fixed here:

1. Tap direction was backwards. The old release() toggled full<->peek on a tap
   (either direction). A short accidental drag mixed into a "tap" reads as a
   real drag in whichever direction the thumb happened to twitch - so a tap
   meant to go DOWN could silently flip UP instead, which is exactly "pressing
   it and nothing happens" (from the owner's POV, since the sheet visibly moved
   the *other* way, not the way they pressed). Tap now always steps DOWN
   (full->peek->closed), the same direction a real drag-down already takes it -
   they are now the literal same branch, so there is no direction for a stray
   drag to flip.

2. Getting back UP therefore needs its own path, now that tap no longer does
   it: tapping the sheet's own title row (#sysInfo - see below for why that
   element specifically) while at PEEK returns it to FULL.

3. STEP_DOWN/STEP_UP drop from 70/50 to 40/30 - the owner's report was "doesn't
   always work", i.e. drags that felt like enough motion were falling short of
   the old thresholds. TAP_SLOP(8) stays well under both new thresholds, so a
   drag ending between TAP_SLOP and STEP_DOWN (or -TAP_SLOP and -STEP_UP) still
   falls through every branch and the existing `sheet.style.transform=""` reset
   at the top of release() snaps it back cleanly - unchanged, still there.

4. The handle grows from a centered ~78x28 hit box to the sheet's full content
   width at 36px tall, with a downward chevron added below the 4px bar (both
   drawn with ::before/::after - the element itself is still the one static,
   always-empty <div id="sshGrab">, nothing for tchurn2.js to ever see churn).
   touch-action:none is kept (still the thing that stops the sheet's own
   overflow-y:auto scroll from stealing a drag that starts on the handle).
   .sshx (position:absolute, top:10/right:12) now visually overlaps the top-
   right corner of this wider band; it stays on top and stays clickable there
   (later in DOM order, no competing z-index, so it wins that corner by
   ordinary stacking) - verified with a Playwright pointer test below that
   dragging elsewhere in the band still grabs the sheet and tapping .sshx still
   closes it.

Also added: a small clamped rubber-band transform on upward drags. The old
pointermove did `Math.max(0,dy)`, which threw away every negative dy - dragging
up gave zero visual feedback at all, even though the drag was being tracked and
would step the sheet to FULL past STEP_UP on release. Downward drag still
tracks 1:1 (unchanged - that's the real "closing" motion, direct feedback is
correct there). Upward drag now moves at dy/3, capped at -14px, so it reads as
"the sheet is resisting" rather than "nothing is happening", without implying
the sheet can open further than FULL (it never could).

#sysInfo is the deliberate, narrow target for the "tap title row to go back up"
listener: renderSysSheet() only ever puts the name/meta/description rows in it
(<h4>, .sysmeta, .sysd, the plain .sysrow list) - every actual button (CLAIM,
ENGAGE, DEV..., etc.) renders into the sibling #sysAct, never into #sysInfo
itself (confirmed by reading renderSysSheet() before writing this, not
assumed). #sysBuild, #sshScan and .sshx are none of them descendants of
#sysInfo either. So a click handler on #sysInfo can never swallow a tap meant
for any of those - it is scoped by construction, not by a target-checking guard
that could later drift out of sync with the render function.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=623;", "const BUILD=624;", label="BUILD bump")

# ==================================================================== CSS: enlarge the handle, add a chevron
do(
    "/* patch620: hit area enlarged to ~78x28 via padding (was the bare 38x4 visible\n"
    "   bar itself) - background-clip:content-box keeps the painted bar exactly the\n"
    "   same 38x4 it always was, the padding around it is invisible but still part of\n"
    "   the element's own box, so it still catches the pointer. Centred, well clear of\n"
    "   .sshx's own top:10/right:12 26x26 box - no hit-area overlap. */\n"
    ".sshgrab{width:38px;height:4px;padding:12px 20px;box-sizing:content-box;\n"
    "  background:rgba(255,255,255,.22);background-clip:content-box;\n"
    "  border-radius:2px;margin:2px auto 2px;cursor:grab;touch-action:none}\n",
    "/* patch623: grown from a centered ~78x28 hit box to the sheet's full content\n"
    "   width, 36px tall - see the patch header for why, and for the deliberate,\n"
    "   verified overlap with .sshx's own top-right corner (it still wins that corner,\n"
    "   the handle still works everywhere else in the band). The 4px bar + a downward\n"
    "   chevron are drawn with ::before/::after so the <div> itself stays the one\n"
    "   static, always-empty element it always was - nothing new for tchurn2.js to\n"
    "   ever see churn. touch-action:none is unchanged. */\n"
    ".sshgrab{width:100%;height:36px;margin:0;padding:0;box-sizing:border-box;\n"
    "  display:flex;flex-direction:column;align-items:center;justify-content:center;\n"
    "  gap:6px;cursor:grab;touch-action:none;position:relative}\n"
    ".sshgrab::before{content:\"\";width:38px;height:4px;border-radius:2px;\n"
    "  background:rgba(255,255,255,.22)}\n"
    ".sshgrab::after{content:\"\";width:7px;height:7px;\n"
    "  border-right:2px solid rgba(255,255,255,.4);border-bottom:2px solid rgba(255,255,255,.4);\n"
    "  transform:rotate(45deg);pointer-events:none}\n",
    label="sshgrab CSS enlarge + chevron",
)

# ==================================================================== JS: thresholds + comment
do(
    "/* patch620: FULL/PEEK/CLOSED three-state grab handle, replacing the old\n"
    '   "drag down 70px, closes, nothing else" gesture. dy is signed (negative =\n'
    "   dragged UP) so release can tell the two directions apart; the live visual\n"
    "   transform mid-drag only ever follows the downward half of that (there is\n"
    '   nothing further "open" than FULL to visually reveal by dragging up) - same\n'
    "   on-screen feel as before while actually dragging down. TAP_SLOP is the same\n"
    '   "didn\'t really move" idea the sector-swipe/outside-tap guards elsewhere in this\n'
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
    "/* patch620/623: FULL/PEEK/CLOSED three-state grab handle. dy is signed\n"
    "   (negative = dragged UP) so release can tell the two directions apart.\n"
    "   patch623: a tap and an above-threshold drag-down now do the exact same\n"
    "   thing - step down one level - so they share one branch (see\n"
    "   the patch header, cause 1: tap used to step UP, which is what made \"pressing\n"
    "   it to go down\" unreliable). Going back UP only happens two ways now: a real\n"
    "   drag past STEP_UP, or tapping the title row while at PEEK (separate IIFE,\n"
    "   right below this one) - neither of which a mis-aimed downward tap can trigger\n"
    "   by accident. TAP_SLOP/STEP_DOWN/STEP_UP are the same \"didn't really move\" /\n"
    "   step-distance idea the sector-swipe/outside-tap guards elsewhere in this file\n"
    "   already use; STEP_DOWN/STEP_UP are smaller than patch620's own 70/50 - the\n"
    "   owner's report was \"doesn't always work\", i.e. real drags were falling short\n"
    "   of the old thresholds. */\n"
    "(function(){\n"
    '  const sheet=document.querySelector("#sysSheet"), grab=document.querySelector("#sshGrab");\n'
    "  if(!sheet||!grab)return;\n"
    "  const TAP_SLOP=8, STEP_DOWN=40, STEP_UP=30;\n"
    "  let y0=null, dy=0, dragging=false;\n"
    '  grab.addEventListener("pointerdown",e=>{\n'
    '    if(!sheet.classList.contains("open"))return;\n'
    '    y0=e.clientY; dy=0; dragging=true; sheet.classList.add("dragging");\n'
    "    try{ grab.setPointerCapture(e.pointerId); }catch(_){}\n"
    "  });\n"
    '  grab.addEventListener("pointermove",e=>{\n'
    "    if(!dragging||y0==null)return;\n"
    "    dy=e.clientY-y0;\n"
    "    /* patch623: downward drag still tracks 1:1 (unchanged - direct feedback is\n"
    "       right for the actual closing motion); upward drag used to clamp straight to\n"
    "       0 (Math.max(0,dy)), i.e. zero visual feedback while dragging up even though\n"
    "       it was being tracked and would step to FULL past STEP_UP on release. Now a\n"
    "       small clamped rubber-band instead, capped at -14px, so it reads as\n"
    "       resistance rather than nothing happening. */\n"
    "    const t = dy>=0 ? dy : Math.max(dy/3,-14);\n"
    '    sheet.style.transform="translateY("+t+"px)";\n'
    "  });\n"
    "  const release=()=>{\n"
    "    if(!dragging)return;\n"
    '    dragging=false; sheet.classList.remove("dragging"); sheet.style.transform="";\n'
    "    if(Math.abs(dy)<TAP_SLOP || dy>STEP_DOWN){\n"
    '      if(sheetState==="full")setSheetState("peek");\n'
    "      else { S.msel=null; setMapZoom(null); dirty=true; render(); }\n"
    "    } else if(dy<-STEP_UP){\n"
    '      setSheetState("full");\n'
    "    }\n"
    "    y0=null; dy=0;\n"
    "  };\n"
    '  grab.addEventListener("pointerup",release);\n'
    '  grab.addEventListener("pointercancel",release);\n'
    "})();\n"
    "/* patch623: the other half of \"getting back up\" - see the patch header for why\n"
    "   #sysInfo specifically is the scoped target. */\n"
    "(function(){\n"
    '  const info=document.querySelector("#sysInfo");\n'
    "  if(!info)return;\n"
    '  info.addEventListener("click",()=>{\n'
    '    if(sheetState==="peek")setSheetState("full");\n'
    "  });\n"
    "})();\n",
    label="grab handle rewrite + title-row-tap listener",
)

assert h.count("const BUILD=624;") == 1
assert "STEP_DOWN=70" not in h
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch623 applied OK")
