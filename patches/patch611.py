#!/usr/bin/env python3
"""
patch611 (BUILD 611) - PLAN-unify.md Run 2, item 2: sheet scroll memory.

Two separate mechanisms, per the plan's own "Watch for" note - conflating them was the
trap:

1. sheetScroll[sysId] - a plain runtime object (never saved, same idiom as the existing
   paneScroll{} the tab-switch handler already keeps), updated on every #sysSheet
   "scroll" event (throttled via a 150ms setTimeout debounce - not a rAF loop, since a
   scroll listener already only fires on real scroll activity). Restored on open,
   tracked with a defSelSys-style "did the system actually change" guard
   (sheetScrollSys) so restoreSheetScroll() runs once per system-open, never on every
   render() tick while the user is mid-scroll (that would fight their own scrolling -
   the exact bug this guard exists to avoid). A system opened for the first time this
   session (not yet in sheetScroll) lands on its newest owned tier, not tier 1 - the
   last ".g:not(.next)" row #sysBuildRows actually has, read via offsetTop right after
   renderSysBuild()'s own synchronous rebuild (no rAF needed: reading offsetTop forces
   the layout renderSysBuild() just changed, same as empAccordionTap()'s own
   getBoundingClientRect() read one screen up does). Closing the sheet touches nothing
   in sheetScroll, so the memory survives close/reopen for free - not fixing what isn't
   broken.

2. The OTHER kind of scroll disruption: ladderBuy()'s own dirty=true;render() rebuilds
   #sysBuildRows (a real DOM replace, not a scroll), and a rebuilt container CAN clamp
   the ancestor's scrollTop if the new content is shorter (e.g. buying the marquee tier
   removes the "next" row). This has nothing to do with which system is open, so it is
   NOT sheetScroll's job - renderSysBuild() captures #sysSheet.scrollTop immediately
   before clearing #sysBuildRows and reasserts it immediately after, every rebuild,
   regardless of cause.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=610;", "const BUILD=611;", label="BUILD bump")

# --- runtime state: sheetScroll{} + the "did the system change" guard ---
do(
    "let defSel=null, defSelSys=null;\n",
    "let defSel=null, defSelSys=null;\n"
    "/* patch611: per-system sheet scroll memory - a plain object, never saved, same\n"
    "   idiom as the tab-switch handler's own paneScroll{} below. sheetScrollSys is the\n"
    "   defClearSel()-style \"did the sheet just point at a different system\" guard -\n"
    "   restoreSheetScroll() must run exactly once per system-open, never on every\n"
    "   render() tick, or it would fight the player's own mid-scroll. */\n"
    "let sheetScroll={}, sheetScrollSys=null;\n",
    label="sheetScroll state",
)

# --- renderSysBuild(): capture/restore #sysSheet.scrollTop across its own rebuild ---
do(
    "  if(rowsHost.dataset.h!==key){\n"
    "    rowsHost.dataset.h=key;\n"
    "    empSlotEls=[];\n"
    "    rowsHost.innerHTML=\"\";\n"
    "    let shownNext=false;\n"
    "    for(const gi of ladder){\n"
    "      if(sysTierCount(s.id,gi)>0){ rowsHost.appendChild(ladderTierRow(s.id,gi,false)); }\n"
    "      else if(!shownNext){ rowsHost.appendChild(ladderTierRow(s.id,gi,true)); shownNext=true; }\n"
    "      else break;\n"
    "    }\n"
    "  }\n"
    "}\n",
    "  if(rowsHost.dataset.h!==key){\n"
    "    /* patch611: a buy (or any other reason this key changed) rebuilds the rows -\n"
    "       #sysSheet is the scrolling ancestor (see its own CSS comment) and a shorter\n"
    "       rebuilt content can clamp its scrollTop on its own; reassert the exact value\n"
    "       right after, every time, regardless of cause. Independent of sheetScroll[]\n"
    "       below - this is \"don't let a rebuild move it\", not \"remember it for later\". */\n"
    "    const sheetEl=$(\"#sysSheet\"), prevTop=sheetEl?sheetEl.scrollTop:0;\n"
    "    rowsHost.dataset.h=key;\n"
    "    empSlotEls=[];\n"
    "    rowsHost.innerHTML=\"\";\n"
    "    let shownNext=false;\n"
    "    for(const gi of ladder){\n"
    "      if(sysTierCount(s.id,gi)>0){ rowsHost.appendChild(ladderTierRow(s.id,gi,false)); }\n"
    "      else if(!shownNext){ rowsHost.appendChild(ladderTierRow(s.id,gi,true)); shownNext=true; }\n"
    "      else break;\n"
    "    }\n"
    "    if(sheetEl)sheetEl.scrollTop=prevTop;\n"
    "  }\n"
    "}\n"
    "/* patch611: restore (or, first-ever open, establish) this system's sheet scroll.\n"
    "   Called once per system-open (see the sheetScrollSys guard at the call site in\n"
    "   renderMap()), after renderSysBuild() above has already rebuilt #sysBuildRows for\n"
    "   the newly-opened system, so offsetTop reads are already correct. */\n"
    "function restoreSheetScroll(sysId,held){\n"
    "  const sheet=$(\"#sysSheet\"); if(!sheet)return;\n"
    "  const jump=(top)=>{ try{ sheet.scrollTo({top,behavior:\"instant\"}) }catch(_){ sheet.scrollTop=top } };\n"
    "  if(Object.prototype.hasOwnProperty.call(sheetScroll,sysId)){ jump(sheetScroll[sysId]); return; }\n"
    "  let top=0;\n"
    "  if(held){\n"
    "    const rowsList=$$(\"#sysBuildRows .g:not(.next)\");\n"
    "    const newest=rowsList[rowsList.length-1];\n"
    "    if(newest)top=newest.offsetTop;\n"
    "  }\n"
    "  jump(top);\n"
    "  sheetScroll[sysId]=top;\n"
    "}\n",
    label="renderSysBuild scroll-preserve + restoreSheetScroll()",
)

# --- call site: restore on a real system change, and drop the guard when the sheet closes ---
do(
    "  if(sheet)sheet.classList.add(\"open\");\n"
    "  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;\n"
    "  renderSysBuild(s,held);\n"
    "  let rows=\"\";\n",
    "  if(sheet)sheet.classList.add(\"open\");\n"
    "  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;\n"
    "  renderSysBuild(s,held);\n"
    "  if(sheetScrollSys!==s.id){ sheetScrollSys=s.id; restoreSheetScroll(s.id,held); }\n"
    "  let rows=\"\";\n",
    label="restoreSheetScroll call site",
)
do(
    "    const oddsBox=$(\"#sysOdds\"); if(oddsBox&&oddsBox.dataset.h!==\"\"){ oddsBox.dataset.h=\"\"; oddsBox.innerHTML=\"\"; oddsBox.hidden=true }\n",
    "    /* patch611: NOT sheetScroll itself (\"closing the sheet keeps the memory\" - the\n"
    "       plan's own words) - only the open-system guard, so reopening (even the same\n"
    "       system) runs restoreSheetScroll() again instead of treating it as still open. */\n"
    "    sheetScrollSys=null;\n"
    "    const oddsBox=$(\"#sysOdds\"); if(oddsBox&&oddsBox.dataset.h!==\"\"){ oddsBox.dataset.h=\"\"; oddsBox.innerHTML=\"\"; oddsBox.hidden=true }\n",
    label="sheetScrollSys reset on close",
)

# --- listener: keep sheetScroll[] current while the player scrolls by hand ---
do(
    "function syncChips(){\n",
    "/* patch611: throttled, not per-frame - a real \"scroll\" event only fires while\n"
    "   the player is actually scrolling, so a plain debounce (not a rAF loop) is\n"
    "   enough; 150ms is short enough that a quick close-and-reopen right after a\n"
    "   scroll still remembers the right spot. */\n"
    "let sheetScrollTO=null;\n"
    "{ const sheetEl=$(\"#sysSheet\");\n"
    "  if(sheetEl)sheetEl.addEventListener(\"scroll\",()=>{\n"
    "    if(sheetScrollTO)return;\n"
    "    sheetScrollTO=setTimeout(()=>{\n"
    "      sheetScrollTO=null;\n"
    "      if(S.msel)sheetScroll[S.msel]=sheetEl.scrollTop;\n"
    "    },150);\n"
    "  },{passive:true});\n"
    "}\n"
    "function syncChips(){\n",
    label="sheetScroll listener",
)

assert h.count("const BUILD=611;") == 1

open(PATH, "w", encoding="utf-8").write(h)
print("patch611 applied OK")
