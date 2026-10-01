const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tmaplook2.js — the sector map's painted look: systems are small painted planets on
// the #mapPl canvas (rings say whose they are, a governed one carries an orbiting
// station), lanes are thin lines, the backdrop is a baked nebula, and fleet/contact
// markers are icon-style symbols. The .mnode buttons on top are unchanged.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 const r=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:24, lvSeen:24, xpn:G.xpNeed(24), ore:1e9, all:1e10,
     sys:{home:{b:{}},kor:{b:{},gov:1},dra:{b:{}}}});
   G.ensureFleets(); G.S.fl[0].sh=[5,0,0];
   G.S.notifyQueue.length=0; G.S.tg=[G.newTarget()]; G.S.tg[0].sec=0;
   document.getElementById('mask').classList.remove('on');
   G.gotoTab('p-map'); G.setMapSec(0); G.dirty=true; G.render();
   G.mapPlanetsDraw(performance.now());
   const cv=document.getElementById('mapPl'), g=cv.getContext('2d');
   const px=id=>{ const s=G.SYSMAP[id]; const d=g.getImageData(Math.round(s.sx*cv.width/100),Math.round(s.sy*cv.height/100),1,1).data; return d[3] };
   const info=Object.fromEntries(G.mapNodeInfo.map(n=>[n.s.id,n]));
   const dot=document.querySelector('.mnode[data-s="kor"] .mdot'), dr=dot.getBoundingClientRect(), w=document.getElementById('mapWrap').getBoundingClientRect();
   const bg=document.getElementById('mapBg').getContext('2d').getImageData(300,300,1,1).data;
   const first={ sized:cv.width>300&&cv.height>300, home:px('home'), kor:px('kor'), empty:g.getImageData(4,4,1,1).data[3],
     held:info.kor.held&&!info.kor.foe&&!info.kor.locked, gov:info.kor.gov&&!info.dra.gov&&!info.home.gov,
     foe:info.tan.foe&&!info.tan.held, lanes:G.mapLaneInfo.length,
     dotHidden:getComputedStyle(dot).opacity==='0',
     dotCentre:[Math.abs(dr.left+dr.width/2-w.left-w.width*G.SYSMAP.kor.sx/100)<1, Math.abs(dr.top+dr.height/2-w.top-w.height*G.SYSMAP.kor.sy/100)<1],
     bgPainted:bg[3]===255,
     wing:!!document.querySelector('#fleetMarkers .flmark svg .rot path'), enemy:!!document.querySelector('#fleetMarkers .enmark svg .rot path') };
   // a system page hides the layer; nothing is drawn while it is open
   G.S.msel='kor'; G.dirty=true; G.render();
   await new Promise(r=>setTimeout(r,400));
   const zoomOpacity=getComputedStyle(cv).opacity;
   G.S.msel=null; G.dirty=true; G.render();
   return { first, zoomOpacity };
 });
 ok('#mapPl is sized to the map and a planet is painted at each system (nothing in empty space)',
    r.first.sized && r.first.home===255 && r.first.kor===255 && r.first.empty===0, r.first);
 ok('the layer knows whose each system is, and which one a governor runs',
    r.first.held && r.first.gov && r.first.foe && r.first.lanes===2, r.first);
 ok('the old dot is invisible but still marks the centre of the node button', r.first.dotHidden && r.first.dotCentre[0] && r.first.dotCentre[1], r.first);
 ok('the backdrop is painted, and fleets and contacts are drawn as icon symbols', r.first.bgPainted && r.first.wing && r.first.enemy, r.first);
 ok('the painted layer fades out with the rest of the map on a system page', r.zoomOpacity==='0', r.zoomOpacity);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
