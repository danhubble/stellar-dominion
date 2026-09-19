#!/usr/bin/env python3
"""
patch631 (BUILD 633) - PLAN-page.md Run 2, item 3: defence picker modal.

Owner decision 6: "Defence picker is a popup. Tapping an empty slot opens the module
choices in a modal (the game's existing .mask modal family), not an inline expansion.
Pick -> modal closes -> slot fills. Tapping a filled slot keeps today's inline detail
(upgrade/rearm) - that is a small block and it is fine in flow."

What changed:

1. openDefPicker(s,i): a new function, doing exactly what renderDefDetail()'s old
   "pick" branch used to build inline (same DEF_MODULES/DEF_COLOR/defIconHTML/
   dmodPrice calls, same .pk/.pki/.pkb/.pkn/.pkg row markup, same afford/short-by-N/
   guidance text) but handed to showModal() instead of written into #sysDefDetail,
   plus a CANCEL button. It is called directly, imperatively, from the empty slot's
   own onclick in renderSysDef() - never from render(), which runs at 11Hz and must
   not be able to reopen a modal the player already dismissed. Choosing a module
   calls dmodBuild(s,i,m), then hideModal(), then defSel=null, then render()+save() -
   exactly the plan's own "Pick -> modal closes -> slot fills" order. CANCEL calls
   hideModal()+defSel=null+render() with no build and no save.

2. defSel keeps its exact shape ({slot,mode}), per the plan - openDefPicker() still
   sets it to {slot:i,mode:"pick"} before opening (and render()s once so the empty
   card underneath immediately shows its existing .sel highlight, defCardHTML()'s
   own logic, untouched), and clears it back to null on both exits (a pick or
   CANCEL). renderDefDetail()'s own "pick" branch is now four lines: #sysDefDetail
   has nothing to show for "pick" any more (the modal is not that host's content),
   so it just runs the same empty/hidden cleanup the !defSel branch above it
   already does. One more exit exists that neither CANCEL nor a pick handles:
   #mask already carries its own generic backdrop-tap-to-close (pre-existing,
   `$("#mask").onclick=e=>{if(e.target.id==="mask")hideModal()}`), which closes
   this modal same as any other but has no idea defSel exists. Rather than teach
   that generic handler about one feature's state, renderSysDef() self-heals, at
   the very top of the function, before anything else runs: if defSel still
   claims "pick" but #mask is no longer .on, the claim is stale and gets
   dropped - it cannot stay stuck past the next tick, from any close path,
   including ones added later. Lives in renderSysDef(), not renderDefDetail()
   (which is what a first pass of this patch shipped, then corrected before
   HANDOVER): renderSysDef()'s own rowKey a few lines below bakes defSel into
   the empty card's churn-guarded .sel class, and that guarded rebuild runs
   BEFORE renderDefDetail() is reached at the bottom of the same function - a
   heal placed there lands one render() tick too late for .sel to notice on the
   same pass it happened, leaving a real (if brief, ~90ms) stuck highlight after
   a backdrop-tap close. Healing at the top instead means the same render() pass
   that closes the modal also repaints the card correctly.

3. Tapping a FILLED slot is completely unchanged - same defSel toggle, same
   render()-driven inline detail in #sysDefDetail, same SWAP MODULE button. Only
   the empty-slot ("BUILD") tap was rerouted; the mode==="detail" path in both
   renderSysDef()'s click handler and renderDefDetail() was not touched.

4. CSS: the .pk/.pki/.pkb/.pkn/.pkg family was scoped "#sysDefDetail .pk" etc. -
   dead weight now, since renderDefDetail() never puts that markup there again.
   Rescoped to bare selectors (.pk, .pki, ...): the modal (#modal .pk, via
   #defPickRows) is the ONLY place this markup renders going forward, so a bare
   selector is both correct and simpler than carrying two scoped copies or
   qualifying every rule with #modal instead. #sysDefDetail's own OTHER rules
   (.detail/.dn/.de/p/.acts, for the filled-slot inline path) are untouched -
   that host still renders that content itself, in flow, exactly as before.

Nothing here touches tick()'s call graph or Math.random() - csim stays identical.
tdef2.js: new coverage (empty-slot tap opens #mask with the right rows, not
#sysDefDetail; CANCEL closes with nothing built and nothing spent; picking builds,
closes, and spends, matching dmodBuild()'s own return value; a filled slot's tap
still goes through the old inline path, completely unaffected - a direct regression
guard for point 3). topen2.js's own gate test (the exotic-banking DEFENCES-header
gate, not the picker) was read in full and confirmed to never touch #sysDefDetail's
pick mode or click an empty slot at all - it needed no change, documented here
rather than silently skipped.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=632;", "const BUILD=633;", label="BUILD bump")

# ==================================================================== CSS: rescope the .pk family from
# "#sysDefDetail .pk..." to bare selectors - the modal (#defPickRows, inside #modal) is the only place this
# markup renders now, #sysDefDetail's OTHER rules (.detail/.dn/.de/p/.acts, the filled-slot path) untouched.
do(
    """#sysDefDetail .pk{margin-top:8px;border:1px solid var(--line);border-left:3px solid var(--a);
  border-radius:10px;padding:8px 10px;display:flex;gap:9px;align-items:flex-start;cursor:pointer}
#sysDefDetail .pk:first-child{margin-top:0}
#sysDefDetail .pk.dim{opacity:.42;cursor:not-allowed}
#sysDefDetail .pki{width:22px;height:22px;flex:none;border-radius:7px;display:grid;place-items:center;
  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a);font:700 10px/1 ui-monospace,monospace}
#sysDefDetail .pki svg{width:14px;height:14px;display:block}
#sysDefDetail .pkb{min-width:0;flex:1}
#sysDefDetail .pkn{font:700 11px/1.2 system-ui;color:var(--txt);display:flex;justify-content:space-between;gap:8px}
#sysDefDetail .pkn span{font:700 9.5px/1.2 ui-monospace,monospace;color:var(--dim)}
#sysDefDetail .pkg{font-size:10px;color:var(--dim);line-height:1.4;margin-top:2px}""",
    """/* patch631: no longer scoped to #sysDefDetail - the picker is a modal now
   (openDefPicker(), #defPickRows inside #modal), the only place this markup
   renders any more. */
.pk{margin-top:8px;border:1px solid var(--line);border-left:3px solid var(--a);
  border-radius:10px;padding:8px 10px;display:flex;gap:9px;align-items:flex-start;cursor:pointer}
.pk:first-child{margin-top:0}
.pk.dim{opacity:.42;cursor:not-allowed}
.pki{width:22px;height:22px;flex:none;border-radius:7px;display:grid;place-items:center;
  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a);font:700 10px/1 ui-monospace,monospace}
.pki svg{width:14px;height:14px;display:block}
.pkb{min-width:0;flex:1}
.pkn{font:700 11px/1.2 system-ui;color:var(--txt);display:flex;justify-content:space-between;gap:8px}
.pkn span{font:700 9.5px/1.2 ui-monospace,monospace;color:var(--dim)}
.pkg{font-size:10px;color:var(--dim);line-height:1.4;margin-top:2px}""",
    label=".pk family: rescope off #sysDefDetail",
)

# ==================================================================== JS: openDefPicker() - the modal
# itself, doing exactly what the old inline "pick" branch built, handed to showModal() instead, plus CANCEL.
do(
    "function renderDefDetail(s,slots){",
    '''/* patch631: tapping an EMPTY slot opens this instead of expanding #sysDefDetail
   inline - called directly, imperatively, from the slot's own tap handler in
   renderSysDef(), NEVER from render() (11Hz - must not be able to reopen a modal
   the player already dismissed). Same DEF_MODULES/DEF_COLOR/defIconHTML/
   dmodPrice calls and .pk/.pki/.pkb/.pkn/.pkg markup the old inline branch used -
   only the host changed. defSel keeps its usual {slot,mode} shape so the empty
   card underneath still shows its .sel highlight (defCardHTML(), unchanged)
   while the modal is open, cleared back to null on both exits. */
function openDefPicker(s,i){
  const price=dmodPrice(s,0), unit=s.res?exoDef(s.res).n.toUpperCase():"ORE";
  const rows=Object.keys(DEF_MODULES).map(id=>{
    const def=DEF_MODULES[id];
    const afford=s.res?exo(s.res)>=price:S.ore>=price;
    const usable=!def.disabled&&afford;
    const short = def.disabled?"Not available yet"
      : !afford?("Need "+fmt(price)+" "+unit+" \\u2014 short "+fmt(Math.max(0,price-(s.res?exo(s.res):S.ore)))+" "+unit)
      : def.guidance;
    return `<div class="pk${usable?"":" dim"}" data-m="${id}" style="--a:${DEF_COLOR[id]}">
      <div class="pki">${defIconHTML(id)}</div>
      <div class="pkb">
        <div class="pkn">${def.n}<span>${price} ${unit}</span></div>
        <div class="pkg">${short}</div>
      </div>
    </div>`;
  }).join("");
  /* showModal() (which sets #mask.on) has to run BEFORE the defSel+render() below -
     renderDefDetail()'s own self-heal check (see its comment) drops defSel the
     instant it sees "pick" without #mask.on, and #mask is not .on yet until this
     call returns; reversing this order would have the very first render() below
     undo the defSel this same function just set. */
  showModal(`<h3>Fit a module \\u2014 slot ${i+1}</h3>
    <div id="defPickRows">${rows}</div>
    <div class="row"><button id="defPickCancel">CANCEL</button></div>`,
    ()=>{
      $("#defPickCancel").onclick=()=>{ hideModal(); defSel=null; render(); };
      $("#defPickRows").querySelectorAll(".pk").forEach(el=>{
        el.onclick=()=>{
          const m=el.dataset.m, def=DEF_MODULES[m]; if(!def||def.disabled)return;
          const afford=s.res?exo(s.res)>=price:S.ore>=price;
          if(!afford)return;
          if(dmodBuild(s,i,m)){ hideModal(); defSel=null; render(); save(); }
        };
      });
    });
  defSel={slot:i,mode:"pick"}; render();
}
function renderDefDetail(s,slots){''',
    label="openDefPicker()",
)

# ==================================================================== JS: renderDefDetail() no longer owns
# the self-heal (see renderSysDef()'s own do() call below, and the docstring's item 2) - just a comment
# pointing at its new home, so a reader starting here isn't left wondering where it went.
do(
    '''function renderDefDetail(s,slots){
  const host=$("#sysDefDetail"); if(!host)return;
  if(!defSel){''',
    '''function renderDefDetail(s,slots){
  const host=$("#sysDefDetail"); if(!host)return;
  /* patch631: the stale-"pick"-after-a-backdrop-close self-heal used to live here -
     moved to the top of renderSysDef(), the one and only caller, so it lands
     before that function's own churn-guarded .sel class instead of one render()
     tick after it (see the comment there). defSel is already healed by the time
     this runs. */
  if(!defSel){''',
    label="renderDefDetail(): pointer comment to the self-heal's new home",
)

# ==================================================================== JS: the self-heal itself, moved to
# the TOP of renderSysDef() - the one and only caller of renderDefDetail() - so it runs before rowKey a few
# lines below, which bakes defSel into the empty card's own churn-guarded .sel class. A heal that runs after
# that guard (renderDefDetail() is called at the very end of renderSysDef()) lands one render() tick too
# late for .sel to notice on the same pass: reproduced via a real backdrop-tap-close followed by a single
# render() and a 30ms settle (no second ambient tick in that window at 390x844) - defSel read back null
# (healed) but the card's .sel class was still stuck true. Confirmed fixed the same way.
do(
    '''function renderSysDef(s){
  const wrap=$("#sysDefWrap"), head=$("#sysDefHead"), row=$("#sysDefRow");
  if(!wrap)return;
  if(s.home||!sysHeld(s.id)){''',
    '''function renderSysDef(s){
  const wrap=$("#sysDefWrap"), head=$("#sysDefHead"), row=$("#sysDefRow");
  if(!wrap)return;
  /* patch631 (moved here from renderDefDetail(), same render() pass this used to
     lag a tick behind): #mask's own generic backdrop-tap-to-close (see its own
     onclick, wired once near the other one-time wiring) closes ANY modal,
     including this one, without knowing defSel exists - self-heal here rather
     than teaching a generic handler about one feature's state. Has to run
     BEFORE rowKey below, which bakes defSel into the cards' own churn-guarded
     .sel class (renderDefDetail() ran after that guard, so the heal landed one
     render() tick too late for .sel to notice on the same pass - a real if
     brief stuck highlight). */
  if(defSel && defSel.mode==="pick" && !$("#mask").classList.contains("on")) defSel=null;
  if(s.home||!sysHeld(s.id)){''',
    label="renderSysDef(): self-heal stale pick-mode defSel (top of function)",
)

# ==================================================================== JS: renderDefDetail()'s "pick"
# branch - #sysDefDetail has nothing left to show for it, same cleanup as the !defSel branch above it.
do(
    """  if(defSel.mode==="pick"){
    const i=defSel.slot, key="pick|"+i;
    host.hidden=false;
    if(host.dataset.h!==key){
      host.dataset.h=key;
      const price=dmodPrice(s,0), unit=s.res?exoDef(s.res).n.toUpperCase():"ORE";
      host.innerHTML=Object.keys(DEF_MODULES).map(id=>{
        const def=DEF_MODULES[id];
        const afford=s.res?exo(s.res)>=price:S.ore>=price;
        const usable=!def.disabled&&afford;
        const short = def.disabled?"Not available yet"
          : !afford?("Need "+fmt(price)+" "+unit+" \\u2014 short "+fmt(Math.max(0,price-(s.res?exo(s.res):S.ore)))+" "+unit)
          : def.guidance;
        return `<div class="pk${usable?"":" dim"}" data-m="${id}" style="--a:${DEF_COLOR[id]}">
          <div class="pki">${defIconHTML(id)}</div>
          <div class="pkb">
            <div class="pkn">${def.n}<span>${price} ${unit}</span></div>
            <div class="pkg">${short}</div>
          </div>
        </div>`;
      }).join("");
      host.querySelectorAll(".pk").forEach(el=>{
        el.onclick=()=>{
          const m=el.dataset.m, def=DEF_MODULES[m]; if(!def||def.disabled)return;
          const price=dmodPrice(s,0), afford=s.res?exo(s.res)>=price:S.ore>=price;
          if(!afford)return;
          if(dmodBuild(s,i,m)){ defSel=null; render(); save(); }
        };
      });
    }
    return;
  }""",
    """  if(defSel.mode==="pick"){
    /* patch631: the picker is a modal now (openDefPicker(), opened imperatively
       from the slot's own tap handler - render() must never reopen it, it runs
       at 11Hz). This host has nothing left to show for "pick", same cleanup as
       the !defSel branch just above. */
    if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true }
    return;
  }""",
    label="renderDefDetail() pick branch -> no-op",
)

# ==================================================================== JS: renderSysDef()'s own .sc click
# wiring - an empty slot now opens the modal directly; a filled slot's mode==="detail" path is untouched.
do(
    """      row.querySelectorAll(".sc").forEach(el=>{
        el.onclick=()=>{
          const i=+el.dataset.slot, mode=el.dataset.empty?"pick":"detail";
          defSel=(defSel&&defSel.slot===i&&defSel.mode===mode)?null:{slot:i,mode};
          render();
        };
      });""",
    """      row.querySelectorAll(".sc").forEach(el=>{
        el.onclick=()=>{
          const i=+el.dataset.slot;
          if(el.dataset.empty){ openDefPicker(s,i); return; }   /* patch631: modal, opened here - never from render() */
          const mode="detail";
          defSel=(defSel&&defSel.slot===i&&defSel.mode===mode)?null:{slot:i,mode};
          render();
        };
      });""",
    label="renderSysDef() .sc wiring: empty slot -> openDefPicker()",
)

# ==================================================================== __SD export: openDefPicker, for
# direct test invocation - same precedent as resourceModal/hanModal already being exported.
do(
    "  renderSysDef,renderSysOdds,defCardPct,defBalanceLabel,defClearSel,get defSel(){return defSel},",
    "  renderSysDef,renderSysOdds,defCardPct,defBalanceLabel,defClearSel,get defSel(){return defSel},openDefPicker,",
    label="__SD export: openDefPicker",
)

assert h.count("const BUILD=633;") == 1
for dead in (
    "#sysDefDetail .pk", 'host.innerHTML=Object.keys(DEF_MODULES).map(id=>{\n        const def=DEF_MODULES[id];\n        const afford=s.res?exo(s.res)>=price:S.ore>=price;\n        const usable=!def.disabled&&afford;',
):
    assert dead not in h, f"dead code shape still present: {dead}"
assert "function openDefPicker(s,i){" in h
assert h.count('if(defSel && defSel.mode==="pick" && !$("#mask").classList.contains("on")) defSel=null;') == 1
# the self-heal lives in renderSysDef(), the one and only caller of renderDefDetail(), BEFORE that
# function's own rowKey-guarded rebuild of the cards (renderDefDetail() itself is called at the very end
# of renderSysDef() - a heal placed there instead would land one render() tick too late for the churn-
# guarded .sel class to notice on the same pass, see the do() call's own comment for the reproduction).
assert (h.index('function renderSysDef(s){')
        < h.index('if(defSel && defSel.mode==="pick" && !$("#mask").classList.contains("on")) defSel=null;')
        < h.index('"|sel="+(defSel?defSel.slot+":"+defSel.mode:"-")')
        < h.index('renderDefDetail(s,slots);\n}'))
# ordering: defSel={slot:i,mode:"pick"} must be set AFTER showModal(), not before - see openDefPicker()'s
# own comment for why (the self-heal check above would otherwise undo it on the spot).
assert h.index('function openDefPicker(s,i){') < h.index('showModal(`<h3>Fit a module') < h.index('defSel={slot:i,mode:"pick"}; render();\n}')
assert h.count('id="defPickRows"') == 1 and h.count('id="defPickCancel"') == 1
assert '.pk{margin-top:8px' in h
assert 'if(el.dataset.empty){ openDefPicker(s,i); return; }' in h
# renderDefDetail()'s pick branch collapsed to a no-op - confirm the OLD inline-building shape is gone but
# the function itself (and the filled-slot "detail" branch right after it) are still intact.
assert 'const i=defSel.slot, key="pick|"+i;' not in h
assert 'function renderDefDetail(s,slots){' in h
assert 'const i=defSel.slot, slot=slots[i];' in h   # the untouched "detail" branch, right after "pick"

with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch631 applied OK")
