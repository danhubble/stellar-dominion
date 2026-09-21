const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
 const p=await ctx.newPage(); await p.goto(GAME_URL);
 await p.waitForTimeout(1200); await p.screenshot({path:SHOTS+'v2-intro.png'});
 await b.close();})();
