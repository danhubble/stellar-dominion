const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tsheet2.js — PLAN-defences.md Run 1 (patches 594-596): the system sheet.
// Pointed at stellar-dominion-empire2.html, following tmap2.js/tchurn2.js's own
// style (window.__SD as G, adopt({...}) to stage each scenario).
//
// #sysInfo/#sysAct keep their ids and their exact guarded-render behaviour
// (patch595's own header note) - tmap2.js and tchurn2.js needed NO assertion
// changes for that reason (both already pass unmodified against the new
// structure; confirmed by running them after 594-596, see HANDOVER). This file
// is the new coverage patch596 asks for: the sheet shell itself (open/close,
// the four states, the two new ids #sysThreat/#sysThreatActs) rather than the
// claim/assault/fortify mechanics tmap2.js/tchurn2.js already own.
const { chromium } = require('playwright-core');
const URL=GAME_URL;

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 // patch629 made #notice a fixed, full-viewport overlay while shown - the real
 // coordinate clicks below (outside-tap-close, DEFEND IT/LET THEM HOLD, `< MAP`)
 // can land on it instead of their target. checkUnlocks() runs off tick()'s own
 // requestAnimationFrame loop, independent of this file's own evaluate() calls,
 // so an unlock can queue (and show) a notice in the gap before any of them.
 // This file has nothing to do with notices - keep the queue drained for its
 // whole run rather than chasing every real-click site.
 const noticeJanitor=setInterval(()=>{
   p.evaluate(()=>{
     const G=window.__SD;
     if(G&&G.S&&G.S.notifyQueue&&G.S.notifyQueue.length){ G.S.notifyQueue.length=0; G.dirty=true; G.render(); }
   }).catch(()=>{});
 }, 150);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 async function sheetState(){
   return await p.evaluate(()=>{
     const g=id=>!!document.getElementById(id);
     return {
       // patch628b: #sysSheet.open is gone - visibility derives from body.syspage
       // now (body.syspage #sysSheet{display:block}), the coordinator's review
       // caught .open as a second class duplicating that one fact.
       open: document.body.classList.contains('syspage'),
       infoText: (document.getElementById('sysInfo').textContent||''),
       threatHidden: document.getElementById('sysThreat').hidden,
       actsHidden: document.getElementById('sysThreatActs').hidden,
       // Re-pointed for PLAN-defences.md Run 2 (patch598): the single #sysFort button
       // is gone - a held system shows #sysDefWrap (un-hidden) with its per-slot cards.
       hasClaim: g('sysClaim'), hasFort: g('sysDefWrap')&&!document.getElementById('sysDefWrap').hidden,
       hasWar: g('sysWar'), hasTripCd: g('sysTripCd'),
       hasThreatGo: g('sshThrGo'), hasThreatHold: g('sshThrHold')
     };
   });
 }
 // in-page .click() (not Playwright's coordinate-based click) on purpose: a node
 // can sit anywhere on the map, including under the open sheet's own footprint
 // (the sheet is deliberately allowed to cover part of the map - "outside it"
 // is what has to stay reachable, not everything), so a real hit-test click
 // would time out on a node the sheet currently overlaps even though the exact
 // same onclick the game wires up fires identically either way. Real
 // coordinate clicks are still used below for the things that must prove real
 // hit-testing works: the outside-tap-close and the grab-handle drag.
 async function selectNode(id){
   await p.evaluate(()=>{ const t=document.querySelector('.tab[data-p="p-map"]'); if(t)t.click(); });
   await p.waitForTimeout(150);
   await p.evaluate((sid)=>{
     const node=document.querySelector('.mnode[data-s="'+sid+'"]');
     if(node)node.click(); else { const G=window.__SD; G.S.msel=sid; dirty=true; render(); }
   }, id);
   await p.waitForTimeout(200);
 }

 // ---------------- UNCLAIMED ----------------
 await p.evaluate(()=>{ const G=window.__SD; G.adopt({...G.fresh(), lvl:20, lvSeen:20}); });
 await selectNode('vel');
 let st=await sheetState();
 ok('unclaimed: sheet opens on node tap', st.open, st);
 ok('unclaimed: shows CLAIM, nothing else', st.hasClaim && !st.hasFort && !st.hasWar && !st.hasTripCd, st);
 ok('unclaimed: no threat block, no threat actions', st.threatHidden && st.actsHidden, st);

 // ---------------- CONTESTED (not yet en route) ----------------
 await selectNode('tan');
 st=await sheetState();
 ok('contested: sheet opens showing ASSAULT/RETAKE, not CLAIM/FORTIFY', st.open && st.hasWar && !st.hasClaim && !st.hasFort, st);
 ok('contested: garrison/archetype rows are in the info text', /Garrison/.test(st.infoText) && /Archetype/.test(st.infoText), st);
 ok('contested: no threat block (threats only ever target what you hold)', st.threatHidden && st.actsHidden, st);

 // ---------------- CONTESTED - en route ----------------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.S.ore=1e9; G.S.fl[0].hp=1; G.buyShip(0,10);   // fixture moved to S.fl[0] (PLAN-fleets run 1)
   if(!G.S.trip)G.launchAssault(G.SYSMAP.tan);
 });
 await selectNode('tan');
 st=await sheetState();
 ok('contested (en route): shows an EN ROUTE countdown, not ASSAULT/ENGAGE', st.open && st.hasTripCd && !st.hasWar, st);

 // ---------------- CONTESTED - arrived (ENGAGE) ----------------
 await p.evaluate(()=>{ const G=window.__SD; if(G.S.trip)G.S.trip.dueAt=Date.now()-1000; });
 await selectNode('tan');
 st=await sheetState();
 ok('contested (arrived): shows ENGAGE', st.open && st.hasWar && !st.hasTripCd, st);

 // ---------------- HELD (no threat) ----------------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, ore:1e9, exo:{ir:1e6,he:1e6,xe:1e6,am:1e6}});
   G.claimSystem(G.SYSMAP.kor);
 });
 await selectNode('kor');
 st=await sheetState();
 ok('held: sheet opens showing FORTIFY, not CLAIM/ASSAULT', st.open && st.hasFort && !st.hasClaim && !st.hasWar, st);
 ok('held: no threat block when nothing is queued against it', st.threatHidden && st.actsHidden, st);

 // ---------------- UNDER ATTACK ----------------
 await p.evaluate(()=>{
   const G=window.__SD;
   if(!G.thqAt(90001))G.thq().push({id:90001, rv:'hel', sysId:'kor', dif:1, t:5000});
 });
 await selectNode('kor');
 st=await sheetState();
 ok('under attack: threat block + DEFEND IT / LET THEM HOLD both show', st.open && !st.threatHidden && !st.actsHidden && st.hasThreatGo && st.hasThreatHold, st);
 ok('under attack: the defences row (FORTIFY) still shows alongside it - no gameplay change', st.hasFort, st);

 const order=await p.evaluate(()=>{
   const sheet=document.getElementById('sysSheet');
   const kids=[...sheet.children].map(c=>c.id);
   return kids;
 });
 ok('sheet DOM order matches the mock: threat block, then info/act, then threat actions',
   order.indexOf('sysThreat')<order.indexOf('sysInfo') &&
   order.indexOf('sysAct')<order.indexOf('sysThreatActs'), order);

 // DEFEND IT calls the real startDefence() (same function the Raids thrCard uses)
 await p.click('#sshThrGo'); await p.waitForTimeout(150);
 const dtOpen=await p.evaluate(()=>!!window.__SD.DT);
 ok('DEFEND IT opens the real defence mini-game via startDefence()', dtOpen);
 await p.evaluate(()=>{
   const G=window.__SD;
   if(G.DT)G.closeDefence();
   G.thqDrop(90001);   // closeDefence() only closes the UI, it does not resolve/drop
                        // the threat - drop it explicitly so the next check starts clean
 });

 // LET THEM HOLD calls the real holdLine()/holdResolve() and resolves the threat
 await p.evaluate(()=>{
   const G=window.__SD;
   if(!G.thqAt(90002))G.thq().push({id:90002, rv:'hel', sysId:'kor', dif:1, t:5000});
 });
 await selectNode('kor');
 await p.click('#sshThrHold'); await p.waitForTimeout(150);
 const resolved=await p.evaluate(()=>!window.__SD.thqAtSys('kor'));
 ok('LET THEM HOLD resolves the threat via the real holdLine()/holdResolve()', resolved);

 // ---------------- selecting another system while open re-renders, not closes ----------------
 await selectNode('kor');
 await p.waitForTimeout(150);
 await selectNode('tan');
 st=await p.evaluate(()=>({open:document.body.classList.contains('syspage'), msel:window.__SD.S.msel}));
 ok('selecting another system while open re-renders the sheet instead of closing it', st.open && st.msel==='tan', st);

 // ---------------- close: `< MAP` (patch626/627 - the X button, #sshClose, is deleted) ----------------
 await selectNode('kor');
 await p.click('#mapZoomBack'); await p.waitForTimeout(400);
 let closed=await p.evaluate(()=>({open:document.body.classList.contains('syspage'), msel:window.__SD.S.msel}));
 ok('`< MAP` closes the page (replaces the deleted X button)', !closed.open && closed.msel===null, closed);

 // ---------------- the map-background-tap-to-close path is gone (patch627, deleted outright) ----------------
 // PLAN-page.md names this as one of the old close paths to delete, not redirect -
 // `< MAP` above is the only closing affordance left. Kept as an inverse
 // regression guard: if a future patch reintroduces a stray handler here, this
 // catches it.
 await selectNode('kor');
 await p.evaluate(()=>{ document.getElementById('mapWrap').dispatchEvent(new MouseEvent('click',{bubbles:true})); });
 await p.waitForTimeout(400);
 let stillOpen=await p.evaluate(()=>({open:document.body.classList.contains('syspage'), msel:window.__SD.S.msel}));
 ok('tapping the map background no longer closes the page (that close path was deleted, patch627)', stillOpen.open && stillOpen.msel==='kor', stillOpen);
 await p.click('#mapZoomBack'); await p.waitForTimeout(400); // clean up before the next scenario

 // a tap ON a node still opens/selects it (unaffected by the deletion above)
 await selectNode('kor');
 st=await p.evaluate(()=>({open:document.body.classList.contains('syspage'), msel:window.__SD.S.msel}));
 ok('tapping a node still opens/selects it', st.open && st.msel==='kor', st);

 // ---------------- the grab-handle drag / three-state FULL-PEEK-CLOSED machine is gone ----------------
 // patch620/623's own mechanic, deleted outright by patch626/627 (PLAN-page.md:
 // "deleted, not disabled"): #sshGrab does not exist in the markup any more, and
 // __SD.sheetState/setSheetState() are gone from the debug export. `< MAP`
 // (tested above) is the only close gesture left - there is no PEEK rest state
 // to step through any more.

 // ---------------- Empire tab row -> Map ----------------
 // patch612: dropped. This drove a separate Empire LIST tab (patch416's
 // .sysrow2 rows) to select a system and land on Map with its sheet open - that
 // list does not exist any more (Map/Empire is one tab now) and its Run 3
 // replacement (patch614's MAP | LIST toggle) is not built yet. Not faked here;
 // Run 3's tunify2.js covers the LIST-row -> sheet path once it exists.

 // ---------------- no churn: countdowns update text in place, never a new node ----------------
 async function noChurn(selector, label, waitMs){
   const found=await p.evaluate((sel)=>{
     const el=document.querySelector(sel); if(!el)return false;
     el.__noChurnMark=true; return true;
   }, selector);
   if(!found){ ok(label+' (element not found)', false); return; }
   await p.waitForTimeout(waitMs||600);
   const survived=await p.evaluate((sel)=>{ const el=document.querySelector(sel); return !!(el&&el.__noChurnMark); }, selector);
   ok(label, survived);
 }
 // Re-pointed for PLAN-defences.md Run 2 (patch598): sdQueued()/buySysDef() are gone -
 // queue a real module build in slot 0 and watch that slot's own card (#sysDefRow's
 // live countdown lives in a nested .cardcd span, same guarded idiom #sysFort used).
 await p.evaluate(()=>{
   const G=window.__SD;
   G.S.exo.ir=(G.S.exo.ir||0)+1e6;
   if(!G.S.def||!G.S.def.kor||!G.S.def.kor.s.some(sl=>sl&&sl.q))G.dmodBuild(G.SYSMAP.kor,0,'tur');
 });
 await selectNode('kor');
 await noChurn('#sysDefRow .sc[data-slot="0"]', 'held (fortifying): the slot 0 card does not churn while its countdown ticks');

 await p.evaluate(()=>{
   const G=window.__SD;
   if(!G.thqAt(90003))G.thq().push({id:90003, rv:'hel', sysId:'kor', dif:1, t:5000});
 });
 await selectNode('kor');
 await noChurn('#sshThrGo', 'under attack: DEFEND IT does not churn while the clock ticks');
 await noChurn('#sshThrHold', 'under attack: LET THEM HOLD does not churn while the clock ticks');

 clearInterval(noticeJanitor);
 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 const fails=out.filter(l=>l.startsWith('FAIL')).length;
 console.log(fails+' failures');
 console.log(errs.length?('JS ERRORS: '+errs.join(' | ')):'NO JS ERRORS');
 await b.close();
})();
