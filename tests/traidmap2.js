const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// traidmap2.js — PLAN-raidmap.md: raid contacts live on the sector map.
//
// Contacts roam open space inside a sector (a pure function of the clock and their
// own seed), a fleet flies off the lanes to one, and the prompt decides how the
// fight is settled: on the map by itself (ATTACK, when the fleet outclasses it) or
// by the player once the fleet is in position (ENGAGE). Also: the fleet bar no
// longer moves the map, carries a ship picture and a hull bar, and hides on a
// system page; RECALL; faster repairs when docked; the Raids tab has no target list.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));
 // every fixture: level 24, three fleets with ships, a few Core systems held
 await p.evaluate(()=>{
   window.__fx=(extra)=>{
     const G=window.__SD;
     G.fleetDeselect();
     G.adopt({...G.fresh(), lvl:24, lvSeen:24, xpn:G.xpNeed(24), ore:1e9, all:1e10, wins:30,
       sys:{home:{b:{}},kor:{b:{}},dra:{b:{}}}, ...(extra||{})});
     G.ensureFleets();
     G.S.fl.forEach((f,i)=>{ f.sh=[[30,10,2],[10,6,1],[6,4,3]][i]; });
     G.S.notifyQueue.length=0; G.S.tg=[];
     document.getElementById('mask').classList.remove('on');
     G.gotoTab('p-map'); G.setMapSec(0); G.dirty=true; G.render();
   };
   /* a contact the 1st Fleet walks over (auto-resolvable) or cannot (too strong) */
   window.__mk=(easy)=>{
     const G=window.__SD;
     const t=G.newTarget();
     t.ti=0; t.sec=0; t.dif=easy?0.05:40; t.dmg=easy?0.01:3; t.en=2;
     G.S.tg.push(t); G.dirty=true; G.render(); return t;
   };
 });

 // ---------------- contacts ----------------
 const gen=await p.evaluate(()=>{
   __fx();
   const G=window.__SD;
   let n=0; const rng=()=>{ n++; return 0.5 };
   const t=G.newTarget(rng);
   const ids=[G.newTarget().id,G.newTarget().id];
   const secs=[]; for(let i=0;i<200;i++)secs.push(G.newTarget().sec);
   const p0=G.tgPos(t,1000), p1=G.tgPos(t,1000), p2=G.tgPos(t,1060);
   let inBox=true; for(let s=0;s<4000;s+=7){ const q=G.tgPos(t,s); if(q.x<4||q.x>96||q.y<6||q.y>96)inBox=false; }
   t.fz=1000; const f1=G.tgPos(t,5000);
   return { draws:n, t, ids, maxSec:G.tgMaxSec(), secMax:Math.max(...secs), secMin:Math.min(...secs),
     same:p0.x===p1.x&&p0.y===p1.y, moved:Math.hypot(p2.x-p0.x,p2.y-p0.y), inBox,
     frozen:f1.x===p0.x&&f1.y===p0.y, cap:G.tgCap() };
 });
 ok('newTarget() draws exactly four random numbers (csim\'s seeded stream depends on it)', gen.draws===4, gen.draws);
 ok('a contact carries an id, a sector and a path seed - and no system', Number.isFinite(gen.t.id)&&gen.t.sec>=0&&Number.isFinite(gen.t.sd)&&!('sys' in gen.t), gen.t);
 ok('ids are unique and increasing', gen.ids[1]===gen.ids[0]+1, gen.ids);
 ok('contacts turn up in every sector up to one past the furthest held (Core held -> Core and Reach)',
   gen.maxSec===1 && gen.secMin===0 && gen.secMax===1, gen);
 ok('tgPos() is a pure function of the clock: same time, same place; later, somewhere else', gen.same && gen.moved>1, gen);
 ok('...and stays inside the map', gen.inBox, gen);
 ok('...and a frozen contact (a fleet is on it) does not move', gen.frozen, gen);
 ok('room for contacts grows with the map: 3 + 2 per sector past the Core', gen.cap===5, gen.cap);

 const early=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), lvl:G.RAIDLV, lvSeen:G.RAIDLV});
   const secs=[]; for(let i=0;i<50;i++)secs.push(G.newTarget().sec);
   return { mapLv:G.unlockLv('p-map'), raidLv:G.RAIDLV, max:Math.max(...secs), cap:G.tgCap() };
 });
 ok('with nothing held beyond home, no contact is further out than the next sector', early.max<=1, early);

 const harder=await p.evaluate(()=>{
   const G=window.__SD;
   __fx({sys:{home:{b:{}},kor:{b:{}},ash:{b:{}},thu:{b:{}},erb:{b:{}},aur:{b:{}}}});
   const by={}; for(let i=0;i<600;i++){ const t=G.newTarget(); (by[t.sec]=by[t.sec]||[]).push(t.dif/G.RAIDS[t.ti].dif); }
   const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
   return { secs:Object.keys(by).length, core:avg(by[0]), beyond:avg(by[4]), cap:G.tgCap() };
 });
 ok('with the whole map open, contacts appear in all five sectors', harder.secs===5, harder);
 ok('a contact further out is stronger for its type (and so pays more)', harder.beyond>harder.core*1.5, harder);
 ok('...and there is room for 11 of them', harder.cap===11, harder);

 // ---------------- the extra contacts never touch Math.random ----------------
 const rngSafe=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const real=Math.random; let n=0; Math.random=()=>{ n++; return real() };
   G.S.tg=[G.newTarget(),G.newTarget(),G.newTarget()];
   const after3=n;
   G.S.tgX=9999;
   G.tick(1); G.tick(1);
   Math.random=real;
   return { after3, extra:n-after3, len:G.S.tg.length, cap:G.tgCap() };
 });
 ok('contacts past the first three are generated without a single Math.random() call',
   rngSafe.after3===12 && rngSafe.len>3 && rngSafe.len<=rngSafe.cap, rngSafe);

 // ---------------- the fleet bar ----------------
 const bar=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   G.S.fl[1].at='ash';                                   // 2nd Fleet is in the Inner Reach
   G.S.fl[0].hp=0.5;
   G.dirty=true; G.render();
   const before=G.mapSec;
   document.querySelector('#fleetBar [data-fl="2"]').click();
   const btn=document.querySelector('#fleetBar [data-fl="1"]');
   const r={ before, after:G.mapSec, sel:G.flSel,
     ship:!!btn.querySelector('svg.fship path'), hp:btn.querySelector('.fhp i').style.width,
     hpCls:btn.querySelector('.fhp i').className,
     glow:document.getElementById('mapWrap').classList.contains('flsel') };
   G.fleetDeselect(); G.S.msel='kor'; G.dirty=true; G.render();
   r.onPage=getComputedStyle(document.getElementById('fleetBar')).display;
   G.S.msel=null; G.dirty=true; G.render();
   return r;
 });
 ok('selecting a fleet does NOT move the map to the fleet\'s sector', bar.before===0 && bar.after===0 && bar.sel===2, bar);
 ok('...and the map shows it is waiting for a destination', bar.glow, bar);
 ok('a fleet button carries a ship picture and a hull bar', bar.ship && bar.hp==='50%' && bar.hpCls==='hurt', bar);
 ok('the fleet bar is hidden on a system page', bar.onPage==='none', bar);

 // ---------------- a contact on the map, and its prompt ----------------
 const mark=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const easy=__mk(true), hard=__mk(false);
   G.dirty=true; G.render();
   const marks=[...document.querySelectorAll('#fleetMarkers .enmark')];
   const cnt=document.querySelector('#mapChips .chip[data-i="0"] .ecnt');
   const btn=marks[0].querySelector('button'); const bb=btn.getBoundingClientRect();
   btn.click();
   const easyP={ open:document.getElementById('mask').classList.contains('on'),
     text:document.getElementById('modal').textContent,
     atk:!!document.getElementById('rpAtk'), man:!!document.getElementById('rpMan'),
     picks:document.querySelectorAll('#rpActs .rppick button').length };
   hideModal();
   marks[1].querySelector('button').click();
   const hardP={ atk:!!document.getElementById('rpAtk'), man:!!document.getElementById('rpMan'),
     warn:(document.querySelector('.rpwarn')||{}).textContent, risk:document.getElementById('rpRisk').textContent };
   hideModal();
   return { n:marks.length, cnt:cnt&&cnt.textContent, tap:[bb.width,bb.height], easyP, hardP,
     pips:marks.map(m=>m.querySelectorAll('.pips i').length) };
 });
 ok('each contact in the sector on screen is a marker on the map', mark.n===2, mark);
 ok('...with a 44px tap target, and the sector chip counts them', mark.tap[0]>=43.9&&mark.tap[1]>=43.9&&mark.cnt==='2'   /* a transform-placed box measures 43.99998 on some frames */, mark);
 ok('...and more pips the more dangerous it is', mark.pips[0]===1 && mark.pips[1]===4, mark.pips);
 ok('tapping one opens the prompt: a weak contact offers ATTACK and FIGHT IT MYSELF, with a fleet picker',
   mark.easyP.open && mark.easyP.atk && mark.easyP.man && mark.easyP.picks===3, mark.easyP);
 ok('a contact too strong to auto-resolve offers only the manual attack, and says why',
   !mark.hardP.atk && mark.hardP.man && /Too close a fight/.test(mark.hardP.warn||'') && mark.hardP.risk==='SEVERE', mark.hardP);

 // ---------------- ATTACK: fly there, settle it on the map ----------------
 const auto=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const t=__mk(true), f=G.S.fl[0];
   const want=G.travelSecsPos(G.fleetPos(f),G.tgPos(t));
   document.querySelector('#fleetMarkers .enmark button').click();
   document.getElementById('rpAtk').click();
   const sent={ tg:f.tg, at:f.at, busy:G.fleetBusy(f), eta:f.eta, want, modal:document.getElementById('mask').classList.contains('on'),
     where:G.fleetWhere(f), atHome:G.fleetAtSys('home')&&G.fleetAtSys('home').id };
   const mid=(()=>{ f.eta=f.tot/2; const q=G.fleetMapPos(f), d=G.tgPos(t), o=f.o;
     return Math.abs(q.x-(o.x+d.x)/2)<0.01 && Math.abs(q.y-(o.y+d.y)/2)<0.01 })();
   const w0=G.S.wins, ore0=G.S.ore, sv0=G.S.sv||0, hp0=f.hp;
   f.eta=0.05; G.tick(0.1);
   const arrived={ hold:f.hold, tg:f.tg, fz:t.fz!=null, busy:G.fleetBusy(f), where:G.fleetWhere(f),
     bt:!!G.BT, banner:document.getElementById('flBanner').hidden };
   G.tick(1); G.tick(1); G.tick(1);
   G.dirty=true; G.render();
   return { sent, mid, arrived, tid:t.id,
     done:{ gone:!G.tgById(t.id), wins:G.S.wins-w0, ore:G.S.ore>ore0, sv:(G.S.sv||0)>sv0, hp:+(hp0-f.hp).toFixed(3),
       hold:f.hold, at:f.at, pos:f.pos, where:G.fleetWhere(f), bt:!!G.BT,
       marks:document.querySelectorAll('#fleetMarkers .enmark').length } };
 });
 ok('ATTACK sends the fleet at the contact and closes the prompt', auto.sent.tg===auto.tid && auto.sent.at===null && auto.sent.busy && !auto.sent.modal, auto.sent);
 ok('...it has left home, its clock is the open-space travel time, and the bar says INTERCEPT',
   auto.sent.atHome!==1 && Math.abs(auto.sent.eta-auto.sent.want)<0.5 && /^INTERCEPT/.test(auto.sent.where), auto.sent);
 ok('halfway through the clock the fleet is halfway along a straight line to the contact (off the lanes)', auto.mid);
 ok('on arrival it holds beside the contact, the contact stops, and no battle screen opens',
   auto.arrived.hold===auto.tid && auto.arrived.tg===null && auto.arrived.fz && !auto.arrived.bt && auto.arrived.where==='IN BATTLE' && auto.arrived.banner, auto.arrived);
 ok('a few seconds later the raid is won on the map: contact gone, a win counted, the ore paid',
   auto.done.gone && auto.done.wins===1 && auto.done.ore && !auto.done.bt && auto.done.marks===0, auto.done);
 ok('...the fleet paid the auto-resolve hull cost and stays where it fought ("CORE")',
   auto.done.hp===0.03 && auto.done.hold===null && auto.done.at===null && !!auto.done.pos && auto.done.where==='CORE', auto.done);

 // ---------------- FIGHT IT MYSELF: wait in position, ENGAGE opens the battle ----------------
 const man=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const t=__mk(true), f=G.S.fl[0];
   document.querySelector('#fleetMarkers .enmark button').click();
   document.getElementById('rpMan').click();
   f.eta=0.05; G.tick(0.1); G.tick(1); G.tick(1); G.tick(1); G.tick(1);
   G.dirty=true; G.render();
   const ban=document.getElementById('flBanner');
   const waiting={ still:!!G.tgById(t.id), where:G.fleetWhere(f), banner:!ban.hidden, text:ban.textContent, bt:!!G.BT };
   ban.querySelector('button').click();
   const fight={ bt:!!G.BT, fleet:G.BT&&G.BT.f&&G.BT.f.id, idx:G.BT&&G.BT.idx };
   G.endBattle('win'); G.closeBattle(); G.tick(0.1);
   return { waiting, fight, after:{ gone:!G.tgById(t.id), hold:f.hold, busy:G.fleetBusy(f) } };
 });
 ok('FIGHT IT MYSELF: the fleet waits in position - nothing resolves on its own', man.waiting.still && man.waiting.where==='IN POSITION' && !man.waiting.bt, man.waiting);
 ok('...and the map shows an "in position" banner with ENGAGE', man.waiting.banner && /1st Fleet is in position/.test(man.waiting.text) && /ENGAGE/.test(man.waiting.text), man.waiting);
 ok('ENGAGE opens the real battle with THAT fleet', man.fight.bt && man.fight.fleet===1 && man.fight.idx===0, man.fight);
 ok('after the battle the contact is gone and the fleet is free again', man.after.gone && man.after.hold===null && !man.after.busy, man.after);

 // ---------------- refusals ----------------
 const no=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const t=__mk(true), f=G.S.fl[0], f2=G.S.fl[1];
   const empty=G.fleetAttack({...f, sh:[0,0,0]},t,true);
   f.hp=0.1; const hurt=G.fleetAttack(f,t,true); f.hp=1;
   const first=G.fleetAttack(f,t,false);
   const second=G.fleetAttack(f2,t,false);
   const again=G.fleetAttack(f,t,false);
   return { empty, hurt, first, second, again };
 });
 ok('fleetAttack() refuses a fleet with no ships, and one under 15% hull', no.empty===false && no.hurt===false, no);
 ok('...and a second fleet on the same contact; the fleet already flying at it just keeps its order', no.first===true && no.second===false && no.again===true, no);

 // ---------------- send to a system from open space; RECALL ----------------
 const rec=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const t=__mk(false), f=G.S.fl[0];
   G.fleetAttack(f,t,false); f.eta=0.05; G.tick(0.1);
   const held={ hold:f.hold, fz:t.fz!=null };
   G.fleetBarTap(1); G.dirty=true; G.render();
   const recallBtn=!!document.getElementById('flRecall');
   document.querySelector('.mnode[data-s="kor"]').click();
   const chip=document.querySelector('.sendchip'); const chipText=chip&&chip.textContent;
   chip.click();
   const sent={ to:f.to, hold:f.hold, unfrozen:t.fz===null, o:f.o, eta:f.eta };
   // mid-flight recall
   f.eta=f.tot/2;
   G.fleetBarTap(1); G.dirty=true; G.render();
   const before=G.fleetMapPos(f);
   document.getElementById('flRecall').click();
   const back={ to:f.to, ox:f.o&&+f.o.x.toFixed(2), bx:+before.x.toFixed(2), sel:G.flSel };
   f.eta=0.05; G.tick(0.1);
   const home={ at:f.at, pos:f.pos, busy:G.fleetBusy(f) };
   return { held, recallBtn, chipText, sent, back, home };
 });
 ok('a fleet holding in open space can be sent to a system; leaving lets the contact drift again',
   rec.held.hold!=null && rec.held.fz && /SEND/.test(rec.chipText||'') && rec.sent.to==='kor' && rec.sent.hold===null && rec.sent.unfrozen && !rec.sent.o.sys, rec);
 ok('RECALL works mid-flight: the fleet turns for Sol Reach from where it is right now',
   rec.recallBtn && rec.back.to==='home' && Math.abs(rec.back.ox-rec.back.bx)<0.5 && rec.back.sel===null, rec.back);
 ok('...and lands at home like any other arrival', rec.home.at==='home' && rec.home.pos===null && !rec.home.busy, rec.home);

 // ---------------- repairs: faster in dock ----------------
 const rep=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const a=G.S.fl[0], c=G.S.fl[1];
   a.hp=0.5; c.hp=0.5; c.at=null; c.pos={sec:0,x:30,y:70};
   G.tick(10);
   G.dirty=true; G.render();
   return { dock:a.hp-0.5, out:c.hp-0.5, k:G.DOCK_REP, where:G.fleetWhere(a) };
 });
 const yard=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const a=G.S.fl[0], c=G.S.fl[1];
   a.hp=0.5; c.hp=0.5; c.at=null; c.pos={sec:0,x:30,y:70};
   const ore0=G.S.ore;
   const away=G.repairFleet(c), awayHp=c.hp, awaySpent=ore0-G.S.ore;
   const docked=G.repairFleet(a);
   return { away, awayHp, awaySpent, docked, dockedHp:a.hp };
 });
 ok('a paid repair needs a dock: refused in open space (no ore spent), done at Sol Reach',
   yard.away===false && yard.awayHp===0.5 && yard.awaySpent===0 && yard.docked===true && yard.dockedHp===1, yard);
 ok('a fleet docked at Sol Reach mends DOCK_REP times faster than one in open space',
   rep.out>0 && Math.abs(rep.dock/rep.out-rep.k)<0.01 && /^REPAIRING \d+%$/.test(rep.where), rep);

 // ---------------- saves ----------------
 const sv=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   const t=__mk(false), t2=__mk(true), f=G.S.fl[0], f2=G.S.fl[1];
   G.fleetAttack(f,t,false); f.eta=0.05; G.tick(0.1);           // 1st: holding
   G.fleetAttack(f2,t2,false);                                   // 2nd: in flight
   const snap=JSON.parse(JSON.stringify(G.S));
   G.adopt(snap);
   const a=G.S.fl[0], c=G.S.fl[1];
   const round={ hold:a.hold===t.id, pos:!!a.pos&&a.at===null, fz:G.tgById(t.id).fz!=null,
     tg:c.tg===t2.id, o:!!c.o, eta:c.eta>0 };
   // an old save: contacts had a system and no id; a flight had `from` and no origin
   const old=JSON.parse(JSON.stringify(G.fresh()));
   old.lvl=24; old.tg=[{ti:1,name:'Prism Barge',en:2,dif:1.4,secs:26,dmg:.58,sys:'ash'},{ti:0,name:'Ore Convoy',en:2,dif:1,secs:20,dmg:.4,sys:'home'}];
   old.fl=[{id:1,n:'1st Fleet',sh:[5,0,0],hp:1,at:'home',to:'kor',eta:12,from:'home',tot:30}];
   G.adopt(old);
   const o=G.S.tg, g=G.S.fl[0];
   const legacy={ ids:o.map(x=>x.id), secs:o.map(x=>x.sec), sys:o.some(x=>'sys' in x), sd:o.every(x=>Number.isFinite(x.sd)),
     to:g.to, o:g.o, pos:G.fleetMapPos(g) };
   // a save pointing at a contact that is gone
   const bad=JSON.parse(JSON.stringify(G.fresh()));
   bad.fl=[{id:1,n:'1st Fleet',sh:[5,0,0],hp:1,at:null,pos:{sec:0,x:40,y:40},tg:99,eta:5,tot:9,o:{sec:0,x:50,y:54}},
           {id:2,n:'2nd Fleet',sh:[1,0,0],hp:1,at:null,hold:98}];
   G.adopt(bad);
   const healed={ tg:G.S.fl[0].tg, busy:G.fleetBusy(G.S.fl[0]), at2:G.S.fl[1].at, hold2:G.S.fl[1].hold };
   return { round, legacy, healed };
 });
 ok('a save keeps a holding fleet beside its (still frozen) contact and a flight in the air',
   sv.round.hold && sv.round.pos && sv.round.fz && sv.round.tg && sv.round.o && sv.round.eta, sv.round);
 ok('an old save\'s contacts get an id, their sector and a seed; t.sys is dropped',
   sv.legacy.ids[0]!==sv.legacy.ids[1] && sv.legacy.secs[0]===1 && sv.legacy.secs[1]===0 && !sv.legacy.sys && sv.legacy.sd, sv.legacy);
 ok('...and an old mid-flight fleet keeps flying from the system it left', sv.legacy.to==='kor' && sv.legacy.o && sv.legacy.o.sys==='home' && Number.isFinite(sv.legacy.pos.x), sv.legacy);
 ok('a fleet pointing at a contact that no longer exists just stops / goes home', sv.healed.tg===null && !sv.healed.busy && sv.healed.at2==='home' && sv.healed.hold2===null, sv.healed);

 // ---------------- the Raids tab ----------------
 const tab=await p.evaluate(()=>{
   const G=window.__SD;
   __fx();
   G.gotoTab('p-raid'); G.dirty=true; G.render();
   return { targetsBtn:!!document.querySelector('#raidMode [data-rd="targets"]'), list:!!document.getElementById('tgts'),
     fleetShown:!document.getElementById('rpFleet').hidden, ships:document.querySelectorAll('#flShips .shp').length,
     rivals:!!document.querySelector('#rpFleet #rvBars') };
 });
 ok('the Raids tab has no TARGETS sub-tab or target list any more', !tab.targetsBtn && !tab.list, tab);
 ok('...it opens on FLEET (ships to buy, rival pressure underneath)', tab.fleetShown && tab.ships===3 && tab.rivals, tab);

 // ---------------- markers glide by transform, and are never rebuilt for movement ----------------
 const churn=await p.evaluate(async()=>{
   const G=window.__SD;
   __fx();
   __mk(true);
   G.dirty=true; G.render();
   const en=document.querySelector('#fleetMarkers .enmark button'), fm=document.querySelector('#fleetMarkers .flmark');
   const t0=document.querySelector('#fleetMarkers .enmark').style.transform;
   await new Promise(r=>setTimeout(r,900));
   G.dirty=true; G.render();
   return { sameBtn:en===document.querySelector('#fleetMarkers .enmark button'), sameFl:fm===document.querySelector('#fleetMarkers .flmark'),
     moved:t0!==document.querySelector('#fleetMarkers .enmark').style.transform, tf:/translate3d/.test(t0) };
 });
 ok('a drifting contact keeps the same button node (tchurn2) and moves by transform', churn.sameBtn && churn.sameFl && churn.moved && churn.tf, churn);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
