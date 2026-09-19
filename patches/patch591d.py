import io

"""patch591d - review fix from the D2 coordinator pass, applied first in the D3 run
(BUILD stays 591 - the same "same-batch fix" convention as 589b/591b/591c; it is
applied here, ahead of this run's own 592/593, purely because the D3 task handed it
over first, but it touches only the withdraw motion, an anchor untouched by either
of those, so the order it lands in has no effect either way).

591c's own writeup flagged this as a known, out-of-scope cosmetic: during the final
battle's withdraw beat, a hostile drifts straight UP (e.y-=dt*0.55) and can clip over
the header/RETREAT button near the top of the screen as it exits. The plan calls for
hostiles to fly out to the RIGHT instead - so the withdraw now moves e.x forward
(off the right edge of the battle canvas, same 0.55/s rate, same 1.5s FINAL_WITHDRAW_T
window) and confines the small sinusoidal wobble to y, where it can never reach the
header no matter its amplitude. Nothing else about the withdraw beat (no firing, no
damage, ends in endBattle("finalwin")) changes."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old=(
'  if(BT.t && BT.t.final && BT.withdraw){\n'
'    BT.withdrawT+=dt;\n'
'    for(const e of BT.en){ if(e.alive){ e.y-=dt*0.55; e.x+=Math.sin(BT.el*3+e.px)*dt*0.05; } }\n'
'    bFade(dt);\n'
'    if(BT.withdrawT>=FINAL_WITHDRAW_T)endBattle("finalwin");\n'
'    return;\n'
'  }\n'
)
assert h.count(old)==1
new=(
'  if(BT.t && BT.t.final && BT.withdraw){\n'
'    BT.withdrawT+=dt;\n'
'    /* patch591d: exit RIGHT, not up - the old e.y-=dt*0.55 could carry a hostile\n'
'       straight off the top edge, over the header/RETREAT button. x now carries\n'
'       the exit (same 0.55/s rate, still clear of BW well inside FINAL_WITHDRAW_T\n'
'       for anything that did not already start near the right edge); the small\n'
'       sinusoidal wobble moves to y instead, where no amount of amplitude can\n'
'       ever reach the header. */\n'
'    for(const e of BT.en){ if(e.alive){ e.x+=dt*0.55; e.y+=Math.sin(BT.el*3+e.px)*dt*0.05; } }\n'
'    bFade(dt);\n'
'    if(BT.withdrawT>=FINAL_WITHDRAW_T)endBattle("finalwin");\n'
'    return;\n'
'  }\n'
)
assert new!=old
h=h.replace(old,new,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch591d applied")
