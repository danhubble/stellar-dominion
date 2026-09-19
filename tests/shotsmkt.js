const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for the owner's "bigger Market sales" ask (patch636) - the
// Market's own ×1/×10/×100/×1K/×10K/MAX AMOUNT chips. Not part of the regression suite -
// run manually, same pattern earlier batches' shot scripts used (see shotsclip.js/shotsD3.js).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });

 // fresh() alone is self-consistent (no pending level-up, no stray notice) - only
 // override the balances, so the six tiers' prices/costs read sensibly on screen.
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:5e7, cry:2e7, exo:{ir:5e5}, sh:[5,3,1]});
   G.S.clicks=30;   // dismisses the "Getting Started" tip (S.clicks>25 in render())
   G.gotoTab('p-mkt');
   document.querySelector('#p-mkt [data-mb="1000"]').click();   // ×1K selected, per the ask
 });
 await p.waitForTimeout(300);   // let any boot toast already in flight clear
 await p.evaluate(()=>{
   const G=window.__SD;
   document.querySelectorAll('.toast').forEach(t=>t.remove());
   // S.clicks=30 above crosses an unrelated "25 clicks" achievement's own XP grant
   // (checkAchs(), real tick()) a real player would only reach gradually, alongside
   // whatever a real player would also see along the way - acknowledge whatever level
   // that XP already earned, now that every tick above has actually run, so no stray
   // "level up ready" notice sits over this patch's own screenshot. Pre-existing
   // mechanic, unrelated to the Market - not fought before now because doing it any
   // earlier (tried first) raced the same tick() and got overwritten regardless.
   G.S.lvSeen=G.earnedLevel();
   G.S.notifyQueue=[];
 });
 await p.waitForTimeout(500);   // the notice bar's own opacity transition needs a real tick or two to settle out

 const info=await p.evaluate(()=>{
   const G=window.__SD;
   const chips=[...document.querySelectorAll('#p-mkt .buybar .chip')];
   const bar=document.querySelector('#p-mkt .buybar').getBoundingClientRect();
   return {
     mktBuy:G.mktBuy,
     chipCount:chips.length,
     chips:chips.map(c=>({label:c.textContent, on:c.classList.contains('on'),
       x:Math.round(c.getBoundingClientRect().x), right:Math.round(c.getBoundingClientRect().right)})),
     barRight:Math.round(bar.right), viewportWidth:390,
     sBuy:G.S.buy,
   };
 });
 console.log(JSON.stringify(info,null,2));
 await p.screenshot({path:SHOTS+'mkt-01-1k.png'});
 await b.close();
})();
