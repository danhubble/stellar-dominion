import io

"""patch594 - PLAN-defences.md Run 1, item 1: the outstanding intro fix.

Boot has always played the intro straight (patch579): `if(!had){ S.seen.intro=
true; playScene(STORY.intro,{skip:true,onDone:()=>queueNotice("vega:boot")}); }`.
RESTART GAME never did - `restartDialog()`'s yes.onclick wipes storage, replaces
S with fresh(), re-renders and saves, but never calls playScene at all, so a
restarted player gets no intro and no VEGA opening line, ever (fresh() leaves
S.seen.intro falsy, and the only other place that could set it true - adopt()'s
own back-fill - never runs here because adopt() is never called on this path).

Fixed by factoring the shared bit (mark the intro seen, play it, queue
vega:boot once it closes) into one playOpening(), called from both boot and
restart. Placement matters for the save() that follows the restart: playOpening()
runs BEFORE that save(), same order boot itself has relative to its own
S.seen.intro write (which happens synchronously, before anything else runs) -
so the save the restart takes is never out of step with what actually just
happened on screen, the same way a fresh boot's eventual first autosave never
is. LOAD CODE is untouched - adopt()'s own S.seen.intro back-fill (patch579)
still fires for every loaded save and still never calls playScene."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---------------- JS: playOpening(), next to sceneClose() (same file area
#      patch579 put the rest of the scene component in) ----------------
anchor_scene=(
'  el.addEventListener("transitionend",finish,{once:true});\n'
'  setTimeout(finish,400);\n'
'  sceneLines=null; sceneOpts=null;\n'
'}\n'
)
assert h.count(anchor_scene)==1
new_scene=(
'  el.addEventListener("transitionend",finish,{once:true});\n'
'  setTimeout(finish,400);\n'
'  sceneLines=null; sceneOpts=null;\n'
'}\n'
'/* patch594: the one moment a brand-new empire opens on - boot (a fresh save)\n'
'   and RESTART GAME (a deliberately fresh one) must both reach this, and only\n'
'   this, so neither can drift from the other again. */\n'
'function playOpening(){\n'
'  S.seen.intro=true;\n'
'  playScene(STORY.intro,{skip:true,onDone:()=>queueNotice("vega:boot")});\n'
'}\n'
)
assert new_scene!=anchor_scene
h=h.replace(anchor_scene,new_scene,1)

# ---------------- boot: now just calls the shared function ----------------
anchor_boot=(
'const had=load();\n'
'if(!had){\n'
'  S.seen.intro=true;\n'
'  playScene(STORY.intro,{skip:true,onDone:()=>queueNotice("vega:boot")});\n'
'}\n'
)
assert h.count(anchor_boot)==1
new_boot=(
'const had=load();\n'
'if(!had)playOpening();\n'
)
assert new_boot!=anchor_boot
h=h.replace(anchor_boot,new_boot,1)

# ---------------- restart: now plays it too, before the save that follows ----------------
anchor_restart=(
'      yes.onclick=()=>{\n'
'        clearInterval(iv); Store.del(KEY); S=fresh(); LF=null; hideModal();\n'
'        applyCore(); renderAll(); save(); toast("New game started. Good luck out there.","g");\n'
'      };\n'
)
assert h.count(anchor_restart)==1
new_restart=(
'      yes.onclick=()=>{\n'
'        clearInterval(iv); Store.del(KEY); S=fresh(); LF=null; hideModal();\n'
'        applyCore(); renderAll(); playOpening(); save();\n'
'        toast("New game started. Good luck out there.","g");\n'
'      };\n'
)
assert new_restart!=anchor_restart
h=h.replace(anchor_restart,new_restart,1)

# ---------------- __SD export: expose playOpening for tests ----------------
anchor_export=(
'  STORY,playScene,sceneAdvance,sceneFinish,sceneClose,get sceneOn(){return sceneOn},\n'
)
assert h.count(anchor_export)==1
new_export=(
'  STORY,playScene,sceneAdvance,sceneFinish,sceneClose,get sceneOn(){return sceneOn},\n'
'  playOpening,\n'
)
assert new_export!=anchor_export
h=h.replace(anchor_export,new_export,1)

# BUILD bump
old_build="const BUILD=593;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=594;")

io.open(F,"w",encoding="utf-8").write(h)
print("patch594 applied")
