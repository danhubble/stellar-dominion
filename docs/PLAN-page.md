# PLAN-page — a system is a page, not a sheet

16 Sep 2026. Base build b626. Patches start at 626. House rules unchanged (one-purpose
anchor-asserted patch scripts, pcheck + tq2 after each, full suite per batch, shipped
`stellar-dominion.html` md5 `bcb806896f1a737146d08d7674adbce6` untouched, BUILD bump and
HANDOVER entry per patch, `mkartifact2.py` at batch end, publish by updating the existing
artifact URL).

## The problem

The bottom sheet (patch595, extended in b616/b622/b624/b626) overlays the map. On a phone
the map and the sheet fight for the same vertical space: at full height the visible band
above the sheet is a few pixels on a 667px screen, so the zoomed planet composes into
nothing ("sometimes the planet doesn't appear"); dismissing takes two or three drags
(full → peek → closed); the defence picker expands off-screen. Three snap heights were an
attempt to referee the fight. The owner played b626 and called the flexing sheet
"quite frustrating to use on mobile".

The owner then played a runtime mock (`mkpagemock.py` → `stellar-dominion-pagemock.html`,
published separately) of the alternative and called it "way better".

## Owner decisions (settled, 16 Sep)

1. **A system is a page.** Tap a node (or a LIST row) → the map pane becomes that
   system's page: planet header on top (the existing zoom canvas at ~34vh), `‹ MAP`
   top-left, system name centred, and the sheet's content flowing beneath as ordinary
   page content. SCAN SECTOR pinned to the bottom of the viewport (the DEFEND IT / LET
   THEM HOLD row takes the same slot when a threat is live). `‹ MAP` closes the page —
   one tap out. No drag handle, no PEEK, no rest heights, no visible-band measuring.
2. **One fact drives it.** "On a system page" ⇔ `S.msel` is set AND the map pane is
   the active tab. Chips, MAP|LIST toggle, exo strip, live-fleet banner, `#left` (mobile
   breakpoint only — the desktop sidebar stays), the map square's height, the zoom
   canvas, the `‹ MAP` bar, the page content, `#view`'s bottom padding: all derive from
   that one boolean, computed in one function called from `render()`, expressed as one
   class on `body`. Nothing else toggles them. The zoom is derived too: page open on a
   claimed system ⇒ zoomed; anything else ⇒ not. `mapZoom` stops being independently
   settable state from anywhere but that function (site view stays a sub-state of it).
   Switching tabs turns the class off and on again — the page is still there when you
   come back, because `S.msel` is (the owner asked for "the list stays where it was"). This is also the fix for the owner's "sector chips disappeared at one point":
   today `#mapChips` hides on `level()<8` OR `#p-map.zoomed`, and `.zoomed` is set by the
   zoom and cleared by the zoom's own back button — any of the four other close paths
   can leave it stuck. Derived from one fact, it cannot stick.
3. **Claiming a system opens its page.** `claimSystem()` ends by entering the page for
   that system with the planet showing. Today you claim, then have to tap again.
4. **VEGA is an overlay.** The notice bar leaves the layout flow. It becomes a fixed
   panel at the bottom of the viewport with a dimmed backdrop, avatar + text + the
   existing `TAKE ME THERE` / ✕ buttons. Tapping the backdrop dismisses too. Queue,
   keys, `notifyQueue`, `renderNotice()`'s guard idiom all unchanged — only where it
   renders. Nothing on the page moves when VEGA speaks.
5. **Exo strip goes.** `#exoStrip` (the iridium/helium/… balances row at the top of the
   map pane) is removed. The header's context card already shows the selected system's
   exotic; it becomes tappable → `resourceModal` showing all exotic balances + the Exotic
   Nodes counter, so the totals are one tap away rather than gone. (`#lfBanner`, the
   rival-fleet-inbound warning, stays — it is a warning, not a ledger.)
6. **Defence picker is a popup.** Tapping an empty slot opens the module choices in a
   modal (the game's existing `.mask` modal family), not an inline expansion. Pick →
   modal closes → slot fills. Tapping a filled slot keeps today's inline detail
   (upgrade/rearm) — that is a small block and it is fine in flow.
7. **Unclaimed systems get the same page.** No planet to draw, so the header is the map
   square as today with the node highlighted, `‹ MAP` still top-left with the system's
   name beside it. The ✕ close button is removed everywhere, and so is "tap the map
   background to deselect" — `‹ MAP` is the one way out. The sector swipe gesture is
   off on any page, not just a zoomed one.

Rejected: keeping the sheet with two states; planet drawn inside the sheet's header
(same space fight, one level down).

## Patch plan

Two runs. I verify between them at 390x667 AND 390x844, reading every screenshot.

**Run 1 — the page (626–628).**
- 626 Page layout. `#sysSheet` loses `position:fixed`, the transform, `max-height`, the
  grab handle, the ✕, and the three-state IIFE (patch620/623) — deleted, not disabled.
  It renders in flow after `#mapWrap` inside `#p-map`, full-bleed to the pane edges
  (the mock's `margin:0 -12px`). `#mapWrap` on a page: fixed `34vh` height, no aspect
  ratio, squared bottom corners meeting the page. `#sshScanBar` / `#sysThreatActs`:
  `position:fixed; bottom:0` with `#view` padding-bottom to match, mutual exclusion as
  today. `mapZoomMeasure()` / `mzVisFrac` and their callers go — the planet always has
  the whole header. `sheetState`, `setSheetState`, `sheetScroll` per-system memory
  (patch611) go; the page scroll position is `#view`'s and `paneScroll` already handles
  it. `__SD` export: drop the dead names.
- 627 One fact. A single `syncSysPage()` called from `render()`: computes
  `on = !!S.msel && <map pane is the active tab>`, sets one class `syspage` on `body`,
  and everything visual keys off that class in CSS (`body.syspage #mapChips{display:none}`,
  `body.syspage #view{padding-bottom:…}`, `@media(max-width:760px){body.syspage #left{display:none}}`
  etc.). It also derives the zoom: `want = on && (held || rival-occupied) ? S.msel : null`,
  and calls `setMapZoom(want)` only when it differs from `mapZoom` (so the entry
  transition still stamps once). Delete `#p-map.zoomed`'s CSS hooks for chips/mode and
  the tab-change zoom clearing; `setMapZoom()` keeps `#mapWrap.zoomed` for the canvas
  cross-fade only. `#mapZoomBar` shows on any page (keyed off `body.syspage`), with
  `#mapZoomName` set from `S.msel` whether or not there is a planet. `‹ MAP`: if a site
  view is open, return to the system; else `S.msel=null; render()` — the derivation does
  the rest. The old close paths (✕, handle, wrap background tap, sector change) are
  deleted, not redirected. `claimSystem()` ends with `S.msel=<id>` + render (decision
  3) — the derivation zooms it. Scroll `#view` to top on page entry (a transition, not
  every render). The sector swipe IIFE guards on the page boolean.
- 628 Tests. `tests/topen2.js` loses the sheet-state and drag assertions, gains:
  page open on node tap, `‹ MAP` closes it, claim opens the page zoomed, chips visible
  whenever no page is open and `level()>=8` regardless of how the page was closed (drive
  every close path), scan bar pinned and mutually exclusive with threat actions, planet
  canvas non-empty on a held system's page at 390x667. `tsheet2.js`, `tzoom2.js`,
  `tunify2.js`, `tchurn2.js`, `tmapoverlap2.js` updated for the missing sheet/handle;
  every changed assertion named in HANDOVER with the reason. Zero failures.

**Run 2 — VEGA, exo strip, picker (629–631).**
- 629 VEGA overlay. `.noticebar` → fixed bottom panel + backdrop, `z-index` above the
  scan bar, below `.scene`. Backdrop tap = ✕. Reduced-motion safe. `renderNotice()`
  unchanged except the element it toggles. `tnotices2.js`, `tstory2.js` updated.
- 630 Exo strip → header card tap. Remove `#exoStrip` and `renderExoStrip()`; the
  context card (`.c-ctx`, patch607/609c) becomes a button opening `resourceModal("exo")`
  (new mode listing all four balances/rates + Exotic Nodes). Undo patch607's
  "not tappable" CSS overrides. Empty state ("TAP A SYSTEM") stays non-tappable.
- 631 Defence picker modal. `renderDefDetail()`'s `mode==="pick"` branch renders into a
  `.mask` modal instead of `#sysDefDetail`; choosing closes it and calls the existing
  fit path. `defSel` semantics unchanged. `tdef2.js` updated. Then: full suite, csim
  diff, screenshots, HANDOVER, `mkartifact2.py`, publish to the existing URL, and delete
  the mock artifact.

## Watch for

- csim byte-identical: nothing here is in `tick()`'s call graph. No new `Math.random()`.
- `tchurn2` sweeps every button in the on-pane. The scan bar, `‹ MAP`, and the context
  card are static markup toggled by class — never rebuilt. The modal's buttons are
  created on open, which is fine (a modal is not the on-pane).
- `#view` is the one scroller. With the page in flow, `#sysThreatActs` and the scan bar
  are `position:fixed`, not sticky — they no longer depend on the sheet being a scroll
  container. Verify DEFEND IT is reachable with the tutorial box gone and a live threat.
- `paneNeedsTop` / `paneScroll`: entering a page scrolls to top; leaving restores the
  map's own position. Don't let the page's scroll leak into the map's memory.
- Old saves: `S.msel` set on load → boots straight onto that system's page, zoomed if
  held. That is intended (it is where you were). Fresh saves: `msel:null` (patch618).
- The mock's `:has()` selectors were mock-only. The build uses a class set from JS.
- `mkpagemock.py`, `stellar-dominion-pagemock.html`, `sd-pagemock-artifact.html` are
  throwaway: delete after 631 ships. HANDOVER says so.
