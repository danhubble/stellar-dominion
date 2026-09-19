#!/usr/bin/env python3
"""
patch627 (BUILD 628) - PLAN-page.md, Run 1 patch 2 of 3: "one fact".

`syncSysPage()`, called once per render() pass, is now the single source of truth
for whether a system page is showing: `on = !!S.msel && the map pane is the active
tab`. One class, `body.syspage`, is toggled from it and nothing else - every CSS
hook that used to key off `#p-map.zoomed` (chips/mode) or nothing at all (exo strip,
live-fleet banner, sector edge overlay, #left on mobile) now keys off `body.syspage`
instead. This is the actual fix for the owner's "sector chips disappeared" report:
today `#mapChips` hides on `level()<8` OR `#p-map.zoomed`, and `.zoomed` is set by
the zoom and cleared only by the zoom's own back button - any of several other close
paths could leave it stuck open-but-hidden. Derived fresh from one fact on every
render(), it cannot stick.

The zoom is derived too, not independently settable: `want = on && (held or rival-
occupied) ? S.msel : null`, applied via `setMapZoom(want)` only when it actually
differs from `mapZoom` (so the entry-transition timer still stamps exactly once).
`setMapZoom()` itself shrinks to just the canvas cross-fade (`#mapWrap`/`#p-map`
`.zoomed`) plus `mapSite`/`syncMapZoomBack()` bookkeeping - it no longer touches
`#mapZoomName` (that now belongs to `syncSysPage()`, set from `S.msel` on ANY page,
planet or not - a zoom-only update would blank the name on an unclaimed system's
page, which is never zoomed).

Every other direct `setMapZoom(` caller found by grep is deleted, not redirected,
per the plan's own "old close paths ... deleted, not redirected" - the node-tap
handler and `mapNodeTapEquivalent()` now just set `S.msel` and render, same as
`claimSystem()` does at the end of this patch; the derivation does the zooming.
After this patch, `setMapZoom(` has exactly ONE caller left: `syncSysPage()`
itself. (The coordinator's own bound was "syncSysPage() and the site-view/`< MAP`
handler" - the handler ended up not needing to call it directly at all once
`S.msel=null` alone is enough to make the derivation zero it out; flagged here
rather than silently left unmentioned.)

`#view` scrolls to top on the false->true `on` transition only, tracked with a
plain `sysPageWasOn` flag recomputed fresh every render() call - deliberately NOT
the approved mock's own MutationObserver-on-#sysSheet's-class approach, which the
coordinator flagged as buggy: that class does not actually toggle off on a tab
switch at all (nothing in the mock removed it - #p-map just stopped being the
active pane), so a mutation-observer watching it would never fire on the way back
in. Recomputing `on` from S.msel + the active-tab check on every single render()
call, rather than reading back some other element's class attribute, sidesteps
that class of bug entirely - verified explicitly (see HANDOVER) by driving a
tab-away-then-back cycle and confirming the scroll resets both times.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=627;", "const BUILD=628;", label="BUILD bump")

# ==================================================================== CSS: #p-map.zoomed's own chip/mode hooks ->
# a consolidated body.syspage block covering everything else a page hides (chips, mode, exo strip, live-fleet
# banner, the sector-edge overlay) plus the zoom bar's visibility (now "any page", not "only while zoomed").
do(
    """#mapChips{display:flex;gap:6px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden}
/* patch613b: #mapChips sits BEFORE #mapWrap in the DOM, so #mapWrap.zoomed's own
   sibling selectors (~) cannot reach backward to it - setMapZoom() below also
   toggles this class on #p-map itself for that reason. Hidden, not just inert:
   the swipe-to-change-sector gesture already refuses to fire while zoomed, so a
   visible-but-dead chip row was pure wasted height above the sheet. */
#p-map.zoomed #mapChips{display:none}
/* patch614: the MAP | LIST toggle hides on the same rule, for the same reason -
   the sheet already covers most of the square while zoomed, and there is nothing
   to toggle to "list" for the one system already on screen. */
#p-map.zoomed #mapMode{display:none}""",
    """#mapChips{display:flex;gap:6px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden}
/* patch627 (PLAN-page.md, "one fact"): replaces the patch613b/614 #p-map.zoomed
   hooks just above (chips/mode hid only while actually ZOOMED - exactly the
   "sector chips disappeared" bug: a page with no planet, e.g. unclaimed, was
   never zoomed, so it never hid them at all; closing via anything but the
   zoom's own back button could leave .zoomed - and so this - stuck). Everything
   here keys off body.syspage instead, one fact set by syncSysPage() every
   render() pass - see its own comment. #exoStrip/#lfBanner had no hide-while-
   paged rule at all before this (both are outside #mapWrap, so #mapWrap.zoomed's
   own opacity cross-fade never reached them either) - PLAN-page.md decision 2
   lists both explicitly. #mapZoomBar used to show only while #mapWrap.zoomed
   (see its own base rule) - "any page, planet or not" replaces that condition
   here rather than adding to it. */
body.syspage #mapChips{display:none}
body.syspage #mapMode{display:none}
body.syspage #exoStrip{display:none}
body.syspage #lfBanner{display:none}
body.syspage #mapEdge{display:none}
body.syspage #mapZoomBar{opacity:1;pointer-events:auto}""",
    label="body.syspage consolidated CSS hooks",
)

# ==================================================================== CSS: the old #mapZoomBar zoomed-only
# visibility rule - superseded by the body.syspage rule just added above.
do(
    """  opacity:0;pointer-events:none;transition:opacity .2s ease}
#mapWrap.zoomed #mapZoomBar{opacity:1;pointer-events:auto}""",
    """  opacity:0;pointer-events:none;transition:opacity .2s ease}
/* patch627: #mapWrap.zoomed #mapZoomBar{...} used to live here - superseded by
   the body.syspage rule near #mapChips (see its own comment): the bar now shows
   on any page, not only a zoomed one. */""",
    label="old #mapZoomBar zoomed-only rule removed",
)

# ==================================================================== CSS: #left hides on mobile while a page is
# open - the desktop sidebar (outside this media query) is untouched, per PLAN-page.md decision 2.
do(
    """  #left{order:3;flex:0 0 auto;min-height:0;overflow:visible;display:grid;
    grid-template-columns:1fr 1fr;gap:8px;align-items:stretch;
    border-right:none;border-top:1px solid var(--line);padding:8px 10px}""",
    """  #left{order:3;flex:0 0 auto;min-height:0;overflow:visible;display:grid;
    grid-template-columns:1fr 1fr;gap:8px;align-items:stretch;
    border-right:none;border-top:1px solid var(--line);padding:8px 10px}
  /* patch627 (PLAN-page.md): mobile only - the desktop sidebar (outside this
     media query) stays. A page already has its own SCAN SECTOR pinned to the
     viewport bottom; #left's copy underneath was pure dead space once the page
     itself could be taller than the screen (see patch626's own HANDOVER entry -
     this is the exact overlap it described as temporary). */
  body.syspage #left{display:none}""",
    label="#left hides on mobile while a page is open",
)

# ==================================================================== JS: setMapZoom() - drop #mapZoomName (now
# syncSysPage()'s job, set from S.msel on any page) and update its own doc comment.
do(
    """/* the one place zoom state actually changes - node taps, the back button, the sheet-
   close paths, sector change and tab change all funnel through this, so the static
   bar markup above is only ever toggled/re-texted, never rebuilt (tchurn2). */
function setMapZoom(id){
  /* only stamp a fresh entry-transition start when actually OPENING (or switching to
     a different system) - closing, or an identical re-set, must not restart it. */
  if(id&&id!==mapZoom) mapZoomT0=performance.now();
  mapZoom=id;
  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);
  /* patch613b: #mapChips-hiding hook - see its own CSS comment for why this can't
     just be a sibling selector off #mapWrap.zoomed. */
  const pane=$("#p-map"); if(pane)pane.classList.toggle("zoomed",!!id);
  const nameEl=$("#mapZoomName");
  if(nameEl){ const s=id?SYSMAP[id]:null; nameEl.textContent=s?s.n.toUpperCase():""; }
  /* patch615: (re)targeting or leaving the zoom always drops any open site view -
     it belongs to whichever system was zoomed, never survives a switch. */
  mapSite=null; syncMapZoomBack();
}""",
    """/* patch627 (PLAN-page.md, "one fact"): the only remaining caller is
   syncSysPage()'s own derivation - node taps, claiming, tab changes, sector
   changes and every close path all funnel through S.msel + render() now, never
   through this directly. Just the canvas cross-fade (#mapWrap/#p-map .zoomed)
   and the site-view bookkeeping - #mapZoomName moved to syncSysPage() itself
   (it needs to read on ANY page, zoomed or not; keying it to this function's own
   `id` argument would blank it on an unclaimed system's page, which is never
   zoomed - see syncSysPage()'s own comment). */
function setMapZoom(id){
  /* only stamp a fresh entry-transition start when actually OPENING (or switching to
     a different system) - closing, or an identical re-set, must not restart it. */
  if(id&&id!==mapZoom) mapZoomT0=performance.now();
  mapZoom=id;
  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);
  /* patch613b: #mapChips-hiding hook - see its own CSS comment for why this can't
     just be a sibling selector off #mapWrap.zoomed. */
  const pane=$("#p-map"); if(pane)pane.classList.toggle("zoomed",!!id);
  /* patch615: (re)targeting or leaving the zoom always drops any open site view -
     it belongs to whichever system was zoomed, never survives a switch. */
  mapSite=null; syncMapZoomBack();
}
/* patch627 (PLAN-page.md, "one fact"): the single source of truth for whether a
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
    label="setMapZoom() trimmed, syncSysPage() added",
)

# ==================================================================== JS: render() calls syncSysPage() first,
# every pass, before renderMap() and anything else keys off body.syspage/mapZoom this frame.
do(
    """function render(){
  $("#vOre").textContent=fmt(S.ore);""",
    """function render(){
  syncSysPage();
  $("#vOre").textContent=fmt(S.ore);""",
    label="render() calls syncSysPage()",
)

# ==================================================================== JS: claimSystem() ends by opening the
# claimed system's page (decision 3) - the derivation zooms it, no further tap needed.
do(
    """  blip(660,.35,"sine",.06); setTimeout(()=>blip(990,.3,"sine",.05),110);
  toast("Claimed "+s.n+" \\u2014 +"+fmt(s.dm)+" Dark Matter","y");
  queueNotice("vega:firstClaim");
  dirty=true; return true;
}""",
    """  blip(660,.35,"sine",.06); setTimeout(()=>blip(990,.3,"sine",.05),110);
  toast("Claimed "+s.n+" \\u2014 +"+fmt(s.dm)+" Dark Matter","y");
  queueNotice("vega:firstClaim");
  /* patch627 (PLAN-page.md decision 3): claiming opens the claimed system's page
     outright - S.msel is enough, syncSysPage()'s own derivation (called from the
     render() right below) zooms it since it is now held. No second tap. */
  S.msel=s.id;
  dirty=true; render(); return true;
}""",
    label="claimSystem() opens the claimed system's page",
)

# ==================================================================== JS: the node-tap handler (buildMap()) and
# mapNodeTapEquivalent() (the LIST-row tap) - just set S.msel and render, the derivation zooms.
do(
    """    b.onclick=()=>{ S.msel=s.id; setMapZoom((sysHeld(s.id)||sysOccupied(s.id))?s.id:null); dirty=true; render(); };""",
    """    b.onclick=()=>{ S.msel=s.id; dirty=true; render(); };  /* patch627: the derivation zooms it */""",
    label="node-tap: derivation zooms, not the handler",
)
do(
    """function mapNodeTapEquivalent(id){
  S.msel=id; setMapZoom((sysHeld(id)||sysOccupied(id))?id:null);
  mapMode="map"; syncMapMode();
  dirty=true; render();
}""",
    """function mapNodeTapEquivalent(id){
  S.msel=id; mapMode="map"; syncMapMode();  /* patch627: the derivation zooms it */
  dirty=true; render();
}""",
    label="mapNodeTapEquivalent: derivation zooms, not the handler",
)

# ==================================================================== JS: `< MAP` - site view open -> back to the
# system; else clear S.msel and let the derivation do the rest (no direct setMapZoom() call any more).
do(
    """$("#mapZoomBack").onclick=()=>{
  if(mapSite!=null){ mapSite=null; syncMapZoomBack(); dirty=true; render(); return; }
  /* patch626: also clears S.msel, not just the zoom - see this patch's own header
     for why this ships now rather than waiting for patch627's derivation. The
     setMapZoom(null) call stays explicit, unchanged - 627's job. */
  S.msel=null; setMapZoom(null); dirty=true; render();
};""",
    """$("#mapZoomBack").onclick=()=>{
  if(mapSite!=null){ mapSite=null; syncMapZoomBack(); dirty=true; render(); return; }
  /* patch627 (PLAN-page.md): S.msel=null is the whole close now - the derivation
     (syncSysPage(), called from the render() right here) clears body.syspage and
     the zoom together, one fact, so there is nothing left for this handler to set
     directly. */
  S.msel=null; dirty=true; render();
};""",
    label="mapZoomBack: derivation closes the page, no direct setMapZoom() call",
)

# ==================================================================== JS: map-background tap-to-close - one of the
# plan's named old close paths, deleted outright (not redirected).
do(
    """/* map background tap-to-close (patch595). patch626 (PLAN-page.md): the close X
   and the grab-handle drag that used to be documented alongside this were both
   deleted - `‹ MAP` is the one closing affordance for a zoomed system now,
   see its own onclick below. An unclaimed system's page still has only this
   background tap until patch627 gives it a `‹ MAP` bar of its own too (see
   HANDOVER - a known, deliberate gap for this patch). A tap ON a node is left to
   its own onclick, which must re-render the page for the newly-selected system,
   not close it. */
(function(){
  const wrap=document.querySelector("#mapWrap"); if(!wrap)return;
  wrap.addEventListener("click",e=>{
    if(!S.msel)return;
    /* the back button (and its bar) live inside #mapWrap too - a tap there must only
       reach its own onclick (close zoom), not also fall through and close the sheet. */
    if(e.target.closest&&(e.target.closest(".mnode")||e.target.closest("#mapZoomBar")))return;
    S.msel=null; setMapZoom(null); dirty=true; render();
  });
})();
""",
    """/* patch627 (PLAN-page.md): map background tap-to-close (patch595) is deleted
   outright here, not redirected - `‹ MAP` (now shown on any page, held or
   not - see its own CSS comment near #mapChips) is the one closing affordance,
   full stop. This was the last of the plan's named old close paths (X and the
   grab handle went in patch626; sector change and the tab-change zoom-clear are
   deleted just below). */
""",
    label="map-background tap-to-close deleted",
)

# ==================================================================== JS: sector change (setMapSec()) no longer
# reaches into the zoom directly - one of the plan's named old close paths.
do(
    """function setMapSec(n){
  n=Math.max(0,Math.min(SECTORS.length-1,n));
  if(n===mapSec)return;
  setMapZoom(null);
  mapSec=n; mapSecBuilt=-1; dirty=true; render();
}""",
    """function setMapSec(n){
  n=Math.max(0,Math.min(SECTORS.length-1,n));
  if(n===mapSec)return;
  /* patch627 (PLAN-page.md): setMapZoom(null) used to live here - deleted, not
     redirected, along with the plan's other named old close paths. #mapChips and
     the sector-swipe gesture (the only two ways to reach this) are both already
     unreachable while a page is open (body.syspage hides the chips; the swipe
     IIFE guards on the same class - see its own comment), so S.msel is already
     null in every case this actually runs post-627 - nothing left to clear. */
  mapSec=n; mapSecBuilt=-1; dirty=true; render();
}""",
    label="setMapSec(): old zoom-clear deleted",
)

# ==================================================================== JS: the tab-change zoom-clearing line - dead,
# the derivation already turns body.syspage/mapZoom off the instant the active tab isn't p-map.
do(
    """  const id=t.dataset.p;
  if(id!=="p-map")setMapZoom(null);
  $("#"+id).classList.add("on");""",
    """  const id=t.dataset.p;
  $("#"+id).classList.add("on");""",
    label="tab-change: zoom-clearing line deleted (syncSysPage() derives it)",
)

# ==================================================================== JS: the MAP|LIST toggle's own zoom-clear -
# dead the same way (list mode is only reachable while NOT on a page, chips being hidden by body.syspage).
do(
    """/* patch614: switching TO list always clears any zoom first - together with
   mapNodeTapEquivalent() above always setting mapMode back to "map", this keeps
   "zoomed \\u21d2 mapMode===\\"map\\"" true at all times, which is what makes
   #p-map.zoomed #mapMode{display:none} safe (the toggle can never be hidden while
   list mode is what's actually on screen). */
$$(".rmbtn[data-mm]").forEach(b=>b.onclick=()=>{
  mapMode=b.dataset.mm;
  if(mapMode==="list")setMapZoom(null);
  syncMapMode(); dirty=true; render();
});""",
    """/* patch614: mapNodeTapEquivalent() above always sets mapMode back to "map" on a
   tap, so list mode never survives selecting a system. patch627: the explicit
   setMapZoom(null) that used to live here is deleted - list mode is only
   reachable while #mapMode is visible, which body.syspage already hides
   whenever a page (zoomed or not) is open, so S.msel is already null in every
   case this runs. */
$$(".rmbtn[data-mm]").forEach(b=>b.onclick=()=>{
  mapMode=b.dataset.mm;
  syncMapMode(); dirty=true; render();
});""",
    label="MAP|LIST toggle: old zoom-clear deleted",
)

# ==================================================================== JS: the tab-click handler's own paneScroll
# capture/restore must not let a system page's own scroll leak into "the map's" remembered position (PLAN-page.md's
# own "Watch for" note) - caught by this patch's own verification (driving a tab-away-then-back cycle: without this,
# syncSysPage()'s scroll-to-0 on entry gets immediately clobbered by the tab handler's OWN restore-jump right after
# render() returns, reading back a stale paneScroll["p-map"] value from whatever the page itself was scrolled to
# when you left it).
do(
    """$$(".tab").forEach(t=>t.onclick=()=>{
  const view=$("#view");
  const from=$$(".pane").find(x=>x.classList.contains("on"));
  if(view&&from)paneScroll[from.id]=view.scrollTop;
  $$(".tab").forEach(x=>x.classList.remove("on"));
  $$(".pane").forEach(x=>x.classList.remove("on"));
  t.classList.add("on"); t.classList.remove("alert");
  const id=t.dataset.p;
  $("#"+id).classList.add("on");
  if(id==="p-raid" && thq().length>0){ raidMode="targets"; syncRaidMode(); }
  dirty=true; render(); requestAnimationFrame(drawTreeLines);
  if(view){
    const to = paneNeedsTop(id) ? 0 : (paneScroll[id]||0);
    /* grids, the tree canvas and the map settle over more than one frame, so reassert
       once after they have */
    /* instant, not smooth: #view animates scrollTop by default, and an animation in
       flight is indistinguishable from a broken reset */
    const jump=()=>{ try{ view.scrollTo({top:to, behavior:"instant"}) }
                     catch(_){ view.scrollTop=to } };
    jump();
    requestAnimationFrame(jump);
  }
});""",
    """$$(".tab").forEach(t=>t.onclick=()=>{
  const view=$("#view");
  const from=$$(".pane").find(x=>x.classList.contains("on"));
  /* patch627 (PLAN-page.md "Watch for": "don't let the page's scroll leak into
     the map's memory") - a system page's own scroll position is not "the map's"
     remembered position, so leaving p-map while one is open must not capture it
     into paneScroll["p-map"]; scoped to p-map + body.syspage specifically, not
     paneNeedsTop() in general - p-raid's own existing capture is untouched, out
     of scope here. */
  if(view&&from&&!(from.id==="p-map"&&document.body.classList.contains("syspage")))paneScroll[from.id]=view.scrollTop;
  $$(".tab").forEach(x=>x.classList.remove("on"));
  $$(".pane").forEach(x=>x.classList.remove("on"));
  t.classList.add("on"); t.classList.remove("alert");
  const id=t.dataset.p;
  $("#"+id).classList.add("on");
  if(id==="p-raid" && thq().length>0){ raidMode="targets"; syncRaidMode(); }
  dirty=true; render(); requestAnimationFrame(drawTreeLines);
  if(view){
    /* patch627: landing back on a system page must stay at the top - syncSysPage()
       (called from the render() just above) already put it there on the entry
       transition; without this check, the plain paneScroll[id]||0 fallback right
       below would immediately overwrite that with a stale remembered position -
       verified by actually driving a tab-away-then-back cycle, not assumed. */
    const to = (paneNeedsTop(id) || (id==="p-map" && document.body.classList.contains("syspage"))) ? 0 : (paneScroll[id]||0);
    /* grids, the tree canvas and the map settle over more than one frame, so reassert
       once after they have */
    /* instant, not smooth: #view animates scrollTop by default, and an animation in
       flight is indistinguishable from a broken reset */
    const jump=()=>{ try{ view.scrollTo({top:to, behavior:"instant"}) }
                     catch(_){ view.scrollTop=to } };
    jump();
    requestAnimationFrame(jump);
  }
});""",
    label="tab handler: system page scroll does not leak into the map's own memory",
)

# ==================================================================== JS: sector swipe IIFE guards on the page
# boolean (body.syspage) instead of the old, now-derived mapZoom variable directly.
do(
    """  wrap.addEventListener("touchstart",e=>{
    if(mapZoom)return;
    if(e.touches.length!==1)return;""",
    """  wrap.addEventListener("touchstart",e=>{
    /* patch627 (PLAN-page.md): guards on the page boolean now, not mapZoom
       directly - an unclaimed system's page (never zoomed) must refuse the
       swipe too, same as a held/zoomed one always did. */
    if(document.body.classList.contains("syspage"))return;
    if(e.touches.length!==1)return;""",
    label="sector swipe guards on body.syspage",
)

assert h.count("const BUILD=628;") == 1
# setMapZoom( must have exactly one CALLER left: syncSysPage()'s own derivation.
# Manually audited (every match read with context via a throwaway debug pass
# before this assertion was finalised) - the substring's other 6 occurrences are
# all comments: 2 pre-existing and out of scope (patch603's own #mapZoom/
# #mapZoomBar intro, and the mapSite/site-view comment near draw()), 3 this
# patch's own new breadcrumbs documenting what used to call it (setMapSec(),
# the MAP|LIST toggle, and syncSysPage()'s own doc comment), plus the function's
# definition. Enumerated explicitly rather than just trusting a raw count, so a
# real stray call site would still be caught.
assert h.count("setMapZoom(") == 7, f"expected 7 occurrences (see this assertion's own comment), found {h.count('setMapZoom(')}"
assert "function setMapZoom(id){" in h
assert "if(want!==mapZoom) setMapZoom(want);" in h
assert h.count("setMapZoom(). Cross-fades with the ordinary map layers") == 1, "patch603's own pre-existing comment mention missing"
assert h.count("see setMapZoom()/syncMapZoomBack() for how") == 1, "the mapSite/site-view pre-existing comment mention missing"
assert h.count("setMapZoom(null) used to live here") == 1
assert h.count("call setMapZoom() any more") == 1
assert h.count("setMapZoom(null) that used to live here") == 1
for dead in (
    "#p-map.zoomed #mapChips{display:none}", "#p-map.zoomed #mapMode{display:none}",
    "#mapWrap.zoomed #mapZoomBar{opacity:1;pointer-events:auto}",
    'if(id!=="p-map")setMapZoom(null);', 'if(mapMode==="list")setMapZoom(null);',
    "S.msel=null; setMapZoom(null); dirty=true; render();",
    "wrap.addEventListener(\"click\",e=>{\n    if(!S.msel)return;",
):
    assert dead not in h, f"dead code shape still present: {dead}"
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch627 applied OK")
