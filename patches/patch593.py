import io

"""patch593 - D3 of the Batch D split (final patch of PLAN-ending.md), "Dev + tests".

Dev panel: four new buttons alongside patch589/593's own START FINALE/RESET ENDING -
GIVE 2000 NODES, HOLD NYX (both quick setup for reaching the finale without a real
Nodes grind, same spirit as START FINALE's own pj1-3 grant), WIN FINALE (calls
finaleWon() directly, from any state - a fast path straight to the ending screen for
testing, skipping the whole scripted fight), SHOW ENDING (reopens the ending screen
as a preview without touching S.end - same "does not persist" convention REPLAY
INTRO already uses for VEGA beats).

RESET ENDING also undoes peace now: revertPeace() (patch592) restores every
GARRISON system's owner/def/arch from the GARRISON table itself (never mutated,
only ever read from), so a tester can toggle end 0 -> 1 -> 2 -> 0 repeatedly and
get the real rival-held map back each time, not a permanently "won" one.

tests/tending2.js gets its D3 section appended (same out/ok accumulator D1/D2
already share) covering the plan's own list for 592/593."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ================= 1. dev panel buttons =================
old_html=(
'    <button class="dvb" data-dev="introReplay">REPLAY INTRO</button>\n'
'    <button class="dvb" data-dev="startFinale">START FINALE</button>\n'
'    <button class="dvb" data-dev="resetEnding">RESET ENDING</button>\n'
'  </div>\n'
)
assert h.count(old_html)==1
new_html=(
'    <button class="dvb" data-dev="introReplay">REPLAY INTRO</button>\n'
'    <button class="dvb" data-dev="startFinale">START FINALE</button>\n'
'    <button class="dvb" data-dev="giveNodes">GIVE 2000 NODES</button>\n'
'    <button class="dvb" data-dev="holdNyx">HOLD NYX</button>\n'
'    <button class="dvb" data-dev="winFinale">WIN FINALE</button>\n'
'    <button class="dvb" data-dev="showEnding">SHOW ENDING</button>\n'
'    <button class="dvb" data-dev="resetEnding">RESET ENDING</button>\n'
'  </div>\n'
)
assert new_html!=old_html
h=h.replace(old_html,new_html,1)

# ================= 2. devAction(): the four new buttons, and RESET ENDING undoes peace =================
old_js=(
'  else if(k==="resetEnding"){\n'
'    /* every suspension above reads S.end live (nexLv/queueNotice/renderNex/the\n'
'       rival ticks), so un-setting it is the whole restore; clearing S.nx.pjx lets\n'
'       the owner buy (and re-trigger) the turn again for testing. */\n'
'    S.end=0;\n'
'    if(S.nx)S.nx.pjx=0;\n'
'    toast("DEV \\u2014 ending reset","y");\n'
'  }\n'
'  dirty=true; renderAll(); save(); devInfo();\n'
'}\n'
)
assert h.count(old_js)==1
new_js=(
'  else if(k==="giveNodes"){\n'
'    S.en=(S.en||0)+2000; S.enAll=Math.max(S.enAll||0,S.en);\n'
'    toast("DEV \\u2014 +2000 Exotic Nodes","y");\n'
'  }\n'
'  else if(k==="holdNyx"){\n'
'    if(!sysHeld("nyx"))S.sys.nyx={b:{}};\n'
'    toast("DEV \\u2014 Nyx held","y");\n'
'  }\n'
'  else if(k==="winFinale"){\n'
'    /* calls the real thing directly, from any state - a fast path to the ending\n'
'       screen for testing that skips the whole scripted fight (and the turn, if\n'
'       S.end were still 0 - finaleWon() does not care what it was). */\n'
'    finaleWon();\n'
'  }\n'
'  else if(k==="showEnding"){\n'
'    /* preview only, same "does not persist" rule REPLAY INTRO already uses for\n'
'       VEGA beats - does not touch S.end, so it can be opened from any state\n'
'       (including one the real game would never reach, e.g. before the turn). */\n'
'    showEnding();\n'
'  }\n'
'  else if(k==="resetEnding"){\n'
'    /* every suspension above reads S.end live (nexLv/queueNotice/renderNex/the\n'
'       rival ticks), so un-setting it is most of the restore; clearing S.nx.pjx\n'
'       lets the owner buy (and re-trigger) the turn again for testing. patch592\'s\n'
'       revertPeace() is the other half once S.end has reached 2 - GARRISON is\n'
'       never mutated, only ever read from, so this hands every system\'s owner/\n'
'       def/arch straight back (harmless, a no-op comparison aside, to call when\n'
'       peace was never applied in the first place - S.end<2 the whole session). */\n'
'    S.end=0;\n'
'    if(S.nx)S.nx.pjx=0;\n'
'    revertPeace();\n'
'    toast("DEV \\u2014 ending reset","y");\n'
'  }\n'
'  dirty=true; renderAll(); save(); devInfo();\n'
'}\n'
)
assert new_js!=old_js
h=h.replace(old_js,new_js,1)

# ================= BUILD =================
old_build="const BUILD=592;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=593;",1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch593 applied")
