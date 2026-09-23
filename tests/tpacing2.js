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

 // ================== PLAN-polish batch B (five commits, csim before/after in
 // docs/HANDOVER.md): LVXP_PTS[3], one-level-per-check, Market->9, FLEET_UNLOCK
 // 16/22, and per-system t0 ==================

 // ---------- item 1: LVXP_PTS[3] ----------
 const lvxp3=await p.evaluate(()=>({v:window.__SD.LVXP_PTS[3]}));
 ok('LVXP_PTS[3] is the new, lower anchor (55, not the old ~87 interpolation)',
   lvxp3.v===55, lvxp3);

 // ---------- item 2: one level per check, surplus banked ----------
 const burst=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:5, lvSeen:5});
   const pendBefore=G.pendingLevels();
   // exactly 3 levels' worth of XP in one grant, same shape as four missions
   // claimed at once or several firsts paid by a single claim.
   G.grantXp('test:burst', G.xpNeed(8)-G.xpNeed(5), null);
   G.checkLevel();
   const pendAfterFirstCheck=G.pendingLevels();
   G.checkLevel();
   const pendAfterSecondCheck=G.pendingLevels();
   G.checkLevel();
   const pendAfterThirdCheck=G.pendingLevels();
   return { pendBefore, pendAfterFirstCheck, pendAfterSecondCheck, pendAfterThirdCheck };
 });
 ok('before the burst, nothing is pending', burst.pendBefore===0, burst);
 ok('a 3-level XP burst advances pendingLevels() by exactly ONE on the check right after it (surplus banked, not spent)',
   burst.pendAfterFirstCheck===1, burst);
 ok('...and the next level arrives on the NEXT check, one at a time',
   burst.pendAfterSecondCheck===2, burst);
 ok('...and the third (last banked) level on the check after that',
   burst.pendAfterThirdCheck===3, burst);

 // ---------- item 3: Market unlocks at 9, not 8 ----------
 const mktLv=await p.evaluate(()=>{
   const G=window.__SD;
   const u=G.UNLOCK.find(x=>x.p==='p-mkt');
   G.adopt({...G.fresh(), lvl:8, lvSeen:8}); const at8=G.unlockedAt('p-mkt');
   G.adopt({...G.fresh(), lvl:9, lvSeen:9}); const at9=G.unlockedAt('p-mkt');
   return { lv:u.lv, at8, at9 };
 });
 ok('UNLOCK: p-mkt.lv is 9', mktLv.lv===9, mktLv);
 ok('Market is locked at level 8...', mktLv.at8===false, mktLv);
 ok('...and unlocked at level 9 (same level as Raids)', mktLv.at9===true, mktLv);

 // ---------- item 4: FLEET_UNLOCK values ----------
 const fu=await p.evaluate(()=>({v:window.__SD.FLEET_UNLOCK, raidLv:window.__SD.unlockLv('p-raid')}));
 ok('FLEET_UNLOCK is [unlockLv("p-raid"), 16, 22]',
   JSON.stringify(fu.v)===JSON.stringify([fu.raidLv,16,22]), fu);

 // ---------- item 5: t0 selection ----------
 // Draskhold (dra) is an ore-kind system - the plan's own example ("Draskhold at
 // millions of ore starts on Crust Borers, not Mining Drones"). Built up so
 // rate() lands close to 1e6/s: 9766 Mining Drones on home, past every MILE
 // doubling (mileMul()=512): 9766*0.2*512 ~= 1,000,038/s.
 const t0rich=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:12, lvSeen:12, ore:1e7, sys:{home:{b:{0:9766}}}});
   const rate=G.rate();
   const dra=G.SYS.find(s=>s.id==='dra');
   const claimed=G.claimSystem(dra);
   const t0=G.sysState('dra').t0;
   // independent replica of the claim-time selection, straight from GENS/costMul -
   // not a call into sysT0()/claimSystem() itself, so this actually checks the maths.
   const threshold=rate*60*0.01;
   const ladder=G.sysLadder('dra');
   let want=ladder[ladder.length-1];
   for(const gi of ladder){ if(G.GENS[gi].b*G.costMul()>=threshold){ want=gi; break; } }
   const nextGi=G.sysNextGi('dra');
   const skippedBuildable=[0,1,2,3,4].map(gi=>G.tierBuildable('dra',gi));
   const revealBuildable=G.tierBuildable('dra',t0);
   return { rate, claimed, t0, want, nextGi, skippedBuildable, revealBuildable };
 });
 ok('rate() lands close to 1e6/s for this fixture', t0rich.rate>9e5 && t0rich.rate<1.1e6, t0rich);
 ok('a rich claim\'s t0 matches the lowest tier whose first unit costs >=1% of rate()*60 (gi 5, Fusion Forge)',
   t0rich.claimed && t0rich.t0===t0rich.want && t0rich.t0===5, t0rich);
 ok('...sysNextGi() lands on t0, not tier 0 (Mining Drone is skipped, not shown-then-bought)',
   t0rich.nextGi===t0rich.t0, t0rich);
 ok('...every tier below t0 (0-4) is not buildable at all', t0rich.skippedBuildable.every(b=>b===false), t0rich);
 ok('...and t0 itself is buildable (the reveal)', t0rich.revealBuildable===true, t0rich);

 const t0fresh=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:12, lvSeen:12, ore:1e7});   // rate()===0, no structures at all
   const rate=G.rate();
   const dra=G.SYS.find(s=>s.id==='dra');
   const claimed=G.claimSystem(dra);
   return { rate, claimed, t0:G.sysState('dra').t0, nextGi:G.sysNextGi('dra') };
 });
 ok('a fresh save (rate()===0) claims with t0 unset (reads as 0 via sysT0()) - nothing skipped',
   t0fresh.claimed && t0fresh.rate===0 && !t0fresh.t0 && t0fresh.nextGi===0, t0fresh);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
