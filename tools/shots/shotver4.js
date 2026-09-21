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
 const probe=async(label)=>{
   const r=await p.evaluate(()=>{
     const s=document.getElementById('sysSheet'); if(!s)return null;
     const sr=s.getBoundingClientRect();
     const vis=el=>el&&el.offsetParent!==null&&getComputedStyle(el).display!=='none';
     const bar=[...s.children].filter(vis).pop();
     const br=bar?bar.getBoundingClientRect():null;
     return {sheetBottom:Math.round(sr.bottom),lastVisible:bar?bar.id||bar.className:null,
       gap:br?Math.round(sr.bottom-br.bottom):null, open:s.classList.contains('open')};
   });
   console.log(label, JSON.stringify(r));
 };
 // held non-home, mid game
 await p.evaluate(()=>{const G=window.__SD;
   G.adopt({ore:5e6,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2}}},lvl:20,lvSeen:20,rs:{},nx:{},ab:[],buy:1,msel:'kor'});G.render();});
 await p.waitForTimeout(500); await probe('held');
 await p.evaluate(()=>{const s=document.getElementById('sysSheet');s.scrollTop=s.scrollHeight/2;});
 await p.waitForTimeout(200); await probe('held-scrolled');
 await p.screenshot({path:SHOTS+'v4-held.png'});
 // unclaimed system
 await p.evaluate(()=>{const G=window.__SD;const s=G.SYS.find(x=>!x.home&&!G.sysHeld(x.id));
   G.S.msel=s?s.id:'vel';G.render();});
 await p.waitForTimeout(500); await probe('unclaimed');
 await p.screenshot({path:SHOTS+'v4-unclaimed.png'});
 // home
 await p.evaluate(()=>{const G=window.__SD;G.S.msel='home';G.render();});
 await p.waitForTimeout(400); await probe('home');
 await b.close();
})();
