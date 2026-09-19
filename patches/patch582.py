import io

"""patch582 - PLAN-ending.md Batch B, item 1: Exotic Nodes resource.

Owner decision 3: Exotic Nodes trickle from held ring-3/ring-4 systems, no new verb -
so this is the same shape as the four EXO kinds (a passive tick() accrual, an
offline-catch-up, a strip entry) but deliberately kept a completely separate resource
(`S.en` banked float, `S.enAll` lifetime total) rather than a fifth EXO row: EXO/exo()/
exoRate() are keyed by SYS.res (one exotic per system TYPE, summed via sysExoRate()'s
GENS ladder scan) and Market's mktSvKinds() walks EXO directly to build its sell
cards - Nodes are keyed by RING instead (any held ring-3/4 system counts, regardless
of what it mines) and must never be sellable, so leaving EXO/S.exo alone entirely and
never touching mktSvKinds() satisfies "not sellable in Market" by construction, not by
an extra guard.

Rate: EN_RING3 Nodes/hour per held ring-3 system, EN_RING4/hour per ring-4 (heldSystems()
already excludes home and, via sysHeld(), any occupied system - occupied production
stops the same as it does for ore/exotics). enRate() converts that to a per-second
figure, dropped right after heldSystems() (the code map's own suggested spot, and the
one function enRate() itself calls). Both tunables marked TUNING-PENDING per house
rules, along with the strip's own colour.

tick(dt) accrues it right beside the existing EXO loop (same "beside", not inside -
Nodes are not an EXO entry). offlineReport() catches it up the exact same way ore/cry
already are - same `t`/`eff` (offlineCapH()/offlineEff()), added to the early-return
gate alongside ore/cry so an offline stretch that earned ONLY Nodes still shows a
report - and gets its own modal line, shown only when >0.

Display: a 5th, distinctly-coloured entry appended to #exoStrip by renderExoStrip(),
hidden until S.en>0 or enRate()>0 - same "held" idea the four EXO entries already use,
which in practice means it never goes hidden again once any ring-3/4 system has ever
been claimed (production does not stop just because the bank was spent down to 0 -
nothing spends it yet anyway; patch583 is what gives it a sink).

fresh() gets en:0/enAll:0 grouped with the other currencies; adopt() clamps both to
finite non-negative numbers and enforces enAll>=en (a lifetime total can never be
smaller than what is currently banked)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- fresh(): en/enAll, grouped with the other currencies ----
old_fresh='    ore:0,cry:0,dm:0, all:0, dmAll:0, xpn:0, xf:{},\n'
assert h.count(old_fresh)==1
new_fresh='    ore:0,cry:0,dm:0,en:0,enAll:0, all:0, dmAll:0, xpn:0, xf:{},\n'
h=h.replace(old_fresh,new_fresh,1)

# ---- adopt(): sanitise en/enAll, right by the existing exo sanitiser ----
old_adopt=(
'  if(!f.exo||typeof f.exo!=="object")f.exo={};\n'
'  for(const k in f.exo){ if(!EXO.some(e=>e.id===k)||!(f.exo[k]>0))delete f.exo[k] }\n'
)
assert h.count(old_adopt)==1
new_adopt=old_adopt+(
'  /* Exotic Nodes (patch582): a separate resource from S.exo, not one of EXO -\n'
'     see the header note on why. enAll is a lifetime total and can never sit\n'
'     below what is currently banked. */\n'
'  f.en=Math.max(0,+f.en||0);\n'
'  f.enAll=Math.max(0,+f.enAll||0); if(f.enAll<f.en)f.enAll=f.en;\n'
)
h=h.replace(old_adopt,new_adopt,1)

# ---- enRate() + tunables, right after heldSystems() ----
old_held='function heldSystems(){ return SYS.filter(s=>!s.home&&sysHeld(s.id)) }\n'
assert h.count(old_held)==1
new_held=old_held+(
'/* ---------------- Exotic Nodes (patch582) ----------------\n'
'   Owner decision 3: no new verb - Nodes just trickle from held ring-3/4 systems,\n'
'   regardless of what they mine. Kept OUT of the EXO/S.exo machinery on purpose\n'
'   (see the patch header) so Market can never list them without extra guarding. */\n'
'const EN_RING3=1, EN_RING4=3;   /* TUNING-PENDING: Nodes/hour per held system, by ring */\n'
'const EN_COL="#5affc2";         /* TUNING-PENDING: own colour, distinct from all 4 EXO cols */\n'
'function enRate(){\n'
'  let r3=0,r4=0;\n'
'  for(const s of heldSystems()){ if(s.ring===3)r3++; else if(s.ring===4)r4++; }\n'
'  return (r3*EN_RING3+r4*EN_RING4)/3600;\n'
'}\n'
)
h=h.replace(old_held,new_held,1)

# ---- tick(dt): accrue beside the EXO loop ----
old_tick=(
'  for(const e of EXO){ const r=exoRate(e.id); if(r>0)S.exo[e.id]=exo(e.id)+r*dt;\n'
'    if(exo(e.id)>0)(S.exoSeen=S.exoSeen||{})[e.id]=true; }\n'
'  const c=cryRate(); if(c>0)S.cry+=c*dt;\n'
)
assert h.count(old_tick)==1
new_tick=(
'  for(const e of EXO){ const r=exoRate(e.id); if(r>0)S.exo[e.id]=exo(e.id)+r*dt;\n'
'    if(exo(e.id)>0)(S.exoSeen=S.exoSeen||{})[e.id]=true; }\n'
'  const enR=enRate(); if(enR>0){ S.en+=enR*dt; S.enAll+=enR*dt; }\n'
'  const c=cryRate(); if(c>0)S.cry+=c*dt;\n'
)
h=h.replace(old_tick,new_tick,1)

# ---- offlineReport(): catch-up, gate, display line ----
old_off_calc='  const ore=rate()*t*eff, cry=cryRate()*t*eff;\n'
assert h.count(old_off_calc)==1
new_off_calc='  const ore=rate()*t*eff, cry=cryRate()*t*eff, en=enRate()*t*eff;\n'
h=h.replace(old_off_calc,new_off_calc,1)

old_off_gate='  if(ore<=0&&cry<=0&&!fought.length&&!claims.length&&!occupied.length)return;\n'
assert h.count(old_off_gate)==1
new_off_gate='  if(ore<=0&&cry<=0&&en<=0&&!fought.length&&!claims.length&&!occupied.length)return;\n'
h=h.replace(old_off_gate,new_off_gate,1)

old_off_apply='  S.ore+=ore;S.all+=ore;S.cry+=cry;\n'
assert h.count(old_off_apply)==1
new_off_apply='  S.ore+=ore;S.all+=ore;S.cry+=cry;S.en+=en;S.enAll+=en;\n'
h=h.replace(old_off_apply,new_off_apply,1)

old_off_line='   ${cry>0?`<div style="font:700 16px/1.2 ui-monospace,monospace;color:var(--vi)">+${fmt(cry)} ${RI("cry")}</div>`:""}\n'
assert h.count(old_off_line)==1
new_off_line=old_off_line+(
'   ${en>0?`<div style="font:700 16px/1.2 ui-monospace,monospace;color:'+"${EN_COL}"+'">+${fmt(en)} Exotic Nodes</div>`:""}\n'
)
h=h.replace(old_off_line,new_off_line,1)

# ---- renderExoStrip(): 5th entry ----
old_strip=(
'function renderExoStrip(){\n'
'  const strip=$("#exoStrip");\n'
'  if(!strip)return;\n'
'  strip.innerHTML=EXO.map(e=>{\n'
'    const r=exoRate(e.id), have=exo(e.id), held=r>0||have>0;\n'
'    return `<div class="exi${held?" held":""}" style="--a:${e.col}" title="${e.n}">\n'
'      <i class="exdot"></i>${held?`<b>${fmt(have)}</b><span>${r>0?"+"+fmt(r)+"/s":""}</span>`:""}</div>`;\n'
'  }).join("");\n'
'}\n'
)
assert h.count(old_strip)==1
new_strip=(
'function renderExoStrip(){\n'
'  const strip=$("#exoStrip");\n'
'  if(!strip)return;\n'
'  let html=EXO.map(e=>{\n'
'    const r=exoRate(e.id), have=exo(e.id), held=r>0||have>0;\n'
'    return `<div class="exi${held?" held":""}" style="--a:${e.col}" title="${e.n}">\n'
'      <i class="exdot"></i>${held?`<b>${fmt(have)}</b><span>${r>0?"+"+fmt(r)+"/s":""}</span>`:""}</div>`;\n'
'  }).join("");\n'
'  /* Exotic Nodes: a 5th strip entry, own colour, hidden until the first ring-3/4\n'
'     claim ever produces or produced one - see enRate()\'s header comment. */\n'
'  const enR=enRate(), enHave=S.en||0;\n'
'  if(enR>0||enHave>0){\n'
'    html+=`<div class="exi held" style="--a:${EN_COL}" title="Exotic Nodes">\n'
'      <i class="exdot"></i><b>${fmt(enHave)}</b><span>${enR>0?"+"+fmt(enR)+"/s":""}</span></div>`;\n'
'  }\n'
'  strip.innerHTML=html;\n'
'}\n'
)
h=h.replace(old_strip,new_strip,1)

# ---- BUILD ----
old_build="const BUILD=581;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=582;",1)

# ---- __SD export: enRate, EN_RING3/EN_RING4/EN_COL ----
old_exp="  sysHeld,sysOpen,sysExoRate,sysOreRate,\n"
assert h.count(old_exp)==1
new_exp="  sysHeld,sysOpen,sysExoRate,sysOreRate,\n  enRate,EN_RING3,EN_RING4,EN_COL,\n"
h=h.replace(old_exp,new_exp,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch582 applied")
