#!/usr/bin/env python3
"""
patch613 - PLAN-unify.md Run 2, item 5: tests.

Not a BUILD-bump patch (it touches tests/, not stellar-dominion-empire2.html), but kept
as an anchor-asserted script like every other patch for the same reason: a reproducible,
readable record of exactly what changed and why, and a script that leaves every file it
touches untouched if any assertion fails partway through.

Retires tcore2.js and torbfollow2.js to tests/retired/ (both test the #core/#orb widget
patch612 deleted outright - nothing left to run them against). Updates, for the missing
#p-emp / new tab order / level-8 reveal:
  - tmap2.js: the old accordion-row icon check and the two #gens/#exoStrip/p-emp-tab
    blocks are rewritten onto the sheet's own #sysBuildRows (patch610) - same coverage
    (a ladder tier renders a real icon; building a tier through the UI raises yield),
    same-tab now that the sheet is what Map opens.
  - tsheet2.js: "Empire tab row -> Map" tested navigating FROM a separate Empire list
    tab - that list (patch614, Run 3) does not exist yet, so the scenario itself has no
    current UI to drive. Dropped, not faked; Run 3's tunify2.js is where this comes back.
  - tlockstates2.js: rewritten onto .mnode's own locked/open/foe classes and the sheet's
    info text (Garrison/Archetype/Claim cost/HELD BY) instead of #gens .sysrow2 - the
    exact same three states, read off the only UI that still shows them.
  - tscrolldevfix2.js: empAccordionTap() (its entire subject) is gone. Rewritten onto
    patch611's own scroll-preserve-across-rebuild in renderSysBuild() - the direct
    successor mechanism for "a rebuild must not move the scroll position", now scoped
    to the sheet instead of the accordion.
  - tchurn2.js: the two 'Empire (...)' checks drove #gens rows that no longer exist;
    replaced with 'Map (... sheet open, buildings shown)' checks, per the plan's own
    "Watch for" note that tchurn2 now samples the sheet's buy buttons.
  - tprogresearch2.js: one assertion ("Empire #gens carries no programme rows") went
    vacuously true the moment #gens itself stopped existing - reworded to assert #gens
    itself is gone, the actually-meaningful version of the same claim.
  - ttree2.js: pointed at the wrong file entirely (stellar-dominion.html, the frozen
    shipped build) and read #core, which real empire2 no longer has - repointed to
    empire2 and its dead #core reads dropped.
  - tzoom2.js: "leaving Map tab closes zoom" called gotoTab('p-emp') - a silent no-op
    now (gotoTab only clicks a `.tab[data-p=...]` it can find), so the tab never
    actually changed and the zoom never actually closed - not a zoom regression, a
    stale target. Repointed to Missions, a tab that still exists.
  - ttaborder2.js: expected order still had p-emp first; the map has been first (labeled
    Empire) since patch608, and p-emp itself is gone since patch612.
  - tmapoverlap2.js: "every SYS[] entry belongs to exactly one sector page" summed nodes
    across all 5 sector pages at the fixture's default (level 1) - and patch609's own
    level-8 reveal (Run 1) means only Sol Reach renders below that level, so the total
    was never going to reach SYS.length. Raising the fixture's level past 8 makes this
    the real coverage it was meant to be, not a permanent known-fail.

NOT touched: tnodes2.js and ttelegraph2.js. Both cover real, still-defined functions
(renderExoStrip()/#exoStrip, renderLiveFleet()/#lfBanner) whose only DOM anchors lived
inside #p-emp and vanished with it - not on the plan's own item-612 list, and neither
patch610 nor patch612 gave either feature a new home. Flagged for the coordinator in the
report rather than decided here, per "nothing else gets retired without asking me" and
"if something cannot reach 0, stop and report rather than weakening the test."
"""

import shutil

TESTS = "/home/claude/tests"

_cache = {}


def load(name):
    if name not in _cache:
        with open(f"{TESTS}/{name}", encoding="utf-8") as f:
            _cache[name] = f.read()
    return _cache[name]


def do(name, anchor, new, count=1, label=None):
    h = load(name)
    n = h.count(anchor)
    assert n == count, f"[{name}] anchor count {n} != {count} for {label or anchor[:60]!r}"
    _cache[name] = h.replace(anchor, new, count)


# ==================================================================== retirements
shutil.move(f"{TESTS}/tcore2.js", f"{TESTS}/retired/tcore2.js")
shutil.move(f"{TESTS}/torbfollow2.js", f"{TESTS}/retired/torbfollow2.js")

# ==================================================================== tmap2.js
do(
    "tmap2.js",
    "     everySectorInBounds: G.SECTORS.every((sc,i)=>{ const n=G.sysInSec(i).length; return n>=4&&n<=6 }),\n",
    "     // patch613: raw SYS[].sec counts, not sysInSec(i) - that reads the level-8\n"
    "     // reveal (PLAN-unify.md item 5) too, and this fixture runs at a fresh save's\n"
    "     // default level. This assertion is about the SECTORS data definition itself,\n"
    "     // not what a low-level save currently has revealed - sysInSec()'s own gating\n"
    "     // gets its dedicated coverage below, in the sector-page UI section.\n"
    "     everySectorInBounds: G.SECTORS.every((sc,i)=>{ const n=G.SYS.filter(s=>s.sec===i).length; return n>=4&&n<=6 }),\n",
    label="tmap2 sector-bounds check off the level-gated reveal",
)
do(
    "tmap2.js",
    '   const G=__SD;\n'
    "   G.adopt({...G.fresh(), all:1e30, lvl:40, lvSeen:99, ore:1e30, sys:{kor:{dev:0,b:{14:1}}}});\n"
    "   G.gotoTab('p-emp'); dirty=true; render();\n"
    "   const row=[...document.querySelectorAll('#gens .sysrow2.held')].find(r=>r.textContent.includes('Koru'));\n"
    "   if(row)row.click();\n"
    "   const svg=document.querySelector('#gens .g .gi svg');\n",
    '   const G=__SD;\n'
    "   G.adopt({...G.fresh(), all:1e30, lvl:40, lvSeen:99, ore:1e30, sys:{kor:{dev:0,b:{14:1}}}, msel:'kor'});\n"
    "   G.gotoTab('p-map'); dirty=true; render();\n"
    "   const svg=document.querySelector('#sysBuildRows .g .gi svg');\n",
    label="tmap2 icon test onto the sheet",
)
do(
    "tmap2.js",
    " ok('a kind-ladder tier renders a real, reused icon (no crash on the higher index)',\n"
    "    iconRow.hasSvg&&iconRow.hasPaths, iconRow);\n"
    "\n"
    " // ---------- claiming\n",
    " ok('a kind-ladder tier renders a real, reused icon (no crash on the higher index)',\n"
    "    iconRow.hasSvg&&iconRow.hasPaths, iconRow);\n"
    " // patch613: the icon check above opens the sheet (msel:'kor') and stays on the map\n"
    " // tab to read it - close it before the sections below, which click real map nodes\n"
    " // that the open sheet would otherwise sit on top of and intercept the click.\n"
    " await p.evaluate(()=>{ __SD.S.msel=null; dirty=true; render(); });\n"
    " await p.waitForTimeout(150);\n"
    "\n"
    " // ---------- claiming\n",
    label="tmap2 closes the sheet before the claiming section",
)
do(
    "tmap2.js",
    " // ---------- the page\n"
    " await p.evaluate(()=>{ const G=__SD;\n"
    "   G.adopt({...G.fresh(), all:5e12, lvl:26, lvSeen:99, ore:9e11,\n"
    "     sys:{kor:{dev:1}}, exo:{ir:20}}); });\n"
    " await p.waitForTimeout(400);\n"
    " await p.click('.tab[data-p=\"p-map\"]'); await p.waitForTimeout(500);\n"
    " // patch415/416: the exotic counters and the development programmes moved to the\n"
    " // Empire tab (programmes as accordion rows inside #gens, patch416). The map keeps\n"
    " // positions, claim/scan, rivals, raids - nothing that reads a resource number.\n"
    " const relocated=await p.evaluate(()=>({\n"
    "   stripInMap:!!document.querySelector('#p-map #exoStrip'),\n"
    "   progRowInMap:!!document.querySelector('#p-map [data-sys^=\"x:\"]')\n"
    " }));\n"
    " ok('the exotic strip is no longer on the map', !relocated.stripInMap, relocated);\n"
    " ok('no programme row renders on the map', !relocated.progRowInMap, relocated);\n",
    " // ---------- the page\n"
    " await p.evaluate(()=>{ const G=__SD;\n"
    "   G.adopt({...G.fresh(), all:5e12, lvl:26, lvSeen:99, ore:9e11,\n"
    "     sys:{kor:{dev:1}}, exo:{ir:20}}); });\n"
    " await p.waitForTimeout(400);\n"
    " await p.click('.tab[data-p=\"p-map\"]'); await p.waitForTimeout(500);\n"
    " // patch612: the old Empire accordion tab (#p-emp, #gens, #exoStrip) is gone\n"
    " // outright - one tab is the map now. Confirms the deletion is total, not a hide.\n"
    " const relocated=await p.evaluate(()=>({\n"
    "   pEmpGone:!document.getElementById('p-emp'),\n"
    "   gensGone:!document.getElementById('gens')\n"
    " }));\n"
    " ok('the old Empire pane (#p-emp) no longer exists', relocated.pEmpGone, relocated);\n"
    " ok('its accordion list (#gens) no longer exists', relocated.gensGone, relocated);\n",
    label="tmap2 drops the p-emp relocation block",
)
do(
    "tmap2.js",
    " // patch415/416: the strip (now one compact row, patch416) lives on the Empire tab.\n"
    " // Stage 1 (v3, patch429) moved the programme cards off Empire and onto the Research\n"
    " // tab, so the exotic this save banked (exo:{ir:20}) no longer gets a row of its own\n"
    " // here - Sol Reach is the first (and only) thing inside #gens now.\n"
    " await p.click('.tab[data-p=\"p-emp\"]'); await p.waitForTimeout(300);\n"
    " const empStrip=await p.evaluate(()=>({\n"
    "   dots:document.querySelectorAll('#exoStrip .exi').length,\n"
    "   held:document.querySelectorAll('#exoStrip .exi.held').length,\n"
    "   aboveGens:(()=>{ const pane=document.querySelector('#p-emp');\n"
    "     const kids=[...pane.children].map(c=>c.id);\n"
    "     return kids.indexOf('exoStrip')>=0 && kids.indexOf('exoStrip')<kids.indexOf('gens'); })(),\n"
    "   firstGensRow:(()=>{ const first=document.querySelector('#gens').children[0];\n"
    "     const h=first&&first.querySelector('[data-sys]'); return h?h.dataset.sys:null; })()\n"
    " }));\n"
    " ok('the strip shows all four exotics, now on the Empire tab', empStrip.dots===4, empStrip);\n"
    " ok('only the banked one shows as held', empStrip.held===1, empStrip);\n"
    " ok('the counter strip sits above the system list', empStrip.aboveGens, empStrip);\n"
    " ok('Sol Reach is the first row in the list (programmes moved to Research, Stage 1)', empStrip.firstGensRow==='home', empStrip);\n"
    "\n"
    " // claim through the real UI - back to the map, where claiming still happens\n",
    " // patch612 (PLAN-unify.md): #exoStrip lived inside #p-emp, deleted outright with the\n"
    " // rest of the old Empire accordion - it has no current home (flagged for the\n"
    " // coordinator in HANDOVER, not decided here; see tnodes2.js/ttelegraph2.js for the\n"
    " // same open question). The four checks this block used to run against it are\n"
    " // dropped, not faked onto a DOM node that no longer exists.\n"
    "\n"
    " // claim through the real UI - back to the map, where claiming still happens\n",
    label="tmap2 drops the exoStrip-on-Empire-tab block",
)
do(
    "tmap2.js",
    " // build a kind-ladder tier through the relocated Empire UI - PATCH 1 replaces the\n"
    " // old \"develop through the UI\" scenario (the DEVELOP/EXTRACTION button is gone\n"
    " // entirely, see HANDOVER); production now comes from buying the first ladder row.\n"
    " await p.click('.tab[data-p=\"p-emp\"]'); await p.waitForTimeout(300);\n"
    " const opened=await p.evaluate(()=>{\n"
    "   const rows=[...document.querySelectorAll('#gens .sysrow2.held')];\n"
    "   const row=rows.find(r=>r.querySelector('.sysname')&&r.querySelector('.sysname').textContent===__SD.SYSMAP.vel.n);\n"
    "   if(row)row.click();\n"
    "   return !!row;\n"
    " });\n"
    " await p.waitForTimeout(300);\n"
    " ok('the claimed system has a row in the Empire tab', opened);\n"
    " ok('no pinned Extraction block renders any more (empDevBlock is gone)',\n"
    "    !(await p.evaluate(()=>!!document.getElementById('sysDevEmp'))));\n"
    " ok('building the system\\'s own next ladder tier through the relocated UI works', await (async()=>{\n"
    "   const r0=await p.evaluate(()=>__SD.sysExoRate('vel'));\n"
    "   const btn=await p.evaluate(()=>{\n"
    "     const row=document.querySelector('#gens .g.next') || document.querySelector('#gens .g');\n"
    "     return !!row;\n"
    "   });\n"
    "   if(!btn)return false;\n"
    "   await p.click('#gens .g.next .gb, #gens .g .gb'); await p.waitForTimeout(400);\n"
    "   const r1=await p.evaluate(()=>__SD.sysExoRate('vel'));\n"
    "   return r1>r0;\n"
    " })());\n",
    " // build a kind-ladder tier through the sheet's own BUILDINGS section (patch610) -\n"
    " // PATCH 1 replaced the old \"develop through the UI\" scenario (the DEVELOP/\n"
    " // EXTRACTION button is gone entirely, see HANDOVER); production still comes from\n"
    " // buying the first ladder row, just inline in the sheet instead of an accordion\n"
    " // row - the sheet is already open on vel from the claim just above.\n"
    " const opened=await p.evaluate(()=>!!document.querySelector('#sysBuildRows .g'));\n"
    " ok('the claimed system shows its ladder rows in the sheet', opened);\n"
    " ok('no pinned Extraction block renders any more (empDevBlock is gone)',\n"
    "    !(await p.evaluate(()=>!!document.getElementById('sysDevEmp'))));\n"
    " ok('building the system\\'s own next ladder tier through the sheet works', await (async()=>{\n"
    "   const r0=await p.evaluate(()=>__SD.sysExoRate('vel'));\n"
    "   await p.click('#sysBuildRows .g.next .gb, #sysBuildRows .g .gb'); await p.waitForTimeout(400);\n"
    "   const r1=await p.evaluate(()=>__SD.sysExoRate('vel'));\n"
    "   return r1>r0;\n"
    " })());\n",
    label="tmap2 builds through the sheet instead of the accordion",
)

# ==================================================================== tsheet2.js
do(
    "tsheet2.js",
    " // ---------------- Empire tab row -> Map lands with the sheet open ----------------\n"
    " await p.evaluate(()=>{ const G=window.__SD; G.S.msel=null; dirty=true; render(); });\n"
    " await p.click('.tab[data-p=\"p-emp\"]'); await p.waitForTimeout(200);\n"
    " await p.evaluate(()=>{\n"
    "   const rows=[...document.querySelectorAll('.sysrow2.contested')];\n"
    "   const row=rows.find(r=>r.querySelector('.sysname')&&r.querySelector('.sysname').textContent==='Tannhau');\n"
    "   if(row)row.click();\n"
    " });\n"
    " await p.waitForTimeout(250);\n"
    " const empPath=await p.evaluate(()=>({\n"
    "   tab: document.querySelector('.tab.on')&&document.querySelector('.tab.on').dataset.p,\n"
    "   open: document.getElementById('sysSheet').classList.contains('open'),\n"
    "   msel: window.__SD.S.msel\n"
    " }));\n"
    " ok('Empire tab row -> Map lands on the Map tab with the sheet open on that system',\n"
    "   empPath.tab==='p-map' && empPath.open && empPath.msel==='tan', empPath);\n"
    "\n",
    " // ---------------- Empire tab row -> Map ----------------\n"
    " // patch612: dropped. This drove a separate Empire LIST tab (patch416's\n"
    " // .sysrow2 rows) to select a system and land on Map with its sheet open - that\n"
    " // list does not exist any more (Map/Empire is one tab now) and its Run 3\n"
    " // replacement (patch614's MAP | LIST toggle) is not built yet. Not faked here;\n"
    " // Run 3's tunify2.js covers the LIST-row -> sheet path once it exists.\n"
    "\n",
    label="tsheet2 drops the Empire-tab-row scenario",
)

# ==================================================================== tlockstates2.js
do(
    "tlockstates2.js",
    "// tlockstates2.js — item 2: three lock states for unclaimed systems in the empire list.\n"
    "// Level-not-reached stays locked (lock icon, dimmed). Level-reached-but-unclaimed drops\n"
    "// the lock, shows full brightness + claim cost + a distinct highlight, and does so the\n"
    "// INSTANT level() itself changes (takeLevel), not just next time the tab is opened.\n"
    "//\n"
    "// PATCH 2 extends this file: the level-reached-and-unheld bucket itself splits in two\n"
    "// depending on sysContested() (rival-held or not) - CLAIMABLE (unchanged from above) and\n"
    "// the new CONTESTED state (rival mark, garrison strength where the claim cost sits,\n"
    "// INVADE action label, a distinct accent color, and a tap that routes to the map's\n"
    "// EXISTING assault flow rather than the claim one).\n",
    "// tlockstates2.js — item 2: three lock states for unclaimed systems on the map.\n"
    "// Level-not-reached stays locked (.mnode.locked, dimmed, dashed ring). Level-reached-\n"
    "// but-unclaimed drops the lock (.mnode.open) and does so the INSTANT level() itself\n"
    "// changes (takeLevel), not just next time the map re-renders.\n"
    "//\n"
    "// PATCH 2 extends this file: the level-reached-and-unheld bucket itself splits in two\n"
    "// depending on sysContested() (rival-held or not) - CLAIMABLE (.mnode.open, unchanged\n"
    "// from above) and CONTESTED (.mnode.foe: garrison/archetype intel and an INVADE/ASSAULT\n"
    "// action where the claim cost/CLAIM button would sit, a tap that routes to the map's\n"
    "// EXISTING assault flow rather than the claim one).\n"
    "//\n"
    "// patch613: re-pointed off #gens .sysrow2 (the old Empire accordion row, deleted by\n"
    "// patch612) onto the only UI that still carries these three states - the map node's\n"
    "// own locked/open/foe classes, and the sheet's info text (opened by tapping the node)\n"
    "// for the garrison/archetype/claim-cost/rival-owner detail the old row's text used to\n"
    "// carry. .rivalmark/.lockicon (CSS-only now, their markup went with the row) have no\n"
    "// replacement worth inventing - the sheet's \"HELD BY <rival>\" meta line and #sysWar\n"
    "// vs #sysClaim (already tsheet2.js's own job) say the same thing.\n",
    label="tlockstates2 header",
)
do(
    "tlockstates2.js",
    " // kor.lvl===9. Start below it (locked), then jump exactly onto the threshold.\n"
    " const setup=await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   G.adopt({ore:1e9, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},\n"
    "     lvl:1, rs:{}, nx:{}, ab:[], buy:1, msel:null});\n"
    "   G.gotoTab('p-emp'); dirty=true; render();\n"
    "   return {korLvl:G.SYSMAP.kor.lvl, level:G.level()};\n"
    " });\n"
    " out.push('   kor requires level '+setup.korLvl+', currently '+setup.level);\n"
    "\n"
    " const before=await p.evaluate(()=>{\n"
    "   const row=document.querySelector('#gens [data-sys]')?.closest?.('#gens'); // not used, direct query below\n"
    "   const el=[...document.querySelectorAll('#gens .sysrow2')].find(r=>r.textContent.includes('Koru'));\n"
    "   return el ? {cls:el.className, hasLock:!!el.querySelector('.lockicon'), hasBadge:!!el.querySelector('.kindbadge')} : null;\n"
    " });\n"
    " ok('below level: locked class, lock icon, no claim badge', before && before.cls.includes('locked') && before.hasLock && !before.hasBadge, before);\n",
    " // kor.lvl===9. Start below it (locked, and level 8+ so the map itself is revealed -\n"
    " // see PLAN-unify.md item 5 - otherwise kor would not even have a node to read yet).\n"
    " const setup=await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   G.adopt({ore:1e9, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},\n"
    "     lvl:8, lvSeen:8, rs:{}, nx:{}, ab:[], buy:1, msel:null});\n"
    "   G.gotoTab('p-map'); dirty=true; render();\n"
    "   return {korLvl:G.SYSMAP.kor.lvl, level:G.level()};\n"
    " });\n"
    " out.push('   kor requires level '+setup.korLvl+', currently '+setup.level);\n"
    "\n"
    " const before=await p.evaluate(()=>{\n"
    "   const el=[...document.querySelectorAll('#mapNodes .mnode')].find(n=>n.dataset.s==='kor');\n"
    "   return el ? {cls:el.className} : null;\n"
    " });\n"
    " ok('below level: locked class on the node, not held/open/foe',\n"
    "    before && before.cls.includes('locked') && !before.cls.includes('held')\n"
    "    && !before.cls.includes('open') && !before.cls.includes('foe'), before);\n",
    label="tlockstates2 below-level setup + check",
)
do(
    "tlockstates2.js",
    " const after=await p.evaluate(()=>{\n"
    "   const el=[...document.querySelectorAll('#gens .sysrow2')].find(r=>r.textContent.includes('Koru'));\n"
    "   return el ? {cls:el.className, hasLock:!!el.querySelector('.lockicon'),\n"
    "     hasBadge:!!el.querySelector('.kindbadge'), text:el.textContent} : null;\n"
    " });\n"
    " ok('level crossed via takeLevel() alone (no manual render/tab-switch) flips the row',\n"
    "    after && after.cls.includes('claimable') && !after.hasLock && after.hasBadge, after);\n"
    " ok('claim cost still shown', after && /ORE/.test(after.text));\n"
    " ok('a claimable row carries no rival mark', after && !after.text.includes('⚔'), after);\n",
    " const after=await p.evaluate(()=>{\n"
    "   const el=[...document.querySelectorAll('#mapNodes .mnode')].find(n=>n.dataset.s==='kor');\n"
    "   if(!el)return null;\n"
    "   el.click();\n"
    "   const info=document.getElementById('sysInfo');\n"
    "   return {cls:el.className, infoText:info?info.textContent:''};\n"
    " });\n"
    " await p.waitForTimeout(200);\n"
    " ok('level crossed via takeLevel() alone (no manual render/tab-switch) flips the node',\n"
    "    after && after.cls.includes('open') && !after.cls.includes('locked'), after);\n"
    " ok('claim cost still shown (tapping the node opens the sheet with it)',\n"
    "    after && /ore/i.test(after.infoText), after);\n"
    " ok('a claimable system carries no rival-owner mark in the sheet',\n"
    "    after && !/HELD BY/.test(after.infoText), after);\n",
    label="tlockstates2 after-level check",
)
do(
    "tlockstates2.js",
    " const rival=await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   G.S.xpn=G.xpNeed(G.SYSMAP.tan.lvl);\n"
    "   G.checkLevel();\n"
    "   while(G.pendingLevels()>0){ const off=G.lvOffer(); G.takeLevel(off[0]); }\n"
    "   dirty=true; render();\n"
    "   const el=[...document.querySelectorAll('#gens .sysrow2')].find(r=>r.textContent.includes('Tannhau'));\n"
    "   return el ? {\n"
    "     cls:el.className, text:el.textContent,\n"
    "     hasRivalMark:!!el.querySelector('.rivalmark'),\n"
    "     hasInvade:/INVADE/.test(el.textContent),\n"
    "     hasClaimReady:/CLAIM READY/.test(el.textContent),\n"
    "     hasClaimCost:/\\d ORE/.test(el.textContent)\n"
    "   } : null;\n"
    " });\n"
    " ok('a rival-held, level-reached system reads as CONTESTED, not claimable or locked',\n"
    "    rival && rival.cls.includes('contested')\n"
    "    && !rival.cls.includes('claimable') && !rival.cls.includes('locked'), rival);\n"
    " ok('a contested row carries a rival mark', rival && rival.hasRivalMark, rival);\n"
    " ok('the action label reads INVADE, not CLAIM', rival && rival.hasInvade && !rival.hasClaimReady, rival);\n"
    " ok('garrison strength shows where the claim cost would sit (no ore cost figure)',\n"
    "    rival && /SHIPS/.test(rival.text) && !rival.hasClaimCost, rival);\n"
    "\n"
    " // tapping a contested row must route to the map's assault flow, never the claim one\n"
    " await p.evaluate(()=>{\n"
    "   const el=[...document.querySelectorAll('#gens .sysrow2')].find(r=>r.textContent.includes('Tannhau'));\n"
    "   el.click();\n"
    " });\n"
    " await p.waitForTimeout(400);\n",
    " const rival=await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   G.S.xpn=G.xpNeed(G.SYSMAP.tan.lvl);\n"
    "   G.checkLevel();\n"
    "   while(G.pendingLevels()>0){ const off=G.lvOffer(); G.takeLevel(off[0]); }\n"
    "   dirty=true; render();\n"
    "   const el=[...document.querySelectorAll('#mapNodes .mnode')].find(n=>n.dataset.s==='tan');\n"
    "   if(!el)return null;\n"
    "   el.click();\n"
    "   const info=document.getElementById('sysInfo');\n"
    "   return { cls:el.className, infoText: info?info.textContent:'' };\n"
    " });\n"
    " await p.waitForTimeout(200);\n"
    " ok('a rival-held, level-reached system reads as CONTESTED, not claimable or locked',\n"
    "    rival && rival.cls.includes('foe')\n"
    "    && !rival.cls.includes('open') && !rival.cls.includes('locked'), rival);\n"
    " ok('the sheet names the rival owning it (HELD BY ...)', rival && /HELD BY/.test(rival.infoText), rival);\n"
    " // the sheet shows Garrison/Archetype intel ALONGSIDE the claim-cost figure (invading\n"
    " // still costs the same ore the claim would) - unlike the old row, which hid the cost\n"
    " // and showed only garrison. Confirmed against renderMap()'s own contested branch.\n"
    " ok('garrison/archetype intel shows in the sheet', rival && /Garrison/.test(rival.infoText) && /Archetype/.test(rival.infoText), rival);\n"
    "\n"
    " // the node is already selected (tapped above) - the sheet itself must show the\n"
    " // assault flow, never the claim one, same routing the old row's tap used to do.\n",
    label="tlockstates2 contested setup + check",
)
do(
    "tlockstates2.js",
    " const routed=await p.evaluate(()=>({\n"
    "   tab:document.querySelector('.tab.on')?.dataset.p,\n"
    "   msel:window.__SD.S.msel,\n"
    "   hasClaimBtn:!!document.getElementById('sysClaim'),\n"
    "   hasWarBtn:!!document.getElementById('sysWar'),\n"
    "   warText:document.getElementById('sysWar')?.textContent||null\n"
    " }));\n"
    " ok('tapping a contested row opens the map on that system', routed.tab==='p-map'&&routed.msel==='tan', routed);\n"
    " ok('...showing the ASSAULT flow, not the claim flow', routed.hasWarBtn && !routed.hasClaimBtn, routed);\n",
    " const routed=await p.evaluate(()=>({\n"
    "   msel:window.__SD.S.msel,\n"
    "   hasClaimBtn:!!document.getElementById('sysClaim'),\n"
    "   hasWarBtn:!!document.getElementById('sysWar'),\n"
    " }));\n"
    " ok('tapping a contested node selects it in the sheet', routed.msel==='tan', routed);\n"
    " ok('...showing the ASSAULT flow, not the claim flow', routed.hasWarBtn && !routed.hasClaimBtn, routed);\n",
    label="tlockstates2 routed check",
)

# ==================================================================== tscrolldevfix2.js
do(
    "tscrolldevfix2.js",
    "// tscrolldevfix2.js — post-item4 scroll-pin retest. Item 4 changed empDevBlock's markup\n"
    "// (fewer rows, new label), which changes the height of every non-home system's expanded\n"
    "// body. Confirms the accordion tap-to-expand scroll-pin (empAccordionTap, patch420's\n"
    "// jumpTo/instant fix) still holds delta<1px: a system below an open system row.\n"
    "// (Stage 1/v3, patch429: programme rows no longer live in the Empire accordion at all -\n"
    "// they moved to the Research tab and render open, with no accordion/scroll-pin of\n"
    "// their own - so the former \"below an open PROGRAMME row\" scenario is retired along\n"
    "// with them; see tprogresearch2.js for their coverage.)\n"
    "//\n"
    "// PATCH 1 (v3 tuning pass): empDevBlock() itself is deleted (the pinned Extraction row\n"
    "// is gone, see HANDOVER) - scenario B below no longer has a #sysDevEmp to look for, so\n"
    "// it now confirms the expanded body it is measuring against actually has SOME content\n"
    "// (a ladder tier row) rather than being empty, which is the property that scenario A's\n"
    "// pin test actually depends on.\n"
    "//\n"
    "// PLAN-ending.md Batch B, patch582 (2026-09-11): this test's setup used to hold every\n"
    "// system in the game (`for(const s of G.SYS)`), purely as blanket convenience - only\n"
    "// ring1 (sysRows[0]/[3], the only rows it ever touches) was ever load-bearing. Batch B\n"
    "// adds a 5th #exoStrip entry (\"Exotic Nodes\") that only shows once any ring-3/4 system\n"
    "// is held (see renderExoStrip()) - holding literally every system now incidentally\n"
    "// shows it, adding one row's height to the Empire header and shifting the RING 1\n"
    "// section (a few rows below it) down by the same amount before either measurement in\n"
    "// scenario A is taken. That is a real, intentional new element (item 1 of the plan),\n"
    "// not a scroll-pin regression - empAccordionTap's own before/after math (the thing\n"
    "// this test actually covers) is untouched and still exact; only this test's own\n"
    "// unrelated \"hold everything\" convenience setup accidentally started exercising it.\n"
    "// Scoped the setup to ring<=2 (still covers every row this test actually reads,\n"
    "// sysRows[0]/[3] are both ring 1) so it holds only what its own scenario needs, same\n"
    "// as it would have to if it were reaching for exotic-heavy systems on purpose.\n",
    "// tscrolldevfix2.js — scroll-pin retest, now against the sheet. empAccordionTap() (this\n"
    "// file's original subject, the accordion's own tap-to-expand scroll-pin) is gone with\n"
    "// the rest of the accordion (patch612). Its direct successor is patch611's own\n"
    "// capture/restore of #sysSheet.scrollTop around renderSysBuild()'s rebuild - the same\n"
    "// underlying risk (a DOM rebuild changing the scrolling ancestor's height out from\n"
    "// under the player mid-scroll), now scoped to one system's buy rows instead of every\n"
    "// accordion row at once. Scenario A: scroll partway down home's 14-tier ladder, buy a\n"
    "// tier (a real rebuild via ladderBuy() -> dirty=true;render()), confirm the sheet does\n"
    "// not move. Scenario B: confirm the rebuilt rows the pin test measures against are not\n"
    "// empty (a real ladder tier row exists), same purpose PATCH 1's own note served here.\n",
    label="tscrolldevfix2 header",
)
do(
    "tscrolldevfix2.js",
    " await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   const sys={ home:{home:true,b:{0:5}} };\n"
    "   for(const s of G.SYS){ if(s.ring<=2) sys[s.id]={dev:2,b:{}}; }\n"
    "   G.adopt({ore:1e9, all:1e9, cry:0, dm:5e4, exo:{ir:200,he:200,xe:200,am:200}, sys, lvl:60, rs:{}, nx:{}, ab:[], buy:1, msel:null});\n"
    "   G.gotoTab('p-emp'); dirty=true; render();\n"
    " });\n"
    " await p.waitForTimeout(300);\n"
    "\n"
    " const sysRows = await p.evaluate(()=>[...document.querySelectorAll('#gens [data-sys]')]\n"
    "   .map(e=>e.dataset.sys).filter(id=>!id.startsWith('x:')&&id!=='home'));\n"
    "\n"
    " // scenario A: open system A (non-home, has a devblock), then tap system B below it -\n"
    " // B's body ALSO carries the now-shorter devblock. Confirms the pin holds with the new\n"
    " // devblock height on both the collapsing and expanding side.\n"
    " await p.evaluate((id)=>document.querySelector('[data-sys=\"'+id+'\"]').click(), sysRows[0]);\n"
    " await p.waitForTimeout(250);\n"
    " const targetB = sysRows[3];\n"
    " await p.evaluate((id)=>document.querySelector('[data-sys=\"'+id+'\"]').scrollIntoView({block:'center'}), targetB);\n"
    " await p.waitForTimeout(800); // let the smooth scrollIntoView settle before measuring (see tscrolljump.js)\n"
    " const beforeB = await p.evaluate((id)=>document.querySelector('[data-sys=\"'+id+'\"]').getBoundingClientRect().top, targetB);\n"
    " await p.evaluate((id)=>document.querySelector('[data-sys=\"'+id+'\"]').click(), targetB);\n"
    " await p.waitForTimeout(250);\n"
    " const afterB = await p.evaluate((id)=>document.querySelector('[data-sys=\"'+id+'\"]').getBoundingClientRect().top, targetB);\n"
    " ok('A: system below an open system (both carrying the new devblock) stays pinned',\n"
    "    Math.abs(afterB-beforeB)<1, {before:beforeB, after:afterB, delta:Math.abs(afterB-beforeB)});\n"
    "\n"
    " // scenario B: confirm the expanded body being measured above (scenario A left\n"
    " // targetB open) actually contains a real ladder tier row, so that pin test is not\n"
    " // accidentally exercising an empty body. PATCH 1: no more #sysDevEmp to look for -\n"
    " // the body is just its own kind-ladder tier rows now (empDevBlock is gone).\n"
    " const hasTierRow = await p.evaluate((id)=>{\n"
    "   const body=document.querySelector('[data-sys=\"'+id+'\"]').nextElementSibling;\n"
    "   return body && body.querySelectorAll('.g').length>0;\n"
    " }, targetB);\n"
    " ok('B: the expanded body being pinned against actually contains a ladder tier row', hasTierRow);\n",
    " await p.evaluate(()=>{\n"
    "   const G=window.__SD;\n"
    "   // home's ore ladder (14 tiers) gives real scroll room; own the first 7 so there is\n"
    "   // both owned rows above and a next-tier row still to buy against.\n"
    "   const b={}; for(let gi=0; gi<7; gi++) b[gi]=1;\n"
    "   G.adopt({ore:1e30, all:1e30, cry:0, dm:5e4, exo:{ir:200,he:200,xe:200,am:200},\n"
    "     sys:{home:{home:true,b}}, lvl:60, rs:{}, nx:{}, ab:[], buy:1, msel:'home'});\n"
    "   G.gotoTab('p-map'); dirty=true; render();\n"
    " });\n"
    " await p.waitForTimeout(300);\n"
    "\n"
    " // scenario A: scroll the sheet partway down its buy rows, then buy the next tier -\n"
    " // ladderBuy() -> dirty=true;render() rebuilds #sysBuildRows (patch610/611's own\n"
    " // \"Watch for\" risk). Confirms the sheet's own scrollTop does not move.\n"
    " const sheetScrollable = await p.evaluate(()=>{\n"
    "   const sh=document.getElementById('sysSheet');\n"
    "   return sh.scrollHeight-sh.clientHeight;\n"
    " });\n"
    " ok('setup: the sheet actually has scroll room to test against', sheetScrollable>20, sheetScrollable);\n"
    " await p.evaluate((max)=>{ document.getElementById('sysSheet').scrollTop=Math.round(max/2); }, sheetScrollable);\n"
    " await p.waitForTimeout(150);\n"
    " const beforeTop = await p.evaluate(()=>document.getElementById('sysSheet').scrollTop);\n"
    " await p.evaluate(()=>{ const G=window.__SD; G.S.buy=1; G.ladderBuy('home',7); });\n"
    " await p.waitForTimeout(250);\n"
    " const afterTop = await p.evaluate(()=>document.getElementById('sysSheet').scrollTop);\n"
    " ok('A: buying a tier mid-ladder while scrolled does not move the sheet',\n"
    "    Math.abs(afterTop-beforeTop)<1, {before:beforeTop, after:afterTop, delta:Math.abs(afterTop-beforeTop)});\n"
    "\n"
    " // scenario B: confirm the rows the pin test measures against are not empty - a real\n"
    " // ladder tier row exists in #sysBuildRows after the rebuild above.\n"
    " const hasTierRow = await p.evaluate(()=>document.querySelectorAll('#sysBuildRows .g').length>0);\n"
    " ok('B: the rebuilt rows being pinned against actually contain a ladder tier row', hasTierRow);\n",
    label="tscrolldevfix2 body rewrite",
)

# ==================================================================== tchurn2.js
do(
    "tchurn2.js",
    " await check('Empire (home row)', async()=>{ await p.evaluate(()=>{ gotoTab('p-emp'); }); });\n"
    " await check('Empire (Koru row open)', async()=>{\n"
    "   await p.evaluate(()=>{ gotoTab('p-emp'); });\n"
    "   const row=await p.$('[data-sys=\"kor\"]');\n"
    "   if(row)await row.click();\n"
    " });\n",
    " // patch612: the Empire tab/accordion (#p-emp/#gens) is gone - the map is the one\n"
    " // Empire tab now, and its sheet carries the same buy buttons (patch610's\n"
    " // #sysBuild). These two checks sample it with the sheet open and buildings shown,\n"
    " // per the plan's own \"Watch for\" note.\n"
    " await check('Map (home sheet open, buildings shown)', async()=>{\n"
    "   await p.evaluate(()=>{ S.msel='home'; gotoTab('p-map'); dirty=true; render(); });\n"
    " });\n"
    " await check('Map (Koru sheet open, buildings shown)', async()=>{\n"
    "   await p.evaluate(()=>{ S.msel='kor'; gotoTab('p-map'); dirty=true; render(); });\n"
    " });\n",
    label="tchurn2 Empire checks onto the sheet",
)

# ==================================================================== tprogresearch2.js
do(
    "tprogresearch2.js",
    " const none = await p.evaluate(()=>({\n"
    "   progRows: document.querySelectorAll('#progList [data-sys^=\"x:\"]').length,\n"
    "   emptyMsg: document.querySelector('#progList').textContent.trim(),\n"
    "   gensRows: document.querySelectorAll('#gens [data-sys^=\"x:\"]').length\n"
    " }));\n"
    " ok('no programme section before anything is ever banked', none.progRows===0, none);\n"
    " ok('an explanatory empty-state message shows instead', none.emptyMsg.length>0, none);\n"
    " ok('Empire #gens carries no programme rows either (moved off entirely)', none.gensRows===0, none);\n",
    " const none = await p.evaluate(()=>({\n"
    "   progRows: document.querySelectorAll('#progList [data-sys^=\"x:\"]').length,\n"
    "   emptyMsg: document.querySelector('#progList').textContent.trim(),\n"
    "   gensGone: !document.getElementById('gens')\n"
    " }));\n"
    " ok('no programme section before anything is ever banked', none.progRows===0, none);\n"
    " ok('an explanatory empty-state message shows instead', none.emptyMsg.length>0, none);\n"
    " // patch612: the old Empire accordion (#gens) is gone outright now, not just clean\n"
    " // of programme rows - the stronger, still-accurate version of the same claim.\n"
    " ok('the old Empire accordion (#gens) is gone entirely, not just of programme rows', none.gensGone, none);\n",
    label="tprogresearch2 gens assertion",
)

# ==================================================================== ttree2.js
do(
    "ttree2.js",
    " await p.goto('file:///home/claude/stellar-dominion.html'); await p.waitForTimeout(400);\n"
    " await p.evaluate(()=>{ __SD.S.xpn=1e9; __SD.S.lvl=80; __SD.S.lvSeen=80; });   // open the level-gated tabs\n"
    " await p.evaluate(()=>{ __SD.S.rs={drill:5,amp:4,cryo:3,cold:1,auto:2}; __SD.S.cry=5e4; });\n"
    " await p.click('.tab[data-p=\"p-res\"]'); await p.waitForTimeout(700);\n"
    " console.log('chips',await p.$$eval('.rchip',n=>n.length),'nodes',await p.$$eval('.rn',n=>n.length),'segs',await p.$$eval('#treeLines path',n=>n.length));\n"
    " console.log('core hidden on research?', await p.evaluate(()=>getComputedStyle(document.getElementById('core')).display));\n"
    " await p.screenshot({path:'r2-drill.png'});\n"
    " await p.click('.rchip:nth-child(6)'); await p.waitForTimeout(600);\n"
    " await p.screenshot({path:'r2-void.png'});\n"
    " await p.click('.rchip:nth-child(1)'); await p.waitForTimeout(400);\n"
    " const before=await p.evaluate(()=>__SD.S.rs.drill);\n"
    " await p.click('#treeGrid .rn:nth-child(6)'); await p.waitForTimeout(300); await p.click('#nmBuy'); await p.waitForTimeout(400);\n"
    " console.log('drill',before,'->',await p.evaluate(()=>__SD.S.rs.drill));\n"
    " await p.click('.tab[data-p=\"p-emp\"]'); await p.waitForTimeout(400);\n"
    " console.log('core shown on empire?', await p.evaluate(()=>getComputedStyle(document.getElementById('core')).display));\n",
    " // patch613: was pointed at stellar-dominion.html (the frozen shipped build) and\n"
    " // read #core, which real empire2 no longer has since patch612 - repointed to the\n"
    " // actual working file, and the dead #core reads dropped.\n"
    " await p.goto('file:///home/claude/stellar-dominion-empire2.html'); await p.waitForTimeout(400);\n"
    " // empire2 (unlike the shipped build this file used to point at) opens a fresh\n"
    " // save on a full-screen intro overlay that eats clicks until dismissed - see\n"
    " // tmap2.js's own note. Close it up front so the real p.click() calls below land.\n"
    " await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });\n"
    " await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });\n"
    " await p.evaluate(()=>{ __SD.S.xpn=1e9; __SD.S.lvl=80; __SD.S.lvSeen=80; });   // open the level-gated tabs\n"
    " await p.evaluate(()=>{ __SD.S.rs={drill:5,amp:4,cryo:3,cold:1,auto:2}; __SD.S.cry=5e4; });\n"
    " await p.click('.tab[data-p=\"p-res\"]'); await p.waitForTimeout(700);\n"
    " console.log('chips',await p.$$eval('.rchip',n=>n.length),'nodes',await p.$$eval('.rn',n=>n.length),'segs',await p.$$eval('#treeLines path',n=>n.length));\n"
    " await p.screenshot({path:'r2-drill.png'});\n"
    " await p.click('.rchip:nth-child(6)'); await p.waitForTimeout(600);\n"
    " await p.screenshot({path:'r2-void.png'});\n"
    " await p.click('.rchip:nth-child(1)'); await p.waitForTimeout(400);\n"
    " const before=await p.evaluate(()=>__SD.S.rs.drill);\n"
    " await p.click('#treeGrid .rn:nth-child(6)'); await p.waitForTimeout(300); await p.click('#nmBuy'); await p.waitForTimeout(400);\n"
    " console.log('drill',before,'->',await p.evaluate(()=>__SD.S.rs.drill));\n"
    " await p.click('.tab[data-p=\"p-map\"]'); await p.waitForTimeout(400);\n"
    " console.log('map/empire tab shows the sheet?', await p.evaluate(()=>document.getElementById('sysSheet').classList.contains('open')));\n",
    label="ttree2 repoint to empire2, drop dead #core reads",
)
do(
    "ttree2.js",
    " await p2.goto('file:///home/claude/stellar-dominion.html'); await p2.waitForTimeout(400);\n",
    " await p2.goto('file:///home/claude/stellar-dominion-empire2.html'); await p2.waitForTimeout(400);\n"
    " await p2.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });\n"
    " await p2.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });\n",
    label="ttree2 mobile context repoint",
)

# ==================================================================== tzoom2.js
do(
    "tzoom2.js",
    " await p.evaluate(()=>{ __SD.gotoTab('p-emp'); });\n"
    " await p.waitForTimeout(150);\n"
    " const mzAfterTabLeave=await p.evaluate(()=>__SD.mapZoom);\n"
    " ok('leaving Map tab closes zoom', mzAfterTabLeave===null, {mapZoom:mzAfterTabLeave});\n"
    " await p.evaluate(()=>{ __SD.gotoTab('p-map'); });\n",
    " // patch612: p-emp no longer exists - gotoTab() only clicks a `.tab[data-p=...]`\n"
    " // it can actually find, so this used to silently no-op (never truly leaving\n"
    " // Map) rather than exercise the tab-click handler's own zoom-clearing line.\n"
    " // Missions is a real, always-present tab; same scenario, a real target.\n"
    " await p.evaluate(()=>{ __SD.gotoTab('p-mis'); });\n"
    " await p.waitForTimeout(150);\n"
    " const mzAfterTabLeave=await p.evaluate(()=>__SD.mapZoom);\n"
    " ok('leaving Map tab closes zoom', mzAfterTabLeave===null, {mapZoom:mzAfterTabLeave});\n"
    " await p.evaluate(()=>{ __SD.gotoTab('p-map'); });\n",
    label="tzoom2 leaves Map for a real tab",
)

# ==================================================================== ttaborder2.js
do(
    "ttaborder2.js",
    "// ttaborder2.js — Stats moved to the end of the tab bar, then (patch563) that slot\n"
    "// became Market; order is otherwise unchanged, and switching tabs by data-p (not\n"
    "// position) still works. Stats itself (id p-ach) has no tab of its own any more -\n"
    "// reached via the Market pane's \"Records & graphs\" ghost link - so this file no\n"
    "// longer asserts a Stats tab exists, only that Market's does and opens p-mkt.\n",
    "// ttaborder2.js — Stats moved to the end of the tab bar, then (patch563) that slot\n"
    "// became Market; order is otherwise unchanged, and switching tabs by data-p (not\n"
    "// position) still works. Stats itself (id p-ach) has no tab of its own any more -\n"
    "// reached via the Market pane's \"Records & graphs\" ghost link - so this file no\n"
    "// longer asserts a Stats tab exists, only that Market's does and opens p-mkt.\n"
    "//\n"
    "// patch608/612 (PLAN-unify.md): the Map pane is first now, labeled Empire, and the\n"
    "// old #p-emp tab button is gone outright - not hidden, deleted. Order is Map,\n"
    "// Missions, Research, Raids, Nexus, Market.\n",
    label="ttaborder2 header note",
)
do(
    "ttaborder2.js",
    " const order=await p.evaluate(()=>[...document.querySelectorAll('.tab')].map(t=>t.dataset.p));\n"
    " ok('order is Empire, Missions, Research, Map, Raids, Nexus, Market',\n"
    "    JSON.stringify(order)===JSON.stringify(['p-emp','p-mis','p-res','p-map','p-raid','p-nex','p-mkt']), order);\n",
    " const order=await p.evaluate(()=>[...document.querySelectorAll('.tab')].map(t=>t.dataset.p));\n"
    " ok('order is Empire (the map), Missions, Research, Raids, Nexus, Market',\n"
    "    JSON.stringify(order)===JSON.stringify(['p-map','p-mis','p-res','p-raid','p-nex','p-mkt']), order);\n",
    label="ttaborder2 expected order",
)

# ==================================================================== tmapoverlap2.js
do(
    "tmapoverlap2.js",
    "  await p.evaluate(() => __SD.gotoTab('p-map'));\n"
    "  await p.waitForTimeout(300);\n"
    "\n"
    "  const sectorCount = await p.evaluate(() => __SD.SECTORS.length);\n",
    "  // patch609's level-8 reveal (Run 1) means a fresh, low-level save only ever shows\n"
    "  // Sol Reach - the \"every SYS[] entry belongs to exactly one sector page\" check\n"
    "  // below sums nodes actually rendered across every page, so it needs the reveal\n"
    "  // past level 8 to see the full roster, same as tmapoverlap2's own per-page counts\n"
    "  // (G.sysInSec(sec).length) already implicitly get from the fixture elsewhere.\n"
    "  await p.evaluate(() => { const G = __SD; G.adopt({...G.fresh(), lvl:40, lvSeen:40}); });\n"
    "  await p.evaluate(() => __SD.gotoTab('p-map'));\n"
    "  await p.waitForTimeout(300);\n"
    "\n"
    "  const sectorCount = await p.evaluate(() => __SD.SECTORS.length);\n",
    label="tmapoverlap2 level-8 reveal fixture",
)

# ==================================================================== write everything out
for name, content in _cache.items():
    with open(f"{TESTS}/{name}", "w", encoding="utf-8") as f:
        f.write(content)

print("patch613 applied OK")
