const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tnodes2.js — PLAN-ending.md Batch B: Exotic Nodes (S.en) and THE PROJECT (pj1/pj2/
// pj3/pjx). Covers patch582 (the resource itself: rate per ring, occupied systems
// excluded, offline catch-up, save round-trip, strip visibility), patch583 (cur:"en"
// threading, cost/req gating), and patch584 (nexLv(), the three multipliers, the ???
// node's dual lock, startFinale()). Also prints (not asserts) the Nodes/day + days-to-
// afford table the plan asks for, for the owner's tuning pass.
//
// Systems are held here the same way several other tests already do (tsave2/trivals2
// etc.) - by writing S.sys[id] directly rather than going through claimSystem()/an
// invasion. sysHeld() only ever looks at S.sys presence + sysOccupied(), never at a
// system's `owner` field (that only gates claimSystem/canAssault), so this is a
// faithful way to test enRate()/heldSystems() math without needing real ownership.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 // patch579: dismiss the fresh-game intro overlay before driving real UI clicks
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- EN_RING3/EN_RING4 rate, per the plan's own numbers ----------
 const rate1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   // 2 ring-3 held, 1 ring-4 held (nyx excluded on purpose - saved for the pjx test below)
   for(const id of ['anv','thu'])G.S.sys[id]={b:{}};
   G.S.sys['vor']={b:{}};
   const r=G.enRate();
   const expect=(2*G.EN_RING3+1*G.EN_RING4)/3600;
   return {r, expect};
 });
 ok('enRate() = (ring3held*EN_RING3 + ring4held*EN_RING4)/3600', Math.abs(rate1.r-rate1.expect)<1e-9, rate1);

 const rate0=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   return G.enRate();
 });
 ok('a fresh save (only home held) has enRate()===0', rate0===0, rate0);

 // ---------- occupied ring-3/4 systems do not count ----------
 const occ=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.sys['anv']={b:{}}; G.S.sys['vor']={b:{}};
   const before=G.enRate();
   G.S.occ['anv']='hel';   // sysOccupied() gate - same field occupySystem() itself would set
   const after=G.enRate();
   return {before, after, expectAfter:(1*G.EN_RING4)/3600};
 });
 ok('an occupied ring-3 system stops counting toward enRate()',
   occ.before>occ.after && Math.abs(occ.after-occ.expectAfter)<1e-9, occ);

 // ---------- tick(dt) accrues S.en/S.enAll beside the EXO loop ----------
 const tickR=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   for(const id of ['anv','thu','wra'])G.S.sys[id]={b:{}};   // 3 ring-3
   const r=G.enRate();
   G.tick(100);
   return {en:G.S.en, enAll:G.S.enAll, expect:r*100};
 });
 ok('tick(dt) accrues S.en by enRate()*dt', Math.abs(tickR.en-tickR.expect)<1e-6, tickR);
 ok('tick(dt) accrues S.enAll by the same amount (lifetime total)', Math.abs(tickR.enAll-tickR.expect)<1e-6, tickR);

 // ---------- offline catch-up, same t/eff as ore/cry ----------
 const off=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), last: Date.now()-2*3600*1000,   // 2h away
     sys:{ home:{b:{}}, anv:{b:{}}, thu:{b:{}}, vor:{b:{}} } });   // 2 ring3 + 1 ring4
   const r=G.enRate();
   G.offlineReport();
   const html=document.querySelector('#modal').innerHTML;
   document.querySelector('#mask').classList.remove('on');   // close the away-report modal
   return { en:G.S.en, enAll:G.S.enAll, mentionsNodes:html.includes('Exotic Nodes'), r };
 });
 ok('offlineReport() banks Exotic Nodes for the time away (capped/discounted like ore)',
   off.en>0 && off.en<=off.r*2*3600, off);
 ok('offlineReport() modal shows the Exotic Nodes line when >0', off.mentionsNodes, off);
 ok('offlineReport() also raises S.enAll (lifetime), same amount as S.en on a fresh bank',
   Math.abs(off.en-off.enAll)<1e-6, off);

 // ---------- save round-trip / sanitiser ----------
 const rt=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), en:123.45, enAll:999});
   return { en1:G.S.en, enAll1:G.S.enAll };
 });
 const rt2=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), en:50, enAll:10});
   return {en:G.S.en, enAll:G.S.enAll};
 });
 ok('adopt() keeps a valid S.en/S.enAll as-is', rt.en1===123.45 && rt.enAll1===999, rt);
 ok('adopt() raises enAll to at least en (lifetime can never be below the current bank)',
   rt2.en===50 && rt2.enAll===50, rt2);
 const rt3=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), en:-5, enAll:-5});
   return {en:G.S.en, enAll:G.S.enAll};
 });
 ok('adopt() clamps a negative/corrupt S.en and S.enAll to 0', rt3.en===0 && rt3.enAll===0, rt3);

 // ---------- patch630: #exoStrip is gone - the header's context card (#ctxCard) is
 // tappable once anything has ever been banked, opening exoModal() (all four exotics
 // + Exotic Nodes). Same gate, same permanence, now expressed as a class + a modal
 // instead of a strip.
 // fresh save: not tappable, nothing to show
 const cardFresh=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.dirty=true; G.render();
   const card=document.getElementById('ctxCard');
   return { tappable:card.classList.contains('tappable'), cursor:getComputedStyle(card).cursor,
     any:G.exoEverBankedAny() };
 });
 ok('the context card is NOT tappable until anything has ever been banked (fresh save)',
    !cardFresh.tappable && cardFresh.cursor==='default' && !cardFresh.any, cardFresh);
 // banking (S.en, same fixture the old #exoStrip test used) makes it tappable, opens the modal,
 // 5 rows (4 exotics + Exotic Nodes, matching the old strip's own "5th entry" behaviour)
 const cardShown=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), en:42});
   G.dirty=true; G.render();
   const card=document.getElementById('ctxCard');
   const tappable=card.classList.contains('tappable'), cursor=getComputedStyle(card).cursor;
   G.exoModal();
   const rows=[...document.querySelectorAll('#rmRows .rrow')];
   return { tappable, cursor, maskOn:document.getElementById('mask').classList.contains('on'),
     n:rows.length, lastText:rows[rows.length-1]&&rows[rows.length-1].textContent };
 });
 ok('banking (S.en>0) makes the card tappable', cardShown.tappable && cardShown.cursor==='pointer', cardShown);
 ok('exoModal() opens #mask with 5 rows (4 exotics + Exotic Nodes, the old strip\'s own 5th-entry case)',
    cardShown.maskOn && cardShown.n===5 && /Exotic Nodes/.test(cardShown.lastText), cardShown);
 await p.evaluate(()=>document.getElementById('rmClose').click());
 // the modal's numbers match exo()/exoRate()/S.en/enRate() directly, not a re-derivation
 const rowValues=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), exo:{ir:1234,he:0,xe:0,am:0}, en:7});
   G.S.exoSeen={ir:true};
   G.dirty=true; G.render();
   G.exoModal();
   const rows=[...document.querySelectorAll('#rmRows .rrow')].map(r=>r.textContent);
   return { rows, expectIr:G.fmt(G.exo('ir')), expectEn:G.fmt(G.S.en) };
 });
 ok('the Iridium row shows the real exo(\'ir\') balance', rowValues.rows.some(t=>t.includes('Iridium')&&t.includes(rowValues.expectIr)), rowValues);
 ok('the Exotic Nodes row shows the real S.en balance', rowValues.rows.some(t=>t.includes('Exotic Nodes')&&t.includes(rowValues.expectEn)), rowValues);
 // live tick: rmTick() (unchanged, render()'s own existing call) keeps a row current while the modal
 // is open, same 11Hz idiom the four currency modals already get - not a second timer.
 await p.evaluate(()=>{ window.__SD.S.exo.ir=999; });
 await p.waitForTimeout(200);
 const liveRow=await p.evaluate(()=>document.querySelector('#rmRows .rrow').textContent);
 ok('a balance change while the modal is open updates its row without closing/reopening it',
    liveRow.includes('999'), liveRow);
 await p.evaluate(()=>document.getElementById('rmClose').click());
 // permanent, like the old strip's own gate - spending back to 0 does not un-tap the card
 const stillTappable=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.exo.ir=0; G.S.en=0;
   G.dirty=true; G.render();
   return { tappable:document.getElementById('ctxCard').classList.contains('tappable'), any:G.exoEverBankedAny() };
 });
 ok('the gate never re-locks once anything has ever been banked (permanent, like the old #exoStrip)',
    stillTappable.tappable && stillTappable.any, stillTappable);

 // ---------- cost/req gating ----------
 const gate=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), dm:1e12, en:0});
   const pj1=G.NEXUS.find(x=>x.id==='pj1'), pj2=G.NEXUS.find(x=>x.id==='pj2'), pj3=G.NEXUS.find(x=>x.id==='pj3');
   const pj1LockedAtStart=G.nexLocked(pj1);
   const pj2LockedBefore=G.nexLocked(pj2);
   // pj3 is still locked here (req pj2, not owned) - try to buy it anyway, plenty of
   // Nodes on hand, to prove buyNex() itself refuses a locked node (not just an
   // unaffordable one)
   G.S.en=1e6; const buyPj3WhileLockedRefused = !G.buyNex(pj3);
   const enUnchangedAfterRefusedBuy = G.S.en===1e6;
   G.S.en=1000; const boughtPj1=G.buyNex(pj1);
   const pj2LockedAfterPj1=G.nexLocked(pj2);
   return {pj1LockedAtStart, pj2LockedBefore, buyPj3WhileLockedRefused, enUnchangedAfterRefusedBuy,
     boughtPj1, pj2LockedAfterPj1};
 });
 ok('pj1 has no req - never locked', !gate.pj1LockedAtStart, gate);
 ok('pj2 is locked before pj1 is owned', gate.pj2LockedBefore, gate);
 ok('buyNex() refuses a locked node even with more than enough Nodes on hand', gate.buyPj3WhileLockedRefused, gate);
 ok('a refused (locked) buyNex() spends nothing', gate.enUnchangedAfterRefusedBuy, gate);
 ok('buying pj1 succeeds when affordable and unlocked', gate.boughtPj1, gate);
 ok('pj2 unlocks the instant pj1 is owned', !gate.pj2LockedAfterPj1, gate);

 // ---------- cur:"en" spends Nodes, never Dark Matter ----------
 const cur=await p.evaluate(()=>{
   const G=window.__SD;
   const pj1=G.NEXUS.find(x=>x.id==='pj1');
   G.adopt({...G.fresh(), dm:5000, en:G.nexCost(pj1)});
   const dmBefore=G.S.dm, enBefore=G.S.en;
   const bought=G.buyNex(pj1);
   return {dmBefore, dmAfter:G.S.dm, enBefore, enAfter:G.S.en, bought, cost:G.nexCost(pj1)};
 });
 ok('buying a cur:"en" node spends Exotic Nodes', cur.bought && cur.enAfter===cur.enBefore-cur.cost, cur);
 ok('buying a cur:"en" node leaves Dark Matter untouched', cur.dmAfter===cur.dmBefore, cur);
 const curDm=await p.evaluate(()=>{
   const G=window.__SD;
   const ent=G.NEXUS.find(x=>x.id==='ent');
   G.adopt({...G.fresh(), dm:1e9, en:0});
   const enBefore=G.S.en;
   const bought=G.buyNex(ent);
   return {bought, enAfter:G.S.en, enBefore};
 });
 ok('a plain (no cur) node still spends Dark Matter, not Nodes, as before', curDm.bought && curDm.enAfter===curDm.enBefore, curDm);

 // ---------- the ??? node: pj3 owned AND Nyx held ----------
 const pjx=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), dm:1e12});
   const pjxDef=G.NEXUS.find(x=>x.id==='pjx');
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj1'));
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj2'));
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj3'));
   const lockedNoNyx=G.nexLocked(pjxDef);
   const reqText=G.nexReqText(pjxDef);
   G.S.sys.nyx={b:{}};
   const lockedWithNyx=G.nexLocked(pjxDef);
   G.S.en=5000; const before=G.S.end;
   const bought=G.buyNex(pjxDef);
   return {lockedNoNyx, reqText, lockedWithNyx, before, after:G.S.end, bought};
 });
 ok('pjx stays locked with pj3 owned but Nyx not held', pjx.lockedNoNyx, pjx);
 ok('nexReqText(pjx) names both requirements', pjx.reqText.includes('Sovereign Key') && pjx.reqText.includes('Nyx'), pjx);
 ok('pjx unlocks once pj3 is owned AND Nyx is held', !pjx.lockedWithNyx, pjx);
 ok('buying pjx calls startFinale() -> S.end goes 0 -> 1', pjx.before===0 && pjx.after===1 && pjx.bought, pjx);
 // patch589: startFinale() now plays the real turn scene (STORY.turn) instead of
 // just toasting - it ends on ENGAGE/NOT YET buttons (playScene's opts.buttons
 // branch), so sceneFinish() alone only reveals that button row rather than
 // closing the scene the way it does for a plain (button-less) scene like the
 // intro - see sceneFinish() itself. sceneClose() directly is the test-only
 // equivalent of tapping NOT YET (no callback either way), used only to keep this
 // node/Project test unblocked; tending2.js (patch589) is what actually exercises
 // ENGAGE/NOT YET for real. Without this the later p.click('[data-p="p-nex"]')
 // below would hang forever against the overlay.
 await p.evaluate(()=>{ const G=window.__SD; if(G.sceneOn){ G.sceneFinish(); if(G.sceneOn)G.sceneClose(); } });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // ---------- fresh()/adopt(): S.end default + clamp ----------
 const endField=await p.evaluate(()=>{
   const G=window.__SD;
   const fresh=G.fresh().end;
   const clampedHigh=(G.adopt({...G.fresh(), end:9}), G.S.end);
   const clampedNeg=(G.adopt({...G.fresh(), end:-3}), G.S.end);
   const clampedFrac=(G.adopt({...G.fresh(), end:1.9}), G.S.end);
   return {fresh, clampedHigh, clampedNeg, clampedFrac};
 });
 ok('fresh() starts S.end at 0', endField.fresh===0, endField);
 ok('adopt() clamps S.end to the [0,2] range', endField.clampedHigh===2 && endField.clampedNeg===0, endField);
 ok('adopt() floors a fractional S.end', endField.clampedFrac===1, endField);

 // ---------- each Project multiplier applies exactly once ----------
 const mults=await p.evaluate(()=>{
   const G=window.__SD;
   // pj1: exotic production, on a system that actually produces one
   G.adopt({...G.fresh(), dm:1e12, ore:1e30});
   G.S.sys.kor={b:{}};
   const exoGi=G.sysLadder('kor').find(gi=>G.GENS[gi].kind!=='ore');
   G.S.sys.kor.b[exoGi]=100;
   const exoBefore=G.sysExoRate('kor');
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj1'));
   const exoAfter=G.sysExoRate('kor');

   // pj2: fleet damage & hull
   G.S.fl[0].sh=[10,0,0,0,0,0,0,0];   // fixture moved to S.fl[0] (PLAN-fleets run 1)
   const dpsBefore=G.fleetDPS(), hpBefore=G.fleetHPMax();
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj2'));
   const dpsAfter=G.fleetDPS(), hpAfter=G.fleetHPMax();

   // pj3: ore production only, exotic untouched
   const oreMulBefore=G.globalMul(), exoStillBefore=G.sysExoRate('kor');
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj3'));
   const oreMulAfter=G.globalMul(), exoStillAfter=G.sysExoRate('kor');

   return {exoBefore,exoAfter, dpsBefore,dpsAfter, hpBefore,hpAfter,
     oreMulBefore,oreMulAfter, exoStillBefore,exoStillAfter,
     PJ1_MUL:G.PJ1_MUL, PJ2_MUL:G.PJ2_MUL, PJ3_MUL:G.PJ3_MUL};
 });
 ok('pj1 multiplies sysExoRate() by PJ1_MUL exactly once',
   Math.abs(mults.exoAfter/mults.exoBefore - mults.PJ1_MUL)<1e-6, mults);
 ok('pj2 multiplies fleetDPS() by PJ2_MUL exactly once',
   Math.abs(mults.dpsAfter/mults.dpsBefore - mults.PJ2_MUL)<1e-6, mults);
 ok('pj2 multiplies fleetHPMax() by PJ2_MUL exactly once (same "fleet damage & hull" node)',
   Math.abs(mults.hpAfter/mults.hpBefore - mults.PJ2_MUL)<1e-6, mults);
 ok('pj3 multiplies globalMul() (ore) by PJ3_MUL exactly once',
   Math.abs(mults.oreMulAfter/mults.oreMulBefore - mults.PJ3_MUL)<1e-6, mults);
 ok('pj3 never touches exotic production (globalMul() is ore-only)',
   mults.exoStillAfter===mults.exoStillBefore, mults);

 // ---------- nexLv(): a live passthrough normally; patch589 (Batch D) wires the
 //            S.end===1 suspension this batch's own comment once called out as not
 //            wired yet - updated here rather than left describing behaviour the
 //            game no longer has (patch589 is what changes it; full coverage of the
 //            suspension itself - every multiplier, the Nexus pane, RESET ENDING -
 //            lives in tending2.js, not repeated here). ----------
 const nlv=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), dm:1e9});
   G.buyNex(G.NEXUS.find(x=>x.id==='ent'));
   const nexLv=G.nexLv('ent'), direct=G.S.nx.ent;
   G.S.end=1; const whileSeized=G.nexLv('ent');
   G.S.end=0; const restored=G.nexLv('ent');
   return { nexLv, direct, whileSeized, restored };
 });
 ok('nexLv(id) reads the real S.nx level while S.end===0', nlv.nexLv===nlv.direct && nlv.nexLv>0, nlv);
 ok('patch589: S.end===1 suspends nexLv() to 0', nlv.whileSeized===0, nlv);
 ok('nexLv() reads the real level again once S.end leaves 1', nlv.restored===nlv.direct, nlv);

 // ---------- DM "Nexus levels" totals exclude cur:"en" nodes ----------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), dm:1e12, lvl:99, lvSeen:99});   // level 99: Nexus tab unlocked (>=20)
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj1'));
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pj2'));
 });
 // this used to be the file's one REAL (page.click) click, and patch629 made
 // #notice a fixed, full-viewport backdrop while shown - it now genuinely
 // intercepts a real click the way #mask already did. queueNotice() has far too
 // many independent callers (checkUnlocks() off tick()'s own real wall-clock
 // loop, rival moves, combat, missions, the intro's onDone) to drain once and
 // trust it to stay empty for the gap before a real click lands - a fresh one
 // can queue between the drain and the click itself. Every other interaction in
 // this file already goes through the real onclick handler via a DOM .click()
 // instead of a real pointer event, which is immune to whatever #notice is
 // doing (same reasoning tdef2.js/tnotices2.js document) - match that here
 // rather than fight the race.
 await p.evaluate(()=>{ document.querySelector('[data-p="p-nex"]').click(); });
 await p.waitForTimeout(150);
 const dmTotalText=await p.evaluate(()=>document.getElementById('vDmS').textContent);
 ok('the DM header pill does not count Project-node levels ("for the Nexus", 0 DM Nexus levels spent)',
   dmTotalText.trim()==='for the Nexus', dmTotalText);

 // ---------- Market never lists Exotic Nodes as sellable ----------
 const mkt=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), en:999999});
   return G.mktSvKinds();
 });
 ok('mktSvKinds() never includes "en" - Exotic Nodes are not sellable', !mkt.includes('en'), mkt);

 // ---------- printed (not asserted) pacing table ----------
 const table=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   function ratePerDay(r3,r4){
     let i=0;
     for(const id of ['anv','thu','wra','cal','erb','sab','zen'].slice(0,r3))G.S.sys[id]={b:{}};
     for(const id of ['vor','aur','kal','umb','sev','tha','oro','nyx'].slice(0,r4))G.S.sys[id]={b:{}};
     const perDay=G.enRate()*86400;
     G.S.sys={home:{b:{}}};   // reset holdings between scenarios
     return perDay;
   }
   const scenarios=[[3,0],[7,1],[7,8]];
   const rates=scenarios.map(([r3,r4])=>({r3,r4,perDay:ratePerDay(r3,r4)}));
   const costs=G.NEXUS.filter(n=>n.cur==='en').map(n=>({id:n.id,n:n.n,cost:G.nexCost(n,0)}));
   return {rates, costs};
 });
 out.push('---- Nodes/day + days-to-afford (printed for the owner, not asserted) ----');
 for(const r of table.rates){
   out.push(`  ${r.r3} ring-3 + ${r.r4} ring-4 held: ${r.perDay.toFixed(2)} Nodes/day`);
   for(const c of table.costs){
     const days = r.perDay>0 ? (c.cost/r.perDay) : Infinity;
     out.push(`      ${c.n} (${c.cost} Nodes): ${days===Infinity?'never at 0/day':days.toFixed(1)+'d'}`);
   }
 }

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 const fails=out.filter(l=>l.startsWith('FAIL')).length;
 console.log(fails+' failures');
 console.log(errs.length?('JS ERRORS: '+errs.join(' | ')):'NO JS ERRORS');
 await b.close();
})();
