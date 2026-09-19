const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tladders2.js — STAGE 2 (v3) replacement for tslots2.js, against
// stellar-dominion-empire2.html. Slots are gone; a system builds exactly the ladder
// matching its kind (home + kind:"ore" systems build the "ore" ladder; rock/gas/belt/
// ice/void systems build their own 3-tier kind ladder). Covers exactly what the spec
// calls out:
//   - rate() equals the sum of every ladder row across every held system
//   - a system rejects buildings of the wrong kind
//   - home rejects exotic-kind (kind-ladder) buildings
//   - upper ore tiers reject purchase without the required exotic (revealed regardless)
//   - next-tier reveal behaves correctly (owned tiers buyable, first unowned tier
//     revealed with a price, everything past that hidden)
//   - each system's own per-tier price ladder is independent of every other system's
//
// PATCH 1 (v3 tuning pass) extends this file rather than replacing it - the ladder
// mechanics above are all unchanged, only what a KIND-LADDER row (rock/gas/belt/ice/
// void, never "ore") produces changed: exotic instead of ore, per sysExoRate(). Added
// at the end: a system's total exotic rate equals the sum of its own ladder rows'
// exotic output; a freshly claimed, unbuilt world produces exactly zero (of anything);
// the first tier of every kind ladder is buyable with ore alone.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- rate() is the sum of every ORE ladder row across every held system ----------
 // PATCH 1: kor's rock tier (14) no longer counts toward rate() at all - kind-ladder
 // rows produce exotic now, not ore - so the manual sum here is filtered to kind:"ore"
 // rows to match what rate() itself actually does (see the dedicated exotic-side sum
 // further down, which deliberately builds kor's tier 14 and checks the OTHER total).
 const sum=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e14, lvl:40, lvSeen:99, ore:1e14,
     sys:{ home:{b:{0:12,1:5}},
           kor:{b:{14:8}} }});   // kor is rock: 14 = Regolith Crusher
   let manual=0;
   for(const s of G.builtSystems())
     for(const gi of G.sysLadder(s.id)) if(G.GENS[gi].kind==="ore") manual+=G.ladderRate(s.id,gi);
   return {rate:G.rate(), manual};
 });
 ok('rate() equals the sum of every held system\'s ORE-kind ladder rows', Math.abs(sum.rate-sum.manual)<1e-6, sum);
 ok('and a kind-ladder row (kor\'s rock tier) contributes nothing to it',
    (await p.evaluate(()=>__SD.sysOreRate('kor')))===0);

 // ---------- a system rejects buildings of the wrong kind ----------
 const wrongKind=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e18, lvl:40, lvSeen:99, ore:1e18,
     sys:{ kor:{dev:0, b:{}}, vel:{dev:0, b:{}} }});   // kor=rock, vel=gas
   const rockTier=G.LADDERS.rock[0], gasTier=G.LADDERS.gas[0];
   return {
     kindKor:G.SYSMAP.kor.kind, kindVel:G.SYSMAP.vel.kind,
     korOwnKindBuildable: G.tierBuildable('kor', rockTier),
     korOtherKindBuildable: G.tierBuildable('kor', gasTier),
     korOtherKindBuy: G.ladderBuy('kor', gasTier),
     velOwnKindBuildable: G.tierBuildable('vel', gasTier),
     velOtherKindBuy: G.ladderBuy('vel', rockTier)
   };
 });
 ok('a system CAN build the tier matching its own kind', wrongKind.korOwnKindBuildable, wrongKind);
 ok('a system CANNOT build a tier from a different kind\'s ladder', !wrongKind.korOtherKindBuildable, wrongKind);
 ok('buying a wrong-kind tier on a system is rejected outright', wrongKind.korOtherKindBuy===false, wrongKind);
 ok('the same holds in the other direction (gas system, rock tier)',
    wrongKind.velOwnKindBuildable && wrongKind.velOtherKindBuy===false, wrongKind);

 // ---------- home rejects exotic-kind (kind-ladder) buildings ----------
 const homeGate=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e18, lvl:99, lvSeen:99, ore:1e18, exo:{ir:1e6,he:1e6,xe:1e6,am:1e6}});
   const rockTier=G.LADDERS.rock[0];
   return {
     homeLadderKind: G.ladderKindOf(G.SYSMAP.home),
     homeBuildableRock: G.tierBuildable('home', rockTier),
     homeBuyRock: G.ladderBuy('home', rockTier),
     homeBuildableOre: G.tierBuildable('home', 0)
   };
 });
 ok('home\'s ladder is "ore", never a kind ladder', homeGate.homeLadderKind==='ore', homeGate);
 ok('home cannot build a kind-ladder (exotic) tier', !homeGate.homeBuildableRock && homeGate.homeBuyRock===false, homeGate);
 ok('home CAN build the ore ladder', homeGate.homeBuildableOre, homeGate);

 // ---------- an ore-kind system (not home, not exotic) also builds the ore ladder ----------
 const oreKindSys=await p.evaluate(()=>{
   const G=__SD;
   const oreSys=G.SYS.find(s=>!s.home&&s.kind==='ore');
   G.adopt({...G.fresh(), all:1e18, lvl:99, lvSeen:99, ore:1e18});
   G.S.sys[oreSys.id]={dev:0,b:{}};
   const bought=G.ladderBuy(oreSys.id, 0);
   return {id:oreSys.id, res:oreSys.res, ladderKind:G.ladderKindOf(oreSys), bought,
     count:G.sysTierCount(oreSys.id,0)};
 });
 ok('an ore-kind system exists and produces no exotic (res===null)', oreKindSys.res===null, oreKindSys);
 ok('an ore-kind system also builds the ore ladder', oreKindSys.ladderKind==='ore', oreKindSys);
 ok('and can actually buy ore-ladder tiers', oreKindSys.bought&&oreKindSys.count>0, oreKindSys);

 // ---------- upper ore tiers reject purchase without the required exotic, but are
 //            still REVEALED (STAGE 2's whole point: see the price before you can pay it) ----------
 const exoGate=await p.evaluate(()=>{
   const G=__SD;
   const tier=G.GENS.findIndex(g=>g.kind==='ore'&&g.exo);   // first exotic-gated ore tier
   G.adopt({...G.fresh(), all:1e18, lvl:40, lvSeen:99, ore:1e18});
   for(let gi=0; gi<tier; gi++) G.ladderBuy('home', gi);    // own everything before it
   const revealedNoExo = G.sysNextGi('home')===tier;
   const buyableNoExo = G.tierBuildable('home', tier);      // buildable = revealed, not "affordable"
   const boughtNoExo = G.ladderBuy('home', tier);
   G.S.exo[G.ladderExoId(tier)]=1e9;
   const boughtWithExo = G.ladderBuy('home', tier);
   return {tier, exo:G.ladderExoId(tier), revealedNoExo, buyableNoExo, boughtNoExo, boughtWithExo};
 });
 ok('an exotic-gated ore tier IS a real tier with a named exotic cost', exoGate.tier>=0 && !!exoGate.exo, exoGate);
 ok('it reveals as the next tier once earlier ones are owned, exotic or not', exoGate.revealedNoExo, exoGate);
 ok('revealed !== affordable: tierBuildable is true even with none of the exotic banked', exoGate.buyableNoExo, exoGate);
 ok('buying fails with none of the required exotic banked', exoGate.boughtNoExo===false, exoGate);
 ok('the same purchase succeeds once the exotic is banked', exoGate.boughtWithExo===true, exoGate);

 // ---------- next-tier reveal: owned tiers buyable, first unowned tier revealed,
 //            everything past that not yet ----------
 const reveal=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e18, lvl:40, lvSeen:99, ore:1e18});
   const before=[0,1,2,3].map(gi=>G.tierBuildable('home',gi));   // only tier 0 revealed
   G.ladderBuy('home',0); G.ladderBuy('home',1);
   const after=[0,1,2,3].map(gi=>G.tierBuildable('home',gi));    // 0,1 owned; 2 revealed; 3 not
   return {before, after, next:G.sysNextGi('home')};
 });
 ok('fresh system: only tier 0 is revealed', reveal.before[0]&&!reveal.before[1]&&!reveal.before[2]&&!reveal.before[3], reveal);
 ok('owning 0 and 1 reveals tier 2 but not tier 3', reveal.after[0]&&reveal.after[1]&&reveal.after[2]&&!reveal.after[3], reveal);
 ok('sysNextGi() names the next reveal precisely', reveal.next===2, reveal);

 // a maxed ladder (every tier owned) has no next reveal
 const maxed=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e18, lvl:99, lvSeen:99, ore:1e18});
   G.S.sys.kor={dev:0,b:{}};
   for(const gi of G.LADDERS.rock) G.S.sys.kor.b[gi]=1;   // own every rock tier directly
   return {next:G.sysNextGi('kor'), ladderLen:G.LADDERS.rock.length};
 });
 ok('a fully-owned ladder has no next reveal (sysNextGi returns null)', maxed.next===null, maxed);

 // ---------- each system's own per-tier price ladder is independent ----------
 const independent=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e14, lvl:40, lvSeen:99, ore:1e14,
     sys:{ home:{dev:0, b:{}}, kor:{dev:0, b:{}} }});
   const cost0_before=G.ladderCost('home',0,1);
   const costKor_before=G.sysHeld('kor')?0:0; // n/a, home only in this probe
   G.S.buy=1; for(let i=0;i<30;i++) G.ladderBuy('home',0);   // grow home's tier 0 a lot
   const cost0_after=G.ladderCost('home',0,1);
   return {cost0_before, cost0_after, c0:G.sysTierCount('home',0)};
 });
 ok('growing one system\'s tier raises ITS next price', independent.cost0_after>independent.cost0_before, independent);

 // and the same holds across two DIFFERENT systems both building the ore ladder
 const crossSys=await p.evaluate(()=>{
   const G=__SD;
   const oreSys=G.SYS.find(s=>!s.home&&s.kind==='ore');
   G.adopt({...G.fresh(), all:1e18, lvl:99, lvSeen:99, ore:1e18});
   G.S.sys[oreSys.id]={dev:0,b:{}};
   const homeBefore=G.ladderCost('home',0,1), oreSysBefore=G.ladderCost(oreSys.id,0,1);
   G.S.buy=1; for(let i=0;i<30;i++) G.ladderBuy('home',0);
   const homeAfter=G.ladderCost('home',0,1), oreSysAfter=G.ladderCost(oreSys.id,0,1);
   return {homeBefore, oreSysBefore, homeAfter, oreSysAfter};
 });
 ok('two systems both building Mining Drone each start cheap and stay independent',
    crossSys.homeAfter>crossSys.homeBefore && crossSys.oreSysAfter===crossSys.oreSysBefore, crossSys);

 // ---------- PATCH 1: a system's total exotic rate is the sum of its own ladder
 //            rows' exotic output - same shape as rate() summing the ore ladder ----------
 const exoSum=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e14, lvl:40, lvSeen:99, ore:1e14,
     sys:{ home:{b:{}}, kor:{b:{14:6,15:2}} }});   // kor rock: 14,15 owned, 16 (marquee) not
   let manual=0;
   for(const gi of G.sysLadder('kor')) if(G.GENS[gi].kind!=='ore') manual+=G.ladderRate('kor',gi);
   manual*=Math.pow(1.35, G.xlv('loom'));
   return {sysExoRate:G.sysExoRate('kor'), manual, mapExoRate:G.exoRate('ir')};
 });
 ok('a system\'s exotic rate equals the sum of its own ladder rows\' exotic output',
    Math.abs(exoSum.sysExoRate-exoSum.manual)<1e-9, exoSum);
 ok('exoRate(id) (the map-wide total) agrees with the one system that produces it',
    Math.abs(exoSum.mapExoRate-exoSum.sysExoRate)<1e-9, exoSum);

 // ---------- PATCH 1: a freshly claimed, unbuilt world produces exactly zero ----------
 const freshClaim=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e18, lvl:40, lvSeen:99, ore:1e18});
   const s=G.SYSMAP.kor;
   G.claimSystem(s);
   const exoRateNow=G.sysExoRate('kor'), oreRateNow=G.sysOreRate('kor'), rateNow=G.rate();
   const exoBefore=G.exo('ir');
   G.tick(50);
   return {held:G.sysHeld('kor'), exoRateNow, oreRateNow, rateNow,
     exoBefore, exoAfter:G.exo('ir')};
 });
 ok('a freshly claimed, unbuilt world yields exactly zero exotic',
    freshClaim.held && freshClaim.exoRateNow===0, freshClaim);
 ok('...and exactly zero ore too (it is a kind-ladder system, not an ore one)',
    freshClaim.oreRateNow===0, freshClaim);
 ok('...and ticking time forward accrues none of it',
    freshClaim.exoBefore===0 && freshClaim.exoAfter===0, freshClaim);

 // ---------- PATCH 1: the first tier of every kind ladder is buyable with ore alone ----------
 const oreOnlyFirst=await p.evaluate(()=>{
   const G=__SD;
   G.adopt({...G.fresh(), all:1e20, lvl:99, lvSeen:99, ore:1e20, exo:{}});
   const out=[];
   for(const k of G.LADDER_KINDS){
     if(k==='ore')continue;
     const s=G.SYS.find(sy=>!sy.home&&sy.kind===k);
     G.S.sys[s.id]={b:{}};
     const gi=G.LADDERS[k][0];
     out.push({ kind:k, hasExo:!!G.GENS[gi].exo, bought:G.ladderBuy(s.id,gi),
       count:G.sysTierCount(s.id,gi) });
   }
   return out;
 });
 for(const row of oreOnlyFirst){
   ok('kind "'+row.kind+'": tier 1 names no exotic cost and buys with 0 banked exotics',
      !row.hasExo && row.bought && row.count===1, row);
 }

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
