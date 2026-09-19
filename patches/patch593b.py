import io

"""patch593b - review fix found while taking this run's own required screenshots
(BUILD stays 593 - same "same-batch fix" convention as 589b/591b/591c/591d).

The ending screen had 6 stages (0 title, 1 stats, 2 strip, 3 endLast, 4 endTbc,
5 bare CONTINUE button with an EMPTY body) - so STORY.endTbc appeared alone for one
tap, then vanished, and only THEN did a lone CONTINUE button show against empty
space. The plan's own sequence ("... -> STORY.endTbc -> CONTINUE button") reads as
one final screen, not two - endTbc is what the CONTINUE button sits under, not text
that disappears before it. Merged the two into one final stage (endStageHTML(4)
still returns endTbc, and the button now shows AT that same stage rather than one
past it) - END_STAGES drops 6 -> 5, nothing else about the state machine changes
(endRender()'s own `last = endStage>=END_STAGES-1` already recalculates correctly
off the constant, no separate edit needed there)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old="const END_STAGES=6, END_STRIP_BEAT_MS=1800;   /* TUNING-PENDING - the glow strip's own pause */\n"
assert h.count(old)==1
new=(
 '/* patch593b: 5 stages, not 6 - the final one shows STORY.endTbc AND the CONTINUE\n'
 '   button together (endStageHTML(4) still returns endTbc; endRender()\'s own\n'
 '   `last = endStage>=END_STAGES-1` needs no separate change), not endTbc alone\n'
 '   for one tap and then a bare button against empty space. */\n'
 'const END_STAGES=5, END_STRIP_BEAT_MS=1800;   /* TUNING-PENDING - the glow strip\'s own pause */\n'
)
assert new!=old
h=h.replace(old,new,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch593b applied")
