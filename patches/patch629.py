#!/usr/bin/env python3
"""
patch629 (BUILD 631) - PLAN-page.md Run 2, item 1: VEGA overlay.

Owner decision 4: "VEGA is an overlay. The notice bar leaves the layout flow. It
becomes a fixed panel at the bottom of the viewport with a dimmed backdrop... Tapping
the backdrop dismisses too... Nothing on the page moves when VEGA speaks."

What changed:

1. #notice moved OUT of #app entirely, to a body-level sibling beside #mask/#scene/
   #defence/#battle/#toasts. This is not cosmetic: #app is position:relative with an
   explicit z-index (2), which makes #app its OWN stacking context - a z-index set on
   any element still inside #app only ranks within #app's local context, and can
   never outrank a SIBLING of #app (#mask=20, #toasts=30, #battle=40, #defence=41)
   no matter how high it is set. #notice had to leave #app before its own z-index
   could mean anything relative to those.

2. .noticebar (the element #notice still carries, id and class both unchanged - only
   what they mean changed) is now the fixed, full-viewport dimming backdrop, always
   display:flex (never display:none, which cannot be transitioned - see point 4) with
   opacity/pointer-events doing the actual showing and hiding. .noticepanel, a new
   wrapper around the two existing children (.noticebody/.noticebtns - every id
   inside them is untouched), is the actual bottom-anchored card. z-index 25: above
   .mask(20) and the pinned scan/threat bars(15), below #toasts(30)/#battle(40)/
   #defence(41) - verified by queuing a notice while #battle.on: #battle's own
   opaque background (no alpha) fully covers #notice regardless of #notice's own
   .on state, so a notice firing mid-battle sits underneath, invisible, until the
   fight ends - no JS guard needed, it falls out of the z-index math alone.

3. Backdrop tap dismisses, same action as noticeX: one onclick on #notice itself,
   filtered to e.target.id==="notice" so it only fires on the dimmed area, never on
   the card or its buttons (their own e.target is a descendant, not #notice).

4. Reduced motion: added to patch589's already-centralised reduced-motion block
   rather than a second scattered media query. .noticebar/.noticepanel's own
   transitions (opacity, transform) are what would slide the card in - killing both
   collapses the state change to instant, "no slide, just show". This requires
   .noticebar to be display:flex UNCONDITIONALLY (point 2): display cannot be
   transitioned, and toggling it in lockstep with opacity/transform is the classic
   trap where the browser never gets to paint a "before" state to animate from -
   using opacity+pointer-events for the hidden state instead sidesteps that
   entirely, and does not depend on the reduced-motion branch to work correctly.

renderNotice()/dismissNotice() are BYTE-FOR-BYTE unchanged - every id they touch
(#notice, #noticeAv, #noticeWho, #noticeTxt, #noticeGo, #noticeX) still exists,
still nested exactly as before relative to each other, only the outer container
they all sit inside was rebuilt. The queue, the keys, S.notifyQueue, the
noticeShownKey rebuild guard: all untouched, per the plan's own words.

tnotices2.js: new coverage (backdrop-tap dismiss, #view/#left position unchanged
while a notice shows, invisible-behind-battle, old-save boots straight to the
overlay). tstory2.js: read in full, needed NO assertion changes - its one
geometry-dependent check (#noticeAv/#noticeTxt spacing) measures two children of
.noticebody, whose own CSS (and .vegaav's) is untouched; only their shared PARENT
moved, which that assertion never touched. Documented, not silently skipped.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=630;", "const BUILD=631;", label="BUILD bump")

# ==================================================================== CSS: the backdrop + panel. Same two
# selectors (.noticebar / .noticebar.on) that used to mean "in-flow bar, shown/hidden by display" now mean
# "full-viewport fixed backdrop, shown/hidden by opacity+pointer-events" - .noticebody/.noticecontent/
# .vegaav/.noticetxt/.noticewho/.noticebtns/#noticeGo/#noticeX below are all untouched, they just have a new
# immediate parent (.noticepanel) instead of .noticebar directly.
do(
    """/* ---------- one-time unlock notice ---------- */
.noticebar{display:none;flex:0 0 auto;align-items:center;gap:10px;
  margin:8px 12px 0;padding:9px 12px;border:1px solid var(--line2);border-radius:11px;
  background:rgba(20,28,58,.92);box-shadow:0 4px 18px -8px rgba(0,0,0,.55)}
.noticebar.on{display:flex}""",
    """/* ---------- one-time unlock notice (patch629: VEGA overlay) ---------- */
/* #notice itself moved out of #app - see its markup, now a body-level sibling of
   #mask/#battle/#defence/#toasts, not a child of #app any more. #app is
   position:relative with an explicit z-index (2), so it is its own stacking
   context - a z-index set on a descendant only ranks within #app's local context
   and can never outrank a SIBLING of #app like #mask(20)/#toasts(30)/#battle(40)/
   #defence(41), however high it is set. #notice had to leave before z-index:25
   below could mean anything relative to those. .noticebar is now the full-
   viewport dimming backdrop: ALWAYS display:flex (never display:none - display
   cannot be transitioned, and toggling it in lockstep with opacity/transform is
   the classic trap where the browser never paints a "before" state to animate
   from), opacity+pointer-events do the actual showing/hiding instead, so a real
   transition is possible with no JS involved. .noticepanel is the visible,
   bottom-anchored card; z-index 25 sits above .mask(20) and the pinned scan/
   threat bars(15), below #toasts(30)/#battle(40)/#defence(41) - verified by
   queuing a notice with #battle.on: #battle's own opaque (no-alpha) background
   fully covers #notice regardless of #notice's .on state, so a notice firing
   mid-battle waits underneath, invisible, until the fight ends. Reduced-motion
   (see the consolidated @media block further down): kills both transitions
   below, collapsing the state change to instant - "no slide, just show". */
.noticebar{display:flex;position:fixed;inset:0;z-index:25;
  align-items:flex-end;justify-content:center;
  background:rgba(2,3,10,.6);
  padding:0 12px calc(12px + env(safe-area-inset-bottom,0px));
  opacity:0;pointer-events:none;transition:opacity .2s ease}
.noticebar.on{opacity:1;pointer-events:auto}
.noticepanel{width:100%;max-width:1360px;margin:0 auto;
  display:flex;align-items:center;gap:10px;
  padding:9px 12px;border:1px solid var(--line2);border-radius:11px;
  background:rgba(20,28,58,.96);box-shadow:0 8px 28px -8px rgba(0,0,0,.6);
  transform:translateY(16px);transition:transform .2s ease}
.noticebar.on .noticepanel{transform:translateY(0)}""",
    label="notice CSS: bar -> fixed overlay + panel",
)

# reduced-motion: added to patch589's own consolidated block, not a second scattered query.
do(
    """@media(prefers-reduced-motion:reduce){
  .card.rdy.claimed:before{animation:none;background:none}
  .card.rdy button.misclaim.done{animation:none}
  .rcard.land{animation:none}
  .rwfly{display:none}
  .card.rdy.gone{transition:opacity .12s linear}
}""",
    """@media(prefers-reduced-motion:reduce){
  .card.rdy.claimed:before{animation:none;background:none}
  .card.rdy button.misclaim.done{animation:none}
  .rcard.land{animation:none}
  .rwfly{display:none}
  .card.rdy.gone{transition:opacity .12s linear}
  .noticebar,.noticepanel{transition:none}   /* patch629: no slide, just show */
}""",
    label="reduced-motion: kill the notice slide",
)

# ==================================================================== markup: remove #notice from inside
# #app (its old spot, between </header> and <main>) ...
do(
    """</header>

<div id="notice" class="noticebar">
  <div class="noticebody">
    <div id="noticeAv" hidden></div>
    <div class="noticecontent">
      <div class="noticewho" id="noticeWho" hidden></div>
      <div class="noticetxt" id="noticeTxt"></div>
    </div>
  </div>
  <div class="noticebtns">
    <button id="noticeGo">TAKE ME THERE</button>
    <button id="noticeX" title="Dismiss">✕</button>
  </div>
</div>

<main>""",
    """</header>

<main>""",
    label="remove #notice from inside #app",
)

# ... and re-insert it as a body-level sibling, right after #mask/#modal (order among the fixed overlays
# does not matter for stacking - z-index governs, not source order - this is just a readable spot).
do(
    """<div class="mask" id="mask"><div class="modal" id="modal"></div></div>
<div id="scene" class="scene"></div>""",
    """<div class="mask" id="mask"><div class="modal" id="modal"></div></div>
<!-- patch629: moved out of #app - see the CSS comment on .noticebar for why. Same
     ids inside, unchanged: renderNotice()/dismissNotice() never had to change. -->
<div id="notice" class="noticebar">
  <div class="noticepanel">
    <div class="noticebody">
      <div id="noticeAv" hidden></div>
      <div class="noticecontent">
        <div class="noticewho" id="noticeWho" hidden></div>
        <div class="noticetxt" id="noticeTxt"></div>
      </div>
    </div>
    <div class="noticebtns">
      <button id="noticeGo">TAKE ME THERE</button>
      <button id="noticeX" title="Dismiss">✕</button>
    </div>
  </div>
</div>
<div id="scene" class="scene"></div>""",
    label="re-insert #notice as a body-level sibling",
)

# ==================================================================== JS: backdrop tap = dismiss, same
# action as noticeX. Filtered to the backdrop itself (e.target.id==="notice") so a tap on the card or its
# buttons - whose own e.target is a descendant, never #notice - does not also dismiss.
do(
    '$("#noticeX").onclick=dismissNotice;',
    '''$("#noticeX").onclick=dismissNotice;
$("#notice").onclick=(e)=>{ if(e.target.id==="notice")dismissNotice(); };  /* patch629: backdrop tap = dismiss */''',
    label="backdrop tap wiring",
)

assert h.count("const BUILD=631;") == 1
for dead in (
    'margin:8px 12px 0;padding:9px 12px;border:1px solid var(--line2);border-radius:11px;\n  background:rgba(20,28,58,.92);',
):
    assert dead not in h, f"dead code shape still present: {dead}"
assert h.count('<div id="notice" class="noticebar">') == 1
assert h.count("</header>\n\n<main>") == 1
assert ".noticepanel{width:100%;max-width:1360px" in h
assert '.noticebar,.noticepanel{transition:none}' in h
assert h.count('id="noticeAv"') == 1 and h.count('id="noticeTxt"') == 1
assert h.count('id="noticeGo"') == 1 and h.count('id="noticeX"') == 1

with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch629 applied OK")
