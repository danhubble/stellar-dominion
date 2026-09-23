const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tfleets2.js — PLAN-fleets run 1: the state model.
//
// S.fl replaces the old flat S.sh (hulls)/S.fhp (integrity) pair - one fleet, at
// home, plays exactly as before. This covers BRIEF-fleets-run1.md's "Tests" section:
// fresh() seeds Fleet 1, adopt() migrates an old sh/fhp save and self-heals a save
// missing S.fl, buyShip()/shipCost()/stationHan()/recallHan() round-trip through
// S.fl[0], engageTarget() ties BT.f to the fleet actually fighting, and the final
// battle's merge/unmerge puts a two-fleet fight's integrity and losses back sensibly.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------------- a fresh save has one fleet, at home, empty ----------------
 const fresh=await p.evaluate(()=>{
   const G=window.__SD;
   const f=G.fresh();
   return { flLen:f.fl.length, id:f.fl[0].id, n:f.fl[0].n, sh:f.fl[0].sh, hp:f.fl[0].hp,
     at:f.fl[0].at, to:f.fl[0].to, flSel:f.flSel, hasSh:'sh' in f, hasFhp:'fhp' in f };
 });
 ok('fresh() seeds exactly one fleet', fresh.flLen===1, fresh);
 ok('Fleet 1: id 1, "1st Fleet", empty hulls, full integrity, at home, not travelling',
   fresh.id===1 && fresh.n==="1st Fleet" && JSON.stringify(fresh.sh)==="[0,0,0]" &&
   fresh.hp===1 && fresh.at==="home" && fresh.to===null, fresh);
 ok('S.flSel defaults to Fleet 1', fresh.flSel===1, fresh);
 ok('the old S.sh/S.fhp keys are gone', !fresh.hasSh && !fresh.hasFhp, fresh);

 // ---------------- an old save (S.sh/S.fhp, no S.fl) adopts into S.fl[0] ----------------
 const migrated=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ sh:[3,1,0], fhp:.6 });
   return { flLen:G.S.fl.length, sh:G.S.fl[0].sh, hp:G.S.fl[0].hp, at:G.S.fl[0].at,
     hasSh:'sh' in G.S, hasFhp:'fhp' in G.S };
 });
 ok('an old sh/fhp save becomes exactly one fleet', migrated.flLen===1, migrated);
 ok('...carrying the old hull counts and integrity, at home',
   JSON.stringify(migrated.sh)==="[3,1,0]" && Math.abs(migrated.hp-0.6)<1e-9 && migrated.at==="home", migrated);
 ok('...and the old top-level keys are gone from S', !migrated.hasSh && !migrated.hasFhp, migrated);

 // ---------------- a save missing S.fl entirely self-heals ----------------
 const healed=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ lvl:5 });
   const bad=JSON.parse(JSON.stringify(G.S)); delete bad.fl; delete bad.flSel;
   G.adopt(bad);
   return { flLen:G.S.fl.length, id:G.S.fl[0].id, flSel:G.S.flSel };
 });
 ok('a save with S.fl missing self-heals to a single fresh Fleet 1', healed.flLen===1 && healed.id===1 && healed.flSel===1, healed);

 // ---------------- buyShip() lands in S.fl[0], shipCost() matches the b640 formula ----------------
 const buy=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, lvl:20, lvSeen:20});
   const totalBefore=0;
   const costHand=G.SHIPS[0].b*Math.pow(G.SHIPS[0].g,totalBefore)*(Math.pow(G.SHIPS[0].g,5)-1)/(G.SHIPS[0].g-1);
   const costFn=G.shipCost(0,5);
   const bought=G.buyShip(0,5);
   return { costFn, costHand, matches:Math.abs(costFn-costHand)<1e-6, bought, sh:G.S.fl[0].sh.slice() };
 });
 ok('shipCost() matches the b640 formula for the same total owned count', buy.matches, buy);
 ok('buyShip() lands the hulls in S.fl[0]', buy.bought && buy.sh[0]===5, buy);

 // ---------------- stationHan()/recallHan() round-trip through S.fl[0] ----------------
 const han=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}});
   G.buyShip(0,10);
   G.claimSystem(G.SYSMAP.kor);
   G.dmodBuild(G.SYSMAP.kor,0,'han');
   G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   const before=G.S.fl[0].sh[0];
   const stationed=G.stationHan('kor',0,4);
   const afterStation=G.S.fl[0].sh[0];
   const recalled=G.recallHan('kor',0,4);
   const afterRecall=G.S.fl[0].sh[0];
   return { stationed, before, afterStation, recalled, afterRecall };
 });
 ok('stationHan() takes hulls out of S.fl[0]', han.stationed && han.afterStation===han.before-4, han);
 ok('recallHan() returns them to S.fl[0]', han.recalled && han.afterRecall===han.before, han);

 // ---------------- engageTarget() ties BT.f to the fleet actually fighting ----------------
 const engage=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   G.engageTarget(t,-1);
   const btIsFleet1=G.BT.f===G.S.fl[0];
   G.endBattle("timeout");
   return { btIsFleet1, hpAfter:G.S.fl[0].hp, hpIsFraction: G.S.fl[0].hp>0 && G.S.fl[0].hp<=1 };
 });
 ok('engageTarget() sets BT.f===S.fl[0] (the only fleet in run 1)', engage.btIsFleet1, engage);
 ok('endBattle("timeout") writes the result back to S.fl[0].hp', engage.hpIsFraction, engage);

 // ---------------- final battle: merge two fleets, fight, unmerge sensibly ----------------
 const final=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30});
   // built by hand: two fleets, distinct hull mixes and integrity, per the brief.
   G.S.fl=[
     {id:1,n:"1st Fleet",sh:[100,0,0],hp:1,at:"home",to:null,eta:0},
     {id:2,n:"2nd Fleet",sh:[0,50,0],hp:0.5,at:"home",to:null,eta:0}
   ];
   const mf=G.mergeFleetsForFinal();
   const mergeOk = JSON.stringify(mf.sh)==="[100,50,0]" && Math.abs(mf.hp-0.5)<1e-9;
   // a clean win: no hull losses, integrity comes back from the fight (0.8 here).
   const mfWin=G.mergeFleetsForFinal(); mfWin.hp=0.8;
   G.unmergeAfterFinal(mfWin);
   const winSh1=G.S.fl[0].sh.slice(), winSh2=G.S.fl[1].sh.slice();
   const winHp1=G.S.fl[0].hp, winHp2=G.S.fl[1].hp;
   // reset, then a loss: scrap 25% of the merged interceptors, split back
   // proportionally (Fleet 1 owned all 100 of them, so it eats the whole loss).
   G.S.fl=[
     {id:1,n:"1st Fleet",sh:[100,0,0],hp:1,at:"home",to:null,eta:0},
     {id:2,n:"2nd Fleet",sh:[0,50,0],hp:0.5,at:"home",to:null,eta:0}
   ];
   const mfLoss=G.mergeFleetsForFinal();
   mfLoss.sh[0]-=25; mfLoss.hp=0.35;
   G.unmergeAfterFinal(mfLoss);
   const lossSh1=G.S.fl[0].sh.slice(), lossSh2=G.S.fl[1].sh.slice();
   const lossHp1=G.S.fl[0].hp, lossHp2=G.S.fl[1].hp;
   return { mergeOk, winSh1, winSh2, winHp1, winHp2, lossSh1, lossSh2, lossHp1, lossHp2 };
 });
 ok('mergeFleetsForFinal() sums hulls across every fleet and takes the min integrity', final.mergeOk, final);
 ok('a clean win leaves hull counts untouched', JSON.stringify(final.winSh1)==="[100,0,0]" && JSON.stringify(final.winSh2)==="[0,50,0]", final);
 ok('...and writes the post-fight integrity back to every fleet uniformly',
   Math.abs(final.winHp1-0.8)<1e-9 && Math.abs(final.winHp2-0.8)<1e-9, final);
 ok('a loss splits hull losses proportionally - Fleet 1 owned every interceptor, so it eats the loss',
   final.lossSh1[0]===75 && final.lossSh2[0]===0, final);
 ok('...and writes the post-fight integrity back to every fleet uniformly on a loss too',
   Math.abs(final.lossHp1-0.35)<1e-9 && Math.abs(final.lossHp2-0.35)<1e-9, final);

 // ================== PLAN-fleets run 2: position, travel, the fleet bar ==================
 // BRIEF-fleets-run2.md's "Tests" section: travelSecs() maths, fleetSend()/
 // fleetTravelTick() landing and refusing, engageTarget() gated on t.sys, a raid
 // card's SEND/ENGAGE states, an offline arrival, the fleet bar's hidden/locked
 // states and its LOCATE tap, and node-tap interception with the SEND chip.

 // earlier tests in this file fight battles but never close the results screen -
 // BT stays truthy until closeBattle() runs, and fleetSend() (rightly) refuses to
 // send a fleet mid-fight. Clear it before any of the travel tests below run.
 await p.evaluate(()=>{ const G=window.__SD; if(G.BT)G.closeBattle(); });

 // ---------------- travelSecs(): same-sector distance, cross-sector rings ----------------
 const travel=await p.evaluate(()=>{
   const G=window.__SD;
   const A=G.SYSMAP.home, B=G.SYSMAP.kor;         // both sec 0 - same-sector maths
   const dist=Math.hypot(A.sx-B.sx,A.sy-B.sy);
   const sameSecExpected=G.TRAVEL_BASE+G.TRAVEL_PER_UNIT*dist;
   const sameSecGot=G.travelSecs('home','kor');
   const C=G.SYSMAP.home, D=G.SYSMAP.ash;         // sec 0 -> sec 1 - cross-sector maths
   const rings=Math.abs(C.ring-D.ring);
   const crossSecExpected=G.TRAVEL_BASE+G.TRAVEL_PER_RING*rings;
   const crossSecGot=G.travelSecs('home','ash');
   return { sameSec:A.sec===B.sec, sameSecExpected, sameSecGot,
     crossSec:C.sec!==D.sec, crossSecExpected, crossSecGot };
 });
 ok('travelSecs(): same sector is TRAVEL_BASE + TRAVEL_PER_UNIT*dist(sx,sy)',
   travel.sameSec && Math.abs(travel.sameSecExpected-travel.sameSecGot)<1e-9, travel);
 ok('travelSecs(): crossing sectors is TRAVEL_BASE + TRAVEL_PER_RING*|ring delta| (distance ignored)',
   travel.crossSec && Math.abs(travel.crossSecExpected-travel.crossSecGot)<1e-9, travel);

 // ---------------- fleetSend()/fleetTravelTick(): send, refuse, land ----------------
 const send=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:14, lvSeen:14});
   const f=G.S.fl[0];
   const sent=G.fleetSend(f,'kor');
   const to1=f.to, from1=f.from, eta1=f.eta, tot1=f.tot;
   const sentAgain=G.fleetSend(f,'dra');          // refused - already travelling
   G.fleetTravelTick(f.eta+1);
   return { sent, to1, from1, eta1, tot1, sentAgain,
     at2:f.at, to2:f.to, eta2:f.eta, from2:f.from };
 });
 ok('fleetSend() sets to/from/eta/tot', send.sent && send.to1==='kor' && send.from1==='home' && send.eta1>0 && send.tot1===send.eta1, send);
 ok('fleetSend() refuses a fleet that is already travelling', send.sentAgain===false, send);
 ok('fleetTravelTick(eta+1) lands the fleet: at=dest, to/from=null, eta=0', send.at2==='kor' && send.to2===null && send.from2===null && send.eta2===0, send);

 // ---------------- engageTarget() refused with no fleet at t.sys ----------------
 const noFleet=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const t=Object.assign(G.newTarget(), {sys:"kor"});   // the fleet (migrated from sh/fhp) is at home
   G.engageTarget(t,-1);
   return { btStarted:!!G.BT };
 });
 ok('engageTarget() refuses (no battle starts) when no fleet is at t.sys', !noFleet.btStarted, noFleet);

 // ---------------- a raid target card: SEND while away, ENGAGE once there ----------------
 const card=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:14, lvSeen:14, ore:1e30});
   G.buyShip(0,10);
   G.S.tg=[Object.assign(G.newTarget(),{sys:"kor"})];
   G.gotoTab("p-raid"); G.dirty=true; G.render();
   const away=document.querySelector("#tgts .tcard button");
   const awayText=away?away.textContent:null;
   G.fleetSend(G.S.fl[0],"kor");
   G.fleetTravelTick(G.S.fl[0].eta+1);
   G.dirty=true; G.render();
   const there=document.querySelector("#tgts .tcard button");
   return { awayText, thereText: there?there.textContent:null };
 });
 ok('a raid target card shows SEND while the fleet is away', /SEND/.test(card.awayText), card);
 ok('...and ENGAGE/AUTO-RESOLVE once the fleet has arrived', /ENGAGE|AUTO-RESOLVE/.test(card.thereText), card);

 // ---------------- offline arrival: eta<=away lands the fleet, quietly ----------------
 const offline=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:14, lvSeen:14});
   G.S.fl[0].to="kor"; G.S.fl[0].from="home"; G.S.fl[0].eta=10; G.S.fl[0].tot=30;
   G.S.last=Date.now()-70000;   // 70s "away" - well past the 10s left on the eta
   G.offlineReport();
   return { at:G.S.fl[0].at, to:G.S.fl[0].to, eta:G.S.fl[0].eta };
 });
 ok('offline arrival: offlineReport() catches a fleet up and lands it', offline.at==="kor" && offline.to===null && offline.eta===0, offline);

 // ---------------- the fleet bar: hidden below Raids level, locked slots above it ----------------
 const bar=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:G.RAIDLV-1, lvSeen:G.RAIDLV-1});
   G.gotoTab("p-map"); G.dirty=true; G.render();
   const hiddenBelow=document.getElementById("fleetBar").hidden;
   G.adopt({...G.fresh(), lvl:12, lvSeen:12});
   G.dirty=true; G.render();
   const btns=[...document.querySelectorAll("#fleetBar button")];
   return { hiddenBelow, hiddenAt12:document.getElementById("fleetBar").hidden,
     count:btns.length, locked:btns.filter(b=>b.classList.contains("locked")).length };
 });
 ok('the fleet bar is hidden below the Raids unlock level', bar.hiddenBelow===true, bar);
 ok('at level 12: one real fleet button + two LOCKED slots', !bar.hiddenAt12 && bar.count===3 && bar.locked===2, bar);

 // ---------------- tapping a bar button LOCATEs - switches mapSec ----------------
 const locate=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:14, lvSeen:14});
   G.S.fl[0].at="ash";                            /* Inner Reach - a different sector than home's */
   G.gotoTab("p-map"); G.setMapSec(0); G.dirty=true; G.render();
   const before=G.mapSec;
   document.querySelector('#fleetBar [data-fl="1"]').click();
   return { before, after:G.mapSec, expected:G.SYSMAP.ash.sec };
 });
 ok('tapping the fleet bar button switches mapSec to the fleet\'s own sector',
   locate.before===0 && locate.expected!==0 && locate.after===locate.expected, locate);

 // ---------------- node tap while selected: chip, not the system page; chip sends ----------------
 const nodeTap=await p.evaluate(()=>{
   const G=window.__SD;
   G.fleetDeselect();   /* the LOCATE test just above leaves a fleet selected - start clean */
   G.adopt({...G.fresh(), lvl:14, lvSeen:14});
   G.gotoTab("p-map"); G.setMapSec(0); G.dirty=true; G.render();
   document.querySelector('#fleetBar [data-fl="1"]').click();
   const selAfterTap=G.flSel;
   document.querySelector('#mapNodes .mnode[data-s="kor"]').click();
   const mselAfterNodeTap=G.S.msel;
   const chip=document.querySelector(".sendchip");
   const chipText=chip?chip.textContent:null;
   if(chip)chip.click();
   return { selAfterTap, mselAfterNodeTap, chipText,
     flSelAfter:G.flSel, toAfter:G.S.fl[0].to };
 });
 ok('tapping a bar button selects the fleet', nodeTap.selAfterTap===1, nodeTap);
 ok('a node tap while a fleet is selected does NOT open the system page', nodeTap.mselAfterNodeTap===null, nodeTap);
 ok('...and shows a SEND chip on that node instead', !!nodeTap.chipText && /SEND/.test(nodeTap.chipText), nodeTap);
 ok('tapping the chip sends the fleet and deselects', nodeTap.flSelAfter===null && nodeTap.toAfter==="kor", nodeTap);

 // ================== PLAN-fleets run 3: fleets 2 and 3 ==================
 // BRIEF-fleets-run3.md's "Tests" section: fleetSlots() at 13/16/22, an old
 // level-22 save gaining two fleets on load with one combined toast, the
 // level-up modal's Fleet-2 line, TRANSFER, buyShip()'s delivery queue,
 // three markers (two stacked), autoResolveTarget() picking the fleet AT the
 // target with two fleets in play, and the final-battle merge with three.
 // PLAN-polish batch B item 4: FLEET_UNLOCK's 14/20 moved to 16/22 - every
 // fixture below that relied on the old thresholds is updated to match.

 // ---------------- fleetSlots(): 13 -> 1, 16 -> 2, 22 -> 3 ----------------
 const slots=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:13, lvSeen:13}); const at13=G.fleetSlots();
   G.adopt({...G.fresh(), lvl:16, lvSeen:16}); const at16=G.fleetSlots();
   G.adopt({...G.fresh(), lvl:22, lvSeen:22}); const at22=G.fleetSlots();
   return { at13, at16, at22 };
 });
 ok('fleetSlots(): level 13 -> 1 slot (only Fleet 1 is unlocked)', slots.at13===1, slots);
 ok('fleetSlots(): level 16 -> 2 slots', slots.at16===2, slots);
 ok('fleetSlots(): level 22 -> 3 slots', slots.at22===3, slots);

 // ---------------- ensureFleets(): a single new slot queues one VEGA notice ----------------
 const single=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:15, lvSeen:15});
   document.getElementById('toasts').innerHTML='';
   G.S.lvl=16;                       // one threshold crossed since the last check
   const added=G.ensureFleets();
   return { added, flLen:G.fleets().length, notifyQueue:G.S.notifyQueue.slice(),
     toastCount:document.querySelectorAll('#toasts .toast').length };
 });
 ok('ensureFleets(): crossing exactly one threshold adds one fleet and queues its own VEGA notice',
   JSON.stringify(single.added)==="[2]" && single.flLen===2 &&
   single.notifyQueue.includes("vega:fleet2") && single.toastCount===0, single);

 // ---------------- an old level-22 save with one fleet gains two on load, one toast ----------------
 const oldSave=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('toasts').innerHTML='';
   G.adopt({ lvl:22, sh:[3,1,0], fhp:1 });   // old sh/fhp save, exactly at the level-22 Fleet 3 threshold
   const toasts=[...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent);
   return {
     flLen:G.S.fl.length,
     f2:{at:G.S.fl[1].at, hp:G.S.fl[1].hp, sh:G.S.fl[1].sh.slice()},
     f3:{at:G.S.fl[2].at, hp:G.S.fl[2].hp, sh:G.S.fl[2].sh.slice()},
     seen2:!!G.S.seen["vega:fleet2"], seen3:!!G.S.seen["vega:fleet3"],
     notifyQueue:G.S.notifyQueue.slice(), toasts
   };
 });
 ok('an old level-22 save gains Fleet 2 and Fleet 3 on load, empty, at home, full integrity',
   oldSave.flLen===3 && oldSave.f2.at==="home" && oldSave.f2.hp===1 && JSON.stringify(oldSave.f2.sh)==="[0,0,0]" &&
   oldSave.f3.at==="home" && oldSave.f3.hp===1 && JSON.stringify(oldSave.f3.sh)==="[0,0,0]", oldSave);
 ok('...both notices are marked seen so they never fire individually later',
   oldSave.seen2 && oldSave.seen3 && !oldSave.notifyQueue.includes("vega:fleet2") && !oldSave.notifyQueue.includes("vega:fleet3"), oldSave);
 ok('...and exactly one combined "commissioned" toast fires instead of two',
   oldSave.toasts.length===1 && /commissioned/.test(oldSave.toasts[0]), oldSave);

 // ---------------- the level-up modal (15 -> 16) mentions 2nd Fleet ----------------
 const lvup=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:15, lvSeen:15, ore:1e9});
   G.S.xpn=G.xpNeed(16); G.checkLevel();
   const pending=G.pendingLevels();
   G.lvModal();
   return { pending, html:document.getElementById('modal').innerHTML };
 });
 ok('checkLevel() earns level 16 (one pick pending)', lvup.pending===1, lvup);
 ok('lvModal() at 15 -> 16 mentions 2nd Fleet, same styling as an UNLOCK line',
   /2nd Fleet/.test(lvup.html) && /lvun/.test(lvup.html), lvup);

 // ---------------- TRANSFER: moves hulls both ways, refuses when apart ----------------
 const transfer=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, ore:1e30});
   G.S.fl=[
     {id:1,n:"1st Fleet",sh:[5,2,0],hp:1,at:"kor",to:null,eta:0},
     {id:2,n:"2nd Fleet",sh:[0,3,1],hp:1,at:"kor",to:null,eta:0},
     {id:3,n:"3rd Fleet",sh:[1,0,0],hp:1,at:"home",to:null,eta:0}
   ];
   const f1=G.S.fl[0], f2=G.S.fl[1], f3=G.S.fl[2];
   const matesAtKor=G.otherIdleFleetsAt(f1).map(f=>f.id);
   const matesAlone=G.otherIdleFleetsAt(f3).map(f=>f.id);
   G.transferModal(f1,f2);
   document.querySelector('#trRows .trbtn[data-i="0"][data-d="-1"]').click();   // move 1 interceptor f1 -> f2
   const afterMove={f1:f1.sh.slice(), f2:f2.sh.slice()};
   document.querySelector('#trRows .trbtn[data-i="0"][data-d="1"]').click();    // move it back f2 -> f1
   const afterBack={f1:f1.sh.slice(), f2:f2.sh.slice()};
   document.getElementById('mask').classList.remove('on');
   G.transferModal(f1,f3);                 // f1 at kor, f3 at home - apart
   const apartHtml=document.getElementById('modal').innerHTML;
   return { matesAtKor, matesAlone, afterMove, afterBack, apartHtml };
 });
 ok('otherIdleFleetsAt() finds the other idle fleet at the same system', JSON.stringify(transfer.matesAtKor)==="[2]", transfer);
 ok('...and is empty for a fleet alone at its own system', JSON.stringify(transfer.matesAlone)==="[]", transfer);
 ok('transferModal(): the "-" button moves one hull from a to b',
   JSON.stringify(transfer.afterMove.f1)==="[4,2,0]" && JSON.stringify(transfer.afterMove.f2)==="[1,3,1]", transfer);
 ok('...and the "+" button moves it back',
   JSON.stringify(transfer.afterBack.f1)==="[5,2,0]" && JSON.stringify(transfer.afterBack.f2)==="[0,3,1]", transfer);
 ok('transferModal() refuses (no rows) when the two fleets are no longer at the same system',
   /no longer here/.test(transfer.apartHtml), transfer);

 // ---------------- Raids pane #flTabs: the selected tab's own AT/-> location line ----------------
 const flLoc=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20});
   G.gotoTab("p-raid"); G.dirty=true; G.render();
   const atHome=document.getElementById("flLoc").textContent;
   document.getElementById('flTabs').querySelector('[data-fl="2"]').click();   // select Fleet 2
   G.fleetSend(G.S.fl[1],"kor");
   G.dirty=true; G.render();
   const travelling=document.getElementById("flLoc").textContent;
   return { atHome, travelling, selTab:G.S.flSel };
 });
 ok('#flTabs strip shows "AT <system>" for the selected tab\'s own fleet', /^AT /.test(flLoc.atHome), flLoc);
 ok('...and "→ <system> · Ns" once that fleet is travelling (Fleet 2, the selected tab)',
   flLoc.selTab===2 && /^→ KORU · \d+s$/.test(flLoc.travelling), flLoc);

 // ---------------- buyShip(): lands at home, else queues; queue drains on arrival ----------------
 const queue=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:13, lvSeen:13, ore:1e30});   // lvl 13: only Fleet 1 exists (fleetSlots()===1)
   const f=G.S.fl[0];
   G.fleetSend(f,'kor');                   // the only fleet leaves home - none idle there
   const bought=G.buyShip(0,5);
   const queuedAfterBuy=G.S.flQ.slice();
   const totalAfterBuy=G.shipTotal(0);     // must count the queue immediately
   G.fleetTravelTick(f.eta+1);             // lands the fleet at kor - still no fleet home
   G.fleetSend(f,'home');                  // now send it back
   G.fleetTravelTick(f.eta+1);             // lands the fleet home, draining the queue
   return { bought, queuedAfterBuy, totalAfterBuy, landedSh:f.sh.slice(), flQAfter:G.S.flQ.slice() };
 });
 ok('buyShip() queues on S.flQ when no fleet is idle at home', queue.bought && JSON.stringify(queue.queuedAfterBuy)==="[5,0,0]", queue);
 ok('shipTotal() counts the queue toward the empire-wide total right away', queue.totalAfterBuy===5, queue);
 ok('the queue lands in the fleet that next arrives home idle, and clears',
   JSON.stringify(queue.landedSh)==="[5,0,0]" && JSON.stringify(queue.flQAfter)==="[0,0,0]", queue);

 const queueOnLoad=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, flQ:[2,0,0]});   // fleet 1 already idle at home
   return { sh:G.S.fl[0].sh.slice(), flQ:G.S.flQ.slice() };
 });
 ok('a queued purchase already sitting in a loaded save drains immediately when a fleet is already home',
   JSON.stringify(queueOnLoad.sh)==="[2,0,0]" && JSON.stringify(queueOnLoad.flQ)==="[0,0,0]", queueOnLoad);

 // ---------------- three markers render; two stacked at the same node offset 14px ----------------
 const markers=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:22, lvSeen:22});   // 22: all three fleet slots open (item 4)
   G.S.fl[1].sh=[1,0,0]; G.S.fl[2].sh=[1,0,0];
   G.gotoTab("p-map"); G.setMapSec(0); G.dirty=true; G.render();
   const marks=[...document.querySelectorAll('#fleetMarkers .flmark:not(.trav)')];
   const offsets=marks.map(m=>{ const mm=m.style.left.match(/\+\s*(-?\d+)px/); return mm?+mm[1]:null; });
   return { count:marks.length, offsets };
 });
 ok('three fleets idle at home render three markers', markers.count===3, markers);
 ok('...stepped 0px/14px/28px right of each other in fleet order, not stacked on top of one another',
   JSON.stringify(markers.offsets)==="[0,14,28]", markers);

 // ---------------- autoResolveTarget(): the fleet AT the target, not the selected tab ----------------
 const twoFleetResolve=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     wep:{own:{pulse:1,rocket:1}, slot:["pulse","rocket"]}});
   // fleet 1 (the hulls, migrated from sh/fhp) stays at home; fleet 2 gets an equal
   // loadout (refDPS()/refHP() read curFleet() as the difficulty-scaling reference,
   // so it must not be left empty here) and moves to kor as the SELECTED tab - the
   // target is at home, so the fight must use fleet 1 regardless of which fleet the
   // Raids pane happens to be showing.
   G.S.fl[1].sh=G.S.fl[0].sh.slice(); G.S.fl[1].at="kor"; G.S.flSel=2;
   const t=Object.assign(G.assaultTarget(G.SYSMAP.dra), {sys:"home"});
   const canAuto=G.canAutoResolve(t);
   const resolved=G.autoResolveTarget(t,-1);
   return { canAuto, resolved, fightFleet:G.BT?G.BT.f.id:null, selectedTab:G.S.flSel };
 });
 ok('canAutoResolve()/autoResolveTarget() find the fleet at t.sys (fleet 1, at home)', twoFleetResolve.canAuto && twoFleetResolve.resolved, twoFleetResolve);
 ok('...not the fleet the Raids pane tab happens to be showing (fleet 2, selected but away)',
   twoFleetResolve.fightFleet===1 && twoFleetResolve.selectedTab===2, twoFleetResolve);

 // ---------------- final battle merge with three fleets ----------------
 const finalThree=await p.evaluate(()=>{
   const G=window.__SD;
   if(G.BT)G.closeBattle();
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30});
   G.S.fl=[
     {id:1,n:"1st Fleet",sh:[60,0,0],hp:1,at:"home",to:null,eta:0},
     {id:2,n:"2nd Fleet",sh:[30,0,0],hp:0.5,at:"home",to:null,eta:0},
     {id:3,n:"3rd Fleet",sh:[10,20,0],hp:0.8,at:"home",to:null,eta:0}
   ];
   const mf=G.mergeFleetsForFinal();
   const mergeOk=JSON.stringify(mf.sh)==="[100,20,0]" && Math.abs(mf.hp-0.5)<1e-9;
   // lose 25 of the merged 100 interceptors - split proportionally to what each
   // fleet contributed (60/30/10), the last fleet in the list absorbing the remainder.
   mf.sh[0]-=25; mf.hp=0.4;
   G.unmergeAfterFinal(mf);
   return { mergeOk, sh1:G.S.fl[0].sh.slice(), sh2:G.S.fl[1].sh.slice(), sh3:G.S.fl[2].sh.slice(),
     hp1:G.S.fl[0].hp, hp2:G.S.fl[1].hp, hp3:G.S.fl[2].hp };
 });
 ok('mergeFleetsForFinal() sums hulls and takes the min integrity across three fleets', finalThree.mergeOk, finalThree);
 ok('unmergeAfterFinal() splits a loss across three fleets proportionally to what each contributed',
   JSON.stringify(finalThree.sh1)==="[45,0,0]" && JSON.stringify(finalThree.sh2)==="[22,0,0]" &&
   JSON.stringify(finalThree.sh3)==="[8,20,0]", finalThree);
 ok('...and writes the post-fight integrity back to every one of the three fleets',
   Math.abs(finalThree.hp1-0.4)<1e-9 && Math.abs(finalThree.hp2-0.4)<1e-9 && Math.abs(finalThree.hp3-0.4)<1e-9, finalThree);

 // ---------------- PLAN-fleets follow-up (shipped with governors): per-fleet cap ----------------
 // each fleet may reach fleetCap() alone - the cap is no longer one empire-wide pool
 // shared by all three.
 const perFleetCap=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:20, lvSeen:20, ore:1e30});
   const cap=G.fleetCap();
   const cheapest=G.SHIPS.reduce((bi,sp,i)=>sp.pw<G.SHIPS[bi].pw?i:bi,0), pw=G.SHIPS[cheapest].pw;
   const k=Math.floor(cap/pw);
   G.S.flSel=1;
   const bought1=G.buyShip(cheapest,k);
   const f1Left=G.capLeft(G.fleet(1));
   const f2Before=G.capLeft(G.fleet(2));   // untouched by fleet 1's own spend
   G.S.flSel=2;
   const bought2=G.buyShip(cheapest,k);    // fleet 2 fills its OWN cap independently
   const f2Left=G.capLeft(G.fleet(2));
   return { cap, pw, k, bought1, bought2, f1Left, f2Before, f2Left };
 });
 ok('fleet 1 can fill its own fleetCap() power', perFleetCap.bought1 && perFleetCap.f1Left<perFleetCap.pw, perFleetCap);
 ok("fleet 1 spending its cap leaves fleet 2's own cap completely untouched",
   perFleetCap.f2Before===perFleetCap.cap, perFleetCap);
 ok('fleet 2 can independently fill its own fleetCap() power too (three separate pools, not one shared)',
   perFleetCap.bought2 && perFleetCap.f2Left<perFleetCap.pw, perFleetCap);

 // hangar round-trip keeps the attribution: stationing moves power from a fleet's
 // onboard bucket to its own hangar bucket (net unchanged for THAT fleet), and never
 // touches another fleet's capacity; recalling returns it exactly.
 const hangarAttr=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:20, lvSeen:20, ore:1e30, exo:{ir:1e9}});
   G.claimSystem(G.SYSMAP.kor);
   G.dmodBuild(G.SYSMAP.kor,0,'han'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   G.S.fl[0].sh=[10,0,0]; G.S.fl[1].sh=[5,0,0];
   const f1Before=G.capLeft(G.fleet(1)), f2Before0=G.capLeft(G.fleet(2));
   G.S.flSel=1;
   const stationed1=G.stationHan('kor',0,4);           // fleet 1 stations 4 Interceptors
   const f1AfterStation=G.capLeft(G.fleet(1)), f2AfterFleet1Station=G.capLeft(G.fleet(2));
   const recalled1=G.recallHan('kor',0,4);
   const f1AfterRecall=G.capLeft(G.fleet(1));
   G.S.flSel=2;
   const stationed2=G.stationHan('kor',0,3);           // now fleet 2 stations into the same hangar
   const f1AfterFleet2Station=G.capLeft(G.fleet(1)), f2AfterStation=G.capLeft(G.fleet(2));
   return { f1Before, f2Before0, stationed1, f1AfterStation, f2AfterFleet1Station, recalled1, f1AfterRecall,
     stationed2, f1AfterFleet2Station, f2AfterStation };
 });
 ok('stationing from fleet 1 leaves ITS OWN capacity unchanged (power just moves onboard->hangar, same fleet)',
   hangarAttr.stationed1 && hangarAttr.f1Before===hangarAttr.f1AfterStation, hangarAttr);
 ok("...and never touches fleet 2's own capacity", hangarAttr.f2Before0===hangarAttr.f2AfterFleet1Station, hangarAttr);
 ok('recalling returns capacity accounting to exactly where it started',
   hangarAttr.recalled1 && hangarAttr.f1Before===hangarAttr.f1AfterRecall, hangarAttr);
 ok("re-stationing from fleet 2 attributes the hangar to fleet 2 now, not fleet 1 (fleet 1's cap stays at its recalled value)",
   hangarAttr.stationed2 && hangarAttr.f1AfterRecall===hangarAttr.f1AfterFleet2Station, hangarAttr);
 ok("...and fleet 2's own capacity is unchanged too (same rule: stationing never frees or costs capacity, only relocates it)",
   hangarAttr.f2Before0===hangarAttr.f2AfterStation, hangarAttr);

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
