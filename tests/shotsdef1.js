const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for PLAN-defences.md Run 1 (patches 594-596): the
// system sheet's four states, plus the en-route/arrived contested variants.
// Not part of the regression suite - run manually, same pattern shotsD1.js uses.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 async function toMap(msel){
   await p.evaluate((id)=>{ const G=window.__SD; G.S.msel=id; G.gotoTab('p-map'); G.dirty=true; G.render(); }, msel);
   await p.waitForTimeout(200);
   // achievement/unlock toasts are unrelated to the sheet - clear them so they
   // never cover a sheet button in these shots (they auto-clear after ~3s anyway)
   await p.evaluate(()=>{ const h=document.getElementById('toasts'); if(h)h.innerHTML=''; });
 }

 // 1. UNCLAIMED - Velis, nothing owns it, not yet reached the claim gate visually
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, ore:2e5});
 });
 await toMap('vel');
 await p.screenshot({path:SHOTS+'defrun1-01-sheet-unclaimed.png'});

 // 2. CONTESTED - Tannhau (GARRISON: Vasht, Fortress), not yet assaulted
 await toMap('tan');
 await p.screenshot({path:SHOTS+'defrun1-02-sheet-contested.png'});

 // 2b. CONTESTED - en route (S.trip, not yet arrived) - needs a real fleet or
 // launchAssault()/canAssault() refuse it (same "NO FLEET" gate the ASSAULT
 // button itself shows), so buy a few interceptors first.
 await p.evaluate(()=>{
   const G=window.__SD;
   G.S.ore=1e9; G.S.lvl=20; G.S.lvSeen=20; G.S.fl[0].hp=1;   // fixture moved to S.fl[0] (PLAN-fleets run 1)
   G.buyShip(0,10);
   if(!G.S.trip)G.launchAssault(G.SYSMAP.tan);
 });
 await toMap('tan');
 await p.screenshot({path:SHOTS+'defrun1-03-sheet-enroute.png'});

 // 2c. CONTESTED - arrived (ENGAGE)
 await p.evaluate(()=>{ const G=window.__SD; if(G.S.trip)G.S.trip.dueAt=Date.now()-1000; });
 await toMap('tan');
 await p.screenshot({path:SHOTS+'defrun1-04-sheet-arrived.png'});

 // 3. HELD - Koru, claimed, no threat
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, ore:1e9, exo:{ir:1e6,he:1e6,xe:1e6,am:1e6}});
   G.claimSystem(G.SYSMAP.kor);
 });
 await toMap('kor');
 await p.screenshot({path:SHOTS+'defrun1-05-sheet-held.png'});

 // 4. UNDER ATTACK - Koru, a threat queued against it
 await p.evaluate(()=>{
   const G=window.__SD;
   G.thq().push({id:88001, rv:'hel', sysId:'kor', dif:1.3, t:5200});
 });
 await toMap('kor');
 await p.screenshot({path:SHOTS+'defrun1-06-sheet-under-attack.png'});

 await b.close();
 console.log('done');
})();
