const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tprogresearch2.js — Stage 1 / v3 (patch429): the exotic programme cards moved from an
// Empire accordion row to a PROGRAMMES sub-tab inside Research (#progList, no accordion -
// every banked programme just renders open). Replaces tprogfold.js (retired,
// .obsolete), which covered the old "shares empOpen with system rows" Empire behaviour
// that no longer exists. What carries over unchanged: gating on exoEverBanked() (lifetime,
// not current balance), the badge, and live updates without a tap. New here: the
// TECH TREE / PROGRAMMES sub-tab toggle, and confirming Empire's #gens is clean of
// programme rows entirely.
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);

 // ---------- gating: no exotic ever banked -> no programme cards, on either tab
 await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:0, all:0, exo:{}, sys:{home:{home:true,b:{0:5}}}, lvl:1});
 });
 await p.evaluate(()=>{ window.__SD.gotoTab('p-res'); dirty=true; render(); });
 await p.evaluate(()=>{ document.querySelector('.rmbtn[data-rm="prog"]').click(); });
 await p.waitForTimeout(200);
 const none = await p.evaluate(()=>({
   progRows: document.querySelectorAll('#progList [data-sys^="x:"]').length,
   emptyMsg: document.querySelector('#progList').textContent.trim(),
   gensGone: !document.getElementById('gens')
 }));
 ok('no programme section before anything is ever banked', none.progRows===0, none);
 ok('an explanatory empty-state message shows instead', none.emptyMsg.length>0, none);
 // patch612: the old Empire accordion (#gens) is gone outright now, not just clean
 // of programme rows - the stronger, still-accurate version of the same claim.
 ok('the old Empire accordion (#gens) is gone entirely, not just of programme rows', none.gensGone, none);

 // ---------- gating: banking some, then spending it to zero, keeps the section
 const irSys = await p.evaluate(()=>window.__SD.SYS.find(s=>s.res==='ir').id);
 await p.evaluate((irSys)=>{
   const G=window.__SD;
   const sys={ home:{home:true,b:{0:5}} };
   // PATCH 1 (v3 tuning): an unbuilt system now produces exactly zero (buildings
   // replace extraction - see HANDOVER) - the old dev:0-still-yields-something
   // baseline is gone on purpose, so this fixture actually builds a tier now, or
   // the later "live update" section below would have nothing to observe ticking.
   const gi=G.LADDERS[G.SYSMAP[irSys].kind][0];
   sys[irSys]={ b:{ [gi]:5 } };
   G.adopt({...G.fresh(), ore:1e6, all:1e6, exo:{ir:50}, sys, lvl:20});
 }, irSys);
 await p.evaluate(()=>{ dirty=true; render(); });
 await p.waitForTimeout(150);
 const banked = await p.evaluate(()=>({
   progRows: [...document.querySelectorAll('#progList [data-sys^="x:"]')].length,
   irRowExists: !!document.querySelector('#progList [data-sys="x:ir"]'),
   cards: document.querySelectorAll('#progList [data-sys="x:ir"] ~ .sysbody .card').length
 }));
 ok('a programme section appears once its exotic is banked', banked.irRowExists, banked);
 ok('the upgrade cards are present, already expanded (no accordion here)', banked.cards>0, banked);
 await p.evaluate(()=>{ window.__SD.S.exo.ir=0; dirty=true; render(); });
 await p.waitForTimeout(150);
 const spent = await p.evaluate(()=>!!document.querySelector('#progList [data-sys="x:ir"]'));
 ok('the section survives being spent back down to zero (lifetime, not current balance)', spent);

 // ---------- badge: affordable vs not
 await p.evaluate(()=>{ window.__SD.S.exo.ir=1e6; dirty=true; render(); });
 await p.waitForTimeout(150);
 const badgeState = await p.evaluate(()=>{
   const b=document.querySelector('#progList [data-sys="x:ir"] [data-badge]');
   return b ? getComputedStyle(b).display : null;
 });
 ok('an affordable upgrade shows the badge', badgeState!==null && badgeState!=='none', {badgeState});
 await p.evaluate(()=>{ window.__SD.S.exo.ir=0; dirty=true; render(); });
 await p.waitForTimeout(150);
 const badgeGone = await p.evaluate(()=>{
   const b=document.querySelector('#progList [data-sys="x:ir"] [data-badge]');
   return b ? getComputedStyle(b).display : null;
 });
 ok('the badge disappears when nothing is affordable', badgeGone==='none', {badgeGone});

 // ---------- live updates: banked/rate tick without a tap or re-render trigger
 const before = await p.evaluate(()=>document.querySelector('#progList [data-sys="x:ir"] [data-banked]').textContent);
 await p.waitForTimeout(3000);
 const after = await p.evaluate(()=>document.querySelector('#progList [data-sys="x:ir"] [data-banked]').textContent);
 ok('the banked amount updates live, no tap needed', before!==after, {before,after});

 // ---------- buying actually works from here, unmodified cost/effect
 const lvlBefore = await p.evaluate(()=>window.__SD.xlv('frame'));
 await p.evaluate(()=>{ window.__SD.S.exo.ir=1e6; dirty=true; render(); });
 await p.waitForTimeout(150);
 await p.evaluate(()=>{ document.querySelector('#progList [data-xp="frame"]').click(); });
 await p.waitForTimeout(150);
 const lvlAfter = await p.evaluate(()=>window.__SD.xlv('frame'));
 ok('buying an upgrade from the Research tab actually levels it', lvlAfter===lvlBefore+1, {lvlBefore,lvlAfter});

 // ---------- sub-tab toggle: TECH TREE and PROGRAMMES are mutually exclusive panes
 const toggled = await p.evaluate(()=>{
   document.querySelector('.rmbtn[data-rm="tree"]').click();
   const treeOn = { treeHidden:document.querySelector('#resTreePane').hidden,
     progHidden:document.querySelector('#resProgPane').hidden };
   document.querySelector('.rmbtn[data-rm="prog"]').click();
   const progOn = { treeHidden:document.querySelector('#resTreePane').hidden,
     progHidden:document.querySelector('#resProgPane').hidden };
   return {treeOn, progOn};
 });
 ok('TECH TREE shows the tree, hides programmes', !toggled.treeOn.treeHidden && toggled.treeOn.progHidden, toggled);
 ok('PROGRAMMES shows the programmes, hides the tree', toggled.progOn.treeHidden && !toggled.progOn.progHidden, toggled);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
