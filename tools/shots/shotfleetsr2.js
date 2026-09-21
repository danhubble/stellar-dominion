/* Verification screenshots for PLAN-fleets run 2 (BRIEF-fleets-run2.md commit 4).
   Real game, not the mock - dist/stellar-dominion.html, built from src/.
   Run: node tools/shots/shotfleetsr2.js */
const path=require('path');
const GAME_URL='file://'+path.resolve(__dirname,'..','..','dist','stellar-dominion.html');
const { chromium } = require('playwright-core');
const SHOTS=path.resolve(__dirname,'..','..','shots')+'/';

async function run(w,h,tag){
  const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});
  const p=await ctx.newPage({viewport:{width:w,height:h}});
  const errs=[];
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.goto(GAME_URL);
  await p.waitForTimeout(500);
  await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
  await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
  const janitor=setInterval(()=>{
    p.evaluate(()=>{
      const G=window.__SD;
      if(G&&G.S&&G.S.notifyQueue&&G.S.notifyQueue.length){ G.S.notifyQueue.length=0; G.dirty=true; G.render(); }
      const t=document.getElementById('toasts'); if(t)t.innerHTML='';
    }).catch(()=>{});
  },150);

  await p.evaluate(()=>{
    const G=window.__SD;
    G.adopt({...G.fresh(), lvl:14, lvSeen:14, ore:1e9, all:1e9, cry:1e6, exo:{ir:1e9,he:1e9,xe:1e9,am:1e9}});
    G.claimSystem(G.SYSMAP.kor);
    G.buyShip(0,10);
    // a raid target with a fleet at it (home) and one away, so both card states show
    G.S.tg=[
      Object.assign(G.newTarget(),{sys:'home'}),
      Object.assign(G.newTarget(),{sys:'kor'}),
    ];
    G.gotoTab('p-map'); G.dirty=true; G.render();
  });
  await p.waitForTimeout(200);

  // #view has scroll-behavior:smooth in CSS - scrollIntoView's animation can still be
  // running when the screenshot fires, so jump #view's scrollTop straight there
  // instead (instant, no animation to race).
  const scrollViewTo=(top)=>p.evaluate((top)=>{ const v=document.getElementById('view'); if(v)v.scrollTo({top,behavior:'instant'}); },top);
  const scrollTop=()=>scrollViewTo(0);
  const scrollBottom=()=>p.evaluate(()=>{ const v=document.getElementById('view'); if(v)v.scrollTo({top:v.scrollHeight,behavior:'instant'}); });

  // 1) bar idle - map view, sector 0 (home/kor's sector). Scrolled to the bottom of
  // #view so the bar itself (below the map square) is actually in frame - #view's
  // own height on a short phone is well under the map+bar's combined height, the
  // same "scroll to see it" tradeoff the map square's own CSS tuning comments
  // already describe for #left's SCAN SECTOR/Getting Started content below it.
  await p.evaluate(()=>{ const G=window.__SD; G.S.msel=null; G.setMapSec(0); G.dirty=true; G.render(); });
  await p.waitForTimeout(200);
  await scrollBottom();
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'fleets-r2-'+tag+'-01-bar-idle.png'});

  // 2) fleet selected, tap a node -> SEND chip. Scrolled to the top so the whole
  // map (and the chip on it) is in frame - the bar's own "sel" state is shot 1's
  // job, this one is about the chip.
  await scrollTop();
  await p.click('#fleetBar [data-fl="1"]');
  await p.waitForTimeout(150);
  await p.click('#mapNodes .mnode[data-s="kor"]');
  await p.waitForTimeout(200);
  await p.screenshot({path:SHOTS+'fleets-r2-'+tag+'-02-fleet-selected-chip.png'});

  // 3) confirm send, then fast-forward partway through the trip for a mid-travel shot
  await p.click('.sendchip');
  await p.waitForTimeout(150);
  await p.evaluate(()=>{
    const G=window.__SD, f=G.S.fl[0];
    f.eta=f.tot*0.5;   // halfway there
    G.dirty=true; G.render();
  });
  await scrollTop();
  await p.waitForTimeout(200);
  await p.screenshot({path:SHOTS+'fleets-r2-'+tag+'-03-midtravel.png'});

  // 4) raid card SEND state - the 2nd target card (near Koru, nobody there yet -
  // the fleet is still travelling). Scrolled to bring the whole #tgts grid into
  // frame (two stacked cards run past a short phone's fold, same #view tradeoff
  // as the map+bar shot above).
  const scrollToTgts=()=>p.evaluate(()=>{
    const el=document.getElementById('tgts'), v=document.getElementById('view');
    if(el&&v)v.scrollTo({top: el.offsetTop - 20, behavior:'instant'});
  });
  await p.evaluate(()=>{ const G=window.__SD; G.gotoTab('p-raid'); });
  await p.waitForTimeout(200);
  await scrollToTgts();
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'fleets-r2-'+tag+'-04-raidcard-send.png'});

  // 5) raid card ENGAGE state - land the fleet at kor (where the 2nd target is)
  await p.evaluate(()=>{ const G=window.__SD; G.fleetTravelTick(9999); G.dirty=true; G.render(); });
  await p.waitForTimeout(200);
  await scrollToTgts();
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'fleets-r2-'+tag+'-05-raidcard-engage.png'});

  // 6) system page FLEETS block - kor, where the fleet just landed
  await p.evaluate(()=>{ const G=window.__SD; G.gotoTab('p-map'); G.S.msel='kor'; G.dirty=true; G.render(); });
  await p.waitForTimeout(250);
  await p.evaluate(()=>{
    const el=document.getElementById('sysFleets'), v=document.getElementById('view');
    if(el&&v)v.scrollTo({top: el.offsetTop - 40, behavior:'instant'});
  });
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'fleets-r2-'+tag+'-06-sysfleets.png'});

  clearInterval(janitor);
  console.log(tag+' ERRORS: '+JSON.stringify(errs));
  await b.close();
  return errs;
}

(async()=>{
  const e1=await run(390,667,'667');
  const e2=await run(390,844,'844');
  const all=e1.concat(e2);
  console.log('TOTAL ERRORS: '+all.length);
})();
