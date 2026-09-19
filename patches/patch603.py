#!/usr/bin/env python3
"""
patch603 — PLAN-zoom.md, patch 2/3: the map zoom view.

Tapping a claimed system node on the Map tab cross-fades the map square into
that system's planet scene (drawSysScene()/sprite(), extracted in patch602),
with a `‹ MAP` back button and the system's name top-centre - mock state A
("map becomes planet"), the owner-approved look. Unclaimed systems still just
open the sheet, map untouched.

New runtime-only state `mapZoom` (a system id or null - never saved, see
fresh()/adopt() untouched): which system the map is currently zoomed into, if
any. Every place it changes funnels through one function, `setMapZoom()`, that
only toggles a class and sets one element's textContent - the back button and
name live in the STATIC markup below, created once, never rebuilt by
renderMap() (tchurn2's whole reason for existing).

Five things need to know about zoom, per the plan's "watch for":
  - node tap (buildMap()'s b.onclick) - opens zoom for a claimed system,
    closes it otherwise
  - the back button - closes zoom only, leaves the sheet open
  - the three sheet-close paths (X, tap-outside, swipe-down-the-grab-handle) -
    closing the sheet closes zoom too
  - setMapSec() - changing sector closes zoom
  - the tab-click handler - leaving the Map tab closes zoom
...plus the sector-swipe IIFE, guarded off while zoomed (its own gesture would
be invisible anyway - the map layers are faded out - but per the plan it must
not fire at all), and draw(), which now also drives a second canvas
(#mapZoom) through the very same drawSysScene()/sprite() the Empire tab's
#orb already uses - only one of the two is ever visible at once (#core is
display:none off the Empire tab; #mapWrap is display:none off the Map tab),
so this is not a second render loop, just a second cheap resize+draw call
gated on that canvas actually being on screen AND zoomed.

Sprite/settlement-light legibility at this larger size is patch604, not here -
drawSysScene()/sprite() are called exactly as patch602 left them.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------- markup: #mapZoom canvas + static back-bar ----------------
do(
    '        <div id="mapWrap"><canvas id="mapBg" width="600" height="600"></canvas><svg id="mapLinks" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>\n'
    '          <div id="mapNodes"></div><div id="mapEdge"></div></div>',
    '        <div id="mapWrap"><canvas id="mapBg" width="600" height="600"></canvas><svg id="mapLinks" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>\n'
    '          <div id="mapNodes"></div><div id="mapEdge"></div><canvas id="mapZoom"></canvas>\n'
    '          <div id="mapZoomBar"><button type="button" id="mapZoomBack">&lsaquo; MAP</button><div id="mapZoomName"></div></div></div>',
    label="mapWrap markup",
)

# ---------------- CSS: cross-fade + back-bar look ----------------
do(
    '#mapEdge{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
    '#mapEdge{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}\n'
    '/* patch603: map zoom - the map square becomes the tapped system\'s planet scene.\n'
    '   #mapZoom/#mapZoomBar are static markup (see #mapWrap above), created once - opened\n'
    '   or closed purely by toggling #mapWrap.zoomed and setting #mapZoomName\'s text, see\n'
    '   setMapZoom(). Cross-fades with the ordinary map layers rather than swapping\n'
    '   display, so tapping in and tapping "‹ MAP" back out both read as one move. */\n'
    '#mapBg,#mapLinks,#mapNodes,#mapEdge{transition:opacity .28s ease}\n'
    '#mapWrap.zoomed #mapBg,#mapWrap.zoomed #mapLinks,#mapWrap.zoomed #mapNodes,#mapWrap.zoomed #mapEdge{\n'
    '  opacity:0;pointer-events:none}\n'
    '#mapZoom{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;\n'
    '  pointer-events:none;transition:opacity .28s ease}\n'
    '#mapWrap.zoomed #mapZoom{opacity:1;pointer-events:auto}\n'
    '#mapZoomBar{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:7px;\n'
    '  padding:8px 8px;z-index:6;background:linear-gradient(180deg,rgba(4,6,16,.85),rgba(4,6,16,0));\n'
    '  opacity:0;pointer-events:none;transition:opacity .2s ease}\n'
    '#mapWrap.zoomed #mapZoomBar{opacity:1;pointer-events:auto}\n'
    '#mapZoomBack{border:1px solid var(--line2);background:rgba(8,12,30,.8);color:var(--mut);\n'
    '  border-radius:6px;padding:5px 9px;cursor:pointer;font:700 11px/1 system-ui;letter-spacing:.12em;flex:none}\n'
    '#mapZoomBack:hover{color:var(--txt);border-color:var(--cy)}\n'
    '#mapZoomName{flex:1;text-align:center;font:700 11px/1 system-ui;letter-spacing:.14em;color:var(--txt);\n'
    '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:34px}',
    label="mapWrap CSS",
)

# ---------------- JS: mapZoom state, resize plumbing, setMapZoom() ----------------
do(
    'document.addEventListener("visibilitychange",()=>{ if(!document.hidden)ox=null });',
    'document.addEventListener("visibilitychange",()=>{ if(!document.hidden)ox=null });\n'
    '/* patch603: map zoom canvas - same per-frame drawSysScene()/sprite() as #orb, on its\n'
    '   own context/size, since only one of #orb (Empire tab) / #mapZoom (Map tab, zoomed)\n'
    '   is ever visible at a time - see draw(). `mapZoom` itself (a system id, or null) is\n'
    '   runtime-only and never saved: a reload always comes back on the plain map. */\n'
    'let mapZoom=null;\n'
    'const mapZoomCv=$("#mapZoom"); let mzx=null, MZW=0, MZH=0, mzChk=0;\n'
    'function mapZoomResize(){\n'
    '  if(!mapZoomCv||!mapZoomCv.offsetParent){mzx=null;return}\n'
    '  const w=Math.round(mapZoomCv.clientWidth*devicePixelRatio),\n'
    '        h=Math.round(mapZoomCv.clientHeight*devicePixelRatio);\n'
    '  if(w<8||h<8){mzx=null;return}\n'
    '  if(mapZoomCv.width!==w)mapZoomCv.width=w;\n'
    '  if(mapZoomCv.height!==h)mapZoomCv.height=h;\n'
    '  MZW=mapZoomCv.width; MZH=mapZoomCv.height;\n'
    '  mzx=mapZoomCv.getContext("2d");\n'
    '}\n'
    'if(window.ResizeObserver) new ResizeObserver(()=>{mzx=null}).observe(mapZoomCv);\n'
    'addEventListener("pageshow",()=>{mzx=null});\n'
    'document.addEventListener("visibilitychange",()=>{ if(!document.hidden)mzx=null });\n'
    '/* the one place zoom state actually changes - node taps, the back button, the sheet-\n'
    '   close paths, sector change and tab change all funnel through this, so the static\n'
    '   bar markup above is only ever toggled/re-texted, never rebuilt (tchurn2). */\n'
    'function setMapZoom(id){\n'
    '  mapZoom=id;\n'
    '  const wrap=$("#mapWrap"); if(wrap)wrap.classList.toggle("zoomed",!!id);\n'
    '  const nameEl=$("#mapZoomName");\n'
    '  if(nameEl){ const s=id?SYSMAP[id]:null; nameEl.textContent=s?s.n.toUpperCase():""; }\n'
    '}\n'
    '$("#mapZoomBack").onclick=()=>{ setMapZoom(null); dirty=true; render(); };',
    label="mapZoom state block",
)

# ---------------- node tap: open zoom for a claimed system ----------------
do(
    'b.onclick=()=>{ S.msel=s.id; dirty=true; render(); };',
    'b.onclick=()=>{ S.msel=s.id; setMapZoom((sysHeld(s.id)||sysOccupied(s.id))?s.id:null); dirty=true; render(); };',
    label="buildMap node onclick",
)

# ---------------- setMapSec: sector change closes zoom ----------------
do(
    'function setMapSec(n){\n'
    '  n=Math.max(0,Math.min(SECTORS.length-1,n));\n'
    '  if(n===mapSec)return;\n'
    '  mapSec=n; mapSecBuilt=-1; dirty=true; render();\n'
    '}',
    'function setMapSec(n){\n'
    '  n=Math.max(0,Math.min(SECTORS.length-1,n));\n'
    '  if(n===mapSec)return;\n'
    '  setMapZoom(null);\n'
    '  mapSec=n; mapSecBuilt=-1; dirty=true; render();\n'
    '}',
    label="setMapSec",
)

# ---------------- sheet-close path 1: X button ----------------
do(
    '$("#sshClose").onclick=()=>{ S.msel=null; dirty=true; render(); };',
    '$("#sshClose").onclick=()=>{ S.msel=null; setMapZoom(null); dirty=true; render(); };',
    label="sshClose",
)

# ---------------- sheet-close path 2: tap outside the sheet ----------------
do(
    '  wrap.addEventListener("click",e=>{\n'
    '    if(!S.msel)return;\n'
    '    if(e.target.closest&&e.target.closest(".mnode"))return;\n'
    '    S.msel=null; dirty=true; render();\n'
    '  });',
    '  wrap.addEventListener("click",e=>{\n'
    '    if(!S.msel)return;\n'
    '    /* the back button (and its bar) live inside #mapWrap too - a tap there must only\n'
    '       reach its own onclick (close zoom), not also fall through and close the sheet. */\n'
    '    if(e.target.closest&&(e.target.closest(".mnode")||e.target.closest("#mapZoomBar")))return;\n'
    '    S.msel=null; setMapZoom(null); dirty=true; render();\n'
    '  });',
    label="tap-outside close",
)

# ---------------- sheet-close path 3: swipe-down the grab handle ----------------
do(
    '    if(dy>70){ S.msel=null; dirty=true; render(); }',
    '    if(dy>70){ S.msel=null; setMapZoom(null); dirty=true; render(); }',
    label="swipe-down close",
)

# ---------------- tab change: leaving the Map tab closes zoom ----------------
do(
    '  const id=t.dataset.p;\n'
    '  $("#"+id).classList.add("on");',
    '  const id=t.dataset.p;\n'
    '  if(id!=="p-map")setMapZoom(null);\n'
    '  $("#"+id).classList.add("on");',
    label="tab click handler",
)

# ---------------- sector-swipe IIFE: off while zoomed ----------------
do(
    '  wrap.addEventListener("touchstart",e=>{\n'
    '    if(e.touches.length!==1)return;\n'
    '    x0=e.touches[0].clientX; y0=e.touches[0].clientY; moved=false;\n'
    '  },{passive:true});',
    '  wrap.addEventListener("touchstart",e=>{\n'
    '    if(mapZoom)return;\n'
    '    if(e.touches.length!==1)return;\n'
    '    x0=e.touches[0].clientX; y0=e.touches[0].clientY; moved=false;\n'
    '  },{passive:true});',
    label="sector swipe guard",
)

# ---------------- draw(): route to the zoom canvas too ----------------
do(
    '''  if(ox&&OW&&S.site!=null&&SITE[S.site]){ drawSite(t,devicePixelRatio) }
  else if(ox&&OW){
    const evs=S.site==null?empViewSys():null;
    const vid=evs?evs.id:"home";
    drawSysScene(ox,OW,OH,vid,t,devicePixelRatio);
  }
  requestAnimationFrame(draw);''',
    '''  if(ox&&OW&&S.site!=null&&SITE[S.site]){ drawSite(t,devicePixelRatio) }
  else if(ox&&OW){
    const evs=S.site==null?empViewSys():null;
    const vid=evs?evs.id:"home";
    drawSysScene(ox,OW,OH,vid,t,devicePixelRatio);
  }
  // ---------- map zoom scene (patch603) ----------
  if(mzx===null || (++mzChk%20===0 &&
      (MZW!==Math.round(mapZoomCv.clientWidth*devicePixelRatio)
    || MZH!==Math.round(mapZoomCv.clientHeight*devicePixelRatio)))) mapZoomResize();
  if(mzx&&MZW&&mapZoom) drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio);
  requestAnimationFrame(draw);''',
    label="draw() zoom routing",
)

h = h.replace("const BUILD=602;", "const BUILD=603;", 1)
assert "const BUILD=603;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch603 applied OK")
