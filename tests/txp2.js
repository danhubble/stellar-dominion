const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// txp2.js — Deeds XP: grantXp/xpNeed/earnedLevel core, migration, seeding, and every
// Stage 2/3 source (building, claiming, missions, raids, defence, research,
// programmes, records, crew). Folds in everything the one-off vxp1/vxp2/vxp3
// diagnostic scripts covered during development; those files are retired now that
// this is the permanent regression test.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:1280,height:860}});
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(700);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- grantXp() idempotency ----------
 const r1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   const first=G.grantXp('t1', 10, null); const xpnAfterFirst=G.S.xpn;
   const second=G.grantXp('t1', 10, null); const xpnAfterSecond=G.S.xpn;
   return {first, second, xpnAfterFirst, xpnAfterSecond};
 });
 ok('grantXp() pays the first call', r1.first && r1.xpnAfterFirst===10, r1);
 ok('grantXp() on the same key again returns false and pays nothing', !r1.second && r1.xpnAfterSecond===10, r1);

 // ---------- fresh save / xpNeed / earnedLevel ----------
 const r2=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   const xpnZero=G.S.xpn, earnedAtZero=G.earnedLevel();
   G.S.xpn=G.xpNeed(5); const earnedAt5=G.earnedLevel();
   const need5=G.xpNeed(5);
   G.S.xpn=G.xpNeed(5)-1; const earnedJustBelow5=G.earnedLevel();
   return {xpnZero, earnedAtZero, need5, earnedAt5, earnedJustBelow5};
 });
 ok('fresh save: S.xpn===0', r2.xpnZero===0, r2);
 ok('fresh save: earnedLevel()===1', r2.earnedAtZero===1, r2);
 ok('S.xpn=xpNeed(5): earnedLevel()===5', r2.earnedAt5===5, r2);
 ok('S.xpn=xpNeed(5)-1: earnedLevel()===4 (one XP short of 5)', r2.earnedJustBelow5===4, r2);

 const r2b=await p.evaluate(()=>({need2:window.__SD.xpNeed(2)}));
 ok('xpNeed(2)===38 (curve anchor)', r2b.need2===38, r2b);

 // ---------- ore no longer levels ----------
 const r3=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.all=1e12;
   return {earned:G.earnedLevel()};
 });
 ok('S.all=1e12 alone: earnedLevel() still 1 (ore no longer levels)', r3.earned===1, r3);

 // ---------- ladderBuy() building XP ----------
 const r4=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.ore=1e6; G.S.buy=1;
   G.ladderBuy('home',0);
   const tf0=!!G.S.xf['tf:0'], xpnAfter1=G.S.xpn;
   G.S.buy=9;
   G.ladderBuy('home',0);
   const um10=!!G.S.xf['um:home:0:10'], xpnAfter10=G.S.xpn;
   return {tf0, xpnAfter1, um10, xpnAfter10};
 });
 ok('ladderBuy home tier0 first unit grants tf:0 (10 XP)', r4.tf0 && r4.xpnAfter1===10, r4);
 ok('...reaching 10 units grants um:home:0:10 (+5 XP)', r4.um10 && r4.xpnAfter10===15, r4);

 const r5=await p.evaluate(()=>{
   const G=window.__SD;
   // "dra" shares home's "ore" ladder (tier 0 = Mining Drone there too, unlike
   // "rock"-kind kor) - claiming it and building tier 0 there is a genuine repeat
   // of the tf:0 first that home already banked, so it should pay the reduced
   // sysFirstMul (0.25) share instead of the full first-ever amount.
   G.S.ore=1e12; G.S.lvl=16; G.S.xpn=G.xpNeed(16);
   G.claimSystem(G.SYSMAP.dra);
   const before=G.S.xpn;
   G.S.buy=1;
   G.ladderBuy('dra',0);
   const sf=!!G.S.xf['sf:dra:0'];
   return {before, after:G.S.xpn, delta:G.S.xpn-before, sf};
 });
 ok('a second system’s first of an already-paid tier flags sf: (reduced repeat)', r5.sf, r5);
 ok('...and pays exactly round(tierFirst[0] * 0.25) = 3 XP, once', r5.delta===3, r5);

 // ---------- claimSystem() grants ----------
 const r6=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.lvl=16; G.S.xpn=G.xpNeed(16); G.S.ore=1e9;
   const before=G.S.xpn;
   G.claimSystem(G.SYSMAP.kor);
   return {before, after:G.S.xpn, delta:G.S.xpn-before, cl1:!!G.S.xf.cl1, clKor:!!G.S.xf['cl:kor']};
 });
 ok('claimSystem(kor): grants cl1+cl:kor = 130 XP total', r6.delta===130 && r6.cl1 && r6.clKor, r6);

 // ---------- xpOnWins() raid-win thresholds ----------
 const r7=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.wins=25; const before=G.S.xpn; G.xpOnWins();
   const after25=G.S.xpn;
   G.S.wins=200; G.xpOnWins();       // pay off 50/100/200 before isolating the 210 repeat
   const before210=G.S.xpn;
   G.S.wins=210; G.xpOnWins();
   return {before, after25, delta25:after25-before, before210, after210:G.S.xpn, delta210:G.S.xpn-before210};
 });
 ok('xpOnWins() at S.wins=25 grants 150 XP (rw:1,5,10,25)', r7.delta25===150, r7);
 ok('xpOnWins() at S.wins=210 (after 50/100/200 paid) grants +10 (rwr:210)', r7.delta210===10, r7);

 // ---------- xpOnDef() ----------
 const r8=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.defw=5; const before=G.S.xpn; G.xpOnDef();
   return {before, after:G.S.xpn, delta:G.S.xpn-before};
 });
 ok('xpOnDef() at S.defw=5 grants 70 XP (dw:1,5)', r8.delta===70, r8);

 // ---------- buyRes() / research XP ----------
 const r9=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   const r=G.RESH[0];
   G.S.cry=1e9;
   const before=G.S.xpn;
   const bought=G.buyRes(r);
   return {bought, before, after:G.S.xpn, delta:G.S.xpn-before, flag:!!G.S.xf['rs:'+r.id+':1']};
 });
 ok('buyRes(RESH[0]): grants 10 XP and flags rs:<id>:1', r9.bought && r9.delta===10 && r9.flag, r9);

 // ---------- checkAchs() records ----------
 const r10=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.clicks=1; G.S.wins=1;   // a1 First Contact, a23 First Blood both true immediately
   const before=G.S.xpn;
   G.checkAchs();
   const unlocked=Object.keys(G.S.ac).length;
   return {before, after:G.S.xpn, delta:G.S.xpn-before, unlocked};
 });
 ok('checkAchs() grants XPV.record (15) per newly-unlocked record', r10.unlocked>=1 && r10.delta===15*r10.unlocked, r10);

 // ---------- hireCrew() ----------
 const r11=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.sv=1e6;
   const before=G.S.xpn;
   const hired=G.hireCrew();
   return {hired, before, after:G.S.xpn, cr1:!!G.S.xf.cr1};
 });
 ok('hireCrew(): flags cr1 and grants its XP', r11.hired && r11.cr1 && r11.after>r11.before, r11);

 // ---------- migration: pre-XP save (lvl set, no xpn) ----------
 const r12=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:14, all:1e7});
   return {level:G.level(), xpn:G.S.xpn, need14:G.xpNeed(14),
     prog:(()=>{ const e=G.earnedLevel(), a=G.xpNeed(e), b=G.xpNeed(e+1);
       return b>a?Math.max(0,Math.min(1,(G.S.xpn-a)/(b-a))):1 })()};
 });
 ok('adopt({lvl:14,all:1e7}) (no xpn): level()===14', r12.level===14, r12);
 ok('...S.xpn===xpNeed(14)', r12.xpn===r12.need14, r12);
 ok('...lvProgress-equivalent===0 (bar starts empty)', r12.prog===0, r12);

 // ---------- S.xp stays the exotic-programme store, untouched by any of this ----------
 const r13=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), xp:{frame:2}});
   return {frame:G.S.xp && G.S.xp.frame, xpnType:typeof G.S.xpn};
 });
 ok('a save with xp:{frame:2} (programme object): S.xp.frame===2, untouched', r13.frame===2, r13);
 ok('...and S.xpn is still a number (the two fields never collide)', r13.xpnType==='number', r13);

 // ---------- seeding: adopt a save with existing buildings and no xf ----------
 const r14=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:14, sys:{kor:{b:{14:12}}}});
   return {tf14:!!G.S.xf['tf:14'], um10:!!G.S.xf['um:kor:14:10'], xpn:G.S.xpn, need14:G.xpNeed(14)};
 });
 ok('seeding: adopt(lvl:14, kor tier14 x12, no xf) sets S.xf["tf:14"]', r14.tf14, r14);
 ok('...and S.xf["um:kor:14:10"]', r14.um10, r14);
 ok('...without paying: S.xpn===xpNeed(14), not a cent more', r14.xpn===r14.need14, r14);

 // ---------- offline: no XP for time away ----------
 const r15=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.xpn=250;
   G.S.last=Date.now()-3600e3;
   G.offlineReport();
   return {xpn:G.S.xpn};
 });
 ok('offlineReport() after 1h away: S.xpn unchanged (offline earns no XP)', r15.xpn===250, r15);

 // ---------- devGrantLevels ----------
 const r16=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:14, all:1e7});
   const before=G.level();
   G.devGrantLevels(1);
   return {before, after:G.level()};
 });
 ok('devGrantLevels(1) raises level by 1', r16.after===r16.before+1, r16);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
