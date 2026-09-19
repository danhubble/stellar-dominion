import io

"""patch587 - PLAN-ending.md Batch C, item 2: copy for the sabotage threat.

Mechanics landed in patch586 already work end to end using the generic threat-card/
map-node paths (they resolve correctly to Sol Reach's own name); this patch gives a
`kind:"sab"` threat its own voice, per the plan:

- Raids threat card: "<Rival> is moving on the Nexus", with the live Nodes-at-risk
  figure (floor(SAB_STEAL*S.en), the same number a loss would actually take - reusing
  SAB_STEAL from patch586 rather than a second copy of the fraction) instead of the
  ordinary "Level N defences" line, which would otherwise report home's own (always 0,
  see patch586) defence level as if it meant something. New `.thrc.sab` colour variant
  - same idea as the existing `.thrc.live` STAGE 3 rule, EN_COL-toned instead of gold
    so a sabotage card reads as "about the Nexus" at a glance among ordinary red ones.
- Map: a sab threat now shows the same "incoming" ring on Sol Reach's own node other
  threats already get on their target - the `!s.home` guard on that toggle predates
  any threat ever being able to name home, and was never meant to hide this case
  specifically (LF, the other half of that same toggle, still never targets home - see
  BRIEF-agents.md's own code-map note - so removing the guard cannot ever light up
  anything but a genuine sab entry). A Core-sector edge pill for every OTHER sector,
  same "point toward wherever the danger actually is" pattern renderMapEdge() already
  runs for LF/S.trip.
- First sabotage queues `rival:rvSab` (text already shipped in patch580) - the moment
  a sab entry is actually created, same place the ordinary `vega:threat` notice queues
  for every other threat."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- CSS: .thrc.sab, same pattern as the existing .thrc.live (STAGE 3) variant ----
old_css='.thrc.live{border-color:rgba(255,209,102,.55);background:rgba(255,209,102,.09)}  /* STAGE 3 */\n.thrc.live h5{color:#ffe9b8}\n.thrc.live .thrt{color:#ffe9b8}\n'
assert h.count(old_css)==1
new_css=old_css+(
'.thrc.sab{border-color:rgba(90,255,194,.55);background:rgba(90,255,194,.09)}  /* STAGE C */\n'
'.thrc.sab h5{color:#8dffda}\n'
'.thrc.sab .thrt{color:#8dffda}\n'
)
h=h.replace(old_css,new_css,1)

# ---- renderThreat(): a dedicated branch for kind:"sab" cards ----
old_rt=(
'function renderThreat(){\n'
'  const host=$("#thrCard"); if(!host)return;\n'
'  thqPrune();\n'
'  const q=thq();\n'
'  if(!q.length){ host.innerHTML=""; return }\n'
'  /* soonest to expire first: the queue is a to-do list, so it sorts by deadline */\n'
'  const list=q.slice().sort((a,b)=>a.t-b.t);\n'
'  host.innerHTML=list.map(th=>{\n'
'    const s=SYSMAP[th.sysId], rv=RIVALMAP[th.rv], b=RVBEH[th.rv]||RVBEH.hel;\n'
'    const od=Math.round(holdOdds(th)*100), dl=sdLv(s.id);\n'
'    const soon=th.t<3600;\n'
'    return `<div class="thrc${soon?" soon":""}" data-q="${th.id}">\n'
'      <h5>INCOMING — ${s.n}<span class="thrt">${thqClock(th.t)} left</span></h5>\n'
'      <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>\n'
'      <p>${b.flav} Hold the system for ${b.secs} seconds. Your shots take time to arrive — aim ahead of them.</p>\n'
'      <button class="thrgo" data-q="${th.id}">DEFEND ${s.n.toUpperCase()}</button>\n'
'      <button class="thrhold" data-q="${th.id}">HOLD THE LINE WITHOUT ME · ${od}%</button>\n'
'      <div class="thrnote">${dl\n'
'        ? "Level "+dl+" defences. Fighting it yourself pays roughly twice as much, and only you can lose the system."\n'
'        : "No defences here \\u2014 the garrison will struggle. Fortify it on the map, or fly it yourself."}\n'
'        When the clock runs out the garrison fights it for you.</div>\n'
'      </div>`;\n'
'  }).join("");'
)
assert h.count(old_rt)==1
new_rt=(
'function renderThreat(){\n'
'  const host=$("#thrCard"); if(!host)return;\n'
'  thqPrune();\n'
'  const q=thq();\n'
'  if(!q.length){ host.innerHTML=""; return }\n'
'  /* soonest to expire first: the queue is a to-do list, so it sorts by deadline */\n'
'  const list=q.slice().sort((a,b)=>a.t-b.t);\n'
'  host.innerHTML=list.map(th=>{\n'
'    const s=SYSMAP[th.sysId], rv=RIVALMAP[th.rv], b=RVBEH[th.rv]||RVBEH.hel;\n'
'    const od=Math.round(holdOdds(th)*100);\n'
'    const soon=th.t<3600;\n'
'    /* STAGE C (patch587): a sab card names the Nexus, not a system, and shows what a\n'
'       loss would actually take rather than home\'s own (always 0, see patch586)\n'
'       defence level - the same number holdResolve()/endDefence() would really steal. */\n'
'    if(th.kind==="sab"){\n'
'      const atRisk=Math.floor(SAB_STEAL*(S.en||0));\n'
'      const bestSd=bestHeldSdLv();\n'
'      return `<div class="thrc sab${soon?" soon":""}" data-q="${th.id}">\n'
'        <h5>INCOMING — THE NEXUS<span class="thrt">${thqClock(th.t)} left</span></h5>\n'
'        <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>\n'
'        <p>${rv?rv.n:"A rival"} is moving on the Nexus. ${atRisk>0\n'
'          ? fmt(atRisk)+" Nodes at risk."\n'
'          : "No Nodes banked \\u2014 nothing to lose yet."} Hold for ${b.secs} seconds.</p>\n'
'        <button class="thrgo" data-q="${th.id}">DEFEND THE NEXUS</button>\n'
'        <button class="thrhold" data-q="${th.id}">HOLD THE LINE WITHOUT ME · ${od}%</button>\n'
'        <div class="thrnote">${bestSd>0\n'
'          ? "Your strongest garrison falls back to defend it."\n'
'          : "No garrison to fall back on \\u2014 fortify a system, or fly it yourself."}\n'
'          When the clock runs out the garrison fights it for you.</div>\n'
'        </div>`;\n'
'    }\n'
'    const dl=sdLv(s.id);\n'
'    return `<div class="thrc${soon?" soon":""}" data-q="${th.id}">\n'
'      <h5>INCOMING — ${s.n}<span class="thrt">${thqClock(th.t)} left</span></h5>\n'
'      <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>\n'
'      <p>${b.flav} Hold the system for ${b.secs} seconds. Your shots take time to arrive — aim ahead of them.</p>\n'
'      <button class="thrgo" data-q="${th.id}">DEFEND ${s.n.toUpperCase()}</button>\n'
'      <button class="thrhold" data-q="${th.id}">HOLD THE LINE WITHOUT ME · ${od}%</button>\n'
'      <div class="thrnote">${dl\n'
'        ? "Level "+dl+" defences. Fighting it yourself pays roughly twice as much, and only you can lose the system."\n'
'        : "No defences here \\u2014 the garrison will struggle. Fortify it on the map, or fly it yourself."}\n'
'        When the clock runs out the garrison fights it for you.</div>\n'
'      </div>`;\n'
'  }).join("");'
)
h=h.replace(old_rt,new_rt,1)

# ---- renderMap(): let a sab threat light up Sol Reach's own node like any other ----
old_inc='    el.classList.toggle("incoming",held&&!s.home&&(!!thqAt(s.id)||(LF&&LF.sysId===s.id)));  /* STAGE 2 (2C) + STAGE 3 live fleet */\n'
assert h.count(old_inc)==1
new_inc=(
'    /* STAGE C: the !s.home guard predates any threat being able to target home at all -\n'
'       a sab entry (patch586) is the one legitimate case, and LF (the other half of this\n'
'       same check) structurally never targets home, so dropping the guard cannot light\n'
'       this up for anything else. */\n'
'    el.classList.toggle("incoming",held&&(!!thqAt(s.id)||(LF&&LF.sysId===s.id)));  /* STAGE 2 (2C) + STAGE 3 live fleet + STAGE C sab */\n'
)
h=h.replace(old_inc,new_inc,1)

# ---- renderMapEdge(): a Core-pointing pill when a live sab threat exists and the
#      player is looking at a different sector - same pattern as the LF/S.trip pills ----
old_edge=(
'  const trip=S.trip;\n'
'  if(trip){\n'
'    const s=SYSMAP[trip.sysId];\n'
'    if(s && s.sec!==mapSec){\n'
'      const left=s.sec<mapSec;\n'
'      const arrived=tripArrived(trip);\n'
'      html+=`<div class="edgewarn trip${left?" left":""}" style="top:40%">${\n'
'        arrived?"FLEET ARRIVED":"FLEET EN ROUTE"} — ${\n'
'        s.n.toUpperCase()} (${(SECTORS[s.sec]||{tag:"?"}).tag})</div>`;\n'
'    }\n'
'  }\n'
'  host.innerHTML=html;\n'
'}'
)
assert h.count(old_edge)==1
new_edge=(
'  const trip=S.trip;\n'
'  if(trip){\n'
'    const s=SYSMAP[trip.sysId];\n'
'    if(s && s.sec!==mapSec){\n'
'      const left=s.sec<mapSec;\n'
'      const arrived=tripArrived(trip);\n'
'      html+=`<div class="edgewarn trip${left?" left":""}" style="top:40%">${\n'
'        arrived?"FLEET ARRIVED":"FLEET EN ROUTE"} — ${\n'
'        s.n.toUpperCase()} (${(SECTORS[s.sec]||{tag:"?"}).tag})</div>`;\n'
'    }\n'
'  }\n'
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
'}'
)
h=h.replace(old_edge,new_edge,1)

# ---- rvMaybeThreat(): first sabotage queues rival:rvSab, same spot vega:threat queues
#      for every other threat ----
old_launch=(
'    if(sab)entry.kind="sab";\n'
'    thq().push(entry);\n'
'    queueNotice("vega:threat");\n'
'    S.thrCd=RV_MINGAP;\n'
'    toast(b.warn+" "+(sab?SYSMAP.home.n:s.n)+" \\u2014 you have a day to answer","r");\n'
)
assert h.count(old_launch)==1
new_launch=(
'    if(sab)entry.kind="sab";\n'
'    thq().push(entry);\n'
'    queueNotice("vega:threat");\n'
'    if(sab)queueRivalNotice("rvSab");\n'
'    S.thrCd=RV_MINGAP;\n'
'    toast(b.warn+" "+(sab?SYSMAP.home.n:s.n)+" \\u2014 you have a day to answer","r");\n'
)
h=h.replace(old_launch,new_launch,1)

# ---- BUILD ----
old_build="const BUILD=586;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=587;",1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch587 applied")
