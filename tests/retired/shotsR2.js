const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
// One-off screenshot script for PLAN-unify.md Run 2 (patches 610-613). Not part of the
// regression suite - run manually, same pattern earlier batches' shot scripts used (see
// shotsC.js/shotsD1.js/shotsD2.js/shotsD3.js).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // ---------- (a)/(b): Koru zoomed, sheet showing BUILDINGS then DEFENCES ----------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:0, ore:1e7, exo:{ir:1e6,he:1e6,xe:1e6,am:1e6},
     sys:{ home:{b:{0:5}}, kor:{b:{}} }});
   G.claimSystem(G.SYSMAP.kor);
   G.S.buy=1;
   const ladder=G.sysLadder('kor');
   for(let i=0;i<Math.min(3,ladder.length);i++)G.ladderBuy('kor',ladder[i]);
   G.gotoTab('p-map');
 });
 await p.waitForTimeout(300);
 await p.evaluate(()=>{
   const btn=Array.from(document.querySelectorAll('#mapNodes .mnode')).find(x=>x.dataset.s==='kor');
   if(btn)btn.click();
 });
 // let any achievement/level toasts from the fixture above clear before shooting
 await p.waitForTimeout(3500);
 await p.evaluate(()=>{ document.getElementById('sysSheet').scrollTo({top:0,behavior:'instant'}); });
 await p.waitForTimeout(200);
 await p.screenshot({path:SHOTS+'unify-r2-a-koru-sheet-top.png'});

 await p.evaluate(()=>{
   const sh=document.getElementById('sysSheet');
   sh.scrollTo({top:sh.scrollHeight,behavior:'instant'});
 });
 await p.waitForTimeout(200);
 await p.screenshot({path:SHOTS+'unify-r2-b-koru-sheet-defences.png'});

 // ---------- (c): Sol Reach, several ore tiers built, sheet opening position ----------
 await p.evaluate(()=>{
   const G=window.__SD;
   const b={}; for(let gi=0; gi<7; gi++) b[gi]=1;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:0, ore:0, sys:{home:{home:true,b}}, msel:'home'});
 });
 await p.reload(); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 await p.waitForTimeout(3500);
 await p.screenshot({path:SHOTS+'unify-r2-c-solreach-opening-scroll.png'});

 // ---------- (d): whole Empire/map tab, mid-game save, sheet CLOSED ----------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:24, lvSeen:24, all:0, ore:6e5, dm:4200, exo:{ir:1e5,he:8e4,xe:0,am:0},
     sys:{ home:{home:true,b:{0:5,1:3}}, kor:{b:{14:2}}, tan:{b:{}} }, msel:null});
   G.gotoTab('p-map'); dirty=true; render();
 });
 await p.waitForTimeout(3500);
 await p.screenshot({path:SHOTS+'unify-r2-d-map-midgame-closed.png'});

 // ---------- (e): fresh level-1 save, sheet closed ----------
 // a fresh browser context, not localStorage.clear() on the existing page - reload()
 // fires beforeunload, which calls save() and would just re-write (d)'s state right
 // back before the clear takes effect.
 const ctx2=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p3=await ctx2.newPage();
 await p3.goto(GAME_URL); await p3.waitForTimeout(500);
 await p3.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p3.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 await p3.waitForTimeout(300);
 // PLAN-unify.md decision 5: a fresh save boots with the sheet OPEN on Sol Reach -
 // close it explicitly for this shot, which wants the closed state.
 await p3.evaluate(()=>{ const btn=document.getElementById('sshClose'); if(btn)btn.click(); });
 await p3.waitForTimeout(400);
 await p3.screenshot({path:SHOTS+'unify-r2-e-fresh-level1-closed.png'});

 console.log('done');
 await b.close();
})();
