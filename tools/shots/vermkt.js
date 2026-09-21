const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(400);
 await p.evaluate(()=>{const G=window.__SD;G.adopt({...G.fresh(),ore:5e9,cry:1e6,all:1e12,lvl:30,lvSeen:30,sys:{home:{home:true,b:{0:5,1:3}}},notifyQueue:[],mkt:{heat:{sv:{v:0,t:0},dm:{v:0,t:0}},sold:false}});G.gotoTab('p-mkt');G.render();});
 await p.waitForTimeout(400);
 const chips=await p.evaluate(()=>[...document.querySelectorAll('#p-mkt .chip')].map(c=>({t:c.textContent,on:c.classList.contains('on'),w:Math.round(c.getBoundingClientRect().width),top:Math.round(c.getBoundingClientRect().top)})));
 console.log('chips',JSON.stringify(chips));
 await p.click('#p-mkt .chip:nth-of-type(5)'); await p.waitForTimeout(300);
 const st=await p.evaluate(()=>{const G=window.__SD;const card=document.querySelector('#mktSv .mktcard');return {Sbuy:G.S.buy,sell:card.querySelector('.mktsell').textContent,get:card.querySelector('.mktgetv').textContent,dis:card.querySelector('.mktsell').disabled,sv0:G.S.sv||0,ore0:G.S.ore};});
 console.log('x10K selected',JSON.stringify(st));
 await p.screenshot({path:SHOTS+'mktv.png'});
 await p.click('#mktSv .mktcard .mktsell'); await p.waitForTimeout(300);
 console.log('after sell',JSON.stringify(await p.evaluate(()=>({sv:__SD.S.sv,ore:Math.round(__SD.S.ore),Sbuy:__SD.S.buy}))));
 // empire chips unaffected
 await p.evaluate(()=>{__SD.gotoTab('p-map');__SD.S.msel='home';__SD.render();}); await p.waitForTimeout(400);
 console.log('empire chips',JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#sysBuild .chip')].map(c=>c.textContent+(c.classList.contains('on')?'*':'')))));
 await b.close();
})();
