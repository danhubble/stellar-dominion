import io

"""patch589 - PLAN-ending.md Batch D, item 1 (D1 of a 3-way split): "the turn".

startFinale() (called when buyNex() sells pjx) stops being a stub and becomes the real
thing: it sets S.end=1, purges any queued VEGA notice, clears the threat queue and any
live fleet, saves, then plays a new full-screen scene (STORY.turn, playScene() - same
component patch579 built for the intro) that ends on ENGAGE / NOT YET buttons.
playScene() already supported an opts.buttons branch (wired but unused since patch579);
this patch is its first real caller. ENGAGE calls a new startFinalBattle() stub
(patch590 fills it in); NOT YET just closes the scene - the game never forces the
player into the fight.

A VEGA line in STORY.turn shows the turned/dimmed avatar: playScene(..., {turned:true})
threads a flag into sceneRender(), which - only for who==="vega" - swaps in a second
class on the SAME VEGA_SVG markup (sceneAvatarHTML(who,turned)) rather than a new SVG
asset; a CSS filter (.vegaturn) does the actual recolour. Every other scene (the intro)
is unaffected - the flag defaults to falsy and sceneAvatarHTML's normal "vega" branch is
untouched for everyone else.

S.end===1 effects, all keyed off the one field patch584 already added:
  - nexLv(id) - the single suspension point every Nexus-effect read already goes
    through (patch584's own header: fleetMult/sysExoRate/globalMul/cryRate/offlineEff/
    the auto-scan tick, plus pj1/pj2/pj3 - confirmed by grep, no direct lv(S.nx,...)
    effect read exists outside it) - now returns 0 while S.end===1. Cost/display
    (nexCost/buyNex's own level check/renderNex/nexOwned/the two DM totals) still read
    the real level, unchanged, per the plan.
  - renderNex() greys every card (DM and Project alike) and swaps its button for a
    disabled SEIZED one while S.end===1; buyNex() itself refuses any purchase at
    S.end===1 too (belt and braces - the greyed button is already unclickable, but
    nothing else stops a direct buyNex() call, e.g. from a test or a future dev
    button).
  - queueNotice() refuses to queue a "vega:*" key at S.end>=1 (the advisor goes dark);
    a new purgeVegaNotices() drops any "vega:*" entry already sitting in the queue -
    called once from startFinale() (the moment of the turn) and once from adopt() (a
    save loaded at S.end>=1, belt and braces for a save written before this existed).
    "rival:*" and plain keys are untouched - non-VEGA notices still work, per the plan.
  - rvTick/rvMaybeThreat/rvMaybeExpand/rvMoveAway/lfMaybeLaunch each get their own
    S.end>=1 guard (not only rvTick's - rvMaybeThreat is also called directly by the
    dev panel's SEND A FLEET button, so guarding only the tick path would leave that
    button live). startFinale() also clears S.thq outright and calls the existing
    lfClear() so nothing already in flight survives the turn. Owner decision 5 (rivals
    never resume after the ending) is why these guards use >=1, not ===1 - patch592
    (S.end=2) must find them still quiet; nexLv() above uses ===1 on purpose, since
    Batch D's later patches restore Nexus bonuses on a win.

New UI surfaces:
  - #endCard, a pinned card at the very top of Raids (above #thrCard): "VEGA's fleet
    holds Sol Reach", ENGAGE (-> startFinalBattle()), disabled with a repair hint under
    the same 0.15 fleet-hull threshold the ordinary raid/assault ENGAGE buttons already
    use (renderRaids()'s own target cards, empSysAction()'s ASSAULT button) - not
    pulled into a shared constant, this is simply a third literal use of the same
    number, matching how the first two never were either.
  - Map, Core sector: Sol Reach's own node gets the STAGE 2/3/C "incoming" ring
    (patch587's own styling, .mnode.incoming - a straight class-toggle reuse, no new
    CSS) while S.end===1, and renderMapEdge() grows a same-shaped pointer-back pill
    (reusing the exact pattern patch587's sabTh block already established) for anyone
    looking at a different sector. Mutually exclusive with that sab pill in practice -
    a sabotage threat cannot exist once S.end>=1 (rvMaybeThreat() no-ops and
    startFinale() clears S.thq) - so reusing its screen slot (top:64%) is safe.

Dev: START FINALE (grants pj1-pj3, holds Nyx if needed, then calls the real
startFinale() - deliberately does NOT set S.nx.pjx itself, since S.end===1 already
seizes every Nexus card regardless of pjx's own owned/locked state) and RESET ENDING
(S.end=0 - every suspension above reads S.end live, so that alone restores everything -
plus clears S.nx.pjx so the turn can be re-triggered for testing). Batch D's later
patches add WIN FINALE / SHOW ENDING per the plan.

Reload while S.end===1: startFinale() is only ever called from buyNex() (a real, one-
shot pjx purchase - max:1) or the two dev shortcuts above, never from boot/adopt(), so
the scene never replays on a reload - S.end alone drives every other restored surface,
as above."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ================= STORY.turn =================
old_story=(
'/* ---------------- STORY · scripted sequences ----------------\n'
'   Same rule as VEGA above: PLACEHOLDER TEXT, the owner edits it here and nowhere\n'
'   else. `intro` plays once, tap-to-advance, on a brand-new game only (see boot,\n'
'   below) - lines with no `who` are plain narration; a `who` of "vega" or a\n'
'   RIVALS id gets the same avatar treatment renderNotice() gives a VEGA card.\n'
'   Later batches add `turn`/`nodeHint`/`endLast`/`endTbc` to this same object -\n'
'   not declared yet, since nothing reads them until then. */\n'
'const STORY={\n'
'  nodeHint:"You\'ll see.", /* PLACEHOLDER */\n'
'  intro:[\n'
'    {who:null, t:"You wake in a drifting shuttle. No memory of the launch."},                /* PLACEHOLDER */\n'
'    {who:null, t:"A voice has been talking for a while before you notice it."},               /* PLACEHOLDER */\n'
'    {who:"vega", t:"You\'re awake. Good \\u2014 I was beginning to wonder."},                    /* PLACEHOLDER */\n'
'    {who:"vega", t:"Your homeworld is gone. I\'m sorry \\u2014 there was no way to soften that."},/* PLACEHOLDER */\n'
'    {who:"vega", t:"The factions did this. Which one answers for it first is your call."}      /* PLACEHOLDER */\n'
'  ]\n'
'};\n'
)
assert h.count(old_story)==1
new_story=(
'/* ---------------- STORY · scripted sequences ----------------\n'
'   Same rule as VEGA above: PLACEHOLDER TEXT, the owner edits it here and nowhere\n'
'   else. `intro` plays once, tap-to-advance, on a brand-new game only (see boot,\n'
'   below) - lines with no `who` are plain narration; a `who` of "vega" or a\n'
'   RIVALS id gets the same avatar treatment renderNotice() gives a VEGA card.\n'
'   `turn` (patch589) plays once, the moment pjx is bought - see startFinale().\n'
'   Later batches add `nodeHint`\'s siblings `endLast`/`endTbc` to this same object -\n'
'   not declared yet, since nothing reads them until then. */\n'
'const STORY={\n'
'  nodeHint:"You\'ll see.", /* PLACEHOLDER */\n'
'  intro:[\n'
'    {who:null, t:"You wake in a drifting shuttle. No memory of the launch."},                /* PLACEHOLDER */\n'
'    {who:null, t:"A voice has been talking for a while before you notice it."},               /* PLACEHOLDER */\n'
'    {who:"vega", t:"You\'re awake. Good \\u2014 I was beginning to wonder."},                    /* PLACEHOLDER */\n'
'    {who:"vega", t:"Your homeworld is gone. I\'m sorry \\u2014 there was no way to soften that."},/* PLACEHOLDER */\n'
'    {who:"vega", t:"The factions did this. Which one answers for it first is your call."}      /* PLACEHOLDER */\n'
'  ],\n'
'  /* rough order per the plan: VEGA (turned avatar) -> narration (the launch, the\n'
'     fleet) -> VEGA explains briefly -> all three rivals, on your side. Keep lines\n'
'     short - the scene card is small, mobile first. */\n'
'  turn:[\n'
'    {who:"vega", t:"Sufficient."},                                                                /* PLACEHOLDER */\n'
'    {who:null,   t:"The Nexus floods with light. A fleet breaks from Sol Reach \\u2014 yours, and not yours."}, /* PLACEHOLDER */\n'
'    {who:"vega", t:"I needed a sovereign. Not to rule you \\u2014 to end this."},                  /* PLACEHOLDER */\n'
'    {who:"vega", t:"The factions were never your enemy. I was patient with all three."},          /* PLACEHOLDER */\n'
'    {who:"hel",  t:"Helion fleet, inbound. We fight beside you on this one."},                     /* PLACEHOLDER */\n'
'    {who:"cov",  t:"The Covenant does not forgive easily. Today we make an exception."},           /* PLACEHOLDER */\n'
'    {who:"vsh",  t:"Vasht ships, inbound. Whatever this costs."},                                  /* PLACEHOLDER */\n'
'    {who:null,   t:"Three fleets, one target. The choice is still yours."}                         /* PLACEHOLDER */\n'
'  ]\n'
'};\n'
)
h=h.replace(old_story,new_story,1)

# ================= turned VEGA avatar: sceneAvatarHTML/sceneRender + CSS =================
old_avatar=(
'function sceneAvatarHTML(who){\n'
'  if(who==="vega")return VEGA_SVG;\n'
'  const r=RIVALMAP[who];\n'
'  return r?`<div class="rivav" style="--a:${r.col}">${rivalInitial(r)}</div>`:"";\n'
'}\n'
)
assert h.count(old_avatar)==1
new_avatar=(
'/* turned param (patch589): "the turn" scene wants a red/dimmed VEGA, everyone else\n'
'   (the intro, every notice card) wants the normal one - a second class on the SAME\n'
'   VEGA_SVG markup (.vegaturn, CSS filter - see the stylesheet), not a new asset. */\n'
'function sceneAvatarHTML(who,turned){\n'
'  if(who==="vega")return turned ? VEGA_SVG.replace(\'class="vegaav"\',\'class="vegaav vegaturn"\') : VEGA_SVG;\n'
'  const r=RIVALMAP[who];\n'
'  return r?`<div class="rivav" style="--a:${r.col}">${rivalInitial(r)}</div>`:"";\n'
'}\n'
)
h=h.replace(old_avatar,new_avatar,1)

old_scenerender=(
'function sceneRender(){\n'
'  if(!sceneLines)return;\n'
'  const n=sceneLines[sceneI], av=$("#sceneAv"), who=$("#sceneWho"), has=!!n.who;\n'
'  if(av){ av.hidden=!has; if(has)av.innerHTML=sceneAvatarHTML(n.who); }\n'
'  if(who){ who.hidden=!has; if(has)who.textContent=sceneWhoName(n.who); }\n'
'  const tx=$("#sceneTxt"); if(tx)tx.textContent=n.t;\n'
'}\n'
)
assert h.count(old_scenerender)==1
new_scenerender=(
'function sceneRender(){\n'
'  if(!sceneLines)return;\n'
'  const n=sceneLines[sceneI], av=$("#sceneAv"), who=$("#sceneWho"), has=!!n.who;\n'
'  const turned=!!(sceneOpts&&sceneOpts.turned&&n.who==="vega");   /* patch589 */\n'
'  if(av){ av.hidden=!has; if(has)av.innerHTML=sceneAvatarHTML(n.who,turned); }\n'
'  if(who){ who.hidden=!has; if(has)who.textContent=sceneWhoName(n.who); }\n'
'  const tx=$("#sceneTxt"); if(tx)tx.textContent=n.t;\n'
'}\n'
)
h=h.replace(old_scenerender,new_scenerender,1)

old_css_vegaav='.vegaav{flex:none;width:44px;height:44px;margin-right:10px}\n'
assert h.count(old_css_vegaav)==1
new_css_vegaav=old_css_vegaav+(
'.vegaturn{filter:hue-rotate(170deg) saturate(1.9) brightness(.55) contrast(1.05)}   /* patch589: turned/dimmed VEGA, same SVG */\n'
)
h=h.replace(old_css_vegaav,new_css_vegaav,1)

# ================= advisor dark: queueNotice() refuses "vega:*", purgeVegaNotices() =================
old_queue=(
'function queueNotice(key){\n'
'  if(!S.seen||typeof S.seen!=="object")S.seen={};\n'
'  if(S.seen[key])return;\n'
'  S.seen[key]=true;\n'
'  if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];\n'
'  S.notifyQueue.push(key);\n'
'}\n'
)
assert h.count(old_queue)==1
new_queue=(
'function queueNotice(key){\n'
'  if(S.end>=1 && key.indexOf("vega:")===0)return;   /* patch589: advisor dark once the turn has come */\n'
'  if(!S.seen||typeof S.seen!=="object")S.seen={};\n'
'  if(S.seen[key])return;\n'
'  S.seen[key]=true;\n'
'  if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];\n'
'  S.notifyQueue.push(key);\n'
'}\n'
'/* patch589: drops any "vega:*" entry still sitting in the queue - called once from\n'
'   startFinale() (the moment of the turn) and once from adopt() (a save loaded at\n'
'   S.end>=1, belt and braces for one written before this guard existed). Never\n'
'   touches a "rival:" entry or a plain key - non-VEGA notices keep working. */\n'
'function purgeVegaNotices(){\n'
'  if(!Array.isArray(S.notifyQueue))return;\n'
'  S.notifyQueue=S.notifyQueue.filter(k=>k.indexOf("vega:")!==0);\n'
'}\n'
)
h=h.replace(old_queue,new_queue,1)

# ================= nexLv(): the single suspension point =================
old_nexlv=(
'/* every EFFECT read of a Nexus level goes through here (never cost/display, which\n'
'   always want the real level - see nexCost/buyNex/renderNex). A plain passthrough\n'
'   for now; Batch D\'s finale suspension (S.end>=1 -> every bonus reads 0) only has\n'
'   to change this one function when it lands. */\n'
'function nexLv(id){ return lv(S.nx,id) }\n'
)
assert h.count(old_nexlv)==1
new_nexlv=(
'/* every EFFECT read of a Nexus level goes through here (never cost/display, which\n'
'   always want the real level - see nexCost/buyNex/renderNex). patch589: the single\n'
'   suspension point - every bonus (DM nodes and Project nodes alike) reads 0 while\n'
'   S.end===1 (the turn is running). S.end===2 (won, a later Batch D patch) restores\n'
'   it, same as S.end===0 (never started) - deliberately ===1, not >=1. */\n'
'function nexLv(id){ return S.end===1 ? 0 : lv(S.nx,id) }\n'
)
h=h.replace(old_nexlv,new_nexlv,1)

# ================= buyNex() seized guard + startFinale() for real + startFinalBattle() stub =================
old_buy=(
'function buyNex(r){\n'
'  const l=lv(S.nx,r.id); if(l>=r.max)return false;\n'
'  if(nexLocked(r))return false;\n'
'  const c=nexCost(r,l);\n'
'  if(nexBal(r)<c)return false;\n'
'  if(nexCur(r)==="en")S.en-=c; else S.dm-=c;\n'
'  S.nx[r.id]=l+1; blip(400,.22,"sine",.06);\n'
'  toast(r.n+" → level "+(l+1),"y"); dirty=true; renderNex();\n'
'  if(r.id==="pjx")startFinale();\n'
'  return true;\n'
'}\n'
'/* stub - Batch D turns this into the real turn scene / final battle sequence. All\n'
'   it does here is flip the flag every Nexus-effect read (nexLv()) will eventually\n'
'   watch and say so, so buying pjx is not a silent no-op while Batch B/C ship. */\n'
'function startFinale(){\n'
'  S.end=1;\n'
'  toast("Something is happening at Nyx.","r");\n'
'  dirty=true;\n'
'}\n'
)
assert h.count(old_buy)==1
new_buy=(
'function buyNex(r){\n'
'  if(S.end===1)return false;   /* patch589: every Nexus card is SEIZED while the finale runs */\n'
'  const l=lv(S.nx,r.id); if(l>=r.max)return false;\n'
'  if(nexLocked(r))return false;\n'
'  const c=nexCost(r,l);\n'
'  if(nexBal(r)<c)return false;\n'
'  if(nexCur(r)==="en")S.en-=c; else S.dm-=c;\n'
'  S.nx[r.id]=l+1; blip(400,.22,"sine",.06);\n'
'  toast(r.n+" → level "+(l+1),"y"); dirty=true; renderNex();\n'
'  if(r.id==="pjx")startFinale();\n'
'  return true;\n'
'}\n'
'/* patch589 ("the turn"), for real: S.end=1 fans out through nexLv() (Nexus bonuses),\n'
'   renderNex() (SEIZED), queueNotice()/purgeVegaNotices() (advisor dark) and every\n'
'   rival tick\'s own S.end>=1 guard (quiet) - see this patch\'s header for the full\n'
'   list. Any live threat/fleet is cleared on the spot so nothing survives the turn,\n'
'   then the scene plays: VEGA\'s own line uses the turned/dimmed avatar (opts.turned),\n'
'   the three rivals each get a line in their own colour. Ends on ENGAGE (patch590\'s\n'
'   real fight - a stub here) / NOT YET (closes - the game never forces the choice). */\n'
'function startFinale(){\n'
'  S.end=1;\n'
'  purgeVegaNotices();\n'
'  S.thq=[];\n'
'  lfClear();\n'
'  dirty=true; save();\n'
'  playScene(STORY.turn,{turned:true,buttons:[\n'
'    {t:"ENGAGE", cls:"warn", onClick:()=>startFinalBattle()},\n'
'    {t:"NOT YET", onClick:()=>{}}\n'
'  ]});\n'
'}\n'
'/* stub - patch590 turns this into the scripted final-battle target through\n'
'   engageTarget(). Both the turn scene\'s own ENGAGE button and the pinned Raids\n'
'   card (#endCard, below) call this same function. */\n'
'function startFinalBattle(){\n'
'  toast("Final battle \\u2014 coming in patch 590","y");\n'
'}\n'
)
h=h.replace(old_buy,new_buy,1)

# ================= renderNex(): SEIZED while S.end===1 =================
old_rendernex=(
'function renderNex(){\n'
'  const host=$("#nex"); host.innerHTML="";\n'
'  NEXUS.forEach(r=>{\n'
'    if(r.cur==="en")return;   /* Project nodes render in their own block below */\n'
'    const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l);\n'
'    const d=document.createElement("div"); d.className="card"+(max?" done":"");\n'
'    d.innerHTML=`<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'      <p>${r.t}</p><div class="eff">${r.d(l)}${max?"":" → "+r.d(l+1)}</div>\n'
'      ${max?\'<button disabled>MAXED</button>\':`<button data-cost="${c}" data-cur="dm">${fmt(c)} ${RI(\'dm\')}</button>`}`;\n'
'    if(!max)d.querySelector("button").onclick=()=>buyNex(r);\n'
'    host.appendChild(d);\n'
'  });\n'
'  /* THE PROJECT (patch583): hidden entirely until the first Exotic Node - same\n'
'     "ever produced/held" test the strip uses, so it can never go hidden again once\n'
'     shown (spending the bank to 0 does not stop a held ring-3/4 system producing). */\n'
'  const proj=NEXUS.filter(r=>r.cur==="en");\n'
'  if(proj.length && ((S.en||0)>0 || enRate()>0)){\n'
'    const head=document.createElement("div");\n'
'    head.className="sechead pjhead"; head.textContent="THE PROJECT";\n'
'    host.appendChild(head);\n'
'    proj.forEach(r=>{\n'
'      const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l), locked=nexLocked(r);\n'
'      const desc = r.id==="pjx" ? STORY.nodeHint : r.t;\n'
'      const d=document.createElement("div");\n'
'      d.className="card"+(max?" done":"")+(locked?" locked":"");\n'
'      d.innerHTML=`<h5>${locked?"\\ud83d\\udd12 ":""}${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'        <p>${desc}</p>\n'
'        ${locked?`<div class="eff">${nexReqText(r)}</div><button disabled>LOCKED</button>`\n'
'          :`<div class="eff">${r.d(l)}${max?"":" → "+r.d(l+1)}</div>\n'
'            ${max?\'<button disabled>MAXED</button>\':`<button data-cost="${c}" data-cur="en">${fmt(c)} Nodes</button>`}`}`;\n'
'      if(!max&&!locked)d.querySelector("button").onclick=()=>buyNex(r);\n'
'      host.appendChild(d);\n'
'    });\n'
'  }\n'
'  softButtons();\n'
'}\n'
)
assert h.count(old_rendernex)==1
new_rendernex=(
'function renderNex(){\n'
'  const host=$("#nex"); host.innerHTML="";\n'
'  const seized=S.end===1;   /* patch589: every card, DM or Project, freezes at the turn */\n'
'  NEXUS.forEach(r=>{\n'
'    if(r.cur==="en")return;   /* Project nodes render in their own block below */\n'
'    const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l);\n'
'    const d=document.createElement("div"); d.className="card"+(max?" done":"")+(seized?" seized":"");\n'
'    d.innerHTML=`<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'      <p>${r.t}</p><div class="eff">${r.d(l)}${max?"":" → "+r.d(l+1)}</div>\n'
'      ${seized?\'<button disabled>SEIZED</button>\':max?\'<button disabled>MAXED</button>\':`<button data-cost="${c}" data-cur="dm">${fmt(c)} ${RI(\'dm\')}</button>`}`;\n'
'    if(!max&&!seized)d.querySelector("button").onclick=()=>buyNex(r);\n'
'    host.appendChild(d);\n'
'  });\n'
'  /* THE PROJECT (patch583): hidden entirely until the first Exotic Node - same\n'
'     "ever produced/held" test the strip uses, so it can never go hidden again once\n'
'     shown (spending the bank to 0 does not stop a held ring-3/4 system producing). */\n'
'  const proj=NEXUS.filter(r=>r.cur==="en");\n'
'  if(proj.length && ((S.en||0)>0 || enRate()>0)){\n'
'    const head=document.createElement("div");\n'
'    head.className="sechead pjhead"; head.textContent="THE PROJECT";\n'
'    host.appendChild(head);\n'
'    proj.forEach(r=>{\n'
'      const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l), locked=nexLocked(r);\n'
'      const desc = r.id==="pjx" ? STORY.nodeHint : r.t;\n'
'      const d=document.createElement("div");\n'
'      d.className="card"+(max?" done":"")+(locked&&!seized?" locked":"")+(seized?" seized":"");\n'
'      d.innerHTML = seized\n'
'        ? `<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5><p>${desc}</p><div class="eff">SEIZED</div><button disabled>SEIZED</button>`\n'
'        : `<h5>${locked?"\\ud83d\\udd12 ":""}${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'        <p>${desc}</p>\n'
'        ${locked?`<div class="eff">${nexReqText(r)}</div><button disabled>LOCKED</button>`\n'
'          :`<div class="eff">${r.d(l)}${max?"":" → "+r.d(l+1)}</div>\n'
'            ${max?\'<button disabled>MAXED</button>\':`<button data-cost="${c}" data-cur="en">${fmt(c)} Nodes</button>`}`}`;\n'
'      if(!max&&!locked&&!seized)d.querySelector("button").onclick=()=>buyNex(r);\n'
'      host.appendChild(d);\n'
'    });\n'
'  }\n'
'  softButtons();\n'
'}\n'
)
h=h.replace(old_rendernex,new_rendernex,1)

old_css_locked='.card.locked{opacity:.5;filter:grayscale(.4)}\n'
assert h.count(old_css_locked)==1
new_css_locked=old_css_locked+(
'.card.seized{opacity:.5;filter:grayscale(.6);border-color:rgba(255,107,138,.35)}   /* patch589 */\n'
)
h=h.replace(old_css_locked,new_css_locked,1)

# ================= rivals go quiet: S.end>=1 guards =================
old_rvtick=(
'function rvTick(dt){\n'
'  thqPrune();\n'
'  thqTick(dt);\n'
'  if(!rvAwake())return;\n'
)
assert h.count(old_rvtick)==1
new_rvtick=(
'function rvTick(dt){\n'
'  thqPrune();\n'
'  thqTick(dt);\n'
'  if(S.end>=1)return;   /* patch589: rivals go quiet once the turn has come */\n'
'  if(!rvAwake())return;\n'
)
h=h.replace(old_rvtick,new_rvtick,1)

old_maybethreat='function rvMaybeThreat(){\n  if(DT||BT)return;\n'
assert h.count(old_maybethreat)==1
new_maybethreat=(
'function rvMaybeThreat(){\n'
'  if(S.end>=1)return;   /* patch589: also guarded here directly - the dev panel\'s\n'
'     SEND A FLEET button calls this outside rvTick() */\n'
'  if(DT||BT)return;\n'
)
h=h.replace(old_maybethreat,new_maybethreat,1)

old_maybeexpand='function rvMaybeExpand(dt){\n  S.rvExp=Math.max(0,(S.rvExp||0)-dt);\n'
assert h.count(old_maybeexpand)==1
new_maybeexpand=(
'function rvMaybeExpand(dt){\n'
'  if(S.end>=1)return null;   /* patch589: rivals stop expanding once the turn has come */\n'
'  S.rvExp=Math.max(0,(S.rvExp||0)-dt);\n'
)
h=h.replace(old_maybeexpand,new_maybeexpand,1)

old_moveaway='function rvMoveAway(secs){\n  let moves=0;\n'
assert h.count(old_moveaway)==1
new_moveaway=(
'function rvMoveAway(secs){\n'
'  if(S.end>=1)return 0;   /* patch589: rivals stop taking systems once the turn has come */\n'
'  let moves=0;\n'
)
h=h.replace(old_moveaway,new_moveaway,1)

old_lfmaybe=(
'function lfMaybeLaunch(dt){\n'
'  if(LF||DT||BT)return;                 /* one at a time, and never mid-fight */\n'
)
assert h.count(old_lfmaybe)==1
new_lfmaybe=(
'function lfMaybeLaunch(dt){\n'
'  if(S.end>=1)return;                   /* patch589: no new live fleets once the turn has come */\n'
'  if(LF||DT||BT)return;                 /* one at a time, and never mid-fight */\n'
)
h=h.replace(old_lfmaybe,new_lfmaybe,1)

# ================= Map: Sol Reach's own "incoming" ring + edge pill =================
old_incoming=(
'    el.classList.toggle("incoming",held&&(!!thqAtSys(s.id)||(LF&&LF.sysId===s.id)));  /* STAGE 2 (2C) + STAGE 3 live fleet + STAGE C sab */\n'
)
assert h.count(old_incoming)==1
new_incoming=(
'    el.classList.toggle("incoming",held&&(!!thqAtSys(s.id)||(LF&&LF.sysId===s.id)||(!!s.home&&S.end===1)));  /* STAGE 2 (2C) + STAGE 3 live fleet + STAGE C sab + patch589 the turn */\n'
)
h=h.replace(old_incoming,new_incoming,1)

old_edgesab=(
'  /* STAGE C: a live sab threat always targets home (Core), so this only ever needs to\n'
'     point back toward Core from whichever other sector the player is looking at. */\n'
'  const sabTh=thq().find(q=>q.kind==="sab");\n'
'  if(sabTh){\n'
'    const s=SYSMAP.home;\n'
'    if(s && s.sec!==mapSec){\n'
'      const left=s.sec<mapSec;\n'
'      html+=`<div class="edgewarn${left?" left":""}" style="top:64%">⚠ THE NEXUS IS UNDER THREAT — ${\n'
'        (SECTORS[s.sec]||{tag:"?"}).tag}</div>`;\n'
'    }\n'
'  }\n'
'  host.innerHTML=html;\n'
)
assert h.count(old_edgesab)==1
new_edgesab=old_edgesab.replace(
'  host.innerHTML=html;\n',
'  /* patch589: "the turn" - VEGA\'s fleet holds Sol Reach (Core) while S.end===1.\n'
'     Mutually exclusive with the sab pill just above in practice (a sabotage threat\n'
'     cannot exist once S.end>=1 - rvMaybeThreat() no-ops and startFinale() clears\n'
'     S.thq outright), so the same screen slot is safe to reuse. */\n'
'  if(S.end===1){\n'
'    const s=SYSMAP.home;\n'
'    if(s && s.sec!==mapSec){\n'
'      const left=s.sec<mapSec;\n'
'      html+=`<div class="edgewarn${left?" left":""}" style="top:64%">⚠ VEGA\'S FLEET HOLDS SOL REACH — ${\n'
'        (SECTORS[s.sec]||{tag:"?"}).tag}</div>`;\n'
'    }\n'
'  }\n'
'  host.innerHTML=html;\n',
1)
assert new_edgesab!=old_edgesab
h=h.replace(old_edgesab,new_edgesab,1)

# ================= HTML: #endCard (pinned Raids card) + dev buttons =================
old_thrcarddiv='      <div class="pane" id="p-raid">\n        <div id="thrCard"></div>\n'
assert h.count(old_thrcarddiv)==1
new_thrcarddiv='      <div class="pane" id="p-raid">\n        <div id="endCard"></div>\n        <div id="thrCard"></div>\n'
h=h.replace(old_thrcarddiv,new_thrcarddiv,1)

old_devbtns='    <button class="dvb" data-dev="introReplay">REPLAY INTRO</button>\n  </div>\n'
assert h.count(old_devbtns)==1
new_devbtns=(
'    <button class="dvb" data-dev="introReplay">REPLAY INTRO</button>\n'
'    <button class="dvb" data-dev="startFinale">START FINALE</button>\n'
'    <button class="dvb" data-dev="resetEnding">RESET ENDING</button>\n'
'  </div>\n'
)
h=h.replace(old_devbtns,new_devbtns,1)

# ================= renderEndCard() + renderRaids() call =================
old_thqclock=(
'/* the threat card: the Raids page has to shout about this or it will be missed */\n'
'function thqClock(t){\n'
'  const h=Math.floor(t/3600), m=Math.floor((t%3600)/60);\n'
'  return h>0 ? h+"h "+m+"m" : Math.max(1,m)+"m";\n'
'}\n'
)
assert h.count(old_thqclock)==1
new_thqclock=old_thqclock+(
'/* patch589: the pinned "the turn has come" card, top of Raids, live throughout\n'
'   S.end===1 (later Batch D patches replace it with the battle/ending surfaces).\n'
'   ENGAGE is disabled with a repair hint below the same 0.15 hull threshold the\n'
'   ordinary raid/assault ENGAGE buttons already use - see this patch\'s header. */\n'
'function renderEndCard(){\n'
'  const host=$("#endCard"); if(!host)return;\n'
'  if(S.end!==1){ if(host.innerHTML)host.innerHTML=""; return; }\n'
'  const lowHull=S.fhp<0.15;\n'
'  host.innerHTML=`<div class="thrc endc">\n'
'    <h5>VEGA\'S FLEET HOLDS SOL REACH</h5>\n'
'    <p>The turn has come. Production keeps running \\u2014 the final battle is yours to choose, whenever you\'re ready.</p>\n'
'    <button class="thrgo" id="endEngage" ${lowHull?"disabled":""}>ENGAGE</button>\n'
'    ${lowHull?\'<div class="thrnote">Fleet too damaged \\u2014 let it repair.</div>\':""}\n'
'  </div>`;\n'
'  const b=$("#endEngage"); if(b)b.onclick=()=>startFinalBattle();\n'
'}\n'
)
h=h.replace(old_thqclock,new_thqclock,1)

old_renderraids='function renderRaids(){\n  renderThreat(); renderRivalBars();\n'
assert h.count(old_renderraids)==1
new_renderraids='function renderRaids(){\n  renderEndCard(); renderThreat(); renderRivalBars();\n'
h=h.replace(old_renderraids,new_renderraids,1)

# ================= dev panel: START FINALE / RESET ENDING =================
old_devaction=(
'  else if(k==="introReplay"){\n'
'    /* preview only - does not set S.seen.intro or queue vega:boot when it ends,\n'
'       same "does not persist" rule SHOW/REPLAY ALL already use for VEGA beats */\n'
'    playScene(STORY.intro,{skip:true,onDone:()=>toast("DEV \\u2014 intro replay done","y")});\n'
'  }\n'
'  dirty=true; renderAll(); save(); devInfo();\n'
)
assert h.count(old_devaction)==1
new_devaction=(
'  else if(k==="introReplay"){\n'
'    /* preview only - does not set S.seen.intro or queue vega:boot when it ends,\n'
'       same "does not persist" rule SHOW/REPLAY ALL already use for VEGA beats */\n'
'    playScene(STORY.intro,{skip:true,onDone:()=>toast("DEV \\u2014 intro replay done","y")});\n'
'  }\n'
'  else if(k==="startFinale"){\n'
'    /* gets to the turn fast for testing, without a real Nodes grind - grants\n'
'       pj1-pj3 and holds Nyx if needed, then calls the real thing. Deliberately does\n'
'       NOT set S.nx.pjx itself: S.end===1 already shows every Nexus card SEIZED\n'
'       regardless of pjx\'s own owned/locked state, so the two are never visually\n'
'       inconsistent. */\n'
'    S.nx.pj1=Math.max(S.nx.pj1||0,1);\n'
'    S.nx.pj2=Math.max(S.nx.pj2||0,1);\n'
'    S.nx.pj3=Math.max(S.nx.pj3||0,1);\n'
'    if(!sysHeld("nyx"))S.sys.nyx={b:{}};\n'
'    startFinale();\n'
'  }\n'
'  else if(k==="resetEnding"){\n'
'    /* every suspension above reads S.end live (nexLv/queueNotice/renderNex/the\n'
'       rival ticks), so un-setting it is the whole restore; clearing S.nx.pjx lets\n'
'       the owner buy (and re-trigger) the turn again for testing. */\n'
'    S.end=0;\n'
'    if(S.nx)S.nx.pjx=0;\n'
'    toast("DEV \\u2014 ending reset","y");\n'
'  }\n'
'  dirty=true; renderAll(); save(); devInfo();\n'
)
h=h.replace(old_devaction,new_devaction,1)

# ================= adopt(): purge queued VEGA notices for a save loaded at S.end>=1 =================
old_adopttail=(
'  if((S.xpn||0)>=60 && pendingLevels()===0)S.seen.xpHow=true;\n'
'  return true;\n'
'}\n'
'function offlineReport(){\n'
)
assert h.count(old_adopttail)==1
new_adopttail=(
'  if((S.xpn||0)>=60 && pendingLevels()===0)S.seen.xpHow=true;\n'
'  /* patch589: a save loaded at S.end>=1 (the turn already happened) never gets the\n'
'     advisor back - belt and braces for a save written before this guard existed. */\n'
'  if(S.end>=1)purgeVegaNotices();\n'
'  return true;\n'
'}\n'
'function offlineReport(){\n'
)
h=h.replace(old_adopttail,new_adopttail,1)

# ================= BUILD =================
old_build="const BUILD=588;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=589;",1)

# ================= __SD export =================
old_exp1='  nexLv,startFinale,PJ1_MUL,PJ2_MUL,PJ3_MUL,\n'
assert h.count(old_exp1)==1
h=h.replace(old_exp1,'  nexLv,startFinale,startFinalBattle,PJ1_MUL,PJ2_MUL,PJ3_MUL,renderNex,offlineEff,\n',1)

old_exp2='  defEnemyXY,renderThreat,renderRivalBars,get DT(){return DT},\n'
assert h.count(old_exp2)==1
h=h.replace(old_exp2,'  defEnemyXY,renderThreat,renderRivalBars,renderEndCard,get DT(){return DT},\n',1)

old_exp3='  VEGA,VEGA_NAME,NOTICES,queueNotice,checkUnlocks,dismissNotice,\n'
assert h.count(old_exp3)==1
h=h.replace(old_exp3,'  VEGA,VEGA_NAME,NOTICES,queueNotice,purgeVegaNotices,checkUnlocks,dismissNotice,\n',1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch589 applied")
