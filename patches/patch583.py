import io

"""patch583 - PLAN-ending.md Batch B, item 2: Project nodes.

NEXUS entries gain two optional fields: `cur` (spend currency, default "dm" same as
today - only the three new nodes set it to "en") and `req` (the id of another NEXUS
node that must be OWNED - at its max, which is 1 for every req'd node so far - before
this one can be bought). Threaded through the same three functions RESH's own
`cur:"sv"` branch already threads through (nexCur/nexBal, mirroring resCur/resBal;
nexCost/buyNex keep reading/writing the REAL level exactly as before, the plan is
explicit that cost/level display never goes through the coming nexLv() helper).

Three new max:1 nodes, priced in Exotic Nodes, each gated on the one before it via
`req` (nexOwned/nexLocked, new - RESH's own resLocked() takes a `{id,lv}` req object
because a research branch can require a MID-branch level; every NEXUS req here only
ever means "the prior node's single level", so a plain node-id string is enough,
per the plan's own wording):
  pj1 Resonance Array  - 60 Nodes            - x1.25 exotic production
  pj2 Deep Lattice     - 250 Nodes, req pj1  - x1.25 fleet damage & hull
  pj3 Sovereign Key    - 900 Nodes, req pj2  - x1.5 ore production
Names/effects placeholder-ish, numbers TUNING-PENDING (PJ1_MUL/PJ2_MUL/PJ3_MUL,
next to the array). The multipliers themselves are NOT wired in this patch - that is
next (patch584, alongside nexLv()) so each patch stays one purpose; buying a node here
already has a visible, correct effect description, it just does not move a number yet.

renderNex() now renders in two parts: the five existing DM cards exactly as before
(untouched code path, `cur!=="en"` skips the new branch entirely), then - only once
`S.en>0||enRate()>0` (the same "ever produced/held" test the strip itself uses, so
the whole section cannot flicker hidden again just because the bank was spent down) -
a "THE PROJECT" divider (`.sechead`, same class the Market page's dividers use) and
all three cards. A card whose `req` is not yet owned renders LOCKED (reuses the
research tree's look: a leading lock glyph, a new `.card.locked` CSS rule doing the
same opacity+greyscale `.rn.lockb`/`.g.locked` already do, its cost button replaced by
a disabled "LOCKED" one and its effect line by nexReqText() - mirrors resReqText()).

The two "Nexus levels" DM-total displays (header #vDmS pill and the Dark Matter stats
row) are explicitly a DARK MATTER figure ("Spend Dark Matter in the Nexus" / paired
with "Earned all-time" DM) - Project nodes are bought with a different currency
entirely, so both sums now skip any `cur:"en"` entry rather than counting it (the
plan's own "say which" call)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- CSS: .card.locked, reusing the opacity+greyscale idiom .g.locked/.rn.lockb use ----
old_css='.card.done{border-color:rgba(168,120,255,.45);background:rgba(60,40,110,.28)}\n'
assert h.count(old_css)==1
new_css=old_css+'.card.locked{opacity:.5;filter:grayscale(.4)}\n'
h=h.replace(old_css,new_css,1)

# ---- data: three Project nodes appended to NEXUS ----
old_nexus=(
' {id:"war", n:"War Doctrine",       max:15, c:16, cg:1.532,  d:lv=>"×"+fmt(Math.pow(1.3,lv))+" fleet damage & hull", t:"Permanent multiplier on every warship you field."}\n'
'];\n'
)
assert h.count(old_nexus)==1
new_nexus=(
' {id:"war", n:"War Doctrine",       max:15, c:16, cg:1.532,  d:lv=>"×"+fmt(Math.pow(1.3,lv))+" fleet damage & hull", t:"Permanent multiplier on every warship you field."},\n'
' /* ---- THE PROJECT (patch583): priced in Exotic Nodes, each gated on owning the\n'
'    one before it. Names/effects placeholder-ish; PJ1_MUL/PJ2_MUL/PJ3_MUL (below,\n'
'    where they are actually applied - patch584) are TUNING-PENDING. */\n'
' {id:"pj1", n:"Resonance Array", max:1, c:60,  cg:1, cur:"en",\n'
'  d:lv=>lv?"\\u00d71.25 exotic production":"No bonus yet",\n'
'  t:"Feeds a fraction of every Node straight back into the exotic lattices that made it."},\n'
' {id:"pj2", n:"Deep Lattice", max:1, c:250, cg:1, cur:"en", req:"pj1",\n'
'  d:lv=>lv?"\\u00d71.25 fleet damage & hull":"No bonus yet",\n'
'  t:"Reinforces every hull in the fleet along the same lattice the Array first opened."},\n'
' {id:"pj3", n:"Sovereign Key", max:1, c:900, cg:1, cur:"en", req:"pj2",\n'
'  d:lv=>lv?"\\u00d71.5 ore production":"No bonus yet",\n'
'  t:"Something in it reads the whole map at once. Ore comes easier wherever it is watching."}\n'
'];\n'
)
h=h.replace(old_nexus,new_nexus,1)

# ---- nexCur/nexBal/nexOwned/nexLocked/nexReqText, next to nexCost ----
old_nexcost='function nexCost(r,l){ if(l===undefined)l=lv(S.nx,r.id);\n  return Math.ceil(r.c*Math.pow(r.cg,l)) }\n'
assert h.count(old_nexcost)==1
new_nexcost=(
'/* cur:"en" nodes spend Exotic Nodes instead of Dark Matter - same shape as RESH\'s\n'
'   own resCur()/resBal() pair for cur:"sv". */\n'
'function nexCur(r){ return r.cur||"dm" }\n'
'function nexBal(r){ return nexCur(r)==="en" ? (S.en||0) : S.dm }\n'
'/* every NEXUS req so far names a max:1 node, so "owned" only ever means "bought" -\n'
'   a plain node id is enough (unlike RESH\'s req, which can name a level partway\n'
'   through a longer branch and so needs a {id,lv} pair). */\n'
'function nexOwned(id){ return lv(S.nx,id)>=1 }\n'
'function nexLocked(r){ return r.req ? !nexOwned(r.req) : false }\n'
'function nexReqText(r){ if(!r.req)return ""; const src=NEXUS.find(x=>x.id===r.req);\n'
'  return "Requires "+(src?src.n:r.req) }\n'
+old_nexcost
)
h=h.replace(old_nexcost,new_nexcost,1)

# ---- buyNex(): spend the right currency, respect the lock ----
old_buynex=(
'function buyNex(r){\n'
'  const l=lv(S.nx,r.id); if(l>=r.max)return false;\n'
'  const c=nexCost(r,l);\n'
'  if(S.dm<c)return false;\n'
'  S.dm-=c; S.nx[r.id]=l+1; blip(400,.22,"sine",.06);\n'
'  toast(r.n+" → level "+(l+1),"y"); dirty=true; renderNex(); return true;\n'
'}\n'
)
assert h.count(old_buynex)==1
new_buynex=(
'function buyNex(r){\n'
'  const l=lv(S.nx,r.id); if(l>=r.max)return false;\n'
'  if(nexLocked(r))return false;\n'
'  const c=nexCost(r,l);\n'
'  if(nexBal(r)<c)return false;\n'
'  if(nexCur(r)==="en")S.en-=c; else S.dm-=c;\n'
'  S.nx[r.id]=l+1; blip(400,.22,"sine",.06);\n'
'  toast(r.n+" → level "+(l+1),"y"); dirty=true; renderNex(); return true;\n'
'}\n'
)
h=h.replace(old_buynex,new_buynex,1)

# ---- renderNex(): DM cards unchanged, THE PROJECT section appended ----
old_rendernex=(
'function renderNex(){\n'
'  const host=$("#nex"); host.innerHTML="";\n'
'  NEXUS.forEach(r=>{\n'
'    const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l);\n'
'    const d=document.createElement("div"); d.className="card"+(max?" done":"");\n'
'    d.innerHTML=`<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'      <p>${r.t}</p><div class="eff">${r.d(l)}${max?"":" → "+r.d(l+1)}</div>\n'
'      ${max?\'<button disabled>MAXED</button>\':`<button data-cost="${c}" data-cur="dm">${fmt(c)} ${RI(\'dm\')}</button>`}`;\n'
'    if(!max)d.querySelector("button").onclick=()=>buyNex(r);\n'
'    host.appendChild(d);\n'
'  });\n'
'  softButtons();\n'
'}\n'
)
assert h.count(old_rendernex)==1
new_rendernex=(
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
'      const d=document.createElement("div");\n'
'      d.className="card"+(max?" done":"")+(locked?" locked":"");\n'
'      d.innerHTML=`<h5>${locked?"\\ud83d\\udd12 ":""}${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'        <p>${r.t}</p>\n'
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
h=h.replace(old_rendernex,new_rendernex,1)

# ---- #vDmS header pill: DM Nexus-level total excludes cur:"en" nodes ----
old_vdms='  { const e=$("#vDmS"); const spent=NEXUS.reduce((a,x)=>a+lv(S.nx,x.id),0);\n'
assert h.count(old_vdms)==1
new_vdms='  { const e=$("#vDmS"); const spent=NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:lv(S.nx,x.id)),0);\n'
h=h.replace(old_vdms,new_vdms,1)

# ---- Dark Matter stats row: same exclusion ----
old_stats=(
'             ["Nexus levels",String(NEXUS.reduce((a,x)=>a+lv(S.nx,x.id),0))+" / "+\n'
'               String(NEXUS.reduce((a,x)=>a+x.max,0))],\n'
)
assert h.count(old_stats)==1
new_stats=(
'             ["Nexus levels",String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:lv(S.nx,x.id)),0))+" / "+\n'
'               String(NEXUS.reduce((a,x)=>a+(x.cur==="en"?0:x.max),0))],\n'
)
h=h.replace(old_stats,new_stats,1)

# ---- BUILD ----
old_build="const BUILD=582;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=583;",1)

# ---- __SD export ----
old_exp="  enRate,EN_RING3,EN_RING4,EN_COL,\n"
assert h.count(old_exp)==1
new_exp=old_exp+"  nexCur,nexBal,nexOwned,nexLocked,nexReqText,\n"
h=h.replace(old_exp,new_exp,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch583 applied")
