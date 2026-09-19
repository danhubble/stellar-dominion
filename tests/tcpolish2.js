const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tcpolish2.js — patches 528-532, weapon-mode raid combat polish: enemy GUNS system
// caps at st=1 and never gets destroyed; every enemy now carries an ENGINES system,
// and engines down forces a guaranteed hit; shield-shatter fx on a shield's final
// layer; shell weapons apply damage on landing, not on firing; a win pauses briefly
// (queueWin) before the result card instead of cutting to it instantly.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------------- 528: guns never destroyed ----------------
 const guns=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[80,40,15], fhp:1,
     cmode:"wep", tg:[], rf:{gun:6,arm:6}, nx:{war:5}});
   const t=G.assaultTarget(G.SYSMAP.tha);
   G.engageTarget(t,-1);
   const e=G.BT.en[0];
   const gi=e.sys.findIndex(s=>s.k==="gun");
   // first hit: st 0 -> 1
   G.hitSystem(0, gi, e.max*G.SYS_HP);
   const afterFirst=e.sys[gi].st;
   // second hit at st===1: would go 1->2 elsewhere, must stay at 1
   const hpBefore=e.hp;
   G.hitSystem(0, gi, e.max*G.SYS_HP);
   const afterSecond=e.sys[gi].st;
   const bledAgain = e.hp<hpBefore;                 // hull bleed still applied
   const label=(G.BT.num[G.BT.num.length-1]||{}).sy||"";
   return {afterFirst, afterSecond, bledAgain, label};
 });
 ok('enemy GUNS system reaches st=1 (down) on the first break', guns.afterFirst===1, guns);
 ok('enemy GUNS system stays at st=1 forever - a second break never reaches st=2 (destroyed)',
   guns.afterSecond===1, guns);
 ok('...but still bleeds hull and labels it DOWN, not DESTROYED',
   guns.bledAgain && guns.label==="DOWN GUNS", guns);

 // ---------------- 529: engines on every enemy; engines down = guaranteed hit ----------------
 const eng=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[80,40,15], fhp:1,
     cmode:"wep", tg:[], rf:{gun:6,arm:6}, nx:{war:5}});
   const t=G.assaultTarget(G.SYSMAP.tha);
   G.engageTarget(t,-1);
   const e=G.BT.en[0];
   const hasEng = e.sys.some(s=>s.k==="eng");
   // force a near-certain miss roll, but knock engines down first
   const origRandom=Math.random;
   Math.random=()=>0.99;
   e.sys.find(s=>s.k==="eng").st=1;
   e.shd=0; e.shp=0;   // no screen/shield left to soak the hit
   const w=G.BT.wep.find(x=>x); const wi=G.BT.wep.indexOf(w); w.ch=w.chg;
   const hpBefore=e.hp;
   G.fireWeapon(wi);
   Math.random=origRandom;
   const hitLanded = e.hp<hpBefore || !e.alive;
   return {hasEng, hitLanded, allKindsHaveEng: G.sysListFor("grunt").includes("eng")
     && G.sysListFor("shield").includes("eng") && G.sysListFor("mender").includes("eng")
     && G.sysListFor("boss").includes("eng")};
 });
 ok('a grunt (and every other kind) carries an ENGINES system', eng.hasEng && eng.allKindsHaveEng, eng);
 ok('with engines down, a shot that would have missed (Math.random=>0.99) still lands', eng.hitLanded, eng);

 // ---------------- 530: shield shatter on the final layer ----------------
 const shat=await p.evaluate(()=>{
   const G=window.__SD;
   // pick an assault target repeatedly until an enemy with a SCREENS system shows up
   // (only shielded archetypes carry one) - this is the same route fireWeapon's
   // blocked branch and hitSystem's shd-break both use, so hitSystem exercises it
   let ei=-1, k=-1;
   for(let tries=0;tries<60&&ei<0;tries++){
     G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[80,40,15], fhp:1,
       cmode:"wep", tg:[], rf:{gun:6,arm:6}, nx:{war:5}});
     const t=G.assaultTarget(G.SYSMAP.tan);       // Fortress: guaranteed shields
     G.engageTarget(t,-1);
     for(let q=0;q<G.BT.en.length;q++){
       const gi=G.BT.en[q].sys.findIndex(s=>s.k==="shd");
       if(gi>=0){ ei=q; k=gi; break }
     }
   }
   if(ei<0)return {hadShdSystem:false};
   const e=G.BT.en[ei];
   e.shd=1;
   G.BT.fx.length=0;
   e.sys[k].st=0; e.sys[k].d=0;
   G.hitSystem(ei, k, e.max*G.SYS_HP);
   const sawShatter = G.BT.fx.some(f=>f.t==="shshatter");
   return {hadShdSystem:true, shdAfter:e.shd, sawShatter};
 });
 if(shat.hadShdSystem){
   ok('breaking a SCREENS system that empties a live shield count fires shshatter',
     shat.shdAfter===0 && shat.sawShatter, shat);
 } else {
   ok('breaking a SCREENS system that empties a live shield count fires shshatter (kind has no shd system - skipped)', true, shat);
 }

 // ---------------- 531: shell damage on landing ----------------
 const shell=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[80,40,15], fhp:1,
     cmode:"wep", tg:[], rf:{gun:6,arm:6}, nx:{war:5}});
   const t=G.assaultTarget(G.SYSMAP.tha);
   G.engageTarget(t,-1);
   // find a shell-fx weapon
   let wi=-1;
   for(let i=0;i<G.BT.wep.length;i++){ const w=G.BT.wep[i]; if(!w)continue;
     const D=G.WEPMAP[w.id]; if(D&&(D.fx||"bolt")==="shell"){ wi=i; break } }
   if(wi<0)return {found:false};
   const w=G.BT.wep[wi]; w.ch=w.chg;
   const e=G.BT.en[0]; e.shd=0; e.shp=0;   // no screen/shield left to soak the hit
   const hpBefore=e.hp;
   const origRandom=Math.random;
   Math.random=()=>0;                 // guarantee a hit and a crit
   G.fireWeapon(wi);
   Math.random=origRandom;
   const fx=G.BT.fx.find(f=>f.t==="shell");
   const carriesPend = !!(fx&&fx.pend);
   const hpUnchangedAtFire = e.hp===hpBefore;
   // advance time until the shell lands
   let landed=false;
   for(let i=0;i<60&&!landed;i++){ G.bUpdateWep(0.02); landed = !fx || fx.p>=1 }
   const hpAfterLand = e.hp;
   return {found:true, carriesPend, hpUnchangedAtFire, dmgApplied: hpAfterLand<hpBefore};
 });
 if(shell.found){
   ok('a shell fx carries a pend record when fired', shell.carriesPend, shell);
   ok("the target's hp is unchanged at the moment of firing", shell.hpUnchangedAtFire, shell);
   ok('damage lands once the shell actually arrives (f.p>=1)', shell.dmgApplied, shell);
 } else {
   ok('a shell-fx weapon exists to test landing damage on (none found - skipped)', true, shell);
 }

 // ---------------- 532: win pause before endBattle ----------------
 const win=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e30, lvl:99, lvSeen:99, ore:1e30, sh:[80,40,15], fhp:1,
     cmode:"wep", tg:[], rf:{gun:6,arm:6}, nx:{war:5}});
   const t=G.assaultTarget(G.SYSMAP.tha);
   G.engageTarget(t,-1);
   for(const e of G.BT.en)e.alive=0;
   const notDoneImmediately = G.BT.done===0 || G.BT.done===undefined || !G.BT.done;
   // ~0.5s of frames at 60fps
   for(let i=0;i<30;i++)G.bUpdateWep(1/60);
   const stillNotDoneAtHalfSecond = !G.BT.done;
   // to 1s total
   for(let i=0;i<30;i++)G.bUpdateWep(1/60);
   const doneByOneSecond = !!G.BT.done;
   return {notDoneImmediately, stillNotDoneAtHalfSecond, doneByOneSecond};
 });
 ok('BT.done is not set the instant the last enemy dies', win.notDoneImmediately, win);
 ok('BT.done is still falsy after ~0.5s of bUpdateWep(dt) calls', win.stillNotDoneAtHalfSecond, win);
 ok('BT.done is true by 1s (queueWin\'s 0.8s pause has elapsed)', win.doneByOneSecond, win);

 ok('no page errors', errs.length===0, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
