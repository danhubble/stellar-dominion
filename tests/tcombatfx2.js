const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tcombatfx2.js — the manual-battle rework made on the combat mock.
//
// (1) The pulse laser fires a bolt that travels; damage lands on arrival. A miss
//     still flies, past the target.
// (2) Rockets only hurt bare hull: against a live shield they burst and do nothing.
// (3) Some hostiles carry layered shields (Bulwark/Flagship 2, Warden 3); each layer
//     is stripped in turn.
// (4) Burst fires 3 bolts one after another, the Heavy Cannon 5.
// (5) The owner's sound clips are inlined and named; battle music is a separate file
//     that starts with a manual fight.
const { chromium } = require('playwright-core');
const fs=require('fs'), path=require('path');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL); await p.waitForTimeout(400);
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));
 await p.evaluate(()=>{
   window.__fight=(slots)=>{ const G=window.__SD;
     if(G.BT)G.closeBattle();
     G.adopt({...G.fresh(), all:1e9, lvl:30, lvSeen:30, ore:1e9, sh:[60,24,8], fhp:1, cmode:"wep", ammo:50,
       wep:{own:Object.fromEntries(G.WEAPONS.map(w=>[w.id,1])), slot:slots}, wpow:[1,1,1]});
     G.S.notifyQueue.length=0; hideModal();
     const f=G.S.fl[0], t=G.newTarget(); t.ti=2; t.sec=0; t.en=4;
     G.S.tg.push(t); f.pos={sec:0,x:50,y:50}; f.at=null; f.hold=t.id;
     G.engageTarget(t,G.S.tg.indexOf(t),f); G.bDraw();   // size the battle canvas, as the first frame would
     const BT=G.BT, e=BT.en.find(x=>x.alive); BT.sel=BT.en.indexOf(e); e.shd=0;
     return e;
   };
   window.__fly=()=>{ for(let i=0;i<12;i++)__SD.bFade(0.05); };   // long enough to land, short enough that the burst and its label are still up
 });

 // ---------- (1) the pulse bolt travels ----------
 const bolt=await p.evaluate(()=>{
   const G=window.__SD, R=Math.random, e=__fight(["pulse","rocket",null]), BT=G.BT;
   e.shp=0; e.shl=0; const hp0=e.hp;
   BT.wep[0].ch=99; Math.random=()=>0; G.fireWeapon(0); Math.random=R;
   const f=BT.fx.find(x=>x.t==="bolt"), before=e.hp;
   __fly();
   const hit={ flying:!!f, dur:f&&f.dur, beforeLand:before===hp0, landed:e.hp<hp0 };
   BT.wep[0].ch=99; Math.random=()=>0.999; const hp1=e.hp; G.fireWeapon(0); Math.random=R;
   const mf=BT.fx.find(x=>x.t==="bolt"&&x.miss);
   __fly();
   hit.miss={ flies:!!mf, untouched:e.hp===hp1 };
   return hit;
 });
 ok('the pulse laser fires a bolt that takes time to arrive; damage lands when it does',
    bolt.flying && bolt.dur>0.05 && bolt.beforeLand && bolt.landed, bolt);
 ok('a missed bolt still flies (and does no damage)', bolt.miss.flies && bolt.miss.untouched, bolt.miss);

 // ---------- (2) rockets need the shields down ----------
 const rk=await p.evaluate(()=>{
   const G=window.__SD, R=Math.random, e=__fight(["pulse","rocket",null]), BT=G.BT;
   e.shl=0; e.shm=e.max*0.5; e.shp=e.shm; const hp0=e.hp, sh0=e.shp;
   BT.wep[1].ch=99; Math.random=()=>0; G.fireWeapon(1); Math.random=R; __fly();
   const onShield={ hp:e.hp===hp0, shield:e.shp===sh0, burst:BT.fx.some(x=>x.t==="rburst"), label:BT.num.some(n=>n.sy==="SHIELDED") };
   e.shp=0; BT.wep[1].ch=99; Math.random=()=>0; G.fireWeapon(1); Math.random=R; __fly();
   return { onShield, onHull:e.hp<hp0 || !e.alive, boom:BT.fx.some(x=>x.t==="rboom") };
 });
 ok('a rocket on a live shield bursts on it: SHIELDED, no hull or shield damage', rk.onShield.hp && rk.onShield.shield && rk.onShield.burst && rk.onShield.label, rk.onShield);
 ok('...and on bare hull it explodes and hurts', rk.onHull && rk.boom, rk);

 // ---------- (3) layered shields ----------
 const ly=await p.evaluate(()=>{
   const G=window.__SD, e=__fight(["pulse","rocket",null]);
   e.shl=2; e.shm=100; e.shp=100; const i=G.BT.sel;
   G.hitEnemy(i,150,0); const one={ shl:e.shl, shp:e.shp };
   G.hitEnemy(i,150,0); G.hitEnemy(i,150,0);
   return { one, after:{ shl:e.shl, shp:e.shp }, labels:G.BT.num.map(n=>n.sy).filter(Boolean),
     kinds:{ bulwark:G.EK.shield.shl, flagship:G.EK.boss.shl, warden:G.EK.warden.shl } };
 });
 ok('a shield layer breaking brings up the next one, until SHIELDS DOWN',
    ly.one.shl===1 && ly.one.shp===100 && ly.after.shl===0 && ly.after.shp===0 && ly.labels.includes('SHIELDS DOWN') && ly.labels.some(s=>/2 LEFT/.test(s)), ly);
 ok('Bulwarks and Flagships carry one spare layer, Wardens two', ly.kinds.bulwark===1 && ly.kinds.flagship===1 && ly.kinds.warden===2, ly.kinds);

 // ---------- (4) burst and heavy cannon volleys ----------
 const vol=await p.evaluate(()=>{
   const G=window.__SD, R=Math.random; __fight(["burst","rocket","heavy"]); const BT=G.BT;
   BT.en.forEach(e=>{ e.shp=0; e.shl=0; });
   Math.random=()=>0; BT.wep[0].ch=99; G.fireWeapon(0);
   const burst=BT.fx.filter(x=>x.t==="bolt").map(x=>+x.w.toFixed(2));
   BT.fx.length=0; BT.wep[2].ch=99; G.fireWeapon(2); Math.random=R;
   const heavy=BT.fx.filter(x=>x.t==="bolt").map(x=>+x.w.toFixed(3));
   return { burst, heavy, total:G.WEPMAP.heavy.mul*G.WEPMAP.heavy.shots };
 });
 ok('the Burst Laser fires three bolts one after another', vol.burst.length===3 && vol.burst[0]===0 && vol.burst[1]>0 && vol.burst[2]>vol.burst[1], vol);
 ok('the Heavy Cannon fires five, faster, for the same total damage as before', vol.heavy.length===5 && vol.heavy[4]>vol.heavy[3] && Math.abs(vol.total-3.2)<1e-9, vol);

 // ---------- (5) sound clips and music ----------
 const snd=await p.evaluate(()=>{
   const G=window.__SD;
   const names=Object.keys(G.SAMPLES), vols=Object.keys(G.SAMPLE_VOL);
   __fight(["pulse","rocket",null]); G.S.muted=false; G.musicSync(0.016);
   const el=G.musicEl;
   return { names, ogg:names.every(k=>/^data:audio\/ogg;base64,/.test(G.SAMPLES[k])), missing:vols.filter(k=>!G.SAMPLES[k]&&!['fireBurst','boltShield'].includes(k)),
     music:el?el.src.split('/').slice(-2).join('/'):null, loop:el&&el.loop };
 });
 const musicFile=fs.existsSync(path.resolve(__dirname,'../dist/audio/battle-music.mp3'));
 ok('the owner\'s seven clips are inlined, and every sampled cue has a clip', snd.names.length===7 && snd.ogg && snd.missing.length===0, snd);
 ok('a manual fight starts the battle music, looping, from dist/audio', snd.music==='audio/battle-music.mp3' && snd.loop && musicFile, {snd, musicFile});

 ok('no page errors', errs.length===0, errs);
 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'JS ERRORS '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
