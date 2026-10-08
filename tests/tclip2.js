const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tclip2.js — PLAN-clip.md: the auto-resolve battle clip (patch633/634).
//
// autoResolveTarget() now arms a ~2.5s scripted clip (BT.cine) on the battle screen
// instead of winning the same frame - bUpdate() routes to the new bUpdateCine(dt) in
// its place until endBattle() fires. Time is driven with a fixed dt through the
// exported window.__SD.bUpdate(), the same way tests/tcombat2.js drives bUpdateWep()
// directly, rather than waiting real wall-clock time.
const { chromium } = require('playwright-core');

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // helper installed on the page itself, so every evaluate() below can share it without
 // re-typing the drive loop each time
 await p.evaluate(()=>{
   window.__driveToDone = (dt, maxIters)=>{
     const G=window.__SD;
     let iters=0;
     for(iters=0; iters<maxIters && G.BT && !G.BT.done; iters++) G.bUpdate(dt);
     return iters;
   };
 });

 // ---------------- A: arms the clip, does not win the same frame ----------------
 const armed=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     wep:{own:{pulse:1,rocket:1}, slot:["pulse","rocket"]}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   const canAuto=G.canAutoResolve(t);
   const resolved=G.autoResolveTarget(t,-1);
   return {
     canAuto, resolved,
     battleOn: document.getElementById('battle').classList.contains('on'),
     cineClass: document.getElementById('battle').classList.contains('cine'),
     cineArmed: !!(G.BT&&G.BT.cine),
     bResOn: document.getElementById('bRes').classList.contains('on'),
     done: G.BT?G.BT.done:'no-BT',
     en: G.BT?G.BT.en.length:0,
   };
 });
 ok('a lopsided fight is auto-resolvable', armed.canAuto, armed);
 ok('autoResolveTarget() reports success', armed.resolved, armed);
 ok('the battle screen opens (#battle.on)', armed.battleOn, armed);
 ok('#battle carries the new .cine class', armed.cineClass, armed);
 ok('BT.cine is armed instead of an instant win', armed.cineArmed, armed);
 ok('the win has NOT landed yet - #bRes is not .on the same frame (patch633)', !armed.bResOn, armed);
 ok('BT.done is not set yet either', armed.done===0, armed);
 ok('hostiles are already spawned (engageTarget() ran as normal)', armed.en>0, armed);

 // ---------------- B: driven to completion - everyone dead, the card is up, the
 // title reads Auto-Resolved, S.fhp matches the hand-computed expectation ----------------
 const played=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     wep:{own:{pulse:1,rocket:1}, slot:["pulse","rocket"]}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   const fhpBefore=G.S.fl[0].hp;
   G.autoResolveTarget(t,-1);
   const iters=window.__driveToDone(1/30, 400);
   const everyoneDead = G.BT.en.every(e=>!e.alive);
   const h3=document.querySelector('#bRes h3');
   const expected=Math.max(0.05, fhpBefore-G.AUTO_FHP_COST);
   return {
     iters, everyoneDead,
     done: G.BT.done,
     bResOn: document.getElementById('bRes').classList.contains('on'),
     title: h3?h3.textContent:null,
     kills: G.BT.kills, tot: G.BT.tot,
     fhpBefore, fhpAfter: G.S.fl[0].hp, expected,
     fhpMatches: Math.abs(G.S.fl[0].hp-expected)<1e-6,
   };
 });
 ok('finished on its own well within a generous iteration budget (never got stuck)', played.iters<400, played);
 ok('the clip clears in roughly its promised ~2.6s (< ~3.3s of simulated time)', played.iters<100, played);
 ok('every hostile is dead once the clip finishes', played.everyoneDead, played);
 ok('BT.kills reaches BT.tot (hydra pieces, if any, included)', played.kills===played.tot, played);
 ok('BT.done is set (endBattle() ran)', played.done===1, played);
 ok('the result card is showing (#bRes.on)', played.bResOn, played);
 ok('the card title reads "Auto-Resolved"', played.title==="Auto-Resolved", played);
 ok('S.fhp matches the hand-computed expectation: max(0.05, fhpBefore-AUTO_FHP_COST)', played.fhpMatches, played);

 // (the Math.max(0.05,...) floor in that same formula is unreachable from this path on
 // purpose: canAutoResolve()/engageTarget() both require S.fhp>=0.15 to engage at all,
 // and 0.15-AUTO_FHP_COST=0.12>0.05, so the auto-resolve win branch can never actually
 // need the clamp - inherited unchanged from the pre-patch633 formula, not something
 // this patch could newly get wrong, so it is not tested as a separate case here.)

 // ---------------- B2 (patch635): the enemy volley shows the real cost exactly once,
 // never a stray zero. Checked first, per the coordinator's own instruction: bFade()'s
 // shot-arrival branch is display-only (pushes an fx + a floating number + a sound) and
 // never touches BT.hp itself - only foeFire() does that, at fire time, on its own
 // separate real-shot path the clip never calls - so giving one volley shot a nonzero d
 // cannot double-charge the cost, which still lands separately, once, at 0.35+SHOT_T. ----------------
 const volley=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20},
     wep:{own:{pulse:1,rocket:1}, slot:["pulse","rocket"]}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   G.autoResolveTarget(t,-1);
   G.bUpdate(0.36);   // just past the 0.35s enemy volley - shots in flight, not yet landed (0.35+SHOT_T=0.75s)
   const shots=G.BT.fx.filter(f=>f.t==="shot");
   const nonzero=shots.filter(f=>f.d>0);
   const expectedD=G.AUTO_FHP_COST*G.BT.hpm;
   let badNum=false, iters=0;
   for(iters=0; iters<400 && G.BT && !G.BT.done; iters++){
     G.bUpdate(1/30);
     if(G.BT.num.some(n=>n.v===0&&!n.sy))badNum=true;   // labels (SHIELDS DOWN...) carry v:0 by design
   }
   return {
     shotCount:shots.length, nonzeroCount:nonzero.length,
     nonzeroMatches: nonzero.length===1 && Math.abs(nonzero[0].d-expectedD)<1e-9,
     badNum, iters, done:G.BT.done,
     fhpAfter:G.S.fl[0].hp,
     fhp97: Math.abs(G.S.fl[0].hp-0.97)<1e-9,
   };
 });
 ok('the enemy volley actually fires (sanity check on the fixture itself)', volley.shotCount>0, volley);
 ok('exactly one volley shot carries the real cost as its own d - the rest stay 0', volley.nonzeroMatches, volley);
 ok('no BT.num entry ever reads v===0 while the clip plays (same signature the "-00" bug had)', !volley.badNum, volley);
 ok('...driven all the way to done, not just up to the volley', volley.done===1, volley);
 ok('the fixture still charges exactly 0.97 fhp total - once, not zero, not doubled', volley.fhp97, volley);

 // ---------------- C: skip - a real tap on #bcv at t≈0.1s ends it immediately, with
 // the exact same numbers a full playout would have produced ----------------
 const skipped=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   const fhpBefore=G.S.fl[0].hp;
   G.autoResolveTarget(t,-1);
   G.bUpdate(0.06); G.bUpdate(0.04);   // t=0.10s - before the 0.35s enemy volley even starts
   window.__preSkip = {t:G.BT.cine.t, charged:!!G.BT.cine.charged, done:G.BT.done};
   return null;
 });
 await p.click('#bcv');   // a real tap, the actual user-facing skip path (bcv's own pointerdown handler)
 await p.waitForTimeout(80);
 const afterSkip=await p.evaluate(()=>{
   const G=window.__SD;
   const expected=Math.max(0.05, /*fhpBefore was 1*/ 1-G.AUTO_FHP_COST);
   const h3=document.querySelector('#bRes h3');
   return {
     pre: window.__preSkip,
     done: G.BT.done,
     bResOn: document.getElementById('bRes').classList.contains('on'),
     title: h3?h3.textContent:null,
     everyoneDead: G.BT.en.every(e=>!e.alive),
     kills: G.BT.kills, tot: G.BT.tot,
     fhpAfter: G.S.fl[0].hp, expected,
     matches: Math.abs(G.S.fl[0].hp-expected)<1e-6,
   };
 });
 ok('skip is tested before the clip had charged the cost on its own (t=0.1s < 0.35s)', !afterSkip.pre.charged && !afterSkip.pre.done, afterSkip);
 ok('a real tap on #bcv ends the clip immediately', afterSkip.done===1, afterSkip);
 ok('...everyone ends up dead, same as a full playout', afterSkip.everyoneDead && afterSkip.kills===afterSkip.tot, afterSkip);
 ok('...the result card shows, titled "Auto-Resolved"', afterSkip.bResOn && afterSkip.title==="Auto-Resolved", afterSkip);
 ok('...and S.fhp matches the exact same hand-computed number a full playout gives (no double/under-charge)', afterSkip.matches, afterSkip);

 // ---------------- D: a hydra in the formation still ends with everything dead.
 // pickKind()'s own RNG makes a "split" hostile unreliable to roll on demand, so per
 // the plan's own fallback, BT.en is mutated directly right after autoResolveTarget()
 // arms the clip (before any bUpdate() has run) to force one - engageTarget()'s spawn
 // is otherwise completely untouched. ----------------
 const hydra=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   G.autoResolveTarget(t,-1);
   const totBefore=G.BT.tot;
   G.BT.en[0].k="split";   // force a hydra piece - see the comment above
   const iters=window.__driveToDone(1/30, 400);
   return {
     totBefore, totAfter:G.BT.tot,
     grew: G.BT.tot>totBefore,   // K.split===2 pieces added, tagging BT.tot up
     everyoneDead: G.BT.en.every(e=>!e.alive),
     kills:G.BT.kills, tot:G.BT.tot, en:G.BT.en.length,
     done:G.BT.done, iters,
     bResOn: document.getElementById('bRes').classList.contains('on'),
   };
 });
 ok('the hydra split actually grew the formation (BT.tot increased)', hydra.grew, hydra);
 ok('the split pieces made it into BT.en too, not just BT.tot', hydra.en>hydra.totBefore, hydra);
 ok('a hydra in the mix still finishes (did not get stuck on the extra pieces)', hydra.done===1 && hydra.iters<400, hydra);
 ok('every hostile - original and split pieces alike - ends up dead', hydra.everyoneDead, hydra);
 ok('BT.kills reaches the grown BT.tot', hydra.kills===hydra.tot, hydra);
 ok('the result card still shows for the hydra case', hydra.bResOn, hydra);

 // ---------------- E: #bRetreat and #bEsc (patch635 - the REINFORCEMENTS clock) both
 // hidden while the clip runs, visible again once the result card is up ----------------
 const retreat=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   G.autoResolveTarget(t,-1);
   G.bUpdate(0.5); G.bUpdate(0.6);   // mid-clip, t≈1.1s - shots should be in flight
   const duringDisplay=getComputedStyle(document.getElementById('bRetreat')).display;
   const escDuring=getComputedStyle(document.getElementById('bEsc')).display;
   window.__driveToDone(1/30, 400);
   const afterDisplay=getComputedStyle(document.getElementById('bRetreat')).display;
   const escAfter=getComputedStyle(document.getElementById('bEsc')).display;
   return {duringDisplay, afterDisplay, escDuring, escAfter, done:G.BT.done};
 });
 ok('#bRetreat is hidden while the clip is running', retreat.duringDisplay==="none", retreat);
 ok('#bRetreat is visible again once the clip has ended', retreat.done===1 && retreat.afterDisplay!=="none", retreat);
 ok('#bEsc (REINFORCEMENTS) is hidden while the clip is running', retreat.escDuring==="none", retreat);
 ok('#bEsc is free to show again once the clip has ended (back to its own ordinary rules)', retreat.done===1 && retreat.escAfter!=="none", retreat);

 // ---------------- F: reduced motion skips straight to the card on the first frame ----------------
 await ctx.close();
 const ctx2=await b.newContext({viewport:{width:390,height:667}, reducedMotion:'reduce'});
 const p2=await ctx2.newPage();
 await p2.goto(GAME_URL); await p2.waitForTimeout(400);
 await p2.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 const reduced=await p2.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const t=G.assaultTarget(G.SYSMAP.dra);
   const fhpBefore=G.S.fl[0].hp;
   G.autoResolveTarget(t,-1);
   G.bUpdate(1/60);   // a single real frame
   const expected=Math.max(0.05, fhpBefore-G.AUTO_FHP_COST);
   return {done:G.BT.done, matches: Math.abs(G.S.fl[0].hp-expected)<1e-6,
     bResOn: document.getElementById('bRes').classList.contains('on')};
 });
 ok('prefers-reduced-motion skips straight to the card on the very first cine frame', reduced.done===1 && reduced.bResOn, reduced);
 ok('...with the same fhp math as an ordinary playout', reduced.matches, reduced);

 // ---------------- G: the final battle guard - bUpdateCine() never mis-resolves a
 // fight it was not built for, even if BT.cine were somehow armed on one ----------------
 const finalGuard=await p2.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1, tg:[]});
   G.engageTarget({ final:1, name:"VEGA's Fleet", arch:"mirror", ti:4,
     secs:9999, dif:1, dmg:0, en:4, col:"#ff5f6d" }, -1);
   const enBefore=G.BT.en.length;
   G.BT.cine={t:0};   // force-arm it - canAutoResolve() never offers this in real play
   const sEndBefore=G.S.end;
   for(let i=0;i<30;i++)G.bUpdate(1/30);
   return {
     stillFinal: !!(G.BT&&G.BT.t&&G.BT.t.final),
     enUnchangedShape: G.BT?G.BT.en.length>=enBefore:false,   // the real sim can add waves, never remove hostiles wholesale
     endUnaffected: G.S.end===sEndBefore,   // never fell into the "you won the game" ending branch
     notDone: G.BT?G.BT.done===0:false,
   };
 });
 ok('bUpdateCine() falls through to the real sim on a t.final battle instead of mis-resolving it', finalGuard.enUnchangedShape, finalGuard);
 ok('...S.end is never touched (never mistaken for the game-winning finale)', finalGuard.endUnaffected, finalGuard);
 ok('...the final battle is not falsely marked done', finalGuard.notDone, finalGuard);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
