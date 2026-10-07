const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tfleetfix2.js — b646 fleet fixes.
//
// (1) RETAKE/ASSAULT with a fleet already AT the system fights from there: the
//     button is an ENGAGE (no S.trip, no countdown from home) and hands the fight
//     that fleet. A fleet INBOUND is waited for (button disabled, countdown span),
//     and launchAssault() refuses in both cases.
// (2) The SEND chip decides "already here" at tap time - tapping a fleet's own
//     node first, then another node, then SEND must actually send.
// (3) fleetSend() on a travelling fleet toasts instead of a silent no-op.
// (4) Hidden-tab catch-up: a fleet mid-flight lands after a visibility gap.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- (1a) fleet already at the contested system -> ENGAGE, no trip ----------
 const a=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e9, lvl:30, lvSeen:30, ore:1e9, exo:{ir:1e9}, sh:[80,40,15], fhp:1, cmode:"wep"});
   const f=G.S.fl[0]; f.at='tan'; f.to=null;              // parked at tan (ring1, contested)
   G.S.msel='tan'; gotoTab('p-map'); dirty=true; render();
   const btn=document.getElementById('sysWar');
   const launched=G.launchAssault(G.SYSMAP.tan);
   return { label:btn&&btn.textContent, disabled:btn&&btn.disabled, launched, trip:G.S.trip };
 });
 ok('fleet at tan: #sysWar is an ENGAGE, enabled, and launchAssault() refuses (no trip)',
    a.label && /ENGAGE/.test(a.label) && !a.disabled && a.launched===false && !a.trip, a);

 const a2=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('sysWar').click();
   const bt=G.BT? { f:G.BT.f&&G.BT.f.id, sysId:G.BT.t&&G.BT.t.sysId } : null;
   if(G.BT)G.closeBattle();
   return { bt, trip:G.S.trip };
 });
 ok('tapping it opens the fight with THAT fleet at tan, still no trip', a2.bt && a2.bt.f===1 && a2.bt.sysId==='tan' && !a2.trip, a2);

 // ---------- (1b) fleet inbound -> wait, launchAssault refuses ----------
 const c=await p.evaluate(()=>{
   const G=window.__SD;
   const f=G.S.fl[0]; f.at='home'; f.to=null;
   const sent=G.fleetSend(f,'tan');
   G.S.msel='tan'; dirty=true; render();
   const btn=document.getElementById('sysWar');
   const launched=G.launchAssault(G.SYSMAP.tan);
   return { sent, label:btn&&btn.textContent, disabled:btn&&btn.disabled, hasCd:btn&&!!btn.querySelector('.tripcd'), launched, trip:G.S.trip };
 });
 ok('fleet inbound: button reads INBOUND with a countdown, disabled; launchAssault() refuses',
    c.sent && /INBOUND/.test(c.label||'') && c.disabled && c.hasCd && c.launched===false && !c.trip, c);

 // ---------- (3) sending a travelling fleet toasts, no silent no-op ----------
 const d=await p.evaluate(()=>{
   const G=window.__SD;
   const f=G.S.fl[0];
   const again=G.fleetSend(f,'kor');
   const toastEl=document.querySelector('#toasts,.toasts,#toast');
   return { again, to:f.to, toastText:toastEl?toastEl.textContent:'' };
 });
 ok('fleetSend() on a travelling fleet is refused and says so', d.again===false && d.to==='tan' && /en route/i.test(d.toastText), d);

 // ---------- (4) hidden-tab catch-up lands the fleet ----------
 const e=await p.evaluate(async()=>{
   const G=window.__SD;
   const f=G.S.fl[0];
   const etaBefore=f.eta;
   // pretend the tab was hidden for 30s: S.last is what the resume handler measures from
   G.S.last=Date.now()-30000;
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
   document.dispatchEvent(new Event('visibilitychange'));
   return { etaBefore, etaAfter:f.eta, to:f.to, at:f.at };
 });
 ok('30s hidden gap is replayed: eta drops by ~30s (or the fleet lands)', (e.to===null&&e.at==='tan') || (e.etaBefore-e.etaAfter>=29), e);

 // ---------- (2) SEND chip: own node first, then another node, then SEND ----------
 const g=await p.evaluate(()=>{
   const G=window.__SD;
   const f=G.S.fl[0]; f.at='home'; f.to=null; f.eta=0; f.from=null; f.tot=0;
   G.S.msel=null; gotoTab('p-map'); dirty=true; render();
   G.fleetBarTap(1);                                       // select fleet 1
   const home=document.querySelector('.mnode[data-s="home"]'); home.click();   // its own node -> HERE chip
   const chip1=document.querySelector('.sendchip'); const t1=chip1&&chip1.textContent;
   const kor=document.querySelector('.mnode[data-s="kor"]'); kor.click();      // another node
   const chip2=document.querySelector('.sendchip'); const t2=chip2&&chip2.textContent;
   chip2.click();
   return { t1, t2, to:f.to };
 });
 ok('SEND chip: HERE on own node, SEND on another, and tapping SEND actually sends', g.t1==='HERE' && /SEND/.test(g.t2||'') && g.to==='kor', g);

 // ---------- (3) the ASSAULT button sends a real fleet - never the old trip marker ----------
 const asl=await p.evaluate(()=>{
   const G=window.__SD;
   G.fleetDeselect();
   const f=G.S.fl[0]; f.at='home'; f.to=null; f.eta=0; f.from=null; f.tot=0; f.hp=1; G.S.trip=null;
   if(!f.sh.some(n=>n>0))f.sh=[20,5,0];
   G.S.msel='tan'; gotoTab('p-map'); dirty=true; render();
   const btn=document.getElementById('sysWar');
   const before={ label:btn.textContent, disabled:btn.disabled };
   btn.click();
   const sent={ to:f.to, trip:G.S.trip, marker:!!document.querySelector('#mapEdge .tripmark,#tripMarker') };
   f.eta=0.05; G.tick(0.1); dirty=true; render();
   const after=document.getElementById('sysWar');
   return { before, sent, arrived:{ at:f.at, label:after&&after.textContent, disabled:after&&after.disabled } };
 });
 ok('ASSAULT names the fleet it will send and the travel time', /ASSAULT · SEND 1ST FLEET · \d+s/.test(asl.before.label||'') && !asl.before.disabled, asl);
 ok('tapping it sends THAT fleet - no S.trip, no yellow marker from Sol Reach', asl.sent.to==='tan' && !asl.sent.trip && !asl.sent.marker, asl);
 ok('when the fleet arrives the button becomes ENGAGE', asl.arrived.at==='tan' && /ENGAGE/.test(asl.arrived.label||'') && !asl.arrived.disabled, asl);

 ok('no page errors', errs.length===0, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
