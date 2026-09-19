const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
// One-off screenshot script for the coordinator's patch613b review fix. Not part of
// the regression suite - run manually, same convention as shotsR2.js.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // ---------- context card width check: "TAP A" / "SYSTEM", card height vs a populated one ----------
 await p.evaluate(()=>{ const G=window.__SD; G.adopt({...G.fresh(), lvl:20, lvSeen:20, msel:null}); });
 await p.waitForTimeout(200);
 const emptyBox = await p.evaluate(()=>{
   const name=document.getElementById('vCtxName'), rate=document.getElementById('vCtxRate'),
     card=document.getElementById('ctxCard');
   return { nameW: name.getBoundingClientRect().width, nameColW: name.parentElement.getBoundingClientRect().width,
     rateText: rate.textContent, cardH: card.getBoundingClientRect().height,
     overflowing: name.scrollWidth > name.clientWidth + 1 };
 });
 console.log('empty selection card:', JSON.stringify(emptyBox));
 await p.evaluate(()=>{ const G=window.__SD; G.S.msel='kor'; dirty=true; render(); });
 await p.waitForTimeout(200);
 const populatedH = await p.evaluate(()=>document.getElementById('ctxCard').getBoundingClientRect().height);
 console.log('populated card height:', populatedH);
 await p.evaluate(()=>{ const G=window.__SD; G.S.msel=null; dirty=true; render(); });
 await p.waitForTimeout(200);

 // ---------- fixture: a live fleet inbound + banked exotics, mid-game, Koru held ----------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:0, ore:1e7, exo:{ir:42000,he:18000,xe:0,am:0},
     sys:{ home:{b:{0:5}}, kor:{b:{}} }});
   G.claimSystem(G.SYSMAP.kor);
   G.S.buy=1;
   const ladder=G.sysLadder('kor');
   for(let i=0;i<Math.min(3,ladder.length);i++)G.ladderBuy('kor',ladder[i]);
   G.lfLaunch('hel', G.SYSMAP.home);
   G.gotoTab('p-map');
 });
 await p.waitForTimeout(3500);
 await p.screenshot({path:SHOTS+'unify-r2b-a-map-unzoomed-widgets.png'});

 // ---------- (a): zoomed sheet - lfBanner/exoStrip visible, sector chips hidden ----------
 await p.evaluate(()=>{
   const btn=Array.from(document.querySelectorAll('#mapNodes .mnode')).find(x=>x.dataset.s==='kor');
   if(btn)btn.click();
 });
 await p.waitForTimeout(400);
 await p.evaluate(()=>{ document.getElementById('sysSheet').scrollTo({top:0,behavior:'instant'}); });
 await p.waitForTimeout(200);
 const zoomState = await p.evaluate(()=>({
   chipsHidden: getComputedStyle(document.getElementById('mapChips')).display==='none',
   exoStripVisible: getComputedStyle(document.getElementById('exoStrip')).display!=='none',
   lfBannerVisible: getComputedStyle(document.getElementById('lfBanner')).display!=='none',
   mapWrapH: document.getElementById('mapWrap').getBoundingClientRect().height,
 }));
 console.log('zoomed state:', JSON.stringify(zoomState));
 await p.screenshot({path:SHOTS+'unify-r2b-b-koru-sheet-top.png'});

 // ---------- (b): map with sheet closed ----------
 await p.evaluate(()=>{ document.getElementById('sshClose').click(); });
 await p.waitForTimeout(400);
 await p.screenshot({path:SHOTS+'unify-r2b-c-map-closed.png'});

 // ---------- (c): fresh level-1 save, sheet closed, new context ----------
 const ctx2=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p2=await ctx2.newPage();
 await p2.goto(GAME_URL); await p2.waitForTimeout(500);
 await p2.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p2.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 await p2.waitForTimeout(300);
 await p2.evaluate(()=>{ const btn=document.getElementById('sshClose'); if(btn)btn.click(); });
 await p2.waitForTimeout(400);
 await p2.screenshot({path:SHOTS+'unify-r2b-d-fresh-level1-closed.png'});

 console.log('done');
 await b.close();
})();
