const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// ttravel2.js — item 4 of PLAN-batch-sep10.md (patch564/565): fortify build time +
// assault travel time.
//
// (a) module build queue (re-pointed for PLAN-defences.md Run 2, patch597 - the old
//     flat sdLv()/buySysDef() this section tested is gone): dmodBuild() deducts cost
//     immediately, the slot stays at its OLD level/armed state until its own q.dueAt,
//     then completes (via tick() and via offlineReport() catching a build that
//     finished while the tab was closed).
// (b) trip: launching an assault from the Map sets S.trip; arrival (dueAt passed)
//     exposes ENGAGE on the Map panel; only one trip at a time; the 10-minute
//     wait-then-return clock; raids (S.tg) are untouched.
// (c) reload mid-trip keeps S.trip (both a real save/reload round-trip and adopt()'s
//     own sanitize path on a handful of malformed shapes).
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 // patch581b review: this file only ever calls .click() on raw DOM elements
 // inside page.evaluate() (never a Playwright-level p.click()/ElementHandle
 // click), which bypasses hit-testing/pointer-events entirely, so the intro
 // overlay was never actually able to intercept anything here - confirmed by
 // investigation, not assumed. Dismissed anyway, deterministically (not a
 // blind sleep), for the same defense-in-depth reason every other file gets
 // it: a brand-new game (no localStorage) now opens on it.
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // ================================================================ (a) module build queue
 // PLAN-defences.md Run 2 (patch597): the old flat "one defence level, buySysDef()"
 // model this section used to test is retired outright (owner decision 1 - no
 // conversion, no refund - sdLv()/sdCost()/sdQueued()/buySysDef() are all gone).
 // Re-pointed to the same shape of guarantee against the new per-slot API instead:
 // cost deducted immediately, the OLD level/armed state stays live until the queue's
 // dueAt, one queue per SYSTEM (across all three slots), tick()/offlineReport() both
 // complete a due build, defStrength() unchanged mid-build, and the Map sheet's card
 // shows a live countdown without rebuilding the card (tchurn2's own rule).
 const f1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e9, lvl:20, lvSeen:20, ore:1e9, exo:{ir:1e9}});
   G.claimSystem(G.SYSMAP.kor);
   const s=G.SYSMAP.kor;
   const before={ ore:G.S.ore, ir:G.exo('ir') };
   const cost=G.dmodPrice(s,0);
   const built=G.dmodBuild(s,0,'tur');
   const slot=JSON.parse(JSON.stringify(G.S.def.kor.s[0]));
   const after={ ore:G.S.ore, ir:G.exo('ir'), slot };
   return { before, after, cost, built };
 });
 ok('dmodBuild() returns true and deducts the exotic cost immediately', f1.built && f1.after.ir===f1.before.ir-f1.cost, f1);
 ok('the slot stays at level 0 (not yet built) right after buying (build not instant)', f1.after.slot.lv===0 && f1.after.slot.armed===false, f1);
 ok('a queue entry appears with the target level one above the old one', f1.after.slot.q && f1.after.slot.q.to===1, f1);
 ok('the queued duration is 20s at level 0 (SD_BUILD_BASE + SD_BUILD_PER*0)', f1.after.slot.q && Math.round((f1.after.slot.q.dueAt-Date.now())/1000)===20, f1);

 const f2=await p.evaluate(()=>{
   const G=window.__SD;
   const secondBuy=G.dmodBuild(G.SYSMAP.kor,1,'shd');   // a DIFFERENT slot, same system - still refused
   return { secondBuy, oreAfter:G.S.ore };
 });
 ok('a second dmod* action on the same system while one slot is already queued is refused (one queue per system)', f2.secondBuy===false, f2);

 const f3=await p.evaluate(()=>{
   const G=window.__SD;
   const real=Date.now;
   Date.now=()=>real()+25*1000;                        // past the 20s dueAt
   G.tick(0.1);                                         // the live tick() path completes it
   const slot=G.S.def.kor.s[0];
   Date.now=real;
   return { lv:slot.lv, armed:slot.armed, q:slot.q };
 });
 ok('tick() completes a due build: the slot advances to level 1 and arms, the queue clears', f3.lv===1 && f3.armed===true && !f3.q, f3);

 // holdOdds()/defStrength() read the slot's CURRENT level during a build - confirm a
 // new upgrade in progress still reports the pre-upgrade level while queued.
 const f4=await p.evaluate(()=>{
   const G=window.__SD;
   const s=G.SYSMAP.kor;
   const strengthBefore=G.defStrength('kor');
   G.dmodUpgrade(s,0);                                   // queues level 1->2
   const q=G.S.def.kor.s[0].q;
   const strengthDuring=G.defStrength('kor');
   return { strengthBefore, strengthDuring, lvDuring:G.S.def.kor.s[0].lv, q };
 });
 ok('defStrength() (and therefore holdOdds()) is unchanged while an upgrade is in flight', f4.strengthBefore===f4.strengthDuring && f4.lvDuring===1, f4);

 // offlineReport() completes a due queue too, not just tick()
 const f5=await p.evaluate(()=>{
   const G=window.__SD;
   const real=Date.now;
   Date.now=()=>real()+9999999;                         // long past due, and past the 60s offline-report floor
   G.S.last=real()-9999999;
   G.offlineReport();
   const slot=G.S.def.kor.s[0];
   Date.now=real;
   document.getElementById('mask').classList.remove('on');
   return { lv:slot.lv, q:slot.q };
 });
 ok('offlineReport() also completes a due module upgrade', f5.lv===2 && !f5.q, f5);

 // Map sheet: while queued, the card shows a BUILDING badge with a countdown span so
 // the card itself never gets rebuilt for the ticking number (tchurn2's own rule).
 const f6=await p.evaluate(()=>{
   const G=window.__SD;
   G.dmodUpgrade(G.SYSMAP.kor,0);                        // queue another build (2->3)
   G.S.msel='kor'; gotoTab('p-map'); dirty=true; render();
   const card=document.querySelectorAll('#sysDefRow .sc')[0];
   return { hasBuilding:card&&/BUILDING/.test(card.textContent), hasCd:card&&!!card.querySelector('.cardcd') };
 });
 ok('the Map sheet shows a BUILDING card with a countdown span while queued',
    f6.hasBuilding && f6.hasCd, f6);

 // ================================================================ (b) trip
 const t1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e9, lvl:30, lvSeen:30, ore:1e9, exo:{ir:1e9},
     sh:[80,40,15], fhp:1, cmode:"wep"});
   const s=G.SYSMAP.tan;                                 // ring1, rival-held, contested
   const can=G.canAssault(s);
   const launched=G.launchAssault(s);
   return { can, launched, trip:G.S.trip, ring:s.ring };
 });
 ok('canAssault(tan) is true with a fresh fleet at a high level', t1.can, t1);
 ok('launchAssault() sets S.trip on launch', t1.launched && t1.trip && t1.trip.sysId==='tan' && t1.trip.kind==='assault', t1);
 ok('travel time is 25s + 15s*ring (ring1 = 40s)', t1.trip && Math.round((t1.trip.dueAt-t1.trip.t0)/1000)===40, t1);

 const t2=await p.evaluate(()=>{
   const G=window.__SD;
   const other=G.SYSMAP.cor;                             // a different contested system
   const canOther=G.canAssault(other);
   const launchedOther=G.launchAssault(other);            // must be refused - one trip at a time
   return { canOther, launchedOther, stillOnTan:G.S.trip&&G.S.trip.sysId==='tan' };
 });
 ok('only one trip at a time - a second launchAssault() elsewhere is refused', t2.canOther && t2.launchedOther===false && t2.stillOnTan, t2);

 const t3=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.msel='tan'; gotoTab('p-map'); dirty=true; render();
   const btn=document.getElementById('sysTripCd');
   return { enRouteShown:!!btn, disabled:btn&&btn.disabled, hasCd:!!document.querySelector('.tripcd') };
 });
 ok('while travelling, the Map panel shows a disabled EN ROUTE button with a countdown', t3.enRouteShown && t3.disabled && t3.hasCd, t3);

 const t4=await p.evaluate(()=>{
   const G=window.__SD;
   const real=Date.now;
   Date.now=()=>real()+41*1000;                          // past the 40s dueAt
   G.tick(0.1);
   const arrived=G.tripArrived(G.S.trip);
   G.S.msel='tan'; dirty=true; render();
   const engageBtn=document.getElementById('sysWar');
   const r={ arrived, tripStillSet:!!G.S.trip, engageText:engageBtn&&engageBtn.textContent };
   Date.now=real;
   return r;
 });
 ok('arrival: tripArrived() is true and S.trip is still set (fight not auto-started)', t4.arrived && t4.tripStillSet, t4);
 ok('the Map row button becomes ENGAGE on arrival', t4.engageText && /ENGAGE/.test(t4.engageText), t4);

 const t5=await p.evaluate(()=>{
   const G=window.__SD;
   const real=Date.now;
   /* patch581b review: re-establish "arrived" here rather than trusting it
      survived the round-trip from t4 - a separate evaluate() call lets the
      real background requestAnimationFrame loop tick() at least once with
      REAL (non-advanced) Date.now() in between, which would see the trip as
      NOT yet arrived and revert the Map row from ENGAGE back to EN ROUTE,
      making #sysWar null here (a genuine pre-existing race in this file,
      unrelated to the intro overlay - checked; every click in this file is a
      raw DOM .click() inside evaluate(), which bypasses hit-testing/pointer-
      events entirely, so the overlay could never have intercepted it). */
   Date.now=()=>real()+41*1000;
   G.tick(0.1);
   G.S.msel='tan'; dirty=true; render();
   const btn=document.getElementById('sysWar');
   btn.click();                                          // tap ENGAGE
   Date.now=real;
   return { tripCleared:!G.S.trip, battleOpen:!!G.BT };
 });
 ok('tapping ENGAGE clears S.trip and starts the fight', t5.tripCleared && t5.battleOpen, t5);
 await p.evaluate(()=>{ if(window.__SD.BT)window.__SD.endBattle('win'); });

 // waits up to 10 minutes then returns on its own - re-adopt so tan is a fresh,
 // un-fought contested target again (t5 just fought and won it)
 const t6=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e9, lvl:30, lvSeen:30, ore:1e9, exo:{ir:1e9},
     sh:[80,40,15], fhp:1, cmode:"wep"});
   const s=G.SYSMAP.tan;
   G.launchAssault(s);
   const real=Date.now;
   Date.now=()=>real()+41*1000;                          // arrived
   G.tick(0.1);
   const arrivedStillWaiting=!!G.S.trip;
   Date.now=()=>real()+41*1000+11*60*1000;                // 11 minutes after arrival
   G.tick(0.1);
   const returnedAfterWait=!G.S.trip;
   Date.now=real;
   return { arrivedStillWaiting, returnedAfterWait };
 });
 ok('an arrived, un-engaged fleet keeps waiting inside the 10-minute window', t6.arrivedStillWaiting, t6);
 ok('past 10 minutes waiting, the trip clears on its own (fleet returns)', t6.returnedAfterWait, t6);

 // raids (S.tg) are untouched by any of this
 const t7=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.tg=[]; G.S.tgT=999;
   while(G.S.tg.length<1) G.tick(1);                      // let a raid target roll in
   const before=G.S.tg.length;
   G.launchAssault(G.SYSMAP.tan);
   const tripSet=!!G.S.trip;
   const stillCanEngageRaid=G.S.tg.length===before;        // trip does not touch S.tg at all
   return { before, tripSet, stillCanEngageRaid };
 });
 ok('launching an assault trip leaves Raids (S.tg) completely alone', t7.stillCanEngageRaid, t7);
 await p.evaluate(()=>{ window.__SD.S.trip=null; });

 // ================================================================ (c) reload mid-trip
 const c1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e9, lvl:20, lvSeen:20, ore:1e9, exo:{ir:1e9},
     sh:[80,40,15], fhp:1, cmode:"wep"});
   G.launchAssault(G.SYSMAP.tan);
   return { trip:G.S.trip };
 });
 ok('a trip is active before save/reload', c1.trip && c1.trip.sysId==='tan', c1);
 await p.evaluate(()=>document.getElementById('btnSave').click());
 await p.waitForTimeout(300);
 await p.evaluate(()=>document.getElementById('mask').classList.remove('on'));
 await p.reload();
 await p.waitForTimeout(800);
 const c2=await p.evaluate(()=>({ trip:window.__SD.S.trip }));
 ok('S.trip survives a real save/reload round-trip', c2.trip && c2.trip.sysId==='tan' && c2.trip.kind==='assault', c2);
 ok('t0/dueAt are preserved (not restarted) across the reload', c1.trip && c2.trip &&
    c1.trip.t0===c2.trip.t0 && c1.trip.dueAt===c2.trip.dueAt, {before:c1.trip, after:c2.trip});

 // adopt()'s own sanitizer: malformed/stale shapes are dropped, not half-loaded
 const c3=await p.evaluate(()=>{
   const G=window.__SD;
   const cases={};
   G.adopt({...G.fresh(), trip:{sysId:'home', kind:'assault', t0:1, dueAt:2}});
   cases.homeDropped = G.S.trip===null;
   G.adopt({...G.fresh(), trip:{sysId:'tan', kind:'retreat', t0:1, dueAt:2}});
   cases.unknownKindDropped = G.S.trip===null;
   G.adopt({...G.fresh(), trip:{sysId:'nope', kind:'assault', t0:1, dueAt:2}});
   cases.unknownSysDropped = G.S.trip===null;
   G.adopt({...G.fresh(), trip:{sysId:'tan', kind:'assault', t0:5000, dueAt:1}});   // dueAt < t0
   cases.dueAtClampedToT0 = G.S.trip && G.S.trip.dueAt===G.S.trip.t0 && G.S.trip.t0===5000;
   return cases;
 });
 ok('adopt() drops a trip aimed at home', c3.homeDropped, c3);
 ok('adopt() drops a trip with an unrecognised kind', c3.unknownKindDropped, c3);
 ok('adopt() drops a trip naming a system that does not exist', c3.unknownSysDropped, c3);
 ok('adopt() clamps a malformed dueAt<t0 up to t0 rather than rejecting the whole trip', c3.dueAtClampedToT0, c3);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
