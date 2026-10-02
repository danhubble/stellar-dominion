const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tcomet2.js — the comet: now and then one crosses the planet band of an open system
// page; tap it in time and manual scans are multiplied for a short while (a "scan
// surge", shown as a gold tag on the Scan key). Runtime only - nothing is saved.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 const r=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:12, lvSeen:12, xpn:G.xpNeed(12), ore:1e6, all:1e7, sys:{home:{b:{0:20}}}});
   G.S.notifyQueue.length=0; document.getElementById('mask').classList.remove('on');
   G.gotoTab('p-map'); G.S.msel='home'; dirty=true; render();
   await new Promise(r=>setTimeout(r,500));            /* the zoom-in settles */
   const base=G.clickPow(), none=G.scanSurgeMul();
   // a miss: tapping far from the comet does nothing
   G.cometSpawn(performance.now()-1000);
   const cv=document.getElementById('mapZoom'), box=cv.getBoundingClientRect();
   const at=G.cometAt(performance.now());
   const tap=(x,y)=>cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,bubbles:true,cancelable:true}));
   tap(box.left+at.x*box.width+120, box.top+at.y*box.height+90);
   const afterMiss=G.scanSurgeMul();
   // a hit
   const now=G.cometAt(performance.now());
   tap(box.left+now.x*box.width+6, box.top+now.y*box.height-5);
   const hitMul=G.scanSurgeMul(), boosted=G.clickPow();
   const ore0=G.S.ore; G.doScan(); const gained=G.S.ore-ore0;
   render();
   const tags=[...document.querySelectorAll('.scanbtn')].map(x=>x.dataset.surge||'');
   const yields=document.getElementById('clickv').textContent;
   // tapping again while it is already caught does not extend it
   const until=G.surgeUntil; tap(box.left+now.x*box.width, box.top+now.y*box.height);
   const again=G.surgeUntil===until;
   // it runs out
   const real=Date.now; Date.now=()=>real()+(G.SURGE_SECS+1)*1000;
   const after=G.scanSurgeMul(), afterPow=G.clickPow(); render();
   const tagsAfter=[...document.querySelectorAll('.scanbtn')].map(x=>x.dataset.surge||'');
   Date.now=real;
   const saved=JSON.stringify(G.S).indexOf('surge')>=0;
   return { base, none, afterMiss, hitMul, boosted, gained, tags, yields, again, after, afterPow, tagsAfter, saved, mul:G.SURGE_MUL };
 });
 ok('no surge to start with, and a tap that misses the comet does nothing', r.none===1 && r.afterMiss===1, r);
 ok('tapping the comet starts a scan surge: manual scans are multiplied', r.hitMul===r.mul && Math.abs(r.boosted-r.base*r.mul)<1e-6 && Math.abs(r.gained-r.boosted)<1e-6, r);
 ok('both Scan keys carry the gold SURGE tag and the boosted yield', r.tags.length>=2 && r.tags.every(t=>/^SURGE ×\d+ · \d+s$/.test(t)), r);
 ok('a caught comet cannot be caught twice', r.again, r);
 ok('the surge runs out by itself, the tag goes, and nothing about it is saved',
    r.after===1 && Math.abs(r.afterPow-r.base)<1e-6 && r.tagsAfter.every(t=>t==='') && !r.saved, r);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
