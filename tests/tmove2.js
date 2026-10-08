const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tmove2.js — the owner's second play-test list.
//
// (1) The top bar: no title - the commander's mark and the level pill, both opening
//     the level summary.
// (2) The MAP | LIST toggle and the list view are gone; the map is the only view.
// (3) Sol Reach's page has no "HOME SYSTEM · YOURS" line (other systems keep theirs).
// (4) RECALL sits in the locate callout beside LOCATE, not on the map strip; the
//     strip has a close button that deselects.
// (5) With a fleet selected, a tap on open space shows a MOVE chip there; tapping
//     it flies the fleet to that spot, where it holds. The order survives a save.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));
 await p.evaluate(()=>{
   window.__go=()=>{ const G=window.__SD;
     G.adopt({...G.fresh(), all:1e9, lvl:30, lvSeen:30, ore:1e9, sh:[80,40,15], fhp:1});
     G.mapViewReset(); G.S.notifyQueue.length=0; hideModal(); G.S.msel=null; gotoTab('p-map'); dirty=true; render(); };
 });

 // ---------- (1) top bar ----------
 const hd=await p.evaluate(()=>{
   __go();
   const av=document.getElementById('avatar'), r=av.getBoundingClientRect();
   av.click();
   const modal=document.getElementById('mask').classList.contains('on');
   hideModal();
   return { h1:!!document.querySelector('header h1'), avatar:!!av, w:r.width, h:r.height, first:av.parentElement.firstElementChild===av,
     next:av.nextElementSibling&&av.nextElementSibling.id, lvl:document.getElementById('runlbl').textContent, modal };
 });
 ok('the title is gone; the commander mark sits first with the level pill right beside it',
    !hd.h1 && hd.avatar && hd.first && hd.next==='runlbl' && /^Level 30/.test(hd.lvl) && hd.w>=28 && hd.h>=28, hd);
 ok('tapping the mark opens the level summary', hd.modal, hd);

 // ---------- (2) map only ----------
 const mo=await p.evaluate(()=>({ toggle:!!document.getElementById('mapMode'), list:!!document.getElementById('mapList'),
   btn:!!document.querySelector('.rmbtn[data-mm]'), wrapHidden:document.getElementById('mapWrap').hidden, nodes:document.querySelectorAll('.mnode').length }));
 ok('no MAP | LIST row and no list view - the map is the only view', !mo.toggle && !mo.list && !mo.btn && !mo.wrapHidden && mo.nodes>1, mo);

 // ---------- (3) home page head ----------
 const hp=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.msel='home'; dirty=true; render();
   const home={ text:document.getElementById('sysInfo').textContent, meta:!!document.querySelector('#sysInfo .sysmeta'), stat:!!document.querySelector('#sysInfo .syshead') };
   G.S.msel='kor'; dirty=true; render();
   const kor={ meta:(document.querySelector('#sysInfo .sysmeta')||{}).textContent };
   G.S.msel=null; dirty=true; render();
   return { home, kor };
 });
 ok('Sol Reach\'s page has no HOME SYSTEM / YOURS line but keeps its stat row', !/HOME SYSTEM|YOURS/.test(hp.home.text) && !hp.home.meta && hp.home.stat, hp.home);
 ok('other systems keep their RING / owner line', /^RING 1/.test(hp.kor.meta||''), hp.kor);

 // ---------- (4) RECALL in the callout, close button on the strip ----------
 const rc=await p.evaluate(()=>{
   const G=window.__SD; __go();
   const f=G.S.fl[0]; f.at='kor'; f.to=null;
   G.fleetBarTap(1); dirty=true; render();
   const find=document.getElementById('flFind'), hint=document.getElementById('flHint');
   const rb=find.querySelector('#flRecall'), lb=find.querySelector('#flFindGo');
   const r={ inCallout:!!rb, besideLocate:!!(rb&&lb&&rb.parentElement===lb.parentElement&&rb.nextElementSibling===lb),
     onStrip:!!hint.querySelector('#flRecall'), close:!!hint.querySelector('#flX'), hintText:hint.textContent };
   rb.click();
   r.sentHome=f.to==='home'; r.deselected=G.flSel===null;
   f.to=null; f.at='home'; f.eta=0; f.tot=0; f.o=null; f.from=null;
   G.fleetBarTap(1); dirty=true; render();
   r.noRecallAtHome=!document.querySelector('#flFind #flRecall');
   document.getElementById('flX').click();
   r.closedSel=G.flSel; r.hintHidden=document.getElementById('flHint').hidden; r.findHidden=document.getElementById('flFind').hidden;
   return r;
 });
 ok('RECALL is in the locate callout, right beside LOCATE, and gone from the map strip',
    rc.inCallout && rc.besideLocate && !rc.onStrip, rc);
 ok('...it still recalls the fleet to Sol Reach and deselects; a fleet at home gets no RECALL', rc.sentHome && rc.deselected && rc.noRecallAtHome, rc);
 ok('the strip says where to tap, and its close button deselects', /WHERE IT SHOULD GO/.test(rc.hintText) && rc.close && rc.closedSel===null && rc.hintHidden && rc.findHidden, rc);

 // ---------- (5) MOVE: tap open space, chip, flight, hold, save ----------
 const mv=await p.evaluate(()=>{
   const G=window.__SD; __go();
   const f=G.S.fl[0];
   G.fleetBarTap(1); dirty=true; render();
   const wrap=document.getElementById('mapWrap'), r=wrap.getBoundingClientRect();
   const tap=(fx,fy)=>document.getElementById('mapBg').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width*fx,clientY:r.top+r.height*fy}));
   tap(0.7,0.3);
   const chip=document.querySelector('.sendchip');
   const shown={ pos:G.moveChipPos, text:chip&&chip.textContent, left:chip&&chip.style.left, top:chip&&chip.style.top, stillSel:G.flSel===1 };
   tap(0.2,0.8);                                       /* a second tap moves the chip */
   const moved={ x:G.moveChipPos&&G.moveChipPos.x, text:document.querySelector('.sendchip').textContent };
   document.querySelector('.mnode[data-s="kor"]').click();   /* a system tap turns it into SEND */
   const node={ chip:G.moveChipPos, text:document.querySelector('.sendchip').textContent };
   tap(0.7,0.3);
   document.querySelector('.sendchip').click();
   const sent={ mv:f.mv, at:f.at, busy:G.fleetBusy(f), sel:G.flSel, chip:!!document.querySelector('.sendchip'),
     bar:document.querySelector('#fleetBar [data-fl="1"] .fstat').textContent, where:G.fleetWhere(f) };
   const mid=G.fleetMapPos(f);
   f.eta=0.05; G.tick(0.1); dirty=true; render();
   const held={ mv:f.mv, at:f.at, pos:f.pos, busy:G.fleetBusy(f), bar:document.querySelector('#fleetBar [data-fl="1"] .fstat').textContent };
   /* the order survives a save */
   G.fleetMoveTo(f,{sec:0,x:50,y:20});
   const before=JSON.parse(JSON.stringify(G.S));
   G.adopt(before);
   const back=G.S.fl[0];
   const saved={ mv:back.mv, busy:G.fleetBusy(back), eta:back.eta>0 };
   return { shown, moved, node, sent, mid, held, saved };
 });
 ok('tapping open space with a fleet selected shows a MOVE chip at that spot, fleet still selected',
    mv.shown.pos && Math.abs(mv.shown.pos.x-70)<1 && Math.abs(mv.shown.pos.y-30)<1 && /^MOVE · \d+s$/.test(mv.shown.text||'') && Math.abs(parseFloat(mv.shown.left)-70)<1 && mv.shown.stillSel, mv.shown);
 ok('another tap moves the chip; a system tap turns it into SEND', Math.abs(mv.moved.x-20)<1 && /^MOVE/.test(mv.moved.text) && !mv.node.chip && /^SEND/.test(mv.node.text), {moved:mv.moved, node:mv.node});
 ok('tapping MOVE flies the fleet there: busy, off its system, deselected, bar says MOVING',
    mv.sent.mv && Math.abs(mv.sent.mv.x-70)<1 && mv.sent.at===null && mv.sent.busy && mv.sent.sel===null && !mv.sent.chip && /^MOVING \d+s$/.test(mv.sent.bar), mv.sent);
 ok('...and on arrival it holds that spot in open space', mv.held.mv===null && mv.held.at===null && mv.held.pos && Math.abs(mv.held.pos.x-70)<1 && Math.abs(mv.held.pos.y-30)<1 && !mv.held.busy && /CORE/.test(mv.held.bar), mv.held);
 ok('a move order survives a save', mv.saved.mv && mv.saved.mv.x===50 && mv.saved.busy && mv.saved.eta, mv.saved);

 ok('no page errors', errs.length===0, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
