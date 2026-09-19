const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tsabotage2.js — PLAN-ending.md Batch C: rival sabotage (patches 586-588). Covers the
// plan's own test list for 588: no sabotage before pj1, sabotage can target home once
// eligible, a loss steals exactly SAB_STEAL (25%) of banked S.en, a win steals nothing,
// a sabotage never occupies (holdResolve() and endDefence(), both roads), save/load
// keeps a live sab threat, the old-save sanitiser still strips any non-sab entry naming
// home, and S.end>0 stops new sabotage from being chosen even when every other
// condition is met. Also checks thqPrune() never drops a live sab entry, holdOdds()'s
// "best held garrison falls back to defend home" fallback, and patch587's copy (threat
// card text/class, rival:rvSab queued on the first sabotage).
//
// The SAB_CHANCE roll is a real Math.random() call, deliberately (see patch586's own
// header: it is hard-gated behind pj1+S.en+S.end so csim4.js never reaches it at all,
// which is safer than a save-keyed hash for something that only ever needs to read
// "genuinely random" to a live player). Tests that need a deterministic outcome
// override Math.random for the one call and restore it immediately after, all inside
// a single page.evaluate() so nothing else on the page ever sees the override.
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

 // shared setup: one held ring-1 system (a valid rvTargetFor target), both rivals
 // primed to fire immediately, S.thrCd clear. Returns nothing - each test adopts fresh.
 const baseAdopt = `G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, kor:{b:{}} },
     rv:{ hel:{p:G.RV_MAX,cd:0,seen:1,w:100,mv:G.RIVAL_MOVE_CAP}, cov:{p:0,cd:9e9,seen:1,w:0,mv:G.RIVAL_MOVE_CAP} } });`;

 // ---------- gating: no sabotage before pj1 is owned ----------
 const noPj1 = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.en=1000; G.S.end=0;                 // everything else eligible...
   // ...except pj1, which is never bought here
   const orig=Math.random; Math.random=()=>0;   // would-be sab roll always "succeeds" if reached
   G.rvMaybeThreat();
   Math.random=orig;
   const th=G.thq()[0];
   return { count:G.thq().length, kind:th&&th.kind, sysId:th&&th.sysId };
 }, baseAdopt);
 ok('no sabotage before pj1 is owned, even with S.en huge and Math.random forced low',
   noPj1.count===1 && noPj1.kind!=="sab" && noPj1.sysId==="kor", noPj1);

 // ---------- gating: S.en below SAB_EN_MIN blocks it too ----------
 const lowEn = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.nx={pj1:1}; G.S.en=G.SAB_EN_MIN-1; G.S.end=0;
   const orig=Math.random; Math.random=()=>0;
   G.rvMaybeThreat();
   Math.random=orig;
   const th=G.thq()[0];
   return { kind:th&&th.kind, en:G.S.en, min:G.SAB_EN_MIN };
 }, baseAdopt);
 ok('S.en below SAB_EN_MIN also blocks sabotage', lowEn.kind!=="sab", lowEn);

 // ---------- sabotage CAN target home once pj1 owned + S.en>=SAB_EN_MIN + S.end===0 ----------
 const canSab = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.nx={pj1:1}; G.S.en=1000; G.S.end=0;
   const orig=Math.random; Math.random=()=>0;
   G.rvMaybeThreat();
   Math.random=orig;
   const th=G.thq()[0];
   return { count:G.thq().length, kind:th&&th.kind, sysId:th&&th.sysId, hasDif:typeof (th&&th.dif)==="number" };
 }, baseAdopt);
 ok('sabotage can target home once pj1 is owned, S.en>=SAB_EN_MIN, S.end===0',
   canSab.count===1 && canSab.kind==="sab" && canSab.sysId==="home" && canSab.hasDif, canSab);

 // ---------- S.end>0 stops new sabotage (Batch D stops rivals outright; this patch
 //            only has to gate the sab branch itself) ----------
 const endStops = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.nx={pj1:1}; G.S.en=1000; G.S.end=1;
   const orig=Math.random; Math.random=()=>0;
   G.rvMaybeThreat();
   Math.random=orig;
   const th=G.thq()[0];
   return { kind:th&&th.kind, sysId:th&&th.sysId };
 }, baseAdopt);
 ok('S.end>0 stops new sabotage even with everything else eligible and the roll forced',
   endStops.kind!=="sab" && endStops.sysId!=="home", endStops);

 // ---------- thqPrune() never drops a live sab entry (home is never sysHeld()) ----------
 const pruneSurvives = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.thq().push({id:99, rv:'hel', sysId:'home', dif:1, t:100, kind:'sab'});
   G.thqPrune();
   return { count:G.thq().length, survives:!!G.thqAt(99) };
 }, baseAdopt);
 ok('thqPrune() does not drop a live sab entry targeting home',
   pruneSurvives.survives===true, pruneSurvives);

 // ---------- holdOdds(): "best held garrison falls back to defend home" ----------
 // Re-pointed for PLAN-defences.md Run 2 (patch597): S.sd/bestHeldSdLv() are gone -
 // fortify the one held system with real modules (Turret Ring to level 2, a Shield
 // Array) and check the fallback against bestHeldDefStrength()/defStrength() instead.
 const oddsFallback = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   const th={id:1, rv:'hel', sysId:'home', dif:1, kind:'sab'};
   const oddsNoGarrison=G.holdOdds(th);
   const s=G.SYSMAP.kor;
   G.S.exo={ir:1e6,he:1e6,xe:1e6,am:1e6};   // dmodBuild() needs real exotic to spend
   G.dmodBuild(s,0,'tur'); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();
   G.dmodUpgrade(s,0); G.S.def.kor.s[0].q.dueAt=Date.now()-1; G.dmodComplete();   // tur -> level 2
   G.dmodBuild(s,1,'shd'); G.S.def.kor.s[1].q.dueAt=Date.now()-1; G.dmodComplete();
   const oddsWithGarrison=G.holdOdds(th);
   return { oddsNoGarrison, oddsWithGarrison, best:G.bestHeldDefStrength(), korStrength:G.defStrength('kor') };
 }, baseAdopt);
 ok('holdOdds() for a sab threat rises with the best held system\'s own defStrength()',
   oddsFallback.oddsWithGarrison>oddsFallback.oddsNoGarrison && oddsFallback.best===oddsFallback.korStrength && oddsFallback.best>0, oddsFallback);
 ok('holdOdds() for a sab threat with nothing fortified still returns a sane 0.05-0.95 value',
   oddsFallback.oddsNoGarrison>=0.05 && oddsFallback.oddsNoGarrison<=0.95, oddsFallback);

 // ---------- holdResolve(): a LOSS steals exactly SAB_STEAL (25%) of banked S.en ----------
 const lossOnline = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.en=100;
   const th={id:1, rv:'hel', sysId:'home', dif:1, kind:'sab', t:100};
   const orig=Math.random; Math.random=()=>0.999;   // guaranteed loss - odds max out at 0.95
   const res=G.holdResolve(th, false, true, false);
   Math.random=orig;
   return { res, enAfter:G.S.en, occHome:G.S.occ&&G.S.occ.home };
 }, baseAdopt);
 ok('a lost sabotage (online) steals exactly floor(SAB_STEAL*S.en)',
   lossOnline.res.won===false && lossOnline.res.sab===25 && lossOnline.enAfter===75, lossOnline);
 ok('a lost sabotage never occupies home (S.occ.home stays unset)',
   lossOnline.occHome===undefined, lossOnline);
 ok('a lost sabotage never sets res.occ', lossOnline.res.occ===false, lossOnline);

 // ---------- holdResolve(): "same rule online and offline" - offline does not force a loss ----------
 const lossOffline = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.en=100;
   const th={id:1, rv:'hel', sysId:'home', dif:1, kind:'sab', t:-10};
   const orig=Math.random; Math.random=()=>0;   // guaranteed WIN if the roll is actually taken offline
   const res=G.holdResolve(th, true, true, /*offline*/true);
   Math.random=orig;
   return { res, enAfter:G.S.en };
 }, baseAdopt);
 ok('an offline sab resolution rolls the odds too, instead of auto-losing like an ordinary system',
   lossOffline.res.won===true && lossOffline.enAfter===100, lossOffline);

 // ---------- holdResolve(): a WIN steals nothing ----------
 const winOnline = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.en=100;
   const th={id:1, rv:'hel', sysId:'home', dif:1, kind:'sab', t:100};
   const orig=Math.random; Math.random=()=>0;   // guaranteed win
   const res=G.holdResolve(th, false, true, false);
   Math.random=orig;
   return { res, enAfter:G.S.en };
 }, baseAdopt);
 ok('a won sabotage steals nothing (S.en unchanged)', winOnline.res.won===true && winOnline.enAfter===100, winOnline);
 ok('a won sabotage reports sab:0', winOnline.res.sab===0, winOnline);

 // ---------- endDefence(): the DEFEND-it-yourself road resolves the same way ----------
 const defenceLoss = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.en=200;
   G.thq().push({id:5, rv:'hel', sysId:'home', dif:1, t:100, kind:'sab'});
   const started=G.startDefence(5);
   const dtSab=G.DT&&G.DT.sab, dtSd=G.DT&&G.DT.sd, dtName=G.DT&&G.DT.sysName;
   G.endDefence('lost');                   // endDefence() takes the outcome directly
   const html=document.querySelector('#dRes').innerHTML;
   const out={ started, dtSab, dtSd, dtName, enAfter:G.S.en,
            occHome:G.S.occ&&G.S.occ.home, mentionsStolen:html.includes('Nodes stolen'), html };
   G.closeDefence();   // real UI never leaves DT set once the result card is dismissed -
                        // rvMaybeThreat() early-returns while DT is truthy (see below)
   return out;
 }, baseAdopt);
 ok('startDefence() accepts a sab threat and marks DT.sab', defenceLoss.started===true && defenceLoss.dtSab===true, defenceLoss);
 ok('startDefence() for a sab threat looks up home safely (system name, sd fallback)',
   defenceLoss.dtName==='Sol Reach' && defenceLoss.dtSd===0, defenceLoss);
 ok('losing the mini-game against a sab threat steals 25% of S.en (200 -> 150)', defenceLoss.enAfter===150, defenceLoss);
 ok('losing the mini-game against a sab threat never occupies home', defenceLoss.occHome===undefined, defenceLoss);
 ok('the result card reports the theft in plain language', defenceLoss.mentionsStolen, defenceLoss);

 const defenceWin = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.en=200;
   G.thq().push({id:6, rv:'hel', sysId:'home', dif:1, t:100, kind:'sab'});
   G.startDefence(6);
   G.endDefence('held');                   // endDefence() takes the outcome directly
   const out={ enAfter:G.S.en, occHome:G.S.occ&&G.S.occ.home };
   G.closeDefence();   // see the note on the loss test above
   return out;
 }, baseAdopt);
 ok('winning the mini-game against a sab threat steals nothing', defenceWin.enAfter===200, defenceWin);
 ok('winning the mini-game against a sab threat never occupies home', defenceWin.occHome===undefined, defenceWin);

 // ---------- save/load keeps a live sab threat ----------
 const roundtrip = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.thq().push({id:7, rv:'cov', sysId:'home', dif:1.4, t:5000, kind:'sab'});
   const snapshot=JSON.parse(JSON.stringify(G.S));   // same shape save()/load() round-trip through
   G.adopt(G.fresh());                               // wipe live state
   const loaded=G.adopt(snapshot);
   const th=G.thqAt(7);
   return { loaded, th };
 }, baseAdopt);
 ok('a live sab threat survives a save/load round-trip',
   roundtrip.loaded===true && roundtrip.th && roundtrip.th.kind==="sab" && roundtrip.th.sysId==="home", roundtrip);

 // ---------- old-save sanitiser: a non-sab entry naming home is still stripped ----------
 const sanitizer = await p.evaluate(()=>{
   const G=window.__SD;
   const raw={...G.fresh(),
     thq:[ {id:1, rv:'hel', sysId:'home', dif:1, t:100},                       // no kind - old/bogus, must go
           {id:2, rv:'hel', sysId:'home', dif:1, t:100, kind:'occupy'},        // wrong kind naming home - must go
           {id:3, rv:'hel', sysId:'home', dif:1, t:100, kind:'sab'},           // the one legitimate case - kept
           {id:4, rv:'hel', sysId:'kor',  dif:1, t:100} ] };                   // ordinary entry - kept
   G.adopt(raw);
   return G.thq().map(q=>({sysId:q.sysId, kind:q.kind}));
 });
 ok('adopt() still strips a non-sab entry naming home, and keeps the sab one and the ordinary one',
   sanitizer.length===2 && sanitizer.some(q=>q.kind==='sab'&&q.sysId==='home') && sanitizer.some(q=>q.sysId==='kor'),
   sanitizer);

 // ---------- patch587 copy: card text/class, rival:rvSab on first sabotage ----------
 const copy = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.S.nx={pj1:1}; G.S.en=400; G.S.end=0;
   const orig=Math.random; Math.random=()=>0;
   G.rvMaybeThreat();
   Math.random=orig;
   G.gotoTab('p-raid'); G.render();
   const card=document.querySelector('#thrCard .thrc');
   return {
     hasSabClass: card&&card.classList.contains('sab'),
     mentionsNexus: card&&card.innerHTML.includes('THE NEXUS'),
     mentionsAtRisk: card&&/Nodes at risk/.test(card.innerHTML),
     rvSabQueued: (G.S.notifyQueue||[]).includes('rival:rvSab'),
     seen: !!(G.S.seen&&G.S.seen['rival:rvSab']),
   };
 }, baseAdopt);
 ok('a sab threat card carries the .sab class', copy.hasSabClass, copy);
 ok('a sab threat card names the Nexus, not a system', copy.mentionsNexus, copy);
 ok('a sab threat card shows Nodes at risk when S.en>0', copy.mentionsAtRisk, copy);
 ok('the first sabotage queues rival:rvSab', copy.rvSabQueued && copy.seen, copy);

 // ---------- map: a live sab threat shows "incoming" on Sol Reach's own node ----------
 const mapMarker = await p.evaluate((baseAdopt)=>{
   const G=window.__SD;
   eval(baseAdopt);
   G.thq().push({id:8, rv:'hel', sysId:'home', dif:1, t:100, kind:'sab'});
   G.gotoTab('p-map'); G.setMapSec(0); G.render();
   const el=document.querySelector('#mapNodes .mnode[data-s="home"]');
   return { incoming: el&&el.classList.contains('incoming') };
 }, baseAdopt);
 ok('a live sab threat marks Sol Reach\'s own map node "incoming"', mapMarker.incoming===true, mapMarker);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
