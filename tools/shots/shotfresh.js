const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(1200);
 await p.screenshot({path:SHOTS+'fresh-1-intro.png'});
 // finish the intro scene
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(900);
 await p.screenshot({path:SHOTS+'fresh-2-boot.png'});
 // notice bar state?
 const info=await p.evaluate(()=>{
   const nb=document.querySelector('.noticebar');
   const sc=document.getElementById('scan');
   const r=sc?sc.getBoundingClientRect():null;
   const sh=document.getElementById('sysSheet');
   const shr=sh?sh.getBoundingClientRect():null;
   const dw=document.getElementById('sysDefWrap');
   return {notice:nb?{on:nb.classList.contains('on'),html:nb.innerText}:null,
     scan:r?{top:r.top,bottom:r.bottom,h:r.height}:null,
     sheet:shr?{top:shr.top,bottom:shr.bottom,open:sh.classList.contains('open')}:null,
     defWrapHidden:dw?dw.hidden:null, defText:dw?dw.innerText.slice(0,300):null,
     vh:innerHeight};
 });
 console.log(JSON.stringify(info,null,1));
 await b.close();
})();
