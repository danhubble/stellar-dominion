import io

"""patch586 - PLAN-ending.md Batch C, item 1: home-target threats (owner decision 8).

Late-game, a rival that was about to send an ordinary fleet at a held system can
instead turn on the Nexus at home. Gated hard - `pj1` owned, S.en>=SAB_EN_MIN (10),
S.end===0 - so the SAB_CHANCE (0.35) roll in rvMaybeThreat() is structurally never
reached before the player has bought into the Project, and never at all in csim4.js
(it never buys Nexus, per PLAN-ending.md's own header) - the Math.random() call only
ever executes inside that same `if`, so an ungated pacing run draws nothing new from
the shared stream (the "gate the roll so no RNG is consumed unless pj1 is owned"
option the code map allows, used deliberately over a cseed hash since this one is
provably unreachable rather than merely cosmetic).

A sabotage threat is a normal S.thq entry with `sysId:"home"` and a new `kind:"sab"`
tag. Every place that already assumes a threat's system is a claimable, non-home
system needed a carve-out:
  - thqPrune() - a sab entry would be pruned every tick otherwise: sysHeld("home") is
    false by construction (home is never in S.sys/S.sd the way a claim is), so the
    existing "no longer held -> drop it" rule would delete it before its own countdown
    ever got a chance to run.
  - holdResolve()/startDefence() - both refuse a threat outright unless
    sysHeld(th.sysId), for the same reason.
  - adopt()'s thq sanitiser - strips ANY entry naming home (the correct rule for
    every kind that existed before this patch). Carved out to keep `kind==="sab"`
    entries whose sysId is exactly "home"; anything else naming home is still dropped.

Odds (holdOdds(), now kind-aware): `power = 1 + best sdStrength() among held systems`
(new bestHeldSdLv()/heldSystems() reduce - "your best garrison falls back to defend
home"; power=1 with nothing held), same weight formula as the ordinary branch.

Resolution (holdResolve(), new isSab branch) - "same rule online and offline, an
absent player is not deemed to have auto-lost a Nexus raid the way an unattended
held system auto-occupies": odds are computed and rolled the same way regardless of
`offline`. A loss steals floor(SAB_STEAL*S.en) (25%) from the bank - never touches
S.exo, never calls occupySystem - a win pays the normal hold reward (salvage; no
exotic reward, since home's own `res` is null, so the existing exId-gated exotic
payout is naturally zero without any extra guard). The DEFEND choice plays the same
defence mini-game at home (startDefence/endDefence): home has no sd level of its own
(S.sd never carries a "home" key, sanitised out same as it's excluded from being set),
so `DT.sab` borrows the best held system's defence level for hull/turrets, exactly
matching the odds formula's own fallback; a lost fight steals the same 25% instead of
occupying (occupySystem() flatly refuses `s.home` anyway, so this was also a latent
no-op bug rather than only a missing feature).

The Raids threat card and Core-sector map marker for a sab threat still render through
the existing generic paths in this patch (they resolve to Sol Reach's own name/flavour
correctly already) - the sab-specific copy, the "Nodes at risk" figure and the
first-sabotage rival:rvSab notice are patch587, kept a separate purpose per the plan's
own 586/587 split. This patch does fix one thing the offline welcome-back report would
otherwise get flatly wrong: a sab entry resolved by thqTick() while the tab was shut
carries `occ:false` (sabotage never occupies), so without a change here it would fall
into the "fought" list and be labelled "occupied" - a real lie about what happened,
not a copy nicety, so it is fixed here rather than deferred to 587."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- consts: SAB_CHANCE/SAB_STEAL/SAB_EN_MIN, next to the other threat consts ----
old_consts=(
'const THQ_MAX=4;           /* how many can be waiting at once */\n'
'const THQ_LIFE=24*3600;    /* how long each one waits for you */\n'
'const DEFLV=20;            /* rivals ignore you until raiding is established */\n'
)
assert h.count(old_consts)==1
new_consts=old_consts+(
'/* STAGE C (owner decision 8): late-game sabotage threats aimed at home instead of a\n'
'   held system. All three TUNING-PENDING - see rvMaybeThreat()\'s own gate for exactly\n'
'   where these are read and why the roll can never reach csim4.js. */\n'
'const SAB_CHANCE=0.35;     /* TUNING-PENDING: chance an eligible launch targets home instead */\n'
'const SAB_STEAL=0.25;      /* TUNING-PENDING: fraction of banked S.en stolen on a loss */\n'
'const SAB_EN_MIN=10;       /* TUNING-PENDING: S.en must be at least this before sabotage can start */\n'
)
h=h.replace(old_consts,new_consts,1)

# ---- sdTurrets(): split into a level-based helper (sabotage borrows a LEVEL, not a
#      system id, so sdTurrets(id) alone cannot serve it) + bestHeldSdLv() ----
old_sdturrets='function sdTurrets(id){ const l=sdLv(id); return l>=SD_AUTO ? 1+Math.floor((l-SD_AUTO)/3) : 0 }\n'
assert h.count(old_sdturrets)==1
new_sdturrets=(
'function sdTurretsForLv(l){ return l>=SD_AUTO ? 1+Math.floor((l-SD_AUTO)/3) : 0 }\n'
'function sdTurrets(id){ return sdTurretsForLv(sdLv(id)) }\n'
)
h=h.replace(old_sdturrets,new_sdturrets,1)

old_sdstrength='function sdStrength(id){ return sdLv(id)*1.0 + lv(S.rs,"bat")*0.42 }\n'
assert h.count(old_sdstrength)==1
new_sdstrength=old_sdstrength+(
'/* sabotage targets home, which never carries its own defence level (S.sd has no\n'
'   "home" key - see adopt()\'s S.sd sanitiser) - "your best garrison falls back to\n'
'   defend home" (owner decision 8), so it borrows the strongest held system\'s own\n'
'   level/strength instead. 0 with nothing held, same as an undefended system. */\n'
'function bestHeldSdLv(){ let best=0; for(const s of heldSystems())best=Math.max(best,sdLv(s.id)); return best }\n'
)
h=h.replace(old_sdstrength,new_sdstrength,1)

# ---- rvMaybeThreat(): the SAB_CHANCE retarget, hard-gated ----
old_launch=(
'    if(thq().some(q=>q.sysId===s.id))continue;\n'
'    r.p=0; r.cd=b.cool; r.w=0;\n'
'    S.thqSeq=Math.max(1,(S.thqSeq||1))+1;\n'
'    thq().push({ id:S.thqSeq, rv:id, sysId:s.id,\n'
'                 dif:1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012, t:THQ_LIFE });\n'
'    queueNotice("vega:threat");\n'
'    S.thrCd=RV_MINGAP;\n'
'    toast(b.warn+" "+s.n+" \\u2014 you have a day to answer","r");\n'
)
assert h.count(old_launch)==1
new_launch=(
'    if(thq().some(q=>q.sysId===s.id))continue;\n'
'    /* STAGE C: sabotage - an eligible launch (pj1 owned, a real bank of Nodes, no\n'
'       finale running) has a SAB_CHANCE chance of turning on the Nexus instead of the\n'
'       held system it was about to hit. Every condition here has to hold before\n'
'       Math.random() is ever called, so a save that never buys pj1 (every csim4.js\n'
'       run, by construction) draws nothing extra from the shared stream - see the\n'
'       patch header. */\n'
'    let sysId=s.id, sab=false;\n'
'    if(S.end===0 && nexOwned("pj1") && (S.en||0)>=SAB_EN_MIN &&\n'
'       !thq().some(q=>q.sysId==="home") && Math.random()<SAB_CHANCE){\n'
'      sysId="home"; sab=true;\n'
'    }\n'
'    r.p=0; r.cd=b.cool; r.w=0;\n'
'    S.thqSeq=Math.max(1,(S.thqSeq||1))+1;\n'
'    const entry={ id:S.thqSeq, rv:id, sysId,\n'
'                  dif:1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012, t:THQ_LIFE };\n'
'    if(sab)entry.kind="sab";\n'
'    thq().push(entry);\n'
'    queueNotice("vega:threat");\n'
'    S.thrCd=RV_MINGAP;\n'
'    toast(b.warn+" "+(sab?SYSMAP.home.n:s.n)+" \\u2014 you have a day to answer","r");\n'
)
h=h.replace(old_launch,new_launch,1)

# ---- thqPrune(): a sab entry's "system" (home) is never sysHeld() - never prune it ----
old_prune=(
'function thqPrune(){\n'
'  const q=thq();\n'
'  for(let i=q.length-1;i>=0;i--) if(!sysHeld(q[i].sysId))q.splice(i,1);\n'
'}\n'
)
assert h.count(old_prune)==1
new_prune=(
'function thqPrune(){\n'
'  const q=thq();\n'
'  for(let i=q.length-1;i>=0;i--){\n'
'    if(q[i].kind==="sab")continue;   /* home is never "held" the way a claim is - see holdOdds() */\n'
'    if(!sysHeld(q[i].sysId))q.splice(i,1);\n'
'  }\n'
'}\n'
)
h=h.replace(old_prune,new_prune,1)

# ---- holdOdds(): kind-aware power ----
old_holdodds=(
'function holdOdds(th){\n'
'  if(!th)return 0;\n'
'  const s=SYSMAP[th.sysId]; if(!s)return 0;\n'
'  const b=RVBEH[th.rv]||RVBEH.hel;\n'
'  const power=1+sdStrength(s.id);\n'
'  const weight=(th.dif||1)*1.55*(b.hard||1);\n'
'  return Math.max(0.05, Math.min(0.95, power/(power+weight)));\n'
'}\n'
)
assert h.count(old_holdodds)==1
new_holdodds=(
'function holdOdds(th){\n'
'  if(!th)return 0;\n'
'  const b=RVBEH[th.rv]||RVBEH.hel;\n'
'  let power;\n'
'  if(th.kind==="sab"){\n'
'    power=1+heldSystems().reduce((m,s)=>Math.max(m,sdStrength(s.id)),0);\n'
'  } else {\n'
'    const s=SYSMAP[th.sysId]; if(!s)return 0;\n'
'    power=1+sdStrength(s.id);\n'
'  }\n'
'  const weight=(th.dif||1)*1.55*(b.hard||1);\n'
'  return Math.max(0.05, Math.min(0.95, power/(power+weight)));\n'
'}\n'
)
h=h.replace(old_holdodds,new_holdodds,1)

# ---- holdResolve(): guard + a whole new isSab branch, same rule online/offline ----
old_hr_head=(
'function holdResolve(th, auto, quiet, offline){\n'
'  if(!th)return null;\n'
'  const s=SYSMAP[th.sysId]; if(!s||!sysHeld(s.id))return null;\n'
'  const b=RVBEH[th.rv]||RVBEH.hel, rv=RIVALMAP[th.rv];\n'
'  const odds=offline?0:holdOdds(th), won=!offline&&Math.random()<odds;\n'
'  let sv=0, ex=0, occ=false; const exId=s.res;\n'
)
assert h.count(old_hr_head)==1
new_hr_head=(
'function holdResolve(th, auto, quiet, offline){\n'
'  if(!th)return null;\n'
'  const isSab=th.kind==="sab";\n'
'  const s=SYSMAP[th.sysId]; if(!s)return null;\n'
'  if(!isSab && !sysHeld(s.id))return null;\n'
'  const b=RVBEH[th.rv]||RVBEH.hel, rv=RIVALMAP[th.rv];\n'
'  /* STAGE C: "same rule online and offline" (owner decision 8) - an absent player is\n'
'     not deemed to have lost a Nexus raid just because nobody was watching, the way an\n'
'     unattended HELD system auto-occupies under 2C below. The odds roll (and whether\n'
'     it happens at all) is otherwise identical to the ordinary branch. */\n'
'  const odds=(isSab||!offline)?holdOdds(th):0;\n'
'  const won=isSab ? Math.random()<odds : (!offline&&Math.random()<odds);\n'
'  let sv=0, ex=0, occ=false, sab=0; const exId=isSab?null:s.res;\n'
)
h=h.replace(old_hr_head,new_hr_head,1)

old_hr_tail=(
'  } else {\n'
'    S.defl=(S.defl||0)+1;\n'
'    /* ONLINE delegated loss - UNCHANGED from before Stage 2, on purpose. "A delegated\n'
'       loss NEVER costs the system. You did not decline a fight you could see going\n'
'       badly - you chose not to be there, and the garrison did what it could." This\n'
'       still leaves the pre-existing stockpile haircut technically in tension with\n'
'       2A\'s "never touch stockpiles" for this one specific choice - a deliberate,\n'
'       flagged exception; see HANDOVER for the csim4 evidence that forced it. */\n'
'    if(exId&&S.exo[exId])S.exo[exId]=Math.max(0,S.exo[exId]*0.80);\n'
'    rvOf(th.rv).cd=Math.max(rvOf(th.rv).cd, b.cool*0.8);\n'
'  }\n'
'  /* kept for the player to read rather than flashed past - especially the ones that\n'
'     resolved while they were asleep */\n'
'  if(!Array.isArray(S.thrRep))S.thrRep=[];\n'
'  S.thrRep.push({won, occ, sys:s.n, rv:th.rv, sv, ex, auto:!!auto});\n'
'  S.thrRep=S.thrRep.slice(-8);\n'
'  if(!quiet){\n'
'    toast(won ? s.n+" held \\u2014 the garrison drove them off"\n'
'              : occ ? (rv?rv.n:"They")+" have occupied "+s.n+" \\u2014 retake it on the map"\n'
'              : s.n+" was hit \\u2014 defences and stores damaged", won?"g":"r");\n'
'    blip(won?760:170,.32,won?"square":"sawtooth",.05);\n'
'    checkAchs(); dirty=true; renderAll(); save();\n'
'  } else { checkAchs(); dirty=true }\n'
'  return {won, occ, sv, ex, odds};\n'
'}\n'
)
assert h.count(old_hr_tail)==1
new_hr_tail=(
'  } else if(isSab){\n'
'    S.defl=(S.defl||0)+1;\n'
'    /* Nothing is destroyed and nothing is occupied (home can never be) - a share of\n'
'       the bank is stolen instead, same 25% whether this resolved online or during an\n'
'       offline catch-up. */\n'
'    sab=Math.floor(SAB_STEAL*(S.en||0));\n'
'    S.en=Math.max(0,(S.en||0)-sab);\n'
'    rvOf(th.rv).cd=Math.max(rvOf(th.rv).cd, b.cool*0.8);\n'
'  } else {\n'
'    S.defl=(S.defl||0)+1;\n'
'    /* ONLINE delegated loss - UNCHANGED from before Stage 2, on purpose. "A delegated\n'
'       loss NEVER costs the system. You did not decline a fight you could see going\n'
'       badly - you chose not to be there, and the garrison did what it could." This\n'
'       still leaves the pre-existing stockpile haircut technically in tension with\n'
'       2A\'s "never touch stockpiles" for this one specific choice - a deliberate,\n'
'       flagged exception; see HANDOVER for the csim4 evidence that forced it. */\n'
'    if(exId&&S.exo[exId])S.exo[exId]=Math.max(0,S.exo[exId]*0.80);\n'
'    rvOf(th.rv).cd=Math.max(rvOf(th.rv).cd, b.cool*0.8);\n'
'  }\n'
'  /* kept for the player to read rather than flashed past - especially the ones that\n'
'     resolved while they were asleep */\n'
'  if(!Array.isArray(S.thrRep))S.thrRep=[];\n'
'  S.thrRep.push({won, occ, sys:s.n, rv:th.rv, sv, ex, sab:isSab, sabAmt:sab, auto:!!auto});\n'
'  S.thrRep=S.thrRep.slice(-8);\n'
'  if(!quiet){\n'
'    toast(won ? s.n+" held \\u2014 the garrison drove them off"\n'
'              : isSab ? (sab>0 ? (rv?rv.n:"They")+" stole "+fmt(sab)+" Nodes from "+s.n\n'
'                                : (rv?rv.n:"They")+" struck "+s.n+" \\u2014 nothing to take")\n'
'              : occ ? (rv?rv.n:"They")+" have occupied "+s.n+" \\u2014 retake it on the map"\n'
'              : s.n+" was hit \\u2014 defences and stores damaged", won?"g":"r");\n'
'    blip(won?760:170,.32,won?"square":"sawtooth",.05);\n'
'    checkAchs(); dirty=true; renderAll(); save();\n'
'  } else { checkAchs(); dirty=true }\n'
'  return {won, occ, sv, ex, sab, odds};\n'
'}\n'
)
h=h.replace(old_hr_tail,new_hr_tail,1)

# ---- startDefence(): guard + borrow the best held system's defence level for home ----
old_sd=(
'function startDefence(id){\n'
'  const th = (id===undefined) ? thq()[0] : thqAt(id);\n'
'  if(!th)return false;\n'
'  const s=SYSMAP[th.sysId]; if(!s||!sysHeld(s.id)){ thqDrop(th.id); return false }\n'
'  const b=RVBEH[th.rv]||RVBEH.hel;\n'
'  bScale=Math.min(devicePixelRatio,2);\n'
'  const sdl=sdLv(s.id);\n'
'  DT={ rv:th.rv, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif:th.dif||1,\n'
'       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,\n'
'       done:0, paused:false, mix:defMixFor(th.rv), mixi:0,\n'
'       qid:th.id, sd:sdl, hullMul:(1+SD_HULL*sdl)*Math.pow(1.10,lv(S.rs,"bul")),\n'
'       turrets:Array.from({length:sdTurrets(s.id)},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };\n'
)
assert h.count(old_sd)==1
new_sd=(
'function startDefence(id){\n'
'  const th = (id===undefined) ? thq()[0] : thqAt(id);\n'
'  if(!th)return false;\n'
'  const isSab=th.kind==="sab";\n'
'  const s=SYSMAP[th.sysId]; if(!s||(!isSab&&!sysHeld(s.id))){ thqDrop(th.id); return false }\n'
'  const b=RVBEH[th.rv]||RVBEH.hel;\n'
'  bScale=Math.min(devicePixelRatio,2);\n'
'  /* home has no defence level of its own - "your best garrison falls back to defend\n'
'     home" (owner decision 8), same fallback holdOdds() uses. */\n'
'  const sdl=isSab?bestHeldSdLv():sdLv(s.id);\n'
'  DT={ rv:th.rv, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif:th.dif||1,\n'
'       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,\n'
'       done:0, paused:false, mix:defMixFor(th.rv), mixi:0, sab:isSab,\n'
'       qid:th.id, sd:sdl, hullMul:(1+SD_HULL*sdl)*Math.pow(1.10,lv(S.rs,"bul")),\n'
'       turrets:Array.from({length:sdTurretsForLv(sdl)},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };\n'
)
h=h.replace(old_sd,new_sd,1)

# ---- endDefence(): a lost sab fight steals Nodes instead of occupying (occupySystem()
#      refuses s.home anyway, so this branch was a latent no-op for home before now) ----
old_ed_head=(
'function endDefence(how){\n'
'  if(!DT||DT.done)return; DT.done=1;\n'
'  const s=SYSMAP[DT.sysId], b=RVBEH[DT.rv]||RVBEH.hel, rv=RIVALMAP[DT.rv];\n'
'  let sv=0, ex=0, exId=s?s.res:null, taken=false;\n'
)
assert h.count(old_ed_head)==1
new_ed_head=(
'function endDefence(how){\n'
'  if(!DT||DT.done)return; DT.done=1;\n'
'  const s=SYSMAP[DT.sysId], b=RVBEH[DT.rv]||RVBEH.hel, rv=RIVALMAP[DT.rv];\n'
'  let sv=0, ex=0, exId=s?s.res:null, taken=false, sab=0;\n'
)
h=h.replace(old_ed_head,new_ed_head,1)

old_ed_lost=(
'  } else {\n'
'    S.defl=(S.defl||0)+1;\n'
'    /* A fight you were shown, chose to enter and lost costs the system - the player\'s own\n'
'       answer, and the one case where it is unambiguous. Never your last one, though:\n'
'       being reduced to nothing by a single bad minute is an ending, not a setback, and\n'
'       stage 1 has no shields to prevent it.\n'
'       STAGE 2: "costs the system" now means occupied, not deleted - occupySystem()\n'
'       leaves S.sys[s.id] and the exotic stockpile completely untouched, replacing both\n'
'       the old delete-and-neutral-claim AND the old 28% stockpile haircut outright.\n'
'       This is the endDefence side of the reconciliation HANDOVER documents; the\n'
'       delegated/offline side is holdResolve() (patch462) and rvMoveAway() (patch461). */\n'
'    const last=heldSystems().length<=1;\n'
'    if(s&&!last){\n'
'      taken=occupySystem(s.id, DT.rv);\n'
'      S.msel=null;\n'
'    }\n'
'    rvOf(DT.rv).cd=Math.max(rvOf(DT.rv).cd, b.cool*0.8);\n'
'  }\n'
)
assert h.count(old_ed_lost)==1
new_ed_lost=(
'  } else {\n'
'    S.defl=(S.defl||0)+1;\n'
'    if(DT.sab){\n'
'      /* Nothing to occupy at home - a share of the bank is stolen instead, same rule\n'
'         as the "hold the line without me" road (holdResolve()). */\n'
'      sab=Math.floor(SAB_STEAL*(S.en||0));\n'
'      S.en=Math.max(0,(S.en||0)-sab);\n'
'    } else {\n'
'      /* A fight you were shown, chose to enter and lost costs the system - the player\'s own\n'
'         answer, and the one case where it is unambiguous. Never your last one, though:\n'
'         being reduced to nothing by a single bad minute is an ending, not a setback, and\n'
'         stage 1 has no shields to prevent it.\n'
'         STAGE 2: "costs the system" now means occupied, not deleted - occupySystem()\n'
'         leaves S.sys[s.id] and the exotic stockpile completely untouched, replacing both\n'
'         the old delete-and-neutral-claim AND the old 28% stockpile haircut outright.\n'
'         This is the endDefence side of the reconciliation HANDOVER documents; the\n'
'         delegated/offline side is holdResolve() (patch462) and rvMoveAway() (patch461). */\n'
'      const last=heldSystems().length<=1;\n'
'      if(s&&!last){\n'
'        taken=occupySystem(s.id, DT.rv);\n'
'        S.msel=null;\n'
'      }\n'
'    }\n'
'    rvOf(DT.rv).cd=Math.max(rvOf(DT.rv).cd, b.cool*0.8);\n'
'  }\n'
)
h=h.replace(old_ed_lost,new_ed_lost,1)

old_ed_row=(
'  if(!held)rows+=`<div class="rline"><span style="color:var(--rd)">Losses</span><b style="color:var(--rd)">${\n'
'    taken ? (s?s.n:"the system")+" \\u2014 occupied, buildings intact" : "nothing \\u2014 the garrison held the ground itself"}</b></div>`;\n'
)
assert h.count(old_ed_row)==1
new_ed_row=(
'  if(!held)rows+=`<div class="rline"><span style="color:var(--rd)">Losses</span><b style="color:var(--rd)">${\n'
'    DT.sab ? (sab>0 ? fmt(sab)+" Nodes stolen" : "nothing \\u2014 no Nodes banked")\n'
'    : taken ? (s?s.n:"the system")+" \\u2014 occupied, buildings intact" : "nothing \\u2014 the garrison held the ground itself"}</b></div>`;\n'
)
h=h.replace(old_ed_row,new_ed_row,1)

# ---- adopt() thq sanitiser: carve out kind:"sab" entries naming home ----
old_thqfilter=(
'  f.thq=f.thq.filter(q=>q&&RVACT.indexOf(q.rv)>=0&&SYSMAP[q.sysId]&&!SYSMAP[q.sysId].home)\n'
'             .slice(0,THQ_MAX)\n'
'             .map((q,i)=>({ id:Math.max(1,Math.floor(q.id||i+1)), rv:q.rv, sysId:q.sysId,\n'
'                            dif:Math.max(0.1,+q.dif||1),\n'
'                            t:Math.max(0,Math.min(THQ_LIFE,+q.t||THQ_LIFE)) }));\n'
)
assert h.count(old_thqfilter)==1
new_thqfilter=(
'  /* an entry naming a rival or a system that does not exist is unfightable - EXCEPT a\n'
'     kind:"sab" entry naming home exactly, which is the one legitimate case a threat is\n'
'     ever allowed to target home (owner decision 8, STAGE C). Anything else naming home\n'
'     (every kind that existed before this patch) is still dropped, unchanged. */\n'
'  f.thq=f.thq.filter(q=>q&&RVACT.indexOf(q.rv)>=0&&\n'
'    (q.kind==="sab" ? q.sysId==="home" : (SYSMAP[q.sysId]&&!SYSMAP[q.sysId].home)))\n'
'             .slice(0,THQ_MAX)\n'
'             .map((q,i)=>({ id:Math.max(1,Math.floor(q.id||i+1)), rv:q.rv, sysId:q.sysId,\n'
'                            dif:Math.max(0.1,+q.dif||1),\n'
'                            t:Math.max(0,Math.min(THQ_LIFE,+q.t||THQ_LIFE)),\n'
'                            ...(q.kind==="sab"?{kind:"sab"}:{}) }));\n'
)
h=h.replace(old_thqfilter,new_thqfilter,1)
# the duplicate comment this replaces - drop the old, now-redundant one right above
old_thqcomment='  /* an entry naming a rival or a system that does not exist is unfightable */\n'
assert h.count(old_thqcomment)==1
h=h.replace(old_thqcomment,'',1)

# ---- BUILD ----
old_build="const BUILD=585;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=586;",1)

# ---- __SD export: new consts + helpers tests need ----
old_exp1='  SD_MAX,SD_AUTO,SD_RATE,SD_HULL,sdLv,sdCost,sdCostOre,sdTurrets,sdStrength,buySysDef,defRate,defAutoFire,\n'
assert h.count(old_exp1)==1
new_exp1=old_exp1.replace('sdTurrets,sdStrength,','sdTurrets,sdTurretsForLv,sdStrength,bestHeldSdLv,')
h=h.replace(old_exp1,new_exp1,1)

old_exp2='  holdOdds,holdLine,holdResolve,thq,thqAt,thqDrop,thqTick,thqPrune,thqClock,\n  THQ_MAX,THQ_LIFE,\n'
assert h.count(old_exp2)==1
new_exp2='  holdOdds,holdLine,holdResolve,thq,thqAt,thqDrop,thqTick,thqPrune,thqClock,\n  THQ_MAX,THQ_LIFE,SAB_CHANCE,SAB_STEAL,SAB_EN_MIN,\n'
h=h.replace(old_exp2,new_exp2,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch586 applied")
