const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
// tcollapse2.js — item 2 of PLAN-batch-sep10.md (patch570-572): Collapse, the long
// game. Checks the reset list and the carry list field by field (not just "some
// fields changed"), the payout/legacy formulas, the production/cost multiplier
// effect, the level-chip roman numeral, the level-30 gate (including the dev bypass),
// and that a collapsed save reloads with cyc/legacy intact.
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);

 // ---------------------------------------------------------- gate
 const gate=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:29, xpn:G.xpNeed(29)});
   const before29=G.collapseAvailable(), before29Try=G.doCollapse();
   G.S.lvl=30; G.S.xpn=G.xpNeed(30);
   const at30=G.collapseAvailable();
   return {before29, before29Try, at30};
 });
 ok('collapseAvailable() is false below level 30', gate.before29===false, gate);
 ok('doCollapse() (no force) refuses below level 30 and changes nothing', gate.before29Try===false, gate);
 ok('collapseAvailable() is true at level 30, no further requirement', gate.at30===true, gate);

 // ---------------------------------------------------------- payout / legacy formula
 const formula=await p.evaluate(()=>{
   const G=window.__SD;
   const cases=[30,40,50,65].map(l=>{
     G.S.lvl=l; G.S.xpn=G.xpNeed(l);
     return {l, gain:G.collapseLegacyGain(), payout:G.collapsePayout()};
   });
   return cases;
 });
 for(const c of formula){
   ok(`level ${c.l}: Legacy gain = level-20 = ${c.l-20}`, c.gain===(c.l-20), c);
   ok(`level ${c.l}: payout = 5*(level-20)^2 = ${5*(c.l-20)*(c.l-20)}`, c.payout===5*(c.l-20)*(c.l-20), c);
 }

 // ---------------------------------------------------------- reset list, field by field
 const reset=await p.evaluate(()=>{
   const G=window.__SD;
   const f=G.fresh();
   G.adopt({...f,
     lvl:40, xpn:G.xpNeed(40), xf:{a:1,b:1},
     ore:12345, cry:678, exo:{ir:99,he:5}, sv:321,
     sys:{home:{b:{0:5,1:2}}, kor:{b:{0:1}}},
     sh:[3,4,5], fhp:0.4, wep:{own:{pulse:1,laser:1},slot:["laser",null,null,null]},
     crew:[{id:'c1',n:'Real Hire',role:'cap',r:2}], bridge:['c1',null,null], crewPool:[],
     rs:{drill:3}, xp:{frame:2},
     pk:{cost:2}, pkLog:[{id:'cost',lv:12}], lvOffer:['cost','out'],
     mi:5, miq:[1,2],
     rv:{vasht:{p:0.9,cd:10,seen:1,w:2,mv:1}},
     thq:[{id:1,rv:'vasht',sysId:'kor',dif:1,t:100}], thqSeq:2, thrRep:[{a:1}], thrCd:5, rvExp:2,
     defw:3, defl:1, lfMark:null,
     trip:{sysId:'kor', kind:'assault', t0:0, dueAt:1e15},
     sd:{kor:2}, sdq:{kor:{to:3,dueAt:1e15}},
     mkt:{heat:{sv:{v:0.5,t:1},dm:{v:0.2,t:1}}, sold:true},
     dm:500, dmAll:900, nx:{ent:3}, ac:{a1:1,a2:1}, seen:{'vega:boot':true},
     wins:7, all:5e6, svAll:200, clicks:50
   });
   const before={ nx:{...G.S.nx}, ac:{...G.S.ac}, seen:{...G.S.seen},
     dm:G.S.dm, dmAll:G.S.dmAll, all:G.S.all, svAll:G.S.svAll, clicks:G.S.clicks, wins:G.S.wins };
   const payout=G.collapsePayout(), gain=G.collapseLegacyGain();
   const okCollapse=G.doCollapse();
   const S=G.S;
   return {
     before, payout, gain, okCollapse,
     lvl:S.lvl, xpn:S.xpn, xf:S.xf,
     ore:S.ore, cry:S.cry, exo:S.exo, sv:S.sv,
     sysKeys:Object.keys(S.sys), homeB:S.sys.home.b,
     sh:S.sh, fhp:S.fhp, wepSlot:S.wep.slot, wepOwn:S.wep.own,
     crewIsDeckhandsOnly: S.crew.length===3 && S.crew.every(c=>c.deck),
     bridge:S.bridge, crewPool:S.crewPool,
     rs:S.rs, xp:S.xp,
     pk:S.pk, pkLog:S.pkLog, lvOffer:S.lvOffer,
     mi:S.mi, miq:S.miq,
     rv:S.rv, thq:S.thq, thqSeq:S.thqSeq, thrRep:S.thrRep, thrCd:S.thrCd, rvExp:S.rvExp,
     defw:S.defw, defl:S.defl,
     trip:S.trip, sd:S.sd, sdq:S.sdq,
     mkt:S.mkt,
     wins:S.wins, winsAll:S.winsAll,
     dm:S.dm, dmAll:S.dmAll, nx:S.nx, ac:S.ac, seen:S.seen,
     all:S.all, svAll:S.svAll, clicks:S.clicks,
     cyc:S.cyc, legacy:S.legacy
   };
 });
 ok('doCollapse() returns true at a valid level', reset.okCollapse===true, reset.okCollapse);
 ok('level resets to 1, XP resets to 0, xf cleared', reset.lvl===1 && reset.xpn===0 && Object.keys(reset.xf).length===0, reset);
 ok('ore/crystal/exotics/salvage all reset to 0', reset.ore===0 && reset.cry===0 && Object.keys(reset.exo).length===0 && reset.sv===0, reset);
 ok('every system except home is gone, home\'s own buildings are cleared too', JSON.stringify(reset.sysKeys)==='["home"]' && Object.keys(reset.homeB).length===0, reset);
 ok('fleet resets (0 hulls, full hull%)', reset.sh.every(x=>x===0) && reset.fhp===1, reset);
 ok('weapons reset to the starter loadout', reset.wepSlot[0]==='pulse' && Object.keys(reset.wepOwn).length===0, reset);
 ok('crew resets to exactly the 3 Deckhands, bridge reseated on them, pool empty', reset.crewIsDeckhandsOnly && reset.bridge.filter(Boolean).length===3 && reset.crewPool.length===0, reset);
 ok('research resets', Object.keys(reset.rs).length===0, reset);
 ok('programmes reset', Object.keys(reset.xp).length===0, reset);
 ok('perks cleared (pk, pkLog, lvOffer)', Object.keys(reset.pk).length===0 && reset.pkLog.length===0 && reset.lvOffer===null, reset);
 ok('missions restart (mi, miq)', reset.mi===0 && reset.miq.length===0, reset);
 ok('rivals reset (S.rv empty)', Object.keys(reset.rv).length===0, reset);
 ok('threats cleared (thq/thqSeq/thrRep/thrCd/rvExp)', reset.thq.length===0 && reset.thqSeq===1 && reset.thrRep.length===0 && reset.thrCd===0 && reset.rvExp===0, reset);
 ok('S.trip cleared', reset.trip===null, reset);
 ok('S.sdq cleared', Object.keys(reset.sdq).length===0, reset);
 ok('S.mkt cleared back to the fresh shape', reset.mkt.sold===false && reset.mkt.heat.sv.v===0 && reset.mkt.heat.dm.v===0, reset);
 ok('defence levels (S.sd) reset (part of "every system except home")', Object.keys(reset.sd).length===0, reset);
 ok('S.defw/S.defl reset', reset.defw===0 && reset.defl===0, reset);

 // ---------------------------------------------------------- carry list, field by field
 ok('Dark Matter carries + the payout is added', reset.dm===reset.before.dm+reset.payout, reset);
 ok('dmAll carries + the payout is added', reset.dmAll===reset.before.dmAll+reset.payout, reset);
 ok('every Nexus purchase (S.nx) carries unchanged', JSON.stringify(reset.nx)===JSON.stringify(reset.before.nx), reset);
 ok('records (S.ac) carry unchanged', JSON.stringify(reset.ac)===JSON.stringify(reset.before.ac), reset);
 ok('VEGA beats seen (S.seen) carry, plus the new per-cycle beat gets added', reset.seen['vega:boot']===true, reset);
 ok('S.wins resets to 0 (gate-functional, not the carried stat)', reset.wins===0, reset);
 ok('S.winsAll carries the run\'s wins as a stat', reset.winsAll===reset.before.wins, reset);
 ok('all-time stats carry: S.all', reset.all===reset.before.all, reset);
 ok('all-time stats carry: S.svAll', reset.svAll===reset.before.svAll, reset);
 ok('all-time stats carry: S.clicks', reset.clicks===reset.before.clicks, reset);
 ok('S.cyc increments by 1', reset.cyc===1, reset);
 ok('S.legacy increases by collapseLegacyGain()', reset.legacy===reset.gain, reset);

 // ---------------------------------------------------------- Legacy's production/cost effect
 const legacyFx=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:1, sys:{home:{b:{0:50}}}, legacy:0});
   const baseMul=G.globalMul(), baseCost=G.ladderCost('home',0,1);
   G.S.legacy=10;
   const legMul=G.globalMul(), legCost=G.ladderCost('home',0,1);
   return { baseMul, legMul, ratio:legMul/baseMul, baseCost, legCost, costRatio:legCost/baseCost };
 });
 ok('10 Legacy points = ×1.20 production (2% each, multiplicative with the existing stack)',
   Math.abs(legacyFx.ratio-1.20)<1e-9, legacyFx);
 ok('10 Legacy points = structure cost ÷1.10 (1% each)',
   Math.abs(legacyFx.costRatio-1/1.10)<1e-9, legacyFx);

 // ---------------------------------------------------------- level chip roman numeral
 const chip=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:12, xpn:G.xpNeed(12), cyc:0});
   G.render();
   const noCyc=document.getElementById('runlbl').textContent;
   G.S.cyc=2; G.dirty=true; G.render();
   const withCyc=document.getElementById('runlbl').textContent;
   return {noCyc, withCyc, roman1:G.roman(1), roman2:G.roman(2), roman9:G.roman(9), roman40:G.roman(40)};
 });
 ok('no numeral on the chip at cycle 0', !chip.noCyc.includes('·'), chip);
 ok('chip shows "Level 12 · II" at cycle 2', chip.withCyc==='Level 12 · II', chip);
 ok('roman(1)="I", roman(9)="IX", roman(40)="XL"', chip.roman1==='I'&&chip.roman9==='IX'&&chip.roman40==='XL', chip);

 // ---------------------------------------------------------- dev bypass
 const dev=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:5, xpn:G.xpNeed(5)});
   const before=G.collapseAvailable();
   G.devAction('collapse');
   return {before, after:{lvl:G.S.lvl, cyc:G.S.cyc}};
 });
 ok('COLLAPSE NOW (dev) works below level 30 (ignores the gate)', dev.before===false && dev.after.lvl===1 && dev.after.cyc===1, dev);

 // ---------------------------------------------------------- reload after collapse
 const reload=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:40, xpn:G.xpNeed(40)});
   G.doCollapse();
   const before={cyc:G.S.cyc, legacy:G.S.legacy, dm:G.S.dm, nx:{...G.S.nx}};
   G.save();
   G.load();
   const after={cyc:G.S.cyc, legacy:G.S.legacy, dm:G.S.dm, nx:{...G.S.nx}};
   return {before, after};
 });
 ok('a collapsed save reloads with S.cyc/S.legacy/S.dm/S.nx intact',
   JSON.stringify(reload.before)===JSON.stringify(reload.after), reload);

 out.push(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(out.join('\n'));
 console.log(errs.length?'ERRORS\n'+errs.join('\n'):'NO JS ERRORS');
 await b.close();
})();
