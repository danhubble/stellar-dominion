const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tpacing2.js — PLAN-pacing (commit 4): coverage for the four levers landed in
// commits 1-3. Unlock levels moved (Map 8->5, Raids 12->9) via a new unlockLv(p)
// helper; Node rates x4 (EN_RING3=4, EN_RING4=12); THE PROJECT header/per-card
// explanation text built from those constants and SECTORS, never hard-coded; the
// vega:project beat moved from first Node (S.en>0) to first ring-3+ claim.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- unlock levels are 5/9 ----------
 const lv=await p.evaluate(()=>{
   const G=window.__SD;
   return { map:G.UNLOCK.find(u=>u.p==='p-map').lv, raid:G.UNLOCK.find(u=>u.p==='p-raid').lv };
 });
 ok('UNLOCK: p-map is level 5', lv.map===5, lv);
 ok('UNLOCK: p-raid is level 9', lv.raid===9, lv);

 // ---------- map reveals systems at lv 5, not at 4 ----------
 const reveal=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},
     lvl:4, lvSeen:4, rs:{}, nx:{}, ab:[], buy:1, msel:null});
   const below=G.sysInSec(0).map(s=>s.id);
   G.S.lvl=5;
   const above=G.sysInSec(0).map(s=>s.id);
   return {below, above};
 });
 ok('below level 5, a sector page shows only home', reveal.below.length===1 && reveal.below[0]==='home', reveal.below);
 ok('at level 5, the same sector page shows every system in it', reveal.above.length>1 && reveal.above.includes('home'), reveal.above);

 // ---------- no double vega:map notice on an old save ----------
 const oldSaveSeen=await p.evaluate(()=>{
   const G=window.__SD;
   // a level-6 save that already saw the map notice must not get it queued again
   G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},
     lvl:6, lvSeen:6, rs:{}, nx:{}, ab:[], buy:1, msel:null, seen:{'vega:map':true}, notifyQueue:[]});
   const q1=G.S.notifyQueue.slice();
   G.checkUnlocks();
   return {q1, q2:G.S.notifyQueue.slice(), seen:G.S.seen['vega:map']};
 });
 ok('level-6 save with vega:map already seen: adopt() does not re-queue it',
   oldSaveSeen.q1.length===0 && oldSaveSeen.q2.length===0 && oldSaveSeen.seen===true, oldSaveSeen);

 const oldSaveUnseen=await p.evaluate(()=>{
   const G=window.__SD;
   // a level-6 save that predates the map unlock notice at all (no S.seen key) gets
   // it back-filled by adopt() the same way vega:missions/vega:research etc. do -
   // never queued fresh for a save that has plainly had a map for a long time.
   G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},
     lvl:6, lvSeen:6, rs:{}, nx:{}, ab:[], buy:1, msel:null});
   return {seen:G.S.seen['vega:map'], queued:G.S.notifyQueue.includes('vega:map')};
 });
 ok('level-6 save with no vega:map history: adopt() back-fills seen, does not queue it',
   oldSaveUnseen.seen===true && !oldSaveUnseen.queued, oldSaveUnseen);

 // ---------- Node rates ----------
 const rates=await p.evaluate(()=>{const SD=window.__SD,L=SD.S.lvl; SD.S.lvl=9; const cap9=SD.fleetCap(); SD.S.lvl=8; const cap8=SD.fleetCap(); SD.S.lvl=L; return {r3:SD.EN_RING3, r4:SD.EN_RING4, raidlv:SD.RAIDLV, cap9, cap8}});
 ok('EN_RING3===4', rates.r3===4, rates);
 ok('EN_RING4===12', rates.r4===12, rates);
 ok('RAIDLV reads UNLOCK (fleet cap opens at the Raids level, 9)', rates.raidlv===9 && rates.cap9>0 && rates.cap8===0, rates);

 // ---------- header line reads the constants ----------
 const claimFixture=()=>({
   ore:1e13, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},
   lvl:50, lvSeen:50, rs:{}, nx:{}, ab:[], buy:1, msel:null, seen:{}, notifyQueue:[],
 });
 const header=await p.evaluate((save)=>{
   const G=window.__SD;
   G.adopt(save);
   const anv=G.SYS.find(s=>s.id==='anv');   // cheapest unowned ring-3 system
   G.claimSystem(anv);
   G.gotoTab('p-nex'); G.dirty=true; G.render();
   const html=document.getElementById('nex').innerHTML;
   return { html, frontier:G.SECTORS.find(x=>x.key==='frontier').n,
     deep:G.SECTORS.find(x=>x.key==='deep').n, beyond:G.SECTORS.find(x=>x.key==='beyond').n };
 }, claimFixture());
 const wantExpl=`Nodes come from held systems in ${header.frontier} (4/h each), `
   +`${header.deep} and ${header.beyond} (12/h).`;
 ok('THE PROJECT header line is built from EN_RING3/EN_RING4/SECTORS, not hard-coded',
   header.html.includes(wantExpl), {wantExpl});

 // ---------- per-card "you make R/h - ~T to go" maths ----------
 const eta=await p.evaluate((save)=>{
   const G=window.__SD;
   G.adopt(save);
   const anv=G.SYS.find(s=>s.id==='anv');
   G.claimSystem(anv);   // ring 3, alone -> enRate() = EN_RING3/3600
   G.gotoTab('p-nex'); G.dirty=true; G.render();
   const html=document.getElementById('nex').innerHTML;
   const m=html.match(/you make ([\d.]+) Nodes\/h[^<]*/);
   const proj=G.NEXUS.find(r=>r.cur==='en');
   const cost=G.nexCost(proj, G.S.nx[proj.id]||0);
   const enR=G.enRate();
   const wantR=(enR*3600).toFixed(1);
   const wantT=G.fmtT(Math.max(0,(cost-(G.S.en||0))/enR));
   return { line:m?m[0]:null, wantR, wantT, enR, cost, en:G.S.en };
 }, claimFixture());
 ok('per-card line shows R=enRate()*3600 to one decimal', eta.line && eta.line.includes('you make '+eta.wantR+' Nodes/h'), eta);
 ok('per-card line\'s ~T matches (cost-S.en)/enRate() via fmtT()', eta.line && eta.line.includes('~'+eta.wantT+' to go'), eta);

 // ---------- VEGA project beat fires on first ring-3+ claim, before any Node lands ----------
 const project=await p.evaluate((save)=>{
   const G=window.__SD;
   G.adopt(save);
   const enBefore=G.S.en||0;
   const anv=G.SYS.find(s=>s.id==='anv');
   const claimed=G.claimSystem(anv);
   const enAfterClaim=G.S.en||0;   // claimSystem() itself must not grant any Nodes
   G.checkUnlocks();
   return { claimed, enBefore, enAfterClaim, queued:G.S.notifyQueue.includes('vega:project') };
 }, claimFixture());
 ok('claiming the first ring-3+ system queues vega:project while S.en is still 0',
   project.claimed && project.enBefore===0 && project.enAfterClaim===0 && project.queued, project);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
