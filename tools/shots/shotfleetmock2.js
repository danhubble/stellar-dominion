const path=require('path');
const GAME_URL='file://'+path.resolve('/home/claude/stellar-dominion/docs/mocks/fleets-mock.html');
const { chromium } = require('playwright-core');
const SHOTS='/home/claude/stellar-dominion/shots/';

async function run(w,h,tag){
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});
 const p=await ctx.newPage({viewport:{width:w,height:h}});
 const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
 p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE ERROR: '+m.text()); });
 await p.goto(GAME_URL);
 await p.waitForTimeout(600);
 const clearToasts=()=>p.evaluate(()=>{ const t=document.getElementById('toasts'); if(t)t.innerHTML=''; });
 const scrollBar=()=>p.evaluate(()=>{ document.getElementById('mkFleetBar').scrollIntoView({block:'center'}); });
 await clearToasts();

 // 1) map view with the fleet bar, nothing selected (Frontier sector: all 3 markers)
 await p.evaluate(()=>{ __SD.S.msel=null; __SD.setMapSec(2); __SD.render(); });
 await p.waitForTimeout(250);
 await clearToasts();
 await scrollBar();
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'fleetmock2-01-'+tag+'-bar-idle.png'});

 // 2) fleet 1 selected from the bar, then tap a node -> confirm chip
 await p.evaluate(()=>{ window.__mockFleetsDebug.selectFleet(1); });
 await p.waitForTimeout(150);
 await p.evaluate(()=>{ window.__mockFleetsDebug.tapNode('wra'); });
 await p.waitForTimeout(200);
 await clearToasts();
 await scrollBar();
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'fleetmock2-02-'+tag+'-fleet-selected-chip.png'});

 // 3) confirm the send, then jump into mid-travel (scroll to the top of the map
 // square itself here, not the bar, so the sliding marker partway along anv->wra
 // is in frame instead of scrolled past)
 await p.evaluate(()=>{ window.__mockFleetsDebug.confirmSend(); });
 await p.waitForTimeout(3000);
 await clearToasts();
 await p.evaluate(()=>{ document.getElementById('mapWrap').scrollIntoView({block:'start'}); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'fleetmock2-03-'+tag+'-midtravel.png'});

 // 4) fleet card modal: select fleet 2 (idle, at home), tap its bar button again
 await p.evaluate(()=>{ __SD.S.msel=null; __SD.setMapSec(0); __SD.render(); });
 await p.waitForTimeout(200);
 await scrollBar();
 await p.evaluate(()=>{ window.__mockFleetsDebug.selectFleet(2); });
 await p.waitForTimeout(150);
 const btn2 = await p.$('#mkFleetBar [data-fbtn="2"]');
 if(btn2) await btn2.evaluate(el=>el.click());
 await p.waitForTimeout(250);
 await clearToasts();
 await p.screenshot({path:SHOTS+'fleetmock2-04-'+tag+'-fleetcard-modal.png'});
 await p.evaluate(()=>{ try{hideModal();}catch(e){} });

 // 5) system page with the reduced FLEETS block (thu: held Frontier system, mock threat)
 await p.evaluate(()=>{ __SD.S.msel='thu'; __SD.render(); document.getElementById('toasts').innerHTML=''; });
 await p.waitForTimeout(250);
 await p.evaluate(()=>{ document.getElementById('mkFleetsBlock').scrollIntoView({block:'center'}); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'fleetmock2-05-'+tag+'-sysfleets-reduced.png'});

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
