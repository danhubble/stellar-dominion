const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// ttaborder2.js — Stats moved to the end of the tab bar, then (patch563) that slot
// became Market; order is otherwise unchanged, and switching tabs by data-p (not
// position) still works. Stats itself (id p-ach) has no tab of its own any more -
// reached via the Market pane's "Records & graphs" ghost link - so this file no
// longer asserts a Stats tab exists, only that Market's does and opens p-mkt.
//
// patch608/612 (PLAN-unify.md): the Map pane is first now, labeled Empire, and the
// old #p-emp tab button is gone outright - not hidden, deleted. Order is Map,
// Missions, Research, Raids, Nexus, Market.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 const order=await p.evaluate(()=>[...document.querySelectorAll('.tab')].map(t=>t.dataset.p));
 ok('order is Empire (the map), Missions, Research, Raids, Nexus, Market',
    JSON.stringify(order)===JSON.stringify(['p-map','p-mis','p-res','p-raid','p-nex','p-mkt']), order);

 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e14, lvl:30, ore:1e9});
   dirty=true; render();
   document.querySelector('.tab[data-p="p-mkt"]').click();
 });
 await p.waitForTimeout(200);
 const clicked=await p.evaluate(()=>document.getElementById('p-mkt').classList.contains('on'));
 ok('clicking Market (now last) opens the Market pane', clicked);

 await p.evaluate(()=>{ document.getElementById('mktStatsLink').click(); });
 await p.waitForTimeout(200);
 const statsOn=await p.evaluate(()=>document.getElementById('p-ach').classList.contains('on'));
 ok('the "Records & graphs" ghost link opens the Stats pane', statsOn);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
