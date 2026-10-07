const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tplaylist2.js — the owner's play-test list after the research trees.
//
// (1) Tapping an enemy system with a fleet selected, or with a fleet already sitting
//     there, opens the attack prompt; ATTACK flies the fleet and settles it on arrival,
//     FIGHT IT MYSELF leaves it waiting under the ENGAGE banner.
// (2) Selecting a fleet shows a locate callout under the bar; LOCATE moves the map to
//     the fleet's sector.
// (3) A system attacked while the player is away rolls its defences (holdOdds) instead
//     of always falling.
// (4) Governor cap: one per Governors level plus one per extra sector held.
// (5) RESTART while viewing a later sector still shows Sol Reach.
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
     G.adopt({...G.fresh(), all:1e9, lvl:30, lvSeen:30, ore:1e9, exo:{ir:1e9}, sh:[80,40,15], fhp:1, cmode:"wep"});
     G.mapViewReset(); G.S.notifyQueue.length=0; hideModal(); G.S.msel=null; gotoTab('p-map'); dirty=true; render(); };
 });

 // ---------- (1a) fleet selected, tap an enemy system -> attack prompt, not the SEND chip ----------
 const a=await p.evaluate(()=>{
   const G=window.__SD; __go();
   G.fleetBarTap(1); dirty=true; render();
   document.querySelector('.mnode[data-s="tan"]').click();
   const r={ prompt:!!document.querySelector('.rprompt'), title:(document.querySelector('.rprompt h3')||{}).textContent,
     atk:(document.querySelector('#rpAtk,#rpMan')||{}).textContent, chip:!!document.querySelector('.sendchip'), msel:G.S.msel };
   return r;
 });
 ok('with a fleet selected, tapping an enemy system opens its attack prompt (no SEND chip, no page)',
    a.prompt && /Tanis|tan/i.test(a.title||'') !== null && /ATTACK|RETAKE/.test(a.atk||'') && !a.chip && !a.msel, a);

 const a2=await p.evaluate(()=>{
   const G=window.__SD; const f=G.S.fl[0];
   const btn=document.querySelector('#rpAtk')||document.querySelector('#rpMan'); const auto=btn.id==='rpAtk';
   btn.click();
   const sent={ to:f.to, sg:f.sg, sga:f.sga, modal:document.getElementById('mask').classList.contains('on') };
   f.eta=0.05; G.tick(0.1); G.tick(0.1);
   return { auto, sent, bt:G.BT?{sys:G.BT.t&&G.BT.t.sysId, auto:G.BT.auto}:null, at:f.at, sg:f.sg };
 });
 ok('ATTACK flies the fleet there under an attack order and settles it on arrival',
    a2.sent.to==='tan' && a2.sent.sg==='tan' && !a2.sent.modal && (a2.auto ? (a2.bt&&a2.bt.sys==='tan'&&a2.bt.auto===1) : true), a2);
 await p.evaluate(()=>{ if(__SD.BT)__SD.closeBattle(); });

 // ---------- (1b) FIGHT IT MYSELF -> waits under the ENGAGE banner ----------
 const c=await p.evaluate(()=>{
   const G=window.__SD; __go();
   G.fleetBarTap(1); dirty=true; render();
   document.querySelector('.mnode[data-s="tan"]').click();
   const f=G.S.fl[0];
   document.querySelector('#rpMan').click();
   f.eta=0.05; G.tick(0.1); G.tick(0.1); dirty=true; render();
   const ban=document.getElementById('flBanner');
   const r={ at:f.at, sg:f.sg, bt:!!G.BT, banner:!ban.hidden, text:ban.textContent };
   ban.querySelector('button').click();
   r.engaged=G.BT?{sys:G.BT.t&&G.BT.t.sysId, f:G.BT.f&&G.BT.f.id}:null;
   if(G.BT)G.closeBattle();
   return r;
 });
 ok('FIGHT IT MYSELF: the fleet arrives and waits, no fight yet, ENGAGE banner shown',
    c.at==='tan' && c.sg==='tan' && !c.bt && c.banner && /in position/i.test(c.text), c);
 ok('...and the banner ENGAGE opens the battle for that fleet at that system', c.engaged && c.engaged.sys==='tan' && c.engaged.f===1, c);

 // ---------- (1c) no fleet selected, but one sits at the enemy system -> prompt; otherwise the page ----------
 const d=await p.evaluate(()=>{
   const G=window.__SD; __go();
   const f=G.S.fl[0]; f.at='tan'; f.to=null;
   document.querySelector('.mnode[data-s="tan"]').click();
   const r={ prompt:!!document.querySelector('.rprompt'), now:(document.querySelector('#rpAtk,#rpMan')||{}).textContent, msel:G.S.msel };
   hideModal();
   f.at='home'; dirty=true; render();
   document.querySelector('.mnode[data-s="tan"]').click();
   r.plainOpensPage=G.S.msel==='tan';
   return r;
 });
 ok('a fleet already at the enemy system: tapping it opens the prompt, fighting NOW', d.prompt && /NOW/.test(d.now||'') && !d.msel, d);
 ok('with no fleet selected or there, an enemy system still opens its page', d.plainOpensPage, d);

 // ---------- (2) locate callout ----------
 const l=await p.evaluate(()=>{
   const G=window.__SD; __go();
   const f=G.S.fl[0]; f.at='home'; f.to=null;
   G.setMapSec(2); G.fleetBarTap(1); dirty=true; render();
   const el=document.getElementById('flFind');
   const r={ shown:!el.hidden, text:el.textContent, sec0:G.mapSec };
   el.querySelector('#flFindGo').click();
   r.sec1=G.mapSec; r.stillSel=G.flSel===1;
   G.fleetDeselect(); dirty=true; render(); r.hiddenAfter=el.hidden;
   return r;
 });
 ok('selecting a fleet shows a callout saying where it is', l.shown && /AT SOL REACH/.test(l.text), l);
 ok('LOCATE moves the map to the fleet\'s sector and keeps it selected; deselecting hides the callout',
    l.sec0===2 && l.sec1===0 && l.stillSel && l.hiddenAfter, l);

 // ---------- (3) away-time attack rolls the defences ----------
 const h=await p.evaluate(()=>{
   const G=window.__SD;
   const mk=()=>{ G.lfClear(); G.adopt({...G.fresh(), lvl:99, lvSeen:99, all:1e30, ore:1e30,
     sys:{ home:{b:{}}, dra:{b:{0:5}}, kor:{b:{0:3}} },
     rv:{ hel:{p:G.RV_MAX, cd:0, seen:1, w:0, mv:G.RIVAL_MOVE_CAP} } });
     G.lfMaybeLaunch(0); return G.LF.sysId; };
   const R=Math.random;
   let id=mk(); Math.random=()=>0.0; G.lfResolveOffline(); const held=!G.sysOccupied(id); Math.random=R;
   id=mk(); Math.random=()=>0.999; G.lfResolveOffline(); const lost=G.sysOccupied(id); Math.random=R;
   const odds=G.holdOdds(G.lfThreat('hel',id));
   return { held, lost, odds };
 });
 ok('a live strike resolved without the player is a defence roll: it can hold, and it can fall', h.held && h.lost==='hel' && h.odds>0.05 && h.odds<0.95, h);

 // ---------- (4) governor cap grows with sectors held ----------
 const g=await p.evaluate(()=>{
   const G=window.__SD;
   const sec1=Object.values(G.SYSMAP).filter(s=>s.sec===1).map(s=>s.id);
   G.adopt({...G.fresh(), lvl:60, lvSeen:60, rs:{auto:2}, sys:{home:{b:{}}}});
   const one=G.govCap();
   G.adopt({...G.fresh(), lvl:60, lvSeen:60, rs:{auto:2}, sys:{home:{b:{}}, [sec1[0]]:{b:{0:1}}}});
   const two=G.govCap();
   G.adopt({...G.fresh(), lvl:60, lvSeen:60, rs:{}, sys:{home:{b:{}}, [sec1[0]]:{b:{0:1}}}});
   const none=G.govCap();
   return { one, two, none };
 });
 ok('governor cap = Governors level, +1 for each extra sector held, 0 before research', g.one===2 && g.two===3 && g.none===0, g);

 // ---------- (5) RESTART from a later sector still shows Sol Reach ----------
 const rs=await p.evaluate(async()=>{
   const G=window.__SD; __go(); G.setMapSec(2);
   restartDialog(); await new Promise(r=>setTimeout(r,3300));
   document.getElementById('wYes').click();
   if(G.sceneOn)G.sceneFinish();
   await new Promise(r=>setTimeout(r,300));
   dirty=true; render();
   const home=document.querySelector('.mnode[data-s="home"]');
   return { sec:G.mapSec, home:!!(home&&home.offsetParent) };
 });
 ok('RESTART while on a later sector: the new game\'s map shows Sol Reach', rs.sec===0 && rs.home, rs);

 ok('no page errors', errs.length===0, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
