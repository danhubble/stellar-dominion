const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for PLAN-ending.md Batch D, item D3 (patch591d/592/593
// - the ending screen + free play). Not part of the regression suite - run
// manually, same pattern earlier batches' shot scripts used (see shotsC.js/
// shotsD1.js/shotsD2.js).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // A won game with real numbers on every stat: some rival ground never bothered
 // with (still to claim post-peace), a couple of held systems, real XP-earned
 // records, a fabricated S.t0 so "time played" reads as a real duration.
 const setup = ()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:52, lvSeen:52, all:4.7e13, dm:1e15, wins:34,
     ac:{a1:1,a2:1,a5:1,a6:1,a11:1,a12:1,a23:1},
     sys:{ home:{b:{}}, kor:{b:{}}, tan:{b:{}}, nyx:{b:{}} },
     t0: Date.now() - (2*86400+7*3600+18*60)*1000 });
   G.finaleWon();
 };

 // 1. Ending title (stage 0)
 await p.evaluate((f)=>{ (0,eval)(f)(); }, setup.toString());
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD3-01-ending-title.png'});

 // 2. Stats block (stage 1)
 await p.evaluate(()=>{ window.__SD.endAdvance(); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD3-02-ending-stats.png'});

 // 3. END OF CHARTED SPACE strip, mid-glow (stage 2)
 await p.evaluate(()=>{ window.__SD.endAdvance(); });
 await p.waitForTimeout(500);
 await p.screenshot({path:SHOTS+'batchD3-03-ending-strip.png'});

 // 4. dim STORY.endLast, no avatar (stage 3)
 await p.evaluate(()=>{ window.__SD.endAdvance(); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD3-04-ending-last.png'});

 // 5. STORY.endTbc + CONTINUE together (stage 4, the final one - patch593b)
 await p.evaluate(()=>{ window.__SD.endAdvance(); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD3-05-ending-tbc-continue.png'});

 // A run this stat-inflated trips a pile of "Record unlocked" toasts the moment
 // the frame loop next ticks (checkAchs() against S.all/S.wins/level() all being
 // huge at once) - real game behaviour, but it would sit on top of every pane
 // screenshot below for no reason relevant to this batch, so clear it first each
 // time (the toast host itself, #toasts - nothing about achievements/state).
 const clearToasts=async()=>{ await p.evaluate(()=>{ const t=document.getElementById('toasts'); if(t)t.innerHTML=''; }); };

 // 6. Nexus pane: the pjx card reads COMPLETE - VIEW ENDING (S.end===2, real
 //    multipliers restored on every DM/Project card alongside it) - scrolled to
 //    THE PROJECT section, where pjx actually sits.
 await p.evaluate(()=>{
   const G=window.__SD;
   G.endClose();
   G.gotoTab('p-nex'); G.render();
 });
 // gotoTab() re-asserts its own (top-of-pane) scroll position one rAF after the
 // click, so the scrollIntoView below has to happen in a LATER evaluate(), once
 // that has already fired - not in the same synchronous call, which it would
 // otherwise just overwrite a frame later.
 await p.waitForTimeout(100);
 await p.evaluate(()=>{
   // pjx is the last card in the list (THE PROJECT's own last node) - scroll the
   // pane's real scroll container (#view) straight to the bottom. #view scrolls
   // smoothly by default (a plain scrollTop= assignment only starts that
   // animation, it does not land there - same reason gotoTab()'s own jump()
   // helper, ~line 10190, uses behavior:"instant" rather than a bare scrollTop=).
   const view=document.getElementById('view');
   if(view)view.scrollTo({top:view.scrollHeight, behavior:'instant'});
 });
 await p.waitForTimeout(150); await clearToasts();
 await p.screenshot({path:SHOTS+'batchD3-06-nexus-complete.png'});

 // 7. Map, Beyond sector: former rival systems now read as ordinary ore claims
 await p.evaluate(()=>{
   const G=window.__SD;
   G.gotoTab('p-map'); G.setMapSec(4); G.render();   // sector 4: Nyx's own sector, deep-map GARRISON territory
 });
 await p.waitForTimeout(150); await clearToasts();
 await p.screenshot({path:SHOTS+'batchD3-07-map-beyond-peace.png'});

 // 8. Raids pane: no pinned card, no Rival pressure block
 await p.evaluate(()=>{
   const G=window.__SD;
   G.gotoTab('p-raid'); G.render();
 });
 await p.waitForTimeout(150); await clearToasts();
 await p.screenshot({path:SHOTS+'batchD3-08-raids-at-peace.png'});

 await b.close();
})();
