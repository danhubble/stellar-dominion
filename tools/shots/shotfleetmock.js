const path=require('path');
const GAME_URL='file://'+path.resolve('/home/claude/stellar-dominion/docs/mocks/fleets-mock.html');
const { chromium } = require('playwright-core');
const SHOTS='/home/claude/stellar-dominion/shots/';
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},isMobile:true,hasTouch:true});
 const p=await ctx.newPage({viewport:{width:390,height:667}});
 const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
 p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE ERROR: '+m.text()); });
 await p.goto(GAME_URL);
 await p.waitForTimeout(600);

 // 1) sector maps with markers: Core (fleet2@home), Inner Reach (fleet3@ash), Frontier (fleet1@anv)
 await p.evaluate(()=>{ __SD.S.msel=null; __SD.setMapSec(0); __SD.render(); });
 await p.waitForTimeout(250);
 await p.screenshot({path:SHOTS+'fleetmock-01a-core-map.png'});
 await p.evaluate(()=>{ __SD.setMapSec(1); __SD.render(); });
 await p.waitForTimeout(250);
 await p.screenshot({path:SHOTS+'fleetmock-01b-innerreach-map.png'});
 await p.evaluate(()=>{ __SD.setMapSec(2); __SD.render(); });
 await p.waitForTimeout(250);
 await p.screenshot({path:SHOTS+'fleetmock-01c-frontier-map.png'});

 // 2) fleet mid-travel: send fleet 1 (idle at anv) to wra, same sector (Frontier)
 await p.evaluate(()=>{ __SD.S.msel='wra'; __SD.render(); });
 await p.waitForTimeout(250);
 const sendBtn = await p.$('#mkFleetsBlock [data-send]');
 const sendLabel = sendBtn ? await sendBtn.textContent() : null;
 if(sendBtn) await sendBtn.evaluate(el=>el.click());
 await p.evaluate(()=>{ __SD.S.msel=null; __SD.setMapSec(2); __SD.render(); });
 await p.waitForTimeout(3000);
 await p.screenshot({path:SHOTS+'fleetmock-02-fleet-midtravel.png'});

 // 3) system page FLEETS block on thu (held Frontier system carrying the mock threat)
 await p.evaluate(()=>{ __SD.S.msel='thu'; __SD.render(); document.getElementById('toasts').innerHTML=''; });
 await p.waitForTimeout(250);
 await p.evaluate(()=>{ document.getElementById('mkFleetsBlock').scrollIntoView({block:'end'}); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'fleetmock-03-sysfleets-threat.png'});

 // finish fleet 1's travel to wra, then screenshot two-fleets-nowhere-yet state is skipped;
 // instead put two fleets at home: send fleet 3 (idle at ash) home, force arrival.
 await p.evaluate(()=>{ __SD.S.msel='home'; __SD.render(); });
 await p.waitForTimeout(250);
 const sendHome = await p.$('#mkFleetsBlock [data-send]');
 if(sendHome) await sendHome.evaluate(el=>el.click());
 await p.evaluate(()=>{ __SD.render(); });
 await p.waitForTimeout(200);
 const fl3 = await p.evaluate(()=> window.__mockFleetsDebug.FL.map(f=>({id:f.id,at:f.at,to:f.to})) );
 const travelling = fl3.filter(f=>f.to);
 for(const f of travelling){ await p.evaluate((id)=>{ window.__mockFleetsDebug.forceArrive(id); }, f.id); }
 await p.evaluate(()=>{ __SD.render(); document.getElementById('toasts').innerHTML=''; });
 await p.waitForTimeout(250);
 await p.evaluate(()=>{ document.getElementById('mkFleetsBlock').scrollIntoView({block:'start'}); });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'fleetmock-03b-sysfleets-two-at-home.png'});

 // 4) transfer modal (home now has 2 fleets)
 const transferBtn = await p.$('#mkTransferBtn');
 if(transferBtn){
   await transferBtn.evaluate(el=>el.click());
   await p.waitForTimeout(200);
   await p.screenshot({path:SHOTS+'fleetmock-04-transfer-modal.png'});
   await p.evaluate(()=>{ hideModal(); });
 } else {
   errs.push('NOTE: #mkTransferBtn not found for screenshot 04');
 }

 // 5) Raids pane tabs
 await p.evaluate(()=>{ __SD.S.msel=null; __SD.gotoTab('p-raid'); __SD.render(); });
 await p.waitForTimeout(300);
 await p.screenshot({path:SHOTS+'fleetmock-05-raids-tabs.png'});

 // 6a) raid card in SEND state (no fleet at its mock location yet)
 await p.screenshot({path:SHOTS+'fleetmock-06a-raidcard-send.png'});

 // 6b) raid card in ENGAGE state: click a SEND button on a raid card, force arrival, re-screenshot
 const raidSend = await p.$('#tgts .tcard .mk-engage.wait');
 if(raidSend){
   await raidSend.evaluate(el=>el.click());
   const busy = await p.evaluate(()=> window.__mockFleetsDebug.FL.filter(f=>f.to).map(f=>f.id) );
   for(const id of busy){ await p.evaluate((i)=>{ window.__mockFleetsDebug.forceArrive(i); }, id); }
   await p.evaluate(()=>{ __SD.render(); });
   await p.waitForTimeout(250);
   await p.screenshot({path:SHOTS+'fleetmock-06b-raidcard-engage.png'});
 } else {
   errs.push('NOTE: no SEND-state raid card button found for screenshot 06b');
 }

 console.log('send button label was: '+sendLabel);
 console.log('ERRORS: '+JSON.stringify(errs));
 await b.close();
})();
