const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for PLAN-clip.md (patch633/634 - the auto-resolve battle
// clip). Not part of the regression suite - run manually, same pattern earlier
// batches' shot scripts used (see shotsD3.js/shotsR3.js/shotsdef1.js).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // A strong fleet, a weak assault target, a rocket-only loadout (fx:"shell", dur:0.34)
 // so every fleet-volley shot travels rather than resolving instantly - guarantees a
 // shell visibly in flight at the mid-clip screenshot below, not left to whichever
 // weapon the rotation happens to land on first.
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     wep:{own:{rocket:1}, slot:["rocket",null]}, ammo:99});
   const t=G.assaultTarget(G.SYSMAP.dra);
   G.autoResolveTarget(t,-1);
 });

 // mid-clip: t≈1.2s real time - the fleet volley (from 0.9s) is under way, a shell
 // should still be travelling (dur 0.34s) with at least one boom already landed.
 await p.waitForTimeout(1200);
 await p.screenshot({path:SHOTS+'clip-01-midclip.png'});

 // the card: wait for the actual DOM signal (#bRes.on) rather than a fixed timeout -
 // robust to however long this particular formation's queue (hydra pieces included,
 // if any got seeded) actually takes to clear.
 await p.waitForFunction(()=>document.getElementById('bRes').classList.contains('on'), {timeout:8000});
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'clip-02-card.png'});

 const info = await p.evaluate(()=>{
   const G=window.__SD;
   const h3=document.querySelector('#bRes h3');
   return {fhp:G.S.fl[0].hp, title:h3?h3.textContent:null, kills:G.BT.kills, tot:G.BT.tot};   // fixture moved to S.fl[0] (PLAN-fleets run 1)
 });
 console.log(JSON.stringify(info));
 await b.close();
})();
