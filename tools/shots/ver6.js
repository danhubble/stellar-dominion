const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(400);
 await p.evaluate(()=>{const G=window.__SD;G.adopt({ore:5e6,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2,1:1}},dra:{b:{0:1}}},lvl:20,lvSeen:20,rs:{},nx:{},ab:[],buy:1,msel:null});G.render();});
 await p.waitForTimeout(400);
 const st=()=>p.evaluate(()=>({msel:__SD.S.msel,sp:document.body.classList.contains('syspage'),sheet:getComputedStyle(document.getElementById('sysSheet')).display,st:Math.round(document.getElementById('view').scrollTop),tab:document.querySelector('.pane.on').id}));
 console.log('map',JSON.stringify(await st()));
 await p.evaluate(()=>{__SD.S.msel='kor';__SD.render();}); await p.waitForTimeout(400); console.log('kor',JSON.stringify(await st()));
 await p.evaluate(()=>{const v=document.getElementById('view');v.scrollTo({top:150,behavior:'instant'});}); await p.waitForTimeout(300); console.log('scrolled',JSON.stringify(await st()));
 await p.click('.tab[data-p="p-mis"]'); await p.waitForTimeout(500); console.log('missions',JSON.stringify(await st()));
 await p.click('.tab[data-p="p-map"]'); await p.waitForTimeout(700); console.log('back',JSON.stringify(await st()));
 // switch system via LIST -> should reset to 0 (need to close page first? LIST hidden on page). Use notice-style set:
 await p.evaluate(()=>{__SD.S.msel='dra';__SD.render();}); await p.waitForTimeout(400); console.log('switch->dra',JSON.stringify(await st()));
 await p.evaluate(()=>{const v=document.getElementById('view');v.scrollTo({top:120,behavior:'instant'});}); await p.waitForTimeout(200);
 await p.click('#mapZoomBack'); await p.waitForTimeout(500); console.log('MAP',JSON.stringify(await st()));
 // stale render while scrolled must NOT reset
 await p.evaluate(()=>{__SD.S.msel='kor';__SD.render();}); await p.waitForTimeout(300);
 await p.evaluate(()=>{const v=document.getElementById('view');v.scrollTo({top:200,behavior:'instant'});}); await p.waitForTimeout(200);
 await p.evaluate(()=>{__SD.render();__SD.render();}); await p.waitForTimeout(300); console.log('re-render while scrolled',JSON.stringify(await st()));
 // toast on page
 await p.evaluate(()=>{const v=document.getElementById('view');v.scrollTo({top:0,behavior:'instant'});});
 await p.evaluate(()=>{ if(__SD.toast) __SD.toast('Test toast one'); else if(window.toast) toast('Test toast one'); });
 await p.waitForTimeout(300);
 console.log('toast',JSON.stringify(await p.evaluate(()=>{const t=document.getElementById('toasts').getBoundingClientRect();const bar=document.getElementById('sshScanBar').getBoundingClientRect();return {toastBottom:Math.round(t.bottom),barTop:Math.round(bar.top),toastCount:document.querySelectorAll('#toasts .toast').length};})));
 await p.screenshot({path:SHOTS+'r1v-toast.png'});
 await b.close();
})();
