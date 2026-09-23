const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tsave2.js — STAGE 2 (v3) rewrite, pointed at stellar-dominion-empire2.html.
//
// Previously covered the slot-shaped save. Rewritten for the ladder shape
// (S.sys[id] = {b}, b a plain {gi:count} map, no slots array, no capacity) and
// extended with the STAGE 2 promise from HANDOVER: a pre-v3 (slotted, empire2-shaped)
// save is REFUSED outright, not half-loaded or reinterpreted - same pattern as the
// existing pre-empire2 (global S.g) rejection right below it, which is untouched.
//
// PATCH 1 (v3 tuning pass): S.sys[id] dropped its `dev` field entirely (development/
// extraction is gone - see HANDOVER). This is NOT a hard-rejection case like the pre-
// v3 slots shape below: a save that still carries `dev` (from before this pass) just
// has it silently dropped by adopt()'s sanitizer, same as any other stale field -
// covered by the new "old-shape (dev-carrying) save" case near the end of this file.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 // patch579: close the brand-new-game intro overlay before the real #btnSave click
 // below - see tmap2.js for the full note.
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 // deterministic, not a blind sleep - see tmap2.js for the full note.
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- a normal STAGE 2 (ladder) save round-trips through reload ----------
 await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e12, lvl:20, lvSeen:20, ore:1e6,
     sys:{ home:{dev:0, b:{0:60,1:40,2:25,3:12}},
           kor:{dev:0, b:{14:5}} },
     exo:{ir:5}});
 });
 /* adopt() sets dirty and lets the game's own render loop pick it up on its next
    animation frame - which recomputes achBonus() from S.ac. Reading rate() in the
    SAME tick as adopt() races that frame: whether it has fired yet is scheduler
    jitter, not game state, and it showed up as this test flaking between two real
    numbers (4421 before the achievement pass, 5040 after). One frame of margin
    settles it before "before" is captured, so both reads see the same, settled state. */
 await p.waitForTimeout(100);
 const before=await p.evaluate(()=>({rate:Math.round(__SD.rate()), g0:__SD.gCount(0),
   held:__SD.heldSystems().length, homeTiers:Object.keys(__SD.S.sys.home.b).length,
   korRock:__SD.sysTierCount('kor',14)}));
 /* PLAN-polish batch A: a level-20 fixture now queues the Raids-open VEGA lines, whose
    fixed overlay covers the header - drain every queued notice before the click. */
 await p.evaluate(()=>{ let n=0; while(window.__SD.S.notifyQueue&&window.__SD.S.notifyQueue.length&&n++<20){ document.getElementById('noticeX').click(); } });
 await p.waitForTimeout(250);
 await p.click('#btnSave'); await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('mask').classList.remove('on'));
 await p.reload(); await p.waitForTimeout(800);
 const after=await p.evaluate(()=>({rate:Math.round(__SD.rate()), g0:__SD.gCount(0),
   held:__SD.heldSystems().length, homeTiers:Object.keys(__SD.S.sys.home.b).length,
   korRock:__SD.sysTierCount('kor',14)}));
 ok('a ladder save round-trips through reload', JSON.stringify(before)===JSON.stringify(after), {before,after});
 ok('the round-tripped save actually has structures', before.g0===60&&before.homeTiers===4&&before.korRock===5, before);

 // ---------- a pre-empire2 (populated global S.g) save is REFUSED, not half-loaded ----------
 await p.evaluate(()=>{
   const o={ore:5000,all:1e6,raw:9999,jam:1,rx:22,
     g:[{c:20},{c:10},{c:0},{c:0},{c:0},{c:0},{c:0},{c:0},{c:0},{c:0},{c:0},{c:0},{c:0},{c:0}],
     last:Date.now()};
   localStorage.setItem('stellar-dominion-v1', btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
 });
 const p2=await ctx.newPage(); await p2.goto(GAME_URL); await p2.waitForTimeout(700);
 const refused=await p2.evaluate(()=>({ore:__SD.S.ore, all:__SD.S.all, g0:__SD.gCount(0),
   raw:('raw' in __SD.S), homeB:JSON.stringify(__SD.S.sys.home.b)}));
 ok('a pre-empire2 save with buildings is refused (fresh game instead of a half-load)',
    refused.ore===0 && refused.all===0 && refused.g0===0 && !refused.raw && refused.homeB==='{}', refused);

 // ---------- an empty-g legacy save (nothing actually built) still loads normally -
 //            only a save that HAD buildings on the old global list is refused ----------
 await p2.evaluate(()=>{
   const o={ore:500,all:500,lvl:2,lvSeen:2,g:[{c:0},{c:0}],last:Date.now()};
   localStorage.setItem('stellar-dominion-v1', btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
 });
 const p3=await ctx.newPage(); await p3.goto(GAME_URL); await p3.waitForTimeout(700);
 const kept=await p3.evaluate(()=>({ore:__SD.S.ore, all:__SD.S.all}));
 ok('an empty-g legacy save (nothing built) still loads normally', kept.ore===500&&kept.all===500, kept);

 // ---------- a pre-v3 (slotted, empire2-shaped) save is REFUSED, not half-loaded or
 //            reinterpreted. Stage 2 is a fresh-save break, same rule as the empire2
 //            cutover above: a slot array is not a {gi:count} map, and silently
 //            reading one as the other would produce nonsense (slot index !== gi). ----------
 await p3.evaluate(()=>{
   const o={ore:777777, all:1e9, lvl:15, lvSeen:15,
     sys:{ home:{dev:0, slots:[{g:0,c:60},{g:1,c:40},null,null,null]},
           kor:{dev:0, slots:[null,null,null]} },
     exo:{ir:5}, last:Date.now()};
   localStorage.setItem('stellar-dominion-v1', btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
 });
 const p4=await ctx.newPage(); await p4.goto(GAME_URL); await p4.waitForTimeout(700);
 const v3refused=await p4.evaluate(()=>({ore:__SD.S.ore, all:__SD.S.all,
   homeB:JSON.stringify(__SD.S.sys.home.b), korHeld:__SD.sysHeld('kor')}));
 ok('a pre-v3 (slotted) save is refused (fresh game instead of a half-load / reinterpretation)',
    v3refused.ore===0 && v3refused.all===0 && v3refused.homeB==='{}' && !v3refused.korHeld, v3refused);

 // ---------- a save with an empty slots array (a held, undeveloped system predating
 //            v3) is ALSO refused - the check is "does any system carry a slots key
 //            at all", not "does it carry any non-null entries" ----------
 await p4.evaluate(()=>{
   const o={ore:1, all:1, lvl:1,
     sys:{ home:{dev:0, slots:[null,null,null,null,null]} }, last:Date.now()};
   localStorage.setItem('stellar-dominion-v1', btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
 });
 const p5=await ctx.newPage(); await p5.goto(GAME_URL); await p5.waitForTimeout(700);
 const emptySlotsRefused=await p5.evaluate(()=>({ore:__SD.S.ore, all:__SD.S.all}));
 ok('a pre-v3 save with only empty slots is also refused (fresh, not a default sys.home)',
    emptySlotsRefused.ore===0 && emptySlotsRefused.all===0, emptySlotsRefused);

 // ---------- PATCH 1: an old-shape save that still carries `dev` (from before this
 //            pass) is NOT refused - it loads normally, with `dev` just silently
 //            dropped, same as any other field the current shape no longer has ----------
 await p5.evaluate(()=>{
   const o={ore:4321, all:9e9, lvl:12, lvSeen:12,
     sys:{ home:{dev:3, b:{0:20,1:4}}, kor:{dev:2, b:{14:5}} },
     exo:{ir:7}, last:Date.now()};
   localStorage.setItem('stellar-dominion-v1', btoa(unescape(encodeURIComponent(JSON.stringify(o)))));
 });
 const p6=await ctx.newPage(); await p6.goto(GAME_URL); await p6.waitForTimeout(700);
 const oldDevKept=await p6.evaluate(()=>({
   ore:__SD.S.ore, all:__SD.S.all, held:__SD.heldSystems().length,
   homeTiers:__SD.gCount(0), korRock:__SD.sysTierCount('kor',14),
   homeHasDev:'dev' in __SD.S.sys.home, korHasDev:'dev' in __SD.S.sys.kor
 }));
 // ore/all only ever go UP between save and this read (production during the page's
 // own load wait), so >= rather than === - held is 1 because heldSystems() deliberately
 // excludes home (see its own definition), same as everywhere else in this file.
 ok('an old-shape save that still carries dev loads normally, buildings intact, dev dropped',
    oldDevKept.ore>=4321 && oldDevKept.all>=9e9 && oldDevKept.held===1
    && oldDevKept.homeTiers===20 && oldDevKept.korRock===5
    && !oldDevKept.homeHasDev && !oldDevKept.korHasDev, oldDevKept);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
