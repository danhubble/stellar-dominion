const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// ttelegraph2.js — STAGE 3 combat build regression: telegraphed LIVE fleets (a real
// 30-60s on-screen countdown while the tab is active, closing the gap Stage 2's own
// HANDOVER section flagged). Pointed at stellar-dominion-empire2.html, following the
// style of trivals2.js/tcombat2.js: load the real page, drive it through
// window.__SD (`G`), use G.adopt({...}) to stage each scenario.
const fs = require('fs');
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }

// ---------------- static proof, no browser needed: csim4.js structurally never
// reaches frame() (or requestAnimationFrame), which is the entire safety argument
// for this feature - every new function is called only from there or from boot. ----
const csimSrc = fs.readFileSync(__dirname+'/csim4.js', 'utf8');
ok('csim4.js never calls frame(...)', !/\bframe\(/.test(csimSrc));
ok('csim4.js never touches requestAnimationFrame', !csimSrc.includes('requestAnimationFrame'));
// csim4.js does mention offlineReport() twice, but only in prose comments
// explaining that its own inline math replicates that function's formula
// ("...replicating offlineReport()'s own formula") - never as an actual call.
// Confirm that directly rather than just banning the substring.
ok('the only mentions of offlineReport() in csim4.js are comments describing its math, not calls',
   csimSrc.split('\n').filter(l=>l.includes('offlineReport')).every(l=>l.includes("offlineReport()'s")));

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(400);

 // ---------------- a live fleet can be spawned, ETA in range, real frontier target ----------------
 const spawn = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:999, mv:G.RIVAL_MOVE_CAP},
          cov:{p:G.RV_MAX, cd:0, seen:1, w:0,   mv:G.RIVAL_MOVE_CAP} } });
   const frontierIds = G.frontierSystems().map(s=>s.id);
   G.lfMaybeLaunch(0);
   const lf = G.LF;
   const out = { frontierIds, spawned: !!lf };
   if(lf){
     out.rv = lf.rv;
     out.sysId = lf.sysId;
     out.targetIsFrontier = frontierIds.includes(lf.sysId);
     out.etaSecs = (lf.dueAt - Date.now())/1000;
     out.markMatches = G.S.lfMark && G.S.lfMark.sysId===lf.sysId && G.S.lfMark.rv===lf.rv
                        && G.S.lfMark.dueAt===lf.dueAt;
   }
   return out;
 });
 ok('a live fleet spawns when a rival is at max pressure with a frontier target available', spawn.spawned, spawn);
 ok('it targets a real, currently-held frontier system', spawn.targetIsFrontier, spawn);
 ok('its ETA is in the 30-60s range the design calls for', spawn.etaSecs>=29.9 && spawn.etaSecs<=60.1, spawn);
 ok('the longest-waiting rival (w) is the one who launches it', spawn.rv==='hel', spawn);
 ok('the tiny persisted marker (S.lfMark) matches the live fleet exactly', spawn.markMatches, spawn);

 // ---------------- it never spawns with only one held system (never the last one) ----------------
 const lastSys = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   return { spawned: !!G.LF };
 });
 ok('no live fleet spawns when the player holds only one system', !lastSys.spawned, lastSys);

 // ---------------- it never spawns while a fight is already open, or a second one is already in flight ----------------
 const guardState = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const first = G.LF && G.LF.sysId;
   G.lfMaybeLaunch(0);   // called again immediately - should be a no-op, one at a time
   const stillSame = G.LF && G.LF.sysId===first;
   return { first, stillSame };
 });
 ok('a second call to the launch check does not replace or duplicate the in-flight fleet', guardState.stillSame, guardState);

 // ---------------- FIX 2 (2026-09-06): Empire tab banner is now compact - rival,
 // system, ETA, nothing more - and clickable through to the Map tab. ----------------
 const empireUi = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   G.render();
   const host = document.querySelector('#lfBanner');
   const html = host.innerHTML;
   const sysName = G.SYSMAP[G.LF.sysId].n;
   const rivName = G.RIVALMAP[G.LF.rv].n;
   G.gotoTab('p-mis');            // navigate away first so the click below is a real jump, not a no-op
   host.querySelector('.lfmini').click();
   return { html, sysName, rivName,
     isCompact: !html.includes('<p>'),                 // no descriptive paragraph any more
     mentionsRival: html.includes(rivName), mentionsSys: html.includes(sysName),
     jumpedToMap: document.querySelector('#p-map').classList.contains('on'),
     selectedSys: G.S.msel===G.LF.sysId };
 });
 ok('the Empire banner is compact - no full descriptive paragraph left', empireUi.isCompact, empireUi);
 ok('the banner names the attacking rival', empireUi.mentionsRival, empireUi);
 ok('the banner names the actual target system', empireUi.mentionsSys, empireUi);
 ok('tapping the banner jumps to the Map tab', empireUi.jumpedToMap, empireUi);
 ok('...and selects the targeted system there', empireUi.selectedSys, empireUi);

 // ---------------- visible on the Map tab (per-system panel + node) ----------------
 const mapUi = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId = G.LF.sysId;
   G.S.msel = sysId;
   G.gotoTab('p-map');
   const panelHtml = document.querySelector('#sysInfo').innerHTML;
   const node = document.querySelector(`#mapNodes .mnode[data-s="${sysId}"]`);
   return { panelHtml, mentionsLive: panelHtml.includes('Live fleet'),
            nodeIncoming: node ? node.classList.contains('incoming') : null };
 });
 ok('the Map tab per-system panel shows a "Live fleet" row for the targeted system', mapUi.mentionsLive, mapUi);
 ok('the targeted system\'s map node gets the incoming-fleet pulse', mapUi.nodeIncoming===true, mapUi);

 // ---------------- FIX 1 (2026-09-06): expiry while active now offers a choice - it
 // no longer pulls the player straight into the defence overlay. See HANDOVER's
 // 2026-09-06 section for the full design note. ----------------
 const expireActive = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId=G.LF.sysId, rid=G.LF.rv, sysName=G.SYSMAP[sysId].n;
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   G.lfSetDue(Date.now()-1000);       // force the ETA to have already passed
   G.lfCheckExpiry();
   const modalHtml = document.querySelector('#modal').innerHTML;
   return {
     lfStillSet: G.LF!==null,
     prompted: G.LF && G.LF.prompted,
     defenceNotOpenedYet: !G.DT,
     modalOn: document.querySelector('#mask').classList.contains('on'),
     modalMentionsSys: modalHtml.includes(sysName),
     modalMentionsRival: modalHtml.includes(G.RIVALMAP[rid].n),
     hasDefendBtn: !!document.querySelector('#lfDefendBtn'),
     hasHoldBtn: !!document.querySelector('#lfHoldBtn'),
     notInstantlyOccupied: G.sysOccupied(sysId)===null,
     sysId, rid,
   };
 });
 ok('expiry while active does NOT pull straight into the defence overlay', expireActive.defenceNotOpenedYet, expireActive);
 ok('...it shows a choice modal instead, and LF is left set (not yet resolved)', expireActive.modalOn && expireActive.lfStillSet, expireActive);
 ok('LF is marked prompted so a second frame() tick does not re-show the modal', expireActive.prompted, expireActive);
 ok('the modal names the actual targeted system', expireActive.modalMentionsSys, expireActive);
 ok('the modal names the actual attacking rival', expireActive.modalMentionsRival, expireActive);
 ok('the modal offers a DEFEND button', expireActive.hasDefendBtn, expireActive);
 ok('the modal offers a LET DEFENCES HOLD button', expireActive.hasHoldBtn, expireActive);
 ok('the system is NOT instantly occupied while the choice is pending', expireActive.notInstantlyOccupied, expireActive);

 // ---------------- pressing DEFEND opens the real tactical fight, exactly as the
 // old unconditional pull used to (same DT shape, same target) ----------------
 const pressDefend = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId=G.LF.sysId, rid=G.LF.rv;
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   G.lfSetDue(Date.now()-1000);
   G.lfCheckExpiry();
   document.querySelector('#lfDefendBtn').click();
   return {
     lfClearedOnOpen: G.LF===null,
     modalClosed: !document.querySelector('#mask').classList.contains('on'),
     defenceOpened: !!G.DT,
     defenceOverlayOn: document.querySelector('#defence').classList.contains('on'),
     defenceSysId: G.DT ? G.DT.sysId : null,
     defenceRv: G.DT ? G.DT.rv : null,
     notInstantlyOccupied: G.sysOccupied(sysId)===null,
     sysId, rid,
   };
 });
 ok('DEFEND clears the LF record (same as the old unconditional pull did)', pressDefend.lfClearedOnOpen, pressDefend);
 ok('DEFEND closes the modal', pressDefend.modalClosed, pressDefend);
 ok('DEFEND opens a real defence fight (DT set)', pressDefend.defenceOpened, pressDefend);
 ok('the #defence overlay is actually shown', pressDefend.defenceOverlayOn, pressDefend);
 ok('the defence fight targets the right system and rival', pressDefend.defenceSysId===pressDefend.sysId && pressDefend.defenceRv===pressDefend.rid, pressDefend);
 ok('the system is NOT instantly occupied - it has to be fought for real', pressDefend.notInstantlyOccupied, pressDefend);

 // ---------------- losing that fight occupies the system, buildings/stockpile untouched ----------------
 const loseFight = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} }, exo:{ir:1000},
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId=G.LF.sysId;
   const before = { b: JSON.stringify(G.S.sys[sysId].b), exo: G.S.exo.ir };
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   G.lfSetDue(Date.now()-1000);
   G.lfCheckExpiry();               // shows the choice modal
   document.querySelector('#lfDefendBtn').click();   // choose to defend it -> opens the real fight
   G.endDefence('lost');
   return {
     before,
     bAfter: JSON.stringify(G.S.sys[sysId].b),
     exoAfter: G.S.exo.ir,
     occ: G.sysOccupied(sysId),
     held: G.sysHeld(sysId),
     defenceClosedOrDone: !G.DT || G.DT.done===1,
     sysId,
   };
 });
 ok('a lost live-fleet fight occupies the system (not destroys it)', loseFight.occ==='hel', loseFight);
 ok('the system\'s building data survives the loss completely untouched', loseFight.before.b===loseFight.bAfter, loseFight);
 ok('the exotic stockpile is never touched by a lost live-fleet fight', loseFight.exoAfter===1000, loseFight);
 ok('the system no longer counts as held once occupied', loseFight.held===false, loseFight);

 // ---------------- FIX 1: pressing LET DEFENCES HOLD resolves via the exact same
 // lfResolveOffline() path as an offline arrival - unconditional occupation, no
 // roll. The task's own wording ("defence check, repel or occupy") reads as if
 // there is a repel chance here; there is not, by design (see HANDOVER/patch481's
 // own note), so this test asserts what actually happens: always occupied. ----------------
 const pressHold = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} }, exo:{ir:1000},
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId=G.LF.sysId;
   const before = { b: JSON.stringify(G.S.sys[sysId].b), exo: G.S.exo.ir };
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   G.lfSetDue(Date.now()-1000);
   G.lfCheckExpiry();
   document.querySelector('#lfHoldBtn').click();
   return {
     before, bAfter: JSON.stringify(G.S.sys[sysId].b), exoAfter: G.S.exo.ir,
     occ: G.sysOccupied(sysId), lfCleared: G.LF===null,
     modalClosed: !document.querySelector('#mask').classList.contains('on'),
   };
 });
 ok('LET DEFENCES HOLD always occupies the system (no repel roll - unconditional, same as lfResolveOffline() always was)', pressHold.occ==='hel', pressHold);
 ok('...buildings survive it untouched, same as any other live-fleet resolution', pressHold.before.b===pressHold.bAfter, pressHold);
 ok('...the exotic stockpile is never touched by it either', pressHold.exoAfter===1000, pressHold);
 ok('LET DEFENCES HOLD clears the live fleet record', pressHold.lfCleared, pressHold);
 ok('LET DEFENCES HOLD closes the modal', pressHold.modalClosed, pressHold);

 // ---------------- FIX 1: left untouched, the prompt auto-resolves the same way
 // "Let defences hold" does, after ~15 real seconds - a real setTimeout, not a
 // frame()-driven one, so this does not depend on requestAnimationFrame at all. ----------------
 const autoTimeout = await p.evaluate(async ()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} }, exo:{ir:1000},
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId=G.LF.sysId;
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   G.lfSetDue(Date.now()-1000);
   G.lfCheckExpiry();
   const modalOnBefore = document.querySelector('#mask').classList.contains('on');
   await new Promise(r=>setTimeout(r, 15600));   // the 15s auto-timeout, plus slack
   return {
     modalOnBefore,
     occ: G.sysOccupied(sysId), lfCleared: G.LF===null,
     modalClosedAfter: !document.querySelector('#mask').classList.contains('on'),
   };
 });
 ok('the modal is up right after expiry', autoTimeout.modalOnBefore, autoTimeout);
 ok('~15s of no answer auto-resolves it (occupation, same as LET DEFENCES HOLD)', autoTimeout.occ==='hel', autoTimeout);
 ok('...and clears the live fleet record', autoTimeout.lfCleared, autoTimeout);
 ok('...and closes the modal it opened', autoTimeout.modalClosedAfter, autoTimeout);

 // ---------------- FIX 1: the tab going hidden while the prompt is up must not
 // leave it stuck - it still resolves via lfResolveOffline(), never gets stuck
 // waiting on an answer nobody can give it while backgrounded. ----------------
 const hiddenWhilePrompted = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} }, exo:{ir:1000},
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId=G.LF.sysId;
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   G.lfSetDue(Date.now()-1000);
   G.lfCheckExpiry();                 // prompt goes up
   const promptedBefore = G.LF && G.LF.prompted;
   Object.defineProperty(document, 'hidden', { value:true, configurable:true });
   G.lfCheckExpiry();                 // simulates frame() still getting a tick while hidden
   const out = { promptedBefore, occ: G.sysOccupied(sysId), lfCleared: G.LF===null };
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   return out;
 });
 ok('the prompt was genuinely up before backgrounding', hiddenWhilePrompted.promptedBefore, hiddenWhilePrompted);
 ok('backgrounding while the prompt is unanswered still resolves it (occupation), not stuck', hiddenWhilePrompted.occ==='hel', hiddenWhilePrompted);
 ok('...and clears the live fleet record', hiddenWhilePrompted.lfCleared, hiddenWhilePrompted);

 // ---------------- expiring while the tab is hidden resolves straight to occupation ----------------
 const expireHidden = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} }, exo:{ir:1000},
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   G.lfMaybeLaunch(0);
   const sysId=G.LF.sysId;
   const before = { b: JSON.stringify(G.S.sys[sysId].b), exo: G.S.exo.ir };
   Object.defineProperty(document, 'hidden', { value:true, configurable:true });
   G.lfSetDue(Date.now()-1000);
   G.lfCheckExpiry();
   const out = {
     before, bAfter: JSON.stringify(G.S.sys[sysId].b), exoAfter: G.S.exo.ir,
     occ: G.sysOccupied(sysId), defenceOpened: !!G.DT, lfCleared: G.LF===null,
   };
   Object.defineProperty(document, 'hidden', { value:false, configurable:true });
   return out;
 });
 ok('expiry while the tab is hidden does NOT open the defence overlay', !expireHidden.defenceOpened, expireHidden);
 ok('...it resolves straight to occupation instead, per 2C', expireHidden.occ==='hel', expireHidden);
 ok('buildings survive an offline-while-hidden arrival untouched', expireHidden.before.b===expireHidden.bAfter, expireHidden);
 ok('the exotic stockpile is never touched by a hidden-tab arrival', expireHidden.exoAfter===1000, expireHidden);
 ok('the live fleet record is cleared afterwards', expireHidden.lfCleared, expireHidden);

 // ---------------- a still-ticking marker survives a reload (restored, not lost) ----------------
 const reloadTicking = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   const dueAt = Date.now()+45000;
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     lfMark:{ sysId:'dra', rv:'hel', dueAt } });
   G.lfSettleMarkOnLoad();
   return { restored: !!G.LF, sysId: G.LF&&G.LF.sysId, dueAt: G.LF&&G.LF.dueAt, expected: dueAt,
            markStillThere: !!G.S.lfMark };
 });
 ok('a marker whose ETA has not passed yet is restored as a live countdown on load', reloadTicking.restored && reloadTicking.sysId==='dra', reloadTicking);
 ok('the restored countdown keeps the exact due time it had before reload', reloadTicking.dueAt===reloadTicking.expected, reloadTicking);

 // ---------------- a marker whose ETA already passed resolves to occupation on load, not vanishing ----------------
 const reloadExpired = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} }, exo:{ir:1000},
     lfMark:{ sysId:'dra', rv:'hel', dueAt: Date.now()-5000 } });
   G.lfSettleMarkOnLoad();
   return { occ: G.sysOccupied('dra'), markCleared: G.S.lfMark===null, lfStillNull: G.LF===null,
            exoAfter: G.S.exo.ir };
 });
 ok('a marker that expired before this load resolves to occupation, not vanishing', reloadExpired.occ==='hel', reloadExpired);
 ok('the marker is cleared once settled', reloadExpired.markCleared, reloadExpired);
 ok('no live in-memory fleet is created for an already-expired marker', reloadExpired.lfStillNull, reloadExpired);
 ok('the exotic stockpile is untouched by a boot-time settle too', reloadExpired.exoAfter===1000, reloadExpired);

 // ---------------- independent gate: does not share the offline action-budget token ----------------
 const independence = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}}, vel:{b:{}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
   const mvBefore = G.rvOf('hel').mv;
   G.lfMaybeLaunch(0);
   const mvAfterLaunch = G.rvOf('hel').mv;
   const lfCdAfterLaunch = G.lfCdOf('hel');
   // now spend the OFFLINE budget on a long absence and confirm the live-fleet
   // cooldown this just set is untouched by it
   const moves = G.rvMoveAway(400*24*3600);
   const lfCdAfterOffline = G.lfCdOf('hel');
   return { mvBefore, mvAfterLaunch, lfCdAfterLaunch, moves, lfCdAfterOffline };
 });
 ok('launching a live fleet does not spend the offline action-budget token (.mv)', independence.mvAfterLaunch===independence.mvBefore, independence);
 ok('launching a live fleet sets its OWN, separate cooldown (S.lfCd)', independence.lfCdAfterLaunch>0, independence);
 ok('spending the offline action budget does not touch the live-fleet cooldown', independence.lfCdAfterOffline===independence.lfCdAfterLaunch, independence);

 // ---------------- THE CRITICAL SAFETY TEST: tick() alone must never spawn one ----------------
 const safety = await p.evaluate(()=>{
   const G=window.__SD;
   G.lfClear(); if(G.DT)G.closeDefence();   // isolate each scenario from any runtime state a previous one left
   G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}}, vel:{b:{}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP},
          cov:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} },
     lfCd:{} });
   let sawLiveFleet=false, sawMark=false;
   const N=5000;
   for(let i=0;i<N;i++){
     G.tick(1);
     if(G.LF)sawLiveFleet=true;
     if(G.S.lfMark)sawMark=true;
   }
   return { sawLiveFleet, sawMark, ticks:N,
            finalLF: G.LF, finalMark: G.S.lfMark,
            pressureStillMax: G.rvOf('hel').p>=G.RV_MAX*0.5 };
 });
 ok('G.tick(1) called thousands of times, alone, NEVER spawns a live fleet (in-loop check)', !safety.sawLiveFleet, safety);
 ok('...and never even writes the persisted marker (S.lfMark) either', !safety.sawMark, safety);
 ok('G.LF is still null after the whole run', safety.finalLF===null, safety);
 ok('S.lfMark is still null/absent after the whole run', !safety.finalMark, safety);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
