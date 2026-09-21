const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
// MOCK ONLY - injects at runtime, touches no game file. Three options for where the
// full-size SCAN SECTOR button lives inside #sysSheet.
const CSS = `
.mockscan{width:100%;padding:14px 10px;border-radius:12px;cursor:pointer;
  border:1px solid rgba(72,226,255,.45);
  background:linear-gradient(180deg,rgba(72,226,255,.20),rgba(72,226,255,.05));
  color:#eafcff;font:700 13px/1 system-ui;letter-spacing:.18em;
  box-shadow:0 0 22px rgba(72,226,255,.12) inset}
.mockscan small{display:block;margin-top:5px;font:400 10px/1 ui-monospace,monospace;
  letter-spacing:.05em;color:#a9e9ff}
.mockbot{position:sticky;bottom:0;z-index:3;margin:10px -14px 0;
  padding:10px 14px calc(6px + env(safe-area-inset-bottom,0px));
  background:#0a0e24;border-top:1px solid var(--line);
  box-shadow:0 -10px 18px -8px rgba(0,0,0,.6)}
.mocktop{position:sticky;top:0;z-index:3;margin:0 -14px 8px;padding:2px 14px 10px;
  background:#101637;box-shadow:0 10px 16px -10px rgba(0,0,0,.6)}
`;
const BTN = `<button class="mockscan">SCAN SECTOR<small>free &middot; yields <b>+1</b></small></button>`;
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const shot=async(mode,file)=>{
  const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.goto(GAME_URL); await p.waitForTimeout(500);
  await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{const G=window.__SD;
    G.adopt({ore:14,exo:{},exoSeen:{},sys:{home:{home:true,b:{0:2}}},lvl:1,lvSeen:1,
      rs:{},nx:{},ab:[],buy:1,msel:'home'}); G.render();});
  await p.waitForTimeout(500);
  await p.evaluate(([css,btn,mode])=>{
    const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    const sheet=document.getElementById('sysSheet');
    const chip=document.getElementById('sshScan');
    if(mode!=='chip' && chip) chip.style.display='none';
    if(mode==='bottom'){ const d=document.createElement('div'); d.className='mockbot';
      d.innerHTML=btn; sheet.appendChild(d); }
    if(mode==='top'){ const d=document.createElement('div'); d.className='mocktop';
      d.innerHTML=btn; sheet.insertBefore(d, document.getElementById('sysInfo')); }
  },[CSS,BTN,mode]);
  await p.waitForTimeout(400);
  await p.screenshot({path:SHOTS+''+file});
  await ctx.close();
 };
 await shot('bottom','scanopt-a-bottom.png');
 await shot('top','scanopt-b-top.png');
 await shot('chip','scanopt-c-chip-now.png');
 await b.close();
})();
