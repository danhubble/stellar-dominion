import io

"""patch592 - D3 of the Batch D split (D1 patch589 "the turn", D2 patch590/591 the
final battle+allies, D3 this + patch593 the dev/test tail). PLAN-ending.md 592:
"Ending and free play".

finaleWon() (patch590's stub - S.end=2, save, a "coming in patch 592" toast) becomes
real: it now also converts the map to peace (owner decision 5) and opens a real
ending screen. Both halves are also applied on every BOOT at S.end===2 (adopt()),
not only at the moment of the win, since a real reload reruns the module-scope
GARRISON loop (~line 2344) regardless of S.end and would otherwise show rival-held
systems again after a refresh.

1. PEACE. applyPeace()/revertPeace() - GARRISON itself is never mutated or deleted;
   only the SYS objects' own s.owner/s.def/s.arch (set from GARRISON once, at module
   load) are cleared/restored, so peace is fully reversible (revertPeace() is
   patch593's RESET ENDING). sysOwner()/sysContested()/canAssault()/sysOpen() all
   read s.owner (or its S.occ/S.lost/S.taken overlays) directly - once it is null,
   every one of them, and every piece of Map/Empire UI built on them (already
   audited: empSysRow ~5000, the Map popup's action button ~5628-5666, claimSystem
   ~3623), agrees a former GARRISON system is now an ordinary ore claim with no
   change needed anywhere else. drawTerritory() (~3406) also reads s.owner directly
   (SYS.filter(s=>s.owner===rv.id)) - clearing it stops rival territory drawing for
   free, no separate S.end check needed there. S.occ/S.occAt cleared (occupied
   systems read sysHeld() again immediately, since that only ever checks S.occ, not
   S.owner - "returned to the player immediately", per the plan), S.lost cleared
   (a rival's own expansion onto ground that was never GARRISON's also goes back to
   being unclaimed rather than "driven off", not just GARRISON systems), S.thq
   cleared and lfClear() called (belt and braces - both were already cleared at the
   turn, patch589, and rvTick/rvMaybeThreat/lfMaybeLaunch already refuse at
   S.end>=1, but a save written before those guards existed should not depend on
   that). S.taken is deliberately left alone: a beaten GARRISON system already reads
   as an ordinary claim via sysOwner()'s own taken check, peace or not, and
   revertPeace() does not attempt to resurrect S.lost's rival-expansion history -
   only GARRISON ownership is asked to be reversible by the plan's own wording.

2. THE ENDING SCREEN. A new #endScene overlay (own element, not #scene/playScene() -
   every stage here is a different SHAPE of content - title, stat block, glowing
   strip, dim narration, a CONTINUE button - not one more line of dialogue) that
   reuses the exact .scene/.sceneskip/.scenewrap/.scenehint overlay CSS the intro/
   turn scene already has, plus the game's own stat-row look (.wipebox/.wr,
   restartDialog()'s own pattern ~line 10034) rather than inventing new visual
   language. Sequence, tap-anywhere to advance: title card -> stats (time played,
   level, systems held X/total, all-time ore, raid wins, records) -> a glowing
   "END OF CHARTED SPACE" strip that also auto-advances after a short beat -> dim
   STORY.endLast, no avatar -> STORY.endTbc -> CONTINUE. SKIP jumps straight to
   CONTINUE, same as the intro/turn scene. Freely re-openable (the pjx COMPLETE
   card, patch593's SHOW ENDING dev button) since it only ever reads S - nothing in
   it is a one-shot effect, so reopening it can never replay or re-grant anything.
   S.t0 (a real start timestamp already sitting unused in fresh() - grep confirms
   no other code reads it) is back-filled to null ("unknown") for a save adopt()
   cannot vouch for, shown as em-dash rather than guessing.

3. Nexus/advisor/rival suspensions at S.end===2: already correct without any change
   here - nexLv() (patch589) only zeroes at S.end===1, so S.end===2 already reads
   real levels; queueNotice()'s "vega:" refusal and every rvTick/rvMaybeThreat/
   rvMaybeExpand/lfMaybeLaunch guard already read S.end>=1 (covers 2); #endCard and
   the Sol Reach map marker/edge pill already gate on S.end===1 exactly (deliberately
   not >=1, per patch589's own header), so both already disappear once S.end
   reaches 2. Confirmed by direct test in tests/tending2.js, not just re-asserted.

4. renderNex(): the pjx card, once owned AND S.end===2, shows "COMPLETE - VIEW
   ENDING" instead of the ordinary MAXED state and reopens the ending screen.

5. renderRivalBars(): the whole "Rival pressure" section (heading included, not
   just an empty bars list) hides at S.end>=1, per the plan's own wording for this
   patch - pressure has nothing left to show once the turn has come (rivals already
   go quiet at S.end===1), not only once peace is final at S.end===2."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ================= 1. STORY: ending copy =================
old_story=(
'  battleWave:"WAVE {n} / 3",                                                       /* PLACEHOLDER */\n'
'  allyJoin:"{rival} joins the line"                                                /* PLACEHOLDER */\n'
'};\n'
)
assert h.count(old_story)==1
new_story=(
'  battleWave:"WAVE {n} / 3",                                                       /* PLACEHOLDER */\n'
'  allyJoin:"{rival} joins the line",                                               /* PLACEHOLDER */\n'
'  /* patch592: the ending screen\'s own copy - see showEnding()/endStageHTML(). */\n'
'  endTitle:"Charted Space, Secured",                                               /* PLACEHOLDER */\n'
'  endStrip:"END OF CHARTED SPACE",                                                 /* PLACEHOLDER */\n'
'  endLast:"The last chart still shows the fold. VEGA has not spoken since.",       /* PLACEHOLDER */\n'
'  endTbc:"TO BE CONTINUED"                                                        /* PLACEHOLDER */\n'
'};\n'
)
assert new_story!=old_story
h=h.replace(old_story,new_story,1)

# ================= 2. adopt(): S.t0 back-fill =================
old_end=(
'    f.end=Math.max(0,Math.min(2,Math.floor(f.end||0)));\n'
'    if(!("lvSeen" in o))f.lvSeen=f.lvl;\n'
'  }\n'
)
assert h.count(old_end)==1
new_end=(
'    f.end=Math.max(0,Math.min(2,Math.floor(f.end||0)));\n'
'    /* patch592: S.t0 (session start, fresh()) - a save written before this field\n'
'       existed, or carrying a corrupt value, has no reliable start time. Back-filled\n'
'       to null ("unknown") rather than quietly keeping adopt()\'s own fresh()-supplied\n'
'       Date.now() (which would read as "started just now") - same "in o" presence\n'
'       test the XP block above uses. Ending-screen display only (endStats()) - S.t0\n'
'       is otherwise unread anywhere in the game. */\n'
'    if(!("t0" in o) || !(f.t0>0))f.t0=null;\n'
'    if(!("lvSeen" in o))f.lvSeen=f.lvl;\n'
'  }\n'
)
assert new_end!=old_end
h=h.replace(old_end,new_end,1)

# ================= 3. adopt(): apply peace on every boot at S.end===2 =================
old_purge=(
'  if(S.end>=1)purgeVegaNotices();\n'
'  return true;\n'
'}\n'
)
assert h.count(old_purge)==1
new_purge=(
'  if(S.end>=1)purgeVegaNotices();\n'
'  /* patch592: a real reload reruns the module-scope GARRISON loop (~line 2344)\n'
'     regardless of S.end, handing every rival system its owner back before this\n'
'     ever runs - re-apply peace on every boot the save itself says is already won,\n'
'     not only at the instant finaleWon() fires it. */\n'
'  if(S.end===2)applyPeace();\n'
'  return true;\n'
'}\n'
)
assert new_purge!=old_purge
h=h.replace(old_purge,new_purge,1)

# ================= 4. peace + the ending screen (new functions) + finaleWon() for real =================
old_stub=(
'/* stub - patch592 turns this into the real ending screen + free-play conversion\n'
'   (peace, an unlocked pjx card, etc - owner decision 5). S.end=2 is already enough\n'
'   on its own for nexLv() (patch589: S.end===1 is the ONLY suspended state) to read\n'
'   real Nexus levels again the instant this runs - nothing extra needed here. */\n'
'function finaleWon(){\n'
'  S.end=2;\n'
'  dirty=true; save();\n'
'  toast("Ending \\u2014 coming in patch 592","y");\n'
'}\n'
)
assert h.count(old_stub)==1
new_stub=(
'/* ---------------- peace (patch592) ----------------\n'
'   Owner decision 5: once the game is won, every rival-held system becomes an\n'
'   ordinary ore claim so free play can still finish the map. GARRISON (the table\n'
'   itself) is never mutated or deleted - only the SYS objects\' own s.owner/s.def/\n'
'   s.arch (set from it once, in the loop right after GARRISON\'s own definition,\n'
'   ~line 2344) are cleared here and restored from that SAME table by revertPeace()\n'
'   (patch593\'s RESET ENDING), so peace is fully reversible for testing without\n'
'   ever touching GARRISON\'s own data. sysOwner()/sysContested()/canAssault()/\n'
'   sysOpen() all read s.owner (or its S.occ/S.lost/S.taken overlays) directly, so\n'
'   clearing it here is the one change every one of them - and the Map/Empire UI\n'
'   built on them - needs to agree a former GARRISON system is now open ground.\n'
'   drawTerritory() also reads s.owner directly (SYS.filter(s=>s.owner===rv.id)),\n'
'   so rival territory drawing stops here too, for free - no separate check needed\n'
'   there. Applied both at the win (finaleWon()) and on every boot at S.end===2\n'
'   (adopt(), above) - the GARRISON loop reruns at every fresh page parse\n'
'   regardless of S.end, so a real reload needs this to run again once the save\n'
'   (and S.end) is actually known. Deliberately leaves S.taken alone (a beaten\n'
'   GARRISON system already reads as an ordinary claim via sysOwner()\'s own taken\n'
'   check, peace or not) and does not attempt to resurrect S.lost\'s rival-expansion\n'
'   history on revertPeace() - only GARRISON ownership is asked to be reversible,\n'
'   per the plan\'s own wording. */\n'
'function applyPeace(){\n'
'  for(const s of SYS){ if(GARRISON[s.id]){ delete s.owner; delete s.def; delete s.arch } }\n'
'  S.lost={};\n'
'  S.occ={}; S.occAt={};\n'
'  S.thq=[];\n'
'  lfClear();\n'
'}\n'
'function revertPeace(){\n'
'  for(const s of SYS){ const g=GARRISON[s.id]; if(g){ s.owner=g.o; s.def=g.def; s.arch=g.arch } }\n'
'}\n'
'/* ---------------- the ending (patch592) ----------------\n'
'   Its own overlay (#endScene) rather than reusing #scene/playScene() outright -\n'
'   every stage here is a different SHAPE of content (a title, a stat block, a\n'
'   glowing text strip, dim narration, a CONTINUE button), not one more line of\n'
'   dialogue - but it reuses the exact overlay/fade CSS (.scene) and the game\'s\n'
'   own stat-row look (.wipebox/.wr, restartDialog()\'s pattern, ~line 10034)\n'
'   rather than inventing new visual language. Tap anywhere advances; SKIP\n'
'   (top-right, same placement/behaviour as the intro/turn scene) jumps straight\n'
'   to the final CONTINUE stage - "SKIP jumps to CONTINUE", per the plan. Freely\n'
'   re-openable (the pjx COMPLETE card below, or patch593\'s SHOW ENDING dev\n'
'   button) since it only ever READS S - nothing here is a one-shot effect, so\n'
'   reopening it can never replay or re-grant anything. */\n'
'const END_STAGES=6, END_STRIP_BEAT_MS=1800;   /* TUNING-PENDING - the glow strip\'s own pause */\n'
'let endOn=false, endStage=0, endTimer=null;\n'
'/* time played: S.t0 is a real start timestamp on every save written after this\n'
'   patch (fresh()) and null on an old one adopt() could not vouch for (see the\n'
'   adopt() sanitizer above) - shown as an em-dash rather than guessing. Systems\n'
'   held mirrors devInfo()\'s own "X/Y" expression (SYS.length-1 - every non-home\n'
'   system) so the two can never quietly disagree. Records: the same\n'
'   Object.keys(S.ac).length restartDialog() already shows - a bare count, per\n'
'   the plan\'s own wording (not "X of Y", unlike systems held). */\n'
'function endStats(){\n'
'  return {\n'
'    time: S.t0 ? fmtT((Date.now()-S.t0)/1000) : "\\u2014",\n'
'    lvl: level(),\n'
'    held: heldSystems().length, total: SYS.length-1,\n'
'    all: fmt(S.all),\n'
'    wins: S.wins||0,\n'
'    records: Object.keys(S.ac||{}).length\n'
'  };\n'
'}\n'
'function endStageHTML(n){\n'
'  if(n===0)return `<div class="endtitle">${STORY.endTitle}</div>`;\n'
'  if(n===1){\n'
'    const st=endStats();\n'
'    return `<div class="wipebox endstats">\n'
'      <div class="wr"><span>Time played</span><b>${st.time}</b></div>\n'
'      <div class="wr"><span>Level</span><b>${st.lvl}</b></div>\n'
'      <div class="wr"><span>Systems held</span><b>${st.held}/${st.total}</b></div>\n'
'      <div class="wr"><span>All-time ore</span><b>${st.all} ${RI(\'ore\')}</b></div>\n'
'      <div class="wr"><span>Raid wins</span><b>${st.wins}</b></div>\n'
'      <div class="wr"><span>Records</span><b>${st.records}</b></div>\n'
'    </div>`;\n'
'  }\n'
'  if(n===2)return `<div class="endstrip">${STORY.endStrip}</div>`;\n'
'  if(n===3)return `<div class="endlast">${STORY.endLast}</div>`;\n'
'  if(n===4)return `<div class="endtbc">${STORY.endTbc}</div>`;\n'
'  return "";\n'
'}\n'
'/* the strip (stage 2) also auto-advances after a short beat, per the plan\n'
'   ("with a slow glow ... after a beat STORY.endLast") - a tap still works too\n'
'   (endAdvance() always clears the pending timer first), so nobody is stuck\n'
'   waiting on mobile if they\'d rather just tap through. */\n'
'function endRender(){\n'
'  const body=$("#endBody"); if(body)body.innerHTML=endStageHTML(endStage);\n'
'  const last=endStage>=END_STAGES-1;\n'
'  const hint=$("#endHint"); if(hint)hint.hidden=last;\n'
'  const skip=$("#endSkip"); if(skip)skip.hidden=last;\n'
'  const btn=$("#endContinue"); if(btn)btn.hidden=!last;\n'
'  if(endTimer){ clearTimeout(endTimer); endTimer=null }\n'
'  if(endStage===2)endTimer=setTimeout(endAdvance,END_STRIP_BEAT_MS);\n'
'}\n'
'function endAdvance(){\n'
'  if(!endOn)return;\n'
'  if(endTimer){ clearTimeout(endTimer); endTimer=null }\n'
'  if(endStage>=END_STAGES-1)return;\n'
'  endStage++; endRender();\n'
'}\n'
'function endSkip(){ if(!endOn)return; endStage=END_STAGES-1; endRender(); }\n'
'function endClose(){\n'
'  if(!endOn)return;\n'
'  endOn=false;\n'
'  if(endTimer){ clearTimeout(endTimer); endTimer=null }\n'
'  const el=$("#endScene"); if(!el)return;\n'
'  el.classList.add("closing"); el.onclick=null; el.style.pointerEvents="none";\n'
'  let done=false;\n'
'  const finish=()=>{ if(done)return; done=true;\n'
'    el.classList.remove("on","closing"); el.innerHTML=""; el.style.pointerEvents="" };\n'
'  el.addEventListener("transitionend",finish,{once:true});\n'
'  setTimeout(finish,400);\n'
'}\n'
'function showEnding(){\n'
'  const el=$("#endScene"); if(!el)return;\n'
'  endOn=true; endStage=0;\n'
'  el.innerHTML=\'<button id="endSkip" class="sceneskip">SKIP</button>\'+\n'
'    \'<div class="scenewrap"><div id="endBody" class="endbody"></div>\'+\n'
'    \'<div id="endHint" class="scenehint">TAP TO CONTINUE</div>\'+\n'
'    \'<button id="endContinue" class="endcontinue" hidden>CONTINUE</button></div>\';\n'
'  el.classList.remove("closing"); el.classList.add("on");\n'
'  $("#endSkip").onclick=e=>{ e.stopPropagation(); endSkip(); };\n'
'  $("#endContinue").onclick=e=>{ e.stopPropagation(); endClose(); };\n'
'  el.onclick=()=>endAdvance();\n'
'  endRender();\n'
'}\n'
'/* patch590/592: the win branch of endFinalBattle()\'s own result card calls this\n'
'   (via #bFinaleDone) - now the real thing: peace, then the ending screen. */\n'
'function finaleWon(){\n'
'  S.end=2;\n'
'  applyPeace();\n'
'  dirty=true; save();\n'
'  showEnding();\n'
'}\n'
)
assert new_stub!=old_stub
h=h.replace(old_stub,new_stub,1)

# ================= 5. renderNex(): pjx COMPLETE card =================
old_proj=(
'  const proj=NEXUS.filter(r=>r.cur==="en");\n'
'  if(proj.length && ((S.en||0)>0 || enRate()>0)){\n'
'    const head=document.createElement("div");\n'
'    head.className="sechead pjhead"; head.textContent="THE PROJECT";\n'
'    host.appendChild(head);\n'
'    proj.forEach(r=>{\n'
'      const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l), locked=nexLocked(r);\n'
)
assert h.count(old_proj)==1
new_proj=(
'  const proj=NEXUS.filter(r=>r.cur==="en");\n'
'  if(proj.length && ((S.en||0)>0 || enRate()>0)){\n'
'    const head=document.createElement("div");\n'
'    head.className="sechead pjhead"; head.textContent="THE PROJECT";\n'
'    host.appendChild(head);\n'
'    proj.forEach(r=>{\n'
'      /* patch592: the game is won - pjx stops reading as just another MAXED card\n'
'         and offers its way back into the ending screen instead. */\n'
'      if(r.id==="pjx" && S.end===2){\n'
'        const l=lv(S.nx,r.id);\n'
'        const d=document.createElement("div"); d.className="card done";\n'
'        d.innerHTML=`<h5>${r.n} <span class="lv">Lv ${l}/${r.max}</span></h5>\n'
'          <p>${STORY.nodeHint}</p><div class="eff">COMPLETE</div>\n'
'          <button>COMPLETE \\u00b7 VIEW ENDING</button>`;\n'
'        d.querySelector("button").onclick=()=>showEnding();\n'
'        host.appendChild(d);\n'
'        return;\n'
'      }\n'
'      const l=lv(S.nx,r.id), max=l>=r.max, c=nexCost(r,l), locked=nexLocked(r);\n'
)
assert new_proj!=old_proj
h=h.replace(old_proj,new_proj,1)

# ================= 6. HTML: wrap the "Rival pressure" section so it can hide as a whole =================
old_html=(
'          <div class="grid" id="tgts"></div>\n'
'          <div class="sechead">Rival pressure <span class="shsub">they answer what you do</span></div>\n'
'          <div id="rvBars"></div>\n'
'        </div>\n'
)
assert h.count(old_html)==1
new_html=(
'          <div class="grid" id="tgts"></div>\n'
'          <div id="rvPressureWrap">\n'
'            <div class="sechead">Rival pressure <span class="shsub">they answer what you do</span></div>\n'
'            <div id="rvBars"></div>\n'
'          </div>\n'
'        </div>\n'
)
assert new_html!=old_html
h=h.replace(old_html,new_html,1)

# ================= 7. renderRivalBars(): hide the whole section once the turn has come =================
old_rvb=(
'function renderRivalBars(){\n'
'  const host=$("#rvBars"); if(!host)return;\n'
'  if(!rvAwake()){ host.innerHTML=""; return }\n'
)
assert h.count(old_rvb)==1
new_rvb=(
'function renderRivalBars(){\n'
'  const host=$("#rvBars"); if(!host)return;\n'
'  /* patch592: hides at S.end>=1, not only once peace is final at S.end===2 - per\n'
'     the plan\'s own wording for this patch. Rivals already go quiet at S.end===1\n'
'     (patch589), so a pressure gauge stuck at whatever it read the instant the\n'
'     turn came has nothing true left to show even before the game is fully won. */\n'
'  const wrap=$("#rvPressureWrap");\n'
'  if(S.end>=1){ if(wrap)wrap.hidden=true; host.innerHTML=""; return }\n'
'  if(wrap)wrap.hidden=false;\n'
'  if(!rvAwake()){ host.innerHTML=""; return }\n'
)
assert new_rvb!=old_rvb
h=h.replace(old_rvb,new_rvb,1)

# ================= 8. HTML: the ending overlay's own element =================
old_scene='<div id="scene" class="scene"></div>\n'
assert h.count(old_scene)==1
new_scene='<div id="scene" class="scene"></div>\n<div id="endScene" class="scene"></div>\n'
assert new_scene!=old_scene
h=h.replace(old_scene,new_scene,1)

# ================= 9. CSS: the ending screen's own bits (everything else reuses .scene/.scenewrap/.scenehint/.sceneskip/.wipebox/.wr as-is) =================
old_css='.sceneend button.warn{border-color:rgba(255,107,138,.5);background:rgba(255,107,138,.10)}\n'
assert h.count(old_css)==1
new_css=(
'.sceneend button.warn{border-color:rgba(255,107,138,.5);background:rgba(255,107,138,.10)}\n'
'/* ---------- the ending screen (patch592) - reuses .scene/.scenewrap/.scenehint/\n'
'   .sceneskip/.wipebox/.wr as-is; only the per-stage content below is new ---------- */\n'
'.endbody{width:100%;min-height:64px;display:flex;flex-direction:column;\n'
'  align-items:center;justify-content:center;text-align:center}\n'
'.endtitle{font:800 22px/1.35 system-ui;color:var(--txt)}\n'
'.endstrip{font:800 13px/1 ui-monospace,monospace;letter-spacing:.32em;color:var(--cy);\n'
'  animation:endglow 2.6s ease-in-out infinite}\n'
'@keyframes endglow{0%,100%{opacity:.5;text-shadow:0 0 6px rgba(72,226,255,.3)}\n'
'  50%{opacity:1;text-shadow:0 0 22px rgba(72,226,255,.85)}}\n'
'.endlast{font:600 14px/1.6 system-ui;color:var(--dim)}\n'
'.endtbc{font:800 12px/1 ui-monospace,monospace;letter-spacing:.22em;color:var(--mut)}\n'
'.endcontinue{width:100%;border:1px solid var(--line2);background:rgba(72,226,255,.10);\n'
'  color:var(--txt);border-radius:10px;padding:12px;font:700 11px/1 system-ui;\n'
'  letter-spacing:.08em;cursor:pointer}\n'
)
assert new_css!=old_css
h=h.replace(old_css,new_css,1)

# ================= 10. __SD export =================
old_exp='  RIVAL_MSG,queueRivalNotice,rivalMsgWho,get noticeShownKey(){return noticeShownKey},\n'
assert h.count(old_exp)==1
new_exp=(
'  RIVAL_MSG,queueRivalNotice,rivalMsgWho,get noticeShownKey(){return noticeShownKey},\n'
'  applyPeace,revertPeace,showEnding,endStats,endStageHTML,endAdvance,endSkip,endClose,\n'
'  get endOn(){return endOn}, get endStage(){return endStage}, END_STAGES,\n'
)
assert new_exp!=old_exp
h=h.replace(old_exp,new_exp,1)

# ================= BUILD =================
old_build="const BUILD=591;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=592;",1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch592 applied")
