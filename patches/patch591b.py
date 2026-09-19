import io

"""patch591b - review follow-up on patch590 (D2), found while taking the batch's own
required screenshots. BUILD stays 591 - a fix to a patch already in this run, not a
new plan item, same status as patch589b earlier in the batch.

The STAGE 1 escalation HUD strip (#bEsc, bDraw()'s own HUD block) shows a ticking
"REINFORCEMENTS · Ns" countdown whenever `!BT.waveDone` in weapon mode. patch590
deliberately left BT.waveDone at its initial 0 for the final battle - it only guards
the SPAWN block itself (`!BT.t.final && !BT.waveDone`), never sets the flag true -
because "ordinary reinforcement/pressure logic off for this fight" (the plan's own
wording) meant turning the mechanic off, not faking its own end-state. The HUD strip
reads that same untouched flag directly, though, so for the whole final battle it
sat there counting down to a reinforcement wave that can now never arrive - confirmed
by screenshot (batchD2-01, before this fix): "REINFORCEMENTS · 90s" over VEGA's
Fleet, mid-90s. This is a straightforward miss carried from patch590, fixed here
rather than folded into that patch's history: the strip now stays off for the whole
final battle, the same way it already does for turn mode (`BT.mode!=="wep"`)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old_esc=(
'  const escEl=$("#bEsc");\n'
'  if(escEl){\n'
'    if(BT.mode!=="wep"){ escEl.classList.remove("on"); }\n'
'    else if(!BT.waveDone){\n'
'      escEl.classList.add("on"); escEl.classList.remove("hit");\n'
'      escEl.textContent="\\u26a0 REINFORCEMENTS · "+Math.max(0,Math.ceil(waveTFor(BT.t)-BT.el))+"s";\n'
'    } else if(BT.el<waveTFor(BT.t)+2.5){\n'
'      escEl.classList.add("on","hit"); escEl.textContent="\\u26a0 REINFORCEMENTS ARRIVED";\n'
'    } else escEl.classList.remove("on");\n'
'  }\n'
)
assert h.count(old_esc)==1
new_esc=(
'  const escEl=$("#bEsc");\n'
'  if(escEl){\n'
'    /* patch591b: the final battle turns this whole mechanic off (patch590 never\n'
'       sets BT.waveDone for it) - the strip must not keep counting down to a\n'
'       reinforcement wave that can now never arrive. */\n'
'    if(BT.mode!=="wep"||(BT.t&&BT.t.final)){ escEl.classList.remove("on"); }\n'
'    else if(!BT.waveDone){\n'
'      escEl.classList.add("on"); escEl.classList.remove("hit");\n'
'      escEl.textContent="\\u26a0 REINFORCEMENTS · "+Math.max(0,Math.ceil(waveTFor(BT.t)-BT.el))+"s";\n'
'    } else if(BT.el<waveTFor(BT.t)+2.5){\n'
'      escEl.classList.add("on","hit"); escEl.textContent="\\u26a0 REINFORCEMENTS ARRIVED";\n'
'    } else escEl.classList.remove("on");\n'
'  }\n'
)
assert new_esc!=old_esc
h=h.replace(old_esc,new_esc,1)

# ================= __SD export: bDraw (needed to test the HUD fix directly) =================
old_exp='  hitEnemy,bUpdate,get bScale(){return bScale},\n'
assert h.count(old_exp)==1
h=h.replace(old_exp,'  hitEnemy,bUpdate,bDraw,get bScale(){return bScale},\n',1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch591b applied")
