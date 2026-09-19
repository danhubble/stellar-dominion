const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tending2.js — PLAN-ending.md Batch D, item 1 (D1 of a 3-way split): "the turn"
// (patch589). Structured so D2 (patch590/591, the final battle + allies) and D3
// (patch592/593, the ending + peace) can each append their own top-level section
// below - see the marker comment right before the final tally at the bottom of this
// file. Every section here uses its own `out`/`ok` accumulator already declared at
// the top, so an appended section only has to keep pushing onto the same `out`.
//
// Covers the plan's own list for 589: buying pjx sets S.end=1; every Nexus
// multiplier (ent/syn/chr/ovs/war/pj1/pj2/pj3) reads neutral (nexLv()===0) while
// seized and returns after RESET ENDING; a purchase is refused outright while
// seized; no VEGA notice can queue at S.end>=1 and any already queued are purged
// at the turn; rival notices still queue; no new threats/sabotage/live fleets
// appear while S.end>=1 even after a large amount of simulated time (online tick
// loop AND the offline catch-up paths); S.thq is cleared at the turn; NOT YET
// leaves the pinned Raids card in place; the pinned card's ENGAGE is disabled at
// low fleet hull; save/reload at S.end=1 restores every seized surface without
// replaying the scene. Also covers the turned-VEGA-avatar mechanism, the Nexus
// pane's SEIZED rendering, the Map marker/edge pill, and the two new dev buttons -
// all named in the plan's own scope for this patch even where the test list above
// doesn't spell out an assertion by name.
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

 // Two held systems (kor: ring1, nyx: the last system, needed for pjx) plus both
 // RVACT rivals primed and "seen" - a shared, deliberately over-provisioned setup
 // so every test below can force whichever rival mechanic it needs without a
 // fresh adopt() of its own. Mirrors tsabotage2.js's own baseAdopt pattern.
 const baseAdopt = `G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, dm:1e15,
     sys:{ home:{b:{}}, kor:{b:{}}, nyx:{b:{}} },
     rv:{ hel:{p:0,cd:0,seen:1,w:0,mv:G.RIVAL_MOVE_CAP}, cov:{p:0,cd:0,seen:1,w:0,mv:G.RIVAL_MOVE_CAP} } });`;

 // buys every DM Nexus node to level 1 and every Project node (pj1/pj2/pj3) to
 // level 1 - NOT pjx, so the caller decides exactly when the turn itself fires.
 const grantAll = `
   for(const id of ['ent','chr','ovs','syn','war']){ G.S.dm=1e15; G.buyNex(G.NEXUS.find(x=>x.id===id)); }
   G.S.en=1e6; G.buyNex(G.NEXUS.find(x=>x.id==='pj1'));
   G.S.en=1e6; G.buyNex(G.NEXUS.find(x=>x.id==='pj2'));
   G.S.en=1e6; G.buyNex(G.NEXUS.find(x=>x.id==='pj3'));
 `;

 // ==================================================================
 // ================= D1 (patch589): "the turn" ====================
 // ==================================================================

 // ---------- buying pjx sets S.end=1 (and starts the turn scene) ----------
 const turn = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   const before=G.S.end;
   G.S.en=5000; const bought=G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));
   return { before, after:G.S.end, bought, sceneOn:G.sceneOn };
 }, {baseAdopt,grantAll});
 ok('buying pjx sets S.end=1', turn.before===0 && turn.after===1 && turn.bought, turn);
 ok('buying pjx opens the turn scene', turn.sceneOn===true, turn);

 // ---------- every Nexus multiplier reads neutral (nexLv()===0) while seized,
 //            and returns to its real level once S.end leaves 1 ----------
 const seizedLv = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   const ids=['ent','chr','ovs','syn','war','pj1','pj2','pj3'];
   const realLv={}; for(const id of ids) realLv[id]=G.nexLv(id);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1
   const seizedLv={}; for(const id of ids) seizedLv[id]=G.nexLv(id);
   G.devAction('resetEnding');
   const restoredLv={}; for(const id of ids) restoredLv[id]=G.nexLv(id);
   return { ids, realLv, seizedLv, restoredLv, endAfterReset:G.S.end, pjxAfterReset:G.S.nx.pjx };
 }, {baseAdopt,grantAll});
 for(const id of seizedLv.ids){
   ok(`nexLv('${id}') is >0 before the turn (sanity - the node was actually bought)`,
     seizedLv.realLv[id]>0, {id, real:seizedLv.realLv[id]});
   ok(`nexLv('${id}') reads 0 (neutral) while S.end===1`, seizedLv.seizedLv[id]===0,
     {id, seized:seizedLv.seizedLv[id]});
   ok(`nexLv('${id}') returns to its real level after RESET ENDING`,
     seizedLv.restoredLv[id]===seizedLv.realLv[id], {id, restored:seizedLv.restoredLv[id], real:seizedLv.realLv[id]});
 }
 ok('RESET ENDING sets S.end back to 0', seizedLv.endAfterReset===0, seizedLv);
 ok('RESET ENDING clears S.nx.pjx (the turn can be re-triggered)', seizedLv.pjxAfterReset===0, seizedLv);

 // ---------- the same suspension flows through to the real effect functions,
 //            not only nexLv() in isolation ----------
 const effects = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.sys.home.b[0]=200; G.S.sys.home.b[1]=100;   // ore + crystal production, for cryRate()>0
   const exoGi=G.sysLadder('kor').find(gi=>G.GENS[gi].kind!=='ore');
   if(exoGi!=null)G.S.sys.kor.b[exoGi]=100;   // give sysExoRate('kor') something to read, mirrors tnodes2.js
   G.S.sh=[10,0,0,0,0,0,0,0];
   const before={ fleetDPS:G.fleetDPS(), fleetHPMax:G.fleetHPMax(), globalMul:G.globalMul(),
     cryRate:G.cryRate(), offlineEff:G.offlineEff(), sysExoRate:G.sysExoRate('kor') };
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1
   const seized={ fleetDPS:G.fleetDPS(), fleetHPMax:G.fleetHPMax(), globalMul:G.globalMul(),
     cryRate:G.cryRate(), offlineEff:G.offlineEff(), sysExoRate:G.sysExoRate('kor') };
   return { before, seized };
 }, {baseAdopt,grantAll});
 ok('fleetDPS() drops once seized (pj2/war both suspended)', effects.seized.fleetDPS<effects.before.fleetDPS, effects);
 ok('fleetHPMax() drops once seized', effects.seized.fleetHPMax<effects.before.fleetHPMax, effects);
 ok('globalMul() (ore) drops once seized (ent/pj3 both suspended)', effects.seized.globalMul<effects.before.globalMul, effects);
 ok('cryRate() drops once seized (syn suspended)', effects.seized.cryRate<effects.before.cryRate, effects);
 ok('offlineEff() drops once seized (chr suspended)', effects.seized.offlineEff<effects.before.offlineEff, effects);
 ok('sysExoRate() drops once seized (pj1 suspended)', effects.seized.sysExoRate<effects.before.sysExoRate, effects);

 // ---------- a purchase is refused outright while seized ----------
 const buyBlocked = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1
   const dmBefore=G.S.dm, entLvBefore=G.S.nx.ent;
   G.S.dm=1e15;   // plenty on hand
   const bought=G.buyNex(G.NEXUS.find(x=>x.id==='ent'));
   return { bought, dmUnchanged:G.S.dm===1e15, entLvUnchanged:G.S.nx.ent===entLvBefore };
 }, {baseAdopt,grantAll});
 ok('buyNex() refuses any purchase while S.end===1', !buyBlocked.bought, buyBlocked);
 ok('a refused (seized) buyNex() spends nothing', buyBlocked.entLvUnchanged, buyBlocked);

 // ---------- Nexus pane: every card shows greyed SEIZED, none clickable ----------
 const nexPane = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1
   G.renderNex();
   const cards=[...document.querySelectorAll('#nex .card')];
   return {
     count:cards.length,
     allSeized: cards.every(c=>c.classList.contains('seized')),
     anyEnabledButton: cards.some(c=>{ const b=c.querySelector('button'); return b && !b.disabled; }),
     allSayTitle: cards.every(c=>/SEIZED/.test(c.querySelector('button').textContent)),
   };
 }, {baseAdopt,grantAll});
 ok('Nexus pane renders at least the 5 DM cards + 4 Project cards while seized', nexPane.count>=9, nexPane);
 ok('every Nexus card carries the "seized" class while S.end===1', nexPane.allSeized, nexPane);
 ok('every Nexus card button reads SEIZED', nexPane.allSayTitle, nexPane);
 ok('no Nexus card button is enabled while seized', !nexPane.anyEnabledButton, nexPane);

 // ---------- advisor dark: no VEGA notice can queue at S.end>=1, queued ones are
 //            purged at the turn; rival notices still queue ----------
 const advisor = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   // queue a VEGA notice BEFORE the turn, so it is sitting in the queue when it comes
   G.S.seen['vega:ring2']=false; delete G.S.seen['vega:ring2'];
   G.queueNotice('vega:ring2');
   const queuedBeforeTurn=G.S.notifyQueue.includes('vega:ring2');
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1, purgeVegaNotices() runs
   const purgedAtTurn=!G.S.notifyQueue.includes('vega:ring2');
   // a brand-new VEGA key cannot queue at all now
   delete G.S.seen['vega:drift25'];
   G.queueNotice('vega:drift25');
   const newVegaRefused=!G.S.notifyQueue.includes('vega:drift25') && !G.S.seen['vega:drift25'];
   // a rival notice still queues fine
   delete G.S.seen['rival:rv40'];
   G.queueRivalNotice('rv40');
   const rivalStillQueues=G.S.notifyQueue.includes('rival:rv40');
   // a plain (non-VEGA, non-rival) key still queues fine too
   delete G.S.seen['xpHow'];
   G.queueNotice('xpHow');
   const plainStillQueues=G.S.notifyQueue.includes('xpHow');
   return { queuedBeforeTurn, purgedAtTurn, newVegaRefused, rivalStillQueues, plainStillQueues };
 }, {baseAdopt,grantAll});
 ok('sanity: the VEGA notice was actually queued before the turn', advisor.queuedBeforeTurn, advisor);
 ok('a VEGA notice already queued is purged the moment the turn arrives', advisor.purgedAtTurn, advisor);
 ok('no new VEGA notice can queue once S.end>=1', advisor.newVegaRefused, advisor);
 ok('a rival notice still queues once S.end>=1', advisor.rivalStillQueues, advisor);
 ok('a plain (non-VEGA) notice still queues once S.end>=1', advisor.plainStillQueues, advisor);

 // ---------- purgeVegaNotices() also runs on load (adopt()), belt and braces for
 //            an old save written before this guard existed ----------
 const loadPurge = await p.evaluate(()=>{
   const G=window.__SD;
   const raw={...G.fresh(), end:1, notifyQueue:['vega:ring2','rival:rv40','xpHow'], seen:{intro:true} };
   G.adopt(raw);
   return G.S.notifyQueue.slice();
 });
 ok('adopt() purges any "vega:*" entry in the queue for a save loaded at S.end>=1',
   !loadPurge.includes('vega:ring2') && loadPurge.includes('rival:rv40') && loadPurge.includes('xpHow'),
   loadPurge);

 // ---------- S.thq is cleared at the turn ----------
 const thqCleared = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.thq().push({id:999, rv:'hel', sysId:'kor', dif:1, t:100});
   const before=G.thq().length;
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1
   return { before, after:G.thq().length };
 }, {baseAdopt,grantAll});
 ok('S.thq has a live entry just before the turn (sanity)', thqCleared.before===1, thqCleared);
 ok('S.thq is cleared the instant the turn arrives', thqCleared.after===0, thqCleared);

 // ---------- rivals quiet: no new threats/sabotage/expansion/live-fleet, even
 //            after a large amount of simulated time, with every roll forced to
 //            "succeed" if the code path were ever reached ----------
 const quiet = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1
   // make everything maximally "ready to fire" - pressure maxed, cooldowns clear,
   // pj1 owned + plenty of Nodes banked (sabotage-eligible if S.end didn't block it)
   for(const id of G.RVACT){ G.rvOf(id).p=G.RV_MAX; G.rvOf(id).cd=0; G.rvOf(id).mv=G.RIVAL_MOVE_CAP; }
   G.S.thrCd=0; G.S.en=1e6;
   const orig=Math.random; Math.random=()=>0;   // any roll "succeeds" if it is ever taken
   G.rvMaybeThreat();
   const thqAfterThreat=G.thq().length;
   G.rvMaybeExpand(999999);
   const lostAfterExpand=Object.keys(G.S.lost||{}).length;
   G.rvMoveAway(999999);
   const occAfterMove=Object.keys(G.S.occ||{}).length;
   G.lfMaybeLaunch(1);
   const lfAfterDirect=G.LF;
   for(let i=0;i<200;i++) G.rvTick(3600);   // 200 simulated hours, online tick path
   const thqAfterTick=G.thq().length, lfAfterTick=G.LF;
   G.rvExpandAway(999999);
   const lostAfterOfflineExpand=Object.keys(G.S.lost||{}).length;
   Math.random=orig;
   return { thqAfterThreat, lostAfterExpand, occAfterMove, lfAfterDirect,
     thqAfterTick, lfAfterTick, lostAfterOfflineExpand };
 }, {baseAdopt,grantAll});
 ok('rvMaybeThreat() spawns nothing while S.end>=1, even with the sab roll forced', quiet.thqAfterThreat===0, quiet);
 ok('rvMaybeExpand() takes no system while S.end>=1', quiet.lostAfterExpand===0, quiet);
 ok('rvMoveAway() (offline action budget) occupies nothing while S.end>=1', quiet.occAfterMove===0, quiet);
 ok('lfMaybeLaunch() starts no live fleet while S.end>=1', quiet.lfAfterDirect===null, quiet);
 ok('200 simulated hours of rvTick() spawn no threat while S.end>=1', quiet.thqAfterTick===0, quiet);
 ok('200 simulated hours of rvTick() start no live fleet while S.end>=1', quiet.lfAfterTick===null, quiet);
 ok('rvExpandAway() (offline expansion catch-up) takes no system while S.end>=1', quiet.lostAfterOfflineExpand===0, quiet);

 // ---------- the turn scene itself: a VEGA line uses the turned avatar, all three
 //            rivals get a line, ends on ENGAGE/NOT YET ----------
 const storyShape = await p.evaluate(()=>{
   const G=window.__SD;
   const who=G.STORY.turn.map(l=>l.who);
   return {
     hasVega: who.includes('vega'),
     hasAllThreeRivals: ['hel','cov','vsh'].every(id=>who.includes(id)),
     hasNarration: who.includes(null),
   };
 });
 ok('STORY.turn includes at least one VEGA line', storyShape.hasVega, storyShape);
 ok('STORY.turn includes a line from all three rivals (hel/cov/vsh)', storyShape.hasAllThreeRivals, storyShape);
 ok('STORY.turn includes plain narration too', storyShape.hasNarration, storyShape);

 const sceneVega = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // opens the scene at line 0 (VEGA, turned)
   const firstLineAv=document.getElementById('sceneAv').innerHTML;
   const firstLineTurned=firstLineAv.includes('vegaturn');
   // advance to a rival line and check its avatar/name match the rival, same shape
   // a RIVAL_MSG notice card already uses (patch580's own renderNotice() pattern)
   let steps=0, sawRival=null;
   while(steps<G.STORY.turn.length && !sawRival){
     const line=G.STORY.turn[steps];
     if(line.who && line.who!=='vega'){ sawRival=line.who; break; }
     G.sceneAdvance(); steps++;
   }
   const rivalAv=document.getElementById('sceneAv').innerHTML;
   const rivalWhoText=document.getElementById('sceneWho').textContent;
   return { firstLineTurned, sawRival, rivalAv, rivalWhoText };
 }, {baseAdopt,grantAll});
 ok('the turn scene\'s first (VEGA) line uses the turned/dimmed avatar (.vegaturn)', sceneVega.firstLineTurned, sceneVega);
 ok('the turn scene reaches a rival line with a rendered avatar', !!sceneVega.sawRival && sceneVega.rivalAv.length>0, sceneVega);

 // regression guard: the INTRO's VEGA line (a separate scene, no {turned:true})
 // must NOT pick up the turned/dimmed avatar - fresh context, real boot.
 const introNotTurned = await (async()=>{
   const ctx2=await b.newContext();
   const p2=await ctx2.newPage({viewport:{width:390,height:844}});
   await p2.goto(GAME_URL); await p2.waitForTimeout(500);
   const r=await p2.evaluate(()=>{
     const G=window.__SD;
     // STORY.intro is [null, null, vega, vega, vega] - advance twice to reach the first vega line
     G.sceneAdvance(); G.sceneAdvance();
     return { who:G.STORY.intro[2].who, avHTML:document.getElementById('sceneAv').innerHTML };
   });
   await ctx2.close();
   return r;
 })();
 ok('sanity: STORY.intro\'s 3rd line is a VEGA line', introNotTurned.who==='vega', introNotTurned);
 ok('the intro\'s VEGA line does NOT use the turned avatar (opts.turned defaults falsy)',
   !introNotTurned.avHTML.includes('vegaturn'), introNotTurned);

 // ---------- ENGAGE / NOT YET end the scene; NOT YET leaves the pinned card,
 //            ENGAGE calls the startFinalBattle() stub without changing S.end ----------
 const notYet = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.fhp=1;
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // opens the scene
   G.sceneFinish();   // reveal ENGAGE/NOT YET (same as tapping SKIP or reaching the last line)
   const btnTexts=[...document.querySelectorAll('#sceneEnd button')].map(b=>b.textContent.trim());
   const engageIsWarn=document.querySelectorAll('#sceneEnd button')[0].classList.contains('warn');
   const notYetBtn=[...document.querySelectorAll('#sceneEnd button')].find(b=>b.textContent.trim()==='NOT YET');
   notYetBtn.click();
   G.gotoTab('p-raid'); G.render();
   const card=document.getElementById('endCard');
   return { btnTexts, engageIsWarn, sceneOnAfter:G.sceneOn, endAfter:G.S.end,
     cardHTML:card.innerHTML, cardMentionsSolReach:/SOL REACH/.test(card.innerHTML) };
 }, {baseAdopt,grantAll});
 ok('the scene ends on exactly ENGAGE and NOT YET', notYet.btnTexts.length===2 &&
   notYet.btnTexts.includes('ENGAGE') && notYet.btnTexts.includes('NOT YET'), notYet);
 ok('ENGAGE is the emphasised (red/"warn") button', notYet.engageIsWarn, notYet);
 ok('NOT YET closes the scene', notYet.sceneOnAfter===false, notYet);
 ok('NOT YET does not change S.end (the game never forces the fight)', notYet.endAfter===1, notYet);
 ok('NOT YET leaves the pinned "VEGA\'s fleet holds Sol Reach" card in place',
   notYet.cardMentionsSolReach, notYet);

 const engageClick = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.fhp=1;
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));
   G.sceneFinish();
   const endBefore=G.S.end;
   [...document.querySelectorAll('#sceneEnd button')].find(b=>b.textContent.trim()==='ENGAGE').click();
   return { endBefore, endAfter:G.S.end, sceneOnAfter:G.sceneOn };
 }, {baseAdopt,grantAll});
 ok('ENGAGE also closes the scene', engageClick.sceneOnAfter===false, engageClick);
 ok('ENGAGE does not itself change S.end (patch590 stub only toasts)',
   engageClick.endBefore===1 && engageClick.endAfter===1, engageClick);

 // ---------- patch589b: confirm SKIP lands on ENGAGE/NOT YET rather than closing
 //            silently - playScene()'s SKIP button already calls sceneFinish(),
 //            and sceneFinish() already shows opts.buttons whenever a scene defines
 //            them (STORY.turn does), so this was already true; asserted directly
 //            here rather than only inferred from sceneFinish's one code path. ----------
 const skipToButtons = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // opens the scene at line 0
   const skipBtn=document.getElementById('sceneSkip');
   const hadSkip=!!skipBtn;
   if(skipBtn)skipBtn.click();
   const btnTexts=[...document.querySelectorAll('#sceneEnd button')].map(b=>b.textContent.trim());
   return { hadSkip, sceneOnAfter:G.sceneOn, btnTexts };
 }, {baseAdopt,grantAll});
 ok('the turn scene shows a SKIP button', skipToButtons.hadSkip, skipToButtons);
 ok('tapping SKIP lands on ENGAGE/NOT YET, not a silent close', skipToButtons.sceneOnAfter===true &&
   skipToButtons.btnTexts.includes('ENGAGE') && skipToButtons.btnTexts.includes('NOT YET'), skipToButtons);

 // ---------- pinned card (#endCard): ENGAGE disabled with a repair hint at low
 //            hull, enabled otherwise - same 0.15 threshold the ordinary
 //            raid/assault ENGAGE buttons already use. patch589b: a zero-fleet
 //            check takes priority over the hull one (this whole block now gives
 //            the fleet ships first - baseAdopt/grantAll never do - since the
 //            no-ships case gets its own test right below and this one is only
 //            about the hull threshold). ----------
 const pinnedCard = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));
   G.S.sh=[10,0,0];
   G.S.fhp=0.05;
   G.renderEndCard();
   const lowHull={ disabled:document.getElementById('endEngage').disabled,
     hint:document.getElementById('endCard').innerHTML.includes('too damaged') };
   G.S.fhp=1;
   G.renderEndCard();
   const fullHull={ disabled:document.getElementById('endEngage').disabled };
   return { lowHull, fullHull };
 }, {baseAdopt,grantAll});
 ok('#endCard\'s ENGAGE is disabled with a repair hint when fleet hull is below 0.15',
   pinnedCard.lowHull.disabled===true && pinnedCard.lowHull.hint, pinnedCard);
 ok('#endCard\'s ENGAGE is enabled at full hull (with a real fleet on hand)', pinnedCard.fullHull.disabled===false, pinnedCard);

 // ---------- patch589b review fix: #endCard's ENGAGE must also be disabled (with
 //            its own hint) when the player has NO ships at all, even at full hull
 //            - it used to read enabled in exactly this case (the bug the fix
 //            below addresses; grantAll/baseAdopt never grant a fleet, so this is
 //            also what patch589's own original test above was actually exercising
 //            before this fix, without knowing it). Same gate lives directly inside
 //            startFinalBattle() (still a stub until patch590), so a direct call
 //            with no fleet toasts the hint and changes nothing rather than
 //            silently no-opping. ----------
 const noShipsCard = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));
   G.S.sh=[0,0,0]; G.S.fhp=1;
   G.renderEndCard();
   const card={ disabled:document.getElementById('endEngage').disabled,
     hint:document.getElementById('endCard').innerHTML.includes('No fleet') };
   const endBefore=G.S.end;
   G.startFinalBattle();
   return { card, endAfter:G.S.end, endBefore };
 }, {baseAdopt,grantAll});
 ok('#endCard\'s ENGAGE is disabled with a "no fleet" hint when the player has zero ships, even at full hull',
   noShipsCard.card.disabled===true && noShipsCard.card.hint, noShipsCard);
 ok('startFinalBattle() itself refuses to start with no fleet (direct call, not only via the disabled button)',
   noShipsCard.endBefore===1 && noShipsCard.endAfter===1, noShipsCard);

 const pinnedGone = await p.evaluate(({baseAdopt})=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.renderEndCard();
   return document.getElementById('endCard').innerHTML;
 }, {baseAdopt});
 ok('#endCard renders empty while S.end===0 (never shown before the turn)', pinnedGone==='', pinnedGone);

 // ---------- Map: Sol Reach's own node + the edge pill for another sector ----------
 const mapMarker = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));
   G.gotoTab('p-map'); G.setMapSec(0); G.render();
   const homeIncoming=document.querySelector('#mapNodes .mnode[data-s="home"]').classList.contains('incoming');
   G.setMapSec(1); G.render();   // a sector other than Core
   const edgeHTML=document.getElementById('mapEdge').innerHTML;
   return { homeIncoming, mentionsSolReach:/SOL REACH/.test(edgeHTML) };
 }, {baseAdopt,grantAll});
 ok('Sol Reach\'s own map node shows "incoming" while S.end===1', mapMarker.homeIncoming, mapMarker);
 ok('a different sector\'s edge shows a pointer-back pill naming Sol Reach', mapMarker.mentionsSolReach, mapMarker);

 // ---------- dev: START FINALE and RESET ENDING ----------
 const devStart = await p.evaluate(({baseAdopt})=>{
   const G=window.__SD;
   eval(baseAdopt);
   const endBefore=G.S.end;
   G.devAction('startFinale');
   return { endBefore, endAfter:G.S.end, pj1:G.S.nx.pj1, pj2:G.S.nx.pj2, pj3:G.S.nx.pj3, nyxHeld:G.sysHeld('nyx') };
 }, {baseAdopt});
 ok('dev START FINALE grants pj1/pj2/pj3', devStart.pj1>=1 && devStart.pj2>=1 && devStart.pj3>=1, devStart);
 ok('dev START FINALE holds Nyx if it wasn\'t already', devStart.nyxHeld, devStart);
 ok('dev START FINALE calls the real startFinale() -> S.end goes 0 -> 1', devStart.endBefore===0 && devStart.endAfter===1, devStart);

 const devReset = await p.evaluate(({baseAdopt})=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.devAction('startFinale');
   const endMid=G.S.end;
   G.devAction('resetEnding');
   return { endMid, endAfter:G.S.end, pjx:G.S.nx.pjx };
 }, {baseAdopt});
 ok('dev RESET ENDING sets S.end back to 0', devReset.endMid===1 && devReset.endAfter===0, devReset);
 ok('dev RESET ENDING clears S.nx.pjx', devReset.pjx===0, devReset);

 // ---------- save/reload at S.end===1: no scene replay, every seized surface
 //            restored from the saved state alone ----------
 await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // opens the scene, S.end -> 1
   G.sceneFinish();
   const notYetBtn=[...document.querySelectorAll('#sceneEnd button')].find(b=>b.textContent.trim()==='NOT YET');
   notYetBtn.click();   // player dismisses it themselves, same as any real session
   G.save();
 }, {baseAdopt,grantAll});
 await p.reload(); await p.waitForTimeout(500);
 const reloaded = await p.evaluate(()=>{
   const G=window.__SD;
   return { sceneOn:G.sceneOn, sceneDisplay:getComputedStyle(document.getElementById('scene')).display,
     end:G.S.end };
 });
 ok('a reload at S.end===1 does not replay the turn scene', reloaded.sceneOn===false && reloaded.sceneDisplay==='none', reloaded);
 ok('a reload at S.end===1 keeps S.end===1', reloaded.end===1, reloaded);
 const reloadedSurfaces = await p.evaluate(()=>{
   const G=window.__SD;
   G.renderNex();
   const nexCards=[...document.querySelectorAll('#nex .card')];
   G.gotoTab('p-raid'); G.render();
   const endCardHTML=document.getElementById('endCard').innerHTML;
   G.gotoTab('p-map'); G.setMapSec(0); G.render();
   const homeIncoming=document.querySelector('#mapNodes .mnode[data-s="home"]').classList.contains('incoming');
   return {
     nexAllSeized: nexCards.length>0 && nexCards.every(c=>c.classList.contains('seized')),
     endCardShown: /SOL REACH/.test(endCardHTML),
     homeIncoming,
     nexLvZero: G.nexLv('ent')===0,
   };
 });
 ok('after reload: the Nexus pane still shows every card SEIZED', reloadedSurfaces.nexAllSeized, reloadedSurfaces);
 ok('after reload: the pinned Raids card is still shown', reloadedSurfaces.endCardShown, reloadedSurfaces);
 ok('after reload: Sol Reach\'s map node is still marked incoming', reloadedSurfaces.homeIncoming, reloadedSurfaces);
 ok('after reload: nexLv() still reads 0 (the suspension is state-driven, not scene-driven)', reloadedSurfaces.nexLvZero, reloadedSurfaces);

 // ==================================================================
 // ========== D2 (patch590/591): the final battle + allies ==========
 // ==================================================================
 // Drives the fight via __SD by manipulating BT directly and calling bUpdateWep
 // with dt steps rather than real-time waits, per the plan's own instruction.
 // finalAdopt: a full fleet (so fleetDPS()>0), Sol Reach's turn already fired
 // (devAction('startFinale') grants pj1-3, holds Nyx, calls the real startFinale()),
 // aimHint pre-seen so a wave-1 "joins the line" toast is reliably the LAST toast
 // (aimHint would otherwise fire after it, on a truly fresh save, and only on wave 1
 // - see the toast-order note on the alliesJoin test below).
 const finalAdopt = `G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, dm:1e15,
     sys:{ home:{b:{}}, kor:{b:{}}, nyx:{b:{}} },
     sh:[50,20,5], wpow:[true,true,false,false,false,false,false] });
   G.S.seen.aimHint=true;
   G.devAction('startFinale');`;

 // ---------- startFinalBattle() blocked outright with no ships (D2's own direct
 //            check - patch589b already covers the #endCard/hint side of this in
 //            the D1 section above; this confirms BT itself never opens) ----------
 const noShipsFinal = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, sh:[0,0,0]});
   G.devAction('startFinale');
   const before=!!G.BT;
   G.startFinalBattle();
   return { before, after:!!G.BT, end:G.S.end };
 });
 ok('startFinalBattle() never opens BT with zero ships', !noShipsFinal.before && !noShipsFinal.after, noShipsFinal);
 ok('a blocked startFinalBattle() leaves S.end===1 (the turn already happened, nothing else changes)',
   noShipsFinal.end===1, noShipsFinal);

 // ---------- the scripted target is always weapon mode, arch "mirror" ----------
 const shapeCheck = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   return { started:!!G.BT, mode:G.BT.mode, arch:G.BT.t.arch, final:G.BT.t.final, name:G.BT.t.name, wave:G.BT.wave };
 }, {finalAdopt});
 ok('startFinalBattle() opens BT with a real fleet', shapeCheck.started, shapeCheck);
 ok('the final target is always weapon mode, regardless of S.cmode', shapeCheck.mode==='wep', shapeCheck);
 ok('the final target\'s archetype is "mirror"', shapeCheck.arch==='mirror', shapeCheck);
 ok('the final target is tagged t.final', shapeCheck.final===1, shapeCheck);
 ok('the fight opens on wave 1', shapeCheck.wave===1, shapeCheck);

 // ---------- forcing weapon mode: even with S.cmode set to "turn"/"live" (dev-only),
 //            the final battle still forces wep ----------
 const modeForced = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.S.cmode='turn';
   G.startFinalBattle();
   return { mode:G.BT.mode };
 }, {finalAdopt});
 ok('S.cmode="turn" does not change the final battle\'s mode - still wep', modeForced.mode==='wep', modeForced);

 // ---------- waves: 2 only after 1 is fully dead, 3 only after 2, boss only in
 //            wave 3, a partial kill does not advance the wave ----------
 const waves = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   const wave1={ wave:G.BT.wave, en:G.BT.en.length, hasBoss:G.BT.en.some(e=>e.boss) };
   G.BT.en[0].alive=0;                 // one hostile down, others still alive
   G.bUpdateWep(0.1);
   const partial={ wave:G.BT.wave, breather:G.BT.waveBreather };
   for(const e of G.BT.en)e.alive=0;   // now the whole wave is down
   G.bUpdateWep(0.1);
   const clearedNotYetBreather={ wave:G.BT.wave, breather:G.BT.waveBreather, enAlive:G.BT.en.filter(e=>e.alive).length };
   G.bUpdateWep(5);                    // past FINAL_BREATHER_S
   const wave2={ wave:G.BT.wave, en:G.BT.en.length, hasBoss:G.BT.en.some(e=>e.boss) };
   for(const e of G.BT.en)e.alive=0;
   G.bUpdateWep(0.1); G.bUpdateWep(5);
   const wave3={ wave:G.BT.wave, hasBoss:G.BT.en.some(e=>e.boss), bossCount:G.BT.en.filter(e=>e.boss).length };
   return { wave1, partial, clearedNotYetBreather, wave2, wave3 };
 }, {finalAdopt});
 ok('wave 1 has no boss', !waves.wave1.hasBoss, waves);
 ok('a partial kill of wave 1 does not advance the wave', waves.partial.wave===1, waves);
 ok('wave 1 fully cleared starts the inter-wave breather, does not spawn wave 2 yet',
   waves.clearedNotYetBreather.wave===1 && waves.clearedNotYetBreather.breather>0 && waves.clearedNotYetBreather.enAlive===0, waves);
 ok('wave 2 spawns only after the breather elapses', waves.wave2.wave===2 && waves.wave2.en>0, waves);
 ok('wave 2 has no boss', !waves.wave2.hasBoss, waves);
 ok('wave 3 spawns after wave 2 is fully dead', waves.wave3.wave===3, waves);
 ok('wave 3 includes exactly one boss unit (the VEGA Core)', waves.wave3.hasBoss && waves.wave3.bossCount===1, waves);

 // ---------- no ordinary STAGE 1 reinforcement wave for the final battle ----------
 const noReinforcement = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   G.BT.el = G.waveTFor(G.BT.t)+50;   // well past the ordinary reinforcement threshold
   const totBefore=G.BT.tot, enBefore=G.BT.en.length;
   G.bUpdateWep(0.1);
   return { waveDone:G.BT.waveDone, totBefore, totAfter:G.BT.tot, enAfter:G.BT.en.length };
 }, {finalAdopt});
 ok('the final battle never sets the ordinary STAGE 1 waveDone flag', noReinforcement.waveDone===0, noReinforcement);
 ok('no STAGE 1 WAVE_ADD hostiles are added to the final battle', noReinforcement.totBefore===noReinforcement.totAfter &&
   noReinforcement.enAfter<=4+1, noReinforcement);

 // ---------- patch591b: the #bEsc "REINFORCEMENTS" escalation HUD strip must stay
 //            off for the whole final battle too, not just the spawn logic - found
 //            via this batch's own required screenshots (batchD2-01, before the
 //            fix, showed a live "REINFORCEMENTS · 90s" countdown over VEGA's Fleet
 //            for a wave that can now never arrive) ----------
 const escStrip = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   G.BT.el = G.waveTFor(G.BT.t)-1;   // deep inside where an ordinary fight would be counting down
   G.bDraw();
   const finalOn = document.getElementById('bEsc').classList.contains('on');
   G.closeBattle();
   const t={ti:0,name:"Ore Convoy",en:2,dif:1,secs:20,dmg:0.4};
   G.engageTarget(t,-1);
   G.BT.el = G.waveTFor(G.BT.t)-1;
   G.bDraw();
   const ordinaryOn = document.getElementById('bEsc').classList.contains('on');
   return { finalOn, ordinaryOn };
 }, {finalAdopt});
 ok('the REINFORCEMENTS escalation strip never shows during the final battle', escStrip.finalOn===false, escStrip);
 ok('an ordinary fight still shows the REINFORCEMENTS strip on its own countdown (regression guard)',
   escStrip.ordinaryOn===true, escStrip);

 // ---------- FINAL_CAP is respected (fake BT.el past it) - reads as a loss ----------
 const capTest = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   G.BT.el=G.FINAL_CAP+1;
   G.bUpdateWep(0.1);
   return { done:G.BT.done, end:G.S.end, resHTML:document.getElementById('bRes').innerHTML };
 }, {finalAdopt});
 ok('BT.el past FINAL_CAP ends the fight', capTest.done===1, capTest);
 ok('a FINAL_CAP timeout reads as a loss ("Fleet Broken"), per the plan', /Fleet Broken/.test(capTest.resHTML), capTest);
 ok('a FINAL_CAP timeout leaves S.end===1', capTest.end===1, capTest);

 // ---------- loss (hull 0): normal fleet-damage handling, S.end stays 1, ENGAGE
 //            returns (the pinned card is enabled again) ----------
 const lossReturn = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   const shBefore=G.S.sh.slice();
   G.BT.hp=0;
   G.bUpdateWep(0.1);
   const resHTML=document.getElementById('bRes').innerHTML;
   document.getElementById('bDone').click();
   G.gotoTab('p-raid'); G.render();
   const engageDisabled=document.getElementById('endEngage').disabled;
   return { end:G.S.end, btOpen:!!G.BT, shBefore, shAfter:G.S.sh, fhp:G.S.fhp, engageDisabled, resHTML };
 }, {finalAdopt});
 ok('a hull-0 loss applies the normal fleet-damage handling (ships lost)',
   lossReturn.shAfter.some((n,i)=>n<lossReturn.shBefore[i]), lossReturn);
 ok('a hull-0 loss reads as "Fleet Broken — VEGA\'s fleet still holds Sol Reach"',
   /Fleet Broken/.test(lossReturn.resHTML) && /Sol Reach/.test(lossReturn.resHTML), lossReturn);
 ok('loss keeps S.end===1 (repair and try again, not game over)', lossReturn.end===1, lossReturn);
 ok('RETURN TO EMPIRE closes the battle overlay', !lossReturn.btOpen, lossReturn);
 ok('after a loss, #endCard\'s ENGAGE is available again (subject to the hull/ship gate)',
   lossReturn.engageDisabled===false, lossReturn);

 // ---------- win: the Core breaking off (<25% hull) withdraws the whole fleet
 //            rather than dying - not destroyed, no more firing, no damage to the
 //            player during the withdraw beat, queueWin/timeout cannot fire ----------
 const withdraw = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   const boss=G.BT.boss; boss.shp=0;
   const other=G.BT.en.find(e=>e!==boss&&e.alive);
   const otherHpBefore=other.hp;
   const hpBefore=G.BT.hp;
   G.hitEnemy(G.BT.en.indexOf(boss), boss.max*0.8, 1);   // would be lethal several times over if not intercepted
   const rightAfterHit={ withdraw:G.BT.withdraw, bossAlive:boss.alive, done:G.BT.done };
   G.bUpdateWep(0.3);                  // mid-withdraw (FINAL_WITHDRAW_T is 1.5s)
   const midWithdraw={ done:G.BT.done, hp:G.BT.hp, otherAlive:other.alive, otherHp:other.hp, bossAlive:boss.alive };
   for(let i=0;i<20;i++)G.bUpdateWep(0.1);   // run the beat out (2s > FINAL_WITHDRAW_T)
   const finished={ done:G.BT.done, resHTML:document.getElementById('bRes').innerHTML };
   const endBefore=G.S.end;
   document.getElementById('bFinaleDone').click();
   return { rightAfterHit, hpBefore, otherHpBefore, midWithdraw, finished, endBefore, endAfter:G.S.end, btOpenAfter:!!G.BT };
 }, {finalAdopt});
 ok('the Core dropping below 25% hull triggers the withdraw', withdraw.rightAfterHit.withdraw===1, withdraw);
 ok('the Core is NOT killed by the breaking hit, even a massively overkill one', withdraw.rightAfterHit.bossAlive===1, withdraw);
 ok('the fight is not over the instant the withdraw starts (the beat has to play out)', withdraw.rightAfterHit.done===0, withdraw);
 ok('mid-withdraw: the fight still is not done (queueWin/timeout cannot fire mid-beat)', withdraw.midWithdraw.done===0, withdraw);
 ok('mid-withdraw: other hostiles are not destroyed, just flying out', withdraw.midWithdraw.otherAlive===1 &&
   withdraw.midWithdraw.otherHp===withdraw.otherHpBefore, withdraw);
 ok('mid-withdraw: the Core is still alive', withdraw.midWithdraw.bossAlive===1, withdraw);
 ok('mid-withdraw: the player takes NO damage (nothing fires during the withdraw)',
   withdraw.midWithdraw.hp===withdraw.hpBefore, withdraw);
 ok('the withdraw beat ends the fight once FINAL_WITHDRAW_T has elapsed', withdraw.finished.done===1, withdraw);
 ok('the win result card shows a single CONTINUE button, not the ordinary reward card',
   /bFinaleDone/.test(withdraw.finished.resHTML)===false /* button already stripped by the outerHTML we captured before click - check text instead */
   || /CONTINUE/.test(withdraw.finished.resHTML), withdraw);
 ok('CONTINUE calls the finaleWon() stub: S.end goes 1 -> 2', withdraw.endBefore===1 && withdraw.endAfter===2, withdraw);
 ok('CONTINUE also closes the battle overlay', !withdraw.btOpenAfter, withdraw);

 // ---------- allies: Vasht/Helion/Covenant join at waves 1/2/3, each with a toast ----------
 const alliesJoin = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   const w1=G.BT.allies.map(a=>a.rv);
   /* aimHint is pre-seen (finalAdopt), so finalAllyJoin(1)'s own toast is reliably
      the LAST toast right after wave 1 opens - same true for every later wave since
      finalSpawnWave() always calls finalAllyJoin() right after its own "WAVE n / 3"
      toast, with nothing after it. */
   const lastToastW1=[...document.querySelectorAll('#toasts .toast')].pop().textContent;
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   const w2=G.BT.allies.map(a=>a.rv);
   const lastToastW2=[...document.querySelectorAll('#toasts .toast')].pop().textContent;
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   const w3=G.BT.allies.map(a=>a.rv);
   const lastToastW3=[...document.querySelectorAll('#toasts .toast')].pop().textContent;
   return { w1, w2, w3, lastToastW1, lastToastW2, lastToastW3 };
 }, {finalAdopt});
 ok('Vasht joins at wave 1', JSON.stringify(alliesJoin.w1)===JSON.stringify(['vsh']), alliesJoin);
 ok('a "joins the line" toast fires for Vasht at wave 1', /joins the line/.test(alliesJoin.lastToastW1) &&
   /Vasht/.test(alliesJoin.lastToastW1), alliesJoin);
 ok('Helion joins at wave 2 (alongside Vasht, still with the fleet)', JSON.stringify(alliesJoin.w2)===JSON.stringify(['vsh','hel']), alliesJoin);
 ok('a "joins the line" toast fires for Helion at wave 2', /joins the line/.test(alliesJoin.lastToastW2) &&
   /Helion/.test(alliesJoin.lastToastW2), alliesJoin);
 ok('Covenant joins at wave 3 (all three now in the fight)', JSON.stringify(alliesJoin.w3)===JSON.stringify(['vsh','hel','cov']), alliesJoin);
 ok('a "joins the line" toast fires for the Covenant at wave 3', /joins the line/.test(alliesJoin.lastToastW3) &&
   /Covenant/.test(alliesJoin.lastToastW3), alliesJoin);

 // ---------- ally hits reduce hostile hp through the shared hitEnemy() path, and
 //            push a visible tracer fx ----------
 const allyDamage = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   for(const a of G.BT.allies)a.iv=0;   // force every ally to fire on the very next tick
   for(const e of G.BT.en)e.shp=0;      // shields already down, so the hit lands straight on hull
   const totBefore=G.BT.en.reduce((s,e)=>s+e.hp,0);
   G.bUpdateWep(0.05);
   const totAfter=G.BT.en.reduce((s,e)=>s+e.hp,0);
   const fx=G.BT.fx.filter(f=>f.t==='allyshot');
   return { totBefore, totAfter, fxCount:fx.length, fxHasCol:fx.every(f=>!!f.col) };
 }, {finalAdopt});
 ok('a forced ally tick reduces total hostile hp', allyDamage.totAfter<allyDamage.totBefore, allyDamage);
 ok('each ally hit pushes a visible "allyshot" tracer fx in the ally\'s own colour',
   allyDamage.fxCount>=1 && allyDamage.fxHasCol, allyDamage);

 // ---------- allies can never trigger loss and are never part of BT.en (the only
 //            list any win/loss check ever reads) ----------
 const alliesSeparate = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   const inEn=G.BT.en.some(e=>e.rv!==undefined || e.col!==undefined);
   return { inEn, allyCount:G.BT.allies.length, enCount:G.BT.en.length };
 }, {finalAdopt});
 ok('allies are a separate list (BT.allies), never mixed into BT.en', !alliesSeparate.inEn && alliesSeparate.allyCount===1, alliesSeparate);

 // ---------- during the withdraw, allies stop firing too ----------
 const alliesDuringWithdraw = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   const boss=G.BT.boss; boss.shp=0;
   G.hitEnemy(G.BT.en.indexOf(boss), boss.max*0.8, 1);   // starts the withdraw
   for(const a of G.BT.allies)a.iv=0;   // would fire immediately if allies were still ticking
   const totBefore=G.BT.en.reduce((s,e)=>s+(e.alive?e.hp:0),0);
   G.bUpdateWep(0.2);
   const totAfter=G.BT.en.reduce((s,e)=>s+(e.alive?e.hp:0),0);
   return { withdraw:G.BT.withdraw, totBefore, totAfter };
 }, {finalAdopt});
 ok('allies do not fire during the withdraw beat', alliesDuringWithdraw.withdraw===1 &&
   alliesDuringWithdraw.totAfter===alliesDuringWithdraw.totBefore, alliesDuringWithdraw);

 // ---------- ordinary raid engage: still no allies, still gets its own STAGE 1
 //            reinforcement wave - the final battle's changes are fully isolated ----------
 const ordinary = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:5, all:1e30, ore:1e30, sh:[50,0,0], wpow:[true,false,false,false,false,false,false]});
   const t={ti:0,name:"Ore Convoy",en:2,dif:1,secs:20,dmg:0.4};
   G.engageTarget(t,-1);
   const before={ alliesLen:G.BT.allies.length, mode:G.BT.mode, arch:G.BT.t.arch };
   G.BT.el=G.waveTFor(G.BT.t)+1;
   G.bUpdateWep(0.1);
   const after={ waveDone:G.BT.waveDone, enCount:G.BT.en.length, tot:G.BT.tot };
   return { before, after };
 });
 ok('an ordinary raid still opens with an empty BT.allies list', ordinary.before.alliesLen===0, ordinary);
 ok('an ordinary raid is not accidentally tagged "mirror"/final', ordinary.before.arch!=='mirror', ordinary);
 ok('an ordinary raid still gets its own STAGE 1 reinforcement wave (WAVE_ADD hostiles)',
   ordinary.after.waveDone===1 && ordinary.after.enCount>2, ordinary);

 // ---------- patch591c (D2 review): mirror colour, ally size/position, STORY copy ----------
 const p591c = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   // wave-1 hostiles all draw in the one mirror colour, never the ordinary per-kind one
   const html=document.documentElement.outerHTML;
   const colOk = html.includes('(BT.t&&BT.t.final)?"#ff4d5e"');
   // allies now draw at fr (player-ship scale), tightly clustered off to one side -
   // not the old ar=fr*0.62 spread across the full row width.
   const x0=G.allyRowX(0,3), x1=G.allyRowX(1,3), x2=G.allyRowX(2,3);
   const spacing=Math.abs(x1-x0);
   return { colOk, x0, x1, x2, spacing,
     storyKeys: { battleWinT:G.STORY.battleWinT, battleWin:G.STORY.battleWin,
       battleLossT:G.STORY.battleLossT, battleLoss:G.STORY.battleLoss,
       battleWave:G.STORY.battleWave, allyJoin:G.STORY.allyJoin } };
 }, {finalAdopt});
 ok('final-battle hostiles draw with the patch591c mirror-red override in the shape chain',
   p591c.colOk, p591c.colOk);
 ok('ally ships are tightly clustered (neighbour spacing well under a full row-width step), not spread across BW',
   p591c.spacing>0 && p591c.spacing<60, p591c);
 ok('STORY carries the new battle-copy placeholder keys (win/loss title+sub, wave banner, ally join)',
   typeof p591c.storyKeys.battleWinT==='string' && typeof p591c.storyKeys.battleWin==='string' &&
   typeof p591c.storyKeys.battleLossT==='string' && typeof p591c.storyKeys.battleLoss==='string' &&
   p591c.storyKeys.battleWave.includes('{n}') && p591c.storyKeys.allyJoin.includes('{rival}'), p591c.storyKeys);

 const p591cLoss = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   G.BT.el=G.FINAL_CAP+1; G.bUpdateWep(0.1);   // timeout -> endFinalBattle("lost")
   const lossHtml=document.getElementById('bRes').innerHTML;
   return { lossHasText:lossHtml.includes(G.STORY.battleLossT)&&lossHtml.includes(G.STORY.battleLoss) };
 }, {finalAdopt});
 ok('the loss result card renders STORY.battleLossT/battleLoss, not a hardcoded literal',
   p591cLoss.lossHasText, p591cLoss);

 const p591cWin = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   const boss=G.BT.boss; boss.shp=0;
   G.hitEnemy(G.BT.en.indexOf(boss), boss.max*0.8, 1);
   G.BT.withdrawT=99; G.bUpdateWep(0.1);
   const winHtml=document.getElementById('bRes').innerHTML;
   return { winHasText:winHtml.includes(G.STORY.battleWinT)&&winHtml.includes(G.STORY.battleWin) };
 }, {finalAdopt});
 ok('the win result card renders STORY.battleWinT/battleWin, not a hardcoded literal',
   p591cWin.winHasText, p591cWin);


 // ==================================================================
 // ============ D3 (patch591d/592/593): ending + free play ==========
 // ==================================================================
 // Covers the plan's own list for 592/593: finaleWon() sets S.end=2 and shows the
 // ending overlay; stats values match state; CONTINUE closes it; Nexus multipliers
 // return at 2; pjx card shows COMPLETE and reopens the ending; no VEGA notices at
 // 2; no threats/sabotage/LF at 2 after a large amount of simulated time online and
 // offline; every former rival system is claimable with ore (claimSystem works at
 // enough ore + level) and has no assault path; occupied systems returned; save/
 // reload at 2 keeps peace and doesn't replay the ending; RESET ENDING restores
 // GARRISON ownership and rival activity; the withdraw fix (patch591d - no hostile
 // y above the canvas top during withdraw); tchurn2 (run separately, see HANDOVER)
 // still 0.

 // ---------- finaleWon() sets S.end=2 and opens the ending overlay; endStats()
 //            values match the live state ----------
 const winCheck = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:37, lvSeen:37, all:123456789, wins:7, ac:{a1:1,a5:1,a11:1},
     sys:{ home:{b:{}}, kor:{b:{}} }, t0: Date.now()-3661000 });
   const before=G.S.end;
   G.finaleWon();
   const st=G.endStats();
   const sceneEl=document.getElementById('endScene');
   return {
     before, after:G.S.end, endOn:G.endOn,
     sceneOn: !!sceneEl && sceneEl.classList.contains('on'),
     lvlOk: st.lvl===37,
     heldOk: st.held===G.heldSystems().length && st.total===(G.SYS.length-1),
     allOk: st.all===G.fmt(G.S.all),
     winsOk: st.wins===7,
     recordsOk: st.records===3,
     timeLooksReal: st.time!=='—' && /\d/.test(st.time),
   };
 });
 ok('finaleWon() sets S.end=2', winCheck.before===0 && winCheck.after===2, winCheck);
 ok('finaleWon() opens the ending overlay (G.endOn and #endScene.on both true)',
   winCheck.endOn===true && winCheck.sceneOn===true, winCheck);
 ok('endStats().lvl reads the real level', winCheck.lvlOk, winCheck);
 ok('endStats().held/total matches heldSystems().length / (SYS.length-1)', winCheck.heldOk, winCheck);
 ok('endStats().all matches fmt(S.all)', winCheck.allOk, winCheck);
 ok('endStats().wins matches S.wins', winCheck.winsOk, winCheck);
 ok('endStats().records matches Object.keys(S.ac).length', winCheck.recordsOk, winCheck);
 ok('endStats().time is a real duration string when S.t0 is a known timestamp', winCheck.timeLooksReal, winCheck);

 // ---------- S.t0 back-fill: an old save with no t0 gets null ("unknown"),
 //            endStats() shows the em-dash rather than guessing ----------
 const unknownTime = await p.evaluate(()=>{
   const G=window.__SD;
   const o={...G.fresh()}; delete o.t0;
   G.adopt(o);
   return { t0:G.S.t0, time:G.endStats().time };
 });
 ok('a save with no t0 back-fills S.t0=null (unknown), not adopt()\'s own fresh()-supplied "now"',
   unknownTime.t0===null, unknownTime);
 ok('endStats().time shows the em-dash placeholder when S.t0 is unknown', unknownTime.time==='—', unknownTime);

 // ---------- STORY carries the ending screen's own placeholder keys, and each
 //            stage renders its own correct content ----------
 const storyAndStages = await p.evaluate(()=>{
   const G=window.__SD;
   return {
     keys: { endTitle:G.STORY.endTitle, endStrip:G.STORY.endStrip, endLast:G.STORY.endLast, endTbc:G.STORY.endTbc },
     s0: G.endStageHTML(0).includes(G.STORY.endTitle),
     s1: /Time played/.test(G.endStageHTML(1)) && /Records/.test(G.endStageHTML(1)),
     s2: G.endStageHTML(2).includes(G.STORY.endStrip),
     s3: G.endStageHTML(3).includes(G.STORY.endLast),
     s4: G.endStageHTML(4).includes(G.STORY.endTbc),
   };
 });
 ok('STORY carries the ending screen\'s placeholder keys (endTitle/endStrip/endLast/endTbc)',
   typeof storyAndStages.keys.endTitle==='string' && typeof storyAndStages.keys.endStrip==='string' &&
   typeof storyAndStages.keys.endLast==='string' && typeof storyAndStages.keys.endTbc==='string', storyAndStages);
 ok('each ending stage (title/stats/strip/endLast/endTbc) renders its own correct content',
   storyAndStages.s0 && storyAndStages.s1 && storyAndStages.s2 && storyAndStages.s3 && storyAndStages.s4, storyAndStages);

 // ---------- tap-to-advance steps through every stage; SKIP jumps straight to the
 //            final CONTINUE stage; CONTINUE closes the overlay ----------
 const advanceCheck = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), end:2});
   G.showEnding();
   const stages=[G.endStage];
   for(let i=0;i<6;i++){ G.endAdvance(); stages.push(G.endStage); }
   return { stages, lastStage:G.END_STAGES-1 };
 });
 ok('tap-to-advance (endAdvance) steps through every stage 0..last and then stays there',
   advanceCheck.stages[0]===0 && advanceCheck.stages[advanceCheck.stages.length-1]===advanceCheck.lastStage &&
   Math.max(...advanceCheck.stages)===advanceCheck.lastStage, advanceCheck);
 const skipCheck = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), end:2});
   G.showEnding();
   const stage0=G.endStage;
   document.getElementById('endSkip').click();
   return { stage0, stageAfterSkip:G.endStage, lastStage:G.END_STAGES-1,
     continueVisible: !document.getElementById('endContinue').hidden };
 });
 ok('SKIP jumps straight to the final CONTINUE stage', skipCheck.stage0===0 &&
   skipCheck.stageAfterSkip===skipCheck.lastStage && skipCheck.continueVisible, skipCheck);
 const continueCheck = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), end:2});
   G.showEnding();
   const openOn=G.endOn;
   G.endSkip();
   document.getElementById('endContinue').click();
   return { openOn, closedOn:G.endOn };
 });
 ok('CONTINUE closes the ending overlay (G.endOn goes back to false)',
   continueCheck.openOn===true && continueCheck.closedOn===false, continueCheck);

 // ---------- Nexus multipliers return to their real levels once S.end===2 (not
 //            only after a RESET ENDING - the win itself un-suspends them) ----------
 const nexReturn = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   const ids=['ent','chr','ovs','syn','war','pj1','pj2','pj3'];
   const realLv={}; for(const id of ids) realLv[id]=G.nexLv(id);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));   // S.end -> 1 (seized)
   const seizedLv={}; for(const id of ids) seizedLv[id]=G.nexLv(id);
   G.finaleWon();   // S.end -> 2 (won)
   const afterWin={}; for(const id of ids) afterWin[id]=G.nexLv(id);
   return { ids, realLv, seizedLv, afterWin };
 }, {baseAdopt,grantAll});
 for(const id of nexReturn.ids){
   ok(`nexLv('${id}') is seized (0) at S.end===1 (sanity)`, nexReturn.seizedLv[id]===0, {id});
   ok(`nexLv('${id}') returns to its real level once S.end===2 (the win itself, not only RESET ENDING)`,
     nexReturn.afterWin[id]===nexReturn.realLv[id], {id, real:nexReturn.realLv[id], after:nexReturn.afterWin[id]});
 }

 // ---------- the pjx card shows COMPLETE at S.end===2 and reopens the ending ----------
 const pjxComplete = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.S.en=5000; G.buyNex(G.NEXUS.find(x=>x.id==='pjx'));
   G.finaleWon();
   G.endClose();   // dismiss the auto-opened ending so reopening-via-the-card can be tested cleanly
   G.gotoTab('p-nex'); G.renderNex();
   const card=[...document.querySelectorAll('#nex .card')].find(c=>c.innerHTML.includes('COMPLETE'));
   const html=card?card.innerHTML:null;
   const endOnBefore=G.endOn;
   if(card)card.querySelector('button').click();
   return { hadCard:!!card, html, endOnBefore, endOnAfter:G.endOn };
 }, {baseAdopt,grantAll});
 ok('the pjx card shows a COMPLETE state once S.end===2 (not MAXED)', pjxComplete.hadCard, pjxComplete);
 ok('the pjx COMPLETE card reads "VIEW ENDING"', pjxComplete.html && pjxComplete.html.includes('VIEW ENDING'), pjxComplete);
 ok('tapping the pjx COMPLETE card reopens the ending screen',
   !pjxComplete.endOnBefore && pjxComplete.endOnAfter===true, pjxComplete);

 // ---------- no VEGA notice can queue at S.end===2 ----------
 const noVega2 = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), end:2});
   const before=(G.S.notifyQueue||[]).length;
   G.queueNotice('vega:drift65');
   return { before, after:(G.S.notifyQueue||[]).length };
 });
 ok('queueNotice() refuses a "vega:" key outright at S.end===2', noVega2.before===noVega2.after, noVega2);

 // ---------- rivals quiet at S.end===2: no new threats/sabotage/expansion/live
 //            fleet even after a large amount of simulated time, online AND
 //            offline, every roll forced to "succeed" if the path were reachable -
 //            reached this time via finaleWon() directly (the dev-equivalent of
 //            WIN FINALE), not by playing the turn/fight through first ----------
 const quiet2 = await p.evaluate(({baseAdopt,grantAll})=>{
   const G=window.__SD;
   eval(baseAdopt); eval(grantAll);
   G.finaleWon();
   for(const id of G.RVACT){ G.rvOf(id).p=G.RV_MAX; G.rvOf(id).cd=0; G.rvOf(id).mv=G.RIVAL_MOVE_CAP; }
   G.S.thrCd=0; G.S.en=1e6;
   const orig=Math.random; Math.random=()=>0;
   G.rvMaybeThreat();
   const thqAfterThreat=G.thq().length;
   G.rvMaybeExpand(999999);
   const lostAfterExpand=Object.keys(G.S.lost||{}).length;
   G.rvMoveAway(999999);
   const occAfterMove=Object.keys(G.S.occ||{}).length;
   G.lfMaybeLaunch(1);
   const lfAfterDirect=G.LF;
   for(let i=0;i<200;i++) G.rvTick(3600);   // 200 simulated hours, online tick path
   const thqAfterTick=G.thq().length, lfAfterTick=G.LF;
   G.rvExpandAway(999999);   // offline expansion catch-up
   const lostAfterOfflineExpand=Object.keys(G.S.lost||{}).length;
   Math.random=orig;
   return { end:G.S.end, thqAfterThreat, lostAfterExpand, occAfterMove, lfAfterDirect,
     thqAfterTick, lfAfterTick, lostAfterOfflineExpand };
 }, {baseAdopt,grantAll});
 ok('finaleWon() called directly (skipping the fight) reaches S.end===2', quiet2.end===2, quiet2);
 ok('rvMaybeThreat() spawns nothing at S.end===2, even with the sab roll forced', quiet2.thqAfterThreat===0, quiet2);
 ok('rvMaybeExpand() takes no system at S.end===2', quiet2.lostAfterExpand===0, quiet2);
 ok('rvMoveAway() (offline action budget) occupies nothing at S.end===2', quiet2.occAfterMove===0, quiet2);
 ok('lfMaybeLaunch() starts no live fleet at S.end===2', quiet2.lfAfterDirect===null, quiet2);
 ok('200 simulated hours of rvTick() spawn no threat at S.end===2', quiet2.thqAfterTick===0, quiet2);
 ok('200 simulated hours of rvTick() start no live fleet at S.end===2', quiet2.lfAfterTick===null, quiet2);
 ok('rvExpandAway() (offline expansion catch-up) takes no system at S.end===2', quiet2.lostAfterOfflineExpand===0, quiet2);

 // ---------- peace: EVERY GARRISON system loses owner/def/arch, reads sysOpen(),
 //            and has no assault path - not just one spot-checked system ----------
 const allGarrisonClear = await p.evaluate(()=>{
   const G=window.__SD;
   G.revertPeace();   // known baseline regardless of what ran earlier in this file
   const ids=Object.keys(G.GARRISON);
   const before={}; for(const id of ids) before[id]=G.SYSMAP[id].owner;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, end:2});
   const after={}, openNow={}, assaultNow={}, contestedNow={};
   for(const id of ids){
     const s=G.SYSMAP[id];
     after[id]=s.owner; openNow[id]=G.sysOpen(s); assaultNow[id]=G.canAssault(s);
     contestedNow[id]=G.sysContested(s);
   }
   return { ids, before, after, openNow, assaultNow, contestedNow };
 });
 ok('every GARRISON system starts rival-owned before peace (sanity)',
   allGarrisonClear.ids.every(id=>allGarrisonClear.before[id]!=null), allGarrisonClear);
 ok('peace clears EVERY GARRISON system\'s owner (not just one spot-checked system)',
   allGarrisonClear.ids.every(id=>allGarrisonClear.after[id]==null), allGarrisonClear);
 ok('every former GARRISON system reads sysOpen()===true after peace',
   allGarrisonClear.ids.every(id=>allGarrisonClear.openNow[id]===true), allGarrisonClear);
 ok('no former GARRISON system is sysContested() or canAssault() after peace',
   allGarrisonClear.ids.every(id=>!allGarrisonClear.contestedNow[id] && !allGarrisonClear.assaultNow[id]), allGarrisonClear);

 // ---------- claimSystem() genuinely works end-to-end on a former GARRISON system
 //            (the ore + level gate, not only the sysOpen() flag) ----------
 const peaceClaim = await p.evaluate(()=>{
   const G=window.__SD;
   G.revertPeace();
   const s=G.SYSMAP.tan;   // ring1, vsh-garrisoned before peace
   const before={ owner:s.owner, def:s.def, arch:s.arch };
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, ore:0, end:2});
   const tooPoor=G.claimSystem(s);   // must fail - S.ore is still 0
   G.S.ore=s.cost;
   const claimed=G.claimSystem(s);
   return { before, tooPoor, claimed, heldAfter:G.sysHeld('tan'), costWas:s.cost };
 });
 ok('tan really is rival-owned (GARRISON) before peace (sanity)', peaceClaim.before.owner==='vsh', peaceClaim);
 ok('claimSystem() still refuses below the ore cost, even once peace makes it open', !peaceClaim.tooPoor, peaceClaim);
 ok('claimSystem() succeeds at exactly the ore cost + level gate, same as any ordinary system',
   peaceClaim.claimed && peaceClaim.heldAfter, peaceClaim);

 // ---------- occupied systems return to the player immediately ----------
 const occReturn = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99,
     sys:{ home:{b:{}}, kor:{b:{}} }, occ:{kor:'hel'}, occAt:{kor:Date.now()} });
   const heldBefore=G.sysHeld('kor'), occBefore=!!G.S.occ.kor;
   G.finaleWon();
   return { heldBefore, occBefore, heldAfter:G.sysHeld('kor'),
     occAfter:Object.keys(G.S.occ||{}).length, thqAfter:(G.S.thq||[]).length };
 });
 ok('a rival-occupied system is NOT held before peace (sanity)', !occReturn.heldBefore && occReturn.occBefore, occReturn);
 ok('peace clears S.occ/S.occAt - an occupied system returns to the player immediately',
   occReturn.heldAfter===true && occReturn.occAfter===0, occReturn);

 // ---------- #endCard and Sol Reach's map marker stay gone at S.end===2 (already
 //            S.end===1-only per patch589's own header - confirmed here for 2) ----------
 const endCardGone = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:10, end:2, sys:{ home:{b:{}} } });
   G.gotoTab('p-raid'); G.renderEndCard();
   const endCardHTML=document.getElementById('endCard').innerHTML;
   G.gotoTab('p-map'); G.setMapSec(0); G.render();
   const homeIncoming=document.querySelector('#mapNodes .mnode[data-s="home"]').classList.contains('incoming');
   return { endCardHTML, homeIncoming };
 });
 ok('#endCard is empty at S.end===2', endCardGone.endCardHTML==='', endCardGone);
 ok('Sol Reach\'s map node is not marked incoming at S.end===2', !endCardGone.homeIncoming, endCardGone);

 // ---------- the Raids "Rival pressure" section (heading included) hides once
 //            S.end>=1, per the plan's own wording for this patch ----------
 const pressureHide = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:60});   // rvAwake() true, S.end=0 - pressure visible
   G.gotoTab('p-raid'); G.render();
   const visibleAt0=!document.getElementById('rvPressureWrap').hidden;
   G.S.end=2; G.renderRivalBars();
   const hiddenAt2=document.getElementById('rvPressureWrap').hidden;
   const barsEmpty=document.getElementById('rvBars').innerHTML==='';
   return { visibleAt0, hiddenAt2, barsEmpty };
 });
 ok('Rival pressure is visible at S.end===0 once rivals are awake (sanity)', pressureHide.visibleAt0, pressureHide);
 ok('the whole Rival pressure section (heading included) hides once S.end>=1', pressureHide.hiddenAt2 && pressureHide.barsEmpty, pressureHide);

 // ---------- save/reload at S.end===2: keeps peace, does not replay the ending ----------
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:44, lvSeen:44, all:999, wins:2, sys:{ home:{b:{}} } });
   G.finaleWon();   // S.end -> 2, peace applied, ending shown
   G.endClose();    // the player dismisses it themselves, same as any real session
   G.save();
 });
 await p.reload(); await p.waitForTimeout(500);
 const reloadEnd2 = await p.evaluate(()=>{
   const G=window.__SD;
   const s=G.SYSMAP.tan;
   return {
     end:G.S.end, endOn:G.endOn,
     sceneDisplay:getComputedStyle(document.getElementById('endScene')).display,
     tanOwner:s.owner,
   };
 });
 ok('a reload at S.end===2 keeps S.end===2', reloadEnd2.end===2, reloadEnd2);
 ok('a reload at S.end===2 does not replay the ending screen', reloadEnd2.endOn===false && reloadEnd2.sceneDisplay==='none', reloadEnd2);
 ok('a reload at S.end===2 keeps peace (a GARRISON system\'s owner is still cleared)', reloadEnd2.tanOwner==null, reloadEnd2);

 // ---------- RESET ENDING (dev) restores GARRISON ownership and rival activity ----------
 const resetUndo = await p.evaluate(({baseAdopt})=>{
   const G=window.__SD;
   G.revertPeace();
   eval(baseAdopt);
   const s=G.SYSMAP.tan;
   const garrisonOwner={ owner:s.owner, def:s.def, arch:s.arch };
   G.devAction('winFinale');
   const afterWin={ end:G.S.end, owner:s.owner };
   G.devAction('resetEnding');
   const afterReset={ end:G.S.end, owner:s.owner, def:s.def, arch:s.arch, pjx:(G.S.nx&&G.S.nx.pjx)||0 };
   // rival activity resumes: force everything maximally "ready to fire" and confirm
   // rvMaybeThreat() can actually queue now (it could not moments ago, at S.end 1/2)
   for(const id of G.RVACT){ G.rvOf(id).p=G.RV_MAX; G.rvOf(id).cd=0; }
   G.S.thrCd=0;
   const orig=Math.random; Math.random=()=>0;
   G.rvMaybeThreat();
   Math.random=orig;
   return { garrisonOwner, afterWin, afterReset, thqAfter:G.thq().length };
 }, {baseAdopt});
 ok('tan really is rival-owned (GARRISON) before any of this (sanity)', resetUndo.garrisonOwner.owner==='vsh', resetUndo);
 ok('DEV WIN FINALE sets S.end=2 and clears tan\'s owner (peace applied)',
   resetUndo.afterWin.end===2 && resetUndo.afterWin.owner==null, resetUndo);
 ok('DEV RESET ENDING sets S.end back to 0', resetUndo.afterReset.end===0, resetUndo);
 ok('DEV RESET ENDING restores tan\'s GARRISON owner/def/arch exactly',
   resetUndo.afterReset.owner===resetUndo.garrisonOwner.owner &&
   resetUndo.afterReset.def===resetUndo.garrisonOwner.def &&
   resetUndo.afterReset.arch===resetUndo.garrisonOwner.arch, resetUndo);
 ok('DEV RESET ENDING clears S.nx.pjx (the turn can be re-triggered)', resetUndo.afterReset.pjx===0, resetUndo);
 ok('rival activity resumes after RESET ENDING (rvMaybeThreat can queue a threat again)',
   resetUndo.thqAfter>0, resetUndo);

 // ---------- the other three new dev buttons: GIVE 2000 NODES, HOLD NYX, SHOW ENDING ----------
 const devButtons = await p.evaluate(({baseAdopt})=>{
   const G=window.__SD;
   G.revertPeace();
   eval(baseAdopt);
   G.S.sys={ home:{b:{}} };   // strip Nyx so HOLD NYX has something to do
   const nyxHeldBefore=G.sysHeld('nyx');
   const enBefore=G.S.en||0;
   G.devAction('giveNodes');
   const enAfter=G.S.en;
   G.devAction('holdNyx');
   const nyxHeldAfter=G.sysHeld('nyx');
   const endBefore=G.S.end;
   G.devAction('showEnding');
   const shownWithoutEndChange=G.endOn===true && G.S.end===endBefore;
   G.endClose();
   return { enBefore, enAfter, nyxHeldBefore, nyxHeldAfter, shownWithoutEndChange };
 }, {baseAdopt});
 ok('DEV GIVE 2000 NODES adds exactly 2000 to S.en', devButtons.enAfter===devButtons.enBefore+2000, devButtons);
 ok('DEV HOLD NYX claims Nyx (sysHeld("nyx") becomes true)', !devButtons.nyxHeldBefore && devButtons.nyxHeldAfter, devButtons);
 ok('DEV SHOW ENDING opens the ending screen without touching S.end (preview only, like REPLAY INTRO)',
   devButtons.shownWithoutEndChange, devButtons);

 // ---------- patch591d: during the withdraw beat, no hostile's y drifts above the
 //            canvas top (the old bug - e.y-=dt*0.55 - could carry it there); the
 //            fix carries hostiles to the RIGHT instead ----------
 const withdrawFix = await p.evaluate(({finalAdopt})=>{
   const G=window.__SD; eval(finalAdopt);
   G.startFinalBattle();
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   for(const e of G.BT.en)e.alive=0; G.bUpdateWep(0.1); G.bUpdateWep(5);
   const boss=G.BT.boss; boss.shp=0;
   G.hitEnemy(G.BT.en.indexOf(boss), boss.max*0.8, 1);   // starts the withdraw
   const start=G.BT.en.map(e=>({x:e.x,y:e.y,alive:e.alive}));
   let minY=Math.min(...start.filter(s=>s.alive).map(s=>s.y));
   const steps=Math.ceil((G.FINAL_WITHDRAW_T+0.5)/0.1);
   for(let i=0;i<steps;i++){
     G.bUpdateWep(0.1);
     for(const e of G.BT.en){ if(e.alive)minY=Math.min(minY,e.y); }
   }
   const end=G.BT.en.map(e=>({x:e.x,y:e.y,alive:e.alive}));
   let movedRight=0, aliveAtStart=0;
   for(let i=0;i<start.length;i++){
     if(!start[i].alive)continue;
     aliveAtStart++;
     if(end[i].x>start[i].x+0.3)movedRight++;
   }
   return { minY, movedRight, aliveAtStart };
 }, {finalAdopt});
 ok('during the withdraw beat no hostile\'s y ever drifts above the canvas top (min y stays >-0.02)',
   withdrawFix.minY>-0.02, withdrawFix);
 ok('the withdraw motion now carries every surviving hostile well to the right (x advances by >0.3) instead',
   withdrawFix.aliveAtStart>0 && withdrawFix.movedRight===withdrawFix.aliveAtStart, withdrawFix);

 // ==================================================================
 // ---- end of D3 (patch591d/592/593) section - end of the batch. ----
 // ==================================================================

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 const fails=out.filter(l=>l.startsWith('FAIL')).length;
 console.log(fails+' failures');
 console.log(errs.length?('JS ERRORS: '+errs.join(' | ')):'NO JS ERRORS');
 await b.close();
})();
