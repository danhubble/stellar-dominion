const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{if(m.type()==='error')errs.push('C:'+m.text())});
 // patch613: was pointed at stellar-dominion.html (the frozen shipped build) and
 // read #core, which real empire2 no longer has since patch612 - repointed to the
 // actual working file, and the dead #core reads dropped.
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 // empire2 (unlike the shipped build this file used to point at) opens a fresh
 // save on a full-screen intro overlay that eats clicks until dismissed - see
 // tmap2.js's own note. Close it up front so the real p.click() calls below land.
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 // patch629 made #notice a fixed, full-viewport overlay while shown - the real
 // p.click() calls below can land on it instead of their target, and the
 // lvl:80 jump right below is exactly the kind of adopt() that clears a pile of
 // unlockedAt()/level() gates at once (checkUnlocks() runs off tick()'s own
 // requestAnimationFrame loop, independent of this file's own evaluate() calls).
 // This file has nothing to do with notices - keep the queue drained instead of
 // chasing every real-click site.
 const noticeJanitor=setInterval(()=>{
   p.evaluate(()=>{
     const G=window.__SD;
     if(G&&G.S&&G.S.notifyQueue&&G.S.notifyQueue.length){ G.S.notifyQueue.length=0; G.dirty=true; G.render(); }
   }).catch(()=>{});
 }, 150);
 await p.evaluate(()=>{ __SD.S.xpn=1e9; __SD.S.lvl=80; __SD.S.lvSeen=80; });   // open the level-gated tabs
 await p.evaluate(()=>{ __SD.S.rs={drill:5,amp:4,cryo:3,cold:1,auto:2}; __SD.S.cry=5e4; });
 await p.click('.tab[data-p="p-res"]'); await p.waitForTimeout(700);
 console.log('chips',await p.$$eval('.rchip',n=>n.length),'nodes',await p.$$eval('.rn',n=>n.length),'segs',await p.$$eval('#treeLines path',n=>n.length));
 await p.screenshot({path:SHOTS+'r2-drill.png'});
 await p.click('.rchip:nth-child(6)'); await p.waitForTimeout(600);
 await p.screenshot({path:SHOTS+'r2-void.png'});
 await p.click('.rchip:nth-child(1)'); await p.waitForTimeout(400);
 const before=await p.evaluate(()=>__SD.S.rs.drill);
 await p.click('#treeGrid .rn:nth-child(6)'); await p.waitForTimeout(300); await p.click('#nmBuy'); await p.waitForTimeout(400);
 console.log('drill',before,'->',await p.evaluate(()=>__SD.S.rs.drill));
 await p.click('.tab[data-p="p-map"]'); await p.waitForTimeout(400);
 // patch628b: #sysSheet.open is gone - body.syspage is the fact now.
 console.log('map/empire tab shows the sheet?', await p.evaluate(()=>document.body.classList.contains('syspage')));
 // mobile
 const c2=await b.newContext({viewport:{width:360,height:800},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const p2=await c2.newPage();
 await p2.goto(GAME_URL); await p2.waitForTimeout(400);
 await p2.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p2.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 // same reasoning as p's own janitor above, for p2's own real click below.
 const noticeJanitor2=setInterval(()=>{
   p2.evaluate(()=>{
     const G=window.__SD;
     if(G&&G.S&&G.S.notifyQueue&&G.S.notifyQueue.length){ G.S.notifyQueue.length=0; G.dirty=true; G.render(); }
   }).catch(()=>{});
 }, 150);
 await p2.evaluate(()=>{ __SD.S.xpn=1e9; __SD.S.lvl=80; __SD.S.lvSeen=80; });   // open the level-gated tabs
 await p2.evaluate(()=>{ __SD.S.rs={drill:5,amp:4,cryo:3,cold:1,auto:2}; __SD.S.cry=5e4; });
 await p2.click('.tab[data-p="p-res"]'); await p2.waitForTimeout(800);
 await p2.screenshot({path:SHOTS+'r2-mobile.png'});
 clearInterval(noticeJanitor); clearInterval(noticeJanitor2);
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
