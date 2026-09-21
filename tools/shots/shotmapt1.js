const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
// MOCK ONLY - runtime injection, touches no game file. Tier-1 map dressing.
const CSS=`
#mapLinks line{stroke:rgba(140,170,255,.30);stroke-width:1.2;stroke-dasharray:0.9 1.6;animation:mflow 3s linear infinite}
#mapLinks line.held{stroke:rgba(92,230,165,.7);stroke-width:1.8;stroke-dasharray:1.2 1.2}
@keyframes mflow{to{stroke-dashoffset:-5}}
.mnode .mdot{box-shadow:0 0 10px 1px rgba(140,170,255,.25)}
.mnode.held .mdot{box-shadow:0 0 14px 3px var(--a),0 0 0 3px rgba(92,230,165,.18)}
.mnode.home .mdot{box-shadow:0 0 22px 6px rgba(92,230,165,.55)}
.mnode.foe .mdot{box-shadow:0 0 14px 3px rgba(255,107,138,.55)}
.mnode .mlab{text-shadow:0 1px 3px #000,0 0 6px rgba(0,0,0,.9)}
#mapWrap{box-shadow:inset 0 0 60px rgba(0,0,0,.55)}
`;
async function inject(p){ await p.evaluate((css)=>{
  const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  const wrap=document.getElementById('mapWrap'), bg=document.getElementById('mapBg');
  // nebula + second star layer on an overlay canvas between bg and links
  const c=document.createElement('canvas'); c.id='mockNeb'; c.width=bg.width; c.height=bg.height;
  c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen';
  bg.after(c); const g=c.getContext('2d'); const W=c.width,H=c.height;
  let s=1234; const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
  const blobs=[[.25,.3,'rgba(120,80,255,.28)'],[.7,.65,'rgba(0,190,255,.18)'],[.55,.2,'rgba(255,120,180,.12)']];
  for(const [x,y,col] of blobs){ const r=W*(0.35+rnd()*0.2); const gr=g.createRadialGradient(x*W,y*H,0,x*W,y*H,r);
    gr.addColorStop(0,col); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H); }
  for(let i=0;i<220;i++){ const x=rnd()*W,y=rnd()*H,r=rnd()*1.3+0.2,a=rnd()*0.7+0.2;
    g.fillStyle=`rgba(${200+rnd()*55|0},${210+rnd()*45|0},255,${a})`; g.beginPath(); g.arc(x,y,r,0,6.28); g.fill(); }
  // rival tint: a soft red wash behind foe nodes
  document.querySelectorAll('.mnode.foe').forEach(n=>{ const r=n.getBoundingClientRect(), w=wrap.getBoundingClientRect();
    const x=(r.left+r.width/2-w.left)/w.width*W, y=(r.top+r.height/2-w.top)/w.height*H; const gr=g.createRadialGradient(x,y,0,x,y,W*0.16);
    gr.addColorStop(0,'rgba(255,107,138,.28)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H); });
 },CSS); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await ctx.newPage();
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); }); await p.waitForTimeout(300);
 await p.evaluate(()=>{const G=window.__SD;G.adopt({...G.fresh(),ore:5e6,lvl:20,lvSeen:20,exo:{ir:500},exoSeen:{ir:true},sys:{home:{home:true,b:{0:5,1:3}},kor:{b:{0:2}},dra:{b:{0:1}}},occ:{vel:'hel'},occAt:{vel:Date.now()},notifyQueue:[],msel:null});G.render();});
 await p.waitForTimeout(600);
 await p.screenshot({path:SHOTS+'mapt1-before.png',clip:{x:0,y:280,width:390,height:420}});
 await inject(p); await p.waitForTimeout(400);
 await p.screenshot({path:SHOTS+'mapt1-after.png',clip:{x:0,y:280,width:390,height:420}});
 await b.close();
})();
