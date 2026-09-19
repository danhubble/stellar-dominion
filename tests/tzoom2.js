const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tzoom2.js — PLAN-zoom.md batch 1: tap a system, the map becomes its planet
// (patch602-606). tmap2.js's pattern: dismiss the intro overlay deterministically,
// drive state through window.__SD, print PASS/FAIL lines and a final "N failures"
// + "NO JS ERRORS"/"JS ERRORS" line.
//
// "kor" (Koru) and "dra" (Draskhold) are both core-sector (sec:0, the default
// mapSec) systems - kor gets claimed as the "claimed" fixture, dra is left
// untouched as the "unclaimed" fixture, so neither test needs a sector change
// of its own.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext();
 const p=await ctx.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- fixtures: claim Koru, leave Draskhold open, land on the Map tab ----------
 await p.evaluate(()=>{
   const G=__SD;
   G.S.ore=1e9; G.S.lvl=99;
   const kor=G.SYS.find(s=>s.id==='kor');
   G.claimSystem(kor);
   G.dismissNotice();
   G.gotoTab('p-map');
 });
 await p.waitForTimeout(300);

 const zoomState=async()=>p.evaluate(()=>({
   mapZoom: __SD.mapZoom,
   wrapZoomed: document.getElementById('mapWrap').classList.contains('zoomed'),
   // patch628b: #sysSheet.open is gone - body.syspage is the fact now (the
   // coordinator's review caught .open as a second class duplicating it).
   sheetOpen: document.body.classList.contains('syspage'),
   msel: __SD.S.msel,
 }));
 const clickNode=async(id)=>{
   await p.evaluate((id)=>{
     const btn=Array.from(document.querySelectorAll('#mapNodes .mnode')).find(x=>x.dataset.s===id);
     if(btn)btn.click();
   }, id);
   await p.waitForTimeout(150);
 };

 // ---------- 1. tapping a claimed system opens the zoom and the sheet ----------
 await clickNode('kor');
 let st=await zoomState();
 ok('claimed tap opens zoom', st.mapZoom==='kor' && st.wrapZoomed, st);
 ok('claimed tap opens sheet', st.sheetOpen && st.msel==='kor', st);

 // back out before the next fixture, via `< MAP` - the one close path left after
 // patch626/627 (PLAN-page.md) deleted #sshClose and the background-tap-to-close.
 await p.evaluate(()=>{ document.getElementById('mapZoomBack').click(); });
 await p.waitForTimeout(150);

 // ---------- 2. tapping an unclaimed system opens the sheet, leaves the map alone ----------
 await clickNode('dra');
 st=await zoomState();
 ok('unclaimed tap opens sheet', st.sheetOpen && st.msel==='dra', st);
 ok('unclaimed tap does not zoom', st.mapZoom===null && !st.wrapZoomed, st);

 // ---------- 3. '<' MAP closes the WHOLE page now (zoom AND selection together) ----------
 // patch627 (PLAN-page.md, "one fact"): the old sheet/zoom split let '< MAP' clear
 // only the zoom and leave the sheet open, with a separate X button (#sshClose,
 // deleted patch626) closing the sheet the rest of the way. Both close paths
 // collapsed into one - S.msel=null is the whole close now; body.syspage and the
 // zoom are both just derivations of it (syncSysPage()). The old test 4 that used
 // to follow this one ("closing the sheet closes the zoom", via #sshClose) is
 // gone, not rewritten - there is no longer a separate "close the sheet but not
 // the zoom" action for it to exercise.
 await clickNode('kor'); // re-select the claimed one, page+zoom both open
 st=await zoomState();
 ok('setup: kor zoom open before back-button check', st.mapZoom==='kor' && st.wrapZoomed, st);
 await p.evaluate(()=>{ document.getElementById('mapZoomBack').click(); });
 await p.waitForTimeout(150);
 st=await zoomState();
 ok('back button closes zoom', st.mapZoom===null && !st.wrapZoomed, st);
 ok('back button closes the whole page too - msel cleared, not just the zoom', !st.sheetOpen && st.msel===null, st);

 // ---------- 5. sector change no longer reaches into the page (patch627) ----------
 // setMapSec()'s own zoom-clear was deleted outright, not redirected - per its own
 // comment, #mapChips and the sector swipe (the only two ways to reach it) are both
 // already unreachable while a page is open, so there was nothing left to clear.
 // Verify both halves: the chips really are hidden (not just untested - a real
 // player cannot reach them), and calling setMapSec() directly (bypassing that now-
 // moot reachability question) confirms the page genuinely survives a sector change.
 await clickNode('kor');
 st=await zoomState();
 ok('setup: kor zoom open before sector-change check', st.mapZoom==='kor' && st.wrapZoomed, st);
 const chipsDisplayWhilePaged=await p.evaluate(()=>getComputedStyle(document.getElementById('mapChips')).display);
 ok('#mapChips is display:none while a page is open (unreachable, per body.syspage)', chipsDisplayWhilePaged==='none', chipsDisplayWhilePaged);
 await p.evaluate(()=>{ __SD.setMapSec(1); });
 await p.waitForTimeout(150);
 st=await zoomState();
 ok('setMapSec() no longer clears the page (its own zoom-clear was deleted, patch627)', st.mapZoom==='kor' && st.wrapZoomed && st.msel==='kor', st);
 // back to the core sector (sector 0) for the tests that follow
 await p.evaluate(()=>{ __SD.setMapSec(0); });
 await p.waitForTimeout(150);

 // ---------- 6. leaving the Map tab closes the zoom ----------
 await clickNode('kor');
 st=await zoomState();
 ok('setup: kor zoom open before tab-change check', st.mapZoom==='kor' && st.wrapZoomed, st);
 // patch612: p-emp no longer exists - gotoTab() only clicks a `.tab[data-p=...]`
 // it can actually find, so this used to silently no-op (never truly leaving
 // Map) rather than exercise the tab-click handler's own zoom-clearing line.
 // Missions is a real, always-present tab; same scenario, a real target.
 await p.evaluate(()=>{ __SD.gotoTab('p-mis'); });
 await p.waitForTimeout(150);
 const awayState=await p.evaluate(()=>({mapZoom:__SD.mapZoom, msel:__SD.S.msel, bodySyspage:document.body.classList.contains('syspage')}));
 ok('leaving Map tab closes the zoom/page display', awayState.mapZoom===null && !awayState.bodySyspage, awayState);
 // patch627: S.msel itself is untouched by a tab switch - only the derivation
 // (body.syspage/mapZoom) turns off while away; the old explicit
 // `if(id!=="p-map")setMapZoom(null);` line in the tab handler is gone, this is
 // syncSysPage() recomputing "on" fresh and finding the active tab isn't p-map.
 ok('...but S.msel itself survives the trip (it is a fact, not a UI mode)', awayState.msel==='kor', awayState);
 await p.evaluate(()=>{ __SD.gotoTab('p-map'); });
 await p.waitForTimeout(150);
 st=await zoomState();
 ok('back on Map, the page re-derives zoomed with no further tap needed', st.mapZoom==='kor' && st.wrapZoomed && st.sheetOpen, st);

 // ---------- 7. the page DOES survive a save/reload now (S.msel is a save field) ----------
 // patch627 (PLAN-page.md): S.msel lives inside S, so pack()'s JSON.stringify(S)
 // includes it like any other save field - there is no separate ephemeral "zoom is
 // UI-only" state left that would NOT persist. This is a deliberate behaviour
 // change from the old sheet, not an oversight - the coordinator's own "old-save
 // note" asked for this to be verified explicitly, including a system outside the
 // default sector (below).
 await clickNode('kor');
 st=await zoomState();
 ok('setup: kor zoom open before save/reload check', st.mapZoom==='kor' && st.wrapZoomed, st);
 await p.evaluate(()=>{ __SD.save(); });
 await p.reload();
 await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 await p.evaluate(()=>{ __SD.gotoTab('p-map'); });
 await p.waitForTimeout(300);
 const afterReload=await p.evaluate(()=>({mapZoom:__SD.mapZoom, msel:__SD.S.msel, bodySyspage:document.body.classList.contains('syspage')}));
 ok('the page survives a save/reload: S.msel/zoom/body.syspage all restored', afterReload.msel==='kor' && afterReload.mapZoom==='kor' && afterReload.bodySyspage, afterReload);

 // old-save note (coordinator): S.msel naming a system in ANOTHER sector than the
 // one the map happens to be showing must still boot the page correctly - mapSec
 // is not part of S (it resets to its own default on a fresh script load) and must
 // not be required to match S.msel's own sector for the page itself to render.
 const otherSecId=await p.evaluate(()=>{ const s=__SD.SYS.find(x=>x.sec>0 && !x.home); return s?s.id:null; });
 ok('setup: a system exists in a non-default sector to test against', !!otherSecId, otherSecId);
 if(otherSecId){
   await p.evaluate((id)=>{ const G=__SD; G.S.msel=id; G.dirty=true; G.render(); G.save(); }, otherSecId);
   await p.reload();
   await p.waitForTimeout(500);
   await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
   await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
   await p.evaluate(()=>{ __SD.gotoTab('p-map'); });
   await p.waitForTimeout(300);
   const crossSector=await p.evaluate((id)=>({
     msel:__SD.S.msel, mapSec:__SD.mapSec, bodySyspage:document.body.classList.contains('syspage'),
     nameText:(document.getElementById('mapZoomName')||{}).textContent,
   }), otherSecId);
   ok('a reload with S.msel naming a system in another sector still opens that system\'s page correctly',
      crossSector.msel===otherSecId && crossSector.bodySyspage && !!crossSector.nameText && crossSector.nameText.length>0, crossSector);
 }

 // ---------- 8. the sector swipe is inert while zoomed (checked against a working swipe) ----------
 await p.evaluate(()=>{ __SD.gotoTab('p-map'); });
 await p.waitForTimeout(200);
 // clean slate: close whatever page the reload test above left open, so the
 // positive control just below really has nothing open, not incidentally.
 await p.evaluate(()=>{ const btn=document.getElementById('mapZoomBack'); if(btn)btn.click(); });
 await p.waitForTimeout(150);
 const swipeLeft=async()=>p.evaluate(()=>{
   const wrap=document.getElementById('mapWrap');
   const fire=(type,x,y)=>{
     const t=new Touch({identifier:1,target:wrap,clientX:x,clientY:y});
     wrap.dispatchEvent(new TouchEvent(type,{
       touches: type==='touchend' ? [] : [t],
       changedTouches:[t], bubbles:true, cancelable:true,
     }));
   };
   fire('touchstart',300,300);
   fire('touchmove',200,300);
   fire('touchend',200,300);
 });
 // positive control: not zoomed, the same swipe DOES move the sector
 const secBefore=await p.evaluate(()=>__SD.mapSec);
 await swipeLeft();
 await p.waitForTimeout(150);
 const secAfterControl=await p.evaluate(()=>__SD.mapSec);
 ok('positive control: swipe moves sector when not zoomed', secAfterControl!==secBefore, {secBefore,secAfterControl});
 // back to core sector, re-open the zoom, then repeat the same swipe
 await p.evaluate(()=>{ __SD.setMapSec(0); });
 await p.waitForTimeout(150);
 await clickNode('kor');
 st=await zoomState();
 ok('setup: kor zoom open before swipe-inert check', st.mapZoom==='kor' && st.wrapZoomed, st);
 const secBeforeZoomed=await p.evaluate(()=>__SD.mapSec);
 await swipeLeft();
 await p.waitForTimeout(150);
 const secAfterZoomed=await p.evaluate(()=>__SD.mapSec);
 const mzAfterSwipe=await p.evaluate(()=>__SD.mapZoom);
 ok('sector swipe is inert while zoomed', secAfterZoomed===secBeforeZoomed, {secBeforeZoomed,secAfterZoomed});
 ok('zoom itself survives the inert swipe', mzAfterSwipe==='kor', {mapZoom:mzAfterSwipe});

 // patch627's own specific fix: the swipe guard now checks body.syspage, not
 // mapZoom directly - an unclaimed system's page (never zoomed) must ALSO refuse
 // the swipe, which the old mapZoom-only guard would have missed entirely.
 await p.evaluate(()=>{ const btn=document.getElementById('mapZoomBack'); if(btn)btn.click(); });
 await p.waitForTimeout(200);
 await clickNode('dra'); // unclaimed - page opens, never zoomed
 st=await zoomState();
 ok('setup: dra page open but not zoomed before the unclaimed-swipe check', st.sheetOpen && st.msel==='dra' && !st.wrapZoomed, st);
 const secBeforeUnzoomedPage=await p.evaluate(()=>__SD.mapSec);
 await swipeLeft();
 await p.waitForTimeout(150);
 const secAfterUnzoomedPage=await p.evaluate(()=>__SD.mapSec);
 ok('patch627: the swipe is ALSO inert on an unclaimed (never-zoomed) page - the old mapZoom-only guard would have missed this',
    secAfterUnzoomedPage===secBeforeUnzoomedPage, {secBeforeUnzoomedPage,secAfterUnzoomedPage});

 console.log(out.join('\n'));
 const fails=out.filter(l=>l.startsWith('FAIL')).length;
 console.log(fails+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
