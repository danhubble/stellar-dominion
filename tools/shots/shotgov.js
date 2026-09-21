/* Verification screenshots for PLAN-governors (commit 5/5).
   Real game, not a mock - dist/stellar-dominion.html, built from src/.
   Run: node tools/shots/shotgov.js */
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

  await p.evaluate(()=>{
    const G=window.__SD;
    // level 20, Governors researched to 2 (cap 2). Koru claimed and appointed a
    // governor with a real last-buy in the past (the "12s ago" line). Home is left
    // un-appointed so the OFF state is visible too, later in the same run.
    G.adopt({...G.fresh(), lvl:20, lvSeen:20, ore:1e9, all:1e9, cry:1e6,
      exo:{ir:1e9,he:1e9,xe:1e9,am:1e9}, rs:{drill:4,auto:2},
      sys:{ home:{b:{0:5}} }});
    G.claimSystem(G.SYSMAP.kor);
    G.S.sys.kor.b={14:4};   // Koru is kind:"rock" - gi 14 (Regolith Crusher) is ITS OWN ladder's tier 0
    G.govSetAppointed('kor',true);
    G.S.sys.kor.gl={gi:14, t:Date.now()-12000};
    G.S.govBuys=7;
    G.gotoTab('p-map'); G.S.msel='kor'; G.dirty=true; G.render();
  });
  await p.waitForTimeout(200);

  // 1) the GOVERNOR chip ON + the last-buy line, on Koru's system page
  await scrollViewTo(0);
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'gov-'+tag+'-01-chip-on-lastbuy.png'});

  // 2) the GOVERNOR chip OFF, on home's page (never appointed)
  await p.evaluate(()=>{ const G=window.__SD; G.S.msel='home'; G.dirty=true; G.render(); });
  await p.waitForTimeout(150);
  await scrollViewTo(0);
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'gov-'+tag+'-02-chip-off.png'});

  // 3) LIST view - Koru's row carries the ◆ governed marker
  await p.evaluate(()=>{ const G=window.__SD; G.S.msel=null; G.dirty=true; G.render(); });
  await p.waitForTimeout(150);
  await p.click('[data-mm="list"]');
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'gov-'+tag+'-03-list-diamond.png'});

  // 4) the Governors research card in the tech tree
  await p.evaluate(()=>{
    const G=window.__SD;
    G.gotoTab('p-res');
    G.S.rtab=G.RESH.findIndex(r=>r.id==="auto");
    G.dirty=true; G.render();
  });
  await p.waitForTimeout(150);
  await scrollViewTo(0);
  await p.waitForTimeout(150);
  await p.screenshot({path:SHOTS+'gov-'+tag+'-04-research-card.png'});

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
