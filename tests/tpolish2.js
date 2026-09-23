const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tpolish2.js — PLAN-polish.md Batch A. One file covering the behaviour changes
// across items 1-13 that don't already have dedicated coverage elsewhere
// (ttaborder2.js/tmarket2.js/tnodes2.js/tprogresearch2.js were updated or already
// covered items 8/11 alongside this file - see their own headers).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- item 1: the very first level-up shows one message, not two ----------
 const lv1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), xpn:G.xpNeed(2), lvSeen:1, ore:0});
   document.getElementById('toasts').innerHTML='';
   G.checkLevel();
   return {
     toastCount:document.getElementById('toasts').children.length,
     queuedLvClaim:(G.S.notifyQueue||[]).includes('lvClaim'),
     seenLvClaim:!!(G.S.seen&&G.S.seen.lvClaim)
   };
 });
 ok('first-ever level-up: no toast (the lvClaim notice card is the one message)',
    lv1.toastCount===0, lv1);
 ok('...and lvClaim is queued/marked seen', lv1.queuedLvClaim&&lv1.seenLvClaim, lv1);

 const lv2=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('toasts').innerHTML='';
   G.S.xpn=G.xpNeed(3);
   G.checkLevel();
   return {toastCount:document.getElementById('toasts').children.length,
     toastText:document.getElementById('toasts').lastChild&&document.getElementById('toasts').lastChild.textContent};
 });
 ok('a later level-up (lvClaim already seen) DOES toast - only the first is suppressed',
    lv2.toastCount===1 && /ready.*LEVEL chip/.test(lv2.toastText||''), lv2);

 // ---------- item 3: "contracts" -> "missions" in player-facing strings ----------
 const strings=await p.evaluate(()=>{
   const G=window.__SD;
   return {
     vegaMissions:G.NOTICES['vega:missions'].t,
     hint:document.getElementById('p-mis').querySelector('.hint').textContent
   };
 });
 ok('VEGA\'s missions-unlock line says "missions", not "contracts"',
    /missions channel/i.test(strings.vegaMissions) && !/contracts channel/i.test(strings.vegaMissions), strings);
 ok('the Missions pane hint says "missions", not "contracts"',
    /missions/i.test(strings.hint) && !/contracts/i.test(strings.hint), strings);

 // ---------- item 4: vega:map's TAKE ME THERE lands on the map, no page open ----------
 const mapGo=await p.evaluate(()=>{
   const G=window.__SD;
   G.gotoTab('p-map'); G.S.msel='kor'; G.dirty=true; G.render();
   G.NOTICES['vega:map'].go();
   return {msel:G.S.msel, mapOn:document.getElementById('p-map').classList.contains('on')};
 });
 ok('vega:map TAKE ME THERE clears S.msel (closes any open system page)', mapGo.msel===null, mapGo);
 ok('...and lands on the Empire/map pane', mapGo.mapOn, mapGo);

 // ---------- item 6: first salvage earned pulses the salvage counter ----------
 const svPulseR=await p.evaluate(()=>{
   const G=window.__SD;
   G.gotoTab('p-raid');
   svPulse=true; dirty=true; render();
   return document.getElementById('svChip').classList.contains('land');
 });
 ok('#svChip gets the .land pulse class the frame svPulse is set', svPulseR);

 // ---------- item 8: Records & Graphs is gone; Achievements survives ----------
 const stats=await p.evaluate(()=>{
   return {
     kpisGone:!document.getElementById('kpis'),
     chartGone:!document.getElementById('chartBox'),
     mchipsGone:!document.getElementById('mchips'),
     linkText:document.getElementById('mktStatsLink').textContent,
     achGridExists:!!document.getElementById('ach')
   };
 });
 ok('the KPI tiles / production chart / measure chips are gone', stats.kpisGone&&stats.chartGone&&stats.mchipsGone, stats);
 ok('the ghost link is now labeled Achievements', /achievements/i.test(stats.linkText), stats);
 ok('the achievements grid itself is still there', stats.achGridExists, stats);

 const achDot=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), clicks:1});   // satisfies ACHS a1 ("First Contact")
   G.checkAchs();
   return document.querySelector('.tab[data-p="p-mkt"]').classList.contains('alert');
 });
 ok('unlocking a record no longer flags the Market tab (dot removed with the page)', !achDot);

 // ---------- item 9: TRANSFER gone from the Raids tab, kept on the fleet card ----------
 const transfer=await p.evaluate(()=>({ raidsTransferGone:!document.getElementById('flTransfer') }));
 ok('#flTransfer (Raids tab) is gone', transfer.raidsTransferGone);

 // ---------- item 10/12: buy-button label ----------
 // PLAN-polish batch B item 4: Fleet 2 now opens at level 16, not 14 - fixture
 // bumped so ensureFleets() actually adds it (level 14 would leave fleets()
 // length 1 and G.fleet(2) null, crashing the line right below).
 const buyLabel=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:16, lvSeen:16, xpn:G.xpNeed(16), ore:1e9, all:1e9});
   G.ensureFleets();   // adds Fleet 2
   const f2=G.fleet(2); f2.at='home'; f2.to=null;
   G.S.flSel=2;   // select Fleet 2's tab...
   const f1=G.fleet(1); f1.at='home'; f1.to=null;   // ...while Fleet 1 is the one idle at home
   f2.at='kor';   // Fleet 2 (selected) is away - buyShip() will land on Fleet 1 instead
   G.gotoTab('p-raid'); G.dirty=true; G.render();
   const btn=[...document.querySelectorAll('#flShips .shp')][0].querySelector('button i');
   return btn.textContent;
 });
 ok('BUY label names the fleet a purchase actually lands on when it isn\'t the selected tab',
    /BUY.*1ST FLEET/i.test(buyLabel), buyLabel);

 const noShipyard=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, all:1e9});
   const f1=G.fleet(1); f1.at='kor'; f1.to=null;   // no fleet idle at home at all
   G.gotoTab('p-raid'); G.dirty=true; G.render();
   const btn=[...document.querySelectorAll('#flShips .shp')][0].querySelector('button i');
   return btn.textContent;
 });
 ok('"NO SHIPYARD HERE" replaces the old "DELIVERS AT SOL REACH" placeholder',
    /NO SHIPYARD HERE/.test(noShipyard), noShipyard);

 // ---------- item 11: Command Lattice is inert (hidden, but csim-safe underneath) ----------
 const comm=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), exo:{he:1e6}, all:1e9});
   G.gotoTab('p-res'); resMode='prog'; syncResMode(); G.dirty=true; G.render();
   const names=[...document.querySelectorAll('#progList .card h5')].map(h=>h.textContent);
   return {names, stillBuyable:G.buyXp(G.xpDef('comm'))};
 });
 ok('Command Lattice has no card in the Programmes tab', !comm.names.some(n=>/Command Lattice/.test(n)), comm);
 ok('...but XPROG/buyXp() still work on it underneath (csim4.js is unaffected)', comm.stillBuyable, comm);

 // ---------- item 13: Getting Started hides once a system is claimed ----------
 const gs=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), clicks:0});
   G.S.sys['kor']={b:{}};   // held, per heldSystems()'s own sysHeld() check
   G.dirty=true; G.render();
   return !document.getElementById('tut');
 });
 ok('#tut (Getting Started) is gone once a system is held, even with 0 clicks/no structures', gs);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 if(errs.length){ console.log('JS ERRORS', errs); }
 await b.close();
})();
