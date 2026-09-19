const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
/* csim4.js — pacing-instrumentation sim for the 2026-09-04 numbers-only tuning pass.
   Builds on csim3's ladder-buy policy (unchanged) and adds the timeline instrumentation
   the task asks for: first claim per ring, exotic-gate afford delay per exotic, days to
   max the map, level-ups-per-minute past level 10, and tech-tree clear time.

   Usage: node csim4.js [free]
     (no arg)  "realistic" mode — claims cost ore, same as real play.
     free      every claim is free the instant it's open — isolates claim-cost pacing
               from the level-gate pacing (same convention csim3 established).

   Definitions used below, fixed so the numbers are reproducible:
     - "active play minute" = one minute of the continuous engaged-play loop (claim/buy/
       level/research every minute, tap the scan button every 3s for the first 10
       minutes) — the exact loop csim3 already called "realistic," just instrumented.
     - "a few minutes" (level-cascade rule, milestone 5) = 4 minutes.
     - "one sitting" (research rule, milestone 6) = 90 minutes.
     - a "day" (milestones 3/4, mixed active+offline) = 60 minutes of the active loop
       plus one offline jump for the remaining 1380 minutes, capped at offlineCapH()
       and discounted by offlineEff() — replicating offlineReport()'s own formula
       (rate()*t*eff) rather than calling tick() with a scaled dt.
     - "map maxed" = every claimable system held (the 10 that are not pre-owned by a
       rival in GARRISON — ring 4 and 6 ring-1..3 systems are rival-held and need an
       invasion this sim does not model, flagged explicitly in the output) AND the
       marquee (final) tier of the ore ladder and of all five kind ladders is owned by
       at least one held system of that kind. This is a reachable-content definition,
       not "every system at every max tier simultaneously" (see the printed caveat).

   DEEDS-XP ADDITIONS (2026-09-07, Stage 5 curve-tuning pass): this file now also
   drives and reports the deeds-XP level system (PLAN-deeds-xp.md) instead of the
   pre-XP all-time-ore level curve. Added: `xp=` on every marker line; `xpAtCost=`
   (XP banked the moment a system's ore cost first became affordable) and `need=`
   (that system's `xpNeed(lvl)`) on each per-system report line, the data the
   LVXP_PTS anchors were fitted against; a raid-win XP stand-in
   (`G.grantXp('sim:rw:'+n, 12, null)` every 30 active minutes past level 12) since
   this sim never actually raids or defends, so it would otherwise never see any
   `raidWin`/`defHeld` XP at all; and `xpLedger()`, a per-source XP running total
   printed for the sim's first 90 minutes so a tuning pass can see WHERE the XP
   came from, not just the level it produced. The pre-XP version of this file
   (all-time-ore levelling, none of the above) is kept as `csim4.bak-pre-xp.js`.

   ECON ADDITIONS (2026-09-09, exotics-off-the-ore-stack retune): the sim now also
   buys exotic programmes (`doProg()`, called alongside `doResearch()` each active
   minute — same greedy "cheapest affordable node" policy) instead of only banking
   the exotic and never spending it, since programme spend is now part of ordinary
   pacing rather than a runaway side effect. The mark line also prints a running
   `globalMul()`-equivalent multiplier readout so a tuning pass can see how much of
   the ore rate a given moment is coming from stacked multipliers versus raw count.
*/
const FREE = process.argv[2]==='free' || process.argv.includes('free');
const ACTIVE_PHASE_MIN = 720;   // first 12h, dense per-minute instrumentation
const DAY_ACTIVE_MIN = 60;      // active minutes per simulated day in phase 2
const MAX_DAYS = 150;           // safety cap (~5 months) so the run always terminates
const CASCADE_GAP_MIN = 4;      // "a few minutes" for milestone 5
const SITTING_MIN = 90;         // "one sitting" for milestone 6

/* PLAN-batch-sep10.md item 2 (patch573): --cycles N plays the same active+offline
   mixed loop as the normal report up to level 40, collapses (doCollapse(), patch570),
   then plays again from scratch (minus the Collapse carry fields) up to level 40 a
   second time - self-contained (its own page.evaluate, its own copies of the greedy
   buy/claim/research policies) rather than threaded through the big single-run
   report above, so it can be capped to a much smaller day budget (ring 3 in each
   cycle, not the whole map maxed) and stay well under the ~2 minute wall-time budget
   the task sets. Reports the elapsed minute of each cycle's first ring-3 claim and
   the ratio between them - target ~60% for cycle 2. */
const CYCLES = (()=>{ const i=process.argv.indexOf('--cycles'); return i>=0 ? (parseInt(process.argv[i+1],10)||2) : null; })();

(async()=>{
 const b = await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p = await b.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(400);

 if(CYCLES){
   const rc = await p.evaluate((cfg)=>{
     const {n, DAY_ACTIVE_MIN}=cfg;
     const G=window.__SD, out=[];
     (function seedRandom(seed){
       let s=seed>>>0;
       Math.random=function(){ s=(s+0x6D2B79F5)>>>0; let t=s;
         t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
         return ((t^(t>>>14))>>>0)/4294967296; };
     })(0xC0FFEE);
     /* same greedy policies as the single-run report above, trimmed - see there for
        the reasoning behind each (shadow-pricing exotics, the claim reserve, etc). */
     const SHADOW={};
     for(const g of G.GENS){ if(g.kind==="ore" && g.exo){
       const v=g.b/g.exoC; if(SHADOW[g.exo]===undefined||v<SHADOW[g.exo])SHADOW[g.exo]=v;
     }}
     function doProg(){
       if(!G.XPROG||!G.buyXp)return;
       for(let k=0;k<10;k++){
         let best=null,bc=Infinity;
         for(const r of G.XPROG){ const l=G.xlv(r.id); if(l>=r.max)continue;
           const c=G.xpCost(r,l); if(c*2<=G.exo(r.x)&&c<bc){bc=c;best=r} }
         if(!best)break; if(!G.buyXp(best))break;
       }
     }
     function doResearch(){
       for(let k=0;k<20;k++){
         let best=null,bc=Infinity;
         for(const rr of G.RESH){ const l=(G.S.rs[rr.id]||0); if(l>=rr.max)continue;
           if(rr.req&&(G.S.rs[rr.req.id]||0)<rr.req.lv)continue;
           const bal=G.resBal(rr); const c=rr.c*Math.pow(rr.cg,l);
           if(c<=bal&&c<bc){bc=c;best=rr} }
         if(!best)break; if(!G.buyRes(best))break;
       }
     }
     function claimReserve(){
       const pending=G.SYS.filter(s=>!s.home && !G.sysHeld(s.id) && !G.sysOwner(s) && G.level()>=s.lvl);
       if(!pending.length)return 0;
       const cheapest=Math.min(...pending.map(s=>s.cost)), r=G.rate();
       if(r>0 && cheapest>r*4*3600)return 0;
       return cheapest;
     }
     function doClaims(){
       for(let k=0;k<8;k++){
         const open=G.SYS.filter(s=>G.sysOpen(s)&&G.S.ore>=s.cost).sort((a,b)=>a.cost-b.cost);
         if(!open.length)break;
         if(!G.claimSystem(open[0]))break;
       }
     }
     function doBuild(){
       const reserve=claimReserve();
       for(let k=0;k<600;k++){
         let best=null,bv=0;
         for(const s of G.builtSystems()){
           for(const gi of G.sysLadder(s.id)){
             if(!G.tierBuildable(s.id,gi))continue;
             if(G.ladderMaxAff(s.id,gi)<1)continue;
             const c=G.ladderCost(s.id,gi,1); if(c>G.S.ore-reserve)continue;
             const gain=G.ladderGain(s.id,gi,1), isOre=G.GENS[gi].kind==="ore";
             const v=(isOre?gain:gain*(SHADOW[s.res]||0))/c;
             if(v>bv){ bv=v; best={id:s.id,gi} }
           }
         }
         if(!best||bv<=0)break;
         G.S.buy=1; if(!G.ladderBuy(best.id,best.gi))break;
       }
     }
     let elapsed=0, simMin=0;
     function activeMinute(tapEarly){
       for(let s=0;s<60;s++){
         G.tick(1); elapsed+=1/60;
         if(tapEarly && s%3===0) G.doScan(null);
         while(G.pendingLevels()>0){
           const off=G.lvOffer(); if(!off||!off.length)break;
           if(!G.takeLevel(off[0]))break;
         }
       }
       simMin++; if(G.level()>=12 && simMin%30===0) G.grantXp('sim:rw:'+simMin+':'+Math.random(), 12, null);
       G.claimAllMissions&&G.claimAllMissions();
       doResearch(); doProg(); doClaims(); doBuild();
     }
     function offlineJump(minutes){
       const capS=G.offlineCapH()*3600, eff=0.5+0.10*((G.S.nx&&G.S.nx.chr)||0);
       const t=Math.min(minutes*60, capS), rr=G.rate(), cr=G.cryRate();
       G.S.ore+=rr*t*eff; G.S.all+=rr*t*eff; G.S.cry+=cr*t*eff;
       for(const e of G.EXO){ const er=G.exoRate(e.id); if(er>0) G.S.exo[e.id]=(G.S.exo[e.id]||0)+er*t*eff; }
       elapsed+=minutes;
       while(G.pendingLevels()>0){ const off=G.lvOffer(); if(!off||!off.length)break; if(!G.takeLevel(off[0]))break; }
     }
     function ring3Held(){ return G.SYS.some(s=>s.ring===3 && G.sysHeld(s.id)); }
     const DAY_CAP=45;            // safety cap per cycle - keeps total wall time bounded
     const results=[];
     for(let cycle=1;cycle<=n;cycle++){
       elapsed=0; simMin=0;
       let ring3At=null;
       for(let i=0;i<30;i++) G.doScan(null);
       for(let m=1;m<=180 && G.level()<40;m++){
         activeMinute(m<10);
         if(ring3At===null && ring3Held()) ring3At=elapsed;
       }
       for(let day=1; day<=DAY_CAP && G.level()<40; day++){
         for(let m=0;m<DAY_ACTIVE_MIN;m++){
           activeMinute(false);
           if(ring3At===null && ring3Held()) ring3At=elapsed;
         }
         offlineJump(1440-DAY_ACTIVE_MIN);
         if(ring3At===null && ring3Held()) ring3At=elapsed;
       }
       results.push({ cycle, level:G.level(), reachedL40:G.level()>=40,
         elapsedDays:+(elapsed/1440).toFixed(2), ring3AtMin:ring3At===null?null:+ring3At.toFixed(1),
         legacyAfter:null, dmAfter:null });
       if(cycle<n){
         G.S.lvl=Math.max(G.S.lvl,30); G.S.xpn=Math.max(G.S.xpn||0, G.xpNeed(G.S.lvl));
         G.doCollapse(true);
         results[results.length-1].legacyAfter=G.S.legacy;
         results[results.length-1].dmAfter=G.S.dm;
       }
     }
     out.push('=========== CYCLES REPORT (--cycles '+n+') ===========');
     for(const r of results){
       out.push('cycle '+r.cycle+': level='+r.level+(r.reachedL40?'':' (DID NOT REACH 40 within '+DAY_CAP+'d cap)')+
         ' elapsed='+r.elapsedDays+'d ring3First='+(r.ring3AtMin===null?'NEVER':(r.ring3AtMin/1440).toFixed(3)+'d ('+r.ring3AtMin+'m)')+
         (r.legacyAfter!==null?'  -> collapse: legacy='+r.legacyAfter+' dm='+G.fmt(r.dmAfter):''));
     }
     if(results.length>=2 && results[0].ring3AtMin && results[1].ring3AtMin){
       const ratio=results[1].ring3AtMin/results[0].ring3AtMin;
       out.push('ring-3 pacing ratio, cycle2/cycle1 = '+ratio.toFixed(3)+'  (target ~0.60 per the plan)');
       out.push(ratio>0.85 ? 'FAR OFF target on the SLOW side - see HANDOVER'
         : (ratio<0.35 ? 'FAR OFF target on the FAST side (second cycle snowballs harder than 60%) - see HANDOVER for the Legacy-tuning investigation'
         : 'within a reasonable band of the 60% target'));
     } else {
       out.push('ring-3 pacing ratio: not computable (one or both cycles never claimed a ring-3 system within the day cap)');
     }
     return out;
   }, {n:CYCLES, DAY_ACTIVE_MIN});
   console.log(rc.join('\n'));
   console.log(errs.length?'ERRORS\n'+errs.join('\n'):'NO JS ERRORS');
   await b.close();
   return;
 }

 const r = await p.evaluate((cfg)=>{
   const {FREE,ACTIVE_PHASE_MIN,DAY_ACTIVE_MIN,MAX_DAYS,CASCADE_GAP_MIN,SITTING_MIN}=cfg;
   /* Deterministic RNG — rollOffer() (which perk you're offered on level-up) calls
      Math.random(), which made repeated tuning runs of the same constants disagree
      with each other (a genuine confound, not sim noise to shrug off). Seeded so
      every run of this script, for the same constants, produces the same timeline. */
   (function seedRandom(seed){
     let s=seed>>>0;
     Math.random=function(){ s=(s+0x6D2B79F5)>>>0; let t=s;
       t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
       return ((t^(t>>>14))>>>0)/4294967296; };
   })(0xC0FFEE);
   const G=window.__SD, out=[];
   const marks=[10,30,60,120,180,240,300,360,420,480,600,720];

   const claimTimes={};             // sys id -> elapsed minutes at first claim
   let simMin=0;
   /* deeds-XP ledger: which milestone keys fired in each active minute, and how much XP -
      the tuning view for "why did 5 levels land at once" */
   const xpLog=[]; let xpSeenKeys=new Set(), xpLast=0;
   function xpLedger(){
     const keys=Object.keys(G.S.xf||{}), fresh=keys.filter(k=>!xpSeenKeys.has(k));
     if(fresh.length){ const x=G.S.xpn||0; xpLog.push({min:Math.round(elapsed), dx:x-xpLast, keys:fresh, lvl:G.level()}); xpLast=x; fresh.forEach(k=>xpSeenKeys.add(k)); }
   }
   const lvlReadyTimes={}, costReadyTimes={}; // sys id -> elapsed minutes each gate cleared
   const xpAtCost={};   // XP banked at the moment each system's ore cost was first affordable (deeds-XP tuning)
   const levelUps=[];               // [{min, level}] every accepted level-up
   const researchDone={};           // resh id -> elapsed minutes reaching max
   const CORE_RESH=["drill","amp","cryo","cold","auto","void"]; // crystal-priced core tree;
     // pdef/bat/bul are salvage-priced (combat loot) and never reachable by this
     // sim's policy since it never fields a fleet — excluded from "tech tree clear",
     // flagged in the output instead of silently coming up empty.

   let elapsed=0;
   /* justOffline: true for the single tick immediately following an offlineJump(),
      so any pendingLevels() drained in that tick (the "welcome back" lump) get
      tagged catchup:true on the levelUps entry - a real multi-level jump from
      hours of unattended production landing at once, not a cascade earned by
      continuous active play. Cleared after that first tick regardless of whether
      anything was actually pending, so it only ever covers the one tick. */
   let justOffline=false;

   /* exotic programmes (XPROG): the sim never bought these before 2026-09-09, which is
      why it never saw the post-level-20 production runaway the owner hit in play. Buys
      the cheapest affordable level each minute, keeping half the exotic back so tier
      gates that eat the same pile still get fed. */
   function doProg(){
     if(!G.XPROG||!G.buyXp)return;
     for(let k=0;k<10;k++){
       let best=null,bc=Infinity;
       for(const r of G.XPROG){ const l=G.xlv(r.id); if(l>=r.max)continue;
         const c=G.xpCost(r,l); if(c*2<=G.exo(r.x)&&c<bc){bc=c;best=r} }
       if(!best)break;
       if(!G.buyXp(best))break;
     }
   }
   function doResearch(){
     for(let k=0;k<20;k++){
       let best=null,bc=Infinity;
       for(const rr of G.RESH){ const l=(G.S.rs[rr.id]||0); if(l>=rr.max)continue;
         if(rr.req&&(G.S.rs[rr.req.id]||0)<rr.req.lv)continue;
         const bal=G.resBal(rr);
         const c=rr.c*Math.pow(rr.cg,l); if(c<=bal&&c<bc){bc=c;best=rr} }
       if(!best)break;
       if(!G.buyRes(best))break;
     }
     for(const rr of G.RESH){ if((G.S.rs[rr.id]||0)>=rr.max && researchDone[rr.id]===undefined)
       researchDone[rr.id]=elapsed; }
   }
   function trackGateReadiness(){
     for(const s of G.SYS){ if(s.home)continue;
       if(lvlReadyTimes[s.id]===undefined && G.level()>=s.lvl) lvlReadyTimes[s.id]=elapsed;
       if(costReadyTimes[s.id]===undefined && G.S.ore>=s.cost){ costReadyTimes[s.id]=elapsed; xpAtCost[s.id]=G.S.xpn||0; }
     }
   }
   function doClaims(){
     trackGateReadiness();
     for(let k=0;k<8;k++){
       const open=G.SYS.filter(s=>G.sysOpen(s)&&(FREE||G.S.ore>=s.cost)).sort((a,b)=>a.cost-b.cost);
       if(!open.length)break;
       if(FREE)G.S.ore=Math.max(G.S.ore,open[0].cost);
       const id=open[0].id;
       if(!G.claimSystem(open[0]))break;
       if(claimTimes[id]===undefined)claimTimes[id]=elapsed;
     }
   }
   /* Shadow price, ore per unit of each exotic: the cheapest ore-ladder gate tier that
      exotic unlocks, cost/exoC. Without this, ladderGain()'s raw units (ore/s for an
      ore-ladder row, EXOTIC/s for a kind-ladder row) get compared directly as if they
      were the same currency - exotic/s is always a tiny raw number next to ore/s, so
      a naive gain/cost greedy NEVER buys a kind-ladder tier and every belt/ice/void
      system sits permanently unbuilt even once claimed. This is a sim-fidelity fix
      (how the simulated player values a purchase), not a game-mechanic change - the
      real UI shows both numbers and lets a human weigh them; the sim needs a stand-in
      for that judgement to measure the milestones the exotic gates actually produce. */
   const SHADOW={};
   for(const g of G.GENS){ if(g.kind==="ore" && g.exo){
     const v=g.b/g.exoC; if(SHADOW[g.exo]===undefined||v<SHADOW[g.exo])SHADOW[g.exo]=v;
   }}
   /* A player with a system in reach saves toward it rather than dumping every last
      unit of ore into marginal tier buys the instant it's held - the greedy "spend
      everything on best value" buyer otherwise never accumulates the lump a big claim
      needs (ore never pools; doBuild would always find SOME tier worth buying with
      it), so a reachable claim would never resolve in active play at all, only ever
      via an offline lump-sum. This reserve is the sim's stand-in for that judgement
      call, not a new game mechanic. */
   const SAVE_HORIZON_S=4*3600; /* only start hoarding once the target is within reach -
     a player does not freeze all building for HOURS chasing a claim that's still far
     off (that starves the very economy that would get them there); once it's within
     this horizon at the CURRENT rate, saving the last stretch is realistic. */
   function claimReserve(){
     const pending=G.SYS.filter(s=>!s.home && !G.sysHeld(s.id) && !G.sysOwner(s) && G.level()>=s.lvl);
     if(!pending.length)return 0;
     const cheapest=Math.min(...pending.map(s=>s.cost));
     const r=G.rate();
     if(r>0 && cheapest>r*SAVE_HORIZON_S)return 0;
     return cheapest;
   }
   function doBuild(){
     const reserve=claimReserve();
     for(let k=0;k<600;k++){
       let best=null,bv=0;
       for(const s of G.builtSystems()){
         for(const gi of G.sysLadder(s.id)){
           if(!G.tierBuildable(s.id,gi))continue;
           if(G.ladderMaxAff(s.id,gi)<1)continue;
           const c=G.ladderCost(s.id,gi,1); if(c>G.S.ore-reserve)continue;
           const gain=G.ladderGain(s.id,gi,1);
           const isOre=G.GENS[gi].kind==="ore";
           const v=(isOre?gain:gain*(SHADOW[s.res]||0))/c;
           if(v>bv){ bv=v; best={id:s.id,gi} }
         }
       }
       if(!best||bv<=0)break;
       G.S.buy=1;
       if(!G.ladderBuy(best.id,best.gi))break;
     }
   }
   /* one minute of the continuous engaged-play loop, second-granular level checks so
      cascades (milestone 5) are measured to the second, not just the minute. */
   function activeMinute(tapEarly){
     for(let s=0;s<60;s++){
       G.tick(1); elapsed+=1/60;
       if(tapEarly && s%3===0) G.doScan(null);
       while(G.pendingLevels()>0){
         const off=G.lvOffer(); if(!off||!off.length)break;
         if(!G.takeLevel(off[0]))break;
         levelUps.push({min:elapsed, level:G.level(), catchup:justOffline});
       }
       if(justOffline)justOffline=false;
     }
     /* deeds-XP stand-in: csim never raids or defends, so it never sees raidWin/defHeld XP.
        A player winning a few raids an hour banks roughly this much - flat, labelled, sim-only. */
     simMin=(simMin||0)+1; if(G.level()>=12 && simMin%30===0) G.grantXp('sim:rw:'+simMin, 12, null);
     G.claimAllMissions&&G.claimAllMissions();
     doResearch(); doProg();
     doClaims();
     doBuild();
     xpLedger();
   }
   /* offline accrual — replicates offlineReport()'s own math (a single snapshot-rate
      application over the capped/discounted away time), not a scaled tick(). */
   function offlineJump(minutes){
     const capS=G.offlineCapH()*3600, eff=0.5+0.10*((G.S.nx&&G.S.nx.chr)||0);
     const t=Math.min(minutes*60, capS);
     const rr=G.rate(), cr=G.cryRate();
     G.S.ore+=rr*t*eff; G.S.all+=rr*t*eff; G.S.cry+=cr*t*eff;
     for(const e of G.EXO){ const er=G.exoRate(e.id); if(er>0) G.S.exo[e.id]=(G.S.exo[e.id]||0)+er*t*eff; }
     elapsed+=minutes;
     justOffline=true; /* next activeMinute's first tick drains any newly-pending
       levels as a tagged catchup burst, see justOffline declaration above. */
   }

   for(let i=0;i<30;i++) G.doScan(null);

   /* ---------------- exotic-gate feeder/afford tracking, checked every step ------- */
   const GATE_TIERS = G.GENS.map((g,gi)=>({gi,g})).filter(x=>x.g.exo && x.g.kind==="ore");
   const feederTime={};   // exo id -> elapsed min when a producing system hit 2 owned tiers
   const affordTime={};   // gi -> elapsed min when that gate tier is buyable (ore+exotic)
   function checkGates(){
     for(const {gi,g} of GATE_TIERS){
       if(affordTime[gi]===undefined){
         const oreSys=G.builtSystems().filter(s=>G.ladderKindOf(s)==="ore");
         const buyable=oreSys.some(s=>G.tierBuildable(s.id,gi) && G.ladderMaxAff(s.id,gi)>=1);
         if(buyable) affordTime[gi]=elapsed;
       }
     }
     for(const e of G.EXO){
       if(feederTime[e.id]!==undefined)continue;
       const producer=G.SYS.find(s=>s.res===e.id && G.sysHeld(s.id) &&
         (()=>{ const l=G.sysLadder(s.id); return l.length>=2 && G.sysTierCount(s.id,l[0])>0 && G.sysTierCount(s.id,l[1])>0; })());
       if(producer) feederTime[e.id]=elapsed;
     }
   }

   /* ---------------- Phase 1: dense active play, first 12h ---------------- */
   for(let min=1;min<=ACTIVE_PHASE_MIN;min++){
     activeMinute(min<10);
     checkGates(); /* every active minute, not just at phase boundaries - the early
       gates (tiers 4/5, fed by ring-1 systems) resolve inside this window, and a
       once-per-phase check would round their delay down to "same day" instead of
       reporting the real few-minutes-to-few-hours figure. */
     if(marks.includes(min)) out.push(`t=${String(min).padStart(3)}m rate=${G.fmt(G.rate())}/s all=${G.fmt(G.S.all)} cry=${G.fmt(G.S.cry)} exo=${G.fmt(G.exo('ir')+G.exo('he')+G.exo('xe')+G.exo('am'))} structs=${G.tot()} mult=${G.fmt(G.globalMul())} miss=${G.S.mi} LVL=${G.level()} xp=${G.S.xpn||0} gm=${G.fmt(G.globalMul())} frame=${G.xlv('frame')} yield=${G.xlv('yield')} latt=${G.xlv('latt')} drill=${G.S.rs.drill||0} sys=${G.builtSystems().length} tiersOwned=${G.builtSystems().reduce((a,s)=>a+G.sysLadder(s.id).filter(gi=>G.sysTierCount(s.id,gi)>0).length,0)}`);
   }
   checkGates();

   /* ---------------- Phase 2: day cycles, active+offline, weeks-scale ------------- */
   const CLAIMABLE = G.SYS.filter(s=>!s.home && !G.GARRISON[s.id]).map(s=>s.id); // 10 systems
   function mapMaxed(){
     if(!CLAIMABLE.every(id=>G.sysHeld(id)))return false;
     const oreLast=G.LADDERS.ore[G.LADDERS.ore.length-1];
     if(!G.builtSystems().some(s=>G.ladderKindOf(s)==="ore" && G.sysTierCount(s.id,oreLast)>0))return false;
     for(const k of G.LADDER_KINDS){
       if(k==="ore")continue;
       /* belt has zero claimable systems (tan and sab are BOTH pre-owned by a rival in
          GARRISON, from the base map data, unrelated to this pacing pass) - its
          marquee can never be built without an invasion this sim doesn't model, same
          caveat as ring 4. Excluded here the same way ring 4 is excluded from the
          ring-claim milestone, not counted as a map-maxing requirement. */
       if(k==="belt")continue;
       const last=G.ladderMarquee(k);
       if(!G.builtSystems().some(s=>G.ladderKindOf(s)===k && G.sysTierCount(s.id,last)>0))return false;
     }
     return true;
   }
   let maxedDay=null;
   /* Also keep running past both original milestones until level 60 is actually
      reached (or MAX_DAYS runs out) - [5b]'s levels-21-60 check is otherwise only
      validated up to whatever level the sim happened to hit when map-maxing and
      the exotic gates finished, which is not guaranteed to cover the whole range
      this pacing pass targets. */
   for(let day=1;day<=MAX_DAYS && (maxedDay===null || GATE_TIERS.some(({gi})=>affordTime[gi]===undefined) || G.level()<60);day++){
     for(let m=0;m<DAY_ACTIVE_MIN;m++) activeMinute(false);
     offlineJump(1440-DAY_ACTIVE_MIN);
     checkGates();
     if(maxedDay===null && mapMaxed()) maxedDay=day;
     if(day%10===0) out.push(`  [phase2] day=${day} elapsed=${(elapsed/1440).toFixed(1)}d rate=${G.fmt(G.rate())}/s sys=${G.builtSystems().length}/${CLAIMABLE.length} exo=${G.fmt(G.exo('ir')+G.exo('he')+G.exo('xe')+G.exo('am'))} lvl=${G.level()}`);
     if(maxedDay!==null && GATE_TIERS.every(({gi})=>affordTime[gi]!==undefined) && day>maxedDay+5 && G.level()>=60) break;
   }

   out.push('');
   out.push('=========== MILESTONE REPORT ===========');

   /* ---- 1 & 2: first claim per ring ---- */
   const ringFirst={};
   for(const id in claimTimes){ const s=G.SYSMAP[id]; if(s.ring==null)continue;
     if(ringFirst[s.ring]===undefined || claimTimes[id]<ringFirst[s.ring]) ringFirst[s.ring]=claimTimes[id]; }
   out.push('[1&2] First claim per ring (active-play minutes):');
   for(const ring of [1,2,3]){
     const t=ringFirst[ring];
     out.push(`   ring ${ring}: ${t===undefined?'NEVER (within '+ACTIVE_PHASE_MIN+'m active phase)':t.toFixed(1)+'m'}`);
   }
   if(ringFirst[1]!==undefined && ringFirst[2]!==undefined) out.push(`   ratio ring2/ring1 = ${(ringFirst[2]/ringFirst[1]).toFixed(2)}x`);
   if(ringFirst[2]!==undefined && ringFirst[3]!==undefined) out.push(`   ratio ring3/ring2 = ${(ringFirst[3]/ringFirst[2]).toFixed(2)}x`);
   out.push('   ring 4 is 100% rival-held (GARRISON) — first "claim" there requires an');
   out.push('   invasion this sim does not model. Not reported as a claim time; see');
   out.push('   write-up for the level-gate proxy used instead.');

   /* ---- 3: exotic-gate afford delay ---- */
   out.push('[3] Exotic-gated ore-tier afford delay vs its feeder (elapsed minutes, mixed active+offline):');
   for(const {gi,g} of GATE_TIERS){
     const ft=feederTime[g.exo], at=affordTime[gi];
     const line=`   tier ${gi} (${g.n}, needs ${g.exo}): feeder-ready=${ft===undefined?'never':(ft/1440).toFixed(2)+'d'} afford=${at===undefined?'never':(at/1440).toFixed(2)+'d'}`+
       (ft!==undefined&&at!==undefined ? `  delay=${((at-ft)/1440).toFixed(2)}d` : '');
     out.push(line);
   }

   /* ---- 4: days to max the map ---- */
   out.push(`[4] Map maxed (10 claimable systems + every ladder marquee owned): ${maxedDay===null?'NOT within '+MAX_DAYS+' days':maxedDay+' days'}`);

   /* ---- 5: level-up cascade past level 10 ----
      Two figures, on purpose. "All" includes level-ups taken right after a Phase-2
      offline jump lands a multi-hour lump of ore in one shot - a real multi-level
      catch-up, same as any idle game's "welcome back" screen, and not what the
      milestone is about. The ACTIVE-ONLY figure (Phase 1: one continuous session,
      no offline jump at all) is the one that actually answers "does active play
      cascade past level 10," and is reported as the headline number. */
   function cascadeStats(list){
     let minGap=Infinity, worst=null, violations=0;
     for(let i=1;i<list.length;i++){
       const gap=list[i].min-list[i-1].min;
       if(gap<minGap){minGap=gap; worst={a:list[i-1],b:list[i],gap}}
       if(gap<CASCADE_GAP_MIN)violations++;
     }
     return {minGap,worst,violations,n:list.length};
   }
   const past10=levelUps.filter(x=>x.level>10);
   const past10Active=past10.filter(x=>x.min<=ACTIVE_PHASE_MIN);
   const allStats=cascadeStats(past10), activeStats=cascadeStats(past10Active);
   out.push(`[5] Level-ups past level 10 - ACTIVE-ONLY (Phase 1, one continuous ${ACTIVE_PHASE_MIN}m session, no offline jumps): ${activeStats.n} taken.`+
     (activeStats.n>1 ? ` Smallest gap=${activeStats.minGap.toFixed(2)}m (levels ${activeStats.worst.a.level}->${activeStats.worst.b.level} at t=${activeStats.worst.a.min.toFixed(1)}/${activeStats.worst.b.min.toFixed(1)}). Violations (<${CASCADE_GAP_MIN}m apart): ${activeStats.violations}/${activeStats.n-1} gaps.` : ' (fewer than 2 - no gap to measure).'));
   out.push(`     Including Phase-2 offline-jump catch-up levels (NOT active play, not counted against milestone 5): ${allStats.n} total, ${allStats.violations}/${Math.max(0,allStats.n-1)} gaps <${CASCADE_GAP_MIN}m.`);

   /* ---- 5b: level-range cascade breakdown, ACTIVE PLAY ONLY, across BOTH phases ----
      levelUps entries are tagged catchup:true for the one tick right after an
      offlineJump() drains its pending lump (see justOffline above) - excluding those
      answers "does genuine active play cascade," for Phase 2's 60-active-min/day
      minutes too, not just Phase 1's single continuous session. Two ranges: 11-20
      (already covered by LVKMID, reported here too for a same-shape comparison) and
      21-60 - the range this pacing pass exists to fix (LVKHI governs it) and that the
      old past10/activeStats split never isolated on its own. */
   function rangeStats(lo,hi){
     const list=levelUps.filter(x=>x.level>lo && x.level<=hi && !x.catchup);
     return {list, stats:cascadeStats(list)};
   }
   const r1020=rangeStats(10,20), r2160=rangeStats(20,60);
   const maxLevelSeen=levelUps.length?Math.max(...levelUps.map(x=>x.level)):(G.level ? G.level() : 1);
   out.push(`[5b] Level-range cascade check, ACTIVE PLAY ONLY (both phases, offline catch-up excluded), <${CASCADE_GAP_MIN}m gap = violation:`);
   for(const [label,r] of [['levels 11-20',r1020],['levels 21-60',r2160]]){
     const s=r.stats;
     const verdict = s.n<2 ? 'N/A (fewer than 2 active level-ups in range)' : (s.violations===0?'PASS':'FAIL');
     out.push(`   ${label}: ${s.n} active level-ups, ${s.n>1?s.violations+'/'+(s.n-1)+' gaps <'+CASCADE_GAP_MIN+'m':'—'}`+
       (s.n>1?` (smallest=${s.minGap.toFixed(2)}m, levels ${s.worst.a.level}->${s.worst.b.level} at t=${s.worst.a.min.toFixed(1)}/${s.worst.b.min.toFixed(1)})`:'')+
       `  [${verdict}]`);
   }
   out.push(`   highest level reached this run: ${maxLevelSeen}`+(maxLevelSeen<60?'  *** SIM NEVER REACHED LEVEL 60 - the 21-60 check above is UNVALIDATED past level '+maxLevelSeen+' ***':' (range 21-60 fully exercised)'));

   /* ---- 5c: offline catch-up burst size, informational ----
      NOT a milestone-5 violation (a multi-level "welcome back" lump after real
      offline time is expected/intended, same convention as [5]'s two figures) -
      but a same-instant burst of several levels is still the qualitative
      "pile up multiple levels almost at once" symptom this pass targets, so it's
      worth watching even though it doesn't count against the pass/fail above.
      A maximal run of consecutive catchup:true entries = levels that landed in the
      exact same tick, right after one offlineJump(). */
   function catchupBursts(list){
     const bursts=[]; let cur=0;
     for(const x of list){ if(x.catchup)cur++; else { if(cur>0)bursts.push(cur); cur=0; } }
     if(cur>0)bursts.push(cur);
     return bursts;
   }
   const bursts2160=catchupBursts(levelUps.filter(x=>x.level>20 && x.level<=60));
   out.push(`[5c] Offline catch-up burst size, levels 21-60 (informational, not a milestone-5 violation): `+
     (bursts2160.length? `${bursts2160.length} bursts, sizes=[${bursts2160.join(',')}], largest=${Math.max(...bursts2160)} levels at once` : 'no offline catch-up bursts in this range'));

   /* ---- 6: research tech-tree clear time ---- */
   const coreDoneTimes=CORE_RESH.map(id=>researchDone[id]);
   const allCoreDone=coreDoneTimes.every(t=>t!==undefined);
   const clearTime=allCoreDone?Math.max(...coreDoneTimes):null;
   out.push(`[6] Core research tree (${CORE_RESH.join(',')}) fully cleared at: `+
     (clearTime===null?`NOT within ${ACTIVE_PHASE_MIN}m active phase (${CORE_RESH.filter(id=>researchDone[id]===undefined).length}/${CORE_RESH.length} nodes unfinished)`:clearTime.toFixed(1)+'m')+
     `  (target: NOT clearable within a ${SITTING_MIN}m sitting)`);
   out.push('   (pdef/bat/bul excluded — salvage-priced, combat-gated, unreachable by this sim\'s buy-everything-affordable policy)');

   out.push('');
   out.push('---- raw per-system claim times (active-phase minutes, NEVER = not claimed within phase 1) ----');
   for(const s of G.SYS){ if(s.home)continue;
     const lr=lvlReadyTimes[s.id], cr=costReadyTimes[s.id];
     out.push(`   ${s.id} (ring${s.ring}, lvl${s.lvl}, cost${G.fmt(s.cost)}): claimed=${claimTimes[s.id]===undefined?'NEVER':claimTimes[s.id].toFixed(1)+'m'} lvlReady=${lr===undefined?'never':lr.toFixed(1)+'m'} costReady=${cr===undefined?'never':cr.toFixed(1)+'m'} xpAtCost=${xpAtCost[s.id]===undefined?'-':xpAtCost[s.id]} need=${G.xpNeed(s.lvl)}`); }

   const highestOre=Math.max(-1,...G.builtSystems().flatMap(s=>G.sysLadder(s.id).filter(gi=>G.GENS[gi].kind==='ore'&&G.sysTierCount(s.id,gi)>0)));
   out.push('highest ORE-ladder tier actually bought: '+highestOre+' of '+(G.LADDERS.ore.length-1));
   const kindTiers={};
   for(const k of G.LADDER_KINDS){ if(k==='ore')continue;
     kindTiers[k]=Math.max(-1,...G.builtSystems().flatMap(s=>G.sysLadder(s.id).filter(gi=>G.GENS[gi].kind===k&&G.sysTierCount(s.id,gi)>0))); }
   out.push('highest tier bought per kind ladder: '+JSON.stringify(kindTiers));
   out.push('---- deeds-XP ledger, first 90 active minutes (minute: +xp [keys]) ----');
   for(const e of xpLog){ if(e.min>90)break; out.push('   '+String(e.min).padStart(3)+'m L'+e.lvl+' +'+e.dx+'  '+e.keys.slice(0,12).join(' ')+(e.keys.length>12?' +'+(e.keys.length-12)+' more':'')); }
   out.push('final elapsed: '+(elapsed/1440).toFixed(1)+' days, level '+G.level()+', systems '+G.builtSystems().length+'/'+(G.SYS.length-1));
   return out;
  }, {FREE,ACTIVE_PHASE_MIN,DAY_ACTIVE_MIN,MAX_DAYS,CASCADE_GAP_MIN,SITTING_MIN});
 console.log(r.join('\n'));
 console.log(errs.length?'ERRORS\n'+errs.join('\n'):'NO JS ERRORS');
 await b.close();
})();
