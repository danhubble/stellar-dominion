const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
// MOCK ONLY - runtime CSS injection, no game file touched. "System page" layout:
// planet header on top, sheet content flows below it as a normal page.
const CSS = `
#mapChips,#mapMode,#exoStrip,#lfBanner{display:none!important}
#left{display:none!important}
#mapWrap{max-height:34vh!important;aspect-ratio:auto!important;height:34vh!important;
  margin-bottom:0!important;border-radius:14px 14px 0 0!important}
#sysSheet{position:static!important;transform:none!important;max-height:none!important;
  overflow:visible!important;border-radius:0 0 16px 16px!important;border-top:none!important;
  box-shadow:none!important;pointer-events:auto!important}
#sshGrab,.sshx{display:none!important}
#sshScanBar{position:fixed!important;left:0;right:0;bottom:0;z-index:20;margin:0!important;
  padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px))!important;
  background:#0a0e24;border-top:1px solid var(--line)}
#view{padding-bottom:110px!important}
`;
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForTimeout(400);
 await p.evaluate(()=>{const G=window.__SD;
   G.adopt({ore:5e6,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2,1:1}}},
     lvl:20,lvSeen:20,rs:{},nx:{},ab:[],buy:1,msel:'kor'});
   G.setMapZoom('kor'); G.render();});
 await p.waitForTimeout(500);
 await p.evaluate(css=>{const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);},CSS);
 await p.waitForTimeout(600);
 await p.screenshot({path:SHOTS+'pagemock-1-top.png'});
 await p.evaluate(()=>{document.getElementById('view').scrollTop=420;});
 await p.waitForTimeout(300);
 await p.screenshot({path:SHOTS+'pagemock-2-scrolled.png'});
 await b.close();
})();
