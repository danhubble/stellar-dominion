const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for Run 3 (patch614/615/616). Not part of the regression
// suite - run manually, same convention as shotsR2.js/shotsR2b.js.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // mid-game save: level 15 so sector 0 (Core) has a claimable row (vel, lvl 14) and
 // locked rows (tan 17, mir 20) alongside held ones (home, kor, dra) - same fixture
 // tunify2.js uses.
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ore:5e6, all:0, cry:0, dm:0, exo:{ir:50}, exoSeen:{ir:true},
     sys:{ home:{home:true,b:{0:4,1:2,2:1}}, kor:{b:{0:1}}, dra:{b:{0:1,1:1}} },
     lvl:15, lvSeen:15, rs:{}, nx:{}, ab:[], buy:1, msel:null});
   G.gotoTab('p-map');
 });
 await p.waitForTimeout(300);

 // ---------- (a) LIST view, mid-game ----------
 await p.waitForTimeout(300);
 await p.screenshot({path:SHOTS+'unify-r3-a-list-midgame.png'});

 // ---------- (b) LIST view with a claimable and a locked row visible ----------
 // already the same view (vel claimable, tan/mir locked, all in sector 0) - scroll to
 // the top so every row including the unheld ones is in frame.
 await p.evaluate(()=>{ document.getElementById('mapWrap').scrollIntoView(); window.scrollTo(0,0); });
 await p.waitForTimeout(200);
 await p.screenshot({path:SHOTS+'unify-r3-b-list-claimable-locked.png'});

 // ---------- (c) site view open on an ore tier ----------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.S.msel='dra'; G.setMapZoom('dra'); G.render();
 });
 await p.waitForTimeout(300);
 await p.evaluate(()=>{
   const giEl=document.querySelector('#sysBuildRows .g .gi.gi-site');
   if(giEl)giEl.click();
 });
 await p.waitForTimeout(500);
 await p.screenshot({path:SHOTS+'unify-r3-c-site-view.png'});

 // ---------- (d) map zoomed, toggle correctly hidden ----------
 const zoomState=await p.evaluate(()=>({
   toggleHidden: !document.getElementById('mapMode'),   /* the toggle is gone outright now */
   chipsHidden: getComputedStyle(document.getElementById('mapChips')).display==='none',
 }));
 console.log('zoomed state (toggle/chips should both be hidden):', JSON.stringify(zoomState));
 // back to the planet view (not the site) for this shot - the zoom itself, with the
 // toggle hidden, is what's being confirmed here.
 await p.evaluate(()=>{ document.getElementById('mapZoomBack').click(); });
 await p.waitForTimeout(400);
 await p.screenshot({path:SHOTS+'unify-r3-d-zoomed-toggle-hidden.png'});

 console.log('done');
 await b.close();
})();
