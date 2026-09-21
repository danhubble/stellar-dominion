const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tgov2.js — PLAN-governors.md commit 5: the governor mechanic end to end. The node
// itself (id stays "auto", renamed Governors in copy) is covered by grep in the
// commit-1 message, not here - this file is the mechanic: appointing, the tick,
// the budget, the exotic gate, occupation, offline catch-up, and the pacing-sim
// invariant that makes all of it safe to ship (csim never sets S.sys[id].gov).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------------- node: max 3, cost curve unchanged ----------------
 const node=await p.evaluate(()=>{
   const G=window.__SD;
   const r=G.RESH.find(x=>x.id==="auto");
   return { max:r.max, name:r.n, c:r.c, cg:r.cg };
 });
 ok('the "auto" node (id unchanged) has max:3', node.max===3, node);
 ok('renamed Governors in copy', node.name==="Governors", node);
 ok('cost curve (c/cg) unchanged from the old Automation Cores', node.c===25&&node.cg===3.2, node);

 // ---------------- adopt() clamps an over-max save ----------------
 const clamp=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), rs:{auto:7}});
   return G.S.rs.auto;
 });
 ok('a save with S.rs.auto>3 (bought under the old max:10) is clamped to 3', clamp===3, clamp);

 // ---------------- toggle: appointing gates on govCount() < lv(S.rs,"auto") ----------------
 const toggle=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), rs:{drill:4,auto:1}, sys:{home:{b:{0:1}}, kor:{b:{0:1}}}});
   const onHome=G.govSetAppointed('home',true);
   const onKorRefused=G.govSetAppointed('kor',true);   // cap is 1, home already used it
   const cnt=G.govCount();
   const offHome=G.govSetAppointed('home',false);
   const onKorNow=G.govSetAppointed('kor',true);        // room again once home is off
   return { onHome, onKorRefused, cnt, offHome, onKorNow, homeGov:!!G.S.sys.home.gov, korGov:!!G.S.sys.kor.gov };
 });
 ok('appointing a governor is allowed while govCount()<lv(S.rs,"auto")', toggle.onHome, toggle);
 ok('a second appointment past the cap is refused', !toggle.onKorRefused, toggle);
 ok('govCount() reflects exactly the appointed systems', toggle.cnt===1, toggle);
 ok('un-appointing always succeeds, freeing the slot for another system', toggle.offHome&&toggle.onKorNow&&!toggle.homeGov&&toggle.korGov, toggle);
 const seenVega=await p.evaluate(()=>!!window.__SD.S.seen["vega:governor"]);
 ok('the first appointment ever made queues the vega:governor notice', seenVega, seenVega);

 // ---------------- tick: one buy per GOV_EVERY, never more ----------------
 // gb preloaded well past what any single tier could ever cost, so this isolates
 // the TIMING rule from the budget-accrual economics (tested separately below).
 const oneBuy=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e30, all:1e30, rs:{drill:4,auto:1}, lvl:20,
     sys:{home:{b:{0:5},gov:1,gb:1e30}}});
   const buysAt=[];
   for(let i=0;i<3;i++){
     for(let s=0;s<G.GOV_EVERY;s++)G.tick(1);   // GOV_EVERY seconds, 1 tick per second
     buysAt.push(G.S.govBuys||0);
   }
   return { buysAt, every:G.GOV_EVERY };
 });
 ok('exactly one purchase lands per GOV_EVERY of elapsed game time (never more than one per interval)',
   oneBuy.buysAt[0]===1 && oneBuy.buysAt[1]===2 && oneBuy.buysAt[2]===3, oneBuy);

 // ---------------- budget never exceeds GOV_SHARE of the empire's earnings ----------------
 const budget=await p.evaluate(()=>{
   const G=window.__SD;
   // EVERY tier on home's ladder pushed absurdly expensive (huge owned count) so
   // sysNextGi() is null (nothing left to reveal) and buying "one more" of any
   // owned tier costs astronomically more than 37 seconds of production could ever
   // bank - no purchase can land, isolating pure accrual from the spend-down side.
   const b={}; for(const gi of Array(14).keys())b[gi]=100000;
   G.adopt({...G.fresh(), ore:1e30, all:1e30, rs:{drill:4,auto:1}, lvl:20,
     sys:{home:{b,gov:1}}});
   // rate() can drift tick to tick (XP milestones bump globalMul() mid-run), so the
   // expectation is summed from the SAME live rate() govTick() itself reads each
   // tick, not one snapshot assumed constant across all 37 seconds.
   let expect=0;
   for(let i=0;i<37;i++){ expect+=G.rate()*1*G.GOV_SHARE; G.tick(1); }
   return { gb:G.S.sys.home.gb, expect, buys:G.S.govBuys||0 };
 });
 ok('with no purchase able to land, the budget accrues exactly rate()*dt*GOV_SHARE (one governor gets the whole share)',
   budget.buys===0 && Math.abs(budget.gb-budget.expect)<Math.max(1e-6,budget.expect*1e-6), budget);

 // ---------------- exotic gate: a reveal needing an exotic is skipped until it's there ----------------
 const exoGate=await p.evaluate(()=>{
   const G=window.__SD;
   // home owns tiers 0-3 heavily (astronomically expensive to buy MORE of), so the
   // only realistic candidate is the next reveal, gi 4 (Orbital Harvester, needs 1 ir).
   G.adopt({...G.fresh(), ore:1e30, all:1e30, exo:{}, rs:{drill:4,auto:1}, lvl:20,
     sys:{home:{b:{0:100000,1:100000,2:100000,3:100000},gov:1}}});
   const gi4=G.GENS[4];
   const withoutIr=G.govPickTier('home');
   G.S.exo.ir=gi4.exoC;
   const withIr=G.govPickTier('home');
   return { exoNeeded:gi4.exo, exoC:gi4.exoC, withoutIr, withIr };
 });
 ok('govPickTier() never returns an exotic-gated reveal while the exotic is missing',
   exoGate.withoutIr!==4, exoGate);
 ok('...and returns it once the exotic is actually there (nothing else is a cheaper candidate)',
   exoGate.withIr===4, exoGate);

 // ---------------- occupation suspends: zero accrual, zero purchases, while occupied ----------------
 const occSuspend=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, exo:{ir:1e9}, rs:{drill:4,auto:1}, lvl:20,
     sys:{home:{b:{}}, kor:{b:{0:1},gov:1}}});
   G.S.occ.kor="hel";
   const before=JSON.stringify(G.S.sys.kor);
   for(let i=0;i<G.GOV_EVERY*3;i++)G.tick(1);
   const during=JSON.stringify(G.S.sys.kor);
   delete G.S.occ.kor;
   G.S.sys.kor.gb=1e30;   // isolate "does it resume" from the budget economics, same as oneBuy above
   for(let i=0;i<G.GOV_EVERY+1;i++)G.tick(1);
   const buysAfterReclaim=G.S.govBuys||0;
   return { unchanged: before===during, buysAfterReclaim };
 });
 ok('an occupied system\'s governor accrues nothing and buys nothing while occupied',
   occSuspend.unchanged, occSuspend);
 ok('...and resumes (buys again) once the system is reclaimed', occSuspend.buysAfterReclaim>0, occSuspend);

 // ---------------- offline catch-up: capped at one attempt per GOV_EVERY of away time, max 50 ----------------
 const offline=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e30, all:1e30, rs:{drill:4,auto:1}, lvl:20, sys:{home:{b:{0:5},gov:1}}});
   G.offlineGovCatchup(37*G.GOV_EVERY, 1);   // 37 intervals worth, under the 50 cap
   const buysShort=G.S.govBuys||0;
   G.adopt({...G.fresh(), ore:1e30, all:1e30, rs:{drill:4,auto:1}, lvl:20, sys:{home:{b:{0:5},gov:1}}});
   G.offlineGovCatchup(1e7, 1);              // absurdly long away time
   const buysLong=G.S.govBuys||0;
   return { buysShort, buysLong };
 });
 ok('offline catch-up never makes more purchase attempts than the away time allows (37 intervals here)',
   offline.buysShort>0 && offline.buysShort<=37, offline);
 ok('offline catch-up is capped at 50 attempts no matter how long the absence',
   offline.buysLong>0 && offline.buysLong<=50, offline);

 // ---------------- csim invariant: governors are inert unless S.sys[id].gov is set ----------------
 // The actual byte-identical proof is `node tests/csim4.js | cmp - docs/sim/csim-
 // baseline.txt` (run separately, every commit) - csim4.js never sets .gov anywhere
 // (grepped). This is the same invariant, exercised directly: with no system
 // governed, a long run of tick() must leave S.sys untouched by anything governor-
 // related (no gb/gt/gl fields appear, S.govBuys stays unset) - the exact condition
 // that keeps the pacing sim's output from moving.
 const inert=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, rs:{drill:4,auto:1}, lvl:20, sys:{home:{b:{0:2}}, kor:{b:{0:1}}}});
   const before=JSON.stringify(G.S.sys);
   for(let i=0;i<500;i++)G.tick(1);
   const after=JSON.stringify(G.S.sys);
   return { untouched: before===after, govBuys:G.S.govBuys };
 });
 ok('with no system governed, 500 ticks leave S.sys completely untouched by governor bookkeeping',
   inert.untouched && inert.govBuys===undefined, inert);

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
