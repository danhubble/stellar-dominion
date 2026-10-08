const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tunify2.js — Run 3 (patch614/615/616, PLAN-unify.md): the MAP | LIST toggle and the
// site view, plus a few pre-existing pieces of the unified sheet/map the plan's own
// item 616 lists explicitly (context card, level-8 reveal, buildings in the sheet,
// buying from the sheet, scroll memory surviving a buy) that had no dedicated coverage
// of their own once empSysRow()/the old accordion were gone. Where a scenario is
// already covered in depth elsewhere (tlockstates2.js for lock-state transitions via
// the real takeLevel() path, tsheet2.js for the sheet's open/close mechanics), this
// file exercises it only as far as this run's own features need, not a duplicate of
// that coverage.
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

 // a mid-game save: level 15 (past the level-5 reveal, and past Velis's own lvl:14),
 // home built up a bit, Koru (rock, exotic "ir") held with one tier, Draskhold (ore,
 // no exotic) held with two tiers so a NEXT TIER READY badge has something to be
 // true/false about. Left unclaimed in the same sector: Velis (lvl 14 <= 15, so
 // CLAIMABLE) and Tannhau/Mireth (lvl 17/20 > 15, so LOCKED) - a claimable row and a
 // locked row both on screen at once, same combination the plan's own screenshot
 // list asks for.
 const midGame=()=>({
   ore:5e6, all:0, cry:0, dm:0, exo:{ir:50}, exoSeen:{ir:true},
   sys:{
     home:{home:true,b:{0:4,1:2,2:1}},
     kor:{b:{0:1}},                 // Koru: rock/ir, one tier owned, one ready
     dra:{b:{0:1,1:1}},             // Draskhold: ore, two tiers owned
   },
   lvl:15, lvSeen:15, rs:{}, nx:{}, ab:[], buy:1, msel:null,
 });

 // ---------- context card: a system with an exotic, and home (no exotic) ----------
 const ctxExo=await p.evaluate((save)=>{
   const G=window.__SD;
   G.adopt(save);
   G.S.msel='kor'; G.gotoTab('p-map'); G.render();
   return {val:document.getElementById('vCtxVal').textContent,
           name:document.getElementById('vCtxName').textContent,
           rate:document.getElementById('vCtxRate').textContent};
 }, midGame());
 ok('context card on a system with an exotic shows its name and balance',
    ctxExo.name==='IRIDIUM' && ctxExo.val!=='—', ctxExo);

 const ctxHome=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.msel='home'; G.render();
   return {val:document.getElementById('vCtxVal').textContent,
           name:document.getElementById('vCtxName').textContent,
           rate:document.getElementById('vCtxRate').textContent};
 });
 ok('context card on home (no exotic) reads NO EXOTIC / HERE',
    ctxHome.name==='NO EXOTIC' && ctxHome.rate==='HERE' && ctxHome.val==='—', ctxHome);

 // ---------- level-5 reveal: sysInSec() gates every sector but home's own below it ----------
 // (PLAN-pacing: map unlock moved 8->5 - see unlockLv("p-map") - own dedicated
 // coverage of the reveal boundary itself now lives in tpacing2.js; this file keeps
 // just enough to exercise sysInSec() the way this run's other scenarios need it.)
 const reveal=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ore:0, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},
     lvl:1, lvSeen:1, rs:{}, nx:{}, ab:[], buy:1, msel:null});
   const below=G.sysInSec(0).map(s=>s.id);
   G.S.lvl=5;
   const above=G.sysInSec(0).map(s=>s.id);
   return {below, above};
 });
 ok('below level 5, a sector page shows only home', reveal.below.length===1 && reveal.below[0]==='home', reveal.below);
 ok('at level 5, the same sector page shows every system in it', reveal.above.length>1 && reveal.above.includes('home'), reveal.above);

 // ---------- buildings rendered in the sheet + buying from the sheet + scroll memory ----------
 const sheet=await p.evaluate((save)=>{
   const G=window.__SD;
   G.adopt(save);
   G.S.msel='dra'; G.setMapZoom('dra'); G.render();
   const rows=[...document.querySelectorAll('#sysBuildRows .g')];
   return {
     buildHidden: document.getElementById('sysBuild').hidden,
     rowCount: rows.length,
     ownedCount: rows.filter(r=>!r.classList.contains('next')).length,
     nextCount: rows.filter(r=>r.classList.contains('next')).length,
     tierCount: document.getElementById('sysBuildCount').textContent,
   };
 }, midGame());
 ok('buildings render in the sheet for a held system (owned tiers + one next-up)',
    !sheet.buildHidden && sheet.ownedCount===2 && sheet.nextCount===1, sheet);
 ok('the tier count line matches what is actually owned', sheet.tierCount.startsWith('2 of'), sheet.tierCount);

 // patch626 (PLAN-page.md): #sysSheet is in-flow now, not its own scroll container
 // (see its own CSS comment) - #view is what scrolls, and it's what
 // renderSysBuild()'s own capture/restore was retargeted to (see its comment).
 // #view also carries CSS scroll-behavior:smooth, so the initial position has to
 // be set via scrollTo(..., {behavior:'instant'}), not a raw .scrollTop= write, or
 // it animates toward 40 instead of jumping there (caught by hand while fixing
 // this - the naive version read back a stale in-flight value, same trap
 // tscrolldevfix2.js's own fix for this batch just hit).
 const buy=await p.evaluate(()=>{
   const G=window.__SD;
   const viewEl=document.getElementById('view');
   try{ viewEl.scrollTo({top:40, behavior:'instant'}) }catch(_){ viewEl.scrollTop=40 }
   const before=G.sysTierCount('dra',2);
   document.querySelector('#sysBuildRows .g.next .gb').click();
   const after=G.sysTierCount('dra',2);
   return {before, after, scrollAfterBuy:viewEl.scrollTop};
 });
 ok('buying from the sheet actually builds the next tier', buy.before===0 && buy.after===1, buy);
 ok("scroll position survives a buy (the rebuild re-asserts it, not just \"didn't move\")",
    buy.scrollAfterBuy===40, buy);

 // ---------- the LIST view is gone: the map is the only view ----------
 const list=await p.evaluate((save)=>{
   const G=window.__SD;
   G.adopt(save);
   G.gotoTab('p-map'); G.setMapZoom(null); G.S.msel=null;
   G.render();
   return { toggle:!!document.getElementById('mapMode'), list:!!document.getElementById('mapList'),
     btn:!!document.querySelector('.rmbtn[data-mm]'), wrapHidden:document.getElementById('mapWrap').hidden };
 }, midGame());
 ok('the MAP | LIST toggle and the list view are gone - the map is the only view', !list.toggle && !list.list && !list.btn && !list.wrapHidden, list);
 await p.evaluate(()=>{ const G=window.__SD; G.S.msel='dra'; G.setMapZoom('dra'); G.render(); });

 // ---------- site view: opening and closing ----------
 const site=await p.evaluate((save)=>{
   const G=window.__SD;
   G.adopt(save);
   G.S.msel='dra'; G.setMapZoom('dra'); G.render();
   const backBefore=document.getElementById('mapZoomBack').textContent;
   const oreGi=document.querySelector('#sysBuildRows .g .gi.gi-site');
   const kindGi=(()=>{
     // koru is a rock (kind-ladder) system - its rows must carry no .gi-site at all
     G.S.msel='kor'; G.setMapZoom('kor'); G.render();
     return document.querySelector('#sysBuildRows .g .gi.gi-site');
   })();
   // back onto the ore system to actually open its site
   G.S.msel='dra'; G.setMapZoom('dra'); G.render();
   const giEl=document.querySelector('#sysBuildRows .g .gi.gi-site');
   const mapSiteBefore=G.mapSite;
   if(giEl)giEl.click();
   const mapSiteAfterOpen=G.mapSite;
   const backAfterOpen=document.getElementById('mapZoomBack').textContent;
   document.getElementById('mapZoomBack').click();
   const mapSiteAfterBack=G.mapSite;
   const zoomStillOpen=G.mapZoom;
   const backAfterClose=document.getElementById('mapZoomBack').textContent;
   // open it again, then leave the zoom entirely by a DIFFERENT path (not the back
   // button, which - with a site open - only closes the site, one step at a time;
   // setMapZoom(null) is what every other "leave the zoom" path (sheet close, tap
   // outside, sector change, tab change) actually funnels through) - must clear
   // mapSite too, not just mapZoom.
   giEl.click();
   const mapSiteBeforeLeave=G.mapSite;
   G.setMapZoom(null);
   const mapSiteAfterLeave=G.mapSite;
   const zoomAfterLeave=G.mapZoom;
   return {
     oreHasSite: !!oreGi, kindHasSite: !!kindGi,
     backBefore, mapSiteBefore, mapSiteAfterOpen, backAfterOpen,
     mapSiteAfterBack, zoomStillOpen, backAfterClose,
     mapSiteBeforeLeave, mapSiteAfterLeave, zoomAfterLeave,
   };
 }, midGame());
 ok('an ore-ladder tier\'s icon carries the site-view affordance class', site.oreHasSite, site.oreHasSite);
 ok('a kind-ladder tier\'s icon does not (no site art for it)', !site.kindHasSite, site.kindHasSite);
 ok('mapSite starts null on a fresh zoom', site.mapSiteBefore===null, site.mapSiteBefore);
 ok('tapping the icon opens the site view (mapSite set)', site.mapSiteAfterOpen!==null, site.mapSiteAfterOpen);
 ok('the back control relabels to "< SYSTEM" while a site is open', backAfterOpenIsSystem(site.backAfterOpen), site.backAfterOpen);
 ok('the back control closes only the site, not the zoom (mapZoom still set)', site.mapSiteAfterBack===null && !!site.zoomStillOpen, site);
 ok('the back control relabels back to "< MAP" once the site is closed', backAfterCloseIsMap(site.backAfterClose), site.backAfterClose);
 ok('opening a site then leaving the zoom entirely clears both', site.mapSiteBeforeLeave!==null && site.mapSiteAfterLeave===null && !site.zoomAfterLeave, site);

 function backAfterOpenIsSystem(t){ return /SYSTEM/.test(t); }
 function backAfterCloseIsMap(t){ return /MAP/.test(t); }

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?('PAGEERROR: '+errs.join(' | ')):'NO JS ERRORS');
 await b.close();
})();
