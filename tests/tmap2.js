const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tmap2.js — EMPIRE2 copy of tmap.js, pointed at stellar-dominion-empire2.html.
//
// Most of tmap.js is untouched by the slots experiment (claiming, the spatial Map tab
// UI) and is copied verbatim. Three sections that reached directly into the old
// S.g[i].c / buyGen / sellGen / maxAff are rewritten onto the new slot API (later the
// ladder API - see below); the scrap-refund test is dropped outright because this
// build has no scrap/refund mechanic (out of scope by spec).
//
// PATCH 1 (v3 tuning pass): development/extraction (dev level, sysYield(), devCost(),
// the pinned Extraction row) is gone entirely - a system's exotic output is now the
// sum of its own kind-ladder rows, same as ore. The "claiming"/"development" sections
// below are rewritten for this: a fresh claim now asserts EXACTLY ZERO yield (not
// ">0" - that was the old extraction baseline, which no longer exists), and what used
// to be "developing raises the yield" is now "buying the first ladder tier raises the
// yield". "developing through the UI works" (the #sysDevEmp button) is replaced by
// building a ladder tier through the same relocated Empire-tab row UI everything else
// already uses.
//
// One assertion below is a known PRE-EXISTING failure, confirmed unrelated to any of
// this by running it against .bak-good.html and every intermediate backup in this
// project: "every system is on the network" (the map is a hub, not the network
// topology this legacy assertion expects). Left in place, unfixed - fixing it is
// outside this task's scope.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 // patch579: a brand-new game (no localStorage - true of every fresh Playwright
 // context) now opens on a full-screen intro overlay that captures taps until
 // dismissed, same as a real player's SKIP. Close it up front so the real p.click()
 // calls below land on the actual UI instead of timing out against the overlay.
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 // deterministic, not a blind sleep - poll the actual DOM condition (patch581b
 // hardened sceneClose() to guarantee display:none within ~400ms either way).
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 // patch629 made #notice a fixed, full-viewport overlay while shown - a real
 // p.click() below can land on it instead of its target. checkUnlocks() runs
 // off tick()'s own requestAnimationFrame loop, entirely independent of this
 // file's own evaluate() calls, so an unlock can queue (and show) a notice in
 // the gap before any real click. This file has nothing to do with notices -
 // keep the queue drained for its whole run rather than chasing every site.
 const noticeJanitor=setInterval(()=>{
   p.evaluate(()=>{
     const G=window.__SD;
     if(G&&G.S&&G.S.notifyQueue&&G.S.notifyQueue.length){ G.S.notifyQueue.length=0; G.dirty=true; G.render(); }
   }).catch(()=>{});
 }, 150);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- data sanity
 const data=await p.evaluate(()=>{
   const G=__SD;
   const ids=G.SYS.map(s=>s.id);
   const adv=G.GENS.map((g,i)=>({i,exo:g.exo})).filter(x=>x.exo);
   return {
     dupes: ids.length!==new Set(ids).size,
     homes: G.SYS.filter(s=>s.home).length,
     ownerField: G.SYS.every(s=>'owner' in s),
     costsRise: G.SYS.filter(s=>!s.home).every((s,i,a)=>i===0||s.cost>a[i-1].cost),
     lvlsRise:  G.SYS.filter(s=>!s.home).every((s,i,a)=>i===0||s.lvl>=a[i-1].lvl),
     everyResHasSystem: G.EXO.every(e=>G.SYS.some(s=>s.res===e.id)),
     everyAdvHasRes: adv.every(x=>G.EXO.some(e=>e.id===x.exo)),
     everySysHasKind: G.SYS.every(s=>!!s.kind),
     // STAGE 2: "fits" is gone - a system builds exactly the ladder matching its kind
     // (LADDERS[kind]). Every kind (including "ore") needs a real ladder of at least
     // 3 tiers, and every GENS entry belongs to exactly one of the six kinds.
     everyKindHasLadder: G.LADDER_KINDS.every(k=>G.LADDERS[k].length>=3),
     everyGenHasOneKind: G.GENS.every(g=>G.LADDER_KINDS.includes(g.kind)),
     // every kind a held system can have (ore included, via the new ore-kind systems)
     // shows up at least twice across the map, per spec B.
     everyMapKindTwice: ['ore','rock','gas','belt','ice','void'].every(k=>
       G.SYS.filter(s=>!s.home&&s.kind===k).length>=2),
     // item 3 (patch566-569): the wheel is gone - every system now belongs to one of
     // the 5 sector pages (SECTORS[0..4]), and every page holds 4-6 systems (the
     // plan's own bound, matching the owner-approved mock).
     everySysHasSector: G.SYS.every(s=>Number.isInteger(s.sec)&&s.sec>=0&&s.sec<G.SECTORS.length),
     // patch613: raw SYS[].sec counts, not sysInSec(i) - that reads the level-8
     // reveal (PLAN-unify.md item 5) too, and this fixture runs at a fresh save's
     // default level. This assertion is about the SECTORS data definition itself,
     // not what a low-level save currently has revealed - sysInSec()'s own gating
     // gets its dedicated coverage below, in the sector-page UI section.
     everySectorInBounds: G.SECTORS.every((sc,i)=>{ const n=G.SYS.filter(s=>s.sec===i).length; return n>=4&&n<=6 }),
     parallel: [G.GENS.length]
   };
 });
 ok('system ids are unique', !data.dupes);
 ok('exactly one home system', data.homes===1, data.homes);
 ok('every system carries an owner field (for rivals later)', data.ownerField);
 ok('claim costs increase down the list', data.costsRise);
 ok('level requirements never decrease', data.lvlsRise);
 ok('every exotic is produced somewhere', data.everyResHasSystem);
 ok('every gated structure names a real exotic', data.everyAdvHasRes);
 ok('every system carries a kind', data.everySysHasKind);
 ok('every kind (ore included) has a ladder of at least 3 tiers', data.everyKindHasLadder);
 ok('every building belongs to exactly one kind', data.everyGenHasOneKind);
 ok('every kind appears at least twice on the map', data.everyMapKindTwice);
 ok('every system carries a sector (item 3: sectors replace the wheel)', data.everySysHasSector);
 ok('every sector page holds 4-6 systems', data.everySectorInBounds);

 // STAGE 2: GENS grew from 14 to 29 entries (five new 3-tier kind ladders). SITE (the
 // structure-site zoom background art) and the old 1:1 TCOL/ICONS indexing are BOTH
 // dead/unreachable in this build already (openSite() is never called from empire2's
 // UI - grepped, confirmed) or deliberately reused cyclically (iconFor/TCOL now index
 // modulo their own length, on purpose - see HANDOVER "art reuse"), so GENS outgrowing
 // them is expected, not a desync. What must NOT happen is iconFor() throwing for a
 // new, higher index.
 const par=await p.evaluate(()=>({gens:__SD.GENS.length, site:__SD.SITE_LEN}));
 ok('GENS outgrew SITE on purpose (dead feature, unreachable from empire2 UI) - STAGE 2 kind ladders',
    par.gens>par.site, par);
 // a kind-ladder tier (index >= SITE_LEN/ICONS.length) must still render a real icon,
 // reused cyclically rather than crashing on an out-of-range lookup.
 const iconRow=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:40, lvSeen:99, ore:1e30, sys:{kor:{dev:0,b:{14:1}}}, msel:'kor'});
   G.gotoTab('p-map'); dirty=true; render();
   const svg=document.querySelector('#sysBuildRows .g .gi svg');
   return {hasSvg:!!svg, hasPaths:svg?svg.querySelectorAll('path,circle,ellipse,rect,g').length>0:false};
 });
 ok('a kind-ladder tier renders a real, reused icon (no crash on the higher index)',
    iconRow.hasSvg&&iconRow.hasPaths, iconRow);
 // patch613: the icon check above opens the sheet (msel:'kor') and stays on the map
 // tab to read it - close it before the sections below, which click real map nodes
 // that the open sheet would otherwise sit on top of and intercept the click.
 await p.evaluate(()=>{ __SD.S.msel=null; dirty=true; render(); });
 await p.waitForTimeout(150);

 // ---------- claiming
 const claim=await p.evaluate(()=>{
   const G=__SD;
   const s=G.SYSMAP.kor;                          // read the gate from the data, so a
   G.adopt({...G.fresh(), all:1e30, lvl:s.lvl-1,  // retune cannot silently void this test
     lvSeen:99, ore:s.cost*10});
   const tooLow=G.claimSystem(s);                 // one level short
   G.S.lvl=s.lvl;
   const poor=(G.S.ore=1, G.claimSystem(s));      // high enough now, but broke
   G.S.ore=s.cost*10;
   const dm0=G.S.dm, ore0=G.S.ore;
   const good=G.claimSystem(s);
   const twice=G.claimSystem(s);                  // must not pay out again
   return {tooLow, poor, good, twice, held:G.sysHeld('kor'),
           paid:G.S.dm-dm0, spent:Math.round(ore0-G.S.ore),
           cost:s.cost, dm:s.dm, rate:G.exoRate('ir'),
           ladderLen:G.sysLadder('kor').length, tierCount:G.GENS.length};
 });
 ok('cannot claim below the level requirement', claim.tooLow===false);
 ok('cannot claim without the ore', claim.poor===false);
 ok('claiming works', claim.good===true&&claim.held);
 ok('claiming cannot be repeated', claim.twice===false);
 ok('it charges ore and pays Dark Matter',
    claim.spent===claim.cost&&claim.paid===claim.dm, claim);
 // PATCH 1 (v3 tuning): the extraction mechanic is gone - a held system produces
 // nothing until you actually build on it, on purpose (see HANDOVER). A fresh claim
 // must yield exactly zero, not "its exotic" the way the old dev-level system did.
 ok('a freshly claimed, unbuilt system yields exactly zero (production comes from buildings now)',
    claim.rate===0, claim.rate);
 // STAGE 2: no slots - a claimed system just starts empty on its own (kor is "rock")
 // ladder, with nothing owned yet.
 ok('a claimed system builds its own kind ladder, starting empty', claim.ladderLen>=3, claim);

 // ---------- PATCH 1: buildings replace extraction - a kind-ladder system's exotic
 //            rate is the sum of its own ladder rows, and rises as you build more
 const built=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sys:{kor:{b:{}}}});
   const s=G.SYSMAP.kor, rockTier=G.LADDERS.rock[0];
   const y0=G.sysExoRate('kor');
   const bought=G.ladderBuy('kor', rockTier);
   const y1=G.sysExoRate('kor');
   const costOnlyOre=!G.GENS[rockTier].exo;
   const unheld=G.ladderBuy('zen', rockTier);      // not ours
   return {y0,y1,bought,costOnlyOre,unheld};
 });
 ok('a claimed but unbuilt system yields zero', built.y0===0, built);
 ok('buying its first tier raises the yield', built.bought&&built.y1>built.y0, [built.y0,built.y1]);
 ok('the first tier cost ore only, no exotic', built.costOnlyOre, built);
 ok('cannot build on a system you do not hold', built.unheld===false);

 // ---------- exotic production actually accrues, and only from what you actually built
 const prod=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, sys:{kor:{b:{14:2,15:1}}}});
   const before=G.exo('ir');
   // read the rate BEFORE tick(), not after: tick() itself may unlock an achievement
   // (checkAchs() runs at the end of its own body) which changes globalMul() from that
   // point on - exoRate() read afterward would then describe a DIFFERENT, later rate
   // than the one tick() actually paid out with.
   const rateBefore=G.exoRate('ir');
   G.tick(100);
   return {before, after:G.exo('ir'), expect:rateBefore*100, he:G.exo('he')};
 });
 ok('exotics accrue over time', Math.abs(prod.after-prod.expect)<1e-6, prod);
 ok('only what you hold (and built on) produces', prod.he===0, prod.he);

 // ---------- gated structures — STAGE 2: ladderBuy/ladderCost/ladderMaxAff instead of
 //            the removed slotPlace/slotBuy/slotCost/slotMaxAff, keyed by (sysId, gi)
 //            not (sysId, slotIndex). Exotic cost is now fixed by the TIER itself, not
 //            by the hosting system's own resource (that mechanic is gone entirely -
 //            see HANDOVER "costs invert"), so this now runs on home's OWN ore ladder
 //            instead of needing a claimed system to host it.
 const gate=await p.evaluate(()=>{
   const G=__SD;
   const iri=G.GENS.findIndex(g=>g.exo==='ir'&&g.kind==='ore'); // Orbital Harvester
   G.adopt({...G.fresh(), all:1e18, lvl:40, lvSeen:99, ore:1e18});
   // own every earlier ore tier so the exotic-gated one is the next reveal
   for(let gi=0; gi<iri; gi++) G.ladderBuy('home', gi);
   const revealed = G.sysNextGi('home')===iri;
   // revealed does not mean AFFORDABLE - the whole point of STAGE 2 is you see the
   // price (exotic included) before you can pay it. No iridium banked yet:
   const cappedAtZero=G.ladderMaxAff('home',iri);
   G.S.exo={ir:10};
   const capped=G.ladderMaxAff('home',iri);
   const ore0=G.S.ore;
   G.S.buy=1;
   const bought=G.ladderBuy('home',iri);
   return {iri, revealed, cappedAtZero, capped, bought,
           exoLeft:G.exo('ir'), exoC:G.GENS[iri].exoC, spentOre:ore0>G.S.ore};
 });
 ok('an exotic-gated ore tier is revealed once every earlier tier is owned', gate.revealed, gate);
 ok('revealed but with no exotic banked, none can be bought', gate.cappedAtZero===0, gate);
 ok('holdings cap how many you can buy', gate.capped===Math.floor(10/gate.exoC), gate);
 ok('buying spends ore and exotic',
    gate.bought&&gate.spentOre&&gate.exoLeft===10-gate.exoC, gate);

 // scrapping: NOT APPLICABLE. Ladder tiers have no scrap/refund mechanic in this build -
 // out of scope by spec ("no ... building relocation/refunds"). sellGen does not exist
 // here, so the old assertion is dropped rather than faked.

 // ---------- holding systems helps even without needing the resource
 ok('each system adds an empire-wide bonus', await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e14, lvl:40, lvSeen:99});
   G.S.sys.home.b={0:5};                            // some baseline output to compare against
   const a=G.rate();
   G.S.sys.kor={dev:0, b:{}};
   G.S.sys.vel={dev:0, b:{}};
   return G.rate()>a; }));

 // ---------- the page
 await p.evaluate(()=>{ const G=__SD;
   G.adopt({...G.fresh(), all:5e12, lvl:26, lvSeen:99, ore:9e11,
     sys:{kor:{dev:1}}, exo:{ir:20}}); });
 await p.waitForTimeout(400);
 await p.click('.tab[data-p="p-map"]'); await p.waitForTimeout(500);
 // patch612: the old Empire accordion tab (#p-emp, #gens, #exoStrip) is gone
 // outright - one tab is the map now. Confirms the deletion is total, not a hide.
 const relocated=await p.evaluate(()=>({
   pEmpGone:!document.getElementById('p-emp'),
   gensGone:!document.getElementById('gens')
 }));
 ok('the old Empire pane (#p-emp) no longer exists', relocated.pEmpGone, relocated);
 ok('its accordion list (#gens) no longer exists', relocated.gensGone, relocated);
 // item 3 (patch566-569): the map is 5 sector pages now, not one wheel - each page
 // renders only its own systems (SYS[].sec), so "every system draws a node"/"is on
 // the network" are checked per CURRENT page, not against the whole SYS array. This
 // replaces the pre-existing "every system is on the network" failure noted above
 // (that assertion no longer makes sense against a paged map) rather than fixing it.
 async function pageUi(){
   return p.evaluate(()=>{
     const G=__SD, sec=G.mapSec, list=G.sysInSec(sec);
     const adj={};
     for(const l of document.querySelectorAll('#mapLinks line')){
       const a=l.dataset.a, b=l.dataset.b; if(!a||!b)continue;
       (adj[a]=adj[a]||[]).push(b); (adj[b]=adj[b]||[]).push(a);
     }
     const start=list[0]&&list[0].id;
     const seen=new Set(start?[start]:[]), q=start?[start]:[];
     while(q.length){ const c=q.pop(); for(const n of (adj[c]||[])) if(!seen.has(n)){seen.add(n);q.push(n)} }
     return {
       sec, sectorSize:list.length,
       nodes:document.querySelectorAll('#mapNodes .mnode').length,
       links:document.querySelectorAll('#mapLinks line').length,
       held:document.querySelectorAll('#mapNodes .mnode.held').length,
       open:document.querySelectorAll('#mapNodes .mnode.open').length,
       locked:document.querySelectorAll('#mapNodes .mnode.locked').length,
       reach:seen.size,
       laneCountMatchesData: G.SEC_LANES[sec].length===document.querySelectorAll('#mapLinks line[data-a]').length
     };
   });
 }
 const ui=await pageUi();
 ok('the current sector page renders exactly its own systems as nodes', ui.nodes===ui.sectorSize, ui);
 ok('every system on the current page is reachable via that page\'s own lanes', ui.reach===ui.sectorSize, ui);
 ok('the lane count matches SEC_LANES for this page', ui.laneCountMatchesData, ui);
 ok('home and claimed read as held', ui.held===2, ui.held);
 // Core (the default/home page) is all reachable at this fixture's level - switch to
 // Inner Reach (ring2, higher level requirements) to see a locked system.
 await p.evaluate(()=>__SD.setMapSec(1)); await p.waitForTimeout(300);
 const ui2=await pageUi();
 ok('the current sector page renders exactly its own systems as nodes (Inner Reach)', ui2.nodes===ui2.sectorSize, ui2);
 ok('every system on the current page is reachable via that page\'s own lanes (Inner Reach)', ui2.reach===ui2.sectorSize, ui2);
 ok('systems above your level read as locked', ui2.locked>0, ui2);
 await p.evaluate(()=>__SD.setMapSec(0)); await p.waitForTimeout(300);
 // every sector page's lane graph matches SEC_LANES and every one of its systems
 // renders and is reachable - not just the two pages exercised above.
 const allSectors=await p.evaluate(async ()=>{
   const G=__SD, out=[];
   for(let i=0;i<G.SECTORS.length;i++){
     G.setMapSec(i); await new Promise(r=>setTimeout(r,50));
     const list=G.sysInSec(i);
     out.push({
       i, nodes:document.querySelectorAll('#mapNodes .mnode').length, expect:list.length,
       lanes:document.querySelectorAll('#mapLinks line[data-a]').length, laneExpect:G.SEC_LANES[i].length
     });
   }
   G.setMapSec(0);
   return out;
 });
 ok('every sector page renders exactly its own systems, every time', allSectors.every(s=>s.nodes===s.expect), allSectors);
 ok('every sector page\'s lane count matches SEC_LANES, every time', allSectors.every(s=>s.lanes===s.laneExpect), allSectors);

 // patch612 (PLAN-unify.md): #exoStrip lived inside #p-emp, deleted outright with the
 // rest of the old Empire accordion - it has no current home (flagged for the
 // coordinator in HANDOVER, not decided here; see tnodes2.js/ttelegraph2.js for the
 // same open question). The four checks this block used to run against it are
 // dropped, not faked onto a DOM node that no longer exists.

 // claim through the real UI - back to the map, where claiming still happens
 await p.click('.tab[data-p="p-map"]'); await p.waitForTimeout(300);
 await p.click('.mnode[data-s="vel"]'); await p.waitForTimeout(350);
 const before=await p.evaluate(()=>({dm:__SD.S.dm, held:__SD.heldSystems().length}));
 await p.click('#sysClaim'); await p.waitForTimeout(450);
 const after=await p.evaluate(()=>({dm:__SD.S.dm, held:__SD.heldSystems().length,
   // patch412: DEVELOP moved off the map into the Empire tab's accordion body; the map
   // popup for a held system now shows only FORTIFY (defence stays with rivals/raids).
   // Re-pointed for PLAN-defences.md Run 2 (patch598): the single #sysFort button is
   // gone - a held system now shows the #sysDefRow cards instead.
   btn:!!document.getElementById('sysDefRow'), noDev:!document.getElementById('sysDev'),
   // PATCH 1: a fresh claim now yields exactly zero - see tladders2.js/the earlier
   // "yields exactly zero" assertion above for the dedicated coverage of that. Here
   // it just needs to not be a stale non-zero number left over from extraction.
   rate:__SD.exoRate('he')}));
 ok('claiming through the UI works', after.held===before.held+1, [before.held,after.held]);
 ok('it pays Dark Matter', after.dm>before.dm, [before.dm,after.dm]);
 ok('the panel switches to FORTIFY (defences row), not DEVELOP', after.btn&&after.noDev);
 ok('the freshly claimed system produces nothing yet (PATCH 1: no more baseline extraction)',
    after.rate===0, after.rate);

 // build a kind-ladder tier through the sheet's own BUILDINGS section (patch610) -
 // PATCH 1 replaced the old "develop through the UI" scenario (the DEVELOP/
 // EXTRACTION button is gone entirely, see HANDOVER); production still comes from
 // buying the first ladder row, just inline in the sheet instead of an accordion
 // row - the sheet is already open on vel from the claim just above.
 const opened=await p.evaluate(()=>!!document.querySelector('#sysBuildRows .g'));
 ok('the claimed system shows its ladder rows in the sheet', opened);
 ok('no pinned Extraction block renders any more (empDevBlock is gone)',
    !(await p.evaluate(()=>!!document.getElementById('sysDevEmp'))));
 ok('building the system\'s own next ladder tier through the sheet works', await (async()=>{
   const r0=await p.evaluate(()=>__SD.sysExoRate('vel'));
   await p.click('#sysBuildRows .g.next .gb, #sysBuildRows .g .gb'); await p.waitForTimeout(400);
   const r1=await p.evaluate(()=>__SD.sysExoRate('vel'));
   return r1>r0;
 })());

 // ---------- persistence
 await p.click('#btnSave'); await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('mask').classList.remove('on'));
 await p.reload(); await p.waitForTimeout(800);
 const rl=await p.evaluate(()=>({held:__SD.heldSystems().length,
   velRate:__SD.sysExoRate('vel'), ir:__SD.exo('ir')>0}));
 ok('systems survive a reload, including the tier just built', rl.held===2&&rl.velRate>0, rl);

 // a save naming a system that no longer exists must not break anything.
 // EMPIRE2: home is ALWAYS present in S.sys now (it holds its own slots from the start),
 // so the old "!('home' in G.S.sys)" half of this assertion is inverted on purpose.
 // PATCH 1: fixtures use the {b} shape (dev is gone); a stray `dev` key on an incoming
 // save (kor below) must be silently dropped, not crash or leak into state.
 ok('unknown systems in a save are dropped, home is always present, a stale dev key is dropped',
    await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e14, sys:{kor:{dev:2, b:{14:3}}, ghost:{dev:9}, home:{dev:1, b:{}}},
     exo:{ir:5, bogus:99}});
   return !('ghost' in G.S.sys) && ('home' in G.S.sys)
       && G.sysTierCount('kor',14)===3 && !('dev' in G.S.sys.kor) && !('bogus' in G.S.exo); }));

 clearInterval(noticeJanitor);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
