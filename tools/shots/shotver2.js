const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
 const p=await ctx.newPage();
 p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(700);
 await p.screenshot({path:SHOTS+'v2-boot667.png'});
 console.log('boot', JSON.stringify(await p.evaluate(()=>{
   const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return[Math.round(r.top),Math.round(r.bottom)]};
   const n=document.querySelector('.mnode');
   return {mapWrap:q('#mapWrap'),view:q('#view'),node:n?q('.mnode'):null,scan:q('#scan')};})));
 // mid-game: peek with zoom
 await p.evaluate(()=>{const G=window.__SD;
   G.adopt({ore:5e6,exo:{ir:200},exoSeen:{ir:true},sys:{home:{home:true,b:{0:4,1:2}},kor:{b:{0:2}}},lvl:15,lvSeen:15,rs:{},nx:{},ab:[],buy:1,msel:'kor'});
   G.render();});
 await p.waitForTimeout(700);
 await p.screenshot({path:SHOTS+'v2-full667.png'});
 // tap handle to peek
 await p.click('#sshGrab'); await p.waitForTimeout(600);
 await p.screenshot({path:SHOTS+'v2-peek667.png'});
 console.log('peek', JSON.stringify(await p.evaluate(()=>({cls:document.getElementById('sysSheet').className,
   top:Math.round(document.getElementById('sysSheet').getBoundingClientRect().top)}))));
 // defence gate: newly claimed, no exotic ever banked
 await p.evaluate(()=>{const G=window.__SD;
   G.adopt({ore:300,exo:{},exoSeen:{},sys:{home:{home:true,b:{0:3}},kor:{b:{}}},lvl:9,lvSeen:9,rs:{},nx:{},ab:[],buy:1,msel:'kor'});
   G.render();});
 await p.waitForTimeout(600);
 await p.evaluate(()=>{const s=document.getElementById('sysSheet'); s.scrollTop=s.scrollHeight;});
 await p.waitForTimeout(300);
 await p.screenshot({path:SHOTS+'v2-defgate667.png'});
 console.log('def', JSON.stringify(await p.evaluate(()=>{
   const w=document.getElementById('sysDefWrap');
   return {hidden:w.hidden, txt:w.innerText.replace(/\s+/g,' ').trim().slice(0,160),
     btns:w.querySelectorAll('button').length};})));
 await b.close();
})();
