#!/usr/bin/env python3
"""
patch630 (BUILD 632) - PLAN-page.md Run 2, item 2: exo strip -> context card tap.

Owner decision 5: "Exo strip goes. #exoStrip ... is removed. The header's context
card already shows the selected system's exotic; it becomes tappable -> resourceModal
showing all exotic balances + the Exotic Nodes counter, so the totals are one tap
away rather than gone."

What changed:

1. #exoStrip, renderExoStrip(), its call site (render()'s own
   `if($("#p-map")...on) renderExoStrip();`), its CSS (#exoStrip/.exi/.exdot/
   .exnums - the WHOLE family, not just the strip's own container rules: nothing
   else ever applied the .exi class, so all of it was exoStrip-only), and its
   "ever banked" gate comment (patch613c, inside the function body) are deleted
   outright, not hidden. Three comments that described current behaviour
   involving #exoStrip (not just history) were corrected to match: the
   body.syspage derivation block's own note, #p-map's markup comment, and
   mktSvKinds()'s "same gate renderExoStrip() uses" line. Two purely historical
   attributions ("same overflow class patch582b fixed for #exoStrip", CSS and JS)
   were left alone - they cite a borrowed technique, they do not claim exoStrip
   currently exists.

2. The context card (#ctxCard, .c-ctx, patch607/609c) is tappable exactly when
   exoEverBankedAny() is true - EXO.some(exoEverBanked) || enRate()>0 || S.en>0,
   the same OR-of-conditions #exoStrip itself used to decide whether to render at
   all (patch613c). This is checked independently of what the card currently
   shows: a held system with no exotic ("NO EXOTIC HERE") or nothing selected
   ("TAP A SYSTEM") are still tappable once anything has ever been banked, same
   as the plan asks. renderCtxCard() (already unconditional every render() tick)
   toggles a new .tappable class; patch607's three "not tappable" overrides are
   rescoped from .c-ctx to .c-ctx:not(.tappable), so when .tappable is present
   they simply stop matching and the ordinary .rcard base rules (cursor:pointer,
   :hover brighten, the ":after" "more" dot) apply on their own - no new
   affordance CSS needed, no risk of the two states drifting apart by hand.
   Before anything is ever banked the card behaves exactly as it always has:
   .tappable is never added, so nothing changes.

3. exoModal(): a new function, reusing resourceModal()'s own machinery rather
   than adding a second one. RESDEF gains a fifth key, "exo", carrying only
   rows() (a function, not a currency: there is no single cur/ic for four
   different-coloured exotics, so the other RESDEF fields - n/cur/ic/d/f, read
   only by resourceModal()'s own header/description template - are not given,
   and are not needed since exoModal() writes its own plain-<h3> header instead
   of calling resourceModal()). Opening it sets rmLive="exo" exactly like
   resourceModal(k) sets rmLive=k, so render()'s existing
   `if(rmLive&&mask.on)rmTick();` line - untouched - keeps the rows live at the
   same 11Hz the four currency modals already tick at. rmTick() itself is
   UNCHANGED: it already just calls RESDEF[rmLive].rows(), so a fifth key needed
   no branching added to it - this is the literal reading of "reuse the live-row
   idiom, don't hand-roll a second timer." Each row: a small coloured dot (the
   exotic's own --a colour, or EN_COL for the Exotic Nodes row) inline before the
   name, balance + rate after - built with the exact same .rrow markup
   rmTick()'s generic path already renders for ore/cry/sv/dm, so no new CSS.

tnodes2.js: the #exoStrip section (direct G.renderExoStrip() calls + #exoStrip DOM
reads) is retired - the function and element are gone. New coverage in its place:
the card's own .tappable gating (absent pre-bank, present and permanent post-bank,
mirroring the retired "gate never re-locks" check), the modal's row contents
against exo()/exoRate()/S.en/enRate() directly, and a live-tick check (change a
balance while the modal is open, confirm the row updates without closing/
reopening it - the same thing rmTick() already gets tested for on the four
currency modals, now exercised on this fifth key too). tmap2.js's two mentions
are historical (patch612-era, about the old #p-emp accordion #exoStrip used to
live in) and reference no current DOM/function - read, confirmed, left alone.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=631;", "const BUILD=632;", label="BUILD bump")

# ==================================================================== markup: the header comment + the
# card's own wiring note (both describing a status this patch ends).
do(
    """    <!-- patch607: the context card. No data-res (see the header note above) — the
         generic .rcard[data-res] click-wiring skips it, so tapping it really is inert. -->""",
    """    <!-- patch607: the context card. No data-res (see the header note above) — the
         generic .rcard[data-res] click-wiring skips it; patch630 gives it its own
         dedicated wiring instead (see exoModal()), gated on exoEverBankedAny(). -->""",
    label="ctxCard markup comment",
)

# ==================================================================== CSS: patch607's three "not tappable"
# overrides, rescoped from .c-ctx to .c-ctx:not(.tappable) - when .tappable is present these simply stop
# matching, and the ordinary .rcard base rules (cursor:pointer, :hover, the ":after" dot) apply on their own.
do(
    """/* patch607: the context card reads S.msel, not a fixed currency, and per the owner's
   own instruction is not tappable today - these three overrides undo the generic
   .rcard affordances (pointer cursor, hover brighten, the top-right "more" dot) so it
   doesn't visually promise a tap that does nothing. */
.c-ctx{cursor:default}
.c-ctx:hover{border-color:var(--line);background:linear-gradient(180deg,rgba(30,40,80,.45),rgba(12,16,36,.45))}
.c-ctx:after{content:none}""",
    """/* patch607: the context card reads S.msel, not a fixed currency, and (patch630:
   only until anything has ever been banked - exoEverBankedAny(), see
   renderCtxCard()'s own .tappable toggle) is not tappable - these three overrides
   undo the generic .rcard affordances (pointer cursor, hover brighten, the top-
   right "more" dot) so it doesn't visually promise a tap that does nothing. Once
   .tappable is added they stop matching outright, rather than being fought with a
   second set of "yes tappable after all" rules that could drift from these. */
.c-ctx:not(.tappable){cursor:default}
.c-ctx:not(.tappable):hover{border-color:var(--line);background:linear-gradient(180deg,rgba(30,40,80,.45),rgba(12,16,36,.45))}
.c-ctx:not(.tappable):after{content:none}""",
    label=".c-ctx tappable-state CSS",
)

# ==================================================================== CSS: delete the whole #exoStrip/.exi
# family - nothing else ever used the .exi class, so all of it (not just the strip's own container rules)
# goes with the strip.
do(
    """/* ---------- map ---------- */
#exoStrip{display:flex;gap:10px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden;align-items:center}
#exoStrip[hidden]{display:none}
#exoStrip .exi{flex:1 1 0;min-width:0}
.exi{display:flex;align-items:center;gap:5px;overflow:hidden}
.exi .exdot{width:9px;height:9px;border-radius:50%;background:var(--a);flex:none}
.exi:not(.held) .exdot{opacity:.35}
.exi:not(.held){opacity:.45}
/* patch582b: number-over-rate, not side by side - see the patch header for why */
.exi .exnums{display:flex;flex-direction:column;min-width:0;overflow:hidden}
.exi b{font:700 12px/1.15 ui-monospace,monospace;color:var(--txt);font-variant-numeric:tabular-nums;
  display:block;overflow:hidden;text-overflow:clip;white-space:nowrap}
.exi span{font:600 9px/1.15 ui-monospace,monospace;color:var(--dim);white-space:nowrap;
  display:block;overflow:hidden;text-overflow:clip}
#mapWrap{""",
    """/* ---------- map ---------- */
#mapWrap{""",
    label="delete #exoStrip/.exi CSS family",
)

# ==================================================================== CSS: the body.syspage derivation
# block's own comment + rule - #exoStrip no longer exists to have a hide-while-paged rule at all.
do(
    """   here keys off body.syspage instead, one fact set by syncSysPage() every
   render() pass - see its own comment. #exoStrip/#lfBanner had no hide-while-
   paged rule at all before this (both are outside #mapWrap, so #mapWrap.zoomed's
   own opacity cross-fade never reached them either) - PLAN-page.md decision 2
   lists both explicitly. #mapZoomBar used to show only while #mapWrap.zoomed
   (see its own base rule) - "any page, planet or not" replaces that condition
   here rather than adding to it. */
body.syspage #mapChips{display:none}
body.syspage #mapMode{display:none}
body.syspage #exoStrip{display:none}
body.syspage #lfBanner{display:none}""",
    """   here keys off body.syspage instead, one fact set by syncSysPage() every
   render() pass - see its own comment. #lfBanner had no hide-while-paged rule at
   all before this (it is outside #mapWrap, so #mapWrap.zoomed's own opacity
   cross-fade never reached it either) - PLAN-page.md decision 2 lists it
   explicitly (#exoStrip, listed alongside it there, is gone outright as of
   patch630 - nothing left to hide). #mapZoomBar used to show only while
   #mapWrap.zoomed (see its own base rule) - "any page, planet or not" replaces
   that condition here rather than adding to it. */
body.syspage #mapChips{display:none}
body.syspage #mapMode{display:none}
body.syspage #lfBanner{display:none}""",
    label="body.syspage comment + drop #exoStrip hide rule",
)

# ==================================================================== markup: #p-map's own header comment
# + the <div id="exoStrip"> itself.
do(
    """      <div class="pane on" id="p-map">
        <!-- patch613b: rehomed verbatim from the old #p-emp (deleted by patch612) -
             same ids, same renderExoStrip()/renderLiveFleet(), no rewrite. Order:
             lfBanner first (an alert, usually absent, wants to be nearest the top),
             then exoStrip (the four exotic balances + Exotic Nodes). Neither is
             inside #mapWrap, so patch603's own .zoomed class (scoped to #mapWrap's
             children) never hides them - both stay on screen while zoomed, which is
             the point: that is when you are spending these currencies. -->
        <div id="lfBanner"></div>
        <div id="exoStrip"></div>
        <div id="mapChips"></div>""",
    """      <div class="pane on" id="p-map">
        <!-- patch613b: rehomed verbatim from the old #p-emp (deleted by patch612) -
             same id, same renderLiveFleet(), no rewrite - it is an alert, usually
             absent, wants to be nearest the top. Not inside #mapWrap, so patch603's
             own .zoomed class (scoped to #mapWrap's children) never hides it -
             stays on screen while zoomed, which is the point: a live fleet inbound
             matters even mid-zoom. patch630: #exoStrip, which used to sit right
             after this, is gone - the header's context card (#ctxCard) is tappable
             now instead, see exoModal(). -->
        <div id="lfBanner"></div>
        <div id="mapChips"></div>""",
    label="#p-map markup comment + drop #exoStrip div",
)

# ==================================================================== JS: render()'s own call site.
do(
    '  if($("#p-map").classList.contains("on"))renderExoStrip();\n',
    "",
    label="drop render()'s renderExoStrip() call",
)

# ==================================================================== JS: the function itself, wholesale
# (its patch613c "ever banked" gate comment goes with it - that was "its gate comment" the plan means).
do(
    """function renderExoStrip(){
  const strip=$("#exoStrip");
  if(!strip)return;
  const enR=enRate(), enHave=S.en||0;
  /* patch613c: the strip itself, not just each entry, is gated on "ever banked" -
     before that it is four dim, number-less dots, pure clutter in the first hour
     and it pushes the map down for nothing. Same permanent test exoEverBanked()
     already gives each entry below, exactly one level higher, plus the Exotic
     Nodes condition this function already had - once true it stays true forever
     (S.exoSeen never clears), so no new state, no un-hiding once shown. */
  const everBankedAnything = EXO.some(e=>exoEverBanked(e.id)) || enR>0 || enHave>0;
  strip.hidden = !everBankedAnything;
  if(!everBankedAnything)return;
  /* patch582b: number and rate stack in their own column now (.exnums) so one
     item's width only has to fit the wider of the two strings, not their sum -
     see the patch header for the overlap this replaced. */
  let html=EXO.map(e=>{
    const r=exoRate(e.id), have=exo(e.id), held=r>0||have>0;
    return `<div class="exi${held?" held":""}" style="--a:${e.col}" title="${e.n}">
      <i class="exdot"></i>${held?`<div class="exnums"><b>${fmt(have)}</b><span>${r>0?"+"+fmt(r)+"/s":""}</span></div>`:""}</div>`;
  }).join("");
  /* Exotic Nodes: a 5th strip entry, own colour, hidden until the first ring-3/4
     claim ever produces or produced one - see enRate()'s header comment. */
  if(enR>0||enHave>0){
    html+=`<div class="exi held" style="--a:${EN_COL}" title="Exotic Nodes">
      <i class="exdot"></i><div class="exnums"><b>${fmt(enHave)}</b><span>${enR>0?"+"+fmt(enR)+"/s":""}</span></div></div>`;
  }
  strip.innerHTML=html;
}
""",
    "",
    label="delete renderExoStrip() wholesale",
)

# ==================================================================== JS: mktSvKinds()'s own comment.
do(
    """/* which resources currently have a live SALVAGE card - ore always, crystal once any
   Smelter output exists, each exotic once it is held or being produced (same "held"
   gate renderExoStrip() already uses). */""",
    """/* which resources currently have a live SALVAGE card - ore always, crystal once any
   Smelter output exists, each exotic once it is held or being produced (patch630:
   the same per-item "held" test the old #exoStrip used before it became the
   context-card modal - see exoModal()). */""",
    label="mktSvKinds() comment",
)

# ==================================================================== JS: the empire-wide "is there
# anything to show" gate - same OR-of-conditions #exoStrip itself used to decide whether to render at all.
do(
    """function exoEverBanked(id){ return !!(S.exoSeen&&S.exoSeen[id]) }""",
    """function exoEverBanked(id){ return !!(S.exoSeen&&S.exoSeen[id]) }
/* patch630: the whole-empire "is there anything to show" gate - same OR-of-
   conditions #exoStrip itself used (patch613c) to decide whether to render at
   all, reused to decide whether the context card is tappable and whether its
   modal (exoModal()) has anything in it. Permanent, like exoEverBanked() itself:
   S.exoSeen/S.en never clear once set. */
function exoEverBankedAny(){ return EXO.some(e=>exoEverBanked(e.id)) || enRate()>0 || (S.en||0)>0 }""",
    label="exoEverBankedAny() helper",
)

# ==================================================================== JS: renderCtxCard() gains the
# .tappable toggle - independent of what the card is currently showing (checked before the s/ex branch).
do(
    """function renderCtxCard(){
  const dot=$("#ctxDot"), val=$("#vCtxVal"), name=$("#vCtxName"), rate=$("#vCtxRate"), card=$("#ctxCard");
  if(!dot||!val||!name||!rate||!card)return;
  const s = S.msel ? SYSMAP[S.msel] : null;""",
    """function renderCtxCard(){
  const dot=$("#ctxDot"), val=$("#vCtxVal"), name=$("#vCtxName"), rate=$("#vCtxRate"), card=$("#ctxCard");
  if(!dot||!val||!name||!rate||!card)return;
  /* patch630: gates whether the card can be TAPPED, independent of what it is
     currently showing - a held system with no exotic or nothing selected are
     both still tappable once anything has ever been banked, per the plan. */
  card.classList.toggle("tappable", exoEverBankedAny());
  const s = S.msel ? SYSMAP[S.msel] : null;""",
    label="renderCtxCard() .tappable toggle",
)

# ==================================================================== JS: RESDEF gains a 5th key, "exo" -
# rows() only (no n/cur/ic/d/f: there is no single currency here, and exoModal() writes its own header
# instead of calling resourceModal(), so nothing reads those fields for this key).
do(
    """ dm:{n:"Dark Matter", cur:"var(--gd)", ic:"dm",
   d:"Paid out by missions, and by claiming new systems. Spends in the Nexus on permanent empire-wide bonuses.",
   rows:()=>[["Held",fmt(S.dm)],["Earned all-time",fmt(S.dmAll)],
             ["Nexus levels",String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:lv(S.nx,x.id)),0))+" / "+
               String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:x.max),0))],
             ["Missions done",String(misDone())+" / "+String(MISSIONS.length)]],
   f:"The scarcest currency in the game. Nothing here is ever bought with money."}
};""",
    """ dm:{n:"Dark Matter", cur:"var(--gd)", ic:"dm",
   d:"Paid out by missions, and by claiming new systems. Spends in the Nexus on permanent empire-wide bonuses.",
   rows:()=>[["Held",fmt(S.dm)],["Earned all-time",fmt(S.dmAll)],
             ["Nexus levels",String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:lv(S.nx,x.id)),0))+" / "+
               String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:x.max),0))],
             ["Missions done",String(misDone())+" / "+String(MISSIONS.length)]],
   f:"The scarcest currency in the game. Nothing here is ever bought with money."},
 /* patch630: not a single currency (no one cur/ic fits four different-coloured
    exotics), so only rows() is given - exoModal() writes its own header instead
    of calling resourceModal(), and rmTick() (unchanged) only ever reads rows(). */
 exo:{ rows:()=>{
   const rows=EXO.map(e=>[
     `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${e.col};margin-right:7px;vertical-align:middle"></i>${e.n}`,
     fmt(exo(e.id))+(exoRate(e.id)>0?"  +"+fmt(exoRate(e.id))+"/s":"")
   ]);
   const enR=enRate(), enHave=S.en||0;
   if(enR>0||enHave>0) rows.push([
     `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${EN_COL};margin-right:7px;vertical-align:middle"></i>Exotic Nodes`,
     fmt(enHave)+(enR>0?"  +"+fmt(enR)+"/s":"")
   ]);
   return rows;
 } }
};""",
    label="RESDEF.exo",
)

# ==================================================================== JS: exoModal() - reuses
# resourceModal()'s own rmLive/rmTick()/showModal()/hideModal() idiom rather than adding a second timer.
do(
    """let resSel=null;""",
    """/* patch630: the #exoStrip replacement. Same rmLive/rmTick()/showModal()/hideModal()
   idiom resourceModal() uses for the four currencies - render()'s own existing
   `if(rmLive&&mask.on)rmTick();` line (unchanged) keeps this live at the same
   11Hz. Own plain <h3> header instead of resourceModal()'s .nmh icon box: there
   is no single colour/icon for "every exotic", so it does not try to force one. */
function exoModal(){
  if(!exoEverBankedAny())return;   /* nothing to show before anything has ever been banked */
  rmLive="exo";
  showModal(`<h3>Exotic Balances</h3>
    <p>Every exotic your empire has ever banked, and the Exotic Nodes claiming ring-3/4 systems can produce.</p>
    <div id="rmRows" style="margin-top:10px"></div>
    <div class="row"><button id="rmClose">CLOSE</button></div>`,
    ()=>{ $("#rmClose").onclick=hideModal; rmTick(); });
}
let resSel=null;""",
    label="exoModal()",
)

# ==================================================================== JS: dedicated click wiring for
# #ctxCard, replacing the "generic wiring skips it, tapping is inert" state the markup comment used to name.
do(
    '$("#svChip").onclick=()=>resourceModal("sv");',
    '''$("#svChip").onclick=()=>resourceModal("sv");
$("#ctxCard").onclick=()=>{ if(exoEverBankedAny())exoModal(); };   /* patch630 */''',
    label="#ctxCard click wiring",
)

# ==================================================================== __SD export: drop the dead name,
# add the two new ones.
do(
    "  renderExoStrip,mktSvKinds,",
    "  mktSvKinds,exoModal,exoEverBanked,exoEverBankedAny,",
    label="__SD export list",
)

assert h.count("const BUILD=632;") == 1
for dead in (
    '<div id="exoStrip">', "#exoStrip{", "#exoStrip[", "#exoStrip .exi", "body.syspage #exoStrip",
    '$("#exoStrip")', "renderExoStrip",
    ".exi{", ".exi .exdot", ".exi:not(.held)", ".exi b{", ".exi span{",
):
    assert dead not in h, f"dead code shape still present: {dead}"
# "#exoStrip" (the bare text, not a selector/call) legitimately survives as prose, audited by hand (not
# guessed, same as patch628b's own --sysbarh count) - 8, not 0: three PRE-EXISTING historical attributions
# this patch deliberately left alone (patch609c's CSS comment near .ctxnums, its twin in renderCtxCard()'s
# own header - both just cite a borrowed overflow-fix technique - and renderSysDef()'s own defence-gate
# comment, "same ... one-way semantics as #exoStrip (patch613c)"), plus five NEW comments this patch itself
# added that explain, in past tense, what used to be there or what gate it reused (the body.syspage block,
# #p-map's markup comment, exoEverBankedAny()'s own header, mktSvKinds(), and exoModal()'s own header).
assert h.count("#exoStrip") == 8, f"expected 8 (see this assertion's own comment), found {h.count('#exoStrip')}"
assert "function exoEverBankedAny(){" in h
assert 'card.classList.toggle("tappable", exoEverBankedAny());' in h
assert ".c-ctx:not(.tappable){cursor:default}" in h
assert "function exoModal(){" in h
assert ' exo:{ rows:()=>{' in h
assert '$("#ctxCard").onclick=' in h
assert h.count("exoEverBankedAny") >= 4   # the def, renderCtxCard, exoModal's own guard, the click wiring
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch630 applied OK")
