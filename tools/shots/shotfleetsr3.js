/* Verification screenshots for PLAN-fleets run 3 (BRIEF-fleets-run3.md commit 4).
   Real game, not the mock - dist/stellar-dominion.html, built from src/.
   Run: node tools/shots/shotfleetsr3.js */
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

  const scrollViewTo=(top)=>p.evaluate((top)=>{ const v=document.getElementById('view'); if(v)v.scrollTo({top,behavior:'instant'}); },top);
  const scrollTop=()=>scrollViewTo(0);
  const scrollBottom=()=>p.evaluate(()=>{ const v=document.getElementById('view'); if(v)v.scrollTo({top:v.scrollHeight,behavior:'instant'}); });

  await p.evaluate(()=>{
    const G=window.__SD;
    // level 20: all three fleet slots unlocked. Fleet 1 stays home with a hull mix,
    // Fleet 2 stacks alongside it at home (the offset-marker shot), Fleet 3 is idle
    // at Koru so TRANSFER has nothing to offer it (kept out of that modal's pair).
    G.adopt({...G.fresh(), lvl:20, lvSeen:20, ore:1e9, all:1e9, cry:1e6, exo:{ir:1e9,he:1e9,xe:1e9,am:1e9}});
    G.claimSystem(G.SYSMAP.kor);
    G.S.fl[0].sh=[6,2,1];
    G.S.fl[1].sh=[3,0,0];
    G.S.fl[2].sh=[1,1,0]; G.S.fl[2].at='kor';
    G.gotoTab('p-map'); G.dirty=true; G.render();
  });
  await p.waitForTimeout(200);

  // 1) fleet bar with three real fleets (no LOCKED slots left)
  await p.evaluate(()=>{ const G=window.__SD; G.S.msel=null; G.setMapSec(0); G.dirty=true; G.render(); });
  await p.waitForTimeout(150);
  await scrollBottom();
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'fleets-r3-'+tag+'-01-bar-three-real.png'});

  // 2) three markers, two of them (1 and 2) stacked at home
  await scrollTop();
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'fleets-r3-'+tag+'-02-markers-stacked.png'});

  // 3) TRANSFER modal - Fleet 1 and Fleet 2, both idle at home
  await p.click('#fleetBar [data-fl="1"]');
  await p.waitForTimeout(150);
  await p.click('#fleetBar [data-fl="1"]');   // second tap on the already-selected button opens the card
  await p.waitForTimeout(200);
  await p.click('#fcTransfer');
  await p.waitForTimeout(200);
  await p.screenshot({path:SHOTS+'fleets-r3-'+tag+'-03-transfer-modal.png'});
  await p.evaluate(()=>{ document.getElementById('mask').classList.remove('on'); });

  // 4) Raids tabs with Fleet 2 selected, showing "-> X . Ns" (send it off first)
  await p.evaluate(()=>{
    const G=window.__SD;
    G.gotoTab('p-raid'); G.dirty=true; G.render();
  });
  await p.waitForTimeout(150);
  await p.click('#flTabs [data-fl="2"]');
  await p.waitForTimeout(150);
  await p.evaluate(()=>{ const G=window.__SD; G.fleetSend(G.S.fl[1], 'ash'); G.dirty=true; G.render(); });
  await p.waitForTimeout(200);
  await scrollTop();
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'fleets-r3-'+tag+'-04-raidstabs-fleet2-travelling.png'});

  // 5) level-up modal at 13 -> 14, mentioning 2nd Fleet
  await p.evaluate(()=>{
    const G=window.__SD;
    G.adopt({...G.fresh(), lvl:13, lvSeen:13, ore:1e9});
    G.S.xpn=G.xpNeed(14); G.checkLevel();
    G.gotoTab('p-mis'); G.lvModal();
  });
  await p.waitForTimeout(200);
  await p.screenshot({path:SHOTS+'fleets-r3-'+tag+'-05-levelup-2nd-fleet.png'});

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
