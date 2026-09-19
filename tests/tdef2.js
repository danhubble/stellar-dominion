const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tdef2.js — PLAN-defences.md Run 2 (patches 597-599): the new S.def module-slot
// system, replacing the old single S.sd/S.sdq defence level.
//
// Coverage this file owns (per the plan's own test list): slot state and save
// round-trip; adopt() dropping S.sd/S.sdq with no conversion/refund; costs and the
// one-queued-build-per-system rule; the Minefield consumed on all three resolution
// paths (endDefence player-flown, holdResolve delegated/offline, lfOccupy live-fleet)
// and NOT restored by a reload; defStrength() per module and combined; "the number
// shown = the number used" (defCardPct()/renderSysOdds() vs holdOdds()); Sensor
// Mast's longer telegraph and its information gated on being fitted; the swap refund;
// and no button churn on the new #sysDefRow cards.
//
// ttravel2.js/tchurn2.js/tsabotage2.js/tmap2.js/tsheet2.js already got the sd*->dmod*
// re-point patch598/599 required of THEM (see HANDOVER); this file is the dedicated
// new coverage, following the same window.__SD-as-G, adopt({...}) staging style.
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

 // shared staging: a big enough bank of everything, level 20 (clears every ring1
 // level gate), Koru (pays iridium) and Draskhold (ore-only, res:null) both claimed
 // so both cost paths (dmodCost/dmodCostOre) are reachable in one save.
 async function stage(extra){
   await p.evaluate((extra)=>{
     const G=window.__SD;
     G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, cry:1e9,
       exo:{ir:1e9,he:1e9,xe:1e9,am:1e9}, ...extra});
     G.claimSystem(G.SYSMAP.kor);
     G.claimSystem(G.SYSMAP.dra);
   }, extra||{});
 }

 // ---------------- fresh()/adopt(): S.sd/S.sdq are gone, S.def defaults empty ----------------
 const freshDef=await p.evaluate(()=>{ const G=window.__SD; const f=G.fresh(); return { def:f.def, hasSd:'sd' in f, hasSdq:'sdq' in f }; });
 ok('fresh() carries an empty S.def and no S.sd/S.sdq', freshDef.def&&typeof freshDef.def==='object'&&Object.keys(freshDef.def).length===0&&!freshDef.hasSd&&!freshDef.hasSdq, freshDef);

 const oldSave=await p.evaluate(()=>{
   const G=window.__SD;
   const oreBefore=1e6;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, ore:oreBefore, sd:{kor:6}, sdq:{kor:{lv:7,dueAt:Date.now()+9999}}});
   return { hasSd:'sd' in G.S, hasSdq:'sdq' in G.S, ore:G.S.ore, oreBefore, defEmpty:Object.keys(G.S.def||{}).length===0 };
 });
 ok('adopt() drops an old save\'s S.sd/S.sdq entirely, with no conversion or refund',
   !oldSave.hasSd && !oldSave.hasSdq && oldSave.ore===oldSave.oreBefore && oldSave.defEmpty, oldSave);

 // ---------------- adopt(): S.def sanitiser ----------------
 const sanitised=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20,
     def:{
       kor:{ s:[ {m:'tur',lv:2,armed:true,q:null}, {m:'nope',lv:1,armed:true,q:null}, {m:'shd',lv:9,armed:true,q:{to:99,dueAt:1}} ] },
       ghost:{ s:[ {m:'tur',lv:1,armed:true,q:null}, null, null ] },      // unknown system id
       home:{ s:[ {m:'tur',lv:1,armed:true,q:null}, null, null ] }        // home never gets slots
     }
   });
   return JSON.parse(JSON.stringify(G.S.def));
 });
 ok('adopt() drops a slot naming an unknown module id', sanitised.kor.s[1]===null, sanitised);
 ok('adopt() clamps a level above the module\'s own maxLv, and drops a bogus queue target', sanitised.kor.s[2].lv===3&&sanitised.kor.s[2].q===null, sanitised);
 ok('adopt() drops an entire entry naming a system that does not exist', !('ghost' in sanitised), sanitised);
 ok('adopt() drops an entry naming home (home never carries slots)', !('home' in sanitised), sanitised);

 const badQueue=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20,
     def:{ kor:{ s:[ {m:'tur',lv:1,armed:true,q:{to:3,dueAt:Date.now()+1000}}, {m:'tur',lv:1,armed:true,q:{to:1,dueAt:Date.now()+1000}}, null ] } }
   });
   return JSON.parse(JSON.stringify(G.S.def.kor.s));
 });
 ok('adopt() drops a queued build whose target is not exactly one level above current', badQueue[0].q===null&&badQueue[0].lv===1, badQueue);
 ok('adopt() keeps a rearm queue (target level equals the current level)', badQueue[1].q&&badQueue[1].q.to===1, badQueue);

 // ---------------- costs, build queue, one-queued-build-per-system ----------------
 await stage();
 const costs=await p.evaluate(()=>{
   const G=window.__SD;
   return {
     kor:G.dmodPrice(G.SYSMAP.kor,0), korExpect:G.dmodCost(0),
     dra:G.dmodPrice(G.SYSMAP.dra,0), draExpect:G.dmodCostOre(G.SYSMAP.dra,0)
   };
 });
 ok('dmodPrice() charges an exotic system (Koru) in its own exotic, via dmodCost()', costs.kor===costs.korExpect, costs);
 ok('dmodPrice() charges an ore-only system (Draskhold) in ore, via dmodCostOre()', costs.dra===costs.draExpect, costs);

 const build=await p.evaluate(()=>{
   const G=window.__SD;
   const before={ ir:G.exo('ir'), ore:G.S.ore };
   const price=G.dmodPrice(G.SYSMAP.kor,0);
   const built=G.dmodBuild(G.SYSMAP.kor,0,'tur');
   const secondSlotBlocked = !G.dmodBuild(G.SYSMAP.kor,1,'shd');    // busy: one queued build per system
   const badModule = !G.dmodBuild(G.SYSMAP.dra,0,'nope');
   // Run 3 (patch600) flips DEF_MODULES.han.disabled off - a Hangar is buildable
   // like any other module now (dra's own slot 0 is free: the 'nope' attempt just
   // above never queued anything). Was "dmodBuild() refuses the Hangar (Run 3
   // stationing not wired up yet - DEFINITION ONLY)" through patch599; see
   // thangar2.js for the rest of the Hangar's own coverage (stationing, capacity,
   // defStrength, save round-trip, occupation, the mini-game).
   const hangarBuilt = G.dmodBuild(G.SYSMAP.dra,0,'han');
   const after={ ir:G.exo('ir') };
   return { built, secondSlotBlocked, badModule, hangarBuilt, spent:before.ir-after.ir, price, slot:JSON.parse(JSON.stringify(G.S.def.kor.s[0])) };
 });
 ok('dmodBuild() queues the module and deducts the price immediately', build.built&&build.spent===build.price, build);
 ok('a system with any slot mid-build blocks a second build (one queue per system)', build.secondSlotBlocked, build);
 ok('dmodBuild() refuses an unknown module id', build.badModule, build);
 ok('dmodBuild() now allows the Hangar (patch600 flips DEF_MODULES.han.disabled off)', build.hangarBuilt, build);
 ok('the slot is queued at level 0 -> 1, not yet armed', build.slot.lv===0&&build.slot.armed===false&&build.slot.q&&build.slot.q.to===1, build);

 const complete=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.def.kor.s[0].q.dueAt=Date.now()-1;
   G.dmodComplete();
   const slot=JSON.parse(JSON.stringify(G.S.def.kor.s[0]));
   const nowFree=G.dmodBuild(G.SYSMAP.kor,1,'shd');    // the busy guard lifts once the build lands
   return { slot, nowFree };
 });
 ok('dmodComplete() promotes a due build to armed, at its target level', complete.slot.lv===1&&complete.slot.armed===true&&complete.slot.q===null, complete);
 ok('the system is free to queue again once nothing is mid-build', complete.nowFree, complete);

 const upgrade=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.def.kor.s[1].q.dueAt=Date.now()-1; G.dmodComplete();     // finish the shd build queued above
   const before=G.exo('ir');
   const price=G.dmodPrice(G.SYSMAP.kor,1);
   const up=G.dmodUpgrade(G.SYSMAP.kor,0);
   const spent=before-G.exo('ir');
   return { up, price, spent, slot:JSON.parse(JSON.stringify(G.S.def.kor.s[0])) };
 });
 ok('dmodUpgrade() prices off the slot\'s current level and deducts it', upgrade.up&&upgrade.spent===upgrade.price, upgrade);
 ok('dmodUpgrade() queues to exactly one level above current', upgrade.slot.q&&upgrade.slot.q.to===2, upgrade);

 // ---------------- rearm (one-use module) ----------------
 const rearm=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();     // tur -> level 2
   // build a Minefield into the empty third slot
   G.dmodBuild(G.SYSMAP.kor,2,'min'); G.S.def.kor.s[2].q.dueAt=Date.now()-1; G.dmodComplete();
   const armedAfterBuild=G.S.def.kor.s[2].armed;
   G.dmodConsumeMines('kor');                                    // spend it, as a real resolution would
   const spentAfterUse=G.S.def.kor.s[2].armed;
   const before=G.exo('ir');
   const price=G.dmodPrice(G.SYSMAP.kor, G.S.def.kor.s[2].lv);
   const rearmed=G.dmodRearm(G.SYSMAP.kor,2);
   const spent=before-G.exo('ir');
   G.S.def.kor.s[2].q.dueAt=Date.now()-1; G.dmodComplete();
   return { armedAfterBuild, spentAfterUse, rearmed, price, spent, lvUnchanged:G.S.def.kor.s[2].lv, armedAfterRearm:G.S.def.kor.s[2].armed };
 });
 ok('a freshly built Minefield arms itself on completion', rearm.armedAfterBuild===true, rearm);
 ok('dmodConsumeMines() spends it (armed -> false)', rearm.spentAfterUse===false, rearm);
 ok('dmodRearm() charges the same flat price every time (lv never advances for a one-use module)', rearm.rearmed&&rearm.spent===rearm.price&&rearm.lvUnchanged===1, rearm);
 ok('a rearmed Minefield is armed again after its queue completes', rearm.armedAfterRearm===true, rearm);

 // ---------------- swap: refunds half, empties the slot ----------------
 const swap=await p.evaluate(()=>{
   const G=window.__SD;
   const s=G.SYSMAP.kor;
   let spent=0; for(let L=0;L<2;L++)spent+=G.dmodPrice(s,L);      // slot 0 (tur) is level 2
   const before=G.exo('ir');
   const swapped=G.dmodSwap(s,0);
   const after=G.exo('ir');
   return { swapped, spent, refund:after-before, expectRefund:Math.floor(spent*0.5), slot:G.S.def.kor.s[0] };
 });
 ok('dmodSwap() refunds exactly half of what was spent building this slot up to its level', swap.swapped&&swap.refund===swap.expectRefund&&swap.refund>0, swap);
 ok('dmodSwap() empties the slot', swap.slot===null, swap);

 // ---------------- defStrength(): per module and combined ----------------
 await stage({ rs:{bat:2} });
 const strength=await p.evaluate(()=>{
   const G=window.__SD;
   const s=G.SYSMAP.kor;
   function finish(i,m){ G.dmodBuild(s,i,m); G.S.def.kor.s[i].q.dueAt=Date.now()-1; G.dmodComplete(); }
   const batOnly=G.defStrength('kor');
   finish(0,'tur');
   const withTur=G.defStrength('kor');
   G.dmodUpgrade(s,0); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();   // tur -> lv2
   const withTur2=G.defStrength('kor');
   finish(1,'shd');
   const withShd=G.defStrength('kor');
   finish(2,'min');
   const withMineArmed=G.defStrength('kor');
   G.dmodConsumeMines('kor');
   const withMineSpent=G.defStrength('kor');
   return { batOnly, withTur, withTur2, withShd, withMineArmed, withMineSpent, bat:G.S.rs.bat };
 });
 const batTerm=strength.bat*0.42;
 ok('defStrength() with nothing fitted is just the research (bat) term', Math.abs(strength.batOnly-batTerm)<1e-9, strength);
 ok('a level-1 Turret Ring adds its DEF_STR (0.6)', Math.abs(strength.withTur-(batTerm+0.6))<1e-9, strength);
 ok('a level-2 Turret Ring adds 2x its DEF_STR, not a flat per-module amount', Math.abs(strength.withTur2-(batTerm+1.2))<1e-9, strength);
 ok('a Shield Array adds its own DEF_STR on top', Math.abs(strength.withShd-(batTerm+1.2+0.4))<1e-9, strength);
 ok('an armed Minefield adds its DEF_STR while armed', Math.abs(strength.withMineArmed-(batTerm+1.2+0.4+0.9))<1e-9, strength);
 ok('a spent Minefield contributes nothing', Math.abs(strength.withMineSpent-(batTerm+1.2+0.4))<1e-9, strength);

 // ---------------- odds shown = odds used ----------------
 const odds=await p.evaluate(()=>{
   const G=window.__SD;
   const s=G.SYSMAP.kor;
   const th=G.thqAtSys('kor')||{rv:'hel',dif:1,sysId:'kor'};
   const used=G.holdOdds(th);
   const cardTur=G.defCardPct(s,0);        // Turret Ring's own marginal contribution
   const byHand=Math.round(used*100)-Math.round(G.holdOdds(th,G.defStrength('kor',0))*100);
   return { used, cardTur, byHand };
 });
 ok('defCardPct() (the number on the card) is derived from the exact same holdOdds() the resolution uses',
   odds.cardTur===odds.byHand, odds);

 await p.evaluate(()=>{ const G=window.__SD; G.S.msel='kor'; gotoTab('p-map'); dirty=true; render(); });
 await p.waitForTimeout(200);
 const oddsDom=await p.evaluate(()=>{
   const G=window.__SD;
   const th=G.thqAtSys('kor')||{rv:'hel',dif:1,sysId:'kor'};
   const shown=document.querySelector('#sysOdds b');
   return { text:shown?shown.textContent:null, expect:Math.round(G.holdOdds(th)*100)+'%' };
 });
 ok('the "Garrison holds n%" text on the sheet matches holdOdds() exactly', oddsDom.text===oddsDom.expect, oddsDom);

 // ---------------- Sensor Mast ----------------
 await stage();
 const sen=await p.evaluate(()=>{
   const G=window.__SD;
   const s=G.SYSMAP.kor;
   const before=G.hasSensorMast('kor');
   G.dmodBuild(s,2,'sen'); G.S.def.kor.s[2].q.dueAt=Date.now()-1; G.dmodComplete();
   const after=G.hasSensorMast('kor');
   return { before, after };
 });
 ok('hasSensorMast() is false with nothing fitted and true once one completes', !sen.before&&sen.after, sen);

 const life=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9},
     sys:{ home:{b:{}}, kor:{b:{}} },
     rv:{ hel:{p:G.RV_MAX,cd:0,seen:1,w:100,mv:G.RIVAL_MOVE_CAP}, cov:{p:0,cd:9e9,seen:1,w:0,mv:G.RIVAL_MOVE_CAP} } });
   const s=G.SYSMAP.kor;
   const orig=Math.random; Math.random=()=>0;
   G.rvMaybeThreat();
   Math.random=orig;
   const withoutMast=G.thq()[0]&&G.thq()[0].life;
   // fit the Sensor Mast AFTER this threat exists - must NOT retroactively change it
   G.dmodBuild(s,0,'sen'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   const stillOld=G.thq()[0]&&G.thq()[0].life;
   G.thqDrop(G.thq()[0].id);
   // rvMaybeThreat() just fired (S.thrCd, the rival's own cd/p) - clear those so the
   // very next call can fire again immediately, same as re-adopting a ready rival.
   S.thrCd=0; G.rvOf('hel').cd=0; G.rvOf('hel').p=G.RV_MAX; G.rvOf('hel').w=100;
   Math.random=()=>0; G.rvMaybeThreat(); Math.random=orig;      // a fresh threat, mast now fitted
   const withMast=G.thq()[0]&&G.thq()[0].life;
   return { withoutMast, stillOld, withMast, THQ_LIFE:G.THQ_LIFE };
 });
 ok('a threat created without a Sensor Mast gets the ordinary THQ_LIFE', life.withoutMast===life.THQ_LIFE, life);
 ok('life is stamped at creation, not retroactive - fitting the mast afterward does not extend an existing threat', life.stillOld===life.THQ_LIFE, life);
 ok('a threat created with a Sensor Mast already fitted gets 1.5x THQ_LIFE', life.withMast===Math.round(life.THQ_LIFE*1.5), life);

 const lifeReload=await p.evaluate(()=>{
   const G=window.__SD;
   const saved=JSON.parse(JSON.stringify(G.S));
   G.adopt(saved);
   return G.thq()[0]&&G.thq()[0].life;
 });
 ok('the extended life survives a save/load round-trip', lifeReload===Math.round(life.THQ_LIFE*1.5), lifeReload);

 // information gated on the mast: the sheet's doctrine line + "rises to n%" preview.
 // defBestPreview() only has something to suggest when another slot is actually
 // upgradeable/rearmable - fit a Turret Ring (still well under its max level) so
 // there is a real move for the preview to describe.
 await p.evaluate(()=>{
   const G=window.__SD; const s=G.SYSMAP.kor;
   G.dmodBuild(s,1,'tur'); G.S.def.kor.s[1].q.dueAt=Date.now()-1; G.dmodComplete();
   G.S.msel='kor'; dirty=true; render();
 });
 await p.waitForTimeout(200);
 const withMastDom=await p.evaluate(()=>({ html:document.getElementById('sysThreat').innerHTML }));
 ok('with a Sensor Mast fitted, the sheet names the attacker\'s doctrine under attack', /doctrine/i.test(withMastDom.html), withMastDom);
 ok('with a Sensor Mast fitted, the sheet shows a "rises to n%" rearm/upgrade preview', /rises to \d+%|lifts you to \d+%/i.test(withMastDom.html), withMastDom);

 const noMastDom=await p.evaluate(()=>{
   const G=window.__SD;
   G.dmodSwap(G.SYSMAP.kor,0);      // remove the Sensor Mast
   G.S.msel='kor'; dirty=true; render();
   return { html:document.getElementById('sysThreat').innerHTML, has:G.hasSensorMast('kor') };
 });
 ok('without a Sensor Mast, none of that information appears', !noMastDom.has&&!/doctrine|rises to|lifts you/i.test(noMastDom.html), noMastDom);

 // ---------------- minefield consumed on all three resolution paths, not restored by reload ----------------
 // path 1: player-flown (endDefence)
 const path1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9},
     sys:{ home:{b:{}}, kor:{b:{}} },
     def:{ kor:{ s:[ {m:'min',lv:1,armed:true,q:null}, null, null ] } } });
   G.thq().push({id:501, rv:'hel', sysId:'kor', dif:1, t:5000, life:G.THQ_LIFE});
   G.startDefence(501);
   const midFight=G.S.def.kor.s[0].armed;      // still armed WHILE the fight is in progress
   G.endDefence('lost');                        // outcome should not matter - consumed either way
   const afterLoss=G.S.def.kor.s[0].armed;
   const saved=JSON.parse(JSON.stringify(G.S));
   G.adopt(saved);
   const afterReload=G.S.def.kor.s[0].armed;
   return { midFight, afterLoss, afterReload };
 });
 ok('a Minefield stays armed while a player-flown fight is in progress', path1.midFight===true, path1);
 ok('endDefence() consumes it once the fight resolves, win or lose', path1.afterLoss===false, path1);
 ok('a reload afterward does not restore it (path 1: player-flown)', path1.afterReload===false, path1);

 // path 2: delegated hold / offline expiry (holdResolve)
 const path2=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9},
     sys:{ home:{b:{}}, kor:{b:{}} },
     def:{ kor:{ s:[ {m:'min',lv:1,armed:true,q:null}, null, null ] } } });
   G.thq().push({id:502, rv:'hel', sysId:'kor', dif:1, t:5000, life:G.THQ_LIFE});
   G.holdLine(502);
   const afterOnline=G.S.def.kor.s[0].armed;
   // rearm, then resolve again as a genuine OFFLINE expiry (holdResolve's own offline=true road)
   G.dmodRearm(G.SYSMAP.kor,0); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   const rearmed=G.S.def.kor.s[0].armed;
   const th={id:503, rv:'hel', sysId:'kor', dif:1};
   G.holdResolve(th, false, true, true);
   const afterOffline=G.S.def.kor.s[0].armed;
   const saved=JSON.parse(JSON.stringify(G.S));
   G.adopt(saved);
   const afterReload=G.S.def.kor.s[0].armed;
   return { afterOnline, rearmed, afterOffline, afterReload };
 });
 ok('holdLine()/holdResolve() (delegated, online) consumes an armed Minefield', path2.afterOnline===false, path2);
 ok('holdResolve() consumes it again on a genuine offline-expiry resolution', path2.rearmed&&path2.afterOffline===false, path2);
 ok('a reload afterward does not restore it (path 2: delegated/offline)', path2.afterReload===false, path2);

 // path 3: the live-fleet offline-occupy road (lfOccupy) - needs >1 held system
 const path3=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9},
     sys:{ home:{b:{}}, kor:{b:{}}, dra:{b:{}} },
     def:{ kor:{ s:[ {m:'min',lv:1,armed:true,q:null}, null, null ] } } });
   const occupied=G.lfOccupy('kor','hel');
   const afterOccupy=G.S.def.kor.s[0].armed;
   const saved=JSON.parse(JSON.stringify(G.S));
   G.adopt(saved);
   const afterReload=G.S.def.kor.s[0].armed;
   return { occupied, afterOccupy, afterReload };
 });
 ok('lfOccupy() (the live-fleet offline-occupy road) consumes an armed Minefield', path3.occupied&&path3.afterOccupy===false, path3);
 ok('a reload afterward does not restore it (path 3: live-fleet offline occupy)', path3.afterReload===false, path3);

 // ---------------- patch631: defence picker is a modal, not an inline expansion ----------------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9,he:1e9,xe:1e9,am:1e9}});
   G.claimSystem(G.SYSMAP.kor);
   G.S.msel='kor'; gotoTab('p-map'); dirty=true; render();
 });
 await p.waitForTimeout(200);

 // tapping an EMPTY slot opens #mask with the module rows, NOT #sysDefDetail inline
 const opened=await p.evaluate(()=>{
   const expectRows=Object.keys(window.__SD.DEF_MODULES).length;
   document.querySelector('#sysDefRow .sc[data-slot="0"][data-empty="1"]').click();
   return {
     maskOn: document.getElementById('mask').classList.contains('on'),
     pkRows: document.querySelectorAll('#defPickRows .pk').length,
     expectRows,
     detailHidden: document.getElementById('sysDefDetail').hidden,
     detailEmpty: document.getElementById('sysDefDetail').innerHTML==='',
     cardSel: document.querySelector('#sysDefRow .sc[data-slot="0"]').classList.contains('sel'),
     defSel: JSON.parse(JSON.stringify(window.__SD.defSel))
   };
 });
 ok('tapping an empty slot opens #mask with one row per DEF_MODULES entry',
    opened.maskOn && opened.pkRows===opened.expectRows && opened.pkRows>0, opened);
 ok('...and #sysDefDetail (the old inline host) stays hidden and empty, not the picker\'s content',
    opened.detailHidden && opened.detailEmpty, opened);
 ok('the empty card underneath shows its .sel highlight while the picker is open (defSel keeps its shape)',
    opened.cardSel && opened.defSel && opened.defSel.slot===0 && opened.defSel.mode==='pick', opened);

 // CANCEL closes it with nothing built and nothing spent
 const irBeforeCancel=await p.evaluate(()=>window.__SD.exo('ir'));
 await p.evaluate(()=>document.getElementById('defPickCancel').click());
 await p.waitForTimeout(50);
 const afterCancel=await p.evaluate(()=>({
   maskOn: document.getElementById('mask').classList.contains('on'),
   slot0: window.__SD.S.def.kor ? window.__SD.S.def.kor.s[0] : null,
   cardSel: document.querySelector('#sysDefRow .sc[data-slot="0"]').classList.contains('sel'),
   ir: window.__SD.exo('ir')
 }));
 ok('CANCEL closes the modal with the slot still empty and nothing spent',
    !afterCancel.maskOn && afterCancel.slot0===null && afterCancel.ir===irBeforeCancel, afterCancel);
 ok('CANCEL also clears defSel, so the card\'s .sel highlight does not linger', !afterCancel.cardSel, afterCancel);

 // picking a module builds it, closes the modal, and spends exactly dmodPrice()
 const irBeforePick=await p.evaluate(()=>window.__SD.exo('ir'));
 await p.evaluate(()=>document.querySelector('#sysDefRow .sc[data-slot="0"][data-empty="1"]').click());
 await p.waitForTimeout(50);
 const expectPrice=await p.evaluate(()=>window.__SD.dmodPrice(window.__SD.SYSMAP.kor,0));
 await p.evaluate(()=>document.querySelector('#defPickRows .pk[data-m="tur"]').click());
 await p.waitForTimeout(50);
 const picked=await p.evaluate(()=>({
   maskOn: document.getElementById('mask').classList.contains('on'),
   slot0: window.__SD.S.def.kor.s[0],
   ir: window.__SD.exo('ir')
 }));
 ok('picking a module builds it (queued, not yet armed) and closes the modal',
    !picked.maskOn && picked.slot0 && picked.slot0.m==='tur' && picked.slot0.lv===0 && picked.slot0.armed===false, picked);
 ok('picking a module spends exactly dmodPrice(s,0)', irBeforePick-picked.ir===expectPrice, {irBeforePick, ir:picked.ir, expectPrice});

 // a FILLED slot's tap is completely unaffected - still the old inline path, no modal
 const filledTap=await p.evaluate(()=>{
   document.querySelector('#sysDefRow .sc[data-slot="0"]').click();
   return {
     maskOn: document.getElementById('mask').classList.contains('on'),
     detailHidden: document.getElementById('sysDefDetail').hidden,
     detailHasDn: !!document.querySelector('#sysDefDetail .dn')
   };
 });
 ok('tapping a FILLED slot still opens the inline detail strip, not the modal (unchanged)',
    !filledTap.maskOn && !filledTap.detailHidden && filledTap.detailHasDn, filledTap);
 await p.evaluate(()=>document.querySelector('#sysDefRow .sc[data-slot="0"]').click());   // close it back up

 // the generic #mask backdrop-tap-to-close (pre-existing, not added by this patch) also clears defSel -
 // otherwise the empty card's .sel highlight would be left stuck by a close path CANCEL never sees.
 const backdropClose=await p.evaluate(async()=>{
   document.querySelector('#sysDefRow .sc[data-slot="1"][data-empty="1"]').click();
   const openedSel=JSON.parse(JSON.stringify(window.__SD.defSel));
   document.getElementById('mask').click();
   dirty=true; render();
   await new Promise(r=>setTimeout(r,30));
   return { openedSel, maskOn:document.getElementById('mask').classList.contains('on'),
     defSel:window.__SD.defSel, cardSel:document.querySelector('#sysDefRow .sc[data-slot="1"]').classList.contains('sel') };
 });
 ok('a backdrop tap (not CANCEL) also closes the picker and clears defSel, no stuck .sel highlight',
    backdropClose.openedSel && backdropClose.openedSel.slot===1 && !backdropClose.maskOn &&
    backdropClose.defSel===null && !backdropClose.cardSel, backdropClose);

 // ---------------- no churn: #sysDefRow cards don't get rebuilt while a build ticks ----------------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:20, lvSeen:20, all:1e30, ore:1e30, exo:{ir:1e9},
     sys:{ home:{b:{}}, kor:{b:{}} } });
   G.dmodBuild(G.SYSMAP.kor,0,'tur');
   G.S.msel='kor'; gotoTab('p-map'); dirty=true; render();
 });
 await p.waitForTimeout(200);
 const churn=await p.evaluate(()=>new Promise(resolve=>{
   const row=document.getElementById('sysDefRow');
   const card=row&&row.querySelector('.sc[data-slot="0"]');
   if(!card){ resolve({found:false}); return; }
   card.__mark=true;
   setTimeout(()=>{
     const now=document.querySelector('#sysDefRow .sc[data-slot="0"]');
     resolve({ found:true, survived: !!(now&&now.__mark) });
   }, 700);
 }));
 ok('the building slot\'s own card does not get replaced while its countdown ticks', churn.found&&churn.survived, churn);

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
