#!/usr/bin/env python3
"""
patch610 (BUILD 610) - PLAN-unify.md Run 2, item 1: the BUILDINGS section in the sheet.

New #sysBuild sits between #sysAct and #sysOdds (#sysAct renders empty for every held
system - the only ones #sysBuild shows for - so visually this reads as "right under
#sysInfo", matching the plan's own wording and shots/unify-1-map-koru.png). Header row
("Buildings" / "n of m tiers") reuses #sysDefHead's exact declaration (font/case/margin/
flex) so BUILDINGS and DEFENCES read as one family, exactly like the mock. The buy chips
(x1/x10/x100/MAX) move into that header, as their own .buybar row underneath the label
line - putting all three (label, count, four chips) on one 390px line does not fit
(measured), so the chips get their own line INSIDE the section header block rather than
sitting back up in the old Empire tab. They are static markup (not rebuilt by
renderSysBuild()), so the one-time `$$(".chip[data-b]")` wiring at the bottom of the file
picks them up exactly like the Raids-fleet and Market buybars already are - same
syncChips(), same S.buy, same nothing-else-touched.

Rows are ladderTierRow(sysId,gi,isNext) - completely unchanged, copied verbatim from
empSysRow()'s own body loop (owned tiers, then the one next tier, then stop). It already
pushes into empSlotEls, and render()'s own updateEmpBars() call (line ~5623) is already
OUTSIDE the `if(dirty)` gate - it runs every tick regardless of what rebuilds - so
affordability/price-bar liveness for these rows costs nothing extra to wire: the existing
per-tick pass just keeps doing its job on whatever is currently in empSlotEls. What
changes is WHO populates empSlotEls: renderGens() (the accordion, now hidden behind
patch608's .legacyhide and dead until patch612 deletes it outright) is no longer called
from render()'s dirty branch, so it can no longer race renderSysBuild() over the same
array - only one system's sheet is ever open at a time, so renderSysBuild() does the same
"reset then rebuild" empSlotEls dance renderGens() used to, just scoped to one system.

Rebuild guard: dataset.h on "sysId|per-tier owned counts|S.buy|next gi" - any real change
(a buy landing, a buy-chip tap, opening a different system) rebuilds the rows; ore ticking
up between those does not (that is updateEmpBars()'s job, not this one's) - same idiom
#sysDefRow already uses one section down.

Held systems (home included) only - an unclaimed system has nothing built yet.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# --- BUILD bump ---
do("const BUILD=609;", "const BUILD=610;", label="BUILD bump")

# --- markup: #sysBuild between #sysAct and #sysOdds ---
do(
    '          <div id="sysAct"></div>\n'
    '          <div id="sysOdds" hidden></div>\n',
    '          <div id="sysAct"></div>\n'
    '          <div id="sysBuild" hidden>\n'
    '            <div id="sysBuildHead"><span>Buildings</span><span id="sysBuildCount"></span></div>\n'
    '            <div class="buybar">\n'
    '              <button class="chip on" data-b="1">×1</button>\n'
    '              <button class="chip" data-b="10">×10</button>\n'
    '              <button class="chip" data-b="100">×100</button>\n'
    '              <button class="chip" data-b="max">MAX</button>\n'
    '            </div>\n'
    '            <div id="sysBuildRows"></div>\n'
    '          </div>\n'
    '          <div id="sysOdds" hidden></div>\n',
    label="sysBuild markup",
)

# --- CSS: header row, same family as #sysDefHead ---
do(
    "#sysDefHead{font:600 9.5px/1 system-ui;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;\n"
    "  margin:14px 0 7px;display:flex;justify-content:space-between;gap:8px}\n",
    "#sysDefHead{font:600 9.5px/1 system-ui;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;\n"
    "  margin:14px 0 7px;display:flex;justify-content:space-between;gap:8px}\n"
    "/* patch610: BUILDINGS is the same header family as DEFENCES just above - same\n"
    "   font/case/colour/spacing, so the sheet reads as one set of sections, not two\n"
    "   different styles bolted together. */\n"
    "#sysBuild[hidden]{display:none}\n"
    "#sysBuildHead{font:600 9.5px/1 system-ui;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;\n"
    "  margin:2px 0 7px;display:flex;justify-content:space-between;gap:8px}\n",
    label="sysBuildHead CSS",
)

# --- JS: renderSysBuild(), placed right before renderSysDef() so BUILDINGS/DEFENCES sit
#     next to each other in source the same way they sit next to each other on screen ---
do(
    "function renderSysDef(s){\n",
    "/* patch610 - the BUILDINGS section: this system's own ladder, same .g rows the old\n"
    "   accordion always used (ladderTierRow() untouched, see its own header comment).\n"
    "   Held systems and home only - nothing built yet on an unclaimed one. Rebuild guard\n"
    "   mirrors #sysDefRow's own dataset.h idiom one section down: a real change to what\n"
    "   the rows should say (a buy landing, a buy-chip tap, a different system opened)\n"
    "   rebuilds; ore ticking up between those doesn't (updateEmpBars(), every tick,\n"
    "   unconditionally - see render()). Only one system's sheet is ever open, so this\n"
    "   does the same reset-then-rebuild empSlotEls used to get from renderGens() every\n"
    "   dirty tick, just scoped to the one system on screen instead of all of them. */\n"
    "function renderSysBuild(s,held){\n"
    "  const wrap=$(\"#sysBuild\"), rowsHost=$(\"#sysBuildRows\"), countEl=$(\"#sysBuildCount\");\n"
    "  if(!wrap||!rowsHost)return;\n"
    "  if(!held){\n"
    "    wrap.hidden=true;\n"
    "    if(rowsHost.dataset.h!==\"\"){ rowsHost.dataset.h=\"\"; rowsHost.innerHTML=\"\"; }\n"
    "    return;\n"
    "  }\n"
    "  wrap.hidden=false;\n"
    "  const ladder=sysLadder(s.id);\n"
    "  const owned=ladder.filter(gi=>sysTierCount(s.id,gi)>0).length;\n"
    "  const countTxt=owned+\" of \"+ladder.length+\" tiers\";\n"
    "  if(countEl&&countEl.textContent!==countTxt)countEl.textContent=countTxt;\n"
    "  let nextGi=null;\n"
    "  for(const gi of ladder){ if(sysTierCount(s.id,gi)<=0){ nextGi=gi; break; } }\n"
    "  const key=s.id+\"|\"+ladder.map(gi=>sysTierCount(s.id,gi)).join(\",\")+\"|\"+S.buy+\"|\"+nextGi;\n"
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
    "}\n"
    "function renderSysDef(s){\n",
    label="renderSysBuild def",
)

# --- call site: clear #sysBuild when the sheet closes (mirrors the #sysOdds/#sysDefWrap clears right beside it) ---
do(
    '    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }\n'
    '    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n',
    '    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }\n'
    '    const buildWrap=$("#sysBuild");\n'
    '    if(buildWrap&&!buildWrap.hidden){\n'
    '      buildWrap.hidden=true;\n'
    '      const rowsHost=$("#sysBuildRows"); if(rowsHost){ rowsHost.dataset.h=""; rowsHost.innerHTML=""; }\n'
    '    }\n'
    '    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n',
    label="sysBuild close clear",
)

# --- call site: render it on open, right after `held` is known ---
do(
    '  if(sheet)sheet.classList.add("open");\n'
    '  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;\n'
    '  let rows="";\n',
    '  if(sheet)sheet.classList.add("open");\n'
    '  const held=s.home||sysHeld(s.id), e=s.res?exoDef(s.res):null;\n'
    '  renderSysBuild(s,held);\n'
    '  let rows="";\n',
    label="renderSysBuild call site",
)

# --- render(): stop calling the old accordion - see patch610's own header comment.
#     renderGens() itself is left in place (dead code) until patch612 deletes it outright,
#     matching PLAN-unify.md's own item list for that patch. ---
do(
    "  if(dirty){ dirty=false; renderGens(); renderRes(); renderProg(); renderNex(); renderMis(); renderAch(); renderRaids(); renderArmoury(); }\n",
    "  /* patch610: renderGens() (the old Empire accordion) is no longer called - its\n"
    "     job is renderSysBuild() now, called from renderMap() itself right after the\n"
    "     sheet's own held/e computation, same place empSysRow() used to build the row\n"
    "     that is now these same ladderTierRow()s inline in the sheet. The function\n"
    "     stays defined (dead) until patch612 deletes it with the rest of the widget. */\n"
    "  if(dirty){ dirty=false; renderRes(); renderProg(); renderNex(); renderMis(); renderAch(); renderRaids(); renderArmoury(); }\n",
    label="render() drops renderGens call",
)

assert h.count("const BUILD=610;") == 1

open(PATH, "w", encoding="utf-8").write(h)
print("patch610 applied OK")
