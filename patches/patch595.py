import io

"""patch595 - PLAN-defences.md Run 1, item 2: the system sheet.

Moves the Map tab's in-flow #sysInfo/#sysAct panel into a bottom sheet
(#sysSheet) that slides up over the map when a system is selected (S.msel),
instead of sitting below it where every fortify/claim/assault needed a scroll.
NO GAMEPLAY CHANGE: claim, assault, en-route/ENGAGE and fortify are the exact
same branches of renderMap()'s tail, doing the exact same DOM writes into the
same two ids (#sysInfo/#sysAct) with the same dataset.h dirty-guard - they are
simply now children of the sheet instead of the pane's in-flow content. The one
new thing is a 4th state the old panel never had at all: "under attack", a red
block (rival, clock, DEFEND IT / LET THEM HOLD) that calls the exact same
startDefence()/holdLine() the Raids tab's #thrCard already calls - a second
entry point onto the identical functions PLAN-defences.md's "no gameplay
change" line asks for by name ("defend/hold threat choices ... just live in
the sheet"), not a second mechanism. Doctrine text and the "rises to n%"
rearm preview (Sensor Mast) and STATION FLEET (Hangar) are later-run features
(597-600) that do not exist yet - the under-attack block omits them on
purpose; see HANDOVER.

Pieces:
- CSS: #sysSheet (fixed, bottom:0, translateY slide, safe-area padding, its
  own max-height + overflow-y so it scrolls internally rather than the page),
  .sshgrab (drag handle) and .sshx (the close button) - #sysInfo drops its own
  card border/background/padding now that the sheet supplies the outer box.
- HTML: #sysInfo/#sysAct move inside a new #sysSheet, alongside the grab
  handle, the close button and a new (empty until needed) #sysThreat div
  placed BEFORE #sysInfo so the threat block reads at the top of the sheet,
  per the plan's card order.
- JS (renderMap()'s tail): the "nothing selected" branch now closes the sheet
  (classList.remove("open")) instead of writing a "tap a system" hint into
  #sysInfo (the hint is redundant once the sheet is hidden entirely - the
  pane's own top-of-page <p class="hint"> already says this); a selection
  opens it. The under-attack block is new, appended after the existing
  held/fortify branch, using its own dataset.h guard (key = threat id + the
  rounded odds, since that is the only thing that can change the button
  label between two frames) with the countdown text refreshed every call
  exactly like the fortify/trip countdowns already do.
- JS (two small setup blocks, next to the existing map-sector-swipe IIFE):
  tapping #mapWrap outside a .mnode closes the sheet (a tap ON a node is left
  alone - its own onclick re-selects, which must re-render the sheet for the
  new system, not close it); a pointer-based drag on .sshgrab closes it past
  a 70px threshold, snapping back otherwise. The X button does the same as
  the outside-tap close: S.msel=null.

KNOWN TEST-SUITE INTERACTION: tmap2.js and tchurn2.js read #sysInfo/#sysAct
directly and will keep working unchanged (same ids, same guarded content) -
patch596 adds the sheet-specific coverage (open/close/four states/no churn)
and updates any assertion that reached for the old "nothing selected" hint
text, per its own HANDOVER note."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---------------- CSS ----------------
old_css=(
'#sysInfo{border:1px solid var(--line);border-radius:12px;padding:12px;background:rgba(255,255,255,.03)}\n'
'#sysInfo h4{margin:0;font:700 15px/1.2 system-ui}\n'
)
assert h.count(old_css)==1
new_css=(
'/* ---------- system sheet (patch595): bottom sheet over the map, replaces the\n'
'   old in-flow panel - #sysInfo/#sysAct keep their ids and guarded-render idiom,\n'
'   just live inside a sliding sheet now. Sits above the map (no z-index of its\n'
'   own needed there) but below any modal/scene overlay (.mask 20, .scene 52). */\n'
'#sysSheet{position:fixed;left:0;right:0;bottom:0;z-index:15;max-width:1360px;margin:0 auto;\n'
'  border-radius:16px 16px 0 0;border:1px solid var(--line2);border-bottom:none;\n'
'  background:linear-gradient(180deg,#101637,#0a0e24);box-shadow:0 -14px 34px -6px rgba(0,0,0,.6);\n'
'  padding:6px 14px calc(14px + env(safe-area-inset-bottom, 0px));\n'
'  max-height:58vh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;\n'
'  transform:translateY(110%);transition:transform .26s cubic-bezier(.22,.8,.32,1);pointer-events:none}\n'
'#sysSheet.open{transform:translateY(0);pointer-events:auto}\n'
'#sysSheet.dragging{transition:none}\n'
'.sshgrab{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.22);\n'
'  margin:2px auto 6px;cursor:grab;touch-action:none}\n'
'.sshx{position:absolute;top:10px;right:12px;border:1px solid var(--line);border-radius:8px;\n'
'  width:26px;height:26px;background:rgba(255,255,255,.05);color:var(--mut);\n'
'  font:700 12px/1 system-ui;cursor:pointer}\n'
'.sshx:hover{color:var(--txt);border-color:var(--line2)}\n'
'#sysInfo h4{margin:0;font:700 15px/1.2 system-ui}\n'
)
assert new_css!=old_css
h=h.replace(old_css,new_css,1)

# ---------------- HTML ----------------
old_html=(
'        <div id="sysInfo"></div>\n'
'        <div id="sysAct"></div>\n'
)
assert h.count(old_html)==1
new_html=(
'        <div id="sysSheet">\n'
'          <div class="sshgrab" id="sshGrab"></div>\n'
'          <button type="button" class="sshx" id="sshClose" aria-label="Close">✕</button>\n'
'          <div id="sysThreat" hidden></div>\n'
'          <div id="sysInfo"></div>\n'
'          <div id="sysAct"></div>\n'
'        </div>\n'
)
h=h.replace(old_html,new_html,1)

# ---------------- JS: renderMap() head - open/close the sheet ----------------
old_head=(
'  const info=$("#sysInfo"), act=$("#sysAct"); if(!info)return;\n'
'  const s=S.msel?SYSMAP[S.msel]:null;\n'
'  if(!s){\n'
'    const ih0=\'<div class="sysd" style="margin:0">Tap a system to inspect it.\\n    Green links are yours.</div>\';\n'
'    if(info.dataset.h!==ih0){ info.dataset.h=ih0; info.innerHTML=ih0 }\n'
'    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }\n'
'    return;\n'
'  }\n'
)
assert h.count(old_head)==1
new_head=(
'  const sheet=$("#sysSheet"), info=$("#sysInfo"), act=$("#sysAct"), thrBox=$("#sysThreat");\n'
'  if(!info)return;\n'
'  const s=S.msel?SYSMAP[S.msel]:null;\n'
'  if(!s){\n'
'    if(sheet)sheet.classList.remove("open");\n'
'    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }\n'
'    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }\n'
'    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n'
'    return;\n'
'  }\n'
'  if(sheet)sheet.classList.add("open");\n'
)
assert new_head!=old_head
h=h.replace(old_head,new_head,1)

# ---------------- JS: renderMap() tail - the new "under attack" block ----------------
old_tail=(
'    if(q){\n'
'      const cd=act.querySelector(".fortcd");\n'
'      if(cd)cd.textContent=Math.max(0,Math.ceil((q.dueAt-Date.now())/1000))+"s";\n'
'    }\n'
'  }\n'
'}\n'
'function renderLevel(){\n'
)
assert h.count(old_tail)==1
new_tail=(
'    if(q){\n'
'      const cd=act.querySelector(".fortcd");\n'
'      if(cd)cd.textContent=Math.max(0,Math.ceil((q.dueAt-Date.now())/1000))+"s";\n'
'    }\n'
'  }\n'
'  /* patch595: under attack - the 4th sheet state. Only a held system (home\n'
'     included) can carry a queued threat (thqAtSys()) - same DEFEND IT / LET\n'
'     THEM HOLD choice the Raids tab\'s #thrCard already offers, calling the\n'
'     exact same startDefence()/holdLine(); this is a second entry point onto\n'
'     those, not a second mechanism, so holdOdds() stays the one true number. */\n'
'  if(thrBox){\n'
'    const th=held?thqAtSys(s.id):null;\n'
'    if(!th){\n'
'      if(thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n'
'    } else {\n'
'      const trv=RIVALMAP[th.rv], tod=Math.round(holdOdds(th)*100), tkey=th.id+"|"+tod;\n'
'      thrBox.hidden=false;\n'
'      if(thrBox.dataset.h!==tkey){\n'
'        thrBox.dataset.h=tkey;\n'
'        thrBox.innerHTML=`<div class="thrc${th.t<3600?" soon":""}">\n'
'          <h5>UNDER ATTACK<span class="thrt" id="sshThrCd">${thqClock(th.t)} left</span></h5>\n'
'          <div class="who" style="color:${trv?trv.col:"var(--rd)"}">${trv?trv.n:"Hostiles"}</div>\n'
'          <button class="thrgo" id="sshThrGo">DEFEND IT</button>\n'
'          <button class="thrhold" id="sshThrHold">LET THEM HOLD \\u00b7 ${tod}%</button>\n'
'        </div>`;\n'
'        $("#sshThrGo").onclick=()=>{ startDefence(th.id); };\n'
'        $("#sshThrHold").onclick=()=>{ holdLine(th.id); };\n'
'      }\n'
'      const tcd=thrBox.querySelector("#sshThrCd"); if(tcd)tcd.textContent=thqClock(th.t)+" left";\n'
'    }\n'
'  }\n'
'}\n'
'function renderLevel(){\n'
)
assert new_tail!=old_tail
h=h.replace(old_tail,new_tail,1)

# ---------------- JS: close the sheet by X, drag-down, or tapping the map
#      outside it - dropped next to the existing map-sector-swipe IIFE, the
#      one other gesture handler already living on #mapWrap. ----------------
anchor_swipe=(
'    x0=null; y0=null; moved=false;\n'
'  },{passive:true});\n'
'})();\n'
'const navHsUpd=hscroll(document.querySelector("nav"));\n'
)
assert h.count(anchor_swipe)==1
sheet_gestures='''    x0=null; y0=null; moved=false;
  },{passive:true});
})();
/* system sheet close gestures (patch595): the X button, a tap on the map
   outside the sheet (a tap ON a node is left to its own onclick, which must
   re-render the sheet for the newly-selected system, not close it), and a
   pointer-drag on the grab handle past a small threshold - snaps back under
   the threshold, exactly like the "tap vs swipe" guard above it. */
$("#sshClose").onclick=()=>{ S.msel=null; dirty=true; render(); };
(function(){
  const wrap=document.querySelector("#mapWrap"); if(!wrap)return;
  wrap.addEventListener("click",e=>{
    if(!S.msel)return;
    if(e.target.closest&&e.target.closest(".mnode"))return;
    S.msel=null; dirty=true; render();
  });
})();
(function(){
  const sheet=document.querySelector("#sysSheet"), grab=document.querySelector("#sshGrab");
  if(!sheet||!grab)return;
  let y0=null, dy=0, dragging=false;
  grab.addEventListener("pointerdown",e=>{
    if(!sheet.classList.contains("open"))return;
    y0=e.clientY; dy=0; dragging=true; sheet.classList.add("dragging");
  });
  grab.addEventListener("pointermove",e=>{
    if(!dragging||y0==null)return;
    dy=Math.max(0,e.clientY-y0); sheet.style.transform="translateY("+dy+"px)";
  });
  const release=()=>{
    if(!dragging)return;
    dragging=false; sheet.classList.remove("dragging"); sheet.style.transform="";
    if(dy>70){ S.msel=null; dirty=true; render(); }
    y0=null; dy=0;
  };
  grab.addEventListener("pointerup",release);
  grab.addEventListener("pointercancel",release);
})();
const navHsUpd=hscroll(document.querySelector("nav"));
'''
h=h.replace(anchor_swipe,sheet_gestures,1)

# BUILD bump
old_build="const BUILD=594;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=595;")

io.open(F,"w",encoding="utf-8").write(h)
print("patch595 applied")
