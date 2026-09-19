import io

"""patch591c - D2 review follow-up (BUILD stays 591, same "same-batch fix" convention
as 589b/591b - found via the coordinator's review of this batch's own screenshots,
not a new plan item).

Three fixes:

1. Mirror COLOUR. The mirror hostiles' shape was already correct (patch590's
   `if(BT.t&&BT.t.final)` branch already draws the exact flip of the player's own
   ship path - checked again here: negate every y in the player triangle's own
   points and the coefficients match patch590's mirror branch exactly, 1.5/-.9/-.35/
   -.9 both times). What was still "ordinary enemy glyphs" was the FILL COLOUR: the
   `col` line runs its per-kind EK lookup (K.boss red, swift yellow, heal green,
   bomber orange, split purple) regardless of BT.t.final, so a mirrorMix() wave with
   several different kinds in it reads as the ordinary rainbow of enemy colours even
   though every one of them is silhouetted as the player's own hull. Fixed by
   short-circuiting to one VEGA-red for the whole final battle, boss included - boss
   was already "larger, same shape" via e.rr (EK.boss.r=2.30 vs ~1.0 for everything
   else), so only the colour needed the override.

2. Ally SIZE and POSITION. Ally ships drew at ar=fr*0.62, spread across a full-width
   row (BW*(0.5+...*0.11)) directly above the player fleet - at 390px/2x that is a
   ~6-8px arrow, easy to miss entirely. Both allyRowX/allyRowY (shared by bDraw's own
   draw call and finalAlliesTick's tracer-origin point, so they can never drift apart)
   and the draw block itself now use fr - the SAME size the player's own ships draw
   at just above - and a tight cluster off to one side (BW*0.22-centred, ~2.3*fr
   between neighbours - just outside their own half-width so they read as a grouped
   formation, not overlapping each other) instead of spanning the full row width.
   Y unchanged in spirit (still playerY()-relative, nudged slightly higher to give
   the now-larger ships the same clearance the smaller ones had) - still nowhere near
   the bottom HUD strip (.bh-bot) the same way it always was; the vertical gap between
   the two rows is what keeps them apart, exactly like the original (already-shipped)
   design, not the horizontal range, so clustering to one side cannot introduce a new
   overlap with the player fleet's own row.

3. Battle narrative copy moved into STORY as PLACEHOLDER keys, so the owner edits
   all of it in one place rather than hunting through endFinalBattle/finalSpawnWave/
   finalAllyJoin: battleWinT/battleWin (the win card's title/subtitle),
   battleLossT/battleLoss (same, loss card - added the T-suffixed title key too,
   mirroring the win pair, even though the review note only named "battleLoss" -
   the title is exactly as much narrative flavour as the subtitle, same as the win
   side already having both), battleWave (the per-wave toast, a {n} token), allyJoin
   (the ally-join toast, a {rival} token). STORY is already on __SD (patch589), so
   nothing new to export."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ================= 1. mirror colour =================
old_col=(
'    const col=K.boss?"#ff5f6d":e.k==="swift"?"#ffd166":e.k==="heal"?"#5ce6a5":\n'
'              e.k==="bomber"?"#ff9a6b":e.k==="split"?"#b07cff":BT.T.col;\n'
)
assert h.count(old_col)==1
new_col=(
'    /* patch591c: VEGA\'s fleet draws in one consistent red regardless of mix kind -\n'
'       the shape below was already the player\'s own hull, flipped (BT.t.final skips\n'
'       every per-kind branch, boss included - "same shape, boss larger" was already\n'
'       true via e.rr); only the colour was still leaking the ordinary per-kind EK\n'
'       palette (green/yellow/red), which read as "the usual enemy glyphs" instead of\n'
'       a mirror of your own fleet. */\n'
'    const col=(BT.t&&BT.t.final)?"#ff4d5e":K.boss?"#ff5f6d":e.k==="swift"?"#ffd166":e.k==="heal"?"#5ce6a5":\n'
'              e.k==="bomber"?"#ff9a6b":e.k==="split"?"#b07cff":BT.T.col;\n'
)
assert new_col!=old_col
h=h.replace(old_col,new_col,1)

# ================= 2a. allyRowY/allyRowX =================
old_row=(
'function allyRowY(){ return playerY()-Math.min(BW,BH)*0.09 }\n'
'function allyRowX(i,n){ return BW*(0.5+((i-(n-1)/2)*0.11)) }\n'
)
assert h.count(old_row)==1
new_row=(
'/* patch591c: was a full-width row (BW*(0.5+index*0.11)) of 0.62*fr ships - near-\n'
'   invisible at 390px. Now a tight cluster at fr (the player fleet\'s own ship size)\n'
'   off to one side, close enough together that they read as a formation rather than\n'
'   scattered points. The vertical gap to playerY() - not the horizontal range - is\n'
'   what has always kept this row clear of the fleet below it (unchanged principle,\n'
'   just nudged up slightly for the now-larger ships), so clustering to one side\n'
'   cannot introduce a new overlap with the (up to 13-wide) player row. */\n'
'function allyRowY(){ return playerY()-Math.min(BW,BH)*0.115 }\n'
'function allyRowX(i,n){ const fr=Math.min(BW,BH)*0.017; return BW*0.22+(i-(n-1)/2)*fr*2.3 }\n'
)
assert new_row!=old_row
h=h.replace(old_row,new_row,1)

# ================= 2b. ally draw block in bDraw =================
old_draw=(
'  if(BT.t&&BT.t.final&&BT.allies&&BT.allies.length){\n'
'    const an=BT.allies.length, ay=allyRowY(), ar=fr*0.62;\n'
'    for(let i=0;i<an;i++){\n'
'      const a=BT.allies[i], ax=allyRowX(i,an), bob=Math.sin(BT.el*2+i*1.7)*ar*0.2;\n'
'      bx.save(); bx.translate(ax,ay+bob);\n'
'      bx.shadowColor=a.col; bx.shadowBlur=8*D;\n'
'      bx.fillStyle=a.col;\n'
'      bx.beginPath(); bx.moveTo(0,-ar*1.5); bx.lineTo(ar,ar*.9); bx.lineTo(0,ar*.35); bx.lineTo(-ar,ar*.9);\n'
'      bx.closePath(); bx.fill(); bx.shadowBlur=0;\n'
'      bx.restore();\n'
'    }\n'
'  }\n'
)
assert h.count(old_draw)==1
new_draw=(
'  if(BT.t&&BT.t.final&&BT.allies&&BT.allies.length){\n'
'    /* patch591c: fr (player-ship size), not ar=fr*0.62 - see allyRowX/Y above. */\n'
'    const an=BT.allies.length, ay=allyRowY();\n'
'    for(let i=0;i<an;i++){\n'
'      const a=BT.allies[i], ax=allyRowX(i,an), bob=Math.sin(BT.el*2+i*1.7)*fr*0.2;\n'
'      bx.save(); bx.translate(ax,ay+bob);\n'
'      bx.shadowColor=a.col; bx.shadowBlur=8*D;\n'
'      bx.fillStyle=a.col;\n'
'      bx.beginPath(); bx.moveTo(0,-fr*1.5); bx.lineTo(fr,fr*.9); bx.lineTo(0,fr*.35); bx.lineTo(-fr,fr*.9);\n'
'      bx.closePath(); bx.fill(); bx.shadowBlur=0;\n'
'      bx.restore();\n'
'    }\n'
'  }\n'
)
assert new_draw!=old_draw
h=h.replace(old_draw,new_draw,1)

# ================= 3a. STORY: new placeholder keys =================
old_story_tail=(
'    {who:null,   t:"Three fleets, one target. The choice is still yours."}                         /* PLACEHOLDER */\n'
'  ]\n'
'};\n'
)
assert h.count(old_story_tail)==1
new_story_tail=(
'    {who:null,   t:"Three fleets, one target. The choice is still yours."}                         /* PLACEHOLDER */\n'
'  ],\n'
'  /* patch591c: the final battle\'s own narrative copy, pulled out of endFinalBattle/\n'
'     finalSpawnWave/finalAllyJoin so the owner edits all of it in one place. battleWave\n'
'     and allyJoin carry a simple {token} - replaced with String.replace() at the one\n'
'     call site each, not a template-literal (these are plain strings, not code). */\n'
'  battleWinT:"The Core Breaks",                                                    /* PLACEHOLDER */\n'
'  battleWin:"VEGA\'s fleet falls back. Sol Reach is yours to finish.",               /* PLACEHOLDER */\n'
'  battleLossT:"Fleet Broken",                                                      /* PLACEHOLDER */\n'
'  battleLoss:"VEGA\'s fleet still holds Sol Reach. Repair and try again.",           /* PLACEHOLDER */\n'
'  battleWave:"WAVE {n} / 3",                                                       /* PLACEHOLDER */\n'
'  allyJoin:"{rival} joins the line"                                                /* PLACEHOLDER */\n'
'};\n'
)
assert new_story_tail!=old_story_tail
h=h.replace(old_story_tail,new_story_tail,1)

# ================= 3b. endFinalBattle: loss card =================
old_loss=(
'    $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--rd)">Fleet Broken</h3>\n'
'      <div class="rsub">VEGA\'s fleet still holds Sol Reach. Repair and try again.</div> <!-- PLACEHOLDER -->\n'
)
assert h.count(old_loss)==1
new_loss=(
'    $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--rd)">${STORY.battleLossT}</h3>\n'
'      <div class="rsub">${STORY.battleLoss}</div>\n'
)
assert new_loss!=old_loss
h=h.replace(old_loss,new_loss,1)

# ================= 3c. endFinalBattle: win card =================
old_win=(
'  $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--gr)">The Core Breaks</h3>\n'
'    <div class="rsub">VEGA\'s fleet falls back. Sol Reach is yours to finish.</div> <!-- PLACEHOLDER -->\n'
)
assert h.count(old_win)==1
new_win=(
'  $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--gr)">${STORY.battleWinT}</h3>\n'
'    <div class="rsub">${STORY.battleWin}</div>\n'
)
assert new_win!=old_win
h=h.replace(old_win,new_win,1)

# ================= 3d. finalSpawnWave: wave banner toast =================
old_wave='  toast("WAVE "+wave+" / 3","y");\n'
assert h.count(old_wave)==1
new_wave='  toast(STORY.battleWave.replace("{n}",wave),"y");\n'
assert new_wave!=old_wave
h=h.replace(old_wave,new_wave,1)

# ================= 3e. finalAllyJoin: ally-join toast =================
old_join='  toast(r.n+" joins the line","y");\n'
assert h.count(old_join)==1
new_join='  toast(STORY.allyJoin.replace("{rival}",r.n),"y");\n'
assert new_join!=old_join
h=h.replace(old_join,new_join,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch591c applied")
