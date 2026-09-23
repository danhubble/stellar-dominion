const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// Polish batch A item 7: the wired result. One-off, not part of the regression suite.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 for(const h of [667,844]){
   const ctx=await b.newContext({viewport:{width:390,height:h},isMobile:true,deviceScaleFactor:2});
   const p=await ctx.newPage();
   await p.goto(GAME_URL); await p.waitForTimeout(400);
   await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
   await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
   await p.evaluate(()=>{
     const G=window.__SD;
     G.adopt({...G.fresh(), lvl:9, lvSeen:9, xpn:G.xpNeed(9), ore:48200, cry:1340, dm:12, all:1e6,
       sys:{home:{b:{0:12,1:4}}, kor:{b:{0:3}}}});
     G.S.msel='kor'; G.S.clicks=30; G.S.notifyQueue=[]; G.dirty=true; G.render();
   });
   await p.waitForTimeout(3400);   // let the level-jump toasts/records clear
   await p.evaluate(()=>{ const G=window.__SD; G.S.notifyQueue=[]; G.gotoTab('p-res'); G.render(); });
   await p.waitForTimeout(150);
   await p.screenshot({path:SHOTS+'polish-header-final-'+h+'.png'});
   await ctx.close();
 }
 await b.close();
 console.log('done');
})();
