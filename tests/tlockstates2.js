const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tlockstates2.js — item 2: three lock states for unclaimed systems on the map.
// Level-not-reached stays locked (.mnode.locked, dimmed, dashed ring). Level-reached-
// but-unclaimed drops the lock (.mnode.open) and does so the INSTANT level() itself
// changes (takeLevel), not just next time the map re-renders.
//
// PATCH 2 extends this file: the level-reached-and-unheld bucket itself splits in two
// depending on sysContested() (rival-held or not) - CLAIMABLE (.mnode.open, unchanged
// from above) and CONTESTED (.mnode.foe: garrison/archetype intel and an INVADE/ASSAULT
// action where the claim cost/CLAIM button would sit, a tap that routes to the map's
// EXISTING assault flow rather than the claim one).
//
// patch613: re-pointed off #gens .sysrow2 (the old Empire accordion row, deleted by
// patch612) onto the only UI that still carries these three states - the map node's
// own locked/open/foe classes, and the sheet's info text (opened by tapping the node)
// for the garrison/archetype/claim-cost/rival-owner detail the old row's text used to
// carry. .rivalmark/.lockicon (CSS-only now, their markup went with the row) have no
// replacement worth inventing - the sheet's "HELD BY <rival>" meta line and #sysWar
// vs #sysClaim (already tsheet2.js's own job) say the same thing.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // kor.lvl===9. Start below it (locked, and level 8+ so the map itself is revealed -
 // see PLAN-unify.md item 5 - otherwise kor would not even have a node to read yet).
 const setup=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ore:1e9, all:0, cry:0, dm:0, exo:{}, sys:{home:{home:true,b:{}}},
     lvl:8, lvSeen:8, rs:{}, nx:{}, ab:[], buy:1, msel:null});
   G.gotoTab('p-map'); dirty=true; render();
   return {korLvl:G.SYSMAP.kor.lvl, level:G.level()};
 });
 out.push('   kor requires level '+setup.korLvl+', currently '+setup.level);

 const before=await p.evaluate(()=>{
   const el=[...document.querySelectorAll('#mapNodes .mnode')].find(n=>n.dataset.s==='kor');
   return el ? {cls:el.className} : null;
 });
 ok('below level: locked class on the node, not held/open/foe',
    before && before.cls.includes('locked') && !before.cls.includes('held')
    && !before.cls.includes('open') && !before.cls.includes('foe'), before);

 // grant exactly enough all-time ore to earn level 9, then actually CLAIM up to it
 // (checkLevel/takeLevel, not just S.lvl assignment) so this exercises the real path.
 await p.evaluate(async()=>{
   const G=window.__SD;
   G.S.xpn=G.xpNeed(G.SYSMAP.kor.lvl);
   G.checkLevel();
   while(G.pendingLevels()>0){ const off=G.lvOffer(); G.takeLevel(off[0]); }
 });
 // deliberately NOT calling render()/dirty=true by hand, and NOT switching tabs -
 // takeLevel() alone must already be enough (it sets dirty=true; the frame loop's
 // throttled render() picks it up within ~90ms).
 await p.waitForTimeout(250);

 const after=await p.evaluate(()=>{
   const el=[...document.querySelectorAll('#mapNodes .mnode')].find(n=>n.dataset.s==='kor');
   if(!el)return null;
   el.click();
   const info=document.getElementById('sysInfo');
   return {cls:el.className, infoText:info?info.textContent:''};
 });
 await p.waitForTimeout(200);
 ok('level crossed via takeLevel() alone (no manual render/tab-switch) flips the node',
    after && after.cls.includes('open') && !after.cls.includes('locked'), after);
 ok('claim cost still shown (tapping the node opens the sheet with it)',
    after && /ore/i.test(after.infoText), after);
 ok('a claimable system carries no rival-owner mark in the sheet',
    after && !/HELD BY/.test(after.infoText), after);

 // ---------- PATCH 2: claimable vs contested ----------
 // tan (belt, ring 1) is garrisoned by the Vasht Collective, lvl 16 - level() is
 // already past kor's 9 from above, so raise it past tan's 16 too.
 const rival=await p.evaluate(()=>{
   const G=window.__SD;
   G.S.xpn=G.xpNeed(G.SYSMAP.tan.lvl);
   G.checkLevel();
   while(G.pendingLevels()>0){ const off=G.lvOffer(); G.takeLevel(off[0]); }
   dirty=true; render();
   const el=[...document.querySelectorAll('#mapNodes .mnode')].find(n=>n.dataset.s==='tan');
   if(!el)return null;
   el.click();
   const info=document.getElementById('sysInfo');
   return { cls:el.className, infoText: info?info.textContent:'' };
 });
 await p.waitForTimeout(200);
 ok('a rival-held, level-reached system reads as CONTESTED, not claimable or locked',
    rival && rival.cls.includes('foe')
    && !rival.cls.includes('open') && !rival.cls.includes('locked'), rival);
 ok('the sheet names the rival owning it (HELD BY ...)', rival && /HELD BY/.test(rival.infoText), rival);
 // the sheet shows Garrison/Archetype intel ALONGSIDE the claim-cost figure (invading
 // still costs the same ore the claim would) - unlike the old row, which hid the cost
 // and showed only garrison. Confirmed against renderMap()'s own contested branch.
 ok('garrison/archetype intel shows in the sheet', rival && /Garrison/.test(rival.infoText) && /Archetype/.test(rival.infoText), rival);

 // the node is already selected (tapped above) - the sheet itself must show the
 // assault flow, never the claim one, same routing the old row's tap used to do.
 const routed=await p.evaluate(()=>({
   msel:window.__SD.S.msel,
   hasClaimBtn:!!document.getElementById('sysClaim'),
   hasWarBtn:!!document.getElementById('sysWar'),
 }));
 ok('tapping a contested node selects it in the sheet', routed.msel==='tan', routed);
 ok('...showing the ASSAULT flow, not the claim flow', routed.hasWarBtn && !routed.hasClaimBtn, routed);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
