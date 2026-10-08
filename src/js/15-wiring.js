/* ============================ wiring ============================ */
/* desktop mouse-wheel scroll for the two sideways-scrolling tab rows (nav, #resTabs).
   Touch swipe already works via native overflow-x; this only adds a mouse path and a
   right-edge fade hint (.hs-more) for whichever direction has more to see. */
function hscroll(el){
  if(!el) return null;
  const upd=()=>{ el.classList.toggle("hs-more", el.scrollLeft+el.clientWidth < el.scrollWidth-2) };
  el.addEventListener("wheel",e=>{
    if(el.scrollWidth>el.clientWidth && Math.abs(e.deltaY)>Math.abs(e.deltaX)){
      el.scrollLeft+=e.deltaY; e.preventDefault();
    }
  },{passive:false});
  el.addEventListener("scroll",upd);
  upd();
  return upd;
}
/* Map sector swipe: a horizontal drag on #mapWrap past a small threshold moves one
   sector left/right (chips give the tap-target alternative). Guarded against firing
   on an ordinary tap (which must still reach a .mnode button underneath). */
(function(){
  const wrap=document.querySelector("#mapWrap"); if(!wrap)return;
  let x0=null, y0=null, moved=false;
  wrap.addEventListener("touchstart",e=>{
    /* patch627 (PLAN-page.md): guards on the page boolean now, not mapZoom
       directly - an unclaimed system's page (never zoomed) must refuse the
       swipe too, same as a held/zoomed one always did. */
    if(document.body.classList.contains("syspage"))return;
    if(e.touches.length!==1)return;
    x0=e.touches[0].clientX; y0=e.touches[0].clientY; moved=false;
  },{passive:true});
  wrap.addEventListener("touchmove",e=>{
    if(x0==null||!e.touches.length)return;
    if(Math.abs(e.touches[0].clientX-x0)>10)moved=true;
  },{passive:true});
  wrap.addEventListener("touchend",e=>{
    if(x0==null)return;
    const t=e.changedTouches&&e.changedTouches[0];
    if(t&&moved){
      const dx=t.clientX-x0, dy=t.clientY-y0;
      if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.4) setMapSec(mapSec+(dx<0?1:-1));
    }
    x0=null; y0=null; moved=false;
  },{passive:true});
})();
/* PLAN-fleets run 2 (decision 5, interaction "A"): with a fleet selected off the
   fleet bar, a node tap is a SEND target, not "open this system's page" - capture
   phase, so it runs and stopPropagation()s before buildMap()'s own per-node
   onclick (bubble phase) ever sees the click. Nothing here fires while no fleet
   is selected - the ordinary node tap (S.msel=id) is completely untouched. */
(function(){
  const nodes=document.querySelector("#mapNodes"); if(!nodes)return;
  nodes.addEventListener("click", e=>{
    const btn=e.target.closest(".mnode");
    const s=btn?SYSMAP[btn.dataset.s]:null;
    /* an enemy system goes straight to the attack prompt - with a fleet selected, or
       with one of the player's fleets already sitting there (owner's ask) */
    if(s&&sysContested(s)&&(flSel!=null||fleetAtSys(s.id))){
      e.stopPropagation();
      sendChipSys=null; sysPrompt(s.id);
      dirty=true; render();
      return;
    }
    if(flSel==null)return;
    e.stopPropagation();
    if(!btn)return;
    sendChipSys=btn.dataset.s; moveChipPos=null;
    dirty=true; render();
  }, true);
})();
/* tapping open space with a fleet selected puts a MOVE chip there (owner's ask) -
   the strip's own close button deselects. The sector chips/swipe are untouched,
   they are not inside #mapWrap so this never intercepts them either. */
(function(){
  const wrap=document.querySelector("#mapWrap"); if(!wrap)return;
  wrap.addEventListener("click", e=>{
    if(flSel==null)return;
    if(e.target.closest(".mnode")||e.target.closest(".sendchip")||e.target.closest(".enmark")||e.target.closest("#flBanner"))return;
    const r=wrap.getBoundingClientRect(); if(!r.width||!r.height)return;
    const x=(e.clientX-r.left)/r.width*100, y=(e.clientY-r.top)/r.height*100;
    if(!isFinite(x)||!isFinite(y)||x<0||x>100||y<0||y>100)return;
    moveChipPos={sec:mapSec,x,y}; sendChipSys=null;
    dirty=true; render();
  });
})();
/* patch627 (PLAN-page.md): map background tap-to-close (patch595) is deleted
   outright here, not redirected - `‹ MAP` (now shown on any page, held or
   not - see its own CSS comment near #mapChips) is the one closing affordance,
   full stop. This was the last of the plan's named old close paths (X and the
   grab handle went in patch626; sector change and the tab-change zoom-clear are
   deleted just below). */
const navHsUpd=hscroll(document.querySelector("nav"));

/* #view is one scroller shared by every pane, so without this each page inherits a
   scroll position that belongs to a different page. Remember one per pane instead. */
const paneScroll={};
function paneNeedsTop(id){
  /* a page carrying something urgent opens at the top, whatever you left it at */
  return id==="p-raid" && thq().length>0;
}
/* the Market pane's "Records & graphs" link - the only way to reach the Stats pane
   now that it has no tab of its own (see patch563). Mirrors the tab click handler's
   scroll-position bookkeeping so returning to Market (by tapping its still-"on" tab)
   lands where it was left. */
function openStatsPane(){
  const view=$("#view");
  const from=$$(".pane").find(x=>x.classList.contains("on"));
  if(view&&from)paneScroll[from.id]=view.scrollTop;
  $$(".pane").forEach(x=>x.classList.remove("on"));
  $("#p-ach").classList.add("on");
  dirty=true; render();
  if(view){
    const to=paneScroll["p-ach"]||0;
    try{ view.scrollTo({top:to, behavior:"instant"}) }catch(_){ view.scrollTop=to }
  }
}
$("#mktStatsLink").onclick=openStatsPane;
/* the Achievements pane's way back: the Market tab's own click, so scroll memory and
   everything else it does apply unchanged */
$("#achBack").onclick=()=>gotoTab("p-mkt");
/* Market refresh: #nav scrolls sideways at 390px and its right edge fades out
   (hs-more), which left the last tab reading "MARKE" when selected. Bring the chosen
   tab fully clear of that 28px fade. */
function navReveal(t){
  const nav=t&&t.parentElement; if(!nav||nav.scrollWidth<=nav.clientWidth)return;
  const nr=nav.getBoundingClientRect(), tr=t.getBoundingClientRect();
  if(tr.right>nr.right-28) nav.scrollLeft+=tr.right-(nr.right-28);
  else if(tr.left<nr.left+10) nav.scrollLeft-=(nr.left+10)-tr.left;
  if(navHsUpd)navHsUpd();   /* drop the fade now if that reached the end, not a scroll event later */
}
$$(".tab").forEach(t=>t.onclick=()=>{
  const view=$("#view");
  const from=$$(".pane").find(x=>x.classList.contains("on"));
  /* patch628b: a system page is just another pane's own scroll position now,
     captured/restored exactly like p-raid or anything else here - patch627's
     own guard (skip capturing p-map while a page was open) compensated for its
     transition-based scroll-reset rule, which the coordinator overruled (see
     syncSysPage()'s own comment); keeping the guard without that rule would
     have left p-map unable to remember its scroll at all. */
  if(view&&from)paneScroll[from.id]=view.scrollTop;
  $$(".tab").forEach(x=>x.classList.remove("on"));
  $$(".pane").forEach(x=>x.classList.remove("on"));
  t.classList.add("on"); t.classList.remove("alert"); navReveal(t);
  const id=t.dataset.p;
  if(id!=="p-map")fleetDeselect();   /* PLAN-fleets run 2: leaving the map deselects */
  $("#"+id).classList.add("on");
  /* a routine VEGA banner that points at this very tab has done its job once the
     player opens it - clear it rather than leave it covering the tab's own list */
  const fk=S.notifyQueue&&S.notifyQueue[0], fv=fk&&fk.indexOf("vega:")===0&&VEGA[fk.slice(5)];
  if(fv&&fv.go===id&&!noticeIsStory(fk))dismissNotice();
  dirty=true; render();
  if(view){
    const to = paneNeedsTop(id) ? 0 : (paneScroll[id]||0);
    /* grids, the tree canvas and the map settle over more than one frame, so reassert
       once after they have */
    /* instant, not smooth: #view animates scrollTop by default, and an animation in
       flight is indistinguishable from a broken reset */
    const jump=()=>{ try{ view.scrollTo({top:to, behavior:"instant"}) }
                     catch(_){ view.scrollTop=to } };
    jump();
    requestAnimationFrame(jump);
  }
});
$$(".rmbtn[data-rd]").forEach(b=>b.onclick=()=>{
  raidMode=b.dataset.rd; syncRaidMode(); dirty=true; render();
});
$$(".chip[data-b]").forEach(c=>c.onclick=()=>{
  S.buy = c.dataset.b==="max"?"max":parseInt(c.dataset.b,10);
  syncChips(); dirty=true; render();
});
function syncChips(){
  const key=S.buy==="max"?"max":String(S.buy);
  $$(".chip[data-b]").forEach(x=>x.classList.toggle("on",x.dataset.b===key));
  $$(".scrapc").forEach(x=>x.classList.toggle("on",!!S.sell));
}
$$(".scrapc").forEach(b=>b.onclick=()=>{ S.sell=S.sell?0:1; syncChips(); dirty=true; render(); });
/* patch636: the Market's own AMOUNT row - data-mb, not data-b, so the block above never
   sees these buttons and this one never sees the buildings/Nexus ones. Own state
   (mktBuy), own sync (syncMktChips(), same shape as syncChips() but scoped to
   [data-mb]/mktBuy only), own direct render (renderMarket(), not the generic render()
   the buildings chips use - see mktBuy's own comment above for why). */
/* Market refresh: data-mb is a percent of the card's surplus now (10/25/50/100). */
$$(".chip[data-mb]").forEach(c=>c.onclick=()=>{
  mktBuy = parseInt(c.dataset.mb,10)||25;
  syncMktChips(); renderMarket();
});
function syncMktChips(){
  const key=String(mktBuy);
  $$(".chip[data-mb]").forEach(x=>{ const on=x.dataset.mb===key;
    x.classList.toggle("on",on); x.setAttribute("aria-pressed",on?"true":"false"); });
}
$("#runlbl").onclick=()=>{ if(pendingLevels()>0)lvModal(); else lvSummary(); };
$("#avatar").onclick=$("#runlbl").onclick;
$("#scan").addEventListener("click",e=>doScan(e));
$("#sshScan").addEventListener("click",e=>doScan(e));
addEventListener("keydown",e=>{
  if(e.code==="Space"&&!$("#mask").classList.contains("on")){e.preventDefault();doScan(null)}
});
$("#btnMute").onclick=()=>{ S.muted=!S.muted; $("#btnMute").textContent=S.muted?"♪̸":"♪"; };
function saveCode(){ return btoa(unescape(encodeURIComponent(pack()))) }
function copyCode(txt){
  try{navigator.clipboard.writeText(txt)}catch(e){}
  try{const ta=$("#mCode"); if(ta){ta.select();document.execCommand("copy")}}catch(e){}
  toast("Save code copied to clipboard","g");
}
function restartDialog(){
  const st=tot(), dm=fmt(S.dmAll);
  showModal(`<h3>Restart from scratch?</h3>
    <p>This wipes <b>everything</b> and starts a brand new game.</p>
    <div class="wipebox">
      <div class="wr"><span>Level</span><b>${level()}</b></div>
      <div class="wr"><span>Structures</span><b>${fmt(st)}</b></div>
      <div class="wr"><span>All-time ore</span><b>${fmt(S.all)} ${RI('ore')}</b></div>
      <div class="wr"><span>Dark Matter earned</span><b>${dm} ${RI('dm')}</b></div>
      <div class="wr"><span>Research nodes</span><b>${Object.values(S.rs).reduce((a,b)=>a+b,0)}</b></div>
      <div class="wr"><span>Records</span><b>${Object.keys(S.ac).length}/${ACHS.length}</b></div>
    </div>
    <p style="margin-top:10px">All of the above is lost permanently. If you might want it back, grab a backup code first — you can paste it into Load Code later.</p>
    <div class="row"><button id="wBack">COPY BACKUP CODE</button></div>
    <div class="row"><button id="wNo">KEEP MY EMPIRE</button><button id="wYes" class="warn" disabled>RESTART</button></div>
    <div class="wnote" id="wNote">Hold on a moment…</div>`,()=>{
      $("#wBack").onclick=()=>copyCode(saveCode());
      $("#wNo").onclick=hideModal;
      const yes=$("#wYes"), note=$("#wNote");
      let t=3; note.textContent="RESTART unlocks in "+t+"…";
      const iv=setInterval(()=>{ t--;
        if(!document.body.contains(yes)){clearInterval(iv);return}
        if(t<=0){ clearInterval(iv); yes.disabled=false; note.textContent="This cannot be undone."; }
        else note.textContent="RESTART unlocks in "+t+"…";
      },1000);
      yes.onclick=()=>{
        clearInterval(iv); Store.del(KEY); S=fresh(); LF=null; mapViewReset(); hideModal();
        renderAll(); playOpening(); save();
        toast("New game started. Good luck out there.","g");
      };
    });
}
$("#btnSave").onclick=()=>{
  save();
  showModal(`<h3>Save &amp; Restart</h3>
    <p>${Store.available?"Progress auto-saves in this browser every 15 seconds.":"Browser storage is unavailable here — copy this code to keep your progress."}</p>
    <textarea id="mCode" spellcheck="false">${saveCode()}</textarea>
    <div class="row"><button id="mCopy">COPY CODE</button><button id="mLoad">LOAD CODE</button></div>
    <div class="row"><button id="mWipe" class="warn">RESTART GAME…</button><button id="mClose">CLOSE</button></div>
    <p class="mhint">Restart wipes everything and begins a new game. There is no way back, so export a save code first if you might want it.</p>`,()=>{
      $("#mClose").onclick=hideModal;
      $("#mCopy").onclick=()=>copyCode($("#mCode").value);
      $("#mLoad").onclick=()=>{
        try{ const o=JSON.parse(decodeURIComponent(escape(atob($("#mCode").value.trim()))));
          if(adopt(o)){ hideModal(); LF=null; mapViewReset(); lfSettleMarkOnLoad();
            renderAll(); offlineReport(); save(); toast("Save loaded","g"); }
          else toast("That code didn't parse.");
        }catch(e){ toast("That code didn't parse.") }
      };
      $("#mWipe").onclick=restartDialog;
    });
};
$$(".rcard[data-res]").forEach(b=>b.onclick=()=>resourceModal(b.dataset.res));
$("#svChip").onclick=()=>resourceModal("sv");
$("#ctxCard").onclick=()=>{ if(exoEverBankedAny())exoModal(); };   /* patch630 */
$("#btnRefreshCrew").onclick=()=>{ if(!refreshCrewPool())blip(140,.08,"sine",.03) };
$("#noticeX").onclick=dismissNotice;
$("#notice").onclick=(e)=>{ if(e.target.id==="notice")dismissNotice(); };  /* patch629: backdrop tap = dismiss */
$("#noticeGo").onclick=()=>{
  const key=S.notifyQueue&&S.notifyQueue[0], n=key&&NOTICES[key];
  /* polish batch A #4: vega:raids' own go switches to the Raids tab. If a level is
     already pending, dismissNotice() below immediately shows the lvClaim notice
     card next (and from there its own GO opens the perk-pick modal) - racing the
     tab switch and, on a small screen, looking like it never happened. Navigate
     first for this one beat so the tab change always wins, then let the queue
     advance as normal. Every other beat keeps the old dismiss-then-go order. */
  if(key==="vega:raids" && n&&n.go){ n.go(); dismissNotice(); return; }
  dismissNotice();
  if(n&&n.go)n.go();
};
const mqNarrow=matchMedia("(max-width:760px)");
mqNarrow.addEventListener("change",()=>{ resize(); });
/* patch612: the #core widget's own re-parent-on-breakpoint and show/hide/site-
   toggle functions are gone with the widget. S.site's own out-of-range sanitising
   (the one useful check either of them did at runtime) moved to adopt() below,
   the only place that still needs it now - see PLAN-unify.md's own note that
   adopt() keeps sanitising S.core/S.site. */
$("#mask").onclick=e=>{ if(e.target.id==="mask")hideModal() };
addEventListener("beforeunload",save);
/* b646: coming BACK is the half that was missing. requestAnimationFrame stops
   while the tab is hidden (phone locked, app switched) and frame() caps dt at
   .25s, so every timer - fleet travel above all - simply froze for the whole
   absence and read as "stuck". Under a minute: replay the gap through tick() in
   1s steps (the same call csim4.js makes). A minute or more: the ordinary
   offlineReport() catch-up, exactly as a reload would have done. Skipped while a
   fight is open - bUpdate()/defUpdate() own that clock. */
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){ save(); return }
  lastT=performance.now();
  if(BT||DT)return;
  const away=(Date.now()-(S.last||Date.now()))/1000;
  if(away<2)return;
  if(away>=60){ offlineReport(); }
  else { for(let i=0;i<Math.floor(away);i++)tick(1); }
  dirty=true; render(); save();
});

