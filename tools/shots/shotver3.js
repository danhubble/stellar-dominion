const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(600);
 // early game: home selected, sheet open
 await p.evaluate(()=>{const G=window.__SD;
   G.adopt({ore:8,exo:{},exoSeen:{},sys:{home:{home:true,b:{}}},lvl:1,lvSeen:1,rs:{},nx:{},ab:[],buy:1,msel:'home'});
   G.render();});
 await p.waitForTimeout(600);
 await p.screenshot({path:SHOTS+'v3-full.png'});
 const g=()=>p.evaluate(()=>({cls:document.getElementById('sysSheet').className,ore:Math.floor(window.__SD.S.ore)}));
 console.log('full',JSON.stringify(await g()));
 // scan chip x3
 for(let i=0;i<3;i++){ await p.click('#sshScan'); await p.waitForTimeout(120); }
 console.log('after 3 scans',JSON.stringify(await g()));
 // tap handle -> peek
 await p.click('#sshGrab'); await p.waitForTimeout(500);
 console.log('tap1',JSON.stringify(await g()));
 await p.screenshot({path:SHOTS+'v3-peek.png'});
 // scan chip still reachable at peek
 const vis=await p.evaluate(()=>{const e=document.getElementById('sshScan');const r=e.getBoundingClientRect();
   const s=document.getElementById('sysSheet').getBoundingClientRect();
   return {chip:[Math.round(r.top),Math.round(r.bottom)],sheet:[Math.round(s.top),Math.round(s.bottom)],vh:innerHeight};});
 console.log('chip@peek',JSON.stringify(vis));
 await p.click('#sshScan'); await p.waitForTimeout(150);
 console.log('scan@peek',JSON.stringify(await g()));
 // tap title row -> back to full
 await p.click('#sysInfo h4'); await p.waitForTimeout(500);
 console.log('titletap',JSON.stringify(await g()));
 // tap handle twice -> closed
 await p.click('#sshGrab'); await p.waitForTimeout(400);
 await p.click('#sshGrab'); await p.waitForTimeout(500);
 console.log('tap x2 from full',JSON.stringify(await g()), await p.evaluate(()=>window.__SD.S.msel));
 await b.close();
})();
