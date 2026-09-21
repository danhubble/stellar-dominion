const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(500);
 const st=async(l)=>console.log(l,JSON.stringify(await p.evaluate(()=>{
   const s=document.getElementById('sysSheet'),m=document.getElementById('mapWrap');
   const r=m.getBoundingClientRect(), sr=s.getBoundingClientRect();
   return {open:s.classList.contains('open'),msel:window.__SD.S.msel,mapH:Math.round(r.height),
     sheetTop:Math.round(sr.top),pos:getComputedStyle(s).position,left:getComputedStyle(document.getElementById('left')).display};})));
 await st('boot');
 await p.screenshot({path:SHOTS+'pm-1-boot.png'});
 // tap home node
 await p.click('.mnode'); await p.waitForTimeout(600); await st('tap home');
 await p.screenshot({path:SHOTS+'pm-2-home.png'});
 // back
 await p.click('#mapZoomBack'); await p.waitForTimeout(500); await st('back');
 // mid game, claimed koru with iridium -> defences with picker
 await p.evaluate(()=>{const G=window.__SD;
   G.adopt({ore:5e6,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2,1:1}}},
     lvl:20,lvSeen:20,rs:{},nx:{},ab:[],buy:1,msel:null}); G.render();});
 await p.waitForTimeout(400);
 await p.click('.mnode[data-id="kor"], .mnode:nth-child(2)'); await p.waitForTimeout(600); await st('tap kor');
 await p.screenshot({path:SHOTS+'pm-3-kor.png'});
 // scroll to defences and tap empty slot
 await p.evaluate(()=>{document.querySelector('#sysDefRow .sc')?.scrollIntoView();});
 await p.waitForTimeout(200);
 await p.click('#sysDefRow .sc'); await p.waitForTimeout(700);
 await p.screenshot({path:SHOTS+'pm-4-defpick.png'});
 console.log('picker', JSON.stringify(await p.evaluate(()=>{const d=document.getElementById('sysDefDetail');const r=d.getBoundingClientRect();return {hidden:d.hidden,top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight};})));
 await p.click('#mapZoomBack'); await p.waitForTimeout(400); await st('back2');
 await b.close();
})();
