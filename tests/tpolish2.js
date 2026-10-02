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
     hint:document.getElementById('p-mis').textContent   /* the dispatch ledger replaced the old .hint line */
   };
 });
 ok('VEGA\'s missions-unlock line says "missions", not "contracts"',
    /missions channel/i.test(strings.vegaMissions) && !/contracts channel/i.test(strings.vegaMissions), strings);
 ok('the Missions pane hint says "missions", not "contracts"',
    !/contracts/i.test(strings.hint), strings);

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
 // Ships are only ever bought into the fleet on screen, and only while it is docked
 // (Sol Reach or a Shipyard): away, the button says so and is disabled - it used to
 // take the ore and deliver the hulls to another fleet, or into a queue, so the
 // count on screen never moved.
 const buyLabel=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:16, lvSeen:16, xpn:G.xpNeed(16), ore:1e9, all:1e9});
   G.ensureFleets();   // adds Fleet 2
   const f1=G.fleet(1); f1.at='home'; f1.to=null;
   const f2=G.fleet(2); f2.at='kor'; f2.to=null;   // Fleet 2 is away...
   G.S.flSel=2;                                     // ...and is the fleet on screen
   G.gotoTab('p-raid'); G.dirty=true; G.render();
   const btn=[...document.querySelectorAll('#flShips .shp')][0].querySelector('button');
   const ore0=G.S.ore, bought=G.buyShip(0,1);
   const away={ text:btn.querySelector('i').textContent, disabled:btn.disabled, bought, spent:ore0-G.S.ore, f1:f1.sh[0], f2:f2.sh[0] };
   G.S.flSel=1; dirty=true; render();
   const b1=[...document.querySelectorAll('#flShips .shp')][0].querySelector('button');
   b1.click();
   return { away, home:{ text:b1.querySelector('i').textContent, f1:f1.sh[0] } };
 });
 ok('a fleet that is away cannot buy: the button reads FLEET NOT DOCKED, is disabled, and no ore is spent',
    /FLEET NOT DOCKED/.test(buyLabel.away.text) && buyLabel.away.disabled && buyLabel.away.bought===false &&
    buyLabel.away.spent===0 && buyLabel.away.f1===0 && buyLabel.away.f2===0, buyLabel);
 ok('a docked fleet buys into itself, and its own count goes up', /^BUY/.test(buyLabel.home.text) && buyLabel.home.f1===1, buyLabel);

 // ---------- item 11: Command Lattice is inert (hidden, but csim-safe underneath) ----------
 const comm=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), exo:{he:1e6}, all:1e9});
   /* programmes are cards in the four research trees now - look across all of them */
   G.gotoTab('p-res');
   const names=[];
   for(const t of G.TECH_TREES){ G.techTab=t.id; dirty=true; render();
     document.querySelectorAll('#techTree .tnode .tnm').forEach(h=>names.push(h.textContent)); }
   return {names, stillBuyable:G.buyXp(G.xpDef('comm'))};
 });
 ok('Command Lattice has no card in any research tree', !comm.names.some(n=>/Command Lattice/.test(n)), comm);
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
