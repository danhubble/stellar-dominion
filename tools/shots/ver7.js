const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(500);
 // fresh save: VEGA "systems online" notice should be showing as overlay
 const nb=await p.evaluate(()=>{const n=document.getElementById('notice');const r=n.getBoundingClientRect();const pn=n.querySelector('.noticepanel');const pr=pn?pn.getBoundingClientRect():null;
   return {on:n.classList.contains('on'),z:getComputedStyle(n).zIndex,bg:getComputedStyle(n).backgroundColor,panel:pr?[Math.round(pr.top),Math.round(pr.bottom)]:null,txt:document.getElementById('noticeTxt').textContent.slice(0,40),
     map:(()=>{const r=document.getElementById('mapWrap').getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)]})()};});
 console.log('boot notice',JSON.stringify(nb));
 await p.screenshot({path:SHOTS+'r2v-1-vega-boot.png'});
 // dismiss via backdrop tap at top of screen (above the panel)
 await p.mouse.click(195,300); await p.waitForTimeout(400);
 console.log('after backdrop tap',JSON.stringify(await p.evaluate(()=>({on:document.getElementById('notice').classList.contains('on'),q:__SD.S.notifyQueue.length,map:(()=>{const r=document.getElementById('mapWrap').getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)]})()}))));
 // open home page, then queue a notice with a go -> TAKE ME THERE
 await p.click('.mnode'); await p.waitForTimeout(500);
 await p.screenshot({path:SHOTS+'r2v-2-homepage-nonotice.png'});
 // exotic modal gate: fresh save -> card should NOT be tappable
 console.log('ctx card fresh',JSON.stringify(await p.evaluate(()=>{const c=document.querySelector('.c-ctx');return {tag:c.tagName,cursor:getComputedStyle(c).cursor,cls:c.className,disabled:c.disabled};})));
 // level-20 fixture with iridium
 await p.evaluate(()=>{const G=window.__SD;G.adopt({ore:5e6,exo:{ir:500,he:20},exoSeen:{ir:true,he:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2,1:1}}},lvl:20,lvSeen:20,rs:{},nx:{},ab:[],buy:1,msel:null,notifyQueue:[]});G.render();});
 await p.waitForTimeout(400);
 console.log('ctx card L20',JSON.stringify(await p.evaluate(()=>{const c=document.querySelector('.c-ctx');return {cursor:getComputedStyle(c).cursor,cls:c.className};})));
 await p.click('.c-ctx'); await p.waitForTimeout(400);
 console.log('exo modal',JSON.stringify(await p.evaluate(()=>({mask:document.getElementById('mask').classList.contains('on'),txt:document.getElementById('modal').innerText.replace(/\s+/g,' ').slice(0,200)}))));
 await p.screenshot({path:SHOTS+'r2v-3-exomodal.png'});
 await p.evaluate(()=>__SD.hideModal?__SD.hideModal():document.getElementById('mask').classList.remove('on')); await p.waitForTimeout(200);
 // defence picker modal on kor
 await p.evaluate(()=>{__SD.S.msel='kor';__SD.render();}); await p.waitForTimeout(400);
 await p.evaluate(()=>{document.querySelector('#sysDefRow .sc').scrollIntoView();}); await p.waitForTimeout(200);
 await p.click('#sysDefRow .sc'); await p.waitForTimeout(500);
 console.log('picker modal',JSON.stringify(await p.evaluate(()=>({mask:document.getElementById('mask').classList.contains('on'),pk:document.querySelectorAll('#modal .pk').length,inlineHidden:document.getElementById('sysDefDetail').hidden,txt:document.getElementById('modal').innerText.replace(/\s+/g,' ').slice(0,120)}))));
 await p.screenshot({path:SHOTS+'r2v-4-picker.png'});
 // pick the first usable module
 const picked=await p.evaluate(()=>{const el=[...document.querySelectorAll('#modal .pk')].find(e=>!e.classList.contains('dim'));if(!el)return null;const m=el.dataset.m;el.click();return m;});
 await p.waitForTimeout(500);
 console.log('after pick',picked,JSON.stringify(await p.evaluate(()=>({mask:document.getElementById('mask').classList.contains('on'),slot0:document.querySelector('#sysDefRow .sc .n').textContent,ir:Math.round(__SD.S.exo.ir)}))));
 // notice with go while on a page: queue vega:claimable-ish -> use notify API if exported
 const q=await p.evaluate(()=>{const G=window.__SD; if(G.notify){G.notify('vega:map');return 'notify'} G.S.notifyQueue.push('vega:map');G.render();return 'pushed';});
 await p.waitForTimeout(400);
 console.log('notice on page',q,JSON.stringify(await p.evaluate(()=>({on:document.getElementById('notice').classList.contains('on'),go:document.getElementById('noticeGo').hidden,map:(()=>{const r=document.getElementById('mapWrap').getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)]})()}))));
 await p.screenshot({path:SHOTS+'r2v-5-vega-on-page.png'});
 await b.close();
})();
