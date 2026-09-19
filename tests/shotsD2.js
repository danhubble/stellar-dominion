const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for PLAN-ending.md Batch D, item D2 (patch590/591, the
// final battle + allies). Not part of the regression suite - run manually, same
// pattern earlier batches' shot scripts used (see shotsC.js/shotsD1.js).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 const setup = ()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, dm:1e15,
     sys:{ home:{b:{}}, kor:{b:{}}, nyx:{b:{}} },
     sh:[50,20,5], wpow:[true,true,false,false,false,false,false] });
   G.S.seen.aimHint=true;
   G.devAction('startFinale');
   G.sceneClose();   // the turn scene opened via devAction - not part of this shot
 };
 const sceneGone = async()=>{
   await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 };

 // 1. Wave 1, with Vasht's ally row drawn
 await p.evaluate((f)=>{ (0,eval)(f)(); }, setup.toString());
 await sceneGone();
 await p.evaluate(()=>{ window.__SD.startFinalBattle(); });
 await p.waitForTimeout(250);
 await p.screenshot({path:SHOTS+'batchD2-01-wave1-allies.png'});

 // 2. Wave 3: boss + all three allies + a visible tracer. To make the tracer
 //    unmistakable in a single still frame (rather than hoping a random live
 //    target happens to be far from the ally row), the boss is briefly made the
 //    ONLY alive hostile for the one tick that fires every ally - so all three
 //    real tracers land on it, a long clean line from the ally row to the Core -
 //    then every other hostile's alive flag is restored before the screenshot.
 //    This is still the real finalAlliesTick()/hitEnemy() mechanism, just with a
 //    picked target instead of a random one.
 //    An allyshot fx fades in ~0.2s (the same default decay every other quick
 //    flash fx uses), and the page's own requestAnimationFrame(frame) loop is
 //    still running for real between this evaluate() call and a later
 //    page.screenshot() - real frames in that gap decay the tracer to a=0 and
 //    BT.fx's own filter(f=>f.a>0) drops it before the screenshot ever fires.
 //    So this step draws and captures the exact frame itself, inside one
 //    synchronous evaluate(): force the fire, call bDraw() once directly (paints
 //    the canvas with the fx still at a:1), then read the canvas back with
 //    toDataURL() before anything else gets a chance to run - no real-time gap
 //    for the flash to decay across.
 const dataUrl2=await p.evaluate(()=>{
   const G=window.__SD;
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);   // -> wave 2
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);   // -> wave 3 (boss + 3 allies)
   const others=G.BT.en.filter(e=>e!==G.BT.boss);
   const wasAlive=others.map(e=>e.alive);
   for(const e of others)e.alive=0;
   for(const a of G.BT.allies)a.iv=0;
   G.bUpdateWep(0.05);   // every ally fires at the only alive hostile: the boss
   others.forEach((e,i)=>e.alive=wasAlive[i]);
   G.bDraw();   // paint this exact frame - fx still at a:1 - before anything else runs
   return document.getElementById('bcv').toDataURL('image/png');
 });
 require('fs').writeFileSync(SHOTS+'batchD2-02-wave3-boss-allies-tracer.png',
   Buffer.from(dataUrl2.split(',')[1],'base64'));

 // 3. The withdraw moment (Core broke <25%, fleet flying out)
 await p.evaluate(()=>{
   const G=window.__SD;
   const boss=G.BT.boss; boss.shp=0;
   G.hitEnemy(G.BT.en.indexOf(boss), boss.max*0.8, 1);
 });
 await p.waitForTimeout(350);
 await p.screenshot({path:SHOTS+'batchD2-03-withdraw.png'});

 // 4. Loss result card (fresh fight, FINAL_CAP timeout)
 await p.evaluate((f)=>{ (0,eval)(f)(); }, setup.toString());
 await sceneGone();
 await p.evaluate(()=>{ const G=window.__SD; G.startFinalBattle(); G.BT.el=G.FINAL_CAP+1; G.bUpdateWep(0.1); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchD2-04-loss-result.png'});

 // 5. Win result card (withdraw beat finished)
 await p.evaluate((f)=>{ (0,eval)(f)(); }, setup.toString());
 await sceneGone();
 await p.evaluate(()=>{
   const G=window.__SD;
   G.startFinalBattle();
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   const boss=G.BT.boss; boss.shp=0;
   G.hitEnemy(G.BT.en.indexOf(boss), boss.max*0.8, 1);
 });
 await p.waitForTimeout(1800);
 await p.screenshot({path:SHOTS+'batchD2-05-win-result.png'});

 await b.close();
})();
