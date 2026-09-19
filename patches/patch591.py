import io

"""patch591 - PLAN-ending.md Batch D, item D2 part 2: allies in the fight.

No friendly-unit system exists anywhere in the game, so allies are exactly what the
plan calls for: a passive damage tick, not a real combatant. BT.allies is a plain
list of {rv, col, iv} - nothing else in the whole file (win/loss checks, foeFire,
targeting) ever reads BT.allies, so an ally cannot affect win/loss and can never be
hit itself (nothing ever targets the list). Vasht joins the instant wave 1 opens
(finalAllyJoin(1), called from engageTarget()'s own t.final branch - wave 1 spawns
there, not through finalSpawnWave()), Helion at wave 2 and Covenant at wave 3
(finalAllyJoin(wave), called from the end of finalSpawnWave() - patch590 left that
call site bare on purpose for this patch to fill in), each with its own "<Rival>
joins the line" toast.

finalAlliesTick(dt) (called from the top of finalBattleTick(), patch590's own per-
frame final-battle driver) fires each ally on its own ALLY_IV clock at a random ALIVE
hostile, through hitEnemy() - the SAME shared damage function every player hit
already goes through (fireWeapon()/bTapAt()/the shell-landing path in bFade()), so an
ally hit respects hostile shields exactly the way a player hit does, for free. This
also means an ally hit runs through finalBossBreakCheck() (patch590) automatically -
an ally landing the hit that drops the Core below 25% triggers the withdraw exactly
like a player hit would, which is correct: the Core doesn't care who broke it. Per-
hit damage is sized so an ally's SUSTAINED dps over time equals ALLY_DPS_FRAC of the
player's own fleetDPS() at engage time (BT.dps, fixed for the fight): perHit =
BT.dps*ALLY_DPS_FRAC*ALLY_IV, delivered once every ALLY_IV seconds.

During the withdraw beat, bUpdateWep() (patch590) returns before finalBattleTick()
(and therefore finalAlliesTick()) ever runs, so allies stop firing the instant the
Core breaks off, same as every hostile - per the plan ("during the withdraw allies
stop firing"), no separate guard needed here.

Drawing (bDraw): a small row of player-shape ships in each rival's own RIVALS[].col,
positioned by allyRowX/allyRowY (shared with the tracer's own origin point so they
can never drift apart) just above the player fleet - playerY() and below is where the
bottom HUD overlay (.bh-bot, CSS position:absolute) lives, so a row drawn ABOVE it
never overlaps at any width, 390px included. Each ally hit also pushes a short
"allyshot" fx - a straight tracer in the ally's own colour from its row position to
the target - drawn in the same beam/lance/shot fx chain everything else uses; it
fades on the chain's own untouched default rate (bFade()'s ternary already ends in a
bare `:5`, so no bFade() edit was needed for this).

Randomness here (which live hostile an ally targets) is live-only: finalAlliesTick()
is reached only from finalBattleTick(), itself reached only from bUpdateWep()'s own
t.final branch inside the requestAnimationFrame(frame) loop - csim4.js calls tick()
directly, 500,000+ times, and never once reaches bUpdateWep() (confirmed the same way
patch589's own header already documented for rvTick, and re-confirmed by diff below)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ================= engageTarget(): BT.allies + Vasht joins at wave 1 =================
old_btlit=(
'       waveDone:0, pTick:0,\n'
'       /* patch590: final battle only (BT.t.final) - wave number, inter-wave\n'
'          breather timer, and the withdraw beat once the Core breaks. Harmless on\n'
'          every ordinary fight, which never reads any of these. */\n'
'       wave:1, waveBreather:0, withdraw:0, withdrawT:0, boss:null };\n'
'  const kinds=[];\n'
)
assert h.count(old_btlit)==1
new_btlit=(
'       waveDone:0, pTick:0,\n'
'       /* patch590: final battle only (BT.t.final) - wave number, inter-wave\n'
'          breather timer, and the withdraw beat once the Core breaks. Harmless on\n'
'          every ordinary fight, which never reads any of these. */\n'
'       wave:1, waveBreather:0, withdraw:0, withdrawT:0, boss:null,\n'
'       allies:[] };   /* patch591: final battle only - see finalAllyJoin()/finalAlliesTick() */\n'
'  if(t.final)finalAllyJoin(1);   /* patch591: Vasht joins as the fight opens */\n'
'  const kinds=[];\n'
)
h=h.replace(old_btlit,new_btlit,1)

# ================= new ally consts + functions, right before finalSpawnWave() so it
# ================= can call finalAllyJoin() =================
old_finalspawn_fn='function finalSpawnWave(wave){\n'
assert h.count(old_finalspawn_fn)==1
ally_module=(
'/* ---------------- allies in the fight (patch591) ----------------\n'
'   No friendly-unit system exists anywhere else in the game, so an ally is a\n'
'   passive damage tick, not a real combatant - BT.allies is a plain list, read only\n'
'   by finalAlliesTick() and bDraw() below. Nothing in any win/loss check (BT.en/\n'
'   BT.hp are the only things either one ever reads) or any targeting code reads it,\n'
'   so an ally can neither affect the outcome nor ever be hit itself. */\n'
'const FINAL_ALLY_ORDER=["vsh","hel","cov"];   /* owner decision: join order, wave 1/2/3 */\n'
'const ALLY_DPS_FRAC=0.12;   /* TUNING-PENDING - each ally\'s sustained dps as a fraction of BT.dps */\n'
'const ALLY_IV=1.5;          /* TUNING-PENDING - seconds between an ally\'s hits */\n'
'function finalAllyJoin(wave){\n'
'  const rv=FINAL_ALLY_ORDER[wave-1]; if(!rv)return;\n'
'  const r=RIVALMAP[rv]; if(!r)return;\n'
'  BT.allies.push({ rv, col:r.col, iv:0 });\n'
'  toast(r.n+" joins the line","y");\n'
'}\n'
'/* where the ally row sits: just above the player fleet (playerY(), fy) - the bottom\n'
'   HUD overlay (.bh-bot, position:absolute) only ever starts at fy and below, so a\n'
'   row drawn above it never overlaps, 390px included. Shared by finalAlliesTick()\n'
'   (as the tracer\'s own origin point) and bDraw() so they can never drift apart. */\n'
'function allyRowY(){ return playerY()-Math.min(BW,BH)*0.09 }\n'
'function allyRowX(i,n){ return BW*(0.5+((i-(n-1)/2)*0.11)) }\n'
'/* fires each ally on its own ALLY_IV clock at a random ALIVE hostile, through\n'
'   hitEnemy() - the SAME shared function every player hit already goes through, so\n'
'   an ally hit respects hostile shields exactly like a player hit, and can trigger\n'
'   finalBossBreakCheck() exactly like a player hit too (the Core doesn\'t care who\n'
'   broke it). Never reached during the withdraw beat - bUpdateWep() returns before\n'
'   finalBattleTick() (which calls this) ever runs while BT.withdraw is set, so\n'
'   allies stop firing the instant the Core breaks off, same as every hostile. */\n'
'function finalAlliesTick(dt){\n'
'  if(!BT.allies||!BT.allies.length)return;\n'
'  const perHit=BT.dps*ALLY_DPS_FRAC*ALLY_IV, n=BT.allies.length;\n'
'  for(let ai=0;ai<n;ai++){\n'
'    const a=BT.allies[ai];\n'
'    a.iv=(a.iv||0)-dt;\n'
'    if(a.iv>0)continue;\n'
'    a.iv+=ALLY_IV;\n'
'    const live=BT.en.filter(e=>e.alive); if(!live.length)continue;\n'
'    const tgt=live[Math.floor(Math.random()*live.length)], idx=BT.en.indexOf(tgt);\n'
'    hitEnemy(idx,perHit,0);\n'
'    BT.fx.push({t:"allyshot", x:allyRowX(ai,n), y:allyRowY(), tx:tgt.x*BW, ty:tgt.y*BH, a:1, col:a.col});\n'
'  }\n'
'}\n'
'function finalSpawnWave(wave){\n'
)
h=h.replace(old_finalspawn_fn, ally_module, 1)

old_wavetoast='  toast("WAVE "+wave+" / 3","y");\n}\n'
assert h.count(old_wavetoast)==1
new_wavetoast='  toast("WAVE "+wave+" / 3","y");\n  finalAllyJoin(wave);   /* patch591 - Helion at wave 2, Covenant at wave 3 */\n}\n'
h=h.replace(old_wavetoast,new_wavetoast,1)

old_tickopen='function finalBattleTick(dt){\n  if(BT.waveBreather>0){\n'
assert h.count(old_tickopen)==1
new_tickopen='function finalBattleTick(dt){\n  finalAlliesTick(dt);   /* patch591 */\n  if(BT.waveBreather>0){\n'
h=h.replace(old_tickopen,new_tickopen,1)

# ================= bDraw(): the ally row + the "allyshot" tracer fx =================
old_playerfleet=(
'  // player fleet\n'
'  const n=Math.min(13,Math.max(1,fleetCount())), fr=Math.min(BW,BH)*0.017;\n'
'  for(let i=0;i<n;i++){\n'
'    const fx=BW*(0.5+((i-(n-1)/2)*0.058)), bob=Math.sin(BT.el*2+i)*fr*0.25;\n'
'    bx.save(); bx.translate(fx,fy+bob);\n'
'    bx.shadowColor="#48e2ff"; bx.shadowBlur=10*D;\n'
'    bx.fillStyle="#9fe6ff";\n'
'    bx.beginPath(); bx.moveTo(0,-fr*1.5); bx.lineTo(fr,fr*.9); bx.lineTo(0,fr*.35); bx.lineTo(-fr,fr*.9);\n'
'    bx.closePath(); bx.fill(); bx.shadowBlur=0;\n'
'    bx.fillStyle="rgba(120,220,255,.5)";\n'
'    bx.fillRect(-fr*.22,fr*.9,fr*.44,fr*(.5+.4*Math.abs(Math.sin(BT.el*9+i))));\n'
'    bx.restore();\n'
'  }\n'
'\n'
'  // mender tethers, drawn under everything so they read as support beams\n'
)
assert h.count(old_playerfleet)==1
new_playerfleet=old_playerfleet.replace(
'  // mender tethers, drawn under everything so they read as support beams\n',
'  // allies (patch591): a small row of player-shape ships in each rival\'s own\n'
'  // colour, just above the player fleet - see allyRowX/allyRowY (shared with the\n'
'  // ally-fire tracer below), never overlapping the bottom HUD overlay at any width.\n'
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
'\n'
'  // mender tethers, drawn under everything so they read as support beams\n'
)
assert new_playerfleet!=old_playerfleet
h=h.replace(old_playerfleet,new_playerfleet,1)

old_beamfx=(
'    } else if(f.t==="beam"||f.t==="auto"){\n'
'      const col=f.t==="beam"?(f.c?"#fff1b8":"#ffd166"):"#7fd8ff";\n'
'      bx.strokeStyle=col; bx.globalAlpha=Math.max(0,f.a)*(f.t==="beam"?0.95:0.5);\n'
'      bx.lineWidth=(f.t==="beam"?(f.c?6.5:4):1.7)*D; bx.lineCap="round";\n'
'      bx.beginPath(); bx.moveTo(BW*.5,fy-fr); bx.lineTo(f.x,f.y); bx.stroke(); bx.lineCap="butt";\n'
'    }\n'
'  }\n'
)
assert h.count(old_beamfx)==1
new_beamfx=(
'    } else if(f.t==="beam"||f.t==="auto"){\n'
'      const col=f.t==="beam"?(f.c?"#fff1b8":"#ffd166"):"#7fd8ff";\n'
'      bx.strokeStyle=col; bx.globalAlpha=Math.max(0,f.a)*(f.t==="beam"?0.95:0.5);\n'
'      bx.lineWidth=(f.t==="beam"?(f.c?6.5:4):1.7)*D; bx.lineCap="round";\n'
'      bx.beginPath(); bx.moveTo(BW*.5,fy-fr); bx.lineTo(f.x,f.y); bx.stroke(); bx.lineCap="butt";\n'
'    } else if(f.t==="allyshot"){          /* patch591: a rival-coloured tracer from the ally row */\n'
'      bx.strokeStyle=f.col||"#5ce6a5"; bx.globalAlpha=Math.max(0,f.a)*0.85;\n'
'      bx.lineWidth=3*D; bx.lineCap="round";\n'
'      bx.beginPath(); bx.moveTo(f.x,f.y); bx.lineTo(f.tx,f.ty); bx.stroke(); bx.lineCap="butt";\n'
'    }\n'
'  }\n'
)
h=h.replace(old_beamfx,new_beamfx,1)

# ================= BUILD =================
old_build="const BUILD=590;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=591;",1)

# ================= __SD export =================
old_exp='  endFinalBattle,finaleWon,\n'
assert h.count(old_exp)==1
new_exp='  endFinalBattle,finaleWon,\n  FINAL_ALLY_ORDER,ALLY_DPS_FRAC,ALLY_IV,finalAllyJoin,finalAlliesTick,allyRowX,allyRowY,\n'
h=h.replace(old_exp,new_exp,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch591 applied")
