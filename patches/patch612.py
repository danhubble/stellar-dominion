#!/usr/bin/env python3
"""
patch612 (BUILD 612) - PLAN-unify.md Run 2, item 3: the big delete.

Removes exactly what the plan lists - #p-emp, #core, #orb, #coreTog, #orbBadge,
#siteHud (+ its #siteBack/#siteName/#siteCt children), placeCore, applyCore, orbResize
and its ResizeObserver, empSysRow, empAccordionTap, renderGens, empViewSys,
updateOrbBadge, empOpen - and nothing else. draw() keeps the starfield and the map-zoom
target only. S.core/S.site stay in the save shape untouched; adopt() already sanitises
them and is not touched here.

Before writing this, every one of those names was grepped for every reader, not just
writer - deleting a function is safe only once nothing still calls it, and frame()
swallowing an uncaught error into a toast (never a visible failure - see checkLevel's
own try/catch-to-toast pattern) means a stray caller would not show up as a loud crash,
only a silently broken frame loop. That audit found FOUR call sites the plan's own
bullet list doesn't name, because they are consequences of the deletions, not deletions
themselves - left alone, each one throws the moment it runs:
  - buyRes() (a Research purchase) called renderGens() directly, completely separately
    from render()'s own dirty branch (patch610 already stopped THAT call site, not this
    one) - dropped, dirty=true already schedules everything else that tick needs.
  - renderAll() - called from boot, restart, save-import, repair, every armoury
    purchase - is `renderGens(); dirty=true; render();` verbatim. Dropped to just
    `dirty=true; render();`, same replacement patch610 already established.
  - render()'s own unconditional `$("#siteCt").textContent=...` line (S.site's ORE
    ladder tier count, shown in the old #siteHud bar) - #siteCt no longer exists
    anywhere once #siteHud is gone. A save with S.site left set from before this run
    would hit this on the very first render() after load, not on some rare path -
    exactly the "load a real mid-game save" case. Dropped.
  - openSite()'s own applyCore() call - openSite() itself is NOT on the removal list
    (Run 3/patch615 reuses the S.site-toggle idea on the zoom canvas instead) and stays
    defined; only its now-dead applyCore() call comes out.
draw()'s own orb/site branch is the fifth: it read ox/OW/OH (orbResize()'s own state)
and called empViewSys() every single frame via requestAnimationFrame - by far the
easiest of these to have missed, since it never appears in any grep for the deleted
FUNCTION NAMES themselves except empViewSys, only in the surrounding branch that used
their return values.

A sixth was found only after this patch's first run: pcheck/the markup/JS deletions
above all passed, but tq2 then printed "PAGEERROR: ox is not defined" - three more
top-level `addEventListener` calls (pageshow, visibilitychange, and a plain resize
listener right after the render loop starts) existed purely to null out orbResize()'s
own `ox` on anything that could move or resize the box; the original grep for
orbResize/ResizeObserver never turned these up because they call neither by name, only
`ox` directly. They are dead the instant `ox` itself is gone (nothing still reads or
writes it outside the now-unreachable drawSite()/siteBG()/siteGhost()/siteUnit() family
- see HANDOVER), so they come out here too, not left dangling to throw on the next
resize/pageshow/tab-restore event.

drawSite()/drawSysScene()/SITE/openSite/sysOreRate()/empFurthestRing() are NOT on the
list and stay defined - the last two are currently unreachable now that empSysRow() is
gone (their only caller), same as renderGens() sat dead between patch610 and this one;
Run 3's LIST view (patch614) is what reuses them next, per the plan's own item 3.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=611;", "const BUILD=612;", label="BUILD bump")

# ---------------------------------------------------------------- CSS: #core family
do(
    '#core{position:relative;flex:0 0 auto;width:100%;aspect-ratio:1/1;max-height:230px;border-radius:14px;\n'
    '  border:1px solid var(--line);overflow:hidden;background:radial-gradient(circle at 50% 55%,rgba(40,60,140,.35),rgba(4,6,16,.9) 70%)}\n'
    '#core canvas{position:absolute;inset:0;width:100%;height:100%}\n'
    '#siteHud{position:absolute;left:0;right:0;top:0;display:none;align-items:center;gap:7px;\n'
    '  padding:5px 7px;z-index:2;pointer-events:none;\n'
    '  background:linear-gradient(180deg,rgba(4,6,16,.9),rgba(4,6,16,0))}\n'
    '#siteBack{pointer-events:auto;border:1px solid var(--line2);background:rgba(8,12,30,.8);\n'
    '  color:var(--mut);border-radius:6px;padding:3px 6px;cursor:pointer;\n'
    '  font:700 8px/1 system-ui;letter-spacing:.12em;flex:none}\n'
    '#siteBack:hover{color:var(--txt);border-color:var(--cy)}\n'
    '#siteName{font:700 9.5px/1 system-ui;letter-spacing:.1em;color:var(--txt);\n'
    '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n'
    '#siteCt{margin-left:auto;font:700 11px/1 ui-monospace,monospace;color:var(--cy);flex:none}\n'
    '#core.site #siteHud{display:flex}\n',
    '/* patch612: the old planet widget and its site-view bar are gone - the map zoom\n'
    '   replaced the planet, and the site view itself moves onto the zoom canvas in\n'
    '   Run 3 (patch615). */\n',
    label="core/siteHud CSS block",
)
do(
    '#coreTog{display:none;position:absolute;left:0;right:0;bottom:0;height:22px;border:0;cursor:pointer;\n'
    '  background:linear-gradient(180deg,rgba(6,9,24,0),rgba(6,9,24,.55) 38%,rgba(6,9,24,.95));color:var(--mut);\n'
    '  font:600 8.5px/22px system-ui;letter-spacing:.18em}\n'
    '#core.hid{height:24px}\n'
    '#core.hid canvas{display:none}\n'
    '#core.hid #coreTog{top:0;height:100%;line-height:22px;background:rgba(255,255,255,.03)}\n',
    '',
    label="coreTog/core.hid CSS",
)

# --------------------------------------------------------- CSS: narrow-layout re-parent
do(
    "  /* #core is re-parented onto <main> at this width so it sits above the tabs */\n"
    "  #core{order:1;flex:0 0 auto;height:120px;max-height:none;aspect-ratio:auto;\n"
    "    width:auto;margin:8px 10px 0;transition:height .18s}\n"
    "  #core.site{height:196px}\n"
    "  #coreTog{display:block}\n",
    "",
    label="narrow-layout #core CSS",
)

# ---------------------------------------------------------------- markup: #core widget
do(
    '    <div id="core"><canvas id="orb"></canvas>\n'
    '      <div id="orbBadge" class="exi held" style="display:none;position:absolute;left:8px;top:8px;z-index:2"><i class="exdot"></i><b></b></div>\n'
    '      <div id="siteHud"><button id="siteBack">&lsaquo; SYSTEM</button>\n'
    '        <span id="siteName">—</span><b id="siteCt">0</b></div>\n'
    '      <button id="coreTog">HIDE SYSTEM VIEW</button></div>\n',
    '',
    label="core widget markup",
)

# ---------------------------------------------------------------- markup: #p-emp tab + pane
do(
    '      <!-- patch608: kept for tests until Run 2 (patch612) removes it - see the header note -->\n'
    '      <button class="tab legacyhide" data-p="p-emp">Empire<i class="dot"></i></button>\n',
    '',
    label="p-emp tab button",
)
do(
    '      <div class="pane legacyhide" id="p-emp">\n'
    '        <div id="lfBanner"></div>\n'
    '        <div class="buybar">\n'
    '          <span style="font-size:10px;letter-spacing:.16em;color:var(--dim)">BUY</span>\n'
    '          <button class="chip on" data-b="1">×1</button>\n'
    '          <button class="chip" data-b="10">×10</button>\n'
    '          <button class="chip" data-b="100">×100</button>\n'
    '          <button class="chip" data-b="max">MAX</button>\n'
    '        </div>\n'
    '        <div id="exoStrip"></div>\n'
    '        <div id="gens"></div>\n'
    '      </div>\n',
    '',
    label="p-emp pane markup",
)

# ------------------------------------------------------- JS: stray renderGens() callers
do(
    '  toast(r.n+" → level "+(l+1),"g"); dirty=true; renderRes(); renderGens();\n',
    '  toast(r.n+" → level "+(l+1),"g"); dirty=true; renderRes();\n',
    label="buyRes drops renderGens call",
)
do(
    "function renderAll(){ renderGens(); dirty=true; render(); }\n",
    "function renderAll(){ dirty=true; render(); }\n",
    label="renderAll drops renderGens call",
)

# ------------------------------------------------------------------- JS: empOpen state
do(
    '/* ============================ rendering ============================ */\n'
    '/* ---- STAGE 2: the Empire tab is a grouped, collapsible system list ----\n'
    '   One row per system: Sol Reach pinned above everything, then each ring in order under\n'
    '   a small header. A tap expands a row (accordion - empOpen holds the one open id, or\n'
    '   null). A system\'s body lists exactly its own ladder (see sysLadder): owned tiers as\n'
    '   active buy rows, the first not-yet-owned tier as a greyed "next" row with its price\n'
    '   (exotic included, even if you do not have any of it yet - see ladderTierRow), and\n'
    '   every tier past that hidden. No picker, no placement step - a tier IS the row. */\n'
    'let empOpen="home";                 /* expanded by default on first load - the tab itself\n'
    '                                        opens "on" per the HTML, so this is already true\n'
    '                                        the first time the player ever sees it */\n',
    '/* ============================ rendering ============================ */\n'
    '/* patch612: the old Empire tab (a grouped, collapsible system accordion - empOpen\n'
    '   held the one open row\'s id) is gone; its per-system body is what patch610 turned\n'
    '   into the sheet\'s own BUILDINGS section (see ladderTierRow, renderSysBuild). */\n',
    label="empOpen state + stale accordion comment",
)

# --------------------------------------------------------------- JS: empViewSys()
do(
    '/* the system the orb should currently be showing - null for "home\'s normal look".\n'
    '   Deliberately excludes "home" itself, so opening it (or collapsing everything) falls\n'
    '   back to the default planet. Programme rows no longer live on this tab (Stage 1/v3),\n'
    '   so empOpen only ever holds a system id or null here. */\n'
    'function empViewSys(){\n'
    '  if(!empOpen || typeof empOpen!=="string" || empOpen==="home") return null;\n'
    '  return SYSMAP[empOpen]||null;\n'
    '}\n',
    '',
    label="empViewSys removal",
)

# --------------------------------------------------------------- JS: updateOrbBadge()
do(
    "/* the exotic badge shown over the orb for whichever system empViewSys() is showing -\n"
    "   same dot+label idiom renderExoStrip() already draws, just anchored to the orb instead\n"
    "   of the counter strip. Hidden whenever there is nothing to badge (no system open, no\n"
    "   exotic on that system, or the view is zoomed into a structure site instead). */\n"
    "function updateOrbBadge(){\n"
    '  const b=$("#orbBadge"); if(!b)return;\n'
    "  const s = S.site==null ? empViewSys() : null;\n"
    "  const ex = s&&s.res ? exoDef(s.res) : null;\n"
    '  b.style.display = ex ? "flex" : "none";\n'
    '  if(ex){ b.style.setProperty("--a",ex.col); const n=b.querySelector("b"); if(n)n.textContent=ex.n.toUpperCase(); }\n'
    "}\n",
    "",
    label="updateOrbBadge removal",
)

# --------------------------------------------------------------- JS: empAccordionTap()
do(
    '/* PATCH 1: empDevBlock() (the pinned Extraction pseudo-row - Development level,\n'
    '   DEVELOP/EXTRACTION button) is deleted outright along with the mechanic it drove.\n'
    '   A held exotic system\'s body is now just its own kind-ladder tier rows - same\n'
    '   presentation an ore-kind system\'s body always had, nothing pinned above it. */\n'
    '/* shared by every accordion row in the Empire tab - system rows only. One empOpen\n'
    '   value, one open row at a time. Programme rows moved to the Research tab in Stage 1\n'
    '   (v3) and no longer share this state - see renderProg() instead. */\n'
    'function empAccordionTap(head,key){\n'
    '  const view=$("#view");\n'
    '  const beforeTop=head.getBoundingClientRect().top;\n'
    '  empOpen = (empOpen===key) ? null : key;\n'
    '  dirty=true; render();\n'
    "  const newHead=$('[data-sys=\"'+key+'\"]');\n"
    '  if(!view||!newHead)return;\n'
    '  const afterTop=newHead.getBoundingClientRect().top;\n'
    '  /* instant, not smooth - see the tab-switch handler\'s identical comment below */\n'
    '  const jumpTo=(t)=>{ try{ view.scrollTo({top:t, behavior:"instant"}) }catch(_){ view.scrollTop=t } };\n'
    '  jumpTo(view.scrollTop + (afterTop-beforeTop));\n'
    '  /* clamp: never let the tapped header end up hidden above/under its ring header */\n'
    '  let ring=newHead.parentElement.previousElementSibling;\n'
    '  while(ring&&!ring.classList.contains("ringhead"))ring=ring.previousElementSibling;\n'
    '  if(ring){\n'
    '    const ringBottom=ring.getBoundingClientRect().bottom;\n'
    '    const nowTop=newHead.getBoundingClientRect().top;\n'
    '    if(nowTop<ringBottom)jumpTo(view.scrollTop - (ringBottom-nowTop));\n'
    '  }\n'
    '}\n',
    '/* PATCH 1: empDevBlock() (the pinned Extraction pseudo-row - Development level,\n'
    '   DEVELOP/EXTRACTION button) is deleted outright along with the mechanic it drove.\n'
    '   A held exotic system\'s body is now just its own kind-ladder tier rows - same\n'
    '   presentation an ore-kind system\'s body always had, nothing pinned above it. */\n',
    label="empAccordionTap removal",
)

# --------------------------------------------------------------------- JS: empSysRow()
do(
    'function empSysRow(id){\n'
    '  const s=SYSMAP[id], held=s.home||sysHeld(id);\n'
    '  const wrap=document.createElement("div");\n'
    '  if(!held){\n'
    '    /* sysOpen() is the map\'s own "can this be claimed right now" check (level reached,\n'
    '       not held, not owned by a rival) - reusing it means this split can never disagree\n'
    '       with what tapping CLAIM on the map actually allows. PATCH 2: sysContested() is the\n'
    '       map\'s OWN "level reached, but a rival holds it" check too (unheld + a real owner -\n'
    '       see its definition by sysOpen\'s), so CLAIMABLE vs CONTESTED here can never disagree\n'
    '       with the map popup\'s own CLAIM vs ASSAULT GARRISON branch either. */\n'
    '    const claimable=sysOpen(s);\n'
    '    const contested=sysContested(s) && level()>=s.lvl;\n'
    '    const el=document.createElement("div");\n'
    '    if(claimable){\n'
    '      el.className="sysrow2 claimable";\n'
    '      el.innerHTML=`<div class="sysrow2-main">\n'
    '          <span class="sysname">${s.n}</span>\n'
    '          <span class="kindbadge" style="--a:var(--gr)">CLAIM READY</span></div>\n'
    '        <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span><span><b>${fmt(s.cost)}</b> ORE</span></div>`;\n'
    '    } else if(contested){\n'
    '      /* rival-held, not the "not there yet" kind of blocked - a fight, not a wait.\n'
    '         Garrison strength stands where the claim cost sits on the other two states.\n'
    '         onclick below is the SAME S.msel+gotoTab("p-map") every unheld row already\n'
    '         uses - the map popup already shows ASSAULT GARRISON (not CLAIM) once it sees\n'
    '         sysContested(s), so this row needed no new attack entry point, only the right\n'
    '         visual state pointing at the one that already exists. */\n'
    '      const rv=RIVALMAP[sysOwner(s)], at=assaultTarget(s);\n'
    '      /* STAGE 2: was this ours? Same row shape (rival mark, ship count, tap-to-map),\n'
    '         different badge/glyph/copy so the empire list reads "yours to take back",\n'
    '         not "unclaimed ground" - and a WEAKENED tag while occWeakMul() still applies. */\n'
    '      const occ=sysOccupied(id), weak=occ&&occWeakMul(id)<1;\n'
    '      el.className="sysrow2 contested"+(occ?" occ":"");\n'
    '      el.innerHTML=`<div class="sysrow2-main">\n'
    '          <span class="rivalmark" style="--a:${rv.col}" title="${rv.n}">${occ?"\\u26e8":"\\u2694"}</span>\n'
    '          <span class="sysname">${s.n}</span>\n'
    '          <span class="kindbadge" style="--a:var(--rd)">${occ?"RETAKE":"INVADE"}</span></div>\n'
    '        <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span>\n'
    '          <span style="color:${rv.col}">${rv.n.toUpperCase()}</span>\n'
    '          <span><b>${at.en}</b> SHIPS · ×${fmt(s.def)}${weak?" · WEAKENED":""}</span></div>`;\n'
    '    } else {\n'
    '      el.className="sysrow2 locked";\n'
    '      el.innerHTML=`<div class="sysrow2-main"><span class="lockicon">🔒</span>\n'
    '          <span class="sysname">${s.n}</span></div>\n'
    '        <div class="sysrow2-stats"><span>LEVEL ${s.lvl}</span><span>${fmt(s.cost)} ORE</span></div>`;\n'
    '    }\n'
    '    el.onclick=()=>{ S.msel=id; gotoTab("p-map"); };\n'
    '    return el;\n'
    '  }\n'
    '  const kind=KIND_INFO[s.kind]||KIND_INFO.mixed;\n'
    '  const ladder=sysLadder(id);\n'
    '  const owned=ladder.filter(gi=>sysTierCount(id,gi)>0).length;\n'
    '  const ex=s.res?exoDef(s.res):null;\n'
    '  const open=empOpen===id;\n'
    '  /* Set on wrap, not head: the expanded body below is wrap\'s second child (a sibling\n'
    '     of head, not nested inside it), so only a var set here reaches both via ordinary\n'
    '     CSS inheritance. See the .kindtint comment in the stylesheet for the full\n'
    '     rationale and the layering technique these four feed. */\n'
    '  wrap.style.setProperty("--a",kind.col);\n'
    '  wrap.style.setProperty("--a-wash","rgba("+kind.rgb+",.12)");\n'
    '  wrap.style.setProperty("--a-wash-body","rgba("+kind.rgb+",.06)");\n'
    '  wrap.style.setProperty("--a-border","rgba("+kind.rgb+",.55)");\n'
    '  wrap.style.setProperty("--a-text",kind.txt);\n'
    '  const head=document.createElement("div");\n'
    '  head.className="sysrow2 held kindtint"+(open?" expanded":"");\n'
    '  head.dataset.sys=id;\n'
    '  head.innerHTML=`<div class="sysrow2-main">\n'
    '      <span class="sysname">${s.n}</span>\n'
    '      <span class="kindbadge" style="--a:${kind.col}">${kind.n}</span></div>\n'
    '    <div class="sysrow2-stats">\n'
    '      <span>${ex?ex.n.toUpperCase():"\\u2014"}</span>\n'
    '      <span><b>${owned}/${ladder.length}</b> TIERS</span>\n'
    '      <span><b>${fmt(sysOreRate(id))}</b> ORE/S</span>\n'
    '      ${ex?`<span><b>${fmt(sysExoRate(id))}</b> ${ex.n.toUpperCase()}/S</span>`:""}\n'
    '    </div>`;\n'
    '  head.onclick=()=>empAccordionTap(head,id);\n'
    '  wrap.appendChild(head);\n'
    '  if(open){\n'
    '    const body=document.createElement("div"); body.className="sysbody kindtint";\n'
    '    let shownNext=false;\n'
    '    for(const gi of ladder){\n'
    '      if(sysTierCount(id,gi)>0){ body.appendChild(ladderTierRow(id,gi,false)); }\n'
    '      else if(!shownNext){ body.appendChild(ladderTierRow(id,gi,true)); shownNext=true; }\n'
    '      else break;\n'
    '    }\n'
    '    wrap.appendChild(body);\n'
    '  }\n'
    '  return wrap;\n'
    '}\n',
    '',
    label="empSysRow removal",
)

# ----------------------------------------------------------------------- JS: renderGens()
do(
    '/* filled slot rows set their own --p (afford progress) at build time, same as every\n'
    '   other .g row always has - but renderGens() only runs on dirty (a tap, a purchase),\n'
    '   so ore ticking up between taps needs its own unconditional per-frame pass, exactly\n'
    '   like the shipped game\'s GENS.forEach in render() did. This array is what that pass\n'
    '   walks; it is rebuilt every time renderGens() rebuilds the list. */\n'
    'let empSlotEls=[];\n',
    '/* filled slot rows set their own --p (afford progress) at build time, same as every\n'
    '   other .g row always has - but renderSysBuild() only rebuilds on its own dataset.h\n'
    '   key changing (a buy, a buy-chip tap, a different system opened), so ore ticking up\n'
    '   between those needs its own unconditional per-frame pass, exactly like the shipped\n'
    '   game\'s GENS.forEach in render() did. This array is what that pass walks; it is\n'
    '   rebuilt every time renderSysBuild() rebuilds the sheet\'s own rows (patch610/611). */\n'
    'let empSlotEls=[];\n',
    label="empSlotEls comment update",
)
do(
    'function renderGens(){\n'
    '  const host=$("#gens"); if(!host)return;\n'
    '  empSlotEls=[];\n'
    '  host.innerHTML="";\n'
    '  host.appendChild(empSysRow("home"));\n'
    '  const furthest=empFurthestRing();\n'
    '  /* held first, then claimable, then locked-by-level, then rival-held last - a system\n'
    '     you cannot currently act on (someone else is sitting on it) should not sit above\n'
    '     ones you can. Stable within each group (SYS\'s own table order). */\n'
    '  const ringRank=s=>sysHeld(s.id)?0:sysContested(s)?3:sysOpen(s)?1:2;\n'
    '  for(let ring=1;ring<=furthest;ring++){\n'
    '    const inRing=SYS.filter(s=>s.ring===ring); if(!inRing.length)continue;\n'
    '    const hd=document.createElement("div"); hd.className="sechead ringhead"; hd.textContent="RING "+ring;\n'
    '    host.appendChild(hd);\n'
    '    const sorted=inRing.slice().sort((a,b)=>ringRank(a)-ringRank(b));\n'
    '    for(const s of sorted)host.appendChild(empSysRow(s.id));\n'
    '  }\n'
    '  if(furthest<4){\n'
    '    const beyond=SYS.filter(s=>s.ring>furthest).length;\n'
    '    if(beyond>0){\n'
    '      const d=document.createElement("div"); d.className="sysrow2 beyond";\n'
    '      d.textContent=beyond+" systems beyond the Verge";\n'
    '      host.appendChild(d);\n'
    '    }\n'
    '  }\n'
    '}\n',
    '',
    label="renderGens removal",
)

# ------------------------------------------------------------ JS: render() call sites
do(
    '  if(S.site!=null)$("#siteCt").textContent="\\u00d7"+fmt(gCount(S.site));\n',
    '',
    label="render() drops dead siteCt write",
)
do(
    '  if($("#p-map").classList.contains("on")){ renderExoStrip(); updateOrbBadge(); }\n',
    '  if($("#p-map").classList.contains("on"))renderExoStrip();\n',
    label="render() drops updateOrbBadge call",
)

# ------------------------------------------------------------------- JS: orbResize()
do(
    'const orb=$("#orb"); let ox=null,OW=0,OH=0;\n'
    'function orbResize(){\n'
    '  if(!orb.offsetParent){ox=null;return}\n'
    '  const w=Math.round(orb.clientWidth*devicePixelRatio),\n'
    '        h=Math.round(orb.clientHeight*devicePixelRatio);\n'
    '  if(w<8||h<8){ox=null;return}          /* mid-layout: try again next frame */\n'
    '  if(orb.width!==w)orb.width=w;\n'
    '  if(orb.height!==h)orb.height=h;\n'
    '  OW=orb.width; OH=orb.height;\n'
    '  ox=orb.getContext("2d");\n'
    '}\n',
    '',
    label="orbResize + orb/ox/OW/OH removal",
    count=1,
)

# ------------------------------------------------------------------- JS: openSite()
do(
    'function openSite(i){\n'
    '  if(S.site===i){ S.site=null } else { S.site=i; siteT0=performance.now(); if(!S.core)S.core=1 }\n'
    '  applyCore(); dirty=true; render(); save();\n'
    '}\n',
    '/* patch612: the old core-widget repaint call is gone with the widget itself -\n'
    "   S.site's own toggle logic is untouched (Run 3/patch615 reuses it on the zoom\n"
    '   canvas), just nothing left here to repaint a widget that no longer exists. */\n'
    'function openSite(i){\n'
    '  if(S.site===i){ S.site=null } else { S.site=i; siteT0=performance.now(); if(!S.core)S.core=1 }\n'
    '  dirty=true; render(); save();\n'
    '}\n',
    label="openSite drops applyCore call",
)

# ------------------------------------------------------------------- JS: draw()'s core scene
do(
    '  sx.globalAlpha=1;\n'
    '  // ---------- core scene ----------\n'
    '  /* ResizeObserver covers the normal cases; this is a throttled backstop for\n'
    '     browsers without it and for devicePixelRatio changes mid-session. */\n'
    '  if(ox===null || (++orbChk%20===0 &&\n'
    '      (OW!==Math.round(orb.clientWidth*devicePixelRatio)\n'
    '    || OH!==Math.round(orb.clientHeight*devicePixelRatio)))) orbResize();\n'
    '  if(ox&&OW&&S.site!=null&&SITE[S.site]){ drawSite(t,devicePixelRatio) }\n'
    '  else if(ox&&OW){\n'
    '    const evs=S.site==null?empViewSys():null;\n'
    '    const vid=evs?evs.id:"home";\n'
    '    drawSysScene(ox,OW,OH,vid,t,devicePixelRatio);\n'
    '  }\n'
    '  // ---------- map zoom scene (patch603) ----------\n',
    '  sx.globalAlpha=1;\n'
    '  /* patch612: the #core/#orb "core scene" branch that used to sit here - the orb\n'
    '     canvas resize check, drawSite()/drawSysScene() onto it, the pick-what-to-draw\n'
    '     lookup - is gone with the widget itself. draw() now only ever paints the\n'
    '     starfield (above) and the map-zoom canvas (below). */\n'
    '  // ---------- map zoom scene (patch603) ----------\n',
    label="draw() drops core scene branch",
)

# ------------------------------------------------------------- JS: orb ResizeObserver
do(
    'if(window.ResizeObserver) new ResizeObserver(()=>{ox=null}).observe(orb);\n',
    '',
    label="orb ResizeObserver removal",
)

# ------------------------------------------------- JS: orphaned ox=null listeners
# Found only after this patch's first pcheck/tq2 run (see the docstring's "sixth" note)
# - pageshow/visibilitychange/resize all existed only to null out orbResize()'s own
# state on anything that could move or resize #orb. Dead the moment ox itself is gone.
do(
    'addEventListener("resize",resize); resize();\n'
    '/* fires on first layout, on every frame of the show/hide height transition, on\n'
    '   orientation change and on restore-from-bfcache — anything that moves the box. */\n'
    'addEventListener("pageshow",()=>{ox=null});\n'
    'document.addEventListener("visibilitychange",()=>{ if(!document.hidden)ox=null });\n',
    'addEventListener("resize",resize); resize();\n'
    '/* patch612: the pageshow/visibilitychange listeners that used to sit here only to\n'
    "   null out the orb canvas's own resize state are gone with the widget itself. */\n",
    label="pageshow/visibilitychange ox=null listeners removal",
)
do(
    'requestAnimationFrame(draw);\n'
    'addEventListener("resize",()=>{ox=null});\n'
    '\n',
    'requestAnimationFrame(draw);\n'
    '\n',
    label="resize ox=null listener removal",
)

# --------------------------------------------------------- JS: tab click / restart / import
do(
    '  dirty=true; applyCore(); render(); requestAnimationFrame(drawTreeLines);\n',
    '  dirty=true; render(); requestAnimationFrame(drawTreeLines);\n',
    label="tab handler drops applyCore call",
)
do(
    '        clearInterval(iv); Store.del(KEY); S=fresh(); LF=null; hideModal();\n'
    '        applyCore(); renderAll(); playOpening(); save();\n',
    '        clearInterval(iv); Store.del(KEY); S=fresh(); LF=null; hideModal();\n'
    '        renderAll(); playOpening(); save();\n',
    label="restart flow drops applyCore call",
)
do(
    '          if(adopt(o)){ hideModal(); applyCore(); LF=null; lfSettleMarkOnLoad();\n',
    '          if(adopt(o)){ hideModal(); LF=null; lfSettleMarkOnLoad();\n',
    label="import-save flow drops applyCore call",
)

# ---------------------------------------------------------- JS: coreTog/siteBack handlers
do(
    '$("#coreTog").onclick=()=>{ S.core=S.core?0:1; applyCore(); save(); };\n',
    '',
    label="coreTog click handler removal",
)
do(
    '$("#siteBack").onclick=e=>{ e.stopPropagation(); S.site=null; applyCore(); dirty=true; render(); save(); };\n',
    '',
    label="siteBack click handler removal",
)

# -------------------------------------------------------------- JS: mqNarrow listener
do(
    'mqNarrow.addEventListener("change",()=>{ applyCore(); resize(); });\n',
    'mqNarrow.addEventListener("change",()=>{ resize(); });\n',
    label="mqNarrow listener drops applyCore call",
)

# ----------------------------------------------------------- JS: placeCore/applyCore defs
do(
    'function placeCore(){\n'
    '  const core=$("#core"), main=document.querySelector("main"), left=$("#left");\n'
    '  const host = mqNarrow.matches ? main : left;\n'
    '  if(core.parentElement!==host) host.insertBefore(core, host.firstChild);\n'
    '}\n'
    'function applyCore(){\n'
    '  placeCore();\n'
    '  if(S.site!=null&&!SITE[S.site])S.site=null;\n'
    '  const emp=$("#p-map").classList.contains("on");\n'
    '  $("#core").style.display=emp?"":"none";\n'
    '  $("#core").classList.toggle("hid",!S.core);\n'
    '  $("#core").classList.toggle("site",S.site!=null&&!!S.core);\n'
    '  if(S.site!=null){ $("#siteName").textContent=GENS[S.site].n.toUpperCase();\n'
    '    $("#siteCt").textContent="×"+fmt(gCount(S.site)); }\n'
    '  $("#coreTog").textContent=S.core?"HIDE SYSTEM VIEW":"SHOW SYSTEM VIEW";\n'
    '  ox=null;\n'
    '}\n',
    '/* patch612: the #core widget\'s own re-parent-on-breakpoint and show/hide/site-\n'
    '   toggle functions are gone with the widget. S.site\'s own out-of-range sanitising\n'
    '   (the one useful check either of them did at runtime) moved to adopt() below,\n'
    '   the only place that still needs it now - see PLAN-unify.md\'s own note that\n'
    '   adopt() keeps sanitising S.core/S.site. */\n',
    label="placeCore/applyCore removal",
)

# -------------------------------------------------------------------------- JS: boot
do(
    '$("#btnMute").textContent=S.muted?"♪̸":"♪";\n'
    'applyCore();\n',
    '$("#btnMute").textContent=S.muted?"♪̸":"♪";\n',
    label="boot drops applyCore call",
)

# --------------------------------------------------------------------- __SD export
do(
    'window.__SD={get S(){return S},NEXUS,buyNex,openSite,SITE,siteSlots,\n'
    '  placeCore,applyCore,save,load,get orbSize(){return[OW,OH]},\n',
    'window.__SD={get S(){return S},NEXUS,buyNex,openSite,SITE,siteSlots,\n'
    '  save,load,\n',
    label="__SD export drops placeCore/applyCore/orbSize",
)
do(
    '  KIND_INFO,empFurthestRing,gotoTab,get empOpen(){return empOpen},\n',
    '  KIND_INFO,empFurthestRing,gotoTab,\n',
    label="__SD export drops empOpen",
)
do(
    '  renderExoStrip,mktSvKinds};\n',
    '  renderExoStrip,mktSvKinds,\n'
    '  sheetScroll,renderSysBuild};\n',
    label="__SD export adds sheetScroll/renderSysBuild",
)

# --------------------------------------------------------- adopt(): S.site sanitising
# The one bounds-check applyCore() did on S.site (an out-of-range index throwing the
# moment anything reads SITE[S.site]/GENS[S.site]) has to live somewhere once
# applyCore() is gone - adopt() is the one place every save (loaded or fresh-merged)
# already passes through, and PLAN-unify.md's own note for this patch says adopt()
# "keeps sanitising" S.core/S.site, so this makes that literally true rather than
# leaving it a stale claim.
do(
    "  if(!Array.isArray(f.sh)||f.sh.length!==3)f.sh=[0,0,0];\n",
    "  if(f.site!=null&&!SITE[f.site])f.site=null;\n"
    "  if(!Array.isArray(f.sh)||f.sh.length!==3)f.sh=[0,0,0];\n",
    label="adopt() sanitises f.site",
)

assert h.count("const BUILD=612;") == 1
# Safety net: every real CALL/DECLARATION site for a deleted name is gone (exact
# invocation syntax, not a bare mention - several pre-existing comments elsewhere in
# the file still say e.g. "empSysRow()" or "renderGens()" in prose describing history,
# same as patch610 already left "renderGens()" mentioned in comments; scrubbing every
# historical comment in a 12k-line file is out of this patch's scope - what matters is
# that nothing still CALLS any of these).
for dead in ("applyCore()", "placeCore()", "orbResize()", "function empSysRow(",
             "empAccordionTap(head,id)", "function renderGens(", "function empViewSys(",
             "function updateOrbBadge(", "updateOrbBadge();",
             'id="p-emp"', 'id="core">', 'id="orb">', 'id="coreTog"', 'id="orbBadge"',
             'id="siteHud"', 'id="siteBack"', 'id="siteName"', 'id="siteCt"'):
    assert dead not in h, f"expected {dead!r} to be fully gone"
assert 'let empOpen="home"' not in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch612 applied OK")
