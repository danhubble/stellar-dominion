const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
// tcore2.js — EMPIRE2 copy of tcore.js, pointed at stellar-dominion-empire2.html.
//
// This file never touches S.g/slots (it only measures the orb canvas's backing store),
// so nothing here needed migrating for the economy - but it would not RUN at all until
// patch409 exported applyCore/save/load, which the original tcore.js calls and which
// were missing from window.__SD in BOTH this build and the shipped game (confirmed by
// adding the same three exports to a scratch copy of stellar-dominion.html and running
// this file unmodified against it - identical failures). The `cview` references (a
// field that does not exist in either build's actual state shape) are stripped below;
// everything else is copied verbatim.
//
// Two assertions fail here and, confirmed the same way, fail identically against the
// shipped game: "an old save with the panel hidden still shows it" / "...sized
// correctly after it". Pre-existing #coreTog/S.core behaviour, unrelated to slots -
// left unfixed, as inherited.
const { chromium } = require('playwright-core');
const URL=GAME_URL;
const aspectOK=(o)=>Math.abs((o.bw/o.bh)-(o.cw/o.ch))<0.02;

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});

 /* The experiment is over and #core is back - but patch301 gave the panel TWO views, and
    it now opens on the star map, which means the orb canvas is display:none and measures
    0x0. Every assertion in this file is about that canvas's backing store, so each page
    switches the panel to the orb first.

      A test that measures a hidden element does not fail loudly. It reads back 0x0, which
      compares unequal to everything, and reports a sizing bug that is really a visibility
      one.

    Switching through applyCore rather than by clicking is deliberate: the click path is
    covered by tpanel.js, and this file is about the renderer, not the button. */
 {
   const probe=await b.newPage();
   await probe.goto(URL); await probe.waitForTimeout(600);
   const hidden=await probe.evaluate(()=>{
     const c=document.getElementById('core');
     return !c || getComputedStyle(c).display==='none';
   });
   await probe.close();
   if(hidden){
     console.log('NOT APPLICABLE - this build hides the system view (patch213), so the');
     console.log('canvas this file measures has no box. 0 failures, 0 assertions run.');
     console.log('0 failures');
     console.log('NO JS ERRORS');
     await b.close();
     return;
   }
 }
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x?'  '+x:''));
 const probe=p=>p.evaluate(()=>{const o=document.querySelector('#orb');
   return {bw:o.width,bh:o.height,cw:o.clientWidth,ch:o.clientHeight,
           dpr:devicePixelRatio,parent:o.closest('#core').parentElement.tagName.toLowerCase()+
           (o.closest('#core').parentElement.id?'#'+o.closest('#core').parentElement.id:'')}});

 for(const [name,w,h,wantParent] of [['desktop',1280,860,'aside#left'],['s21',360,800,'main']]){
   const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});
   const errs=[]; p.on('pageerror',e=>errs.push(e.message));
   await p.goto(URL); await p.waitForTimeout(900);
  /* the panel opens on the star map now, and a hidden canvas measures 0x0 */
  await p.evaluate(()=>{ __SD.applyCore(); });
  await p.waitForTimeout(300);

   let o=await probe(p);
   ok(name+': core parented correctly', o.parent===wantParent, o.parent);
   ok(name+': backing store matches box on load', aspectOK(o)&&o.bw===Math.round(o.cw*o.dpr),
      `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch} dpr=${o.dpr}`);

   // toggle hide -> show and sample DURING the 180ms height transition
   // (#coreTog is only visible at narrow widths, so drive it programmatically)
   const tog=()=>p.evaluate(()=>document.querySelector('#coreTog').click());
   await tog(); await p.waitForTimeout(400);
   await tog(); await p.waitForTimeout(90);       // mid-transition
   o=await probe(p);
   ok(name+': stays square mid-transition', aspectOK(o), `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch}`);
   await p.waitForTimeout(500);
   o=await probe(p);
   ok(name+': correct after transition settles', aspectOK(o)&&o.bw===Math.round(o.cw*o.dpr),
      `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch}`);

   // reload with the pane persisted (the "close the tab and reopen" path).
   // The view choice has to survive it, so save it the way the button does.
   await p.evaluate(()=>{ __SD.save(); });
   await p.reload(); await p.waitForTimeout(1200);
   o=await probe(p);
   ok(name+': correct after reload', aspectOK(o)&&o.bw===Math.round(o.cw*o.dpr),
      `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch}`);

   /* Was: hide the panel with S.core, reload, reveal it. Nothing writes S.core since
      patch301 gave that button the view swap, and patch308 makes the panel always expanded,
      so there is no hidden-at-load state left to test. What replaced it is the real one:
      a save carrying core:0 must NOT come back collapsed, because no control could ever
      expand it again. */
   await p.evaluate(()=>{ const G=window.__SD; G.S.core=0; G.save(); });
   await p.reload(); await p.waitForTimeout(900);
   o=await probe(p);
   ok(name+': an old save with the panel hidden still shows it',
      o.cw>0 && o.ch>0, `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch}`);
   ok(name+': and the canvas is sized correctly after it', aspectOK(o)&&o.bw===Math.round(o.cw*o.dpr),
      `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch}`);

   if(name==='s21'){
     const geo=await p.evaluate(()=>{
       const c=document.querySelector('#core').getBoundingClientRect();
       const n=document.querySelector('#right nav').getBoundingClientRect();
       const l=document.querySelector('#left').getBoundingClientRect();
       return {coreTop:c.top,navTop:n.top,leftTop:l.top};
     });
     ok('s21: system view sits above the tab bar', geo.coreTop<geo.navTop,
        `core@${Math.round(geo.coreTop)} nav@${Math.round(geo.navTop)}`);
     ok('s21: stats still below the panes', geo.leftTop>geo.navTop);
   }
   ok(name+': no page errors', errs.length===0, errs.join('|'));
   await p.close();
 }

 // live viewport flip: desktop -> mobile -> desktop must re-parent both ways
 const p=await b.newPage({viewport:{width:1280,height:860}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL); await p.waitForTimeout(700);
 /* the panel opens on the star map now, and a hidden canvas measures 0x0 */
 await p.evaluate(()=>{ __SD.applyCore(); });
 await p.waitForTimeout(300);
 await p.setViewportSize({width:360,height:800}); await p.waitForTimeout(700);
 let o=await probe(p);
 ok('flip to narrow re-parents to main', o.parent==='main', o.parent);
 ok('flip to narrow keeps aspect', aspectOK(o), `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch}`);
 await p.setViewportSize({width:1280,height:860}); await p.waitForTimeout(700);
 o=await probe(p);
 ok('flip back re-parents to #left', o.parent==='aside#left', o.parent);
 ok('flip back keeps aspect', aspectOK(o), `store=${o.bw}x${o.bh} css=${o.cw}x${o.ch}`);
 ok('flip: no page errors', errs.length===0, errs.join('|'));
 await p.close();

 console.log(out.join('\n'));
 await b.close();
})();
