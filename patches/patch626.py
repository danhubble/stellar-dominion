#!/usr/bin/env python3
"""
patch626 (BUILD 627) - PLAN-page.md, Run 1 patch 1 of 3: "page layout".

The bottom sheet (patch595, extended through patch626/b626) becomes in-flow page
content under the map header instead of an overlay fighting the map for vertical
space. This patch does the STRUCTURAL half only - #sysSheet stops being a
position:fixed slide-up panel and starts being ordinary page content; the grab
handle, the close X, and the three-state (FULL/PEEK) machinery that managed the
overlay's own height are deleted outright, not disabled. The "one fact" derivation
(body class, zoom-follows-selection, claimSystem() opening the page) is patch627 -
this patch does not touch S.msel/mapZoom's own semantics beyond what is needed to
keep `‹ MAP` working as a real close affordance (see below).

Deleted outright (markup + CSS + JS, __SD export trimmed to match):
  - .sshgrab / #sshGrab (the drag handle) and its patch620/623 pointer IIFE
  - .sshx / #sshClose (the close X) and its onclick handler
  - sheetState / setSheetState() / syncSheetState() / #sysSheet.peek / .dragging
    (the FULL/PEEK three-state machine, patch620/623) and the #sysInfo-tap-at-PEEK
    "other half" IIFE that also referenced it
  - mapZoomMeasure() / mzVisFrac and all three call sites - the zoomed planet now
    always gets the full 34vh header, there is no partial-visible-band to measure
  - sheetScroll / sheetScrollSys / restoreSheetScroll() (patch611's per-system
    sheet-scroll memory) and the scroll listener that populated it - #sysSheet is
    no longer a scroll container, #view is (see its own CSS comment); #view's
    existing paneScroll{} already remembers a position per pane
  - #sysThreat{padding-top:28px} - existed only to clear the now-deleted X

Restyled, not deleted:
  - #sysSheet: no position/transform/max-height/border/shadow of its own any more -
    plain in-flow content, full-bleed to the pane edges via the same safe-area-aware
    negative-margin calc #view's own padding uses (not the mock's flat -12px), so the
    edges line up under a notch. display:none by default, .open shows it - the SAME
    .open class, toggled at the SAME two renderMap() call sites as before patch626;
    only its CSS meaning changed.
  - #sshScanBar / #sysThreatActs: position:sticky (relative to the now-nonscrolling
    sheet) -> position:fixed;bottom:0 (relative to the viewport, matching #app's own
    max-width:1360px;margin:0 auto column, the same scheme the retired #sysSheet
    itself used to use). Mutual exclusion (renderMap()'s own .hidden toggles) is
    unchanged. #view gains matching bottom padding while a page is open, sized
    empirically against the taller of the two bars.
  - #mapWrap: a new body.syspage override - fixed 34vh, no aspect-ratio, squared
    bottom corners - explicit against patch619's own #mapWrap.homeonly rule (see the
    CSS comment; the coordinator asked this not depend on selector-count arithmetic).

body.syspage is patch627's final class name, pre-used here (permitted explicitly -
see HANDOVER): set/cleared at the exact same two renderMap() sites #sysSheet's own
.open class already is. It is not yet tab-aware (that needs the active-tab check
627 adds) - see HANDOVER for the one known consequence of that gap.

Deliberate small addition beyond the plan's literal 626/627 split: `‹ MAP`'s
else-branch gains `S.msel=null;` in THIS patch, not 627's. Reason: leaving it
untouched would mean `‹ MAP` only un-zoomed the planet and never closed the
page at all (renderMap()'s closed branch, which removes #sysSheet's own .open
class and now also body.syspage, is only reached when S.msel itself goes null) -
failing this patch's own "the game must be playable: ... `‹ MAP` closes it"
bar. The call still explicitly invokes setMapZoom(null) rather than relying on any
derivation - that half is unchanged and stays 627's job.

Known gap, left honestly rather than half-fixed (both explicitly permitted by the
plan for this patch): an UNCLAIMED system's page has no visible `‹ MAP` bar in
this patch (#mapZoomBar only shows while #mapWrap.zoomed, i.e. held/occupied
systems - keying it off body.syspage instead is 627's own listed change) and no ✕
(deleted here) - the only working close path for one is the existing map-background
tap, untouched by this patch. #view is also not yet reset to scroll-top on page
entry (627's own listed change) - browsing the map scrolled down, then tapping a
node, currently carries that scroll position straight into the new page.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=626;", "const BUILD=627;", label="BUILD bump")

# ==================================================================== CSS: #sysSheet itself - from a
# position:fixed slide-up overlay to plain in-flow, full-bleed page content.
do(
    """/* ---------- system sheet (patch595): bottom sheet over the map, replaces the
   old in-flow panel - #sysInfo/#sysAct keep their ids and guarded-render idiom,
   just live inside a sliding sheet now. Sits above the map (no z-index of its
   own needed there) but below any modal/scene overlay (.mask 20, .scene 52). */
#sysSheet{position:fixed;left:0;right:0;bottom:0;z-index:15;max-width:1360px;margin:0 auto;
  border-radius:16px 16px 0 0;border:1px solid var(--line2);border-bottom:none;
  background:linear-gradient(180deg,#101637,#0a0e24);box-shadow:0 -14px 34px -6px rgba(0,0,0,.6);
  /* patch625: bottom padding dropped to 0 - it used to be the live gap scrolled
     content passed through underneath #sshScanBar/#sysThreatActs (both
     position:sticky;bottom:0 - one of the two is always the sheet's true last
     visual row whenever a system is open, so this padding was never serving a
     purpose of its own, only creating the gap). Both bars now carry their own
     safe-area-aware bottom padding instead - see their own rules. */
  padding:6px 14px 0;
  max-height:58vh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
  transform:translateY(110%);transition:transform .26s cubic-bezier(.22,.8,.32,1);pointer-events:none}
#sysSheet.open{transform:translateY(0);pointer-events:auto}
#sysSheet.dragging{transition:none}
/* patch620: the PEEK rest height - title row + first build row, planet visible
   above. A class, not a second element - the closed-state transform and the
   .dragging override above are untouched, still apply exactly as before. */
#sysSheet.peek{max-height:26vh}""",
    """/* ---------- system page (patch595, redesigned patch626 - PLAN-page.md "a system
   is a page, not a sheet"): in-flow content under the map header, not an overlay -
   #sysInfo/#sysAct keep their ids and guarded-render idiom. No position/transform/
   height/border/shadow of its own any more - full-bleed to the pane edges using the
   same safe-area-aware calc #view's own left/right padding uses, so the edges line
   up exactly under a notch (not the approved mock's own flat -12px). display:none
   by default; #sysSheet.open - toggled at the exact same renderMap() call sites as
   before this patch, only its CSS meaning changed - is what shows it. The grab
   handle, the close X, and the FULL/PEEK three-state machinery that used to live
   here (patch620/623) are deleted outright this patch, not disabled - see
   HANDOVER for the full list. */
#sysSheet{display:none;
  margin:0 calc(-12px - env(safe-area-inset-right,0px)) 0 calc(-12px - env(safe-area-inset-left,0px));
  padding:6px 14px 0;
  background:linear-gradient(180deg,#101637,#0a0e24)}
#sysSheet.open{display:block}""",
    label="#sysSheet in-flow rewrite",
)

# ==================================================================== CSS: #sysThreatActs sticky -> fixed
do(
    """/* owner review polish item 1: DEFEND IT / LET THEM HOLD pinned to the bottom of the
   sheet, always visible at 390x844 even with the threat block + defences row both
   showing, everything above scrolling underneath it. #sysSheet is the scrolling
   ancestor (overflow-y:auto) already - position:sticky needs nothing else from it,
   and keeps #sysThreatActs a direct child of #sysSheet exactly as before (every
   existing test's own DOM assumption stays true). The gradient masks scrolled
   content that would otherwise show through the row's own button gaps. */
/* patch625: bottom padding now carries the safe-area inset #sysSheet's own
   padding-bottom used to (that padding is gone - see #sysSheet's own comment).
   Confirmed empirically that a negative bottom MARGIN here does not move this
   sticky box's stuck edge at all in this Chromium build - only the scrolling
   ancestor's own padding does, which is why the fix lives on #sysSheet, not on
   a margin trick on this element - margin stays as it was. */
#sysThreatActs{position:sticky;bottom:0;margin:10px -14px 0;
  padding:12px 14px calc(10px + env(safe-area-inset-bottom,0px));
  background:#0a0e24;border-top:1px solid var(--line);box-shadow:0 -10px 18px -8px rgba(0,0,0,.6);z-index:2}""",
    """/* owner review polish item 1: DEFEND IT / LET THEM HOLD pinned to the bottom of
   the viewport, always visible at 390x844 even with the threat block + defences
   row both showing, everything above scrolling underneath it. The gradient masks
   scrolled content that would otherwise show through the row's own button gaps. */
/* patch626: position:fixed, not sticky - #sysSheet is no longer a scroll
   container (#view is - see its own CSS comment), so a sticky child of it would
   just sit wherever it fell in flow, not pinned at all. max-width/margin:0 auto
   re-imposes #app's own column cap, the same scheme the retired #sysSheet used to
   use for the same reason (a position:fixed box escapes the normal flow that
   would otherwise keep it inside that column). The patch625 bottom-gap fix
   (this bar's own safe-area-aware padding, not a margin trick) is unchanged. */
#sysThreatActs{position:fixed;left:0;right:0;bottom:0;z-index:15;max-width:1360px;margin:0 auto;
  padding:12px 14px calc(10px + env(safe-area-inset-bottom,0px));
  background:#0a0e24;border-top:1px solid var(--line);box-shadow:0 -10px 18px -8px rgba(0,0,0,.6)}""",
    label="#sysThreatActs fixed",
)

# ==================================================================== CSS: grab handle + close X, deleted
do(
    """/* patch623: grown from a centered ~78x28 hit box to the sheet's full content
   width, 36px tall - see the patch header for why, and for the deliberate,
   verified overlap with .sshx's own top-right corner (it still wins that corner,
   the handle still works everywhere else in the band). The 4px bar + a downward
   chevron are drawn with ::before/::after so the <div> itself stays the one
   static, always-empty element it always was - nothing new for tchurn2.js to
   ever see churn. touch-action:none is unchanged. */
.sshgrab{width:100%;height:36px;margin:0;padding:0;box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:6px;cursor:grab;touch-action:none;position:relative}
.sshgrab::before{content:"";width:38px;height:4px;border-radius:2px;
  background:rgba(255,255,255,.22)}
.sshgrab::after{content:"";width:7px;height:7px;
  border-right:2px solid rgba(255,255,255,.4);border-bottom:2px solid rgba(255,255,255,.4);
  transform:rotate(45deg);pointer-events:none}
.sshx{position:absolute;top:10px;right:12px;border:1px solid var(--line);border-radius:8px;
  width:26px;height:26px;background:rgba(255,255,255,.05);color:var(--mut);
  font:700 12px/1 system-ui;cursor:pointer}
.sshx:hover{color:var(--txt);border-color:var(--line2)}""",
    """/* patch626 (PLAN-page.md): the grab handle (.sshgrab/#sshGrab, patch620/623) and
   the close X (.sshx/#sshClose, patch595) are deleted outright here, not hidden -
   a system page has exactly one closing affordance now, `‹ MAP`. Their markup
   and JS wiring are gone along with this CSS - see HANDOVER for the full list. */""",
    label="grab handle + close X CSS deleted",
)

# ==================================================================== CSS: .sshscanbot sticky -> fixed
do(
    """/* patch624: the sheet's own SCAN SECTOR button, replacing patch622's chip on
   the owner's own request (three placements mocked, bottom chosen - see the
   patch header). position:sticky;bottom:0, same bar treatment #sysThreatActs
   already uses right below it in the markup - full-bleed dark bar (the negative
   margin cancels #sysSheet's own 14px side padding), .scanbtn itself inset by
   this bar's own 14px padding. #sshScanBar (this wrapper) is what gets hidden
   when #sysThreatActs is showing, not just the button, so no empty bar/padding
   is left behind - see renderSysSheet() for the toggle. */
/* patch625: same bottom-gap fix as #sysThreatActs, same reason - see that rule's
   own comment and patch625's header. Margin unchanged on purpose (a negative
   bottom margin here was tried and measured to do nothing). */
.sshscanbot{position:sticky;bottom:0;z-index:2;margin:10px -14px 0;
  padding:10px 14px calc(20px + env(safe-area-inset-bottom,0px));
  background:#0a0e24;border-top:1px solid var(--line);
  box-shadow:0 -10px 18px -8px rgba(0,0,0,.6)}
.sshscanbot[hidden]{display:none}""",
    """/* patch624: the sheet's own SCAN SECTOR button, replacing patch622's chip on
   the owner's own request (three placements mocked, bottom chosen - see the
   patch header). #sshScanBar (this wrapper) is what gets hidden when
   #sysThreatActs is showing, not just the button, so no empty bar/padding is
   left behind - see renderMap()'s own threat block for the toggle. */
/* patch625: bottom-gap fix, this bar's own safe-area-aware padding, not a margin
   trick - see #sysThreatActs's own comment, same reasoning. */
/* patch626: position:fixed, not sticky, same reason and same max-width/margin:0
   auto re-imposed column cap as #sysThreatActs just above - see its own comment.
   Both bars share this exact positioning scheme on purpose (mutually exclusive,
   same footprint, never both visible at once). */
.sshscanbot{position:fixed;left:0;right:0;bottom:0;z-index:15;max-width:1360px;margin:0 auto;
  padding:10px 14px calc(20px + env(safe-area-inset-bottom,0px));
  background:#0a0e24;border-top:1px solid var(--line);
  box-shadow:0 -10px 18px -8px rgba(0,0,0,.6)}
.sshscanbot[hidden]{display:none}""",
    label=".sshscanbot fixed",
)

# ==================================================================== CSS: #sysThreat's X-clearing padding, deleted
do(
    """/* patch598: polish fix 1 (carried from Run 1) - the ✕ (.sshx, position:absolute,
   top:10/right:12 on #sysSheet) sat right over the red under-attack block's own
   top-right corner. Padding (not margin - it must not collapse away) pushes the
   block's content below the button's own footprint; harmless when #sysThreat is
   hidden/empty (padding on a display:none element has no visible effect). */
#sysThreat{padding-top:28px}
""",
    "",
    label="#sysThreat padding-top deleted (its X is gone)",
)

# ==================================================================== CSS: #mapWrap - fixed 34vh band while a page is open
do(
    """#mapWrap.homeonly{max-height:25vh}
""",
    """#mapWrap.homeonly{max-height:25vh}
/* patch626 (PLAN-page.md): a system page's header - the map square becomes a
   fixed 34vh band spanning the pane's full width, squared bottom corners meeting
   the page content flowing directly below it (#sysSheet, now in-flow - see its
   own CSS comment). No aspect-ratio: the page decides the height now, not the
   square's own width. width:auto (not the base rule's own width:100%) is
   deliberate - with the negative margin below cancelling #view's own left/right
   padding, width:100% would still compute against the un-cancelled 100% and leave
   the box narrower than its own margin-extended position, a gap at each edge;
   width:auto solves the box to the full viewport width the way it would for any
   ordinary block. body.syspage is patch627's own final class name, pre-used here
   (see HANDOVER) - set/cleared at the same two renderMap() sites #sysSheet's own
   .open class already is. The explicit .homeonly line right below is so this does
   not depend on selector-count arithmetic against patch619's own #mapWrap.homeonly
   rule just above - the coordinator asked for that explicitly, not left to chance
   if either rule changes later. */
body.syspage #mapWrap{height:34vh;max-height:34vh;aspect-ratio:auto;width:auto;
  margin:0 calc(-12px - env(safe-area-inset-right,0px)) 0 calc(-12px - env(safe-area-inset-left,0px));
  border-radius:0;border-left:none;border-right:none}
body.syspage #mapWrap.homeonly{height:34vh;max-height:34vh}
""",
    label="#mapWrap page-open sizing",
)

# ==================================================================== CSS: #view bottom padding while a page is open
do(
    """.pane{display:none} .pane.on{display:block}""",
    """.pane{display:none} .pane.on{display:block}
/* patch626 (PLAN-page.md): reserve room for #sshScanBar/#sysThreatActs, now
   pinned position:fixed to the viewport bottom instead of sticky inside the (now
   in-flow, non-scrolling) sheet - see their own CSS comments. Sized empirically
   against the taller of the two bars, not guessed - see HANDOVER for the numbers.
   body.syspage: see #mapWrap's own comment above for why 626 can already use the
   final class name. */
body.syspage #view{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}""",
    label="#view page-open padding-bottom",
)

# ==================================================================== markup: grab handle + close X, deleted
do(
    """        <div id="sysSheet">
          <div class="sshgrab" id="sshGrab"></div>
          <button type="button" class="sshx" id="sshClose" aria-label="Close">✕</button>
          <div id="sysThreat" hidden></div>""",
    """        <div id="sysSheet">
          <div id="sysThreat" hidden></div>""",
    label="grab handle + close X markup deleted",
)

# ==================================================================== markup: stale "position:sticky" mention in the
# #sshScanBar doc comment
do(
    """what renderSysSheet() hides while #sysThreatActs is showing (both are
               position:sticky;bottom:0 - mutually exclusive, never both visible).""",
    """what renderSysSheet() hides while #sysThreatActs is showing (both are
               position:fixed;bottom:0 - mutually exclusive, never both visible).""",
    label="#sshScanBar comment: sticky -> fixed",
)

# ==================================================================== JS: sheetScroll/sheetScrollSys/sheetState
# declarations + setSheetState()/syncSheetState() - the whole three-state + per-system-scroll apparatus, gone.
do(
    """let defSel=null, defSelSys=null;
/* patch611: per-system sheet scroll memory - a plain object, never saved, same
   idiom as the tab-switch handler's own paneScroll{} below. sheetScrollSys is the
   defClearSel()-style "did the sheet just point at a different system" guard -
   restoreSheetScroll() must run exactly once per system-open, never on every
   render() tick, or it would fight the player's own mid-scroll. */
let sheetScroll={}, sheetScrollSys=null;
/* patch620: the sheet's rest height - "full"|"peek". Session-only, never saved,
   same reasoning as sheetScroll/sheetScrollSys just above - resets to "full"
   wherever the sheet is (re)opened, see the reset at the sheet.classList.add(
   "open") site in renderMap(). CLOSED is not a third value here - it is the
   sheet's existing S.msel=null/.open-removed path, untouched by this. */
let sheetState="full";
/* patch620: #sysThreatActs (DEFEND IT / LET THEM HOLD) is position:sticky;bottom:0
   inside the sheet, so it stays pinned to the bottom of the sheet's own scrollport
   regardless of the sheet's overall height - checked empirically with Playwright
   before this shipped, including the worst case (already PEEKed, then a threat
   appears on the same system): both buttons stayed fully on-screen at 390x667 and
   390x844 in every case (see HANDOVER for the exact numbers). No FULL-forcing
   needed, so none was added - PEEK behaves identically whether or not a threat is
   showing, exactly as the plan describes it. */
function setSheetState(next){
  if(sheetState===next)return;
  sheetState=next;
  syncSheetState();
}
function syncSheetState(){
  const sheet=$("#sysSheet"); if(sheet)sheet.classList.toggle("peek",sheetState==="peek");
  /* recompose the zoomed planet into the newly-visible band immediately, not on
     whatever the next unrelated render() pass happens to be. */
  if(mapZoom)mapZoomMeasure();
}""",
    """let defSel=null, defSelSys=null;
/* patch626 (PLAN-page.md): sheetScroll/sheetScrollSys/restoreSheetScroll()
   (patch611's per-system sheet-scroll memory) and sheetState/setSheetState()/
   syncSheetState() (patch620/623's FULL/PEEK three-state machine) are deleted
   here - #sysSheet is in-flow page content now, not an independently-scrolling,
   independently-heighted overlay, so neither had anything left to manage. #view's
   own existing paneScroll{} (see the tab-click handler) covers what per-pane
   scroll memory the page needs. */""",
    label="sheetScroll/sheetState apparatus deleted",
)

# ==================================================================== JS: renderSysBuild() reasserts scrollTop
# against the scrolling ancestor after a shorter rebuild clamps it - that ancestor is #view now, not #sysSheet.
do(
    """    /* patch611: a buy (or any other reason this key changed) rebuilds the rows -
       #sysSheet is the scrolling ancestor (see its own CSS comment) and a shorter
       rebuilt content can clamp its scrollTop on its own; reassert the exact value
       right after, every time, regardless of cause. Independent of sheetScroll[]
       below - this is "don't let a rebuild move it", not "remember it for later". */
    const sheetEl=$("#sysSheet"), prevTop=sheetEl?sheetEl.scrollTop:0;""",
    """    /* patch611, retargeted patch626: #view is the scrolling ancestor now (the
       page itself is in-flow - see #sysSheet's own CSS comment) and a shorter
       rebuilt content can clamp ITS scrollTop on its own; reassert the exact
       value right after, every time, regardless of cause. */
    const viewEl=$("#view"), prevTop=viewEl?viewEl.scrollTop:0;""",
    label="renderSysBuild scroll-reassert retargeted to #view",
)
do(
    """    if(sheetEl)sheetEl.scrollTop=prevTop;
  }
}
/* patch611: restore (or, first-ever open, establish) this system's sheet scroll.
   Called once per system-open (see the sheetScrollSys guard at the call site in
   renderMap()), after renderSysBuild() above has already rebuilt #sysBuildRows for
   the newly-opened system, so offsetTop reads are already correct. */
function restoreSheetScroll(sysId,held){
  const sheet=$("#sysSheet"); if(!sheet)return;
  const jump=(top)=>{ try{ sheet.scrollTo({top,behavior:"instant"}) }catch(_){ sheet.scrollTop=top } };
  if(Object.prototype.hasOwnProperty.call(sheetScroll,sysId)){ jump(sheetScroll[sysId]); return; }
  let top=0;
  if(held){
    const rowsList=$$("#sysBuildRows .g:not(.next)");
    const newest=rowsList[rowsList.length-1];
    if(newest)top=newest.offsetTop;
  }
  jump(top);
  sheetScroll[sysId]=top;
}""",
    """    if(viewEl)viewEl.scrollTop=prevTop;
  }
}""",
    label="restoreSheetScroll() deleted",
)

# ==================================================================== JS: mapZoomMeasure() + its doc comment, deleted
do(
    """/* Real measured layout for the map-zoom composition above, not a guess - see
   drawSysScene()'s own `compose` comment. Called only from renderMap() (already
   running on every real state change, never inside draw()'s 60Hz loop) and only
   while actually zoomed, so this is at most renderMap()'s own render cadence, not a
   per-frame cost. #sysSheet's closed-state transform (translateY(110%)) naturally
   reports as being off the bottom of #mapWrap once measured, so there is no separate
   "is the sheet open" branch here - one geometry read covers every way the sheet can
   be open, closed, dragged, or (see patch605's own header note - endDefence() losing
   a system) cleared out from under the zoom by something else entirely. */
function mapZoomMeasure(){
  const wrapEl=$("#mapWrap"), sheetEl=$("#sysSheet");
  if(!wrapEl||!sheetEl)return;
  const wrapRect=wrapEl.getBoundingClientRect();
  if(wrapRect.height<8)return;                 /* mid-layout; keep the last good value */
  const localTop=sheetEl.getBoundingClientRect().top-wrapRect.top;
  /* floored, not left to shrink to nothing - an almost-fully-covered square should
     still show a small planet, not one degenerating toward invisible. */
  mzVisFrac=Math.max(0.34, Math.min(1, localTop/wrapRect.height));
}
""",
    """/* patch626 (PLAN-page.md): mapZoomMeasure()/mzVisFrac used to live here - real
   measured layout for how much of #mapWrap a not-yet-closed #sysSheet was
   currently covering, so the zoomed planet could shrink into whatever band was
   still visible above it. Deleted: the map square is a dedicated 34vh page header
   now (see #mapWrap's own CSS comment) that the page content flows below, never
   over, so the planet always gets the whole thing - see drawSysScene()'s own
   comment and draw()'s zoom branch. */
""",
    label="mapZoomMeasure() deleted",
)

# ==================================================================== JS: renderMap() - the sheet-closed early-return
# branch: also clear body.syspage, drop the sheetScrollSys reset and the mapZoomMeasure() call.
do(
    """  if(!s){
    if(sheet)sheet.classList.remove("open");
    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }
    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }
    const buildWrap=$("#sysBuild");
    if(buildWrap&&!buildWrap.hidden){
      buildWrap.hidden=true;
      const rowsHost=$("#sysBuildRows"); if(rowsHost){ rowsHost.dataset.h=""; rowsHost.innerHTML=""; }
    }
    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }
    defClearSel();
    /* patch611: NOT sheetScroll itself ("closing the sheet keeps the memory" - the
       plan's own words) - only the open-system guard, so reopening (even the same
       system) runs restoreSheetScroll() again instead of treating it as still open. */
    sheetScrollSys=null;
    const oddsBox=$("#sysOdds"); if(oddsBox&&oddsBox.dataset.h!==""){ oddsBox.dataset.h=""; oddsBox.innerHTML=""; oddsBox.hidden=true }
    const defWrap=$("#sysDefWrap");
    if(defWrap&&!defWrap.hidden){
      defWrap.hidden=true;
      const head=$("#sysDefHead"), row=$("#sysDefRow"), detail=$("#sysDefDetail");
      if(head){ head.dataset.h=""; head.innerHTML="" }
      if(row){ row.dataset.h=""; row.innerHTML="" }
      if(detail){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    }
    const hanWrap=$("#sysHanWrap");
    if(hanWrap&&!hanWrap.hidden){ hanWrap.hidden=true; hanWrap.dataset.h=""; hanWrap.innerHTML=""; }
    /* this function has two exits - the sheet-closed early return right here, and the
       normal end below - mapZoomMeasure() has to run from BOTH, or "sheet just closed,
       zoom stays open" (the exact case this patch exists for) would keep reading a stale
       band forever, since this return skips the one at the bottom entirely. */
    if(mapZoom)mapZoomMeasure();
    return;
  }
  if(sheet && !sheet.classList.contains("open")){
    /* patch620: opening the sheet always resets to FULL - the state does not
       follow from whatever height a previously-viewed system was left at. */
    sheetState="full"; syncSheetState();
  }
  if(sheet)sheet.classList.add("open");
  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;
  renderSysBuild(s,held);
  if(sheetScrollSys!==s.id){ sheetScrollSys=s.id; restoreSheetScroll(s.id,held); }
  let rows="";""",
    """  if(!s){
    if(sheet)sheet.classList.remove("open");
    document.body.classList.remove("syspage");
    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }
    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }
    const buildWrap=$("#sysBuild");
    if(buildWrap&&!buildWrap.hidden){
      buildWrap.hidden=true;
      const rowsHost=$("#sysBuildRows"); if(rowsHost){ rowsHost.dataset.h=""; rowsHost.innerHTML=""; }
    }
    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }
    defClearSel();
    const oddsBox=$("#sysOdds"); if(oddsBox&&oddsBox.dataset.h!==""){ oddsBox.dataset.h=""; oddsBox.innerHTML=""; oddsBox.hidden=true }
    const defWrap=$("#sysDefWrap");
    if(defWrap&&!defWrap.hidden){
      defWrap.hidden=true;
      const head=$("#sysDefHead"), row=$("#sysDefRow"), detail=$("#sysDefDetail");
      if(head){ head.dataset.h=""; head.innerHTML="" }
      if(row){ row.dataset.h=""; row.innerHTML="" }
      if(detail){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    }
    const hanWrap=$("#sysHanWrap");
    if(hanWrap&&!hanWrap.hidden){ hanWrap.hidden=true; hanWrap.dataset.h=""; hanWrap.innerHTML=""; }
    return;
  }
  if(sheet)sheet.classList.add("open");
  document.body.classList.add("syspage");
  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;
  renderSysBuild(s,held);
  let rows="";""",
    label="renderMap() open/close branches - body.syspage, drop sheetScroll/sheetState/mapZoomMeasure",
)

# ==================================================================== JS: renderMap()'s own final line - the third
# (and last remaining) mapZoomMeasure() call site.
do(
    """      { const sb=$("#sshScanBar"); if(sb)sb.hidden=true; }
    }
  }
  if(mapZoom)mapZoomMeasure();
}
function renderLevel(){""",
    """      { const sb=$("#sshScanBar"); if(sb)sb.hidden=true; }
    }
  }
}
function renderLevel(){""",
    label="renderMap() trailing mapZoomMeasure() call deleted",
)

# ==================================================================== JS: mzVisFrac declaration + its one use in draw()
do(
    "let mapZoom=null, mapZoomT0=0, mzVisFrac=1;",
    "let mapZoom=null, mapZoomT0=0;",
    label="mzVisFrac declaration dropped",
)
do(
    """  /* compose (map-zoom only - the Empire tab call passes nothing, so cy/R below are
     its EXACT original expressions, untouched): {cy,bandH}, the part of the square
     that is actually visible above #sysSheet (which can overlap the bottom of
     #mapWrap once open) instead of the whole H. See mapZoomMeasure() and draw()'s
     zoom branch. */
  const bandH=compose?compose.bandH:H;""",
    """  /* compose (map-zoom only - the Empire tab call passes nothing, so cy/R below are
     its EXACT original expressions, untouched): {cy,bandH}. patch626: the map-zoom
     canvas is now a dedicated 34vh page header that nothing else ever overlaps (the
     old #sysSheet-overlap accounting - see mapZoomMeasure(), deleted this patch -
     no longer applies), so bandH is simply the canvas's own full height and cy its
     vertical centre; compose is still passed, not dropped, because the
     ladder-length R-cap just below still needs it. */
  const bandH=compose?compose.bandH:H;""",
    label="drawSysScene() doc comment updated",
)
do(
    """    } else {
      const bandH=MZH*mzVisFrac;
      drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio,{cy:bandH*0.5,bandH});
    }""",
    """    } else {
      /* patch626: the whole canvas is always the visible band now - see
         drawSysScene()'s own comment. */
      drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio,{cy:MZH*0.5,bandH:MZH});
    }""",
    label="draw() zoom branch: mzVisFrac -> MZH",
)

# ==================================================================== JS: close-gesture comment + the close X handler
# (deleted) + `< MAP` gains S.msel=null (see patch header for why this ships now, not in 627).
do(
    """/* system sheet close gestures (patch595): the X button, a tap on the map
   outside the sheet (a tap ON a node is left to its own onclick, which must
   re-render the sheet for the newly-selected system, not close it), and a
   pointer-drag on the grab handle past a small threshold - snaps back under
   the threshold, exactly like the "tap vs swipe" guard above it. */
$("#sshClose").onclick=()=>{ S.msel=null; setMapZoom(null); dirty=true; render(); };
(function(){""",
    """/* map background tap-to-close (patch595). patch626 (PLAN-page.md): the close X
   and the grab-handle drag that used to be documented alongside this were both
   deleted - `‹ MAP` is the one closing affordance for a zoomed system now,
   see its own onclick below. An unclaimed system's page still has only this
   background tap until patch627 gives it a `‹ MAP` bar of its own too (see
   HANDOVER - a known, deliberate gap for this patch). A tap ON a node is left to
   its own onclick, which must re-render the page for the newly-selected system,
   not close it. */
(function(){""",
    label="close-gesture comment rewritten, close-X handler deleted",
)
do(
    """$("#mapZoomBack").onclick=()=>{
  if(mapSite!=null){ mapSite=null; syncMapZoomBack(); dirty=true; render(); return; }
  setMapZoom(null); dirty=true; render();
};""",
    """$("#mapZoomBack").onclick=()=>{
  if(mapSite!=null){ mapSite=null; syncMapZoomBack(); dirty=true; render(); return; }
  /* patch626: also clears S.msel, not just the zoom - see this patch's own header
     for why this ships now rather than waiting for patch627's derivation. The
     setMapZoom(null) call stays explicit, unchanged - 627's job. */
  S.msel=null; setMapZoom(null); dirty=true; render();
};""",
    label="mapZoomBack also closes the page",
)

# ==================================================================== JS: the grab-handle drag IIFE and the
# #sysInfo-tap-at-PEEK "other half" IIFE, both deleted (patch620/623's three-state machinery).
do(
    """/* patch620/623: FULL/PEEK/CLOSED three-state grab handle. dy is signed
   (negative = dragged UP) so release can tell the two directions apart.
   patch623: a tap and an above-threshold drag-down now do the exact same
   thing - step down one level - so they share one branch (see
   the patch header, cause 1: tap used to step UP, which is what made "pressing
   it to go down" unreliable). Going back UP only happens two ways now: a real
   drag past STEP_UP, or tapping the title row while at PEEK (separate IIFE,
   right below this one) - neither of which a mis-aimed downward tap can trigger
   by accident. TAP_SLOP/STEP_DOWN/STEP_UP are the same "didn't really move" /
   step-distance idea the sector-swipe/outside-tap guards elsewhere in this file
   already use; STEP_DOWN/STEP_UP are smaller than patch620's own 70/50 - the
   owner's report was "doesn't always work", i.e. real drags were falling short
   of the old thresholds. */
(function(){
  const sheet=document.querySelector("#sysSheet"), grab=document.querySelector("#sshGrab");
  if(!sheet||!grab)return;
  const TAP_SLOP=8, STEP_DOWN=40, STEP_UP=30;
  let y0=null, dy=0, dragging=false;
  grab.addEventListener("pointerdown",e=>{
    if(!sheet.classList.contains("open"))return;
    y0=e.clientY; dy=0; dragging=true; sheet.classList.add("dragging");
    try{ grab.setPointerCapture(e.pointerId); }catch(_){}
  });
  grab.addEventListener("pointermove",e=>{
    if(!dragging||y0==null)return;
    dy=e.clientY-y0;
    /* patch623: downward drag still tracks 1:1 (unchanged - direct feedback is
       right for the actual closing motion); upward drag used to clamp straight to
       0 (Math.max(0,dy)), i.e. zero visual feedback while dragging up even though
       it was being tracked and would step to FULL past STEP_UP on release. Now a
       small clamped rubber-band instead, capped at -14px, so it reads as
       resistance rather than nothing happening. */
    const t = dy>=0 ? dy : Math.max(dy/3,-14);
    sheet.style.transform="translateY("+t+"px)";
  });
  const release=()=>{
    if(!dragging)return;
    dragging=false; sheet.classList.remove("dragging"); sheet.style.transform="";
    if(Math.abs(dy)<TAP_SLOP || dy>STEP_DOWN){
      if(sheetState==="full")setSheetState("peek");
      else { S.msel=null; setMapZoom(null); dirty=true; render(); }
    } else if(dy<-STEP_UP){
      setSheetState("full");
    }
    y0=null; dy=0;
  };
  grab.addEventListener("pointerup",release);
  grab.addEventListener("pointercancel",release);
})();
/* patch623: the other half of "getting back up" - see the patch header for why
   #sysInfo specifically is the scoped target. */
(function(){
  const info=document.querySelector("#sysInfo");
  if(!info)return;
  info.addEventListener("click",()=>{
    if(sheetState==="peek")setSheetState("full");
  });
})();
const navHsUpd=hscroll(document.querySelector("nav"));""",
    """const navHsUpd=hscroll(document.querySelector("nav"));""",
    label="grab-handle drag IIFE + PEEK-tap-to-FULL IIFE deleted",
)

# ==================================================================== JS: the sheetScroll-populating scroll listener,
# deleted along with sheetScroll itself.
do(
    """/* patch611: throttled, not per-frame - a real "scroll" event only fires while
   the player is actually scrolling, so a plain debounce (not a rAF loop) is
   enough; 150ms is short enough that a quick close-and-reopen right after a
   scroll still remembers the right spot. */
let sheetScrollTO=null;
{ const sheetEl=$("#sysSheet");
  if(sheetEl)sheetEl.addEventListener("scroll",()=>{
    if(sheetScrollTO)return;
    sheetScrollTO=setTimeout(()=>{
      sheetScrollTO=null;
      if(S.msel)sheetScroll[S.msel]=sheetEl.scrollTop;
    },150);
  },{passive:true});
}
function syncChips(){""",
    """function syncChips(){""",
    label="sheetScroll-populating scroll listener deleted",
)

# ==================================================================== __SD export: drop the dead names
do(
    """  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,mapZoomMeasure,get mzVisFrac(){return mzVisFrac},
  get sheetState(){return sheetState},setSheetState,
  get mapMode(){return mapMode},syncMapMode,renderMapList,""",
    """  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,
  get mapMode(){return mapMode},syncMapMode,renderMapList,""",
    label="__SD: drop mapZoomMeasure/mzVisFrac/sheetState/setSheetState",
)
do(
    "  sheetScroll,renderSysBuild};",
    "  renderSysBuild};",
    label="__SD: drop sheetScroll",
)

assert h.count("const BUILD=627;") == 1
# Live-code/markup shapes only - declarations, call sites and tag attributes that
# would only exist if a deletion above was incomplete. Not the bare identifiers:
# those legitimately appear in this patch's own explanatory comments (house style
# throughout this file names what a patch deleted/replaced). The do() calls above
# already proved every occurrence found by this session's own grep was replaced
# (each asserted an exact count); this is a second, narrower pass for anything a
# hand-typed anchor might have missed.
for dead in (
    "function setSheetState(", "function syncSheetState(",
    'setSheetState("peek")', 'setSheetState("full")', "let sheetState=",
    "let sheetScroll=", "sheetScrollSys!==", "sheetScrollSys=s.id",
    "function restoreSheetScroll(", "restoreSheetScroll(s.id",
    "function mapZoomMeasure(", "if(mapZoom)mapZoomMeasure()", "MZH*mzVisFrac",
    'id="sshGrab"', 'id="sshClose"', 'class="sshgrab"', 'class="sshx"',
    ".sshgrab{", ".sshx{", "#sysSheet.peek{", "#sysSheet.dragging{",
    "#sysThreat{padding-top:28px}",
):
    assert dead not in h, f"dead code shape still present: {dead}"
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch626 applied OK")
