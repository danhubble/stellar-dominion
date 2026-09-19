const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tstory2.js — PLAN-ending.md Batch A (patches 578-581): the intro scene, VEGA's
// drift beats, the rival-speaker notices, and the Nyx/Thanaris swap. Pointed at
// stellar-dominion-empire2.html.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------------- intro: fresh game only ----------------
 {
   const ctx=await b.newContext({viewport:{width:390,height:844}});
   const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto(GAME_URL); await p.waitForTimeout(500);
   const fresh=await p.evaluate(()=>({
     sceneOn:window.__SD.sceneOn, sceneClass:document.getElementById('scene').classList.contains('on'),
     seenIntro:!!__SD.S.seen.intro, skipVisible:!document.getElementById('sceneSkip').hidden
   }));
   ok('a brand-new game (no save) opens on the intro scene', fresh.sceneOn && fresh.sceneClass, fresh);
   ok('S.seen.intro is set the moment the intro starts', fresh.seenIntro, fresh);
   ok('SKIP is visible', fresh.skipVisible, fresh);

   // ---- SKIP dismisses it, and vega:boot then queues from onDone ----
   await p.click('#sceneSkip'); await p.waitForTimeout(500);
   const afterSkip=await p.evaluate(()=>({
     sceneOn:window.__SD.sceneOn, sceneClass:document.getElementById('scene').classList.contains('on'),
     q:__SD.S.notifyQueue.slice()
   }));
   ok('SKIP closes the scene', !afterSkip.sceneOn && !afterSkip.sceneClass, afterSkip);
   ok('vega:boot queues once the intro is dismissed', afterSkip.q.includes('vega:boot'), afterSkip);

   // ---- a real save now exists; reloading must NOT replay the intro ----
   await p.evaluate(()=>{ __SD.save(); });
   await p.reload(); await p.waitForTimeout(500);
   const reloaded=await p.evaluate(()=>({
     sceneOn:window.__SD.sceneOn, sceneClass:document.getElementById('scene').classList.contains('on'),
     seenIntro:!!__SD.S.seen.intro
   }));
   ok('a loaded save does not show the intro', !reloaded.sceneOn && !reloaded.sceneClass, reloaded);
   ok('the loaded save still carries S.seen.intro', reloaded.seenIntro, reloaded);
   if(errs.length)ok('no page errors in the intro/SKIP/reload flow', false, errs);
   await ctx.close();
 }

 // ---------------- RESTART GAME plays the opening too (patch594) - the bug
 // this closes: fresh() alone never set S.seen.intro, and restartDialog()'s
 // yes.onclick never called playScene at all, so a restarted game got no
 // intro and no VEGA line, ever. Both boot and RESTART now go through the one
 // shared playOpening(). ----------------
 {
   const ctx=await b.newContext({viewport:{width:390,height:844}});
   const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto(GAME_URL); await p.waitForTimeout(500);
   await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
   await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
   // a real empire for RESTART to actually wipe, so "it wiped" is a meaningful check
   await p.evaluate(()=>{ const G=window.__SD; G.adopt({...G.fresh(), lvl:5, ore:1e6}); G.save(); });
   await p.click('#btnSave');
   await p.click('#mWipe');
   await p.waitForFunction(()=>{ const y=document.getElementById('wYes'); return y&&!y.disabled; },{timeout:5000});
   await p.click('#wYes');
   await p.waitForTimeout(200);
   const afterRestart=await p.evaluate(()=>({
     sceneOn:window.__SD.sceneOn, sceneClass:document.getElementById('scene').classList.contains('on'),
     seenIntro:!!__SD.S.seen.intro, lvl:__SD.S.lvl
   }));
   ok('RESTART GAME plays the opening scene immediately, same as a fresh boot',
     afterRestart.sceneOn && afterRestart.sceneClass, afterRestart);
   ok('S.seen.intro is set the moment RESTART plays it', afterRestart.seenIntro, afterRestart);
   ok('RESTART actually wiped the old empire (back to a fresh level)', afterRestart.lvl===1, afterRestart);

   await p.click('#sceneSkip'); await p.waitForTimeout(500);
   const afterSkip2=await p.evaluate(()=>({ q:__SD.S.notifyQueue.slice() }));
   ok('vega:boot queues once the RESTART intro is dismissed, same as a fresh boot',
     afterSkip2.q.includes('vega:boot'), afterSkip2);

   // the save the restart handler takes must already reflect the intro having
   // played, exactly like a genuine fresh boot's own eventual first save would -
   // a restarted player sees the intro exactly once, right then, never again.
   await p.reload(); await p.waitForTimeout(500);
   const reloadedAfterRestart=await p.evaluate(()=>({
     sceneOn:window.__SD.sceneOn, sceneClass:document.getElementById('scene').classList.contains('on'),
     seenIntro:!!__SD.S.seen.intro, lvl:__SD.S.lvl
   }));
   ok('a restarted player is not shown the intro a second time on reload',
     !reloadedAfterRestart.sceneOn && !reloadedAfterRestart.sceneClass, reloadedAfterRestart);
   ok('the reloaded save (the restarted one) still carries S.seen.intro', reloadedAfterRestart.seenIntro, reloadedAfterRestart);
   ok('the reload still shows the fresh, restarted empire, not the wiped one', reloadedAfterRestart.lvl===1, reloadedAfterRestart);
   if(errs.length)ok('no page errors in the RESTART/intro flow', false, errs);
   await ctx.close();
 }

 // ---------------- everything else: one page, adopt()-driven (bypasses the
 // scene entirely, same pattern tnotices2.js uses for its own boot-adjacent
 // checks) ----------------
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });

 // ---------------- each drift/rival beat fires at its level exactly once ----------------
 const beats=[
   {key:'vega:drift25', lvl:25}, {key:'vega:drift35', lvl:35}, {key:'vega:drift45', lvl:45},
   {key:'vega:drift55', lvl:55}, {key:'vega:drift65', lvl:65},
   {key:'rival:rv40', lvl:40}, {key:'rival:rv50', lvl:50}, {key:'rival:rv60', lvl:60}
 ];
 for(const b2 of beats){
   const r=await p.evaluate(({key,lvl})=>{
     const G=window.__SD;
     G.adopt({...G.fresh(), lvl:1});
     G.S.lvl=lvl-1; G.tick(0.016);
     const belowQueued=G.S.notifyQueue.includes(key), belowSeen=!!G.S.seen[key];
     G.S.lvl=lvl; G.tick(0.016);
     const atQueued=G.S.notifyQueue.includes(key), atCount=G.S.notifyQueue.filter(k=>k===key).length;
     G.tick(0.016); G.tick(0.016);   // a beat already queued/seen must not queue again
     const stillOnce=G.S.notifyQueue.filter(k=>k===key).length;
     return {belowQueued, belowSeen, atQueued, atCount, stillOnce};
   }, b2);
   ok(b2.key+' does not fire below level '+b2.lvl, !r.belowQueued && !r.belowSeen, r);
   ok(b2.key+' fires exactly once at level '+b2.lvl, r.atQueued && r.atCount===1 && r.stillOnce===1, r);
 }

 // ---------------- back-fill stops old saves being flooded ----------------
 const backfill=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:70});   // already past every drift/rv threshold below rv60/drift65... (70>65)
   const seenBefore={ d25:!!G.S.seen['vega:drift25'], d65:!!G.S.seen['vega:drift65'],
     rv40:!!G.S.seen['rival:rv40'], rv60:!!G.S.seen['rival:rv60'] };
   G.tick(0.016);
   return { seenBefore, q:G.S.notifyQueue.slice() };
 });
 ok('adopting an already-high-level save back-fills every drift beat as seen',
   backfill.seenBefore.d25 && backfill.seenBefore.d65, backfill);
 ok('adopting an already-high-level save back-fills every rv beat as seen',
   backfill.seenBefore.rv40 && backfill.seenBefore.rv60, backfill);
 ok('none of them are queued for an old save (no flood)',
   !backfill.q.some(k=>k.indexOf('vega:drift')===0 || /^rival:rv[456]0$/.test(k)), backfill);

 // ---------------- rvSab ships text but has no level trigger (Batch C wires it) ----------------
 const noSabTrigger=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:1}); G.S.lvl=99; G.tick(0.016); G.tick(0.016);
   return { queued:G.S.notifyQueue.includes('rival:rvSab'), seen:!!G.S.seen['rival:rvSab'],
     hasText: typeof G.RIVAL_MSG.rvSab==='object' && G.RIVAL_MSG.rvSab.t.length>0 };
 });
 ok('rvSab has placeholder text but no level trigger of its own (Batch C)',
   noSabTrigger.hasText && !noSabTrigger.queued && !noSabTrigger.seen, noSabTrigger);

 // ---------------- rival notice renders name + coloured avatar ----------------
 const rivalCard=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:1}); G.S.lvl=40; G.tick(0.016);
   dirty=true; render();
   while(G.S.notifyQueue.length && G.S.notifyQueue[0]!=='rival:rv40') dismissNotice();
   G.S.rvMsg.rv40='cov';   // force Covenant specifically - the "skip The " check needs a known name
   dirty=true; render();
   await new Promise(r=>setTimeout(r,30));
   const r=G.RIVALMAP.cov;
   const av=document.getElementById('noticeAv'), tx=document.getElementById('noticeTxt');
   const avRect=av.getBoundingClientRect(), txRect=tx.getBoundingClientRect();
   return {
     who:document.getElementById('noticeWho').textContent,
     whoHidden:document.getElementById('noticeWho').hidden,
     avHTML:av.innerHTML,
     avHidden:av.hidden,
     avWidth:avRect.width, gap:txRect.left-avRect.right,
     expectName:r.n, expectCol:r.col,
     txt:document.getElementById('noticeTxt').textContent
   };
 });
 ok('the rival notice header names the chosen rival and reads INTERCEPTED',
   !rivalCard.whoHidden && rivalCard.who===rivalCard.expectName+' · INTERCEPTED', rivalCard);
 ok('"The Covenant" shows the initial "C", not "T" (leading "The " is skipped)',
   !rivalCard.avHidden && rivalCard.avHTML.includes(rivalCard.expectCol) && rivalCard.avHTML.includes('>C<'),
   rivalCard);
 ok("the rival avatar reuses VEGA's own .vegaav sizing (44px + 10px margin = 54px box, zero gap to the text)",
   rivalCard.avHTML.includes('vegaav') && rivalCard.avWidth===54 && rivalCard.gap===0, rivalCard);
 ok('rv40 has real placeholder text, not empty', rivalCard.txt.length>5, rivalCard);

 // ---------------- scene overlay leaves zero trace after it ends ----------------
 const sceneGhost=await p.evaluate(async()=>{
   const G=window.__SD;
   G.playScene(['line one','line two'],{skip:true});
   G.sceneAdvance(); G.sceneAdvance();   // walk off the end -> sceneFinish() -> sceneClose()
   await new Promise(r=>setTimeout(r,500));   // comfortably past the ~400ms hard fallback
   const el=document.getElementById('scene');
   return { display:getComputedStyle(el).display, classes:el.className, innerHTML:el.innerHTML,
     bodyHasGhostText: document.body.innerText.includes('line one')||document.body.innerText.includes('line two') };
 });
 ok('the scene overlay is display:none and empty 500ms after it ends (no ghost text left behind)',
   sceneGhost.display==='none' && sceneGhost.innerHTML==='' && !sceneGhost.bodyHasGhostText, sceneGhost);

 // ---------------- Nyx is last, array order still monotonic ----------------
 const mapData=await p.evaluate(()=>{
   const G=window.__SD;
   const nonHome=G.SYS.filter(s=>!s.home);
   return {
     lastId: nonHome[nonHome.length-1].id,
     costsRise: nonHome.every((s,i,a)=>i===0||s.cost>a[i-1].cost),
     lvlsRise: nonHome.every((s,i,a)=>i===0||s.lvl>=a[i-1].lvl),
     nyxGarrison: G.GARRISON.nyx, thaGarrison: G.GARRISON.tha,
     nyxSec: G.SYSMAP.nyx.sec, nyxSx: G.SYSMAP.nyx.sx, nyxSy: G.SYSMAP.nyx.sy,
     thaSec: G.SYSMAP.tha.sec, thaSx: G.SYSMAP.tha.sx, thaSy: G.SYSMAP.tha.sy
   };
 });
 ok('Nyx is the last system in SYS (Owner decision 1)', mapData.lastId==='nyx', mapData);
 ok('claim costs still strictly increase down the raw array', mapData.costsRise, mapData);
 ok('level requirements still never decrease down the raw array', mapData.lvlsRise, mapData);
 ok('Nyx now carries the harder garrison (def 20, Lance, Helion)',
   mapData.nyxGarrison.def===20 && mapData.nyxGarrison.arch==='lance' && mapData.nyxGarrison.o==='hel', mapData);
 ok('Thanaris now carries the easier garrison (def 16, Fortress, Covenant)',
   mapData.thaGarrison.def===16 && mapData.thaGarrison.arch==='fortress' && mapData.thaGarrison.o==='cov', mapData);
 ok('sector position (sec/sx/sy) is untouched by the swap',
   mapData.nyxSec===4 && mapData.nyxSx===46 && mapData.nyxSy===90 &&
   mapData.thaSec===4 && mapData.thaSx===16 && mapData.thaSy===58, mapData);

 if(errs.length)ok('no page errors', false, errs);
 console.log(out.join('\n'));
 const fails=out.filter(l=>l.startsWith('FAIL')).length;
 console.log(fails+' failures');
 console.log(errs.length?('JS ERRORS: '+errs.join(' | ')):'NO JS ERRORS');
 await b.close();
})();
