const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true});
 const p=await ctx.newPage();
 await p.goto('file:///home/claude/stellar-dominion/dist/stellar-dominion.html'); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(300);
 await p.evaluate(()=>{ const G=__SD; G.adopt({...G.fresh(), all:1e9, lvl:30, lvSeen:30, ore:1e9, exo:{ir:1e9}, sh:[80,40,15], fhp:1, cmode:"wep"});
   G.S.fl[0].at='tan'; G.S.msel='tan'; gotoTab('p-map'); dirty=true; render(); });
 await p.waitForTimeout(500);
 await p.evaluate(()=>{ let n=0; while(__SD.S.notifyQueue&&__SD.S.notifyQueue.length&&n++<20)document.getElementById('noticeX').click(); });
 await p.waitForTimeout(300);
 await p.evaluate(()=>{ document.querySelectorAll('.toast').forEach(t=>t.remove()); const a=document.getElementById('sysAct'); if(a)a.scrollIntoView(); }); await p.waitForTimeout(200); await p.screenshot({path:'shots/b646-engage.png'});
 await b.close();
})();
