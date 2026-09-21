const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
// MOCK ONLY - Tier 2: tiny planets + orbit diagram on an overlay canvas, dots hidden.
const CSS=`
.mnode .mdot{opacity:0}
.mnode .mlab{text-shadow:0 1px 3px #000,0 0 6px rgba(0,0,0,.9);margin-top:14px}
#mapLinks line{stroke:rgba(140,170,255,.22);stroke-width:1;stroke-dasharray:0.9 1.6}
#mapLinks line.held{stroke:rgba(92,230,165,.6);stroke-width:1.4;stroke-dasharray:1.2 1.2}
`;
async function inject(p){ await p.evaluate((css)=>{
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const wrap=document.getElementById('mapWrap'), bg=document.getElementById('mapBg');
  const c=document.createElement('canvas'); c.width=bg.width; c.height=bg.height;
  c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  document.getElementById('mapNodes').before(c); const g=c.getContext('2d'); const W=c.width,H=c.height;
  let s=99; const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
  // nebula + stars
  for(const [x,y,col] of [[.3,.3,'rgba(120,80,255,.22)'],[.7,.7,'rgba(0,190,255,.14)']]){ const gr=g.createRadialGradient(x*W,y*H,0,x*W,y*H,W*.45); gr.addColorStop(0,col); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H); }
  for(let i=0;i<200;i++){ g.fillStyle=`rgba(220,230,255,${rnd()*.6+.2})`; g.beginPath(); g.arc(rnd()*W,rnd()*H,rnd()*1.2+.2,0,6.28); g.fill(); }
  const wr=wrap.getBoundingClientRect(); const P=n=>{const r=n.getBoundingClientRect();return [(r.left+r.width/2-wr.left)/wr.width*W,(r.top+r.height/2-wr.top)/wr.height*H]};
  const nodes=[...document.querySelectorAll('.mnode')]; const home=nodes.find(n=>n.classList.contains('home'));
  const [hx,hy]=home?P(home):[W/2,H/2];
  // central star + orbit rings through each node's distance
  const ds=nodes.filter(n=>n!==home).map(n=>{const [x,y]=P(n);return Math.hypot(x-hx,y-hy)}).sort((a,b)=>a-b);
  g.strokeStyle='rgba(140,170,255,.13)'; g.lineWidth=1; g.setLineDash([2,4]);
  for(const d of ds){ g.beginPath(); g.arc(hx,hy,d,0,6.28); g.stroke(); } g.setLineDash([]);
  for(const n of nodes){
    const [x,y]=P(n); const cs=getComputedStyle(n); let col=cs.getPropertyValue('--a').trim()||'#8fb8ff';
    const dot=n.querySelector('.mdot'); const dc=getComputedStyle(dot).borderColor; if(dc&&dc!=='rgba(0, 0, 0, 0)')col=dc;
    const held=n.classList.contains('held'), isHome=n===home, foe=n.classList.contains('foe'), open=n.classList.contains('open');
    const R=isHome?W*0.032:W*0.02;
    if(held||isHome){ const gr=g.createRadialGradient(x,y,R*.6,x,y,R*2.6); gr.addColorStop(0,col.replace(')',',.35)').replace('rgb(','rgba(')); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,R*2.6,0,6.28); g.fill(); }
    // planet body: lit from upper-left, terminator on the right
    const body=g.createRadialGradient(x-R*.45,y-R*.45,R*.1,x,y,R); body.addColorStop(0,'#ffffff'); body.addColorStop(.18,col); body.addColorStop(.75,col); body.addColorStop(1,'#05060f');
    g.fillStyle=body; g.beginPath(); g.arc(x,y,R,0,6.28); g.fill();
    if(!held&&!isHome){ g.fillStyle='rgba(4,5,13,.55)'; g.beginPath(); g.arc(x,y,R,0,6.28); g.fill(); }  // unclaimed: dim
    g.strokeStyle=foe?'rgba(255,107,138,.9)':open?'rgba(92,230,165,.9)':'rgba(255,255,255,.18)'; g.lineWidth=foe||open?2:1; g.beginPath(); g.arc(x,y,R+2.5,0,6.28); g.stroke();
    // built tiers as orbit pips
    if(held||isHome){ const tiers=isHome?8:3; g.fillStyle='rgba(255,255,255,.85)'; for(let i=0;i<tiers;i++){ const a=i/tiers*6.28-1; g.beginPath(); g.arc(x+Math.cos(a)*(R+7),y+Math.sin(a)*(R+7)*.55,1.4,0,6.28); g.fill(); } }
  }
 },CSS); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(300);
 await p.evaluate(()=>{const G=window.__SD;G.adopt({...G.fresh(),ore:5e6,lvl:20,lvSeen:20,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2}},dra:{b:{0:1}}},occ:{vel:'hel'},occAt:{vel:Date.now()},notifyQueue:[],msel:null});G.render();});
 await p.waitForTimeout(600); await inject(p); await p.waitForTimeout(300);
 await p.screenshot({path:SHOTS+'mapt2.png',clip:{x:0,y:280,width:390,height:420}});
 await b.close();
})();
