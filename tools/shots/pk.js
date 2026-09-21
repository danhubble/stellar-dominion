const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(400);
 await p.evaluate(()=>{const G=window.__SD;
   G.adopt({ore:5e6,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2,1:1}}},
     lvl:20,lvSeen:20,rs:{},nx:{},ab:[],buy:1,msel:'kor'}); G.render();});
 await p.waitForTimeout(500);
 await p.evaluate(()=>{document.querySelector('#sysDefRow .sc').scrollIntoView();});
 await p.waitForTimeout(300);
 const before=await p.evaluate(()=>document.getElementById('view').scrollTop);
 await p.click('#sysDefRow .sc');
 for(const t of [100,400,900,1500]){ await p.waitForTimeout(t);
   console.log(t, JSON.stringify(await p.evaluate(()=>{const d=document.getElementById('sysDefDetail');const r=d.getBoundingClientRect();
     return {hidden:d.hidden,top:Math.round(r.top),h:Math.round(r.height),viewST:Math.round(document.getElementById('view').scrollTop),
       scroller:(()=>{let e=d;while(e&&e!==document.body){const o=getComputedStyle(e).overflowY;if(o==='auto'||o==='scroll')return e.id||e.tagName;e=e.parentElement}return 'none'})()};}))); }
 console.log('before',before);
 await b.close();
})();
