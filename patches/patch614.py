#!/usr/bin/env python3
"""
patch614 (BUILD 615) - Run 3, item 1: MAP | LIST toggle (PLAN-unify.md).

Adds a session-only mapMode ("map"/"list") sub-toggle to the Map tab, same
.rmode/.rmbtn pattern as resMode/raidMode. LIST replaces the map square with
rows for sysInSec(mapSec): held rows in the kind-tinted .sysrow2 style (name,
kind badge, exotic, n/m tiers, ore/s, exotic/s, a green NEXT TIER READY badge
when ladderCost(id,sysNextGi(id),1)<=S.ore), claimable/contested/locked rows
in the plain .sysrow2 style. Row tap = node tap (same S.msel/setMapZoom() call
the map node itself uses), and always drops back to mapMode="map" so the
toggle being hidden while zoomed can never strand the player in list mode.
The toggle itself is hidden while zoomed, same rule as the sector chips.

DEVIATION FROM THE PLAN, FLAGGED PER THE COORDINATOR'S REQUEST:
The plan text says "Reuse empSysRow()'s markup... that function still exists
even though nothing calls it since 612." It does not - patch612 deleted the
function outright (grep confirms only three prose comments reference the name
now). Its markup was recovered verbatim from patch612.py's own do() call (the
"old" argument, which still holds the full deleted source) rather than read
live, and is reused here for the claimable/contested/locked branch unchanged.
The held branch is NEW (not a straight port): the original held branch was an
expandable accordion header (empOpen/empAccordionTap) - explicitly NOT wanted
here ("must NOT be expandable - a tap is the same as tapping the node") - so
only its row markup (name/kind badge/tier count/ore/exotic rate, the --a-*
custom-property tinting) is reused; the accordion body and its open/expanded
state are dropped, and the NEXT TIER READY badge (not present in the original
function at all) is added per the coordinator's spec.

The approved mock shots/unify-3-empire-new.png also did not survive contact
with the code as-is: it groups rows under ring headers ("SOL REACH"/"RING 1"/
"RING 2"), a layout from before the sector-page redesign (patch566-569). The
plan's own current text calls for sysInSec(mapSec) - a flat, current-sector
list, no ring grouping - which is what this patch implements; only the mock's
ROW STYLE (colors, badges, stat layout, the NEXT TIER READY badge) is used as
the visual reference, not its grouping structure.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=614;", "const BUILD=615;", label="BUILD bump")

# ==================================================================== CSS

do(
    "#p-map.zoomed #mapChips{display:none}\n",
    "#p-map.zoomed #mapChips{display:none}\n"
    "/* patch614: the MAP | LIST toggle hides on the same rule, for the same reason -\n"
    "   the sheet already covers most of the square while zoomed, and there is nothing\n"
    "   to toggle to \"list\" for the one system already on screen. */\n"
    "#p-map.zoomed #mapMode{display:none}\n"
    "#mapMode.rmode{margin-bottom:10px}\n"
    "/* patch614: LIST replaces the map square one-for-one, same vertical slot -\n"
    "   #mapWrap and #mapList are never both visible, syncMapMode() below toggles\n"
    "   [hidden] on whichever one isn't current. */\n"
    "#mapList{display:flex;flex-direction:column;margin-bottom:10px}\n"
    "#mapList[hidden]{display:none}\n",
    label="mapMode/mapList CSS",
)

# ==================================================================== markup

do(
    '        <div id="mapChips"></div>\n'
    '        <div id="mapWrap">',
    '        <div id="mapChips"></div>\n'
    '        <!-- patch614: session-only MAP | LIST sub-toggle, same .rmode/.rmbtn\n'
    '             pattern as #resMode/#raidMode - see mapMode/syncMapMode(). -->\n'
    '        <div id="mapMode" class="rmode">\n'
    '          <button class="rmbtn on" data-mm="map">MAP</button>\n'
    '          <button class="rmbtn" data-mm="list">LIST</button>\n'
    '        </div>\n'
    '        <div id="mapWrap">',
    label="mapMode toggle markup",
)

do(
    '          <div id="mapZoomBar"><button type="button" id="mapZoomBack">&lsaquo; MAP</button><div id="mapZoomName"></div></div></div>\n'
    '        <div id="sysSheet">',
    '          <div id="mapZoomBar"><button type="button" id="mapZoomBack">&lsaquo; MAP</button><div id="mapZoomName"></div></div></div>\n'
    '        <div id="mapList" hidden></div>\n'
    '        <div id="sysSheet">',
    label="mapList container markup",
)

# ==================================================================== JS: state + sync

do(
    'let raidMode="targets";       /* which sub-tab of the Raids tab is showing. Session-only,\n'
    '                                  same reasoning as resMode above. */\n',
    'let raidMode="targets";       /* which sub-tab of the Raids tab is showing. Session-only,\n'
    '                                  same reasoning as resMode above. */\n'
    'let mapMode="map";            /* patch614: "map" or "list" - which half of the Map tab is\n'
    '                                  showing. Session-only, same reasoning as resMode/raidMode -\n'
    '                                  never saved, always opens on the map itself. */\n',
    label="mapMode declaration",
)

do(
    "function syncRaidMode(){\n"
    '  $$(".rmbtn[data-rd]").forEach(x=>x.classList.toggle("on",x.dataset.rd===raidMode));\n'
    "  for(const k in RAID_PANES){ const el=$(RAID_PANES[k]); if(el)el.hidden=(k!==raidMode); }\n"
    "}\n",
    "function syncRaidMode(){\n"
    '  $$(".rmbtn[data-rd]").forEach(x=>x.classList.toggle("on",x.dataset.rd===raidMode));\n'
    "  for(const k in RAID_PANES){ const el=$(RAID_PANES[k]); if(el)el.hidden=(k!==raidMode); }\n"
    "}\n"
    "/* patch614: mirrors syncResMode()/syncRaidMode() - toggles the two buttons plus which\n"
    "   of #mapWrap/#mapList is visible. Rows themselves are renderMapList()'s job, called\n"
    "   from renderMap() every pass (own key-guard, see there) - this just decides which\n"
    "   panel is on screen. */\n"
    "function syncMapMode(){\n"
    '  $$(".rmbtn[data-mm]").forEach(x=>x.classList.toggle("on",x.dataset.mm===mapMode));\n'
    '  const wrap=$("#mapWrap"), list=$("#mapList");\n'
    '  if(wrap)wrap.hidden = mapMode==="list";\n'
    '  if(list)list.hidden = mapMode!=="list";\n'
    "}\n",
    label="syncMapMode()",
)

# ==================================================================== JS: row builders + renderMapList()

do(
    "function renderMap(){\n",
    "/* patch614: rows for the LIST sub-view - sysInSec(mapSec), unheld branch recovered\n"
    "   verbatim from patch612.py's own deleted empSysRow() (see this file's header\n"
    "   note), held branch a new non-expandable variant of the same row (no accordion -\n"
    "   \"a tap is the same as tapping the node\", never mind that empSysRow()'s accordion\n"
    "   is gone anyway). Every row's tap does exactly what a map-node tap does\n"
    "   (buildMap()'s own b.onclick, unchanged) plus drops back to mapMode=\"map\", so\n"
    "   #mapMode being hidden while zoomed can never strand the player in list mode -\n"
    "   the only way INTO list mode is the toggle itself, and the only way it flips to\n"
    "   list also clears any zoom (see the button wiring at the bottom of the file). */\n"
    "function mapNodeTapEquivalent(id){\n"
    '  S.msel=id; setMapZoom((sysHeld(id)||sysOccupied(id))?id:null);\n'
    '  mapMode="map"; syncMapMode();\n'
    '  dirty=true; render();\n'
    "}\n"
    "/* claimable / contested / locked row - patch612.py's empSysRow(), unheld branch,\n"
    "   verbatim (DOM-construction style kept as-is), only the onclick swapped for the\n"
    "   node-tap-equivalent above (the original called gotoTab(\"p-map\") because it lived\n"
    "   on the old Empire tab; LIST is already on the map, so there is nowhere to go). */\n"
    "function listOpenRow(s){\n"
    "  const id=s.id;\n"
    "  const claimable=sysOpen(s);\n"
    "  const contested=sysContested(s) && level()>=s.lvl;\n"
    '  const el=document.createElement("div");\n'
    "  if(claimable){\n"
    '    el.className="sysrow2 claimable";\n'
    '    el.innerHTML=`<div class="sysrow2-main">\n'
    '        <span class="sysname">${s.n}</span>\n'
    '        <span class="kindbadge" style="--a:var(--gr)">CLAIM READY</span></div>\n'
    '      <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span><span><b>${fmt(s.cost)}</b> ORE</span></div>`;\n'
    "  } else if(contested){\n"
    "    const rv=RIVALMAP[sysOwner(s)], at=assaultTarget(s);\n"
    "    const occ=sysOccupied(id), weak=occ&&occWeakMul(id)<1;\n"
    '    el.className="sysrow2 contested"+(occ?" occ":"");\n'
    '    el.innerHTML=`<div class="sysrow2-main">\n'
    '        <span class="rivalmark" style="--a:${rv.col}" title="${rv.n}">${occ?"\\u26e8":"\\u2694"}</span>\n'
    '        <span class="sysname">${s.n}</span>\n'
    '        <span class="kindbadge" style="--a:var(--rd)">${occ?"RETAKE":"INVADE"}</span></div>\n'
    '      <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span>\n'
    '        <span style="color:${rv.col}">${rv.n.toUpperCase()}</span>\n'
    '        <span><b>${at.en}</b> SHIPS \\u00b7 \\u00d7${fmt(s.def)}${weak?" \\u00b7 WEAKENED":""}</span></div>`;\n'
    "  } else {\n"
    '    el.className="sysrow2 locked";\n'
    '    el.innerHTML=`<div class="sysrow2-main"><span class="lockicon">\\ud83d\\udd12</span>\n'
    '        <span class="sysname">${s.n}</span></div>\n'
    '      <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span><span>${fmt(s.cost)} ORE</span></div>`;\n'
    "  }\n"
    "  el.onclick=()=>mapNodeTapEquivalent(id);\n"
    "  return el;\n"
    "}\n"
    "/* held row - kind-tinted, NOT expandable (see header note). New markup, not a\n"
    "   port: the original empSysRow() held branch built an accordion header\n"
    "   (empOpen/empAccordionTap, both gone) - only its stat line and the five --a-*\n"
    "   custom properties (KIND_INFO tinting, same as the sheet's own held-row CSS\n"
    "   comment) are reused, plus a NEXT TIER READY badge the original never had. */\n"
    "let mapListEls=[];\n"
    "function listHeldRow(s){\n"
    "  const id=s.id;\n"
    "  const kind=KIND_INFO[s.kind]||KIND_INFO.mixed;\n"
    "  const ladder=sysLadder(id);\n"
    "  const owned=ladder.filter(gi=>sysTierCount(id,gi)>0).length;\n"
    "  const ex=s.res?exoDef(s.res):null;\n"
    "  const nextGi=sysNextGi(id);\n"
    '  const el=document.createElement("div");\n'
    '  el.className="sysrow2 held kindtint";\n'
    '  el.style.setProperty("--a",kind.col);\n'
    '  el.style.setProperty("--a-wash","rgba("+kind.rgb+",.12)");\n'
    '  el.style.setProperty("--a-wash-body","rgba("+kind.rgb+",.06)");\n'
    '  el.style.setProperty("--a-border","rgba("+kind.rgb+",.55)");\n'
    '  el.style.setProperty("--a-text",kind.txt);\n'
    '  el.innerHTML=`<div class="sysrow2-main">\n'
    '      <span class="sysname">${s.n}</span>\n'
    '      <span class="kindbadge" style="--a:${kind.col}">${kind.n}</span>\n'
    '      <span class="kindbadge ready" style="--a:var(--gr)" hidden>\\u25cf NEXT TIER READY</span></div>\n'
    '    <div class="sysrow2-stats">\n'
    '      <span>${ex?ex.n.toUpperCase():"\\u2014"}</span>\n'
    '      <span><b>${owned}/${ladder.length}</b> TIERS</span>\n'
    '      <span><b>${fmt(sysOreRate(id))}</b> ORE/S</span>\n'
    '      ${ex?`<span><b>${fmt(sysExoRate(id))}</b> ${ex.n.toUpperCase()}/S</span>`:""}\n'
    "    </div>`;\n"
    "  el.onclick=()=>mapNodeTapEquivalent(id);\n"
    "  mapListEls.push({el,sysId:id,nextGi});\n"
    "  return el;\n"
    "}\n"
    "function listSysRow(s){ return (s.home||sysHeld(s.id)) ? listHeldRow(s) : listOpenRow(s); }\n"
    "/* patch614: rebuilt only when the key actually changes - same dataset.h idiom as\n"
    "   every other rebuild-guarded block in this file (renderSysBuild, renderMapChips,\n"
    "   ...). Deliberately excludes S.ore (which changes every frame) - the live NEXT\n"
    "   TIER READY affordability check is updated separately, per row, from\n"
    "   updateEmpBars() (mapListEls), the same split renderSysBuild()/ladderTierRow()\n"
    "   already use for their own \"can afford\" state. */\n"
    "function renderMapList(){\n"
    '  const host=$("#mapList"); if(!host)return;\n'
    '  if(mapMode!=="list")return;\n'
    "  const list=sysInSec(mapSec);\n"
    '  const key=mapSec+"|"+list.map(s=>{\n'
    "    if(s.home||sysHeld(s.id)){\n"
    "      const ladder=sysLadder(s.id);\n"
    '      return s.id+"h"+ladder.map(gi=>sysTierCount(s.id,gi)>0?1:0).join("");\n'
    "    }\n"
    "    const claimable=sysOpen(s), contested=sysContested(s)&&level()>=s.lvl;\n"
    '    return s.id+(claimable?"c":contested?"w"+(sysOccupied(s.id)?1:0):"l");\n'
    '  }).join("|");\n'
    "  if(host.dataset.h===key)return;\n"
    "  host.dataset.h=key;\n"
    "  mapListEls=[];\n"
    '  host.innerHTML="";\n'
    "  for(const s of list)host.appendChild(listSysRow(s));\n"
    "}\n"
    "function renderMap(){\n",
    label="listSysRow/renderMapList",
)

do(
    "  renderMapChips();\n",
    "  renderMapChips();\n"
    "  renderMapList();\n",
    label="renderMapList() call site",
)

# ==================================================================== JS: live NEXT TIER READY badge

do(
    "  for(const p of resProgEls){\n",
    "  /* patch614: same split as the .g rows above - the rebuild guard in\n"
    "     renderMapList() excludes S.ore, so the badge's own live affordability check\n"
    "     runs here, every frame, same as ladderTierRow()'s \"ok\" class just above. */\n"
    "  for(const {el,sysId,nextGi} of mapListEls){\n"
    "    if(!el.isConnected)continue;\n"
    '    const badge=el.querySelector(".ready");\n'
    "    if(badge)badge.hidden = !(nextGi!=null && ladderCost(sysId,nextGi,1)<=S.ore);\n"
    "  }\n"
    "  for(const p of resProgEls){\n",
    label="updateEmpBars() NEXT TIER READY loop",
)

# ==================================================================== JS: toggle wiring

do(
    "  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,mapZoomMeasure,get mzVisFrac(){return mzVisFrac},\n",
    "  get mapZoom(){return mapZoom},setMapZoom,drawSysScene,sprite,mapZoomMeasure,get mzVisFrac(){return mzVisFrac},\n"
    "  get mapMode(){return mapMode},syncMapMode,renderMapList,\n",
    label="window.__SD export: mapMode/syncMapMode/renderMapList",
)

do(
    '$$(".rmbtn[data-rd]").forEach(b=>b.onclick=()=>{\n'
    "  raidMode=b.dataset.rd; syncRaidMode(); dirty=true; render();\n"
    "});\n",
    '$$(".rmbtn[data-rd]").forEach(b=>b.onclick=()=>{\n'
    "  raidMode=b.dataset.rd; syncRaidMode(); dirty=true; render();\n"
    "});\n"
    "/* patch614: switching TO list always clears any zoom first - together with\n"
    "   mapNodeTapEquivalent() above always setting mapMode back to \"map\", this keeps\n"
    '   "zoomed \\u21d2 mapMode===\\"map\\"" true at all times, which is what makes\n'
    "   #p-map.zoomed #mapMode{display:none} safe (the toggle can never be hidden while\n"
    "   list mode is what's actually on screen). */\n"
    '$$(".rmbtn[data-mm]").forEach(b=>b.onclick=()=>{\n'
    '  mapMode=b.dataset.mm;\n'
    '  if(mapMode==="list")setMapZoom(null);\n'
    "  syncMapMode(); dirty=true; render();\n"
    "});\n",
    label="mapMode toggle wiring",
)

assert h.count("const BUILD=615;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch614 applied OK")
