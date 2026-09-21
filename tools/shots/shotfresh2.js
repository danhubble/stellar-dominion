const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(500);
 // early-game: just claimed Koru, nothing built there
 await p.evaluate(()=>{ const G=window.__SD;
   G.adopt({ore:300, exo:{}, sys:{home:{home:true,b:{0:3}}, kor:{b:{}}}, lvl:9, lvSeen:9, rs:{}, nx:{}, ab:[], buy:1, msel:'kor'});
   G.render();
 });
 await p.waitForTimeout(500);
 await p.evaluate(()=>{ const sh=document.getElementById('sysSheet'); if(sh) sh.scrollTop=sh.scrollHeight; });
 await p.waitForTimeout(300);
 await p.screenshot({path:SHOTS+'fresh-3-defences.png'});
 await b.close();
})();
