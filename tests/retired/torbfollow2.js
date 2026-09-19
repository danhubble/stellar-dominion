const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
// torbfollow2.js — item 3: the orb (#core) follows the expanded accordion row: recolors
// by KIND_INFO[s.kind].col and badges the system's exotic when one is open, and falls
// back to home's look when collapsed or when home itself is open.
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
   G.adopt({ore:1e9, all:1e9, cry:0, dm:5e4, exo:{ir:50}, sys:{
     home:{home:true,b:{}},
     kor:{dev:0,b:{}}
   }, lvl:20, rs:{}, nx:{}, ab:[], buy:1, msel:null});
   G.gotoTab('p-emp'); dirty=true; render();
 });
 await p.waitForTimeout(300);

 // kor is kind:rock, res:ir (Iridium). Open it.
 await p.evaluate(()=>{
   const el=[...document.querySelectorAll('#gens .sysrow2.held')].find(r=>r.textContent.includes('Koru'));
   el.click();
 });
 await p.waitForTimeout(300);
 const openState=await p.evaluate(()=>{
   const G=window.__SD;
   return {badgeDisplay:getComputedStyle(document.getElementById('orbBadge')).display,
     badgeText:document.getElementById('orbBadge').querySelector('b').textContent,
     kindCol:G.KIND_INFO.rock.col};
 });
 ok('opening Koru (rock, res:ir) shows the orb badge', openState.badgeDisplay==='flex', openState);
 ok('badge names the exotic (Iridium)', openState.badgeText==='IRIDIUM', openState);

 // collapse it - badge should hide again.
 await p.evaluate(()=>{
   const el=document.querySelector('#gens [data-sys="kor"]');
   el.click();
 });
 await p.waitForTimeout(300);
 const collapsed=await p.evaluate(()=>getComputedStyle(document.getElementById('orbBadge')).display);
 ok('collapsing hides the badge again', collapsed==='none', collapsed);

 // open home explicitly - also no badge (home has no exotic and is excluded by design).
 await p.evaluate(()=>{
   const el=document.querySelector('#gens [data-sys="home"]');
   el.click();
 });
 await p.waitForTimeout(300);
 const homeOpen=await p.evaluate(()=>({disp:getComputedStyle(document.getElementById('orbBadge')).display,
   evs:window.__SD.empOpen}));
 ok('home open shows no badge', homeOpen.disp==='none', homeOpen);

 // programme row ("x:ir") must not be treated as a system either.
 await p.evaluate(()=>{ const el=document.querySelector('#gens [data-sys="x:ir"]'); if(el)el.click(); });
 await p.waitForTimeout(300);
 const progOpen=await p.evaluate(()=>({disp:getComputedStyle(document.getElementById('orbBadge')).display,
   empOpen:window.__SD.empOpen}));
 ok('programme row open shows no badge (excluded from empViewSys)', progOpen.disp==='none', progOpen);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
