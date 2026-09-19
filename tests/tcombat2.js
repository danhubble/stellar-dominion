const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tcombat2.js — STAGE 1 combat build regression: escalation clock (1A), garrison
// archetypes (1B), and auto-resolve + economy decoupling (1C). Pointed at
// stellar-dominion-empire2.html; the shipped stellar-dominion.html is untouched by
// Stage 1 and is not covered here.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------------- 1A: escalation clock ----------------
 const esc=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[80,40,15], fhp:1,
     cmode:"wep", tg:[], rf:{gun:6,arm:6}, nx:{war:5}});
   const t=G.assaultTarget(G.SYSMAP.tha);
   G.engageTarget(t,-1);
   const startTot=G.BT.tot;
   const wt=G.waveTFor(t);

   // no wave, no pressure tick before the first threshold
   G.BT.el=1; G.bUpdateWep(0.05);
   const untouched = G.BT.tot===startTot && G.BT.pTick===0 && !G.BT.waveDone;

   // pressure tick fires right at PRESSURE_IV, not before
   const hpBefore=G.BT.hp;
   G.BT.el=G.PRESSURE_IV-0.5; G.bUpdateWep(0.05);
   const noTickYet = G.BT.hp===hpBefore && G.BT.pTick===0;
   G.BT.el=G.PRESSURE_IV+0.1; G.bUpdateWep(0.05);
   const tickHit=hpBefore-G.BT.hp;
   const tickFired = G.BT.pTick===1 && Math.abs(tickHit-G.BT.hpm*G.PRESSURE_DMG)<1e-6;

   // does not double-fire the same tick on the next frame
   const hpAfterTick=G.BT.hp;
   G.bUpdateWep(0.05);
   const noDoubleTick = G.BT.hp===hpAfterTick;

   // wave has NOT landed just below waveTFor(t)  (patch556: per-target wave clock)
   G.BT.el=wt-0.5; G.bUpdateWep(0.05);
   const noWaveYet = !G.BT.waveDone && G.BT.tot===startTot;

   // wave lands at/after waveTFor(t), adds WAVE_ADD hostiles, tags BT.tot
   G.BT.el=wt+0.1; G.bUpdateWep(0.05);
   const waveFired = G.BT.waveDone===1 && G.BT.tot===startTot+G.WAVE_ADD
     && G.BT.en.length===startTot+G.WAVE_ADD;

   // reconciliation with WEP_CAP: the wave must land with real room before the
   // hard timeout, not seconds before it
   const gapToCap = G.WEP_CAP-wt;

   return {startTot, untouched, noTickYet, tickFired, noDoubleTick, noWaveYet, waveFired,
     wt, WEP_CAP:G.WEP_CAP, gapToCap};
 });
 ok('no escalation before the first pressure tick', esc.untouched, esc);
 ok('pressure tick does not fire before PRESSURE_IV', esc.noTickYet, esc);
 ok('pressure tick fires exactly at PRESSURE_IV, for PRESSURE_DMG of max hull', esc.tickFired, esc);
 ok('a pressure tick does not double-fire on the very next frame', esc.noDoubleTick, esc);
 ok('the wave has not landed just below waveTFor(t)', esc.noWaveYet, esc);
 ok('the wave lands at waveTFor(t) and adds WAVE_ADD hostiles (BT.tot and BT.en both)', esc.waveFired, esc);
 ok('waveTFor(t) leaves a real gap before WEP_CAP (not the ~5s the flat-90s default would give)',
    esc.gapToCap>=20, esc);

 // ---------------- 1B: archetypes ----------------
 const arch=await p.evaluate(()=>{
   const G=window.__SD;
   const out={};

   // Fortress (tan): Warden appears and carries heavier shields/heal than baseline
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[80,40,15], fhp:1, tg:[]});
   const tf=G.assaultTarget(G.SYSMAP.tan);
   out.fortressArch = tf.arch;
   let warden=false;
   for(let i=0;i<50 && !warden;i++){ G.engageTarget(tf,-1); warden=G.BT.en.some(e=>e.k==="warden") }
   out.wardenSeen=warden;
   out.wardenBeatsBaseline = G.EK.warden.sh>G.EK.shield.sh && G.EK.warden.heal>G.EK.heal.heal;

   // Ghost (lys): Phantom's evasion drops once its engine system is knocked down
   const tg=G.assaultTarget(G.SYSMAP.lys);
   out.ghostArch = tg.arch;
   let phantom=null;
   for(let i=0;i<50 && !phantom;i++){ G.engageTarget(tg,-1); phantom=G.BT.en.find(e=>e.k==="phantom") }
   out.phantomSeen=!!phantom;
   if(phantom){
     const evUp=G.evadeOf(phantom);
     phantom.sys.find(s=>s.k==="eng").st=1;
     const evDown=G.evadeOf(phantom);
     out.ghostEvUp=evUp; out.ghostEvDown=evDown; out.ghostDrops = evDown<evUp-0.2;
   }

   // Lance (nyx): Impaler's fuse/hit is bigger than a standard Charger's.
   // patch578 (PLAN-ending.md Batch A) swapped Nyx/Thanaris's GARRISON rows -
   // Nyx carries Lance now, Thanaris carries Fortress.
   const tl=G.assaultTarget(G.SYSMAP.nyx);
   out.lanceArch = tl.arch;
   out.lanceBiggerFuse = G.EK.impaler.fuseS>G.FUSE_S;
   out.lanceBiggerBlast = G.EK.impaler.rawBlast>G.WEP_BLAST;

   // Swarm (cor): still the plain rounded EMIX build - no archetype mix override
   const ts=G.assaultTarget(G.SYSMAP.cor);
   out.swarmArch = ts.arch;
   out.swarmHasNoMix = !G.mixFor(ts);

   return out;
 });
 ok('tan is assigned the Fortress archetype', arch.fortressArch==="fortress", arch);
 ok('a Fortress garrison can roll its Warden unit', arch.wardenSeen, arch);
 ok('Warden carries heavier shields and heal than the baseline shield/heal units', arch.wardenBeatsBaseline, arch);
 ok('lys is assigned the Ghost archetype', arch.ghostArch==="ghost", arch);
 ok('a Ghost garrison can roll its Phantom unit', arch.phantomSeen, arch);
 ok('Phantom evasion drops significantly once its engine system is knocked down', arch.ghostDrops===true, arch);
 ok('nyx is assigned the Lance archetype', arch.lanceArch==="lance", arch);
 ok("Lance's fuse is longer than a standard Charger's", arch.lanceBiggerFuse, arch);
 ok("Lance's fused hit is bigger than a standard Charger's", arch.lanceBiggerBlast, arch);
 ok('cor is assigned the Swarm archetype, with no archetype mix override (falls through to EMIX)',
    arch.swarmArch==="swarm" && arch.swarmHasNoMix, arch);

 // ---------------- 1C: economy decoupling ----------------
 const econ=await p.evaluate(()=>{
   const G=window.__SD;
   function stateFor(level, cascLv, coreLv){
     G.adopt({...G.fresh(), lvl:level, lvSeen:level, all:1e30, ore:1e30,
       rf:{gun:8,arm:8}, nx:{war:10}, xp:{casc:cascLv, core:coreLv}, sh:[0,0,0]});
     const cap=G.fleetCap();
     const dPw=G.SHIPS[2].pw, n=Math.floor(cap/dPw);
     G.adopt({...G.S, sh:[0,0,n]});
     return {level, cap, n, dps:G.fleetDPS(), hp:G.fleetHPMax()};
   }
   const mid = stateFor(30, 5, 5);     // roughly ring-2
   const late = stateFor(75, 15, 20);  // roughly full-map (casc/core both maxed)
   return {mid, late, dpsRatio: late.dps/mid.dps, hpRatio: late.hp/mid.hp,
     cascMaxMul: Math.pow(G.CASC_EXP,15), coreAddCapped: 6*20>G.CORE_ADD_MAX};
 });
 ok('mid-vs-late-game combat power ratio is now a low single-digit multiple, not orders of magnitude',
    econ.dpsRatio>1 && econ.dpsRatio<10 && econ.hpRatio<10, econ);
 ok('Cascade Ignition\'s max multiplier is now single-digit (was ~19.7x at 1.22^15)', econ.cascMaxMul<10, econ);
 ok('Fusion Cores\' fleetCap add is capped below its old uncapped-within-level max (120)', econ.coreAddCapped, econ);

 // ---------------- 1C: auto-resolve ----------------
 const auto=await p.evaluate(()=>{
   const G=window.__SD;
   const out={};

   // well above AUTO_MULT -> auto-resolves
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const tStrong=G.assaultTarget(G.SYSMAP.tan);
   out.strongOdds=G.fightOdds(tStrong);
   out.strongCanAuto=G.canAutoResolve(tStrong);
   const fhpBefore=G.S.fhp;
   const resolved=G.autoResolveTarget(tStrong,-1);
   out.resolvedOk=resolved;
   // patch633: auto-resolve no longer wins synchronously - it arms a ~2.5s scripted
   // clip (BT.cine) that bUpdate() has to be driven through first, the same way
   // tclip2.js drives it (fixed small dt, until BT.done).
   out.armedCine = !!(G.BT&&G.BT.cine);
   for(let i=0;i<400 && G.BT && !G.BT.done;i++)G.bUpdate(1/30);
   out.won=!!(G.S.taken&&G.S.taken.tan);
   out.fhpDropMatches = Math.abs((fhpBefore-G.S.fhp)-G.AUTO_FHP_COST)<1e-6;

   // just below AUTO_MULT -> tactical screen still required (BT.auto unset)
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[6,2,0], fhp:1, tg:[],
     cmode:"wep"});
   const tWeak=G.assaultTarget(G.SYSMAP.nyx);   // patch578: nyx is now the hardest target (def:20)
   out.weakOdds=G.fightOdds(tWeak);
   out.weakCanAuto=G.canAutoResolve(tWeak);
   out.weakAutoRefused = G.autoResolveTarget(tWeak,-1)===false;

   // right at the boundary: same fleet, same target (sab), only War Doctrine's level
   // varies - w=2 sits just under AUTO_MULT, w=3 just over (patch556: fightOdds() now
   // folds in the wave-clock factor, which shifted this boundary down from 3/4). The
   // gate must flip exactly there, not just "somewhere low vs somewhere high". wins:20
   // pins parBlend() at its floor (0.35, the pre-patch544 constant) - this is a
   // level-60 veteran fleet check, not the early-raid ramp, so it is tuned against the
   // always-on number.
   const tBound=G.assaultTarget(G.SYSMAP.sab);
   G.adopt({...G.fresh(), all:1e30, lvl:60, lvSeen:60, ore:1e30, sh:[80,40,15], fhp:1, tg:[],
     rf:{gun:6,arm:6}, nx:{war:2}, wins:20});
   out.justBelowOdds=G.fightOdds(tBound); out.justBelowCanAuto=G.canAutoResolve(tBound);
   G.adopt({...G.fresh(), all:1e30, lvl:60, lvSeen:60, ore:1e30, sh:[80,40,15], fhp:1, tg:[],
     rf:{gun:6,arm:6}, nx:{war:3}, wins:20});
   out.justAtOrAboveOdds=G.fightOdds(tBound); out.justAtOrAboveCanAuto=G.canAutoResolve(tBound);

   // manual "fight it anyway" override still works on an auto-resolvable target
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[500,300,150], fhp:1,
     cmode:"wep", tg:[], rf:{gun:10,arm:10}, nx:{war:15}, xp:{casc:15,core:20}});
   const tOverride=G.assaultTarget(G.SYSMAP.cor);
   out.overrideCanAuto=G.canAutoResolve(tOverride);
   G.engageTarget(tOverride,-1);
   out.manualPlayable = !!G.BT && !G.BT.done && !G.BT.auto && G.BT.mode==="wep";

   return out;
 });
 ok('a lopsided fight (fightOdds well above AUTO_MULT) is auto-resolvable', auto.strongCanAuto, auto);
 ok('auto-resolving arms a scripted clip (BT.cine) rather than an instant win (patch633)', auto.armedCine, auto);
 ok('once the clip plays out, the win lands (garrison captured) without requiring the tactical screen', auto.resolvedOk && auto.won, auto);
 ok('auto-resolve still costs a small nick of fleet integrity (AUTO_FHP_COST), same total as before the clip', auto.fhpDropMatches, auto);
 ok('a fight NOT clearing AUTO_MULT is not auto-resolvable', !auto.weakCanAuto, auto);
 ok('autoResolveTarget refuses (returns false) below the threshold', auto.weakAutoRefused, auto);
 ok('right at the AUTO_MULT boundary: just-under fightOdds does NOT auto-resolve',
    !auto.justBelowCanAuto, auto);
 ok('right at the AUTO_MULT boundary: just-at/above fightOdds DOES auto-resolve',
    auto.justAtOrAboveCanAuto, auto);
 ok('"fight it anyway": engageTarget still starts a normal playable fight on an auto-resolvable target',
    auto.overrideCanAuto && auto.manualPlayable, auto);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
