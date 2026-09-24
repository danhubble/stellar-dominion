const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tbatchc2.js — PLAN-polish.md Batch C: the mission strip, the Shipyard module, and
// the first-planet ambush. Governors v2 (the node max/GOV_SHARE/module-fit changes)
// is covered in tgov2.js instead, alongside the rest of the governor mechanic it
// extends. csim's own byte-identical invariant is asserted separately (`node
// tests/csim4.js | cmp - docs/sim/csim-baseline.txt`, run every commit) - this file
// exercises the same "never touched by the UI-only paths" boundary directly for the
// ambush, since that is the one feature here with any csim-adjacency at all (the
// strip is rendering-only and the Shipyard only changes where a UI purchase lands).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------------- mission strip ----------------
 const strip=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:3, xpn:60, ore:5000, mi:0, sys:{home:{b:{0:3}}}});
   G.S.msel="home"; G.S.seen=G.S.seen||{}; G.S.seen.tierReveal1=true;
   G.render();
   const strips=[...document.querySelectorAll('#sysBuildRows .mstrip')];
   const rows=[...document.querySelectorAll('#sysBuildRows .g')];
   const mining=rows.find(r=>r.querySelector('.gn').textContent.includes('Mining Drone'));
   const smelter=rows.find(r=>r.querySelector('.gn').textContent.includes('Smelter Pod'));
   return {
     n:strips.length,
     texts:strips.map(s=>s.textContent),
     miningStripped:!!(mining&&mining.classList.contains('mstripped')),
     smelterStripped:!!(smelter&&smelter.classList.contains('mstripped')),
     miningGold:!!(strips[0]&&getComputedStyle(strips[0]).boxShadow.includes('255, 209, 102')) // --gd
   };
 });
 ok('a strip appears under every row whose tier feeds one of the current 3 missions (Mining Drone + Smelter Pod, missions 0 and 2)',
   strip.n===2, strip);
 ok('the fed rows get "mstripped" (bottom corners square off)', strip.miningStripped&&strip.smelterStripped, strip);
 ok('the strip text shows the live have/need count', strip.texts.some(t=>t.includes('3/15'))&&strip.texts.some(t=>t.includes('0/10')), strip);
 ok('the strip is gold (--gd), not the row\'s own accent colour', strip.miningGold, strip);

 const stripGone=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.mi=3;   // past the first three missions - Mining Drones/Smelter Pods no longer in the window
   G.render();
   return [...document.querySelectorAll('#sysBuildRows .mstrip')].length;
 });
 ok('the strip disappears once the mission window moves past that tier', stripGone===0, stripGone);

 // ---------------- Shipyard ----------------
 const yard=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:30, ore:1e9, exo:{ir:1e9}, dm:1e6});
   const onHome = G.dmodBuild(G.SYSMAP.home, 0, "shy");   // home is ring 0
   const onKor = G.dmodBuild(G.SYSMAP.kor, 0, "shy");     // ring 1, not yet held
   G.claimSystem(G.SYSMAP.kor);
   const onKorHeld = G.dmodBuild(G.SYSMAP.kor, 0, "shy");
   return { onHome, onKor, onKorHeld, ring:G.SYSMAP.kor.ring };
 });
 ok('Shipyard cannot be built on home (ring 0)', yard.onHome===false, yard);
 ok('Shipyard cannot be built on an unheld system', yard.onKor===false, yard);
 ok('Shipyard builds on a held ring>=1 system', yard.onKorHeld===true && yard.ring>=1, yard);

 const yardBuy=await p.evaluate(()=>{
   const G=window.__SD;
   // finish the Shipyard build queued above
   G.S.def.kor.s[0].q.dueAt=Date.now()-1;
   G.dmodComplete();
   const hasYard=G.sysHasShipyard('kor');
   const cf=G.curFleet();
   cf.at='kor'; cf.to=null;
   const before=cf.sh.slice();
   const bought=G.buyShip(0,4);
   const after=cf.sh.slice();
   return { hasYard, bought, before, after };
 });
 ok('a ship bought while the selected fleet idles at a Shipyard system lands on it directly (no queue)',
   yardBuy.hasYard && yardBuy.bought && yardBuy.after[0]===yardBuy.before[0]+4, yardBuy);

 // ---------------- first-planet ambush ----------------
 const ambush=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:30, ore:1e9, exo:{ir:1e9}, dm:1e6});
   const claimed=G.claimSystem(G.SYSMAP.kor);
   const q=G.queueFirstAmbush(G.SYSMAP.kor);
   const th=G.thqAtSys('kor');
   const oddsNoModule=G.holdOdds(th);
   G.dmodBuild(G.SYSMAP.kor,0,'sen');
   G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   const oddsWithModule=G.holdOdds(G.thqAtSys('kor'));
   const secondCallRefused=G.queueFirstAmbush(G.SYSMAP.dra)===false && !G.thqAtSys('dra');
   return { claimed, q, due:th&&th.t, dif:th&&th.dif, oddsNoModule, oddsWithModule, secondCallRefused, seen:!!(G.S.seen&&G.S.seen.ambush) };
 });
 ok('claiming the first non-home system, then calling queueFirstAmbush() as the real claim handler does, queues a threat',
   ambush.claimed && ambush.q===true && !!ambush.due, ambush);
 ok('it is due in 90s', ambush.due===90, ambush);
 ok('it is weak enough that a single fitted module raises the hold odds comfortably above even money',
   ambush.oddsWithModule>0.75 && ambush.oddsWithModule>ambush.oddsNoModule, ambush);
 ok('S.seen.ambush is set, so it never fires a second time on a later claim', ambush.seen && ambush.secondCallRefused, ambush);

 const ambushCsimInert=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:30, ore:1e9, dm:1e6});
   // claimSystem() ALONE - exactly what csim4.js calls - must never queue an ambush.
   G.claimSystem(G.SYSMAP.kor);
   return { seen:!!(G.S.seen&&G.S.seen.ambush), thqLen:G.thq().length };
 });
 ok('claimSystem() alone (the function csim4.js calls) never queues the ambush or sets S.seen.ambush',
   !ambushCsimInert.seen && ambushCsimInert.thqLen===0, ambushCsimInert);

 const ambushOldSave=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:30, ore:1e9, sys:{home:{b:{}}, kor:{b:{0:5}}}});
   return !!(G.S.seen&&G.S.seen.ambush);
 });
 ok('an old save loaded already holding a non-home system is backfilled S.seen.ambush=true (never gets one on a later claim)',
   ambushOldSave, ambushOldSave);

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
