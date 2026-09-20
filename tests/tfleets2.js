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

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
