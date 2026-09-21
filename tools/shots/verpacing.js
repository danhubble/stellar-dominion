const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 for(const H of [667,844]){
  const p=await b.newPage({viewport:{width:390,height:H},isMobile:true,hasTouch:true});
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.goto(GAME_URL); await p.waitForTimeout(700);
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/SKIP/.test(x.textContent)); if(b)b.click();}); await p.waitForTimeout(500);
  // mid-game: hold a frontier system so Project shows
  await p.evaluate(()=>{const SD=window.__SD,S=SD.S; S.lvl=20; S.xpn=1600; S.dm=(S.dm||0)+500;
    S.sys=S.sys||{}; const s=SD.SYS.find(x=>x.ring===3); S.sys[s.id]={b:{}}; S.msel=null; S.seen=S.seen||{}; S.seen["vega:project"]=1;
    SD.render();});
  await p.evaluate(()=>{document.querySelector("#notice .x, #noticeX, .noticebar button.x")?.click(); window.__SD.gotoTab("p-nex")}); await p.waitForTimeout(400);
  await p.evaluate(()=>{const h=document.querySelector('.pjhead'); if(h)h.scrollIntoView();}); await p.waitForTimeout(300);
  await p.screenshot({path:SHOTS+`pacing-${H}-project.png`});
  console.log(H, await p.evaluate(()=>{const h=document.querySelector('.pjhead'); return h? h.nextElementSibling.textContent.trim():'NO PROJECT'}));
  await p.close();
 }
 // fresh save level-up 4->5 modal
 const p=await b.newPage({viewport:{width:390,height:667},isMobile:true,hasTouch:true});
 await p.goto(GAME_URL); await p.waitForTimeout(700);
 await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/SKIP/.test(x.textContent)); if(b)b.click();}); await p.waitForTimeout(500);
 await p.evaluate(()=>{const SD=window.__SD; SD.S.lvl=4; SD.S.xpn=400; SD.lvModal() });
 await p.waitForTimeout(400);
 console.log('lvModal', await p.evaluate(()=>{const m=document.querySelector('.mask:not([hidden])'); return m? m.textContent.replace(/\s+/g,' ').slice(0,300):'none'}));
 await p.screenshot({path:SHOTS+'pacing-667-lv5.png'});
 await b.close();
})();
