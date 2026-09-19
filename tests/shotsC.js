const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// One-off screenshot script for Batch C (PLAN-ending.md patches 586-588). Not part of
// the regression suite - run manually, same pattern earlier batches' shot scripts used.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 const baseAdopt = ()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, kor:{b:{}}, dra:{b:{}} },
     sd:{kor:5},
     rv:{ hel:{p:0,cd:9e9,seen:1,w:0,mv:G.RIVAL_MOVE_CAP}, cov:{p:0,cd:9e9,seen:1,w:0,mv:G.RIVAL_MOVE_CAP} } });
   G.S.nx={pj1:1}; G.S.en=2400; G.S.end=0; G.S.clicks=26;   // dismiss the "GETTING STARTED" tutorial card
   // rivals stay well under RV_MAX here on purpose - the live page keeps ticking during
   // waitForTimeout() below, and every screenshot in this script creates its own threat
   // by hand (G.thq().push / G.holdLine / G.startDefence), so the real rvMaybeThreat()
   // firing on its own would just add an unwanted second card
 };

 // 1. Raids threat card for a sab threat, showing Nodes at risk
 await p.evaluate((f)=>{ (0,eval)(f)(); }, baseAdopt.toString());
 await p.waitForTimeout(3200);   // let the lvl:99 jump's own "Record unlocked" toasts clear
 await p.evaluate(()=>{ const G=window.__SD;
   G.thq().push({id:1, rv:'hel', sysId:'home', dif:2.1, t:19*3600, kind:'sab'});
   G.gotoTab('p-raid'); G.render();
 });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchC-01-sab-threat-card.png'});

 // 2. Map Core page showing the marker on Sol Reach - the id:1 sab threat from shot 1
 //    is still live in S.thq at this point (nothing has resolved it yet)
 const nodeCheck = await p.evaluate(()=>{ const G=window.__SD; G.gotoTab('p-map'); G.setMapSec(0);
   G.S.msel='home'; G.render();
   const el=document.querySelector('#mapNodes .mnode[data-s="home"]');
   return el&&el.className; });
 console.log('Sol Reach node classes:', nodeCheck);
 await p.waitForTimeout(550);   // catch the ".incoming" pulse (@keyframes mincoming, 1.1s) near its peak
 await p.screenshot({path:SHOTS+'batchC-02-map-core-sol-reach-marker.png'});

 // 3. The hold-result line after a loss ("HOLD THE LINE WITHOUT ME") - force a loss and
 //    show the toast, same road a player taps from the Raids card.
 await p.evaluate((f)=>{ (0,eval)(f)(); }, baseAdopt.toString());
 await p.waitForTimeout(3200);
 await p.evaluate(()=>{ const G=window.__SD;
   G.S.en=240;
   G.thq().push({id:2, rv:'cov', sysId:'home', dif:2.1, t:19*3600, kind:'sab'});
   const orig=Math.random; Math.random=()=>0.999;   // guaranteed loss
   G.holdLine(2);
   Math.random=orig;
   G.gotoTab('p-raid'); G.render();
 });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchC-03-sab-loss-toast.png'});

 // 4. The DEFEND-it-yourself result card after a loss (endDefence's own "Nodes stolen" line)
 await p.evaluate((f)=>{ (0,eval)(f)(); }, baseAdopt.toString());
 await p.waitForTimeout(3200);
 await p.evaluate(()=>{ const G=window.__SD;
   G.S.en=240;
   G.thq().push({id:3, rv:'hel', sysId:'home', dif:2.1, t:19*3600, kind:'sab'});
   G.startDefence(3);
   G.endDefence('lost');
 });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'batchC-04-sab-defence-lost-card.png'});

 await b.close();
 console.log('done');
})();
