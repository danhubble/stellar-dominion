const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tnotices2.js — item 5: one-time unlock notices. Queued, one at a time, dismiss vs
// "go there", and an existing save that already satisfies a condition is back-filled
// as already-seen instead of being told "just unlocked".
//
// PATCH550/551 (VEGA): every old bare-unlock key (resUnlock/sysClaimable/exoBanked/
// raidUnlock/nexUnlock) is now a VEGA beat under "vega:<name>" (resUnlock->
// vega:research, sysClaimable->vega:claimable, raidUnlock->vega:raids, nexUnlock->
// vega:nexus; exoBanked keeps its own name). checkUnlocks() also gained new beats for
// UNLOCK entries that previously had none at all (vega:missions at p-mis/lvl3,
// vega:stats at p-ach/lvl6, vega:map at p-map/lvl8) plus vega:ring2/3/4 and
// vega:crew - crossing any UNLOCK threshold now queues EVERY beat whose condition is
// newly true, not just the one page name suggests, so every assertion below that
// depends on exact queue contents/order was re-derived from the live game (not
// guessed) and updated to match. New coverage: the notice card's VEGA header shows
// for a `who`-tagged beat and stays hidden for a plain one (lvClaim/xpHow).
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);
 const out=[]; const ok=(n,c,x)=>out.push((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));

 // ---------- a brand new game shows no notice at level 1 (boot's own vega:boot beat
 // fires only from real page load via `!had` - G.adopt() here is not that path, so it
 // does not appear; NOT a gap, see the dedicated VEGA one-off in HANDOVER)
 const fresh=await p.evaluate(()=>{
   const G=window.__SD; G.adopt({...G.fresh()});
   G.tick(0.016);   // exercises checkUnlocks() deterministically, without racing the rAF loop
   dirty=true; render();
   return {on:document.getElementById('notice').classList.contains('on'), q:G.S.notifyQueue};
 });
 ok('fresh level-1 game: no notice queued', !fresh.on && fresh.q.length===0, fresh);

 // ---------- crossing level 5 queues every beat newly true, not just Research: p-mis's
 // own gate is level 3, so a save that jumps straight from 1 to 5 clears BOTH at once.
 const res=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), xpn:G.xpNeed(5), ore:0});
   G.S.lvl=5; // claimed, not just earned - unlockedAt() reads level()
   G.tick(0.016);
   dirty=true; render();
   await new Promise(r=>setTimeout(r,50));
   return {on:document.getElementById('notice').classList.contains('on'),
     text:document.getElementById('noticeTxt').textContent,
     whoOn:!document.getElementById('noticeWho').hidden,
     whoText:document.getElementById('noticeWho').textContent,
     q:G.S.notifyQueue.slice()};
 });
 ok('crossing level 5 queues missions then research (both newly true)',
    res.on && res.q[0]==='vega:missions' && res.q[1]==='vega:research', res);
 ok('notice text is not empty / generic', res.text.length>10, res.text);
 ok('a VEGA beat shows the VEGA header', res.whoOn && res.whoText.indexOf('VEGA')===0, res);

 // ---------- "go there" navigates AND dismisses; queue advances
 const go=await p.evaluate(async()=>{
   const G=window.__SD;
   document.getElementById('noticeGo').click();
   await new Promise(r=>setTimeout(r,50));
   return {onTab:document.getElementById('p-mis').classList.contains('on'),
     noticeOn:document.getElementById('notice').classList.contains('on'), q:G.S.notifyQueue.slice()};
 });
 ok('TAKE ME THERE switches to Missions tab (vega:missions\' own go)', go.onTab, go);
 // dismissing vega:missions reveals vega:research next, already queued right behind it
 // from the same tick - xpHow is queued too (this save's xpn also satisfies its
 // condition) but sits at the BACK, after research, since checkUnlocks() checks
 // research before xpHow - one at a time, in the order they were queued.
 ok('and dismisses vega:missions, revealing vega:research queued behind it',
    !go.q.includes('vega:missions') && go.q[0]==='vega:research' && go.q.includes('xpHow') && go.noticeOn, go);

 // ---------- multiple unlocks in one jump queue in order, one shown at a time
 const multi=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh()});
   G.S.xpn=G.xpNeed(25); G.S.lvl=25;   // clears every UNLOCK gate through Nexus(20) plus ring2(23) at once
   G.tick(0.016);
   dirty=true; render();
   await new Promise(r=>setTimeout(r,50));
   const seq=[document.getElementById('noticeTxt').textContent];
   const q0=G.S.notifyQueue.slice();
   document.getElementById('noticeX').click();
   await new Promise(r=>setTimeout(r,50));
   seq.push(document.getElementById('noticeTxt').textContent);
   return {q0, seq, still:document.getElementById('notice').classList.contains('on')};
 });
 ok('several unlocks at once queue more than one', multi.q0.length>1, multi.q0);
 ok('dismissing the first reveals a different second one, still one at a time',
    multi.seq[0]!==multi.seq[1] && multi.still, multi.seq);
 ok('queue order is vega:research before vega:claimable (checkUnlocks\' own order)',
    multi.q0.indexOf('vega:research')>=0 && multi.q0.indexOf('vega:claimable')>=0 &&
    multi.q0.indexOf('vega:research')<multi.q0.indexOf('vega:claimable'), multi.q0);
 // exoBanked/crew never fire here - this fixture never produced an exotic and has 0
 // raid wins (crewUnlocked() needs 5), so neither condition is actually true.
 ok('exoBanked/crew stay unqueued when their own conditions are still false',
    !multi.q0.includes('vega:exoBanked') && !multi.q0.includes('vega:crew'), multi.q0);

 // ---------- an existing save that already meets conditions is NOT notified retroactively
 const backfill=await p.evaluate(()=>{
   const G=window.__SD;
   // simulate an old save: already level 25 (everything through ring2 unlocked, a
   // system claimed, an exotic on hand), no notifyQueue/seen fields at all - as if
   // from before VEGA existed.
   const packed=JSON.stringify({...G.fresh(), xpn:G.xpNeed(25), lvl:25, ore:5e6,
     sys:{home:{home:true,b:{}}, kor:{dev:0,b:{}}},
     exo:{ir:10}});
   const o=JSON.parse(packed); delete o.seen; delete o.notifyQueue; delete o.exoSeen;
   G.adopt(o);
   G.tick(0.016);   // confirm the backfill actually suppresses checkUnlocks(), not just adopt()'s own pass
   dirty=true; render();
   return {q:G.S.notifyQueue.slice(), seen:G.S.seen, on:document.getElementById('notice').classList.contains('on')};
 });
 ok('pre-existing "already unlocked" state is back-filled, not queued',
    backfill.q.length===0 && !backfill.on, backfill);
 ok('back-filled S.seen actually marks the tab-unlock conditions true',
    backfill.seen['vega:missions'] && backfill.seen['vega:research'] && backfill.seen['vega:stats'] &&
    backfill.seen['vega:map'] && backfill.seen['vega:raids'] && backfill.seen['vega:nexus'] &&
    backfill.seen['vega:ring2'] && backfill.seen['vega:claimable'] && backfill.seen['vega:exoBanked'],
    backfill.seen);
 ok('back-filled S.seen also covers the new claim-derived beat (kor already held)',
    !!backfill.seen['vega:firstClaim'], backfill.seen);

 // ---------------- patch629: VEGA overlay - fixed/dimmed, layout doesn't move, backdrop
 // tap dismisses but the panel itself doesn't, sits behind #battle, old saves boot into it ----------------
 const geom=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt(G.fresh()); dirty=true; render();
   const before={ mapWrap:document.getElementById('mapWrap').getBoundingClientRect().toJSON(),
     left:document.getElementById('left').getBoundingClientRect().toJSON() };
   G.S.xpn=G.xpNeed(5); G.S.lvl=5; G.tick(0.016); dirty=true; render();
   const after={ mapWrap:document.getElementById('mapWrap').getBoundingClientRect().toJSON(),
     left:document.getElementById('left').getBoundingClientRect().toJSON() };
   const style=getComputedStyle(document.getElementById('notice'));
   return {
     on:document.getElementById('notice').classList.contains('on'),
     display:style.display, zIndex:style.zIndex, position:style.position,
     mapWrapSame: JSON.stringify(before.mapWrap)===JSON.stringify(after.mapWrap),
     leftSame: JSON.stringify(before.left)===JSON.stringify(after.left),
     q:G.S.notifyQueue.slice()
   };
 });
 ok('a notice showing is position:fixed, display:flex, z-index 25', geom.on && geom.position==='fixed' && geom.display==='flex' && geom.zIndex==='25', geom);
 ok('nothing in #view/#left moves when a notice appears (#mapWrap/#left rects identical before/after)',
   geom.mapWrapSame && geom.leftSame, geom);

 // the elementFromPoint checks below need a clean full-viewport hit-testing surface - a fresh-looking
 // adopt() (like the one geom's own evaluate just did) can replay the intro scene (.scene, z-index 52,
 // deliberately the highest layer in the game), same as every other test file's own boot-time guard.
 // Not a patch629 effect - #notice sitting underneath a shown .scene is correct, same reasoning as it
 // sitting underneath #battle below; this just makes sure .scene is not incidentally in the way here.
 // Dismissing it queues vega:boot behind whatever was already there (tstory2.js: "vega:boot queues once
 // the intro is dismissed") - re-read the queue AFTER this, not the stale one geom captured before it.
 await p.evaluate(()=>{ if(window.__SD&&__SD.sceneOn)__SD.sceneFinish(); });
 await p.waitForFunction(()=>{ const el=document.getElementById('scene'); return !el||getComputedStyle(el).display==='none'; });

 const qBefore=await p.evaluate(()=>window.__SD.S.notifyQueue.slice());
 const panelCenter=await p.evaluate(()=>{
   const r=document.querySelector('.noticepanel').getBoundingClientRect();
   return {x:r.left+r.width/2, y:r.top+r.height/2};
 });
 await p.mouse.click(panelCenter.x, panelCenter.y);
 await p.waitForTimeout(100);
 const afterPanelTap=await p.evaluate(()=>window.__SD.S.notifyQueue.slice());
 ok('a real tap on the notice panel itself does not dismiss it (e.target is a descendant, not #notice)',
   JSON.stringify(afterPanelTap)===JSON.stringify(qBefore), {before:qBefore, after:afterPanelTap});

 // routine notices (vega:missions etc.) are a docked banner with no backdrop now; only
 // story beats keep the dimmed full-screen card, so put one (vega:boot) at the front
 const qStory=await p.evaluate(()=>{
   const G=window.__SD, q=G.S.notifyQueue, i=q.indexOf('vega:boot');
   if(i>0){ q.splice(i,1); q.unshift('vega:boot'); } else if(i<0) q.unshift('vega:boot');
   G.dirty=true; G.render(); return q.slice();
 });
 await p.waitForTimeout(250);
 const backdropPoint=await p.evaluate(()=>{
   const el=document.elementFromPoint(20,20);
   return {isNotice: el&&el.id==='notice'};
 });
 await p.mouse.click(20,20);
 await p.waitForTimeout(100);
 const afterBackdropTap=await p.evaluate(()=>window.__SD.S.notifyQueue.slice());
 ok('elementFromPoint away from the panel (the dimmed area) resolves to #notice itself', backdropPoint.isNotice, backdropPoint);
 ok('a real tap on that backdrop area dismisses the front notice, same action as noticeX',
   afterBackdropTap.length===qStory.length-1 && afterBackdropTap[0]!==qStory[0], {before:qStory, after:afterBackdropTap});

 const behindBattle=await p.evaluate(async()=>{
   document.getElementById('battle').classList.add('on');
   document.getElementById('battle').style.display='flex';
   await new Promise(r=>setTimeout(r,30));
   const noticeStillOn=document.getElementById('notice').classList.contains('on');
   const panelTop=Math.round(document.querySelector('.noticepanel').getBoundingClientRect().top+10);
   const topAtPanel=document.elementFromPoint(195, panelTop);
   const coveredByBattle=!!(topAtPanel && (topAtPanel.id==='battle' || topAtPanel.closest('#battle')));
   document.getElementById('battle').classList.remove('on');
   document.getElementById('battle').style.display='';
   return { noticeStillOn, coveredByBattle };
 });
 ok('a notice still queued while #battle shows is completely covered by it - z-index math alone, no JS guard needed',
   behindBattle.noticeStillOn && behindBattle.coveredByBattle, behindBattle);

 // old-save boot path: a save with a non-empty notifyQueue boots straight onto the overlay, not the old bar
 const oldSaveBoot=await p.evaluate(()=>{
   const G=window.__SD;
   const packed=JSON.stringify({...G.fresh(), notifyQueue:['xpHow']});
   G.adopt(JSON.parse(packed));
   dirty=true; render();
   const el=document.getElementById('notice'), style=getComputedStyle(el);
   return { on:el.classList.contains('on'), display:style.display, position:style.position,
     opacity:style.opacity, q:G.S.notifyQueue.slice() };
 });
 ok('a save with a pending notifyQueue boots straight onto the fixed overlay (not the old in-flow bar)',
   oldSaveBoot.on && oldSaveBoot.position==='fixed' && oldSaveBoot.opacity==='1' && oldSaveBoot.q.length===1, oldSaveBoot);

 // ---------- VEGA's line is typed out, not shown all at once ----------
 const typed=await p.evaluate(async()=>{
   const G=window.__SD;
   G.S.notifyQueue.length=0; dirty=true; render();
   G.S.notifyQueue.push('vega:missions'); dirty=true; render();
   const el=document.getElementById('noticeTxt'), full=G.NOTICES['vega:missions'].t;
   const h0=el.offsetHeight;
   await new Promise(r=>setTimeout(r,G.TYPE_MS*6));
   const shown=el.firstChild&&el.firstChild.textContent, rest=el.lastChild&&getComputedStyle(el.lastChild).visibility;
   const mid={ text:el.textContent, shown, rest, h:el.offsetHeight };
   dirty=true; render(); render();                     /* a repaint must not restart the typing */
   const afterRepaint=el.firstChild&&el.firstChild.textContent.length;
   G.typeSpeakDone(el);
   return { full, h0, mid, afterRepaint, end:{ text:el.textContent, spans:el.children.length } };
 });
 ok('a VEGA notice types out: the visible part grows, the rest is there but hidden',
    typed.mid.shown.length>0 && typed.mid.shown.length<typed.full.length && typed.full.indexOf(typed.mid.shown)===0 && typed.mid.rest==='hidden', typed);
 ok('...the element always holds the whole sentence and never changes height while typing',
    typed.mid.text===typed.full && typed.mid.h===typed.h0, typed);
 ok('...a repaint does not restart it, and it ends as plain text',
    typed.afterRepaint>=typed.mid.shown.length && typed.end.text===typed.full && typed.end.spans===0, typed);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 await b.close();
})();
