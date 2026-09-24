const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for PLAN-polish Batch C. Not part of the regression
// suite - run manually, same convention as shotsR3.js. Two viewports each,
// isMobile:true per the batch's own instructions.
const { chromium } = require('playwright-core');
const SIZES=[{w:390,h:667,tag:'667'},{w:390,h:844,tag:'844'}];

async function shot(browser, size, fn, name, opts){
  const ctx=await browser.newContext({viewport:{width:size.w,height:size.h}, isMobile:true});
  const p=await ctx.newPage();
  await p.goto(GAME_URL); await p.waitForTimeout(400);
  await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
  await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
  await fn(p);
  // clear any toasts and dismiss any VEGA notice so the shot shows the feature, not chrome
  await p.evaluate(()=>{
    const t=document.getElementById('toasts'); if(t)t.innerHTML='';
    const G=window.__SD; if(G&&G.S.notifyQueue) G.S.notifyQueue=[];
    if(G) G.render();
  });
  await p.waitForTimeout(150);
  if(opts&&opts.scrollTo){
    await p.evaluate((sel)=>{ const el=document.querySelector(sel); if(el)el.scrollIntoView({block:'center'}); }, opts.scrollTo);
    await p.waitForTimeout(150);
  }
  await p.screenshot({path:SHOTS+'batchc-'+name+'-'+size.tag+'.png'});
  await ctx.close();
}

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});

 // ---------- 1. mission strip on Sol Reach ----------
 for(const size of SIZES){
   await shot(b, size, async p=>{
     await p.evaluate(()=>{
       const G=window.__SD;
       G.adopt({...G.fresh(), lvl:3, xpn:60, ore:5000, mi:0, sys:{home:{b:{0:3}}}, msel:'home'});
       G.S.seen=G.S.seen||{}; G.S.seen.tierReveal1=true;
       G.render();
     });
     await p.waitForTimeout(200);
   }, '01-mission-strip');
 }

 // ---------- 2. Shipyard fitted in a defence slot ----------
 for(const size of SIZES){
   await shot(b, size, async p=>{
     await p.evaluate(()=>{
       const G=window.__SD;
       G.adopt({...G.fresh(), lvl:30, ore:1e9, exo:{ir:1e9}, dm:1e6});
       G.claimSystem(G.SYSMAP.kor);
       G.dmodBuild(G.SYSMAP.kor,0,'shy');
       G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
       G.S.msel='kor'; G.setMapZoom('kor'); G.render();
     });
     await p.waitForTimeout(300);
   }, '02-shipyard-slot', {scrollTo:'#sysDefWrap'});
 }

 // ---------- 3. governor with a fitted-module last-buy line ----------
 for(const size of SIZES){
   await shot(b, size, async p=>{
     await p.evaluate(()=>{
       const G=window.__SD;
       G.adopt({...G.fresh(), lvl:20, ore:1e9, exo:{ir:1e9}, dm:1e6, rs:{drill:4,auto:1},
         sys:{kor:{b:{0:5},gov:1,gb:1e9,gft:0}}});
       // adopt() clamps gt>=0 on load, so set it AFTER - far negative means the
       // tier-buy side never fires here, isolating the fit-only line for the shot
       // (both can otherwise land in the same instant and the buy line wins the tie).
       G.S.sys.kor.gt=-1e6;
       G.govTick(G.GOV_FIT_EVERY);
       G.S.msel='kor'; G.setMapZoom('kor'); G.render();
     });
     await p.waitForTimeout(300);
   }, '03-governor-fitted', {scrollTo:'#sysGov'});
 }

 // ---------- 4. the ambush threat card ----------
 for(const size of SIZES){
   await shot(b, size, async p=>{
     await p.evaluate(()=>{
       const G=window.__SD;
       G.adopt({...G.fresh(), lvl:30, ore:1e9, exo:{ir:1e9}, dm:1e6});
       G.claimSystem(G.SYSMAP.kor);
       G.queueFirstAmbush(G.SYSMAP.kor);
       G.S.msel='kor'; G.setMapZoom('kor'); G.render();
     });
     await p.waitForTimeout(300);
   }, '04-ambush-threat', {scrollTo:'#sysDefWrap'});
 }

 await b.close();
 console.log('done');
})();
