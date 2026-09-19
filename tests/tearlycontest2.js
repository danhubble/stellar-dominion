const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tearlycontest2.js — PATCH 3: early rings mostly uncontested (data-only). The first
// 2-3 systems a player can unlock (sorted by level gate, the order they actually
// become reachable in) must always be unheld/uncontested at game start, so a new
// player's first taste of claiming a system is never gated behind a fight they did
// not ask for. Rival presence should increase in the outer rings instead.
//
// This turned out to already be true of the existing GARRISON seed data (checked by
// hand against the SYS array before writing this test - see HANDOVER) - kor/dra/vel
// (the three lowest-level non-home systems, all ring 1) are none of them in GARRISON,
// so sysOwner() is null for all three from the moment the game boots, before any level
// is ever earned. No SYS/GARRISON edit was needed; this file is the permanent
// regression check that keeps it true.
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage();
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(400);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 const r=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh()});   // a genuinely fresh game, nothing claimed, level 1
   const byLvl=G.SYS.filter(s=>!s.home).slice().sort((a,b)=>a.lvl-b.lvl);
   const first3=byLvl.slice(0,3);
   const byRing={};
   for(const s of byLvl){ (byRing[s.ring]=byRing[s.ring]||[]).push(s); }
   const ringContestedFrac={};
   for(const ring in byRing){
     const list=byRing[ring];
     ringContestedFrac[ring]=list.filter(s=>G.sysContested(s)).length/list.length;
   }
   return {
     first3:first3.map(s=>({id:s.id, lvl:s.lvl, ring:s.ring, owner:G.sysOwner(s), contested:G.sysContested(s)})),
     ringContestedFrac
   };
 });

 ok('the first system a player can reach is unheld/uncontested at game start',
    !r.first3[0].contested && r.first3[0].owner===null, r.first3[0]);
 ok('the second system a player can reach is unheld/uncontested at game start',
    !r.first3[1].contested && r.first3[1].owner===null, r.first3[1]);
 ok('the third system a player can reach is unheld/uncontested at game start',
    !r.first3[2].contested && r.first3[2].owner===null, r.first3[2]);

 // rising contestation by ring - not a strict requirement on every single ring
 // boundary, just that the deep map is not LESS contested than the front door
 const rings=Object.keys(r.ringContestedFrac).map(Number).sort((a,b)=>a-b);
 const frontRing=r.ringContestedFrac[rings[0]], deepRing=r.ringContestedFrac[rings[rings.length-1]];
 ok('rival presence is higher (or equal) in the deepest ring than in the first one',
    deepRing>=frontRing, r.ringContestedFrac);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
