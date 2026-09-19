const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for PLAN-ending.md Batch D, item D1 (patch589, "the
// turn"). Not part of the regression suite - run manually, same pattern earlier
// batches' shot scripts used (see shotsC.js).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 const baseAdopt = ()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, dm:1e15,
     sys:{ home:{b:{}}, kor:{b:{}}, nyx:{b:{}} },
     rv:{ hel:{p:0,cd:9e9,seen:1,w:0,mv:G.RIVAL_MOVE_CAP}, cov:{p:0,cd:9e9,seen:1,w:0,mv:G.RIVAL_MOVE_CAP} } });
   G.S.clicks=26;   // dismiss the "GETTING STARTED" tutorial card
   for(const id of ['ent','chr','ovs','syn','war']){ G.S.dm=1e15; G.buyNex(G.NEXUS.find(x=>x.id===id)); }
   G.S.en=1e6; G.buyNex(G.NEXUS.find(x=>x.id==='pj1'));
   G.S.en=1e6; G.buyNex(G.NEXUS.find(x=>x.id==='pj2'));
   G.S.en=1e6; G.buyNex(G.NEXUS.find(x=>x.id==='pj3'));
 };

 // 1. The turn scene, first line - VEGA, turned/dimmed avatar
 await p.evaluate((f)=>{ (0,eval)(f)(); }, baseAdopt.toString());
 await p.waitForTimeout(2000);   // let the lvl:99 jump's own toasts clear
 await p.evaluate(()=>{ const G=window.__SD; G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx')); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD1-01-turn-scene-vega.png'});

 // 2. The turn scene, a rival line
 await p.evaluate(()=>{
   const G=window.__SD;
   let steps=0;
   while(steps<G.STORY.turn.length){
     const line=G.STORY.turn[steps];
     if(line.who && line.who!=='vega')break;
     G.sceneAdvance(); steps++;
   }
 });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD1-02-turn-scene-rival.png'});

 // 3. The end buttons (ENGAGE / NOT YET)
 await p.evaluate(()=>{ window.__SD.sceneFinish(); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD1-03-turn-scene-buttons.png'});

 // dismiss the scene (NOT YET) before moving on to the other surfaces
 await p.evaluate(()=>{
   const btn=[...document.querySelectorAll('#sceneEnd button')].find(b=>b.textContent.trim()==='NOT YET');
   if(btn)btn.click();
 });
 await p.waitForTimeout(150);

 // 4. Nexus pane - every card SEIZED
 await p.evaluate(()=>{ const G=window.__SD; G.gotoTab('p-nex'); G.render(); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD1-04-nexus-seized.png'});

 // 5. Raids pane - the pinned "VEGA's fleet holds Sol Reach" card
 await p.evaluate(()=>{ const G=window.__SD; G.gotoTab('p-raid'); G.render(); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD1-05-raids-pinned-card.png'});

 // 6. Map, Core sector - the marker on Sol Reach. The "incoming" class has been on
 //    this node since step 1 (S.end went 1 there), so its CSS pulse (@keyframes
 //    mincoming, 1.1s) is at an arbitrary phase by now - restart it (remove/reflow/
 //    re-add the inline animation) so the 550ms wait deterministically lands near
 //    its peak, same as shotsC.js's own sab-marker shot (which added the class
 //    fresh right before its own wait).
 await p.evaluate(()=>{ const G=window.__SD; G.gotoTab('p-map'); G.setMapSec(0); G.S.msel='home'; G.render(); });
 await p.evaluate(()=>{
   const el=document.querySelector('#mapNodes .mnode[data-s="home"] .mdot');
   if(el){ el.style.animation='none'; void el.offsetHeight; el.style.animation=''; }
 });
 await p.waitForTimeout(550);
 await p.screenshot({path:SHOTS+'batchD1-06-map-core-marker.png'});

 await b.close();
 console.log('done');
})();
