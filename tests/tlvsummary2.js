const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tlvsummary2.js — the header LEVEL chip now branches on pendingLevels(): a pick
// still waiting opens the existing lvModal() (untouched), nothing waiting opens
// the new read-only lvSummary() overlay instead of doing nothing (the old
// silent no-op tap). Covers: takeLevel() records a {id,lv} entry in S.pkLog
// (write-only since the cumulative-perks patch, kept for a possible future
// "career" view); the chip's branching in both directions; an old save with
// S.pk counts but no S.pkLog doesn't crash and lists each perk's cumulative
// effect straight from S.pk; the automatic-bonuses section shows the UNLOCK
// table and the raidReward +6%/level Dark Matter term.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage();
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---- takeLevel() records {id, lv} in S.pkLog ----
 const r1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}}, lvl:1, pk:{}, pkLog:[]});
   G.S.xpn=G.xpNeed(2); G.checkLevel();
   const before=G.S.pkLog.length;
   const off=G.lvOffer();
   const took=G.takeLevel(off[0]);
   return {before, after:G.S.pkLog.slice(), took, id:off[0], lvl:G.level()};
 });
 ok('takeLevel() appends exactly one {id,lv} entry to S.pkLog',
   r1.took && r1.before===0 && r1.after.length===1 && r1.after[0].id===r1.id && r1.after[0].lv===r1.lvl, r1);

 // ---- chip with pendingLevels()===0 opens lvSummary(), not lvModal() ----
 const r2=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('mask').classList.remove('on');
   while(G.pendingLevels()>0){ const off=G.lvOffer(); G.takeLevel(off[0]); }
   document.getElementById('runlbl').click();
   const modal=document.getElementById('modal');
   return {maskOn:document.getElementById('mask').classList.contains('on'),
     hasClose:!!document.getElementById('lvSumClose'), hasPicks:!!document.getElementById('lvPicks'),
     pending:G.pendingLevels()};
 });
 ok('pendingLevels()===0: chip opens the read-only summary (CLOSE button, no perk-pick buttons)',
   r2.pending===0 && r2.maskOn && r2.hasClose && !r2.hasPicks, r2);

 // ---- chip with pendingLevels()>0 still opens lvModal(), unchanged ----
 const r3=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('mask').classList.remove('on');
   G.S.xpn=G.xpNeed(G.level()+1); G.checkLevel();
   document.getElementById('runlbl').click();
   return {pending:G.pendingLevels(), maskOn:document.getElementById('mask').classList.contains('on'),
     hasPicks:!!document.getElementById('lvPicks'), hasSumClose:!!document.getElementById('lvSumClose')};
 });
 ok('pendingLevels()>0: chip still opens lvModal() (perk-pick buttons present, not the summary)',
   r3.pending>0 && r3.maskOn && r3.hasPicks && !r3.hasSumClose, r3);

 // ---- old save: S.pk counts, no S.pkLog at all - no crash, honest bucket ----
 const r4=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('mask').classList.remove('on');
   let threw=false;
   try{
     G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}}, lvl:5, pk:{out:2, cost:1}});
   }catch(e){ threw=true; }
   const pkLogOk=Array.isArray(G.S.pkLog) && G.S.pkLog.length===0;
   document.getElementById('runlbl').click();
   const html=document.getElementById('modal').innerHTML;
   return {threw, pkLogOk, mentionsOut:/Deeper Seams ×2/.test(html), mentionsCost:/Bulk Contracts ×1/.test(html)};
 });
 ok('old save (S.pk counts, no S.pkLog): adopt() does not throw, S.pkLog sanitizes to []',
   !r4.threw && r4.pkLogOk, r4);
 ok('...summary lists both perks by their cumulative S.pk count, no S.pkLog needed',
   r4.mentionsOut && r4.mentionsCost, r4);

 // ---- garbage S.pkLog entries are dropped, not kept or reinterpreted ----
 const r5=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('mask').classList.remove('on');
   G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}}, lvl:5, pk:{out:1},
     pkLog:[{id:'out', lv:2}, {id:'unknown-perk', lv:3}, {id:'out', lv:'nope'}, {id:'out', lv:1}, null, 5]});
   return {log:G.S.pkLog.slice()};
 });
 ok('malformed S.pkLog entries (unknown id, non-numeric lv, impossible lv, non-objects) are dropped',
   r5.log.length===1 && r5.log[0].id==='out' && r5.log[0].lv===2, r5);

 // ---- automatic-bonuses section: UNLOCK table + raidReward's level*0.06 term ----
 const r6=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('mask').classList.remove('on');
   const need=G.xpNeed(10);
   G.adopt({ore:0, all:0, xpn:need, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}}, lvl:10, pk:{}, pkLog:[]});
   document.getElementById('runlbl').click();
   const html=document.getElementById('modal').innerHTML;
   const barWidths=[...document.querySelectorAll('#modal .xprow .xpbar i')].map(el=>parseFloat(el.style.width));
   return {html, unlockCount:(html.match(/unlocked|locked/g)||[]).length,
     hasMissions:/Missions/.test(html) && /unlocked/.test(html),
     hasDm:/Dark Matter from raids.*\+60%/.test(html), barWidths};
 });
 ok('summary lists every UNLOCK entry with reached/locked status', r6.unlockCount>=6, r6);
 ok('summary states the raidReward() +6%×level Dark Matter bonus at the correct value for the level',
   r6.hasDm, r6);
 ok('every .xprow .xpbar i has a width between 0% and 100%',
   r6.barWidths.length>0 && r6.barWidths.every(w=>w>=0 && w<=100), r6.barWidths);

 // ---- lvModal() itself is unchanged: still a silent no-op at pendingLevels()<1 ----
 const r7=await p.evaluate(()=>{
   const G=window.__SD;
   document.getElementById('mask').classList.remove('on');
   G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}}, lvl:5, pk:{}, pkLog:[]});
   G.lvModal();
   return {maskOn:document.getElementById('mask').classList.contains('on')};
 });
 ok('lvModal() called directly with pendingLevels()<1 is still a silent no-op (untouched)', !r7.maskOn, r7);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
