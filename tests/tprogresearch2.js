const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tprogresearch2.js — the Research tab's four trees.
//
// Every research node (RESH) and every exotic programme (XPROG) now sits in one of
// four trees - Economy, Combat, Defence, Command (TECH_TREES) - shown as compact cards
// on a spine. This replaces the old TECH TREE / PROGRAMMES sub-tabs (#rtrack,
// #progList), which this file used to cover. What carries over: a programme is gated
// on exoEverBanked() (lifetime, not current balance), buttons follow the balance live
// without being rebuilt, and Empire's #gens never carries a programme row. New: the
// tabs, one plain effect line per card, bought and finished nodes staying visible,
// and a card unfolding in place (animated) instead of a modal.
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 await p.evaluate(()=>{
   window.__go=(extra)=>{
     const G=window.__SD;
     G.adopt({...G.fresh(), lvl:24, lvSeen:24, xpn:G.xpNeed(24), ore:1e6, all:1e7, cry:5000, sv:0,
       rs:{drill:12,cryo:4,amp:2}, sys:{home:{b:{0:5}}}, ...(extra||{})});
     G.S.notifyQueue.length=0; document.getElementById('mask').classList.remove('on');
     G.techTab='eco'; G.gotoTab('p-res'); dirty=true; render();
   };
 });

 // ---------- every node is in exactly one tree ----------
 const cover=await p.evaluate(()=>{
   const G=window.__SD; __go();
   const placed=G.TECH_TREES.flatMap(t=>G.techIds(t));
   const want=G.RESH.map(r=>r.id).concat(G.XPROG.map(r=>r.id).filter(id=>id!=='comm'));
   return { missing:want.filter(id=>placed.indexOf(id)<0), dupes:placed.filter((id,i)=>placed.indexOf(id)!==i),
     comm:placed.indexOf('comm')>=0, fx:placed.filter(id=>!G.TECH_FX[id]),
     tabs:[...document.querySelectorAll('#techTabs .techtab')].map(x=>x.textContent) };
 });
 ok('every research node and programme sits in exactly one tree (Command Lattice in none)',
    cover.missing.length===0 && cover.dupes.length===0 && !cover.comm, cover);
 ok('every card has its own plain one-line effect', cover.fx.length===0, cover.fx);
 ok('four tree tabs, each with a researched/total count', cover.tabs.length===4 && cover.tabs.every(t=>/\d+\/\d+$/.test(t)) && /^ECONOMY/.test(cover.tabs[0]), cover.tabs);

 // ---------- Economy: a trunk, two branches, bought and finished nodes all visible ----------
 const eco=await p.evaluate(()=>{
   const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
   const drill=q('#techTree .tnode[data-id="drill"]'), cryo=q('#techTree .tnode[data-id="cryo"]');
   return { trunk:!!q('#techTree .ttrunk .tnode[data-id="drill"]'), cols:qa('#techTree .tcol h4').map(h=>h.textContent),
     left:qa('#techTree .tcol:nth-child(1) .tnode').map(n=>n.dataset.id), right:qa('#techTree .tcol:nth-child(2) .tnode').map(n=>n.dataset.id),
     drillMax:drill.classList.contains('max'), drillShown:drill.getBoundingClientRect().height>20, drillLv:drill.querySelector('.tlv').textContent.trim(),
     cryoPips:cryo.querySelectorAll('.tpips i.on').length+'/'+cryo.querySelectorAll('.tpips i').length,
     cryoFx:cryo.querySelector('.tfx').textContent, oldGone:!q('#resMode')&&!q('#rtrack')&&!q('#progList') };
 });
 ok('Economy forks under Deep Core Drilling: Ore & Crystal on the left, Exotics on the right',
    eco.trunk && eco.cols.join('|')==='ORE & CRYSTAL|EXOTICS' && eco.left.join()==='cryo,frame,found,burn,yield' && eco.right.join()==='latt,loom', eco);
 ok('a finished node stays on the tree (a slim MAX line); a part-bought one shows its level as pips',
    eco.drillMax && eco.drillShown && /MAX/.test(eco.drillLv) && eco.cryoPips==='4/10' && /crystal/.test(eco.cryoFx), eco);
 ok('the old TECH TREE / PROGRAMMES sub-tabs are gone', eco.oldGone, eco);

 // ---------- a card unfolds in place, animated, without swapping any button ----------
 const fold=await p.evaluate(async()=>{
   const nd=document.querySelector('#techTree .tnode[data-id="cryo"]'), head=nd.querySelector('.thead'), slab=nd.querySelector('.tslab'), more=nd.querySelector('.tmore');
   const closed=more.getBoundingClientRect().height, tr=getComputedStyle(more).transitionProperty;
   head.click();
   const justAfter=more.getBoundingClientRect().height;
   await new Promise(r=>setTimeout(r,450));
   const open=more.getBoundingClientRect().height;
   const same=nd===document.querySelector('#techTree .tnode[data-id="cryo"]') && slab===nd.querySelector('.tslab');
   const r={ closed, justAfter, open, tr, same, sel:nd.classList.contains('sel'), exp:head.getAttribute('aria-expanded'),
     slabText:slab.textContent, slabDisabled:slab.disabled, vis:getComputedStyle(nd.querySelector('.tmorein')).visibility };
   head.click(); await new Promise(r=>setTimeout(r,450));
   r.closedAgain=more.getBoundingClientRect().height; r.selAfter=nd.classList.contains('sel');
   return r;
 });
 ok('tapping a card opens it in place: collapsed to 0, eased open (not snapped), the same nodes throughout',
    fold.closed===0 && fold.justAfter<fold.open && fold.open>60 && /grid-template-rows/.test(fold.tr) && fold.same && fold.sel && fold.exp==='true' && fold.vis==='visible', fold);
 ok('...it shows RESEARCH with the price, and tapping again folds it away', /^RESEARCH/.test(fold.slabText) && !fold.slabDisabled && fold.closedAgain===0 && !fold.selAfter, fold);

 // ---------- buying a research node from its card ----------
 const buy=await p.evaluate(async()=>{
   const G=window.__SD;
   const nd=document.querySelector('#techTree .tnode[data-id="cryo"]');
   nd.querySelector('.thead').click();
   const cry0=G.S.cry, lv0=G.S.rs.cryo;
   nd.querySelector('.tslab').click();
   await new Promise(r=>setTimeout(r,300));
   const conf=nd.querySelector('.rconf').textContent;
   await new Promise(r=>setTimeout(r,1000));
   const after=document.querySelector('#techTree .tnode[data-id="cryo"]');
   return { lv:G.S.rs.cryo-lv0, spent:cry0-G.S.cry>0, conf, pips:after.querySelectorAll('.tpips i.on').length, stillOpen:after.classList.contains('sel'),
     tab:document.querySelector('#techTabs .techtab.on').textContent };
 });
 ok('RESEARCH buys the level, types RESEARCHED on the card, and the card stays open with one more pip',
    buy.lv===1 && buy.spent && /^RESEA/.test(buy.conf) && buy.pips===5 && buy.stillOpen, buy);

 // ---------- programmes: locked until the exotic has ever been banked; live without a rebuild ----------
 const prog=await p.evaluate(async()=>{
   const G=window.__SD; __go();
   const nd=()=>document.querySelector('#techTree .tnode[data-id="frame"]');
   const locked={ cls:nd().classList.contains('lock'), req:(nd().querySelector('.treq')||{}).textContent, slab:nd().querySelector('.tslab').textContent, dis:nd().querySelector('.tslab').disabled };
   G.S.exoSeen={ir:1}; G.S.exo={ir:2}; dirty=true; render();
   const slab=nd().querySelector('.tslab');
   const poor={ text:slab.textContent, dis:slab.disabled, cls:nd().classList.contains('lock') };
   G.S.exo.ir=500; render();                                   /* NOT dirty: only the per-frame pass runs */
   const rich={ text:slab.textContent, dis:slab.disabled, same:slab===nd().querySelector('.tslab'), chip:document.getElementById('techBal').textContent };
   G.S.exo.ir=0; dirty=true; render();                         /* spent down to nothing: still unlocked - the gate is lifetime */
   const spentOut=nd().classList.contains('lock');
   G.S.exo.ir=500; render();
   nd().querySelector('.thead').click(); nd().querySelector('.tslab').click();
   await new Promise(r=>setTimeout(r,1100));
   return { locked, poor, rich, spentOut, lv:G.S.xp.frame, left:G.S.exo.ir, empire:document.querySelectorAll('#gens [data-sys^="x:"]').length };
 });
 ok('a programme whose exotic was never banked is shown, locked, and says what unlocks it',
    prog.locked.cls && /Bank Iridium/.test(prog.locked.req||'') && prog.locked.slab==='LOCKED' && prog.locked.dis, prog.locked);
 ok('once banked it unlocks; its button reads NEED while short and RESEARCH when affordable - updated in place, never rebuilt',
    !prog.poor.cls && /^NEED/.test(prog.poor.text) && prog.poor.dis && /^RESEARCH/.test(prog.rich.text) && !prog.rich.dis && prog.rich.same && /IRIDIUM/.test(prog.rich.chip), prog);
 ok('the gate is lifetime: spending the exotic down to zero does not re-lock it', prog.spentOut===false, prog);
 ok('buying a programme from its card spends the exotic and raises its level; Empire carries no programme rows',
    prog.lv===1 && prog.left<500 && prog.empire===0, prog);

 // ---------- the other trees ----------
 const others=await p.evaluate(()=>{
   const G=window.__SD; __go({sv:500, rs:{drill:12,auto:2,void:2}});
   const pick=id=>{ document.querySelector('#techTabs .techtab[data-t="'+id+'"]').click(); return [...document.querySelectorAll('#techTree .tnode')].map(n=>n.dataset.id) };
   const war=pick('war'), def=pick('def');
   const pdef=document.querySelector('#techTree .tnode[data-id="pdef"]'), bat=document.querySelector('#techTree .tnode[data-id="bat"]');
   const d={ slabCls:pdef.querySelector('.tslab').className, batLock:bat.classList.contains('lock'), batReq:(bat.querySelector('.treq')||{}).textContent };
   const cmd=pick('cmd');
   const auto=document.querySelector('#techTree .tnode[data-id="auto"]');
   return { war, def, cmd, d, what:document.getElementById('techWhat').textContent, autoHas:auto.classList.contains('has') };
 });
 ok('Combat, Defence and Command each list their own nodes',
    others.war.join()==='core,casc,void,caged' && others.def.join()==='pdef,bat,bul' && others.cmd.join()==='amp,optic,cold,vault,auto' && others.what.length>10, others);
 ok('a salvage node is bought with the bronze salvage slab; a node with an unmet requirement says what it needs',
    /svslab/.test(others.d.slabCls) && others.d.batLock && /Requires Point Defence Grid/.test(others.d.batReq||''), others.d);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
