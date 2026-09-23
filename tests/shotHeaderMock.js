const SHOTS=require('path').resolve(__dirname,'../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// Polish batch A item 7: ONE-OFF mock, not part of the regression suite. Loads the
// built game, then reworks the header DOM by hand (no source edit) into the candidate
// 3-card layout (ore/crystal/dm) with the context card moved down to where the
// Research tab's crystal strip used to live, so the layout can be judged before any
// real wiring change lands. Screenshot only - never re-run after item 7 is wired
// (renderResCryStrip/renderCtxCard own that DOM for real after that).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},isMobile:true,deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:9, lvSeen:9, xpn:G.xpNeed(9), ore:48200, cry:1340, dm:12, all:1e6,
     sys:{home:{b:{0:12,1:4}}, kor:{b:{0:3}}}});
   G.S.msel='kor'; G.S.clicks=30; G.dirty=true; G.render();
 });
 await p.waitForTimeout(150);
 // rework the header into the 3-card candidate by hand, in the DOM only
 await p.evaluate(()=>{
   const res=document.querySelector('.res');
   const ore=document.getElementById('vOre').closest('.rcard');
   const dm=document.getElementById('vDm').closest('.rcard');
   const ctx=document.getElementById('ctxCard');
   const cry=document.createElement('button');
   cry.className='rcard c-cry'; cry.title='Crystal — tap for detail';
   cry.innerHTML='<div class="ricon">'+document.getElementById('riDm').innerHTML+'</div>'+
     '<div><div class="val">1,340</div><div class="sub">+2.4 /s</div></div>';
   res.innerHTML=''; res.appendChild(ore); res.appendChild(cry); res.appendChild(dm);
   // the context card, relocated to the top of the Research pane (where #resCryStrip is)
   const strip=document.getElementById('resCryStrip');
   ctx.classList.add('tappable');
   strip.appendChild(ctx);
   document.querySelector('[data-p="p-res"]').click();
 });
 await p.waitForTimeout(150);
 await p.screenshot({path:SHOTS+'polish-header.png'});
 await b.close();
 console.log('wrote', SHOTS+'polish-header.png');
})();
