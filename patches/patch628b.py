#!/usr/bin/env python3
"""
patch628b (BUILD 630) - PLAN-page.md, coordinator review fixes before Run 2.

The coordinator independently verified Run 1 (patches 626-628) behaves correctly
everywhere they drove it, then read the 627 code and found four things that
violate or misjudge the plan, plus one dead-code item spotted in passing while
reviewing setMapZoom(). All fixed here, in one patch, same house rules.

1. body.syspage had TWO writers. syncSysPage() (patch627's own "one fact"
   derivation) was supposed to be the ONLY one - its own doc comment already said
   "Nothing else may toggle body.syspage" - but renderMap()'s sheet branch still
   carried the two direct classList.add/remove("syspage") calls patch626 put there
   (627 was supposed to delete them and never did). They agreed today only because
   renderMap() happens to run exclusively on the map tab - exactly the "agrees
   today, desyncs after the next refactor" coupling PLAN-page.md exists to remove.
   Deleted both lines.

2. #sysSheet.open was a SECOND class expressing the same fact body.syspage already
   does - visibility should derive from the one fact, not be independently
   toggled. Replaced with body.syspage #sysSheet{display:block} (default stays
   display:none); deleted the sheet.classList.add/remove("open") calls (the same
   renderMap() lines issue 1 touches) and the #sysSheet.open rule. renderMap()
   keeps rendering the page's own CONTENT keyed on S.msel exactly as before -
   content is not visibility, per the coordinator's own instruction. Every test
   that read #sysSheet's open class to ask "is the page showing" (topen2.js,
   tsheet2.js, ttree2.js, tzoom2.js - grepped to confirm, all four and only
   those four) now asks body.syspage (or getComputedStyle(#sysSheet).display,
   where a test already independently checked that too, for real CSS-level
   coverage rather than re-deriving the same JS fact a second time).

3. Scroll semantics, overruled by the coordinator. patch627 made tab-away-then-
   back land at the top of the page (a "transition" rule, sysPageWasOn). Every
   OTHER pane in this game restores its own scroll on return (paneScroll exists
   for exactly that) and the owner asked for "the list stays where it was" - so
   the page now scrolls to top when the SELECTED SYSTEM changes, not when the
   tab changes. sysPageWasOn (a plain was-it-on-last-render flag) is replaced
   with pageShownId (which system's page last reset the scroll): entering a page
   for a NEW id, switching to a different id while one is already open (LIST row,
   TAKE ME THERE, the live-fleet banner, a plain node tap, claimSystem() all
   just set S.msel and render(), so this covers every one of them for free).
   The two guards patch627 added to the tab-click handler (skip capturing
   paneScroll["p-map"] while a page was open; force the restore to 0 for it) are
   REMOVED - they were compensating for the transition-based rule, which no
   longer exists; p-map's own scroll is just another pane's now, captured and
   restored exactly like p-raid.

4. Toasts landed on top of the pinned SCAN SECTOR / DEFEND IT bar - #toasts is
   position:fixed at a flat bottom offset that never accounted for a page's own
   pinned footer. Fixed with a body.syspage #toasts override, and - per the
   coordinator's own "better" suggestion - a single CSS custom property
   (--sysbarh) that #view's own body.syspage padding-bottom rule (patch626) and
   the new #toasts rule both read, so the two can no longer drift apart the way
   #toasts had already silently done.

Also (spotted by the coordinator while reading setMapZoom(), not one of the
four numbered items): the #p-map.zoomed toggle inside setMapZoom() is dead -
patch627 replaced its one CSS reader (the #mapChips/#mapMode hide rules) with
body.syspage, and grepping confirms nothing reads #p-map.zoomed any more except
that toggle line itself and two comments. Deleted, so nobody later thinks it
still does something. tunify2.js had its own test reading this exact class
directly (not through CSS) - repointed at __SD.mapZoom, the actual state the
class used to mirror.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=629;", "const BUILD=630;", label="BUILD bump")

# ==================================================================== CSS: single source of truth for how much
# room a page's own pinned bottom bar needs reserved above it - #view's padding-bottom (patch626) and #toasts'
# own bottom offset (issue 4) both read this now, instead of #toasts carrying its own, silently-drifted number.
do(
    """  --k-ice:#79c6ef; --k-void:#a878ff; --k-home:#5ce6a5;
  --k-void-text:#b58cff;
}""",
    """  --k-ice:#79c6ef; --k-void:#a878ff; --k-home:#5ce6a5;
  --k-void-text:#b58cff;
  /* patch628b: single source of truth for how much room a system page's own
     pinned bottom bar (#sshScanBar/#sysThreatActs, patch626) needs reserved
     above it - #view's own body.syspage padding-bottom and #toasts' own
     body.syspage bottom offset both read this, so they cannot drift apart the
     way #toasts had already done (the coordinator's own review screenshot
     caught a claim toast sitting on top of the bar). 96px is the same
     empirically-measured figure patch626 sized #view's padding against - the
     taller of the two bars measured 91.3125px at 390x844, see HANDOVER. */
  --sysbarh:96px;
}""",
    label="--sysbarh custom property",
)

# ==================================================================== CSS: #mapWrap's own comment claimed
# body.syspage was "set/cleared at the same two renderMap() sites #sysSheet's own .open class already is" - both
# halves of that are now wrong (renderMap() no longer touches either), corrected in place.
do(
    """body.syspage is patch627's own final class name, pre-used here
   (see HANDOVER) - set/cleared at the same two renderMap() sites #sysSheet's own
   .open class already is. The explicit .homeonly line right below is so this does""",
    """body.syspage is syncSysPage()'s own class (patch627; patch628b made it the
   ONLY writer, after the coordinator's review caught renderMap() still carrying
   a second, redundant set/clear of it - see HANDOVER). #sysSheet's own
   visibility derives from the same one class now too, not a separate .open
   toggle - see its own CSS comment. The explicit .homeonly line right below is
   so this does""",
    label="#mapWrap comment: single-writer correction",
)

# ==================================================================== CSS: #sysSheet.open replaced with a
# body.syspage derivation - visibility is the same one fact everything else in a page keys off, not a second class.
do(
    """display:none
   by default; #sysSheet.open - toggled at the exact same renderMap() call sites as
   before this patch, only its CSS meaning changed - is what shows it. The grab""",
    """display:none
   by default; body.syspage #sysSheet{display:block} (patch628b - previously a
   separate .open class, toggled from renderMap(), which duplicated the very
   fact syncSysPage() already derives; the coordinator's review caught this as
   "a second class expressing the same fact" and asked for the derivation
   instead - see HANDOVER) is what shows it. renderMap() still renders the
   page's own CONTENT keyed on S.msel exactly as before - content is not
   visibility. The grab""",
    label="#sysSheet comment: .open -> body.syspage derivation",
)
do(
    """#sysSheet.open{display:block}""",
    """body.syspage #sysSheet{display:block}""",
    label="#sysSheet.open rule replaced",
)

# ==================================================================== CSS: #view's body.syspage padding now reads
# the shared --sysbarh custom property instead of its own separate 96px literal.
do(
    """body.syspage #view{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}""",
    """body.syspage #view{padding-bottom:calc(var(--sysbarh) + env(safe-area-inset-bottom,0px))}""",
    label="#view padding reads --sysbarh",
)

# ==================================================================== CSS: #toasts pinned above a page's own
# bottom bar while one is open - issue 4. 8px of its own clearance beyond the bar's reserved height, same margin
# renderMap()'s pinned bars use above their own content elsewhere in this file.
do(
    """#toasts{position:fixed;left:50%;transform:translateX(-50%);z-index:30;
  bottom:calc(16px + env(safe-area-inset-bottom, 0px));
  display:block;text-align:center;pointer-events:none;width:min(94vw,460px)}""",
    """#toasts{position:fixed;left:50%;transform:translateX(-50%);z-index:30;
  bottom:calc(16px + env(safe-area-inset-bottom, 0px));
  display:block;text-align:center;pointer-events:none;width:min(94vw,460px)}
/* patch628b: a system page's own pinned bottom bar (#sshScanBar/#sysThreatActs)
   sits where #toasts' own flat 16px offset above would otherwise put a claim
   toast right on top of it - the coordinator's own review screenshot caught
   this. Reads the same --sysbarh custom property #view's padding-bottom uses
   (see :root) so the two cannot drift apart again; +8px is this rule's own
   clearance beyond the bar's reserved height, not baked into --sysbarh itself
   since #view's padding and #toasts' offset are answering slightly different
   questions (room to scroll clear of the bar vs. floating visibly above it). */
body.syspage #toasts{bottom:calc(var(--sysbarh) + 8px + env(safe-area-inset-bottom,0px))}""",
    label="#toasts pinned above a page's own bottom bar",
)

# ==================================================================== JS: renderMap() - delete the second,
# redundant body.syspage writer (issue 1) and the #sysSheet.open toggle it sat beside (issue 2). Both branches.
do(
    """  const sheet=$("#sysSheet"), info=$("#sysInfo"), act=$("#sysAct"), thrBox=$("#sysThreat");""",
    """  /* patch628b: this used to also declare `sheet` (a $("#sysSheet") lookup) for
     the two classList("open") toggles just below, now deleted along with
     body.syspage's own second writer - see this patch's own header. #sysSheet's
     visibility is body.syspage #sysSheet{display:block} now, syncSysPage()'s
     derivation (called at the top of every render(), before this function
     runs) already set body.syspage correctly by the time this line runs. */
  const info=$("#sysInfo"), act=$("#sysAct"), thrBox=$("#sysThreat");""",
    label="renderMap(): drop the unused `sheet` lookup",
)
do(
    """  if(!s){
    if(sheet)sheet.classList.remove("open");
    document.body.classList.remove("syspage");
    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }""",
    """  if(!s){
    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }""",
    label="renderMap(): close branch drops the second syspage/open writer",
)
do(
    """  if(sheet)sheet.classList.add("open");
  document.body.classList.add("syspage");
  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;""",
    """  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;""",
    label="renderMap(): open branch drops the second syspage/open writer",
)

# ==================================================================== JS: setMapZoom() - delete the dead
# #p-map.zoomed toggle (spotted by the coordinator while reviewing this function, not one of the four numbered
# issues) and correct its own doc comment's mention of it.
do(
    """through this directly. Just the canvas cross-fade (#mapWrap/#p-map .zoomed)
   and the site-view bookkeeping - #mapZoomName moved to syncSysPage() itself""",
    """through this directly. Just the canvas cross-fade (#mapWrap .zoomed - patch628b
   dropped the redundant #p-map .zoomed toggle that used to sit beside it here,
   dead since patch627 moved its one CSS reader to body.syspage; grep confirmed
   nothing reads #p-map.zoomed any more) and the site-view bookkeeping -
   #mapZoomName moved to syncSysPage() itself""",
    label="setMapZoom() doc comment: #p-map .zoomed no longer mentioned as live",
)
do(
    """  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);
  /* patch613b: #mapChips-hiding hook - see its own CSS comment for why this can't
     just be a sibling selector off #mapWrap.zoomed. */
  const pane=$("#p-map"); if(pane)pane.classList.toggle("zoomed",!!id);
  /* patch615: (re)targeting or leaving the zoom always drops any open site view -
     it belongs to whichever system was zoomed, never survives a switch. */
  mapSite=null; syncMapZoomBack();
}""",
    """  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);
  /* patch615: (re)targeting or leaving the zoom always drops any open site view -
     it belongs to whichever system was zoomed, never survives a switch. */
  mapSite=null; syncMapZoomBack();
}""",
    label="setMapZoom(): dead #p-map.zoomed toggle deleted",
)

# ==================================================================== JS: syncSysPage() - issue 3. sysPageWasOn
# (a transition flag: was a page on last render) replaced with pageShownId (which system's page last reset the
# scroll), so a tab-away-then-back (same S.msel) no longer resets - only a change of selection, or a close, does.
do(
    """/* patch627 (PLAN-page.md, "one fact"): the single source of truth for whether a
   system page is showing, called once per render() pass (see its own call site,
   right at the top of render() - before renderMap() and everything else that
   reads body.syspage or mapZoom this frame). Nothing else may toggle
   body.syspage or call setMapZoom() any more. */
let sysPageWasOn=false;
function syncSysPage(){
  const on = !!S.msel && $("#p-map").classList.contains("on");
  document.body.classList.toggle("syspage", on);
  const nameEl=$("#mapZoomName");
  if(nameEl){ const s=on?SYSMAP[S.msel]:null; nameEl.textContent=s?s.n.toUpperCase():""; }
  const want = on && (sysHeld(S.msel)||sysOccupied(S.msel)) ? S.msel : null;
  if(want!==mapZoom) setMapZoom(want);
  /* entering a page scrolls #view to top - a transition, not every render (must
     not yank the player's own mid-page scroll back to 0 on some unrelated dirty
     render). A tab-away-then-back counts as a fresh entry too, correctly, since
     `on` is recomputed from S.msel + the active-tab check from scratch every
     call rather than read back off some other element's class attribute - see
     this patch's own header for the mock bug that approach had and why this
     sidesteps it. */
  if(on && !sysPageWasOn){
    const view=$("#view");
    if(view){ try{ view.scrollTo({top:0,behavior:"instant"}) }catch(_){ view.scrollTop=0 } }
  }
  sysPageWasOn=on;
}""",
    """/* patch627 (PLAN-page.md, "one fact"), single-writer-corrected by patch628b:
   the single source of truth for whether a system page is showing, called once
   per render() pass (see its own call site, right at the top of render() -
   before renderMap() and everything else that reads body.syspage or mapZoom
   this frame). Nothing else may toggle body.syspage, #sysSheet's visibility
   (body.syspage #sysSheet{display:block} - see its own CSS comment), or call
   setMapZoom() - renderMap() used to duplicate the first two, deleted there,
   not here (see HANDOVER). */
let pageShownId=null;
function syncSysPage(){
  const on = !!S.msel && $("#p-map").classList.contains("on");
  document.body.classList.toggle("syspage", on);
  const nameEl=$("#mapZoomName");
  if(nameEl){ const s=on?SYSMAP[S.msel]:null; nameEl.textContent=s?s.n.toUpperCase():""; }
  const want = on && (sysHeld(S.msel)||sysOccupied(S.msel)) ? S.msel : null;
  if(want!==mapZoom) setMapZoom(want);
  /* patch628b (coordinator overruled patch627's own transition-based rule here):
     the page scrolls to top when the SELECTED SYSTEM changes, not when the tab
     changes - every other pane restores its own scroll on return (paneScroll),
     and the owner asked for this one to behave the same way ("the list stays
     where it was"). pageShownId tracks which system's page last reset the
     scroll, so entering a page for a NEW id, switching to a DIFFERENT id while
     one is already open (LIST row, TAKE ME THERE, the live-fleet banner, a
     plain node tap and claimSystem() all just set S.msel and render(), so this
     covers all of them for free), and closing (S.msel back to null) each reset
     once; a tab-away-then-back (S.msel unchanged) does not - the tab handler's
     own paneScroll restores that case now, same as any other pane (see its own
     comment - the two guards patch627 added there for the old transition rule
     are gone). */
  if(on){
    if(pageShownId!==S.msel){
      const view=$("#view");
      if(view){ try{ view.scrollTo({top:0,behavior:"instant"}) }catch(_){ view.scrollTop=0 } }
      pageShownId=S.msel;
    }
  } else if(!S.msel && pageShownId!==null){
    const view=$("#view");
    if(view){ try{ view.scrollTo({top:0,behavior:"instant"}) }catch(_){ view.scrollTop=0 } }
    pageShownId=null;
  }
}""",
    label="syncSysPage(): sysPageWasOn -> pageShownId",
)

# ==================================================================== JS: the tab-click handler's paneScroll
# capture/restore - issue 3's other half. The two patch627 guards (compensating for the transition-based scroll
# rule, now gone) are removed; p-map's scroll is captured/restored exactly like any other pane again.
do(
    """  const from=$$(".pane").find(x=>x.classList.contains("on"));
  /* patch627 (PLAN-page.md "Watch for": "don't let the page's scroll leak into
     the map's memory") - a system page's own scroll position is not "the map's"
     remembered position, so leaving p-map while one is open must not capture it
     into paneScroll["p-map"]; scoped to p-map + body.syspage specifically, not
     paneNeedsTop() in general - p-raid's own existing capture is untouched, out
     of scope here. */
  if(view&&from&&!(from.id==="p-map"&&document.body.classList.contains("syspage")))paneScroll[from.id]=view.scrollTop;""",
    """  const from=$$(".pane").find(x=>x.classList.contains("on"));
  /* patch628b: a system page is just another pane's own scroll position now,
     captured/restored exactly like p-raid or anything else here - patch627's
     own guard (skip capturing p-map while a page was open) compensated for its
     transition-based scroll-reset rule, which the coordinator overruled (see
     syncSysPage()'s own comment); keeping the guard without that rule would
     have left p-map unable to remember its scroll at all. */
  if(view&&from)paneScroll[from.id]=view.scrollTop;""",
    label="tab handler: capture-skip guard removed",
)
do(
    """  if(view){
    /* patch627: landing back on a system page must stay at the top - syncSysPage()
       (called from the render() just above) already put it there on the entry
       transition; without this check, the plain paneScroll[id]||0 fallback right
       below would immediately overwrite that with a stale remembered position -
       verified by actually driving a tab-away-then-back cycle, not assumed. */
    const to = (paneNeedsTop(id) || (id==="p-map" && document.body.classList.contains("syspage"))) ? 0 : (paneScroll[id]||0);""",
    """  if(view){
    const to = paneNeedsTop(id) ? 0 : (paneScroll[id]||0);""",
    label="tab handler: restore-to-0 guard removed",
)

assert h.count("const BUILD=630;") == 1
for dead in (
    'document.body.classList.remove("syspage");', 'document.body.classList.add("syspage");',
    'sheet.classList.remove("open")', 'sheet.classList.add("open")', "#sysSheet.open{display:block}",
    "let sysPageWasOn=", "if(on && !sysPageWasOn){", "sysPageWasOn=on;",
    'pane.classList.toggle("zoomed",!!id);',
    'from.id==="p-map"&&document.body.classList.contains("syspage")',
    'id==="p-map" && document.body.classList.contains("syspage")) ? 0',
):
    assert dead not in h, f"dead code shape still present: {dead}"
assert "body.syspage #sysSheet{display:block}" in h
assert "let pageShownId=null;" in h
assert "--sysbarh:96px;" in h
# 5, not 3: the declaration, the #view rule, the #toasts rule, and the #toasts
# comment's own prose mentions it twice ("Reads the same --sysbarh..." and "not
# baked into --sysbarh itself") - audited by hand, not guessed, same as
# patch627's own setMapZoom( count.
assert h.count("--sysbarh") == 5, f"expected 5 (see this assertion's own comment), found {h.count('--sysbarh')}"
assert "body.syspage #toasts{bottom:calc(var(--sysbarh) + 8px" in h
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch628b applied OK")
