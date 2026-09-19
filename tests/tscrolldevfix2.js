const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tscrolldevfix2.js — scroll-pin retest, now against #view. empAccordionTap() (this
// file's original subject, the accordion's own tap-to-expand scroll-pin) is gone with
// the rest of the accordion (patch612). Its direct successor was patch611's own
// capture/restore of #sysSheet.scrollTop around renderSysBuild()'s rebuild - the same
// underlying risk (a DOM rebuild changing the scrolling ancestor's height out from
// under the player mid-scroll), scoped to one system's buy rows instead of every
// accordion row at once. patch626 (PLAN-page.md) retargeted that capture/restore to
// #view itself (see renderSysBuild()'s own comment) - #sysSheet is in-flow now, not a
// scrolling ancestor of anything, so its scrollTop is always 0 and this test's own
// setup/measurements move to #view with it. Scenario A: scroll partway down home's
// 14-tier ladder, buy a tier (a real rebuild via ladderBuy() -> dirty=true;render()),
// confirm #view does not move. Scenario B: confirm the rebuilt rows the pin test
// measures against are not empty (a real ladder tier row exists), same purpose
// PATCH 1's own note served here.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 await p.evaluate(()=>{
   const G=window.__SD;
   // home's ore ladder (14 tiers) gives real scroll room; own the first 7 so there is
   // both owned rows above and a next-tier row still to buy against.
   const b={}; for(let gi=0; gi<7; gi++) b[gi]=1;
   G.adopt({ore:1e30, all:1e30, cry:0, dm:5e4, exo:{ir:200,he:200,xe:200,am:200},
     sys:{home:{home:true,b}}, lvl:60, rs:{}, nx:{}, ab:[], buy:1, msel:'home'});
   G.gotoTab('p-map'); dirty=true; render();
 });
 await p.waitForTimeout(300);

 // scenario A: scroll #view partway down the page's buy rows, then buy the next
 // tier - ladderBuy() -> dirty=true;render() rebuilds #sysBuildRows (patch610/611's
 // own "Watch for" risk). Confirms #view's own scrollTop does not move (patch626
 // retargeted the capture/restore from #sysSheet to #view - see this file's header).
 const viewScrollable = await p.evaluate(()=>{
   const v=document.getElementById('view');
   return v.scrollHeight-v.clientHeight;
 });
 ok('setup: #view actually has scroll room to test against', viewScrollable>20, viewScrollable);
 // #view has CSS scroll-behavior:smooth (see the tab handler's own "instant, not
 // smooth" comment in the live code) - a raw .scrollTop= write animates toward the
 // target instead of jumping, so a plain assignment here would still be mid-flight
 // 150ms later (caught by hand while writing this fix: the naive version read back
 // a value nowhere near what it had just set). scrollTo(..., {behavior:'instant'})
 // is the same escape hatch the game's own code uses for the same reason.
 await p.evaluate((max)=>{
   const v=document.getElementById('view');
   try{ v.scrollTo({top:Math.round(max/2), behavior:'instant'}) }catch(_){ v.scrollTop=Math.round(max/2) }
 }, viewScrollable);
 await p.waitForTimeout(150);
 const beforeTop = await p.evaluate(()=>document.getElementById('view').scrollTop);
 await p.evaluate(()=>{ const G=window.__SD; G.S.buy=1; G.ladderBuy('home',7); });
 await p.waitForTimeout(250);
 const afterTop = await p.evaluate(()=>document.getElementById('view').scrollTop);
 ok('A: buying a tier mid-ladder while scrolled does not move #view',
    Math.abs(afterTop-beforeTop)<1, {before:beforeTop, after:afterTop, delta:Math.abs(afterTop-beforeTop)});

 // scenario B: confirm the rows the pin test measures against are not empty - a real
 // ladder tier row exists in #sysBuildRows after the rebuild above.
 const hasTierRow = await p.evaluate(()=>document.querySelectorAll('#sysBuildRows .g').length>0);
 ok('B: the rebuilt rows being pinned against actually contain a ladder tier row', hasTierRow);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
