import io

"""patch589b - review follow-up on patch589 (D1). BUILD stays 589 - this is a fix to
the patch that just shipped, not a new plan item, per the implementer brief's own
instruction to land it before D2 (patch590/591).

Two findings from review of the D1 screenshots/tests:

1. #endCard's ENGAGE was enabled with an empty fleet (shots/batchD1-05: "0 dps ·
   0 hull · NO SHIPS", ENGAGE active) - renderEndCard() only ever checked S.fhp<0.15,
   never fleetDPS(). Fixed the same way the Map's own ASSAULT button already reads
   "NO FLEET · BUILD WARSHIPS" before it ever checks hull (empSysAction(), ~5569):
   a zero-fleet check now takes priority over the hull check, with its own hint line.
   This is a real behaviour change to something patch589's own tending2.js asserted
   (see the test fix below - the existing case never actually granted any ships, so
   passing before only proved the bug, not the fix).

2. startFinalBattle() (still a stub until patch590) gets the same gate directly, not
   only via the now-disabled button: "the scene's ENGAGE must not start a fight with
   no fleet." Since sceneFinish()'s buttons branch already calls sceneClose() before
   the button's own onClick fires (playScene(), patch579), the scene is already gone
   by the time this runs for the turn scene's own ENGAGE - the extra `sceneOn &&
   sceneClose()` here is belt and braces for any future caller (a dev shortcut, say)
   that invokes startFinalBattle() directly while a scene happens to still be open.

Scene SKIP (the brief's second ask): checked, not a bug. playScene()'s SKIP button
already calls sceneFinish() (patch579), and sceneFinish() already shows opts.buttons
instead of closing outright whenever a scene defines them (patch589's own STORY.turn
call does) - so SKIP already lands on ENGAGE/NOT YET, never a silent close. No code
change; tending2.js gets a direct assertion of this below the existing "ENGAGE also
closes the scene" test so it's provably covered, not just inferred from sceneFinish's
one code path."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ================= renderEndCard(): no-ships gate, same priority order the Map's
# ================= own ASSAULT button already uses (no fleet, then low hull) =================
old_endcard=(
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
assert h.count(old_endcard)==1
new_endcard=(
'function renderEndCard(){\n'
'  const host=$("#endCard"); if(!host)return;\n'
'  if(S.end!==1){ if(host.innerHTML)host.innerHTML=""; return; }\n'
'  /* patch589b: a no-fleet check takes priority over the hull one, same order the\n'
'     Map\'s own ASSAULT button already uses (empSysAction(), "NO FLEET" before\n'
'     "FLEET TOO DAMAGED") - this card must not offer a fight that cannot start. */\n'
'  const noShips=fleetDPS()<=0, lowHull=!noShips&&S.fhp<0.15;\n'
'  host.innerHTML=`<div class="thrc endc">\n'
'    <h5>VEGA\'S FLEET HOLDS SOL REACH</h5>\n'
'    <p>The turn has come. Production keeps running \\u2014 the final battle is yours to choose, whenever you\'re ready.</p>\n'
'    <button class="thrgo" id="endEngage" ${(noShips||lowHull)?"disabled":""}>ENGAGE</button>\n'
'    ${noShips?\'<div class="thrnote">No fleet \\u2014 build warships first.</div>\'\n'
'      :lowHull?\'<div class="thrnote">Fleet too damaged \\u2014 let it repair.</div>\':""}\n'
'  </div>`;\n'
'  const b=$("#endEngage"); if(b)b.onclick=()=>startFinalBattle();\n'
'}\n'
)
h=h.replace(old_endcard,new_endcard,1)

# ================= startFinalBattle(): the same gate, directly =================
old_stub=(
'/* stub - patch590 turns this into the scripted final-battle target through\n'
'   engageTarget(). Both the turn scene\'s own ENGAGE button and the pinned Raids\n'
'   card (#endCard, below) call this same function. */\n'
'function startFinalBattle(){\n'
'  toast("Final battle \\u2014 coming in patch 590","y");\n'
'}\n'
)
assert h.count(old_stub)==1
new_stub=(
'/* stub - patch590 turns this into the scripted final-battle target through\n'
'   engageTarget(). Both the turn scene\'s own ENGAGE button and the pinned Raids\n'
'   card (#endCard, below) call this same function.\n'
'   patch589b: gated directly, not only via the now-disabled buttons above - "the\n'
'   scene\'s ENGAGE must not start a fight with no fleet." sceneFinish() already\n'
'   closes the turn scene before this runs (playScene()\'s buttons branch calls\n'
'   sceneClose() first), so the sceneOn check below only matters for a future direct\n'
'   caller (e.g. a dev shortcut) that skips that flow. */\n'
'function startFinalBattle(){\n'
'  if(fleetDPS()<=0){\n'
'    if(sceneOn)sceneClose();\n'
'    toast("No fleet \\u2014 build warships first.","r");\n'
'    return;\n'
'  }\n'
'  toast("Final battle \\u2014 coming in patch 590","y");\n'
'}\n'
)
h=h.replace(old_stub,new_stub,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch589b applied")
