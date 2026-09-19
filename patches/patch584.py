import io

"""patch584 - PLAN-ending.md Batch B, item 3: the ??? node.

Two independent pieces, both small enough for one patch (the plan calls them out
together under "584 - the ??? node"):

1. `nexLv(id)` - a one-line wrapper around `lv(S.nx,id)` that every EFFECT read of a
   Nexus level now goes through instead of calling `lv(S.nx,...)` directly: fleetMult
   ("war"), globalMul ("ent"), cryRate ("syn"), offlineEff ("chr"), tick's auto-scan
   ("ovs"), and the two new pj1/pj2/pj3 multipliers this same patch adds. Batch D's
   finale suspension (S.end>=1 -> every Nexus bonus reads 0, "SEIZED") is not built
   yet - this patch does NOT touch S.end inside nexLv() at all, exactly as the plan
   says not to - but every site Batch D needs to suspend now goes through the one
   function, so that batch only ever has to edit nexLv() itself. Deliberately NOT
   routed: nexCost/buyNex/renderNex/nexOwned and the two DM "Nexus levels" totals -
   the plan is explicit that cost/level display always reads the real level, never
   the (eventually suspendable) effective one.

   The three Project multipliers land at the exact spots the code map names, and
   each one is confirmed single-purpose by re-reading the function it joins:
     - pj1 x1.25 exotic production -> sysExoRate() (already exotic-only; loom's own
       multiplier lives right there for the same reason).
     - pj2 x1.25 fleet damage & hull -> fleetMult(), which already feeds BOTH
       fleetDPS() and fleetHPMax() - matching "war"'s own "fleet damage & hull"
       description, so one multiplier in one function covers both stats exactly
       like the plan's "same functions the existing nodes use" says.
     - pj3 x1.5 ore production -> globalMul(). Checked (not assumed) whether this
       hook is ore-only before touching it: ladderRate()/ladderPerUnit() already
       gate `*globalMul()` behind `GENS[gi].kind==="ore"` - exotic (kind-ladder) rows
       return `c*GENS[gi].r` with NO globalMul() in the expression at all (the
       2026-09-09 "exotics off the ore multiplier stack" pass already took care of
       this, see sysExoRate's own header comment). So globalMul() was already
       ore-only going in; pj3 needed no extra guarding to keep it that way.

2. The ??? node itself: `pjx`, max:1, 1500 Nodes, `req:"pj3"` PLUS "Nyx held"
   (`sysHeld("nyx")`) - a second condition no other NEXUS node has, so nexLocked()/
   nexReqText() special-case `r.id==="pjx"` rather than growing a generic
   two-requirement schema for a node that is the only one that will ever need it.
   Title is the literal string "???" (r.n - static, like every other card's name).
   Description is `STORY.nodeHint`, ALWAYS (not only while locked) - pulled in
   renderNex() rather than stored on the NEXUS entry itself, since NEXUS is a
   top-level const evaluated before STORY exists further down the file (a `t:`
   string, unlike `d:`, is not lazy - referencing STORY.nodeHint inside the object
   literal would be a TDZ ReferenceError at load). The requirements line
   ("Requires Sovereign Key · Requires Nyx") is nexReqText()'s own pjx special case,
   shown only while locked, same slot pj2/pj3's single-requirement text already
   uses. Buying it (buyNex(), on a successful pjx purchase only) calls
   `startFinale()` - in this patch a stub that sets `S.end=1` and toasts; Batch D
   fills it in for real. `S.end` (0 none, 1 finale, 2 won) is added to fresh()
   (grouped with the other scalar flags) and clamped to [0,2] in adopt()."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- fresh(): S.end ----
old_fresh='    cseed:1, bestCmb:0, flags:0,\n'
assert h.count(old_fresh)==1
new_fresh='    cseed:1, bestCmb:0, flags:0, end:0,\n'
h=h.replace(old_fresh,new_fresh,1)

# ---- adopt(): clamp S.end to [0,2] ----
old_adopt='    f.lvl=Math.max(1,Math.min(LVMAX,Math.floor(f.lvl||1)));\n'
assert h.count(old_adopt)==1
new_adopt=old_adopt+(
'    /* 0 none, 1 finale, 2 won (patch584) - Batch D is what ever sets 1 or 2 */\n'
'    f.end=Math.max(0,Math.min(2,Math.floor(f.end||0)));\n'
)
h=h.replace(old_adopt,new_adopt,1)

# ---- STORY: nodeHint ----
old_story='  intro:[\n'
assert h.count(old_story)==1
new_story=(
'  nodeHint:"You\'ll see.", /* PLACEHOLDER */\n'
'  intro:[\n'
)
h=h.replace(old_story,new_story,1)

# ---- data: pjx appended to NEXUS ----
old_nexus=(
' {id:"pj3", n:"Sovereign Key", max:1, c:900, cg:1, cur:"en", req:"pj2",\n'
'  d:lv=>lv?"\\u00d71.5 ore production":"No bonus yet",\n'
'  t:"Something in it reads the whole map at once. Ore comes easier wherever it is watching."}\n'
'];\n'
)
assert h.count(old_nexus)==1
new_nexus=(
' {id:"pj3", n:"Sovereign Key", max:1, c:900, cg:1, cur:"en", req:"pj2",\n'
'  d:lv=>lv?"\\u00d71.5 ore production":"No bonus yet",\n'
'  t:"Something in it reads the whole map at once. Ore comes easier wherever it is watching."},\n'
' /* the ??? node (patch584) - req:"pj3" is only HALF its lock; nexLocked()/\n'
'    nexReqText() special-case "pjx" for the other half (Nyx held). Its own `t`\n'
'    is never read (renderNex() special-cases pjx to show STORY.nodeHint instead -\n'
'    see the patch header for why), kept here only so the object shape matches\n'
'    every other NEXUS entry. */\n'
' {id:"pjx", n:"???", max:1, c:1500, cg:1, cur:"en", req:"pj3",\n'
'  d:lv=>lv?"The turn begins.":"Unknown",\n'
'  t:""}\n'
'];\n'
)
h=h.replace(old_nexus,new_nexus,1)

# ---- nexLv(), next to the other nex* helpers ----
old_nexcur='function nexCur(r){ return r.cur||"dm" }\n'
assert h.count(old_nexcur)==1
new_nexcur=(
'/* every EFFECT read of a Nexus level goes through here (never cost/display, which\n'
'   always want the real level - see nexCost/buyNex/renderNex). A plain passthrough\n'
'   for now; Batch D\'s finale suspension (S.end>=1 -> every bonus reads 0) only has\n'
'   to change this one function when it lands. */\n'
'function nexLv(id){ return lv(S.nx,id) }\n'
+old_nexcur
)
h=h.replace(old_nexcur,new_nexcur,1)

# ---- nexLocked/nexReqText: pjx's second condition (Nyx held) ----
old_locked=(
'function nexOwned(id){ return lv(S.nx,id)>=1 }\n'
'function nexLocked(r){ return r.req ? !nexOwned(r.req) : false }\n'
'function nexReqText(r){ if(!r.req)return ""; const src=NEXUS.find(x=>x.id===r.req);\n'
'  return "Requires "+(src?src.n:r.req) }\n'
)
assert h.count(old_locked)==1
new_locked=(
'function nexOwned(id){ return lv(S.nx,id)>=1 }\n'
'function nexLocked(r){\n'
'  if(r.id==="pjx") return !nexOwned(r.req) || !sysHeld("nyx");\n'
'  return r.req ? !nexOwned(r.req) : false;\n'
'}\n'
'function nexReqText(r){\n'
'  if(!r.req)return "";\n'
'  const src=NEXUS.find(x=>x.id===r.req), reqName=src?src.n:r.req;\n'
'  if(r.id==="pjx") return "Requires "+reqName+" \\u00b7 Requires Nyx";\n'
'  return "Requires "+reqName;\n'
'}\n'
)
h=h.replace(old_locked,new_locked,1)

# ---- buyNex(): a successful pjx purchase starts the finale ----
old_buynex=(
'  S.nx[r.id]=l+1; blip(400,.22,"sine",.06);\n'
'  toast(r.n+" → level "+(l+1),"y"); dirty=true; renderNex(); return true;\n'
'}\n'
)
assert h.count(old_buynex)==1
new_buynex=(
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
h=h.replace(old_buynex,new_buynex,1)

# ---- renderNex(): pjx's description comes from STORY.nodeHint, not r.t ----
old_render=(
'    proj.forEach(r=>{\n'
'      const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l), locked=nexLocked(r);\n'
'      const d=document.createElement("div");\n'
'      d.className="card"+(max?" done":"")+(locked?" locked":"");\n'
'      d.innerHTML=`<h5>${locked?"\\ud83d\\udd12 ":""}${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'        <p>${r.t}</p>\n'
)
assert h.count(old_render)==1
new_render=(
'    proj.forEach(r=>{\n'
'      const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l), locked=nexLocked(r);\n'
'      const desc = r.id==="pjx" ? STORY.nodeHint : r.t;\n'
'      const d=document.createElement("div");\n'
'      d.className="card"+(max?" done":"")+(locked?" locked":"");\n'
'      d.innerHTML=`<h5>${locked?"\\ud83d\\udd12 ":""}${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'        <p>${desc}</p>\n'
)
h=h.replace(old_render,new_render,1)

# ---- effect application: pj1 (sysExoRate), pj2 (fleetMult), pj3 (globalMul) ----
old_exo=(
'function sysExoRate(id){\n'
'  let r=0;\n'
'  for(const gi of sysLadder(id)) if(GENS[gi].kind!=="ore") r+=ladderRate(id,gi);\n'
'  /* Loom Resonance ("\\u00d7N exotic yield everywhere") stays its OWN multiplier on top\n'
'     of the full ladderRate stack (globalMul included) rather than folding into\n'
'     globalMul itself - it is described as an exotic-only booster, and keeping it\n'
'     separate means buying it can never do anything to the ore side by accident. */\n'
'  return r*Math.pow(1.35,xlv("loom"));\n'
'}\n'
)
assert h.count(old_exo)==1
new_exo=old_exo.replace(
'  return r*Math.pow(1.35,xlv("loom"));\n}\n',
'  /* pj1 (patch584): same reasoning as Loom above - its own multiplier, not folded\n'
'     into globalMul(), so it can never touch ore either. */\n'
'  return r*Math.pow(1.35,xlv("loom"))*(nexLv("pj1")?PJ1_MUL:1);\n}\n'
)
assert new_exo!=old_exo
h=h.replace(old_exo,new_exo,1)

old_fleetmult=(
'function fleetMult(){ return Math.pow(1.3,lv(S.nx,"war"))*achBonus()*(1+0.04*pkl("war"))\n'
'  *Math.pow(CASC_EXP,xlv("casc")) }\n'
)
assert h.count(old_fleetmult)==1
new_fleetmult=(
'function fleetMult(){ return Math.pow(1.3,nexLv("war"))*achBonus()*(1+0.04*pkl("war"))\n'
'  *Math.pow(CASC_EXP,xlv("casc"))*(nexLv("pj2")?PJ2_MUL:1) }\n'
)
h=h.replace(old_fleetmult,new_fleetmult,1)

old_globalmul=(
'  m*=Math.pow(1.15,lv(S.rs,"drill"));\n'
'  m*=Math.pow(1.2,lv(S.nx,"ent"));\n'
'  m*=achBonus();\n'
)
assert h.count(old_globalmul)==1
new_globalmul=(
'  m*=Math.pow(1.15,lv(S.rs,"drill"));\n'
'  m*=Math.pow(1.2,nexLv("ent"));\n'
'  m*=(nexLv("pj3")?PJ3_MUL:1);   /* pj3 (patch584) - globalMul() is ore-only, see the patch header */\n'
'  m*=achBonus();\n'
)
h=h.replace(old_globalmul,new_globalmul,1)

# ---- the remaining two effect reads (syn, chr) + tick's ovs ----
old_syn='Math.pow(2,lv(S.nx,"syn"))\n'
assert h.count(old_syn)==1
h=h.replace(old_syn,'Math.pow(2,nexLv("syn"))\n',1)

old_chr='function offlineEff(){return 0.5+0.10*lv(S.nx,"chr")}\n'
assert h.count(old_chr)==1
h=h.replace(old_chr,'function offlineEff(){return 0.5+0.10*nexLv("chr")}\n',1)

old_ovs='  const ov=lv(S.nx,"ovs");\n'
assert h.count(old_ovs)==1
h=h.replace(old_ovs,'  const ov=nexLv("ovs");\n',1)

# ---- PJ1_MUL/PJ2_MUL/PJ3_MUL, right by the NEXUS array they extend ----
old_nexus_decl='const NEXUS=[\n'
assert h.count(old_nexus_decl)==1
new_nexus_decl=(
'const PJ1_MUL=1.25, PJ2_MUL=1.25, PJ3_MUL=1.5;   /* TUNING-PENDING: THE PROJECT bonuses */\n'
+old_nexus_decl
)
h=h.replace(old_nexus_decl,new_nexus_decl,1)

# ---- BUILD ----
old_build="const BUILD=583;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=584;",1)

# ---- __SD export ----
old_exp="  nexCur,nexBal,nexOwned,nexLocked,nexReqText,\n"
assert h.count(old_exp)==1
new_exp=old_exp+"  nexLv,startFinale,PJ1_MUL,PJ2_MUL,PJ3_MUL,\n"
h=h.replace(old_exp,new_exp,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch584 applied")
