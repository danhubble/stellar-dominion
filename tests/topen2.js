const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// topen2.js — PLAN-open.md Run 1 + Run 2 (patch617-621), then PLAN-page.md Run 1
// (patch626-628): the first five minutes, then "a system is a page, not a sheet".
// Same pattern as tzoom2.js/tmap2.js/tsheet2.js: dismiss the intro overlay
// deterministically, drive state through window.__SD, print PASS/FAIL lines and
// a final "N failures" + "NO JS ERRORS"/"JS ERRORS" line.
//
// patch628: the patch620/623 sheet-rest-state section (FULL/PEEK/CLOSED, drag
// thresholds, the upward rubber-band, mzVisFrac recomposing) is gone outright,
// not retired-in-place with a comment - none of `setSheetState`/`sheetState`/
// `#sshGrab`/`mzVisFrac` exist any more (patch626/627, PLAN-page.md). Replaced
// with the page-model tests PLAN-page.md's own 628 bullet names: page open on
// node tap, `< MAP` closes it, claim opens the page zoomed, chips visible after
// every close path, the scan bar pinned and mutually exclusive with threat
// actions, the planet canvas non-empty. See HANDOVER (patch626/627/628 entries)
// for the full list of what moved where.
const { chromium } = require('playwright-core');
const URL=GAME_URL;
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL); await p.waitForTimeout(500);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ================================================================== 617: prologue
 // alignment. The real boot prologue is already on screen (scene not yet dismissed) -
 // its own first line ("You wake in a drifting shuttle...") has no speaker.
 const introState=await p.evaluate(()=>{
   const card=document.querySelector('.scenecard');
   return { hasSolo: card?card.classList.contains('solo'):null, sceneOn: !!(window.__SD&&__SD.sceneOn) };
 });
 ok('the prologue\'s first (speakerless) line gets .scenecard.solo', introState.sceneOn && introState.hasSolo===true, introState);

 // advance to a VEGA line (has a speaker) and confirm solo is REMOVED, not stuck on
 const vegaLineState=await p.evaluate(()=>{
   const G=window.__SD;
   // playScene() lines are private; drive it via the real scene advance instead of
   // reaching in - click the overlay same as a real tap would.
   for(let i=0;i<8 && G.sceneOn;i++) document.getElementById('scene').click();
   const card=document.querySelector('.scenecard');
   const who=document.getElementById('sceneWho');
   return { sceneOn: G.sceneOn, hasSolo: card?card.classList.contains('solo'):null,
     whoHidden: who?who.hidden:null };
 });
 ok('a line WITH a speaker (VEGA) does not carry .solo (left-aligned layout kept)',
    !vegaLineState.hasSolo && vegaLineState.whoHidden===false, vegaLineState);

 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 // ================================================================== 618: fresh-save
 // boot state - msel:null, #mapWrap.homeonly, the #tut placeholder line.
 const freshState=await p.evaluate(()=>{
   const G=window.__SD;
   const f=G.fresh();
   return { mselIsNull: f.msel===null };
 });
 ok('fresh() sets msel:null (page closed on a brand-new save)', freshState.mselIsNull, freshState);

 const bootState=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.gotoTab('p-map'); G.dirty=true; G.render();
   const sheet=document.getElementById('sysSheet');
   const wrap=document.getElementById('mapWrap');
   const tut=document.getElementById('tut');
   return {
     // patch628b: #sysSheet.open is gone (the coordinator's review caught it as
     // a second class duplicating body.syspage) - visibility now derives from
     // body.syspage #sysSheet{display:block}, checked here at the CSS level
     // rather than re-deriving the same JS fact a second time.
     sheetDisplay: getComputedStyle(sheet).display,
     bodySyspage: document.body.classList.contains('syspage'),
     msel: G.S.msel,
     wrapHomeonly: wrap.classList.contains('homeonly'),
     level: G.level(),
     tutMentionsHomeworld: tut ? /homeworld/i.test(tut.textContent) : null,
   };
 });
 ok('a fresh save (level 1, msel:null) boots with the page closed',
    bootState.sheetDisplay==='none' && !bootState.bodySyspage && bootState.msel===null, bootState);
 ok('#mapWrap carries .homeonly below level 8', bootState.wrapHomeonly && bootState.level<8, bootState);
 ok('#tut tells the player to tap their homeworld to build', bootState.tutMentionsHomeworld, bootState);

 // .homeonly drops once the map reveals past level 8 (patch609's own level()<8 gate,
 // reused - not recomputed - by patch619)
 const revealedState=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.lvl=8; G.S.lvSeen=8; G.dirty=true; G.render();
   const wrap=document.getElementById('mapWrap');
   return { wrapHomeonly: wrap.classList.contains('homeonly'), level: G.level() };
 });
 ok('#mapWrap drops .homeonly once level()>=8', !revealedState.wrapHomeonly && revealedState.level>=8, revealedState);

 // ================================================================== 626/627/628
 // (PLAN-page.md): "a system is a page, not a sheet". One fact (S.msel + the active
 // tab) drives body.syspage, which drives everything else - see syncSysPage().
 const nodeTapState=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());
   G.S.lvl=20; G.S.lvSeen=20; G.S.ore=1e9;
   const kor=G.SYS.find(s=>s.id==='kor');
   G.claimSystem(kor);
   G.S.msel=null; G.setMapZoom(null); G.dirty=true; G.render(); // close first...
   G.gotoTab('p-map'); G.dirty=true; G.render();
   document.querySelector('.mnode[data-s="kor"]').click();       // ...then a real node tap
   return {};
 });
 await p.waitForTimeout(400);
 const nodeTapResult=await p.evaluate(()=>{
   const G=window.__SD;
   const sheet=document.getElementById('sysSheet');
   const cv=document.getElementById('mapZoom');
   const gctx=cv.getContext('2d');
   const d=gctx.getImageData(0,0,cv.width,cv.height).data;
   let nonzero=0; for(let i=3;i<d.length;i+=4*97) if(d[i]>0)nonzero++;
   // patch628b: sheetOpen (#sysSheet.open) is gone - sheetDisplay + bodySyspage
   // below already cover this at both the CSS and JS layers, no replacement field.
   return { msel:G.S.msel, mapZoom:G.mapZoom,
     sheetDisplay:getComputedStyle(sheet).display, bodySyspage:document.body.classList.contains('syspage'),
     canvasNonBlank: nonzero>0 };
 });
 ok('a real node tap on a held system opens the page, zoomed, planet drawn (non-blank canvas)',
    nodeTapResult.msel==='kor' && nodeTapResult.mapZoom==='kor' &&
    nodeTapResult.sheetDisplay==='block' && nodeTapResult.bodySyspage && nodeTapResult.canvasNonBlank, nodeTapResult);

 const backState=await p.evaluate(()=>{
   document.getElementById('mapZoomBack').click();
   return {};
 });
 await p.waitForTimeout(400);
 const backResult=await p.evaluate(()=>{
   const G=window.__SD;
   const sheet=document.getElementById('sysSheet');
   return { msel:G.S.msel, mapZoom:G.mapZoom,
     sheetDisplay:getComputedStyle(sheet).display, bodySyspage:document.body.classList.contains('syspage') };
 });
 ok('`< MAP` closes the whole page - msel/zoom both null, sheet closed, body.syspage cleared',
    backResult.msel===null && backResult.mapZoom===null &&
    backResult.sheetDisplay==='none' && !backResult.bodySyspage, backResult);

 // claimSystem() opens the claimed system's page, zoomed, with no further tap.
 // (The planet is painted by the rAF-driven draw() loop, not synchronously inside
 // claimSystem()/render() - same reason the node-tap test above needs a wait before
 // reading canvas pixels; this one was missing it.)
 const claimSetup=await p.evaluate(()=>{
   const G=window.__SD;
   const unclaimed=G.SYS.find(s=>!s.home && !G.sysHeld(s.id) && !s.owner && G.sysInSec(G.mapSec).includes(s));
   const claimed=G.claimSystem(unclaimed);
   return { claimed, id:unclaimed.id };
 });
 await p.waitForTimeout(400);
 const claimResult=await p.evaluate(()=>{
   const G=window.__SD;
   const cv=document.getElementById('mapZoom');
   const gctx=cv.getContext('2d');
   const d=gctx.getImageData(0,0,cv.width,cv.height).data;
   let nonzero=0; for(let i=3;i<d.length;i+=4*97) if(d[i]>0)nonzero++;
   return { msel:G.S.msel, mapZoom:G.mapZoom, canvasNonBlank:nonzero>0 };
 });
 ok('claimSystem() opens the claimed system\'s page, zoomed, no further tap needed (PLAN-page.md decision 3)',
    claimSetup.claimed && claimResult.msel===claimSetup.id && claimResult.mapZoom===claimSetup.id &&
    claimResult.canvasNonBlank, {...claimSetup, ...claimResult});

 // an UNCLAIMED system's page: never zoomed, but still has a working `< MAP` bar
 // with the system's name (patch626 shipped without this - see its own HANDOVER
 // entry - patch627 is the fix; this is the regression guard).
 await p.evaluate(()=>{
   document.getElementById('mapZoomBack').click(); // close the just-claimed page first
 });
 await p.waitForTimeout(300);
 const unclaimedResult=await p.evaluate(()=>{
   const G=window.__SD;
   const unclaimed=G.SYS.find(s=>!s.home && !G.sysHeld(s.id) && !s.owner && G.sysInSec(G.mapSec).includes(s));
   document.querySelector(`.mnode[data-s="${unclaimed.id}"]`).click();
   return { id: unclaimed.id };
 });
 await p.waitForTimeout(400);
 const unclaimedState=await p.evaluate(()=>{
   const G=window.__SD;
   const bar=document.getElementById('mapZoomBar'), name=document.getElementById('mapZoomName');
   return { msel:G.S.msel, mapZoom:G.mapZoom, bodySyspage:document.body.classList.contains('syspage'),
     barVisible: getComputedStyle(bar).opacity!=='0' && getComputedStyle(bar).pointerEvents!=='none',
     nameText: name.textContent };
 });
 ok('an unclaimed system\'s page is never zoomed but DOES show a working < MAP bar + name',
    unclaimedState.mapZoom===null && unclaimedState.bodySyspage && unclaimedState.barVisible &&
    unclaimedState.nameText.length>0, unclaimedState);
 const unclaimedClosed=await p.evaluate(()=>{
   document.getElementById('mapZoomBack').click();
   const G=window.__SD;
   return { msel:G.S.msel, bodySyspage:document.body.classList.contains('syspage') };
 });
 ok('`< MAP` closes an unclaimed system\'s page too', unclaimedClosed.msel===null && !unclaimedClosed.bodySyspage, unclaimedClosed);

 // ---- the owner's own "sector chips disappeared" bug: #mapChips must be visible
 // (level()>=8, no page open) after EVERY way a page can close, not just one. ----
 async function chipsVisibleAfter(label, closeFn){
   await p.evaluate(()=>{ document.querySelector('.mnode[data-s="kor"]').click(); });
   await p.waitForTimeout(300);
   await closeFn();
   await p.waitForTimeout(300);
   const st=await p.evaluate(()=>({
     chipsDisplay: getComputedStyle(document.getElementById('mapChips')).display,
     bodySyspage: document.body.classList.contains('syspage'),
   }));
   ok('chips visible (level>=8) after close path: '+label, st.chipsDisplay!=='none' && !st.bodySyspage, st);
 }
 await chipsVisibleAfter('< MAP', async()=>{ await p.evaluate(()=>document.getElementById('mapZoomBack').click()); });
 await chipsVisibleAfter('claim-then-< MAP', async()=>{
   await p.evaluate(()=>{
     const G=window.__SD;
     const unclaimed=G.SYS.find(s=>!s.home && !G.sysHeld(s.id) && !s.owner && G.sysInSec(G.mapSec).includes(s));
     if(unclaimed)G.claimSystem(unclaimed);
   });
   await p.waitForTimeout(300);
   await p.evaluate(()=>document.getElementById('mapZoomBack').click());
 });
 await chipsVisibleAfter('tab away and back, then < MAP', async()=>{
   await p.evaluate(()=>document.querySelector('.tab[data-p="p-mis"]').click());
   await p.waitForTimeout(200);
   await p.evaluate(()=>document.querySelector('.tab[data-p="p-map"]').click());
   await p.waitForTimeout(200);
   await p.evaluate(()=>document.getElementById('mapZoomBack').click());
 });
 await chipsVisibleAfter('TAKE ME THERE notice, then < MAP', async()=>{
   await p.evaluate(()=>{
     const G=window.__SD;
     G.S.msel=null; G.dirty=true; G.render();
     const s=G.SYS.find(x=>!x.home&&G.sysOpen(x));      // same target NOTICES["vega:claimable"].go() uses
     G.S.msel=s?s.id:null; G.gotoTab('p-map'); G.dirty=true; G.render();
   });
   await p.waitForTimeout(300);
   await p.evaluate(()=>document.getElementById('mapZoomBack').click());
 });

 // ---- patch628b: the coordinator OVERRULED patch627's own tab-switch-resets
 // rule. The page now scrolls to top when the SELECTED SYSTEM changes, not when
 // the tab changes - every other pane restores its own scroll on return
 // (paneScroll), and the owner asked for this one to behave the same way. Three
 // scenarios, exactly as the coordinator's own message specified. ----
 await p.evaluate(()=>{ document.querySelector('.mnode[data-s="kor"]').click(); });
 await p.waitForTimeout(300);
 // patch629 (VEGA overlay) legitimately shrinks how far this specific page can
 // scroll: the notice used to be a flex item inside #app's own column (#app is
 // display:flex;flex-direction:column;height:100%, main is flex:1 1 auto), so a
 // shown notice - and the intro's own queue is still draining at this point in
 // the run - shrank #view's clientHeight and inflated the scrollable range as a
 // side effect. patch629's whole point was "nothing moves" when VEGA speaks, so
 // that borrowed room is gone now (confirmed: #view's clientHeight/scrollHeight
 // no longer change with #notice.on at all) - a hardcoded 150 is not always
 // reachable any more. Scroll to whatever this page's real max is (capped at
 // 150) instead of a magic number - the restore behaviour under test doesn't
 // care what the number is, only that tab-away-then-back brings back the exact
 // same one.
 const korMaxScroll=await p.evaluate(()=>{ const v=document.getElementById('view'); return v.scrollHeight-v.clientHeight; });
 const scrollTarget=Math.max(1, Math.min(150, korMaxScroll));
 await p.evaluate((to)=>{ document.getElementById('view').scrollTo({top:to,behavior:'instant'}); }, scrollTarget);
 await p.waitForTimeout(150);
 await p.evaluate(()=>document.querySelector('.tab[data-p="p-mis"]').click());
 await p.waitForTimeout(300);
 await p.evaluate(()=>document.querySelector('.tab[data-p="p-map"]').click());
 await p.waitForTimeout(300);
 const tabBackScroll=await p.evaluate(()=>document.getElementById('view').scrollTop);
 ok('patch628b: tab-away-then-back RESTORES the page\'s own scroll (paneScroll, like any other pane), not resets it',
    tabBackScroll===scrollTarget, {tabBackScroll, scrollTarget});

 await p.evaluate(()=>document.getElementById('mapZoomBack').click());
 await p.waitForTimeout(300);
 const afterBackScroll=await p.evaluate(()=>document.getElementById('view').scrollTop);
 ok('patch628b: `< MAP` (closing the page) still resets scroll to 0', afterBackScroll===0, afterBackScroll);

 // switching to a DIFFERENT held system's page - via a real LIST row tap (the
 // same mapNodeTapEquivalent() a node tap uses), not a direct S.msel poke -
 // still resets to 0. #mapMode (the MAP|LIST toggle) is hidden while a page is
 // open (body.syspage), same as the sector chips - hidden, not gone, so a
 // direct .click() still reaches it, same pattern tzoom2.js's own sector-change
 // test uses to prove the same kind of "hidden but not gone" point.
 await p.evaluate(()=>{ document.querySelector('.mnode[data-s="kor"]').click(); });
 await p.waitForTimeout(300);
 // 150 gets clamped to kor's own (smaller, post-patch629) max scroll here too -
 // harmless for this one, the assertion below only cares that it lands back on
 // 0, not what nonzero value it started from.
 await p.evaluate(()=>{ document.getElementById('view').scrollTo({top:150,behavior:'instant'}); });
 await p.waitForTimeout(150);
 const listSwitch=await p.evaluate(()=>{
   const G=window.__SD;
   const homeName=G.SYS.find(s=>s.home).n;
   document.querySelector('.rmbtn[data-mm="list"]').click();
   const homeRow=[...document.getElementById('mapList').children]
     .find(r=>{ const nm=r.querySelector('.sysname'); return nm&&nm.textContent===homeName; });
   if(homeRow)homeRow.click();
   return { foundRow:!!homeRow, msel:G.S.msel, scrollTop:document.getElementById('view').scrollTop };
 });
 await p.waitForTimeout(300);
 const listSwitchScroll=await p.evaluate(()=>document.getElementById('view').scrollTop);
 ok('patch628b: switching to a DIFFERENT held system\'s page via a LIST row tap resets scroll to 0',
    listSwitch.foundRow && listSwitch.msel==='home' && listSwitchScroll===0, {...listSwitch, listSwitchScroll});

 // ---- a page open on the Research tab must NOT hide #left or pad #view; back on
 // EMPIRE the page is still there, planet drawn (S.msel persists across tabs). ----
 await p.evaluate(()=>document.querySelector('.tab[data-p="p-res"]').click());
 await p.waitForTimeout(300);
 const onResearch=await p.evaluate(()=>{
   const G=window.__SD;
   return { msel:G.S.msel, bodySyspage:document.body.classList.contains('syspage'),
     leftDisplay:getComputedStyle(document.getElementById('left')).display,
     viewPB:getComputedStyle(document.getElementById('view')).paddingBottom };
 });
 ok('a page open on the Research tab does not hide #left or pad #view (body.syspage is off)',
    onResearch.msel==='home' && !onResearch.bodySyspage && onResearch.leftDisplay!=='none' &&
    parseFloat(onResearch.viewPB)<20, onResearch);
 await p.evaluate(()=>document.querySelector('.tab[data-p="p-emp"]')?.click() || document.querySelector('.tab[data-p="p-map"]').click());
 await p.waitForTimeout(300);
 const backOnEmpire=await p.evaluate(()=>{
   const G=window.__SD;
   const cv=document.getElementById('mapZoom');
   const gctx=cv.getContext('2d');
   const d=gctx.getImageData(0,0,cv.width,cv.height).data;
   let nonzero=0; for(let i=3;i<d.length;i+=4*97) if(d[i]>0)nonzero++;
   return { msel:G.S.msel, bodySyspage:document.body.classList.contains('syspage'), canvasNonBlank:nonzero>0 };
 });
 ok('back on the map tab, the page is still open with the planet drawn (S.msel survived the trip)',
    backOnEmpire.msel==='home' && backOnEmpire.bodySyspage && backOnEmpire.canvasNonBlank, backOnEmpire);

 // ---- the specificity trap: #mapWrap.homeonly (patch619) still loses to the page
 // height, explicit (not selector-count arithmetic) - see patch626's own HANDOVER. ----
 const specState=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh()); // level 1, home-only map
   G.gotoTab('p-map'); G.dirty=true; G.render();
   document.querySelector('.mnode[data-s="home"]').click();
   return {};
 });
 await p.waitForTimeout(400);
 const specResult=await p.evaluate(()=>{
   const wrap=document.getElementById('mapWrap');
   return { hasHomeonly:wrap.classList.contains('homeonly'), height:getComputedStyle(wrap).height, level:window.__SD.level() };
 });
 ok('#mapWrap.homeonly still loses to the 34vh page height (specificity trap)',
    specResult.hasHomeonly && specResult.height!=='25vh' && parseFloat(specResult.height)>150, specResult);

 // ---- patch632: at 390x667 (not this file's own 390x844), the 34vh header must
 // drop to 26vh so a brand-new player's very first BUY row clears the pinned
 // SCAN SECTOR bar with no scroll. This file runs its whole own session at 844
 // (line 20), so this one check gets its own short-viewport context rather than
 // changing what everything else in this file measures against. ----
 const ctx667=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
 const p667=await ctx667.newPage();
 await p667.goto(URL); await p667.waitForTimeout(500);
 await p667.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p667.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 await p667.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh());   // fresh save, level 1
   G.S.msel=null; G.gotoTab('p-map'); G.dirty=true; G.render();
 });
 await p667.waitForTimeout(200);
 await p667.evaluate(()=>{   // dismiss VEGA for real (patch629: a real close, not a poke) before tapping home
   if(window.__SD.S.notifyQueue.length) document.getElementById('noticeX').click();
 });
 await p667.waitForTimeout(150);
 await p667.evaluate(()=>{ document.querySelector('.mnode[data-s="home"]').click(); });
 await p667.waitForTimeout(350);
 const shortPhone=await p667.evaluate(()=>{
   const view=document.getElementById('view');
   const row=document.querySelector('#sysBuildRows .g');
   const bar=document.getElementById('sshScanBar');
   const wrap=document.getElementById('mapWrap');
   const cv=document.getElementById('mapZoom');
   const gctx=cv.getContext('2d');
   const d=gctx.getImageData(0,0,cv.width,cv.height).data;
   let nonzero=0; for(let i=3;i<d.length;i+=4*97) if(d[i]>0)nonzero++;
   // the canvas backing store tracks clientWidth/clientHeight*devicePixelRatio,
   // rounded (see the resize check right above draw()'s own MZW/MZH guard) -
   // not the raw CSS box, which is what devicePixelRatio:2 contexts (this
   // file's own convention) would otherwise make this look mismatched by ~2x.
   const dpr=window.devicePixelRatio||1;
   const expectW=Math.round(cv.clientWidth*dpr), expectH=Math.round(cv.clientHeight*dpr);
   return {
     rowBottom: row?row.getBoundingClientRect().bottom:null,
     barTop: bar.getBoundingClientRect().top,
     wrapHeight: getComputedStyle(wrap).height,
     noScroll: (view.scrollHeight-view.clientHeight)<=1,
     canvasMatchesBox: Math.abs(cv.width-expectW)<=1 && Math.abs(cv.height-expectH)<=1,
     canvasW: cv.width, canvasH: cv.height, expectW, expectH,
     canvasNonBlank: nonzero>0,
   };
 });
 ok('patch632: at 390x667, a fresh save\'s first BUY row (home, Mining Drone) clears the pinned SCAN SECTOR bar with no scroll',
    shortPhone.rowBottom!==null && shortPhone.rowBottom<shortPhone.barTop && shortPhone.noScroll, shortPhone);
 ok('patch632: #mapWrap is the new 26vh (173px) short-phone height at 390x667, not the 34vh tall-phone one',
    parseFloat(shortPhone.wrapHeight)<200 && parseFloat(shortPhone.wrapHeight)>150, shortPhone);
 ok('patch632: the planet still draws at the new box size - canvas backing store matches it, non-blank',
    shortPhone.canvasMatchesBox && shortPhone.canvasNonBlank, shortPhone);
 await ctx667.close();

 // reset for the defence-gate section below
 await p.evaluate(()=>{ const G=window.__SD; G.S.msel=null; G.setMapZoom(null); G.dirty=true; G.render(); });

 // ================================================================== 621: defence gate
 // - gated (no exotic ever banked, nothing filled): header + dim hint, #sysDefRow empty.
 // - the transition: banking the exotic (+ the real per-tick exoSeen mark) makes the
 //   normal three cards appear on the very next render(), same session, no reload.
 const gatedState=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e9, lvl:99, lvSeen:99, ore:1e9});
   const kor=G.SYSMAP.kor; // exotic-kind, res:"ir", never banked on a fresh save
   G.claimSystem(kor);
   G.dirty=true; G.render();
   const head=document.getElementById('sysDefHead'), row=document.getElementById('sysDefRow');
   return { headHTML: head.innerHTML, rowChildren: row.children.length,
     mentionsIridium: /iridium/i.test(head.textContent) };
 });
 ok('a just-claimed exotic system with nothing ever banked: DEFENCES header shown, row EMPTY',
    gatedState.rowChildren===0 && gatedState.mentionsIridium, gatedState);

 const ungatedState=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.exo.ir=100;
   G.tick(0);                 // the real per-frame path that marks S.exoSeen.ir=true
   G.dirty=true; G.render();
   const row=document.getElementById('sysDefRow');
   return { rowChildren: row.children.length, everBanked: G.S.exoSeen&&G.S.exoSeen.ir,
     scCount: row.querySelectorAll('.sc').length };
 });
 ok('banking the exotic (+tick()) reveals the three real slot cards on the very next render()',
    ungatedState.rowChildren===3 && ungatedState.everBanked && ungatedState.scCount===3, ungatedState);

 // the gate is permanent - emptying the balance back to 0 does not bring it back
 const stillUngated=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.exo.ir=0;
   G.dirty=true; G.render();
   return { rowChildren: document.getElementById('sysDefRow').children.length };
 });
 ok('the gate never re-locks once the exotic has ever been banked (permanent, like exoStrip)',
    stillUngated.rowChildren===3, stillUngated);

 // ore-kind systems (res:null) are never gated - they price in plain ore, always on hand
 const oreKindState=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), all:1e9, lvl:99, lvSeen:99, ore:1e9});
   const dra=G.SYSMAP.dra; // res:null
   G.claimSystem(dra);
   G.dirty=true; G.render();
   const row=document.getElementById('sysDefRow');
   return { rowChildren: row.children.length };
 });
 ok('an ore-kind system (no separate exotic) is never gated', oreKindState.rowChildren===3, oreKindState);

 // ================================================================== 624/626: the
 // sheet's own SCAN SECTOR button. Present once in static markup (never rebuilt),
 // wired to the exact same doScan(e) path #scan uses, hidden opposite
 // #sysThreatActs (both position:fixed;bottom:0 since patch626, mutually
 // exclusive - sticky's own PEEK-era coupling to the sheet's height is gone).
 const scanBarFixture=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, lvl:99, lvSeen:99});
   const kor=G.SYSMAP.kor; // res:'ir', a real doScan() target
   G.claimSystem(kor);
   G.dirty=true; G.render();
   const bar=document.getElementById('sshScanBar'), btn=document.getElementById('sshScan');
   return { barPresent: !!bar, btnPresent: !!btn, barHidden: bar?bar.hidden:null,
     position: bar?getComputedStyle(bar).position:null,
     isLastChild: bar && bar.parentElement===document.getElementById('sysSheet') && bar===document.getElementById('sysSheet').lastElementChild };
 });
 await p.waitForTimeout(400);
 ok('patch624/626: #sshScanBar/#sshScan exist once in static markup, as the last child of #sysSheet, and #sshScanBar is position:fixed (pinned to the viewport, patch626)',
    scanBarFixture.barPresent && scanBarFixture.btnPresent && !scanBarFixture.barHidden &&
    scanBarFixture.position==='fixed' && scanBarFixture.isLastChild, scanBarFixture);

 const visInViewport=await p.evaluate(()=>{
   const bar=document.getElementById('sshScanBar');
   const br=bar.getBoundingClientRect();
   return { pinnedToBottom: Math.abs(br.bottom-innerHeight)<1, width:br.width, height:br.height, br };
 });
 ok('patch626: the SCAN SECTOR bar is pinned flush to the true bottom edge of the viewport',
    visInViewport.pinnedToBottom && visInViewport.width>0 && visInViewport.height>0, visInViewport);

 // patch626/627: PEEK is gone - there is exactly one open page state now, not
 // three. Scrolled deep into a tall page's own content, nothing of that content
 // sits BELOW the pinned bar's own top edge (the #view padding-bottom fix, not a
 // sheet-height cap) - the direct replacement for patch624's own "does the
 // button stay clear of #sysInfo" concern, now framed against the real scroller.
 await p.evaluate(()=>{ document.getElementById('view').scrollTo({top:9999,behavior:'instant'}); });
 await p.waitForTimeout(200);
 const scrolledClear=await p.evaluate(()=>{
   const view=document.getElementById('view'), bar=document.getElementById('sshScanBar');
   return { viewScrollTop:view.scrollTop, viewScrollHeight:view.scrollHeight, viewClientHeight:view.clientHeight,
     barTop:bar.getBoundingClientRect().top };
 });
 // #view's own padding-bottom (patch626) is what guarantees this - scrolled all
 // the way down, the remaining unscrolled distance (scrollHeight - scrollTop -
 // clientHeight) must be covered by the reserved padding, not by the live bar.
 const remaining = scrolledClear.viewScrollHeight - scrolledClear.viewScrollTop - scrolledClear.viewClientHeight;
 ok('patch626: scrolled to the bottom of a tall page, nothing of its own content sits under the pinned SCAN SECTOR bar',
    remaining>=-1 && remaining<150, {...scrolledClear, remaining});
 await p.evaluate(()=>{ document.getElementById('view').scrollTo({top:0,behavior:'instant'}); });
 await p.waitForTimeout(200);

 // hidden opposite #sysThreatActs - a system actually under attack, not just a
 // static flag read (same staging tsheet2.js/topen2.js's own threat-reach test use).
 const underAttack=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, lvl:99, lvSeen:99});
   const kor=G.SYSMAP.kor;
   G.claimSystem(kor);
   G.dirty=true; G.render();
   G.S.thq=G.S.thq||[];
   G.S.thq.push({id:'t-topen2-scanbar', sysId:'kor', rv:'hel', kind:'siege', t:600});
   G.dirty=true; G.render();
   const bar=document.getElementById('sshScanBar'), acts=document.getElementById('sysThreatActs');
   return { barHidden: bar.hidden, actsHidden: acts.hidden,
     actsPosition: getComputedStyle(acts).position,
     actsPinnedToBottom: Math.abs(acts.getBoundingClientRect().bottom-innerHeight)<1 };
 });
 ok('patch624: the SCAN SECTOR button hides while #sysThreatActs (DEFEND IT / LET THEM HOLD) is showing',
    underAttack.barHidden===true && underAttack.actsHidden===false, underAttack);
 ok('patch626: #sysThreatActs is ALSO position:fixed, pinned to the viewport bottom, same as the scan bar',
    underAttack.actsPosition==='fixed' && underAttack.actsPinnedToBottom, underAttack);

 // and comes back once the threat clears - same fixture, resolve it.
 const afterThreatClears=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.thq=[];
   G.dirty=true; G.render();
   const bar=document.getElementById('sshScanBar'), acts=document.getElementById('sysThreatActs');
   return { barHidden: bar.hidden, actsHidden: acts.hidden };
 });
 ok('patch624: the button reappears once the threat is gone (acts hides back, bar shows back)',
    afterThreatClears.barHidden===false && afterThreatClears.actsHidden===true, afterThreatClears);

 // home is a real regression trap: renderMap()'s own `if(s.home||!act){...return}`
 // returns BEFORE the block that shows/hides #sshScanBar against #sysThreatActs
 // even runs - home never reaches it, in either direction. Fixed (patch624) by
 // defaulting the bar to VISIBLE in markup instead, so home's resting state is
 // correct without ever touching that code path - still true after patch626/627's
 // own rewrite of that function, reverified here.
 const homeVisible=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, lvl:60, lvSeen:60});
   G.gotoTab('p-map'); G.dirty=true; G.render();
   document.querySelector('.mnode[data-s="home"]').click();
   return {};
 });
 await p.waitForTimeout(400);
 const homeResult=await p.evaluate(()=>{
   const bar=document.getElementById('sshScanBar');
   return { barHidden: bar.hidden, mapZoom: window.__SD.mapZoom };
 });
 ok('patch624: the SCAN SECTOR button is shown for the HOME system too (renderMap() returns early for home, before the show/hide block runs at all)',
    homeResult.barHidden===false && homeResult.mapZoom==='home', homeResult);

 // ore-increment parity: a real click on the button must reach the exact same
 // doScan(e) path #scan uses - not a second implementation.
 await p.waitForTimeout(400);
 const oreBeforeBar=await p.evaluate(()=>window.__SD.S.ore);
 const expectedPow=await p.evaluate(()=>window.__SD.clickPow());
 await p.click('#sshScan');
 const oreAfterBar=await p.evaluate(()=>window.__SD.S.ore);
 const barDelta=oreAfterBar-oreBeforeBar;
 // a tiny relative tolerance absorbs ordinary float rounding without masking a
 // real reimplementation (which would be off by a different formula entirely).
 const relDiff=Math.abs(barDelta-expectedPow)/expectedPow;
 ok('patch624: clicking SCAN SECTOR in the sheet increments ore by (within float drift of) clickPow() - the same value/path #scan itself uses, no reimplementation',
    relDiff<1e-4, {barDelta, expectedPow, relDiff});

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
