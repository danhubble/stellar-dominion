const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 for(const f of ['stellar-dominion.html','stellar-dominion-empire2.html']){
  const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.goto('file://'+require('path').resolve(__dirname,'../../',f)); await p.waitForTimeout(600);
  await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
  await p.waitForTimeout(600);
  const i=await p.evaluate(()=>{
    const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {t:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height)}};
    return {left:q('#left'),right:q('#right'),view:q('#view'),main:q('main'),
      viewScrollH:(document.querySelector('#view')||{}).scrollHeight};
  });
  console.log(f, JSON.stringify(i));
  await ctx.close();
 }
 await b.close();
})();
