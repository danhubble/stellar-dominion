const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// thangar2.js — PLAN-defences.md Run 3 (patch600-601): the Hangar module.
//
// A dedicated file rather than extending tdef2.js (which already owns the general
// per-slot module machinery: build/upgrade/rearm/swap, defStrength(), the sheet's
// cards). The Hangar's own surface - fleet stationing (S.han, moving real hulls out
// of S.sh and back), the fleetCap/shipPower() accounting that goes with it, and the
// mini-game's own Minefield-detonation/Hangar-ship-fire visuals - is a big enough,
// distinct enough chunk of new state and behaviour to earn its own file, following
// tdef2.js's own window.__SD-as-G, adopt({...}) staging style.
//
// tdef2.js's own "dmodBuild() refuses the Hangar (DEFINITION ONLY)" assertion and
// tsheet2.js's own "#sysSheet direct children" DOM-order assertion both needed a
// small, explained update for patch600 - see HANDOVER, not this file.
const { chromium } = require('playwright-core');
const URL=GAME_URL;

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // shared staging: level 20, a big bank, Koru (exotic) and Draskhold (ore-only)
 // both claimed, a real fleet to station from.
 async function stage(extra){
   await p.evaluate((extra)=>{
     const G=window.__SD;
     G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, cry:1e9,
       exo:{ir:1e9,he:1e9,xe:1e9,am:1e9}, sh:[20,10,4], ...extra});
     G.claimSystem(G.SYSMAP.kor);
     G.claimSystem(G.SYSMAP.dra);
   }, extra||{});
 }
 function finishBuild(sysId,slot){
   return p.evaluate(({sysId,slot})=>{
     const G=window.__SD;
     G.S.def[sysId].s[slot].q.dueAt=Date.now()-1; G.dmodComplete();
   }, {sysId,slot});
 }
 async function buildHangar(sysId,slot){
   await p.evaluate(({sysId,slot})=>{ window.__SD.dmodBuild(window.__SD.SYSMAP[sysId],slot,'han'); }, {sysId,slot});
   await finishBuild(sysId,slot);
 }

 // ---------------- dmodBuild() now allows the Hangar (patch600 flips it on) ----------------
 await stage({});
 const buildable=await p.evaluate(()=>{
   const G=window.__SD;
   const before=G.exo('ir');
   const built=G.dmodBuild(G.SYSMAP.kor,0,'han');
   return { built, spent:before-G.exo('ir'), lv:G.dmodLv('kor','han'), disabled:!!(G.DEF_MODULES.han&&G.DEF_MODULES.han.disabled) };
 });
 ok('dmodBuild() now builds a Hangar (Run 3 flips DEF_MODULES.han.disabled off)', buildable.built&&buildable.spent>0&&!buildable.disabled, buildable);
 await finishBuild('kor',0);
 const afterBuild=await p.evaluate(()=>window.__SD.dmodLv('kor','han'));
 ok('the Hangar is armed at level 1 once its build completes', afterBuild===1, afterBuild);

 // ---------------- stationing takes capacity, recalling returns it ----------------
 const stationed=await p.evaluate(()=>{
   const G=window.__SD;
   const before={ sh:[...G.S.fl[0].sh], capLeft:G.capLeft(), shipPower:G.shipPower() };
   const did=G.stationHan('kor',0,5);
   const after={ sh:[...G.S.fl[0].sh], capLeft:G.capLeft(), shipPower:G.shipPower(), han:G.hanFleet('kor').slice() };
   return { did, before, after };
 });
 ok('stationHan() moves hulls OUT of S.sh into S.han', stationed.did&&stationed.after.sh[0]===stationed.before.sh[0]-5&&stationed.after.han[0]===5, stationed);
 ok('shipPower()/capLeft() see stationed hulls as still spent - stationing frees no capacity', stationed.after.shipPower===stationed.before.shipPower&&stationed.after.capLeft===stationed.before.capLeft, stationed);

 const recalled=await p.evaluate(()=>{
   const G=window.__SD;
   const before={ sh:[...G.S.fl[0].sh], han:G.hanFleet('kor').slice() };
   const did=G.recallHan('kor',0,2);
   const after={ sh:[...G.S.fl[0].sh], han:G.hanFleet('kor').slice() };
   return { did, before, after };
 });
 ok('recallHan() moves hulls back OUT of S.han into S.sh', recalled.did&&recalled.after.sh[0]===recalled.before.sh[0]+2&&recalled.after.han[0]===recalled.before.han[0]-2, recalled);

 const recallAll=await p.evaluate(()=>{
   const G=window.__SD;
   G.stationHan('kor',1,3);
   const before=[...G.S.fl[0].sh];
   const did=G.recallHanAll('kor');
   return { did, after:[...G.S.fl[0].sh], before, han:G.hanFleet('kor').slice(), count:G.hanCount('kor') };
 });
 ok('recallHanAll() empties every hull class at once', recallAll.did&&recallAll.count===0&&recallAll.han.every(x=>x===0), recallAll);

 // ---------------- cannot station more than owned, or more than HAN_CAP ----------------
 const overOwned=await p.evaluate(()=>{
   const G=window.__SD;
   const owned=G.S.fl[0].sh[2];   // Dreadnoughts: 4 in fleet (stage()'s own sh:[20,10,4])
   const did=G.stationHan('kor',2,999);
   return { owned, did, stationed:G.hanFleet('kor')[2], shLeft:G.S.fl[0].sh[2] };
 });
 ok('stationHan() clamps to what you actually own, never fabricates hulls', overOwned.did&&overOwned.stationed===overOwned.owned&&overOwned.shLeft===0, overOwned);

 const overCap=await p.evaluate(()=>{
   const G=window.__SD;
   G.recallHanAll('kor');
   const did1=G.stationHan('kor',0,G.HAN_CAP);          // fills it exactly
   const usedAtCap=G.hanCount('kor');
   const did2=G.stationHan('kor',1,3);                  // nothing left to give
   return { did1, usedAtCap, HAN_CAP:G.HAN_CAP, did2, usedAfter:G.hanCount('kor'), left:G.hanLeft('kor') };
 });
 ok('a Hangar never holds more than HAN_CAP, whatever the mix of hull classes', overCap.usedAtCap===overCap.HAN_CAP&&overCap.left===0, overCap);
 ok('stationHan() refuses once the Hangar is full (a real fleet with room elsewhere is not silently topped up)', !overCap.did2&&overCap.usedAfter===overCap.HAN_CAP, overCap);

 // stationing refuses without a built+armed Hangar, and off the fleet the player owns
 const guardrails=await p.evaluate(()=>{
   const G=window.__SD;
   const noHangar=G.stationHan('dra',0,1);                // Draskhold never got one
   const badHull=G.stationHan('kor',9,1);                  // no such hull class
   const zero=G.stationHan('kor',0,0);
   return { noHangar, badHull, zero };
 });
 ok('stationHan() refuses a system with no built Hangar', !guardrails.noHangar, guardrails);
 ok('stationHan() refuses an unknown hull index and a zero/negative count', !guardrails.badHull&&!guardrails.zero, guardrails);

 // ---------------- stationed ships raise defStrength() and therefore holdOdds() ----------------
 const oddsLift=await p.evaluate(()=>{
   const G=window.__SD;
   G.recallHanAll('kor');
   const th={rv:'hel',dif:1,sysId:'kor'};
   const bare=G.defStrength('kor'), oddsBare=G.holdOdds(th);
   G.stationHan('kor',2,4);   // every Dreadnought the fleet owns
   const stationed=G.defStrength('kor'), oddsStationed=G.holdOdds(th);
   return { bare, stationed, oddsBare, oddsStationed, hanStrength:G.hanStrength('kor') };
 });
 ok('a built, empty Hangar contributes nothing extra to defStrength()', oddsLift.hanStrength>=0, oddsLift);
 ok('stationing real fleet raises defStrength()', oddsLift.stationed>oddsLift.bare, oddsLift);
 ok('...and therefore raises holdOdds() - the same function the fight resolves against', oddsLift.oddsStationed>oddsLift.oddsBare, oddsLift);
 const byHand=await p.evaluate(()=>{
   const G=window.__SD;
   const th={rv:'hel',dif:1,sysId:'kor'};
   return { computed:G.holdOdds(th), byHand:G.holdOdds(th, G.defStrength('kor')) };
 });
 ok('defStrength(\'kor\') (Hangar included) matches what holdOdds() itself sums', byHand.computed===byHand.byHand, byHand);

 // ---------------- save/reload round trip ----------------
 const roundTrip=await p.evaluate(async()=>{
   const G=window.__SD;
   const before=G.hanFleet('kor').slice();
   G.save();
   await G.load();
   return { before, after:G.hanFleet('kor').slice() };
 });
 ok('S.han survives a save/load round-trip untouched', JSON.stringify(roundTrip.before)===JSON.stringify(roundTrip.after), roundTrip);

 // ---------------- adopt() sanitiser: impossible values ----------------
 const sanitised=await p.evaluate(()=>{
   const G=window.__SD;
   const shBefore=[5,5,5];
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, sh:shBefore.slice(),
     sys:{ home:{b:{}}, kor:{b:{}} },
     def:{ kor:{ s:[ {m:'han',lv:1,armed:true,q:null}, null, null ] } },
     han:{
       kor:[3,-7,2.9],           // negative clamps to 0, fraction floors
       dra:[1,0,0],              // Draskhold never got a Hangar - folded back
       ghost:[1,1,1]             // unknown system - folded back
     }
   });
   return { kor:G.S.han.kor, hasDra:'dra' in G.S.han, hasGhost:'ghost' in G.S.han, sh:G.S.fl[0].sh.slice() };
 });
 ok('adopt() clamps negative/fractional stationed counts', sanitised.kor[0]===3&&sanitised.kor[1]===0&&sanitised.kor[2]===2, sanitised);
 // both the "dra" (no Hangar) and "ghost" (unknown system) entries refund into
 // S.sh in the SAME adopt() call, so check the combined effect rather than
 // attributing sh[0] to only one of them: dra refunds [1,0,0], ghost [1,1,1].
 ok('adopt() drops an entry naming a system with no built Hangar, and an entry naming a system that does not exist',
   !sanitised.hasDra&&!sanitised.hasGhost, sanitised);
 ok('...folding both entries\' counts back into S.sh rather than destroying them',
   sanitised.sh[0]===5+1+1&&sanitised.sh[1]===5+0+1&&sanitised.sh[2]===5+0+1, sanitised);

 const overCapSave=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, sh:[0,0,0],
     sys:{ home:{b:{}}, kor:{b:{}} },
     def:{ kor:{ s:[ {m:'han',lv:1,armed:true,q:null}, null, null ] } },
     han:{ kor:[20,20,20] }
   });
   return { kor:G.S.han.kor, total:G.hanCount('kor'), HAN_CAP:G.HAN_CAP, sh:G.S.fl[0].sh.slice() };
 });
 ok('adopt() clamps a save claiming more than HAN_CAP stationed, refunding the surplus to S.sh',
   overCapSave.total===overCapSave.HAN_CAP && (overCapSave.sh[0]+overCapSave.sh[1]+overCapSave.sh[2])===60-overCapSave.HAN_CAP,
   overCapSave);

 const unheldDrop=await p.evaluate(()=>{
   const G=window.__SD;
   // Koru built+armed, then genuinely lost to occupation before the reload - a save
   // claiming stationed ships there afterward is exactly the "no longer held" case.
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[2,2,2]});
   G.claimSystem(G.SYSMAP.kor);
   G.dmodBuild(G.SYSMAP.kor,0,'han'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   const saved=JSON.parse(JSON.stringify(G.S));
   saved.han={ kor:[4,0,0] };
   saved.occ={ kor:'hel' }; saved.occAt={ kor:Date.now() };   // now occupied, not held
   G.adopt(saved);
   return { hasKor:'kor' in G.S.han, sh0:G.S.fl[0].sh[0] };
 });
 ok('adopt() drops (and refunds) a stationed entry for a system that is no longer held', !unheldDrop.hasKor&&unheldDrop.sh0===2+4, unheldDrop);

 // ---------------- occupation: recalls the whole garrison, kindly, immediately ----------------
 const occupied=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[6,0,0]});
   G.claimSystem(G.SYSMAP.kor);
   G.dmodBuild(G.SYSMAP.kor,0,'han'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   G.stationHan('kor',0,5);
   const before={ sh:G.S.fl[0].sh[0], han:G.hanFleet('kor')[0] };
   const took=G.occupySystem('kor','hel');
   const after={ sh:G.S.fl[0].sh[0], han:G.hanFleet('kor')[0], hasEntry:!!(G.S.han&&G.S.han.kor) };
   return { took, before, after };
 });
 ok('occupySystem() recalls every stationed hull immediately (the kinder reading - see HANDOVER)',
   occupied.took&&occupied.after.sh===occupied.before.sh+occupied.before.han&&occupied.after.han===0, occupied);

 // dmodSwap() removing the Hangar module itself also recalls everything
 const swapped=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[6,0,0]});
   G.claimSystem(G.SYSMAP.kor);
   G.dmodBuild(G.SYSMAP.kor,0,'han'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   G.stationHan('kor',0,4);
   const before={ sh:G.S.fl[0].sh[0], han:G.hanFleet('kor')[0] };
   const did=G.dmodSwap(G.SYSMAP.kor,0);
   const after={ sh:G.S.fl[0].sh[0], han:G.hanFleet('kor')[0] };
   return { did, before, after };
 });
 ok('dmodSwap() removing a Hangar slot recalls its stationed ships first', swapped.did&&swapped.after.sh===swapped.before.sh+swapped.before.han&&swapped.after.han===0, swapped);

 // ---------------- mini-game: Minefield does its damage ----------------
 const mineFight=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[10,0,0]});
   G.claimSystem(G.SYSMAP.kor);
   G.dmodBuild(G.SYSMAP.kor,0,'min'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   G.S.thq=[{id:1,rv:'hel',sysId:'kor',dif:1,t:3600,life:G.THQ_LIFE}];
   G.startDefence(1);
   const mines=G.DT.mines;
   let steps=0, firedAt=-1, hpBefore=null, killsBefore=0;
   for(;steps<600;steps++){
     if(G.DT.en.length && hpBefore===null){ hpBefore=G.DT.en[0].hp; killsBefore=G.DT.kills; }
     G.defUpdate(0.033);
     if(G.DT.mineFired && firedAt<0)firedAt=steps;
     if(firedAt>=0)break;
     if(G.DT.done)break;
   }
   return { mines, fired:G.DT.mineFired, kills:G.DT.kills, killsBefore, hpBefore, done:G.DT.done, hadFlash:!!G.DT.mineFlash };
 });
 ok('an armed Minefield is read into DT.mines when the fight opens', mineFight.mines===true, mineFight);
 ok('it detonates against the first wave and actually damages/kills hostiles (real damage, not a flag)',
   mineFight.fired&&mineFight.kills>mineFight.killsBefore, mineFight);
 ok('the detonation sets a fading flash for defDraw() to show', mineFight.hadFlash, mineFight);

 const noMineFight=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[10,0,0]});
   G.claimSystem(G.SYSMAP.kor);
   G.S.thq=[{id:2,rv:'hel',sysId:'kor',dif:1,t:3600,life:G.THQ_LIFE}];
   G.startDefence(2);
   return { mines:G.DT.mines };
 });
 ok('without a Minefield fitted, DT.mines is false and nothing detonates', noMineFight.mines===false, noMineFight);

 // ---------------- mini-game: stationed Hangar ships fight ----------------
 const hangarFight=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[10,0,0]});
   G.claimSystem(G.SYSMAP.kor);
   G.dmodBuild(G.SYSMAP.kor,0,'han'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   G.stationHan('kor',0,4);
   G.S.thq=[{id:3,rv:'hel',sysId:'kor',dif:1,t:3600,life:G.THQ_LIFE}];
   G.startDefence(3);
   const hangarAtOpen=G.DT.hangar.length;
   const shotsBefore=G.DT.sh.length;
   let steps=0;
   for(;steps<300 && G.DT.sh.length<=shotsBefore;steps++)G.defUpdate(0.05);
   const anyAuto=G.DT.sh.some(s=>s.auto);
   return { hangarAtOpen, shotsBefore, shotsAfter:G.DT.sh.length, anyAuto, positions:[0,1].map(i=>G.defHangarXY(i,4)) };
 });
 ok('stationed Hangar ships populate DT.hangar with one entry per stationed hull', hangarFight.hangarAtOpen===4, hangarFight);
 ok('they fire on their own (auto shots appear without any player input)', hangarFight.shotsAfter>hangarFight.shotsBefore&&hangarFight.anyAuto, hangarFight);
 ok('each fires from its own drawn position, not dead centre', hangarFight.positions[0].x!==hangarFight.positions[1].x||hangarFight.positions[0].y!==hangarFight.positions[1].y, hangarFight);

 const noHangarFight=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[10,0,0]});
   G.claimSystem(G.SYSMAP.kor);
   G.S.thq=[{id:4,rv:'hel',sysId:'kor',dif:1,t:3600,life:G.THQ_LIFE}];
   G.startDefence(4);
   return { hangar:G.DT.hangar.length };
 });
 ok('with nothing stationed, DT.hangar is empty', noHangarFight.hangar===0, noHangarFight);

 // ---------------- Shield Array's hullMul: verified, not changed (patch601 note) ----------------
 const shieldVerify=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9}, sh:[0,0,0]});
   G.claimSystem(G.SYSMAP.kor);
   G.S.thq=[{id:5,rv:'hel',sysId:'kor',dif:1,t:3600,life:G.THQ_LIFE}];
   G.startDefence(5);
   const mulBare=G.DT.hullMul;
   G.closeDefence();
   G.dmodBuild(G.SYSMAP.kor,0,'shd'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   G.S.thq=[{id:6,rv:'hel',sysId:'kor',dif:1,t:3600,life:G.THQ_LIFE}];
   G.startDefence(6);
   return { mulBare, mulShielded:G.DT.hullMul, shdLv:G.dmodLv('kor','shd') };
 });
 ok('Shield Array raises DT.hullMul when the fight opens (verified, unchanged since patch597)',
   shieldVerify.shdLv===1&&shieldVerify.mulShielded>shieldVerify.mulBare, shieldVerify);

 // ---------------- pinned footer present in the under-attack state ----------------
 // patch626 (PLAN-page.md): #sysThreatActs went from position:sticky (relative to
 // the old #sysSheet, which used to scroll itself) to position:fixed (relative to
 // the viewport - #sysSheet is in-flow now, #view is what scrolls). Flagged in
 // patch626's own HANDOVER entry as needing this fix, not named by the coordinator
 // but in the same bucket as the other sheet/handle updates.
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30});
   G.claimSystem(G.SYSMAP.kor);
   G.S.thq=[{id:7,rv:'hel',sysId:'kor',dif:1,t:3600,life:G.THQ_LIFE}];
   const t=document.querySelector('.tab[data-p="p-map"]'); if(t)t.click();
 });
 await p.waitForTimeout(150);
 await p.evaluate(()=>{ const G=window.__SD; G.S.msel='kor'; dirty=true; render(); });
 await p.waitForTimeout(150);
 const footer=await p.evaluate(()=>{
   const el=document.getElementById('sysThreatActs');
   const cs=el?getComputedStyle(el):null;
   return { present:!!el, hidden:el&&el.hidden, position:cs&&cs.position, hasGo:!!document.getElementById('sshThrGo'), hasHold:!!document.getElementById('sshThrHold') };
 });
 ok('the under-attack action row exists, is shown, and is a fixed (pinned) footer', footer.present&&!footer.hidden&&footer.position==='fixed', footer);
 ok('DEFEND IT / LET THEM HOLD are both present in it', footer.hasGo&&footer.hasHold, footer);

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
