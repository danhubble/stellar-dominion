const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tchurn2.js — regression sweep for patch548: catches any panel that rebuilds its
// buttons from scratch every render() tick instead of only on a real state change
// (the defect patch538 fixed on Research's #riBuy and patch546 fixed on the Map
// panel's #sysFort/#sysClaim/#sysWar - a real mousedown/mouseup lands on a node that
// gets swapped out from under it before mouseup fires, so the click never registers).
//
// For each pane/sub-tab listed below, every currently-visible <button> inside the
// active `.pane.on` is fingerprinted (id if it has one, else class+dataset+trimmed
// text+position - stable across ticks unless the node itself is a fresh DOM object)
// and its identity is sampled every 50ms for 2s of otherwise-idle render() churn
// (income ticking, nothing clicked). Any button whose object identity changes even
// once in that window is a FAIL - a correctly-guarded button never gets a new node
// for the same on-screen thing.
const { chromium } = require('playwright-core');
const URL=GAME_URL;

function fp(el, idx){
  if(el.id) return '#'+el.id;
  const ds=Object.entries(el.dataset||{}).sort().map(([k,v])=>k+'='+v).join(',');
  const txt=(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,24);
  return (el.className||'')+'|'+ds+'|'+txt+'|'+idx;
}

async function sweep(page, label){
  return await page.evaluate((fpSrc)=>{
    // eslint-disable-next-line no-new-func
    const fp=new Function('el','idx','return ('+fpSrc+')(el,idx)');
    return new Promise(resolve=>{
      const pane=document.querySelector('.pane.on');
      if(!pane){ resolve({offenders:[], total:0}); return; }
      function visible(el){ return el.offsetParent!==null; }
      function snap(){ return [...pane.querySelectorAll('button')].filter(visible); }
      const first=snap();
      const track=first.map((el,i)=>({key:fp(el,i), el, changes:0}));
      const iv=setInterval(()=>{
        const cur=snap();
        const byKey={}; cur.forEach((el,i)=>{ byKey[fp(el,i)]=el; });
        track.forEach(t=>{
          const now=byKey[t.key];
          if(now && now!==t.el){ t.changes++; t.el=now; }
        });
      },50);
      setTimeout(()=>{
        clearInterval(iv);
        resolve({
          total: track.length,
          offenders: track.filter(t=>t.changes>0).map(t=>({key:t.key, changes:t.changes}))
        });
      },2000);
    });
  }, fp.toString());
}

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL); await p.waitForTimeout(500);
 // patch579: close the brand-new-game intro overlay before the real ElementHandle
 // .click() calls below (p.$(...).click() actionability-checks the same as
 // p.click()) - see tmap2.js for the full note.
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 // deterministic, not a blind sleep - see tmap2.js for the full note.
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 // patch629 made #notice a fixed, full-viewport overlay while shown - a real
 // ElementHandle .click() below can land on it instead of its target. This file
 // has nothing to do with notices (checkUnlocks() runs off tick()'s own
 // requestAnimationFrame loop, independent of anything below, and the lvl:14
 // adopt() just below alone clears several unlockedAt() gates at once) - keep
 // the queue drained for the file's whole run instead of chasing every click
 // site, same reasoning tnodes2.js/tsheet2.js's own notice notes use.
 const noticeJanitor=setInterval(()=>{
   p.evaluate(()=>{
     const G=window.__SD;
     if(G&&G.S&&G.S.notifyQueue&&G.S.notifyQueue.length){ G.S.notifyQueue.length=0; G.dirty=true; G.render(); }
   }).catch(()=>{});
 }, 150);

 // fresh save with income running: level 14, ore flowing, some ships, some crystal,
 // Koru claimed (and built on, so its Empire row + Map fortify button both have real
 // content), a live-fleet event queued (renderLiveFleet's #lfBanner button only
 // exists while one is active) and a raid target queued (Raids/Targets buttons).
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:14, lvSeen:14, ore:1e30, cry:1e6, exo:{ir:1e6,he:1e6,xe:1e6,am:1e6},
     mi:2, miq:[0,1]});                               // two ready-to-claim missions
   G.claimSystem(G.SYSMAP.kor);
   S.buy=5; G.ladderBuy('kor',14);
   G.buyShip(0,10);                                  // 10 interceptors
   G.lfLaunch('hel', G.SYSMAP.home);                  // live-fleet banner button
   S.notifyQueue=[];
   dirty=true; render();
 });
 await p.waitForTimeout(300);

 const out=[]; let fails=0;
 async function check(label, setup){
   await setup();
   await p.waitForTimeout(250);
   const r=await sweep(p, label);
   if(r.offenders.length){
     fails++;
     out.push('FAIL '+label+' - '+r.offenders.length+'/'+r.total+' button(s) churning: '+
       r.offenders.map(o=>o.key+' x'+o.changes).join('; '));
   } else {
     out.push('PASS '+label+' - 0/'+r.total+' buttons churning');
   }
 }

 // patch612: the Empire tab/accordion (#p-emp/#gens) is gone - the map is the one
 // Empire tab now, and its sheet carries the same buy buttons (patch610's
 // #sysBuild). These two checks sample it with the sheet open and buildings shown,
 // per the plan's own "Watch for" note.
 await check('Map (home sheet open, buildings shown)', async()=>{
   await p.evaluate(()=>{ S.msel='home'; gotoTab('p-map'); dirty=true; render(); });
 });
 await check('Map (Koru sheet open, buildings shown)', async()=>{
   await p.evaluate(()=>{ S.msel='kor'; gotoTab('p-map'); dirty=true; render(); });
 });
 await check('Missions', async()=>{ await p.evaluate(()=>{ gotoTab('p-mis'); }); });
 await check('Research (tech tree)', async()=>{
   await p.evaluate(()=>{ gotoTab('p-res'); });
   const b=await p.$('#resMode [data-rm="tree"]'); if(b)await b.click();
 });
 await check('Research (programmes)', async()=>{
   await p.evaluate(()=>{ gotoTab('p-res'); });
   const b=await p.$('#resMode [data-rm="prog"]'); if(b)await b.click();
 });
 await check('Map (Koru selected)', async()=>{
   await p.evaluate(()=>{ S.msel='kor'; gotoTab('p-map'); dirty=true; render(); });
 });
 await check('Raids (targets)', async()=>{
   await p.evaluate(()=>{ gotoTab('p-raid'); });
   const b=await p.$('#raidMode [data-rd="targets"]'); if(b)await b.click();
 });
 await check('Raids (fleet)', async()=>{
   const b=await p.$('#raidMode [data-rd="fleet"]'); if(b)await b.click();
 });
 await check('Raids (loadout)', async()=>{
   const b=await p.$('#raidMode [data-rd="loadout"]'); if(b)await b.click();
 });
 await check('Raids (crew)', async()=>{
   const b=await p.$('#raidMode [data-rd="crew"]'); if(b)await b.click();
 });
 await check('Nexus', async()=>{ await p.evaluate(()=>{ gotoTab('p-nex'); }); });
 // Market (patch563): prices move every tick (rate()/cryRate()/heat decay), so this
 // is exactly the shape of bug patch538/546/548 fixed elsewhere - the SELL buttons
 // must not be rebuilt from scratch each tick.
 await check('Market', async()=>{ await p.evaluate(()=>{ gotoTab('p-mkt'); }); });
 await check('Stats', async()=>{ await p.evaluate(()=>{ window.__SD.openStatsPane(); }); });

 // item 4 (patch564/565): the fortify-building and assault-trip states of #sysAct
 // are new render branches through the SAME container - they still need the
 // dataset.h guard (the ticking countdown lives in a nested span, never rebuilding
 // the button), so they get their own churn checks here per the patch's own rule.
 //
 // Re-pointed for PLAN-defences.md Run 2 (patch598): the single #sysFort button this
 // used to drive is gone - FORTIFY is a per-slot card in #sysDefRow now. Building a
 // module queues the exact same shape of live countdown (a nested .cardcd span, never
 // rebuilding the card itself), so the check now sweeps #sysDefRow's own buttons too.
 await check('Map (Koru fortifying)', async()=>{
   await p.evaluate(()=>{
     const G=window.__SD;
     G.S.exo.ir=(G.S.exo.ir||0)+1e6;
     if(!G.S.def||!G.S.def.kor||!G.S.def.kor.s.some(sl=>sl&&sl.q))G.dmodBuild(G.SYSMAP.kor,0,'tur');
     G.S.msel='kor'; gotoTab('p-map'); dirty=true; render();
   });
 });
 await check('Map (assault en route)', async()=>{
   await p.evaluate(()=>{
     const G=window.__SD;
     G.S.lvl=20; G.S.lvSeen=20; G.S.fl[0].hp=1;   // fixture moved to S.fl[0] (PLAN-fleets run 1)
     if(!G.S.trip)G.launchAssault(G.SYSMAP.tan);
     G.S.msel='tan'; gotoTab('p-map'); dirty=true; render();
   });
 });
 await check('Map (assault arrived - ENGAGE)', async()=>{
   await p.evaluate(()=>{
     const G=window.__SD;
     if(G.S.trip)G.S.trip.dueAt=Date.now()-1000;      // already arrived, still inside the 10-min wait
     G.S.msel='tan'; dirty=true; render();
   });
 });

 clearInterval(noticeJanitor);
 console.log(out.join('\n'));
 console.log(fails+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
