import io

"""patch590 - PLAN-ending.md Batch D, item D2 part 1: the final battle.

startFinalBattle() (patch589's stub) becomes real: it builds a scripted target
{final:1, name:"VEGA's Fleet", arch:"mirror", ...} and calls engageTarget(t,-1) -
the same shared entry point the turn scene's own ENGAGE button and the pinned Raids
card (#endCard) already call (patch589/589b). engageTarget() itself needed three
small, targeted branches for t.final rather than a parallel implementation:
  - always weapon mode, regardless of S.cmode (cmode is dev-only) - BT.mode's own
    ternary gets a t.final case ahead of the existing cmode checks.
  - wave strength comes from the player's OWN fleetHPMax()/fleetDPS() at engage time
    (the dps/hpm already computed at the top of the function for BT.hp/BT.hpm/BT.dps)
    instead of the raid par curve (refDPS()/refHP()) every ordinary fight uses -
    totalHP/totalDPS get a t.final branch, wave 1's own FINAL_WAVE_MULT[0].
  - a few extra BT fields (wave/waveBreather/withdraw/withdrawT/boss) that only the
    final battle ever reads or writes - harmless on every ordinary fight.
Everything else about wave 1's spawn (kind-picking via mixFor(t), the "at least one
fused hostile" floor, the hostile object shape) is the SAME loop every other fight
already uses, unmodified - t.arch="mirror" is the only new input, handled entirely
inside mixFor()/mirrorMix() below.

mirror archetype (mixFor/mirrorMix/mirrorWeaponFocus, next to ARCH): a mix built from
the player's own ship composition and single strongest equipped weapon rather than a
fixed table - see mirrorMix()'s own comment for the full documented mapping (the
plan's own fallback for "no clean 1:1 mapping exists": weight toward whatever counters
the player's strongest weapon, and say so).

Waves 2/3 (finalSpawnWave, next to bUpdateWep) spawn only once the previous wave is
fully dead (finalBattleTick, not a timer) - duplicating engageTarget()'s own spawn-
object shape, the same way the existing STAGE 1 reinforcement block already duplicates
it rather than sharing it. Wave 3 adds a boss unit (EK "boss" kind, tagged e.boss=1 -
not to be confused with EK[k].boss, the kind-level flag every Flagship already has) -
"VEGA Core" gets FINAL_BOSS_HP_SHARE of wave 3's HP/DPS budget, the rest split among
the wave's other hostiles exactly like every other wave.

The Core breaking off (<25% hull, FINAL_BOSS_BREAK) is checked wherever a hostile's hp
actually changes - hitEnemy() AND hitSystem() (a system-targeted shot's SYS_BLEED can
also cross the threshold) - both call the shared finalBossBreakCheck(e) immediately
before their own "if(e.hp<=0)" kill logic and return early if it fires, so an overkill
hit that also crosses 0 still reads as a break-off, never a kill. During the withdraw
beat (BT.withdraw, FINAL_WITHDRAW_T seconds) bUpdateWep() returns immediately after
moving the fleet out - before shields/repair/hostile behaviour/foeFire/the ordinary
win-timeout checks ever run - so nothing can fire, nothing can be killed, and
queueWin()/endBattle("timeout") cannot fire mid-withdraw. fireWeapon() (the player's
own manual trigger) gets the same BT.withdraw guard directly, belt and braces.

Ordinary reinforcement/pressure (WAVE_ADD/PRESSURE_IV, both STAGE 1) are switched off
for this fight entirely (`!BT.t.final &&` in front of the existing waveDone block) -
the plan's own wording. FINAL_CAP=300 replaces WEP_CAP for this fight only (bUpdateWep
branches to finalBattleTick() before ever reaching the ordinary WEP_CAP check); timeout
and hull-0 both read as a loss, per the plan ("timeout or hull 0 = loss").

endBattle(how) gets its own branch at the very top for BT.t.final (endFinalBattle) -
none of the ordinary raid/assault reward or claim logic runs (no raidReward()/
svReward(), no S.tg splice since idx is always -1, no sysId handling since the target
never has one) exactly as the code map called for. Loss keeps the ordinary fleet-
damage handling (25% of each hull class, S.losses++, S.fhp=0.35) and leaves S.end
untouched (still 1) so #endCard's ENGAGE returns. Win (how==="finalwin", only ever
reached from the withdraw beat finishing) shows a single-button result card that calls
finaleWon() - a stub here (S.end=2, save, toast) per this run's own scope; patch592
builds the real ending screen. Setting S.end=2 is already enough on its own for
nexLv() (patch589: S.end===1 is the only suspended state) to read real Nexus levels
again the instant this runs - nothing extra needed here for that.

bDraw(): a new LEADING branch on the existing e.k shape if/else chain (BT.t.final,
ahead of the swift/warden/phantom/impaler/boss/generic branches, which are otherwise
completely untouched - tsilhouette2.js's own regex anchors on `if(e.k==="swift"){`
literally, which still matches unchanged after this, mid-line, inside the new `else
if`) draws every final-battle hostile as the player's own ship silhouette (mirrored
vertically to face the player), per the plan ("drawn with the player-fleet ship
shape"). Colour: the shared `col=...` ternary (tsilhouette2.js pins this line byte-
identical, so it is NOT touched) already falls through to BT.T.col for any kind
without its own hardcoded colour (grunt/shield/warden/phantom/impaler, and K.boss
already forces "#ff5f6d" red regardless of BT.T.col) - the scripted target's own
ti:4 (RAIDS' "flag" entry, col "#ff5f6d") makes that fallback VEGA-red for free, no
new colour logic needed. swift/heal/bomber/split keep their ordinary type colours
(yellow/green/orange/purple) since touching the colour line would break the pinned
test - called out as the documented, smallest-diff choice; a fully uniform red would
need that shared line rewritten, which the test suite explicitly guards against.

allies (BT.allies, the small rival-coloured support row) are patch591, not this one -
finalSpawnWave()/finalBattleTick() are written with their eventual call sites bare of
any ally hook so this patch runs correctly standalone (pcheck/tq2/full-suite all
pass with only this patch applied); patch591 inserts the two calls with its own
anchored edits."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ================= ARCH.mirror (no static mix - mixFor/mirrorMix below) =================
old_arch=(
'const ARCH={\n'
' swarm:   {n:"Swarm",    tag:"Numbers, not tricks"},\n'
' fortress:{n:"Fortress", tag:"Heavy shields and repair - burn it down fast or grind forever",\n'
'   mix:{grunt:14, shield:34, heal:26, warden:26} },\n'
' ghost:   {n:"Ghost",    tag:"Evasive until their engines drop",\n'
'   mix:{grunt:18, swift:22, phantom:38, heal:12, bomber:10} },\n'
' lance:   {n:"Lance",    tag:"One huge shot on a long, visible fuse",\n'
'   mix:{grunt:22, shield:18, impaler:32, swift:18, heal:10} }\n'
'};\n'
'/* the mix a fight actually draws from: a garrison\'s assigned archetype overrides\n'
'   the tier mix; anything without one (raids, un-garrisoned assaults) is untouched. */\n'
'function mixFor(t){ return (t.arch && ARCH[t.arch] && ARCH[t.arch].mix) || null }\n'
)
assert h.count(old_arch)==1
new_arch=(
'const ARCH={\n'
' swarm:   {n:"Swarm",    tag:"Numbers, not tricks"},\n'
' fortress:{n:"Fortress", tag:"Heavy shields and repair - burn it down fast or grind forever",\n'
'   mix:{grunt:14, shield:34, heal:26, warden:26} },\n'
' ghost:   {n:"Ghost",    tag:"Evasive until their engines drop",\n'
'   mix:{grunt:18, swift:22, phantom:38, heal:12, bomber:10} },\n'
' lance:   {n:"Lance",    tag:"One huge shot on a long, visible fuse",\n'
'   mix:{grunt:22, shield:18, impaler:32, swift:18, heal:10} },\n'
' /* patch590, final battle only: no static mix - mixFor() below special-cases this\n'
'    id and asks mirrorMix() for one built from the player\'s OWN current loadout\n'
'    instead, since the whole point is "your own fleet, mirrored". */\n'
' mirror:  {n:"Mirror",   tag:"Weighted from your own loadout, turned against you"}\n'
'};\n'
'/* the mix a fight actually draws from: a garrison\'s assigned archetype overrides\n'
'   the tier mix; anything without one (raids, un-garrisoned assaults) is untouched. */\n'
'function mixFor(t){\n'
'  if(t.arch==="mirror")return mirrorMix();          /* patch590 - see mirrorMix() below */\n'
'  return (t.arch && ARCH[t.arch] && ARCH[t.arch].mix) || null;\n'
'}\n'
'/* patch590: the final battle\'s enemy mix is built from the player\'s OWN loadout at\n'
'   engage time, not a fixed table - "weighted from your own loadout, turned against\n'
'   you" (plan wording). No clean 1:1 mapping exists between 3 ship classes / 7\n'
'   weapons and 9 EK kinds (the plan\'s own documented fallback for exactly this case:\n'
'   "weight toward the kinds that counter the player\'s strongest weapon, and say so"\n'
'   - done below), so this is a deliberately loose, DOCUMENTED mapping:\n'
'     - ship composition sets the base feel: interceptor-heavy leans the mix toward\n'
'       numbers and speed (swift/grunt), dreadnought-heavy toward armour and screens\n'
'       (warden/shield), frigate-heavy splits the difference (grunt/shield) - roughly\n'
'       "a fleet built like yours"\n'
'     - the player\'s single strongest equipped weapon (by mul/chg - damage per second\n'
'       of charge, the same ratio that actually drives fleetDPS) then nudges the mix\n'
'       toward whatever answers it best:\n'
'         pierce (Ion Lance) ignores shields entirely -> countered by evasion, not\n'
'           armour: phantom/swift weighted up\n'
'         a slow, huge single hit (Heavy Cannon/Seeker Missile/Rocket Pod) rewards a\n'
'           target that shrugs off one big hit -> shield/warden/heal weighted up\n'
'         a hits-everyone weapon (Flak Battery) punishes standing in a cluster ->\n'
'           impaler (a fused, telegraphed threat that rewards spreading out, not\n'
'           screens) weighted up\n'
'         fast/cheap weapons (Pulse Laser/Burst Laser), or no weapon equipped at all,\n'
'           reward attrition over any single counter -> grunt/split weighted up\n'
'   Every kind keeps a floor weight so the mix never collapses to one kind, and\n'
'   engageTarget()\'s own "at least one fused hostile" floor (bomber, unconditional)\n'
'   still applies on top of this exactly as it does for every other archetype. */\n'
'function mirrorWeaponFocus(){\n'
'  const eq=equipped().filter(Boolean);\n'
'  if(!eq.length)return null;\n'
'  let best=eq[0];\n'
'  for(const w of eq) if((w.mul/w.chg)>(best.mul/best.chg)) best=w;\n'
'  return best.id;\n'
'}\n'
'function mirrorMix(){\n'
'  const sh=S.sh||[0,0,0], tot=Math.max(1,(sh[0]||0)+(sh[1]||0)+(sh[2]||0));\n'
'  const fInt=(sh[0]||0)/tot, fFrig=(sh[1]||0)/tot, fDread=(sh[2]||0)/tot;\n'
'  const w={grunt:10, shield:10, swift:8, bomber:8, split:6, heal:6, warden:6, phantom:6, impaler:8};\n'
'  w.swift+=fInt*30; w.grunt+=fInt*15;\n'
'  w.grunt+=fFrig*15; w.shield+=fFrig*20;\n'
'  w.warden+=fDread*30; w.shield+=fDread*15;\n'
'  const focus=mirrorWeaponFocus();\n'
'  if(focus==="ion"){ w.phantom+=30; w.swift+=15 }\n'
'  else if(focus==="heavy"||focus==="mis"||focus==="rocket"){ w.shield+=20; w.warden+=15; w.heal+=15 }\n'
'  else if(focus==="flak"){ w.impaler+=30; w.split+=10 }\n'
'  else { w.grunt+=20; w.split+=10 }   /* pulse/burst, or no weapon equipped yet */\n'
'  return w;\n'
'}\n'
)
h=h.replace(old_arch,new_arch,1)

# ================= startFinalBattle(): the real scripted target, for real =================
old_stub=(
'function startFinalBattle(){\n'
'  if(fleetDPS()<=0){\n'
'    if(sceneOn)sceneClose();\n'
'    toast("No fleet \\u2014 build warships first.","r");\n'
'    return;\n'
'  }\n'
'  toast("Final battle \\u2014 coming in patch 590","y");\n'
'}\n'
)
assert h.count(old_stub)==1
new_stub=(
'function startFinalBattle(){\n'
'  if(fleetDPS()<=0){\n'
'    if(sceneOn)sceneClose();\n'
'    toast("No fleet \\u2014 build warships first.","r");\n'
'    return;\n'
'  }\n'
'  /* patch590: the scripted final target. ti:4 is RAIDS\' own "flag" entry (col\n'
'     "#ff5f6d") - only read for BT.T.col\'s fallback (bDraw\'s enemy colour line,\n'
'     untouched by this patch - see its own header note) and the boom-fx colour, so\n'
'     this alone makes most of the fleet read VEGA-red for free. secs/dif/dmg are\n'
'     unused by engageTarget()\'s own t.final branch (totalHP/totalDPS read\n'
'     hpm/dps*FINAL_WAVE_MULT instead) - kept at sane placeholder values only in\n'
'     case something else ever reads them. en is wave 1\'s own hostile count. */\n'
'  engageTarget({ final:1, name:"VEGA\'s Fleet", arch:"mirror", ti:4,\n'
'    en:FINAL_WAVE_EN[0], secs:FINAL_CAP, dif:1, dmg:1 }, -1);\n'
'}\n'
)
h=h.replace(old_stub,new_stub,1)

# ================= engageTarget(): force wep mode + t.final HP/DPS budget + extra BT fields =================
old_totalhp=(
'  const wep = (S.cmode!=="live"&&S.cmode!=="turn");\n'
'  const totalHP=refDPS()*t.secs*t.dif*(wep?wepHpMul():1);\n'
'  const totalDPS=(refHP()*t.dmg)/t.secs*(wep?WEP_INC:1);\n'
)
assert h.count(old_totalhp)==1
new_totalhp=(
'  const wep = (S.cmode!=="live"&&S.cmode!=="turn");\n'
'  /* patch590: the final battle sizes wave 1 off the player\'s OWN fleetHPMax()/\n'
'     fleetDPS() at engage time (dps/hpm just above) rather than the raid par curve -\n'
'     see finalSpawnWave() (next to bUpdateWep) for waves 2/3\'s own FINAL_WAVE_MULT. */\n'
'  const totalHP = t.final ? hpm*FINAL_WAVE_MULT[0] : refDPS()*t.secs*t.dif*(wep?wepHpMul():1);\n'
'  const totalDPS = t.final ? dps*FINAL_WAVE_MULT[0] : (refHP()*t.dmg)/t.secs*(wep?WEP_INC:1);\n'
)
h=h.replace(old_totalhp,new_totalhp,1)

old_btlit=(
'       spawnAvgHP:totalHP/Math.max(1,t.en), spawnAvgDPS:totalDPS/Math.max(1,t.en),\n'
'       waveDone:0, pTick:0 };\n'
)
assert h.count(old_btlit)==1
new_btlit=(
'       spawnAvgHP:totalHP/Math.max(1,t.en), spawnAvgDPS:totalDPS/Math.max(1,t.en),\n'
'       waveDone:0, pTick:0,\n'
'       /* patch590: final battle only (BT.t.final) - wave number, inter-wave\n'
'          breather timer, and the withdraw beat once the Core breaks. Harmless on\n'
'          every ordinary fight, which never reads any of these. */\n'
'       wave:1, waveBreather:0, withdraw:0, withdrawT:0, boss:null };\n'
)
h=h.replace(old_btlit,new_btlit,1)

old_mode=(
'  /* turn mode derives its numbers from the same budget the live fight uses, so the\n'
'     two models stay balanced against each other without separate tuning */\n'
'  BT.mode = (S.cmode==="live") ? "live" : (S.cmode==="turn" ? "turn" : "wep");\n'
)
assert h.count(old_mode)==1
new_mode=(
'  /* turn mode derives its numbers from the same budget the live fight uses, so the\n'
'     two models stay balanced against each other without separate tuning */\n'
'  BT.mode = t.final ? "wep" : ((S.cmode==="live") ? "live" : (S.cmode==="turn" ? "turn" : "wep"));   /* patch590: always weapon mode */\n'
)
h=h.replace(old_mode,new_mode,1)

# ================= fireWeapon(): no firing during the withdraw beat =================
old_fireweapon='function fireWeapon(i){\n  if(!BT||BT.done||BT.mode!=="wep")return false;\n'
assert h.count(old_fireweapon)==1
new_fireweapon='function fireWeapon(i){\n  if(!BT||BT.done||BT.mode!=="wep"||BT.withdraw)return false;   /* patch590: no firing once the Core has broken off */\n'
h=h.replace(old_fireweapon,new_fireweapon,1)

# ================= new final-battle module: consts + wave/withdraw machinery =================
old_bupdatewep_fn='function bUpdateWep(dt){\n'
assert h.count(old_bupdatewep_fn)==1
final_module=(
'/* ---------------- the final battle (patch590) ----------------\n'
'   Three scripted waves through the ordinary wep-mode simulation (bUpdateWep, right\n'
'   below), sized off the player\'s OWN fleetHPMax()/fleetDPS() at engage time\n'
'   (BT.hpm/BT.dps - fixed for the whole fight, exactly like every ordinary fight\n'
'   already treats them) rather than the raid par curve. Wave 1 spawns through\n'
'   engageTarget() itself (its own t.final branch, above); waves 2/3 spawn here, on\n'
'   the same hostile-object shape as engageTarget()\'s own spawn loop and the STAGE 1\n'
'   reinforcement block below - duplicated rather than shared, matching how that\n'
'   reinforcement block already duplicates engageTarget()\'s loop instead of\n'
'   factoring it out. */\n'
'const FINAL_WAVE_MULT=[0.6,0.8,1.0], FINAL_WAVE_EN=[4,5,5];   /* TUNING-PENDING */\n'
'const FINAL_BOSS_HP_SHARE=0.35;   /* TUNING-PENDING - VEGA Core\'s share of wave 3\'s HP/DPS budget */\n'
'const FINAL_BREATHER_S=2;         /* TUNING-PENDING - pause between waves */\n'
'const FINAL_BOSS_BREAK=0.25;      /* owner decision: the Core breaking off (and winning the fight) triggers here */\n'
'const FINAL_WITHDRAW_T=1.5;       /* owner decision: ~1.5s fly-out before the result card */\n'
'const FINAL_CAP=300;              /* owner decision: this fight only - see finalBattleTick() */\n'
'function finalHostileObj(k,hp,dps,i,n,boss){\n'
'  const K=EK[k]||EK.grunt, slist=sysListFor(k);\n'
'  return { k, hp, max:hp, dps, alive:1,\n'
'    sys:slist.map(sk=>({k:sk, st:0, d:0, rt:0})),\n'
'    shd:0, shdT:0,\n'
'    x: boss ? 0.5 : .15+.7*((i+.5)/Math.max(1,n)),\n'
'    y: boss ? .16 : .18+Math.random()*.30,\n'
'    px:Math.random()*6.28, py:Math.random()*6.28, sp:(.5+Math.random()*.6)*K.sp,\n'
'    rr:K.r, wa:Math.random()*6.28, ws:0.5+Math.random()*0.7,\n'
'    shp:K.sh?hp*K.sh:0, shm:K.sh?hp*K.sh:0, rg:0,\n'
'    fz:K.fuse||0, fzm:K.fuse||0,\n'
'    wcd:(K.fuse?(K.fuseS||FUSE_S)*0.8:EFIRE*(0.8+Math.random()*0.9)/Math.max(0.5,K.sp)),\n'
'    boss:!!boss };\n'
'}\n'
'function finalSpawnWave(wave){\n'
'  BT.wave=wave;\n'
'  const totalHP=BT.hpm*FINAL_WAVE_MULT[wave-1], totalDPS=BT.dps*FINAL_WAVE_MULT[wave-1];\n'
'  const n=FINAL_WAVE_EN[wave-1], hasBoss=wave>=3;\n'
'  const bossHP=hasBoss?totalHP*FINAL_BOSS_HP_SHARE:0, bossDPS=hasBoss?totalDPS*FINAL_BOSS_HP_SHARE:0;\n'
'  const restHP=totalHP-bossHP, restDPS=totalDPS-bossDPS;\n'
'  const mix=mirrorMix();\n'
'  const kinds=[]; for(let i=0;i<n;i++)kinds.push(pickKindFrom(mix));\n'
'  if(n>=2 && !kinds.some(k=>EK[k].fuse))kinds[Math.floor(Math.random()*kinds.length)]="bomber";\n'
'  let wsum=0; for(const k of kinds)wsum+=EK[k].hp;\n'
'  for(let i=0;i<n;i++){\n'
'    const k=kinds[i], K=EK[k], share=K.hp/wsum;\n'
'    BT.en.push(finalHostileObj(k, restHP*share, restDPS*share*K.dps, i, n, false));\n'
'  }\n'
'  if(hasBoss){\n'
'    const K=EK.boss;\n'
'    const bh=finalHostileObj("boss", bossHP, bossDPS*K.dps, 0, 1, true);\n'
'    BT.en.push(bh); BT.boss=bh;\n'
'  }\n'
'  BT.tot+=n+(hasBoss?1:0);\n'
'  toast("WAVE "+wave+" / 3","y");\n'
'}\n'
'/* the VEGA Core breaks off instead of dying - checked wherever a hostile\'s hp\n'
'   actually changes (hitEnemy/hitSystem below), before either one\'s own kill check,\n'
'   so an overkill hit that also crosses 0 still reads as a break-off, never a kill. */\n'
'function finalBossBreakCheck(e){\n'
'  if(!BT||!BT.t||!BT.t.final||BT.withdraw||!e.boss)return false;\n'
'  if(e.hp/e.max < FINAL_BOSS_BREAK){ startFinalWithdraw(); return true }\n'
'  return false;\n'
'}\n'
'function startFinalWithdraw(){\n'
'  BT.withdraw=1; BT.withdrawT=0;\n'
'  toast("VEGA\'s Core breaks \\u2014 the fleet withdraws","y");\n'
'}\n'
'/* everything else the final battle needs once the ordinary wep-mode sim for this\n'
'   frame has run (charging/shields/repair/hostile behaviour, all unchanged above):\n'
'   wave-clear detection, the inter-wave breather, and FINAL_CAP. Never reached\n'
'   during the withdraw beat - bUpdateWep() returns before this runs whenever\n'
'   BT.withdraw is set, so queueWin()/endBattle("timeout") cannot fire mid-withdraw. */\n'
'function finalBattleTick(dt){\n'
'  if(BT.waveBreather>0){\n'
'    BT.waveBreather-=dt;\n'
'    if(BT.waveBreather<=0)finalSpawnWave(BT.wave+1);\n'
'    return;\n'
'  }\n'
'  if(!BT.en.some(e=>e.alive)){\n'
'    if(BT.wave<3){ BT.waveBreather=FINAL_BREATHER_S; return }\n'
'    endBattle("win");   /* edge case: wave 3 cleared outright, the Core never broke 25% */\n'
'    return;\n'
'  }\n'
'  if(BT.hp<=0){ endBattle("lost"); return }\n'
'  if(BT.el>=FINAL_CAP){ endBattle("lost"); return }   /* owner decision: timeout is a loss here, not a partial win */\n'
'}\n'
)
h=h.replace(old_bupdatewep_fn, final_module+old_bupdatewep_fn, 1)

# ================= bUpdateWep(): withdraw beat, no ordinary reinforcement, final ending dispatch =================
old_bupdatewep=(
'function bUpdateWep(dt){\n'
'  /* a true freeze, both sides, like FTL\'s: nothing charges, nothing fires, no clock.\n'
'     It buys thinking time without removing any threat. */\n'
'  if(BT.paused){ bFade(dt); return }\n'
'  BT.el+=dt;\n'
)
assert h.count(old_bupdatewep)==1
new_bupdatewep=(
'function bUpdateWep(dt){\n'
'  /* a true freeze, both sides, like FTL\'s: nothing charges, nothing fires, no clock.\n'
'     It buys thinking time without removing any threat. */\n'
'  if(BT.paused){ bFade(dt); return }\n'
'  BT.el+=dt;\n'
'  /* patch590: the withdraw beat - the Core has broken off, every hostile flies out,\n'
'     nothing fires, nothing charges, nothing can be killed. Returns before any of\n'
'     the ordinary per-frame logic below, so queueWin()/timeout cannot fire here. */\n'
'  if(BT.t && BT.t.final && BT.withdraw){\n'
'    BT.withdrawT+=dt;\n'
'    for(const e of BT.en){ if(e.alive){ e.y-=dt*0.55; e.x+=Math.sin(BT.el*3+e.px)*dt*0.05; } }\n'
'    bFade(dt);\n'
'    if(BT.withdrawT>=FINAL_WITHDRAW_T)endBattle("finalwin");\n'
'    return;\n'
'  }\n'
)
h=h.replace(old_bupdatewep,new_bupdatewep,1)

old_wavedone_open='  if(!BT.waveDone){\n    const tick=Math.floor(BT.el/PRESSURE_IV);\n'
assert h.count(old_wavedone_open)==1
new_wavedone_open='  if(!BT.t.final && !BT.waveDone){   /* patch590: ordinary reinforcement/pressure off for the final battle */\n    const tick=Math.floor(BT.el/PRESSURE_IV);\n'
h=h.replace(old_wavedone_open,new_wavedone_open,1)

old_bupdatewep_tail=(
'  bFade(dt);\n'
'  if(!BT.en.some(e=>e.alive))queueWin(dt);\n'
'  else if(BT.hp<=0)endBattle("lost");\n'
'  else if(BT.el>=WEP_CAP)endBattle("timeout");\n'
'}\n'
'/* telegraphs are rolled once per round and shown before you allocate, so the board\n'
)
assert h.count(old_bupdatewep_tail)==1
new_bupdatewep_tail=(
'  bFade(dt);\n'
'  if(BT.t && BT.t.final)return finalBattleTick(dt);   /* patch590 - see above */\n'
'  if(!BT.en.some(e=>e.alive))queueWin(dt);\n'
'  else if(BT.hp<=0)endBattle("lost");\n'
'  else if(BT.el>=WEP_CAP)endBattle("timeout");\n'
'}\n'
'/* telegraphs are rolled once per round and shown before you allocate, so the board\n'
)
h=h.replace(old_bupdatewep_tail,new_bupdatewep_tail,1)

# ================= hitSystem()/hitEnemy(): the Core break-off check =================
old_hitsystem_kill=(
'    if(s.k==="shd"&&s.st>=1){\n'
'      const wasFinal=e.shd===1;\n'
'      e.shd=0;\n'
'      if(wasFinal){ BT.fx.push({t:"shshatter",x:e.x*BW,y:e.y*BH,a:1,r:0});\n'
'        sfx("shieldShatter"); }\n'
'    }\n'
'    if(e.hp<=0){ e.alive=0; BT.kills++;\n'
'      BT.fx.push({t:"boom",x:e.x*BW,y:e.y*BH,a:1,r:0}); sfx("foeDead") }\n'
'    return true;\n'
'  }\n'
'  return false;\n'
'}\n'
)
assert h.count(old_hitsystem_kill)==1
new_hitsystem_kill=(
'    if(s.k==="shd"&&s.st>=1){\n'
'      const wasFinal=e.shd===1;\n'
'      e.shd=0;\n'
'      if(wasFinal){ BT.fx.push({t:"shshatter",x:e.x*BW,y:e.y*BH,a:1,r:0});\n'
'        sfx("shieldShatter"); }\n'
'    }\n'
'    if(finalBossBreakCheck(e))return true;   /* patch590 - before the kill check, never after */\n'
'    if(e.hp<=0){ e.alive=0; BT.kills++;\n'
'      BT.fx.push({t:"boom",x:e.x*BW,y:e.y*BH,a:1,r:0}); sfx("foeDead") }\n'
'    return true;\n'
'  }\n'
'  return false;\n'
'}\n'
)
h=h.replace(old_hitsystem_kill,new_hitsystem_kill,1)

old_hitenemy_kill=(
'  } else e.hp-=dmg;\n'
'  if(manual){\n'
'    BT.num.push({x:e.x*BW,y:e.y*BH,v:shown,a:1,c:manual===2});\n'
'    BT.fx.push({t:"beam",x:e.x*BW,y:e.y*BH,a:1,c:manual===2});\n'
'  }\n'
'  if(e.hp<=0){ e.alive=0; BT.kills++;\n'
)
assert h.count(old_hitenemy_kill)==1
new_hitenemy_kill=(
'  } else e.hp-=dmg;\n'
'  if(manual){\n'
'    BT.num.push({x:e.x*BW,y:e.y*BH,v:shown,a:1,c:manual===2});\n'
'    BT.fx.push({t:"beam",x:e.x*BW,y:e.y*BH,a:1,c:manual===2});\n'
'  }\n'
'  if(finalBossBreakCheck(e))return;   /* patch590 - before the kill check, never after */\n'
'  if(e.hp<=0){ e.alive=0; BT.kills++;\n'
)
h=h.replace(old_hitenemy_kill,new_hitenemy_kill,1)

# ================= endBattle(): its own branch for the final fight =================
old_endbattle_head=(
'function endBattle(how){\n'
'  if(BT.done)return; BT.done=1;\n'
'  const t=BT.t, T=BT.T, frac=BT.kills/BT.tot;\n'
)
assert h.count(old_endbattle_head)==1
new_endbattle_head=(
'function endBattle(how){\n'
'  if(BT.done)return; BT.done=1;\n'
'  if(BT.t && BT.t.final)return endFinalBattle(how);   /* patch590: no raid/assault reward or claim logic applies */\n'
'  const t=BT.t, T=BT.T, frac=BT.kills/BT.tot;\n'
)
h=h.replace(old_endbattle_head,new_endbattle_head,1)

old_closebattle='function closeBattle(){ BT=null; $("#battle").classList.remove("on"); dirty=true; render(); save(); }\n'
assert h.count(old_closebattle)==1
new_closebattle=(
'/* patch590: the final battle\'s own result branch - a scripted, one-off fight has no\n'
'   loot and does not touch S.tg/S.taken/S.occ, so it never runs through the ordinary\n'
'   raid/assault reward or claim logic above (per the code map: "give it its own\n'
'   result branch"). how is "lost" (hull 0 or FINAL_CAP - both read the same, per the\n'
'   plan) or "finalwin" (the withdraw beat finished). */\n'
'function endFinalBattle(how){\n'
'  if(how==="lost"){\n'
'    for(let i=0;i<3;i++){ if(S.sh[i]>0){ const l=Math.max(1,Math.ceil(S.sh[i]*0.25)); S.sh[i]-=l } }\n'
'    S.losses=(S.losses||0)+1; S.fhp=0.35;\n'
'    $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--rd)">Fleet Broken</h3>\n'
'      <div class="rsub">VEGA\'s fleet still holds Sol Reach. Repair and try again.</div> <!-- PLACEHOLDER -->\n'
'      <div class="rline"><span>Hostiles destroyed</span><b>${BT.kills} / ${BT.tot}</b></div>\n'
'      <div class="rline"><span>Fleet integrity</span><b>${Math.round(S.fhp*100)}%</b></div>\n'
'      <button id="bDone">RETURN TO EMPIRE</button></div>`;\n'
'    $("#bRes").classList.add("on"); $("#bDone").onclick=closeBattle;\n'
'    sfx("loss"); dirty=true; save();\n'
'    return;\n'
'  }\n'
'  /* how==="finalwin" - S.end stays 1 until finaleWon() runs, so every seized\n'
'     Nexus/advisor/rival surface (patch589) stays exactly as it was through this\n'
'     card; only tapping the one button below moves S.end to 2. */\n'
'  S.fhp=Math.max(0.05,BT.hp/BT.hpm);\n'
'  $("#bRes").innerHTML=`<div class="rescard"><h3 style="color:var(--gr)">The Core Breaks</h3>\n'
'    <div class="rsub">VEGA\'s fleet falls back. Sol Reach is yours to finish.</div> <!-- PLACEHOLDER -->\n'
'    <button id="bFinaleDone">CONTINUE</button></div>`;\n'
'  $("#bRes").classList.add("on");\n'
'  $("#bFinaleDone").onclick=()=>{ finaleWon(); closeBattle(); };\n'
'  sfx("win"); dirty=true; save();\n'
'}\n'
'/* stub - patch592 turns this into the real ending screen + free-play conversion\n'
'   (peace, an unlocked pjx card, etc - owner decision 5). S.end=2 is already enough\n'
'   on its own for nexLv() (patch589: S.end===1 is the ONLY suspended state) to read\n'
'   real Nexus levels again the instant this runs - nothing extra needed here. */\n'
'function finaleWon(){\n'
'  S.end=2;\n'
'  dirty=true; save();\n'
'  toast("Ending \\u2014 coming in patch 592","y");\n'
'}\n'
'function closeBattle(){ BT=null; $("#battle").classList.remove("on"); dirty=true; render(); save(); }\n'
)
h=h.replace(old_closebattle,new_closebattle,1)

# ================= bDraw(): final-battle hostiles reuse the player ship silhouette =================
old_shapechain=(
'    bx.beginPath();\n'
'    if(e.k==="swift"){                              /* needle */\n'
)
assert h.count(old_shapechain)==1
new_shapechain=(
'    bx.beginPath();\n'
'    if(BT.t&&BT.t.final){                           /* patch590: VEGA\'s fleet mirrors your own hull */\n'
'      bx.moveTo(0,ER*1.5); bx.lineTo(ER,-ER*.9); bx.lineTo(0,-ER*.35); bx.lineTo(-ER,-ER*.9);\n'
'    } else if(e.k==="swift"){                              /* needle */\n'
)
h=h.replace(old_shapechain,new_shapechain,1)

# ================= BUILD =================
old_build="const BUILD=589;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=590;",1)

# ================= __SD export =================
old_exp1='  nexLv,startFinale,startFinalBattle,PJ1_MUL,PJ2_MUL,PJ3_MUL,renderNex,offlineEff,\n'
assert h.count(old_exp1)==1
new_exp1=(
'  nexLv,startFinale,startFinalBattle,PJ1_MUL,PJ2_MUL,PJ3_MUL,renderNex,offlineEff,\n'
'  mirrorMix,mirrorWeaponFocus,FINAL_WAVE_MULT,FINAL_WAVE_EN,FINAL_BOSS_HP_SHARE,\n'
'  FINAL_BREATHER_S,FINAL_BOSS_BREAK,FINAL_WITHDRAW_T,FINAL_CAP,\n'
'  finalHostileObj,finalSpawnWave,finalBattleTick,finalBossBreakCheck,startFinalWithdraw,\n'
'  endFinalBattle,finaleWon,\n'
)
h=h.replace(old_exp1,new_exp1,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch590 applied")
