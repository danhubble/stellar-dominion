const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const out=[]; const log=(k,v)=>{out.push(k+' '+JSON.stringify(v)); };
 for(const H of [667,844]){
  const ctx=await b.newContext({viewport:{width:390,height:H},deviceScaleFactor:2,hasTouch:true});
  const p=await ctx.newPage(); p.on('pageerror',e=>log('PAGEERROR',e.message));
  await p.goto(GAME_URL); await p.waitForTimeout(600);
  await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(500);
  const st=()=>p.evaluate(()=>{const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)]};
    const cs=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).display:null};
    return {msel:__SD.S.msel,syspage:document.body.classList.contains('syspage'),zoom:__SD.mapZoom,
      chips:cs('#mapChips'),left:cs('#left'),mode:cs('#mapMode'),bar:cs('#mapZoomBar')+'/'+getComputedStyle(document.querySelector('#mapZoomBar')).opacity,
      name:document.querySelector('#mapZoomName').textContent,
      map:q('#mapWrap'),scan:q('#scan'),scanbar:q('#sshScanBar'),threat:cs('#sysThreatActs'),viewST:Math.round(document.getElementById('view').scrollTop),
      viewPadB:getComputedStyle(document.getElementById('view')).paddingBottom,
      tab:document.querySelector('.pane.on').id};});
  log(H+' boot',await st());
  await p.screenshot({path:`${SHOTS}r1v-${H}-1-boot.png`});
  await p.click('.mnode'); await p.waitForTimeout(700); log(H+' tap home',await st());
  await p.screenshot({path:`${SHOTS}r1v-${H}-2-home.png`});
  // canvas backing
  log(H+' canvas',await p.evaluate(()=>{const c=document.getElementById('mapZoom');return {w:c.width,h:c.height,cw:Math.round(c.clientWidth*devicePixelRatio),ch:Math.round(c.clientHeight*devicePixelRatio),
    nonblank:(()=>{const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4*97)if(d[i])n++;return n})()};}));
  await p.click('#mapZoomBack'); await p.waitForTimeout(500); log(H+' back',await st());
  await p.screenshot({path:`${SHOTS}r1v-${H}-3-back.png`});
  await ctx.close();
 }
 // level 20 fixture at 667
 const ctx=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2,hasTouch:true});
 const p=await ctx.newPage(); p.on('pageerror',e=>log('PAGEERROR',e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(600);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(400);
 const st=()=>p.evaluate(()=>{const cs=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).display:null};
   return {msel:__SD.S.msel,syspage:document.body.classList.contains('syspage'),zoom:__SD.mapZoom,chips:cs('#mapChips'),left:cs('#left'),
     name:document.querySelector('#mapZoomName').textContent,viewST:Math.round(document.getElementById('view').scrollTop),tab:document.querySelector('.pane.on').id,
     threat:cs('#sysThreatActs'),scanbar:cs('#sshScanBar')};});
 await p.evaluate(()=>{const G=window.__SD;G.adopt({ore:5e6,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2,1:1}}},lvl:20,lvSeen:20,rs:{},nx:{},ab:[],buy:1,msel:null});G.render();});
 await p.waitForTimeout(400); log('L20 map',await st());
 // close paths at level 20
 await p.evaluate(()=>{__SD.S.msel='kor';__SD.render();}); await p.waitForTimeout(500); log('L20 kor page',await st());
 await p.screenshot({path:SHOTS+'r1v-L20-kor.png'});
 await p.evaluate(()=>{document.getElementById('view').scrollTop=150;}); await p.waitForTimeout(200);
 await p.click('.tab[data-p="p-mis"]'); await p.waitForTimeout(400); log('L20 on missions',await st());
 await p.screenshot({path:SHOTS+'r1v-L20-missions.png'});
 await p.click('.tab[data-p="p-map"]'); await p.waitForTimeout(500); log('L20 back to empire',await st());
 await p.click('#mapZoomBack'); await p.waitForTimeout(500); log('L20 after MAP',await st());
 // unclaimed page
 await p.evaluate(()=>{const G=window.__SD;const s=G.SYS.find(x=>!x.home&&!G.sysHeld(x.id)&&G.sysOpen&&G.sysOpen(x));__SD.S.msel=s?s.id:'vel';__SD.render();});
 await p.waitForTimeout(500); log('L20 unclaimed page',await st());
 await p.screenshot({path:SHOTS+'r1v-L20-unclaimed.png'});
 // claim it -> should zoom without tap
 const claimed=await p.evaluate(()=>{const G=window.__SD;const id=G.S.msel;const s=G.SYSMAP[id];G.S.ore=1e12;
   const btn=[...document.querySelectorAll('#sysAct button,#sysInfo button')].find(b=>/claim/i.test(b.textContent));
   if(btn){btn.click();return {clicked:btn.textContent.trim(),id};} return {clicked:null,id};});
 await p.waitForTimeout(800); log('L20 after claim '+JSON.stringify(claimed),await st());
 await p.screenshot({path:SHOTS+'r1v-L20-claimed.png'});
 await p.click('#mapZoomBack'); await p.waitForTimeout(400); log('L20 after MAP 2',await st());
 await ctx.close();
 // old save with msel set in another sector
 const ctx2=await b.newContext({viewport:{width:390,height:667},deviceScaleFactor:2});
 const p2=await ctx2.newPage(); p2.on('pageerror',e=>log('PAGEERROR',e.message));
 await p2.goto(GAME_URL); await p2.waitForTimeout(500);
 await p2.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p2.waitForTimeout(300);
 const other=await p2.evaluate(()=>{const G=window.__SD;const s=G.SYS.find(x=>!x.home&&G.secOf&&G.secOf(x.id)!==0);return s?s.id:null;});
 await p2.evaluate((id)=>{const G=window.__SD;const sys={home:{home:true,b:{0:5,1:3}}};sys[id]={b:{0:1}};
   G.adopt({ore:5e6,exo:{},exoSeen:{},sys,lvl:30,lvSeen:30,rs:{},nx:{},ab:[],buy:1,msel:id});G.save();},other);
 await p2.reload(); await p2.waitForTimeout(800);
 await p2.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p2.waitForTimeout(500);
 log('oldsave other-sector boot',await p2.evaluate(()=>({msel:__SD.S.msel,syspage:document.body.classList.contains('syspage'),zoom:__SD.mapZoom,tab:document.querySelector('.pane.on').id,
   secOn:[...document.querySelectorAll('#mapChips .chip')].findIndex(c=>c.classList.contains('on')),name:document.querySelector('#mapZoomName').textContent})));
 await p2.screenshot({path:SHOTS+'r1v-oldsave.png'});
 await ctx2.close();
 await b.close();
 console.log(out.join('\n'));
})();
