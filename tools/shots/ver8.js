const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(500);
 await p.click('#noticeX'); await p.waitForTimeout(300);
 await p.click('.mnode'); await p.waitForTimeout(600);
 console.log(JSON.stringify(await p.evaluate(()=>{const g=document.querySelector('#sysBuildRows .g');const r=g.getBoundingClientRect();const bar=document.getElementById('sshScanBar').getBoundingClientRect();return {buyRowTop:Math.round(r.top),buyRowBottom:Math.round(r.bottom),barTop:Math.round(bar.top)};})));
 await p.screenshot({path:SHOTS+'r2v-6-fresh-home-667.png'});
 await b.close();
})();
