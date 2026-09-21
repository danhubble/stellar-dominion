const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 for(const [w,h,tag] of [[390,844,'tall'],[390,667,'short']]){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.goto(GAME_URL); await p.waitForTimeout(700);
  await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
  await p.waitForTimeout(700);
  await p.screenshot({path:SHOTS+'ver-'+tag+'.png'});
  const i=await p.evaluate(()=>{const s=document.getElementById('scan').getBoundingClientRect();
    const mw=document.getElementById('mapWrap');const m=mw.getBoundingClientRect();
    return {scanTop:Math.round(s.top),scanBot:Math.round(s.bottom),mapH:Math.round(m.height),cls:mw.className,vh:innerHeight};});
  console.log(tag,JSON.stringify(i));
  await ctx.close();
 }
 await b.close();
})();
