const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// trivals2.js — STAGE 2 combat build regression: occupation (2A), the frontier
// rule + action budget (2B, offline-only - see HANDOVER for why), and the
// offline return report (2D). Pointed at stellar-dominion-empire2.html, following
// the style of tcombat2.js / toreclaim2.js: load the real page, drive it through
// window.__SD (`G`), use G.adopt({...}) to stage each scenario.
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(400);

 // ---------------- frontier rule ----------------
 // Neutralise every ring-1/ring-2 GARRISON system (S.taken) so Koru (ring 1) has
 // no contested neighbour within one ring either side - genuinely interior.
 // Anvilreach (ring 3) is left with its real ring-3 neighbours (cal/erb/sab/zen,
 // untouched) contested, so it is genuinely frontier. Home is checked directly too.
 const frontier = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, kor:{b:{}}, dra:{b:{}}, vel:{b:{}}, mir:{b:{}},
           ash:{b:{}}, fer:{b:{}}, hal:{b:{}},
           anv:{b:{}}, thu:{b:{}}, wra:{b:{}} },
     taken:{tan:1, cor:1, lys:1, noc:1}, rv:{} });
   const out={};
   out.korFrontier = G.sysIsFrontier(G.SYSMAP.kor);
   out.anvFrontier = G.sysIsFrontier(G.SYSMAP.anv);
   out.homeFrontier = G.sysIsFrontier(G.SYSMAP.home);
   const fs = G.frontierSystems().map(s=>s.id);
   out.frontierIds = fs;
   out.korInList = fs.includes('kor');
   out.anvInList = fs.includes('anv');
   out.homeInList = fs.includes('home');
   // the actual targeting function used by the offline mechanic must agree
   const picks = new Set();
   for(let i=0;i<20;i++){ const t=G.rvFrontierTargetFor('hel'); if(t)picks.add(t.id); }
   out.picks = [...picks];
   return out;
 });
 ok('an interior system (no contested neighbour within one ring) is not frontier', frontier.korFrontier===false, frontier);
 ok('a system bordering contested ground (ring 3, real GARRISON neighbours) is frontier', frontier.anvFrontier===true, frontier);
 ok('home is never frontier', frontier.homeFrontier===false, frontier);
 ok('frontierSystems() excludes the interior system', !frontier.korInList, frontier);
 ok('frontierSystems() includes the bordering system', frontier.anvInList, frontier);
 ok('frontierSystems() can never include home', !frontier.homeInList, frontier);
 ok('rvFrontierTargetFor() only ever picks frontier systems, never the interior one',
    frontier.picks.length>0 && !frontier.picks.includes('kor'), frontier);

 // ---------------- action budget: a token bucket, capped regardless of absence ----------------
 const budget = await p.evaluate(()=>{
   const G=window.__SD;
   const sysMap={b:{}};
   const sys={home:{b:{}}};
   // ten held systems, plenty of frontier supply so the CAP is the binding
   // constraint, not target scarcity
   for(const id of ['kor','dra','vel','mir','ash','fer','hal','anv','thu','wra']) sys[id]={b:{}};
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, sys,
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP},
          cov:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   const out={};
   out.mvBefore = { hel:G.rvOf('hel').mv, cov:G.rvOf('cov').mv };
   // an absurdly long absence - months of real time
   const moves = G.rvMoveAway(400*24*3600);
   out.moves = moves;
   out.occCount = Object.keys(G.S.occ||{}).length;
   out.mvAfter = { hel:G.rvOf('hel').mv, cov:G.rvOf('cov').mv };
   // immediately again, with only a few minutes more - the drained bucket
   // should grant essentially nothing more
   const moves2 = G.rvMoveAway(300);
   out.moves2 = moves2;
   out.occCountAfter2 = Object.keys(G.S.occ||{}).length;
   return out;
 });
 ok('a long absence never grants more than RIVAL_MOVE_CAP moves per rival',
    budget.moves<=2*2 && budget.occCount===budget.moves, budget);
 ok('the token bucket actually reached its cap for both rivals given months away',
    budget.occCount===4, budget); // RIVAL_MOVE_CAP(2) * RVACT.length(2)
 ok('the bucket is drained after spending it - a short follow-up gap grants nothing',
    budget.moves2===0 && budget.occCountAfter2===budget.occCount, budget);

 // ---------------- occupying a system preserves its building data untouched ----------------
 // dra ("Draskhold") is kind:"ore", so - like home - it shares the ore ladder
 // rate() actually sums; a "rock"/"gas"/etc-kind system's ladder feeds
 // sysExoRate() instead, not rate(), so ore-kind is the simplest honest choice
 // here for a real, nonzero, easily-checked production number.
 const preserve = await p.evaluate(()=>{
   const G=window.__SD;
   const buildB = {0:3, 1:2};   // real Mining Drone / Smelter Pod counts, ore ladder
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{...buildB}} } });
   const before = JSON.stringify(G.S.sys.dra);
   const rateBefore = G.rate();
   const ok1 = G.occupySystem('dra','hel');
   const after = JSON.stringify(G.S.sys.dra);
   return { ok1, before, after, unchanged: before===after,
            occupiedNow: G.sysOccupied('dra'), heldNow: G.sysHeld('dra'),
            rateBefore, rateAfter: G.rate() };
 });
 ok('occupySystem() reports success', preserve.ok1===true, preserve);
 ok('the occupied system\'s building data (S.sys[id].b) is byte-identical after occupation', preserve.unchanged, preserve);
 ok('the system is marked occupied by the right rival', preserve.occupiedNow==='hel', preserve);
 ok('the system no longer counts as held (production-wise) once occupied', preserve.heldNow===false, preserve);
 ok('overall production rate drops once a producing system is occupied', preserve.rateAfter<preserve.rateBefore, preserve);

 // ---------------- retaking an occupied system restores production instantly ----------------
 const retake = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     sys:{ home:{b:{}}, dra:{b:{0:5}} } });
   G.occupySystem('dra','hel');
   const out={};
   out.heldWhileOccupied = G.sysHeld('dra');
   out.tierCountWhileOccupied = G.sysTierCount('dra',0);   // building data still there
   out.rateWhileOccupied = G.rate();
   const t = G.assaultTarget(G.SYSMAP.dra);
   out.canAuto = G.canAutoResolve(t);
   const resolved = G.autoResolveTarget(t,-1);
   out.resolved = resolved;
   // patch633: the retake no longer lands the same tick - autoResolveTarget() now
   // arms a ~2.5s scripted clip (BT.cine); drive it to completion (same fixed-dt
   // pattern tclip2.js uses) before reading anything the win is supposed to change.
   for(let i=0;i<400 && G.BT && !G.BT.done;i++)G.bUpdate(1/30);
   out.occAfter = G.sysOccupied('dra');
   out.heldAfter = G.sysHeld('dra');
   out.tierCountAfter = G.sysTierCount('dra',0);   // untouched by the whole round trip
   out.rateAfter = G.rate();
   return out;
 });
 ok('an occupied system\'s building data is readable throughout (never wiped)', retake.tierCountWhileOccupied===5, retake);
 ok('it does not count as held (no production) while occupied', retake.heldWhileOccupied===false, retake);
 ok('a strong fleet can auto-resolve the retake', retake.canAuto===true, retake);
 ok('the retake battle actually resolves', retake.resolved!==false, retake);
 ok('S.occ is cleared on a successful retake', retake.occAfter===null, retake);
 ok('the system counts as held again immediately after retaking', retake.heldAfter===true, retake);
 ok('building data is exactly what it was before occupation - "restored" because nothing ever changed', retake.tierCountAfter===5, retake);
 ok('production resumes the instant it is retaken (no separate rebuild/claim step)', retake.rateAfter>retake.rateWhileOccupied, retake);

 // ---------------- an offline fleet arrival resolves to occupation, not destruction ----------------
 const offlineArrival = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, kor:{b:{0:4}}, dra:{b:{}} },   // two held systems - kor is not the last
     exo:{ir:1000}, rv:{ hel:{p:0,cd:0,seen:1,w:0,mv:G.RIVAL_MOVE_CAP} } });
   const before = { b: JSON.stringify(G.S.sys.kor.b), exo: G.S.exo.ir };
   // a threat already in flight when the game closed, well past its own ETA now
   const th = { id:1, rv:'hel', sysId:'kor', dif:5, t:-10 };
   const R=Math.random; Math.random=()=>0.999;   /* offline now rolls the defences too - pin the loss */
   const res = G.holdResolve(th, true, true, /*offline*/true);
   Math.random=R;
   return {
     res, before,
     bAfter: JSON.stringify(G.S.sys.kor.b),
     exoAfter: G.S.exo.ir,
     occ: G.sysOccupied('kor'),
     held: G.sysHeld('kor'),
   };
 });
 ok('an offline-resolved loss reports occ:true, not a win', offlineArrival.res && offlineArrival.res.occ===true && offlineArrival.res.won===false, offlineArrival);
 ok('the system\'s buildings survive an offline arrival completely untouched', offlineArrival.before.b===offlineArrival.bAfter, offlineArrival);
 ok('the exotic stockpile is never touched by an offline arrival', offlineArrival.exoAfter===1000, offlineArrival);
 ok('the system ends up occupied by the attacking rival', offlineArrival.occ==='hel', offlineArrival);
 ok('an occupied system no longer counts as held', offlineArrival.held===false, offlineArrival);

 // never the player's last system, even offline
 const lastSystem = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, kor:{b:{0:4}} } });   // kor is the ONLY non-home system
   const th = { id:1, rv:'hel', sysId:'kor', dif:5, t:-10 };
   const res = G.holdResolve(th, true, true, true);
   return { res, occ: G.sysOccupied('kor'), held: G.sysHeld('kor') };
 });
 ok('the player\'s last system is never occupied, even by a guaranteed offline arrival',
    lastSystem.occ===null && lastSystem.held===true, lastSystem);

 // ---------------- offlineReport() end-to-end: the return report itself ----------------
 const report = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, kor:{b:{0:4}}, dra:{b:{}}, vel:{b:{}} },
     last: Date.now() - 400*24*3600*1000,   // months ago
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP},
          cov:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.offlineReport();
   const modalOn = document.querySelector('#mask').classList.contains('on');
   const html = document.querySelector('#modal').innerHTML;
   return { modalOn, mentionsOccupied: html.includes('Occupied while you were away'),
            occCount: Object.keys(G.S.occ||{}).length };
 });
 ok('the return report opens after a long, eventful absence', report.modalOn, report);
 ok('it surfaces occupied systems as their own section (2D)', report.mentionsOccupied, report);
 ok('systems were actually occupied by the action-budget catch-up', report.occCount>0, report);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
