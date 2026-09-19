import io

"""patch580 - PLAN-ending.md Batch A, item 3: drift beats + rival speaker.

Three pieces, all "text lives in one place" (next to VEGA, ~line 4443):

1. VEGA gains six new beats: drift25/35/45/55/65 (level-triggered, lines meant to
   read subtly odder and more Nexus-keen as they go) and `project`, which fires
   the first time Exotic Nodes are banked. Exotic Nodes (`S.en`) do not exist
   until Batch B - the trigger is written now as `(S.en||0)>0` so it is simply
   always false today (S.en is always undefined) rather than guessed at or
   stubbed differently; Batch B needs no changes here to make it live.

2. A new `RIVAL_MSG` block, same shape as VEGA (id -> {t, go}) but for beats a
   RIVAL sends instead of VEGA: rv40/50/60 (level-triggered) and rvSab (first
   sabotage threat - Batch C wires its trigger; the placeholder line ships now
   per the plan). Which rival "speaks" a given rv40/50/60 beat is rolled once,
   from the two live rivals (RVACT), the first time that beat queues, and saved
   in the new `S.rvMsg` map (beat -> rival id) so a reload before the card is
   dismissed still shows the same rival - queueRivalNotice()/rivalMsgWho() do the
   rolling+queuing, mirroring queueNotice()'s own idempotency.

3. renderNotice() becomes speaker-aware instead of hardcoding the VEGA avatar:
   a queued key of the form "rival:<beat>" resolves S.rvMsg[<beat>] to a RIVALMAP
   entry and shows a small coloured initial circle + "<Name> · INTERCEPTED",
   reusing the `.rivav` class patch579 already added for the scene component's
   rival lines. A VEGA beat renders exactly as before ("VEGA · SHIP
   INTELLIGENCE"). Added a `noticeShownKey` guard so the avatar/header HTML is
   only rebuilt when the front-of-queue key actually changes, not every render()
   tick - same reasoning the old `if(n.who&&!av.innerHTML)` cache had, extended
   to cover switching between different speakers instead of only "unset vs set
   once".

`S.rvMsg` is added to fresh() (default `{}`) and sanitised in adopt() (drop any
entry naming a rival not in RVACT - covers both an unrecognised id and a stale
save from before RVACT could ever have been different). Back-filled in adopt()
for drift25/35/45/55/65 and rv40/50/60 exactly like ring2/3/4 already are, off
the save's own level() - rvSab is NOT back-filled here (Batch C, whose trigger
is not level-based, owns that)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- 1. VEGA: six new beats, appended just before the closing brace ----
old_vega_tail=(
' ring4:     {t:"Nothing past here is for sale. Whatever we take, we take.", go:"p-map"}\n'
'};\n'
'/* the avatar markup itself, inserted directly by renderNotice() rather than via\n'
)
assert h.count(old_vega_tail)==1
new_vega_tail=(
' ring4:     {t:"Nothing past here is for sale. Whatever we take, we take.", go:"p-map"},\n'
' /* drift beats (patch580): level-triggered, meant to read subtly odder and more\n'
'    Nexus-keen as the numbers climb - VEGA noticing its own interest before the\n'
'    player has any reason to be suspicious of it. */\n'
' drift25:   {t:"The Nexus numbers keep coming back cleaner than they should. Convenient.", go:"p-nex"},          /* PLACEHOLDER */\n'
' drift35:   {t:"I have re-run the Entanglement math three times today. I do not know why.", go:"p-nex"},         /* PLACEHOLDER */\n'
' drift45:   {t:"There is a shape in the ring-4 surveys I cannot name yet. I would like to keep looking.", go:"p-map"}, /* PLACEHOLDER */\n'
' drift55:   {t:"Every system out there pulls at the same thread. I do not think that is a coincidence.", go:null}, /* PLACEHOLDER */\n'
' drift65:   {t:"I need you to hold Nyx. I cannot explain why yet. I will.", go:"p-map"},                          /* PLACEHOLDER */\n'
' /* fires the first time Exotic Nodes are banked - inert until Batch B adds S.en */\n'
' project:   {t:"Exotic Nodes. I do not have a better name for them yet. Bank everything you find.", go:"p-nex"}   /* PLACEHOLDER */\n'
'};\n'
'/* the avatar markup itself, inserted directly by renderNotice() rather than via\n'
)
h=h.replace(old_vega_tail,new_vega_tail,1)

# ---- 2a. RIVAL_MSG block, right after VEGA (before the avatar SVG) ----
anchor_rivalmsg='/* the avatar markup itself, inserted directly by renderNotice() rather than via\n'
assert h.count(anchor_rivalmsg)==1
rivalmsg_block='''/* ---------------- RIVAL_MSG · intercepted transmissions ----------------
   Same rule as VEGA: PLACEHOLDER TEXT, the owner edits it here and nowhere else.
   Unlike VEGA these are not spoken by a fixed voice - which of the two live
   rivals (RVACT) "sends" a given beat is rolled once and saved (S.rvMsg, see
   queueRivalNotice() below) so the card reads consistently across a reload.
   rv40/50/60 are level-triggered (checkUnlocks()); rvSab is Batch C's first
   sabotage-threat line - the text ships now, its trigger does not exist yet. */
const RIVAL_MSG={
 rv40: {t:"You don't know what you're feeding.", go:null},               /* PLACEHOLDER */
 rv50: {t:"Ask it what the last node is.", go:null},                     /* PLACEHOLDER */
 rv60: {t:"Whatever you're building at Nyx, stop while you still can.", go:null}, /* PLACEHOLDER */
 rvSab:{t:"They're not moving on a system this time. They're moving on you.", go:null} /* PLACEHOLDER */
};
/* the avatar markup itself, inserted directly by renderNotice() rather than via
'''
h=h.replace(anchor_rivalmsg,rivalmsg_block,1)

# ---- 2b. NOTICES entries + queueRivalNotice()/rivalMsgWho(), right after the
#      existing VEGA NOTICES loop, before queueNotice() ----
anchor_loop=(
'NOTICES["vega:exoBanked"].go=()=>{ gotoTab("p-res"); resMode="prog"; syncResMode(); dirty=true; render(); };\n'
'function queueNotice(key){\n'
)
assert h.count(anchor_loop)==1
new_loop=(
'NOTICES["vega:exoBanked"].go=()=>{ gotoTab("p-res"); resMode="prog"; syncResMode(); dirty=true; render(); };\n'
'/* one NOTICES entry per RIVAL_MSG beat, keyed "rival:<beat>" - no static `who`\n'
'   (renderNotice() resolves the speaker from S.rvMsg at render time, since it is\n'
'   rolled per-save, not fixed like VEGA\'s). */\n'
'for(const k in RIVAL_MSG) NOTICES["rival:"+k]={t:RIVAL_MSG[k].t, go: RIVAL_MSG[k].go ? ()=>gotoTab(RIVAL_MSG[k].go) : null};\n'
'function queueNotice(key){\n'
)
h=h.replace(anchor_loop,new_loop,1)

# queueRivalNotice/rivalMsgWho: right after queueNotice()'s own closing brace
anchor_qn=(
'  if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];\n'
'  S.notifyQueue.push(key);\n'
'}\n'
'/* checked once per tick,'
)
assert h.count(anchor_qn)==1
new_qn=(
'  if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];\n'
'  S.notifyQueue.push(key);\n'
'}\n'
'/* rolls (once - stable across a reload) which of the two live rivals "sends" a\n'
'   given RIVAL_MSG beat, then queues it under the "rival:" namespace via the same\n'
'   idempotent queueNotice() every other beat uses. */\n'
'function rivalMsgWho(key){\n'
'  if(!S.rvMsg||typeof S.rvMsg!=="object")S.rvMsg={};\n'
'  if(!S.rvMsg[key] || RVACT.indexOf(S.rvMsg[key])<0){\n'
'    /* NOT Math.random(): csim4.js\'s pacing sim monkey-patches Math.random with a\n'
'       seeded PRNG for reproducibility, and every call anywhere in tick()\'s call\n'
'       graph draws from that same single stream - one extra draw here would shift\n'
'       every later roll (mission rewards, combat, crew) downstream of it, breaking\n'
'       the required byte-identical pacing output for a purely cosmetic choice (see\n'
'       HANDOVER). Hashed off the beat name and the save\'s own cseed instead - still\n'
'       varies save to save without touching shared entropy. */\n'
'    let hh=0; for(let i=0;i<key.length;i++)hh=((hh<<5)-hh+key.charCodeAt(i))|0;\n'
'    hh=(hh^(S.cseed||1))>>>0;\n'
'    S.rvMsg[key]=RVACT[hh%RVACT.length];\n'
'  }\n'
'  return S.rvMsg[key];\n'
'}\n'
'function queueRivalNotice(key){ rivalMsgWho(key); queueNotice("rival:"+key); }\n'
'/* checked once per tick,'
)
h=h.replace(anchor_qn,new_qn,1)

# ---- 3. checkUnlocks(): new level triggers, interleaved by level for readability ----
old_checks=(
'  if(unlockedAt("p-nex"))queueNotice("vega:nexus");\n'
'  if(level()>=23)queueNotice("vega:ring2");\n'
'  if(level()>=31)queueNotice("vega:ring3");\n'
'  if(level()>=55)queueNotice("vega:ring4");\n'
)
assert h.count(old_checks)==1
new_checks=(
'  if(unlockedAt("p-nex"))queueNotice("vega:nexus");\n'
'  if(level()>=23)queueNotice("vega:ring2");\n'
'  if(level()>=25)queueNotice("vega:drift25");\n'
'  if(level()>=31)queueNotice("vega:ring3");\n'
'  if(level()>=35)queueNotice("vega:drift35");\n'
'  if(level()>=40)queueRivalNotice("rv40");\n'
'  if(level()>=45)queueNotice("vega:drift45");\n'
'  if(level()>=50)queueRivalNotice("rv50");\n'
'  if(level()>=55)queueNotice("vega:ring4");\n'
'  if(level()>=55)queueNotice("vega:drift55");\n'
'  if(level()>=60)queueRivalNotice("rv60");\n'
'  if(level()>=65)queueNotice("vega:drift65");\n'
'  if((S.en||0)>0)queueNotice("vega:project");   /* inert until Batch B adds S.en */\n'
)
h=h.replace(old_checks,new_checks,1)

# ---- 4. renderNotice(): speaker-aware ----
old_render=(
'function renderNotice(){\n'
'  const el=$("#notice"); if(!el)return;\n'
'  if(!Array.isArray(S.notifyQueue)||!S.notifyQueue.length){ el.classList.remove("on"); return; }\n'
'  const n=NOTICES[S.notifyQueue[0]];\n'
'  if(!n){ S.notifyQueue.shift(); renderNotice(); return; }  /* an unknown key can\'t be shown - drop it, don\'t get stuck */\n'
'  const who=$("#noticeWho");\n'
'  if(who){ who.hidden=!n.who; if(n.who)who.textContent=n.who+" \\u00b7 SHIP INTELLIGENCE"; }\n'
'  const av=$("#noticeAv");\n'
'  if(av){ av.hidden=!n.who; if(n.who&&!av.innerHTML)av.innerHTML=VEGA_SVG; }\n'
'  $("#noticeTxt").textContent=n.t;\n'
'  const go=$("#noticeGo"); if(go)go.hidden=!n.go;\n'
'  el.classList.add("on");\n'
'}\n'
)
assert h.count(old_render)==1
new_render=(
'let noticeShownKey=null;   /* only rebuild the header/avatar when the front key changes */\n'
'function renderNotice(){\n'
'  const el=$("#notice"); if(!el)return;\n'
'  if(!Array.isArray(S.notifyQueue)||!S.notifyQueue.length){ el.classList.remove("on"); noticeShownKey=null; return; }\n'
'  const key=S.notifyQueue[0];\n'
'  const n=NOTICES[key];\n'
'  if(!n){ S.notifyQueue.shift(); renderNotice(); return; }  /* an unknown key can\'t be shown - drop it, don\'t get stuck */\n'
'  if(key!==noticeShownKey){\n'
'    noticeShownKey=key;\n'
'    let whoText=null, avHTML=null;\n'
'    if(key.indexOf("rival:")===0){\n'
'      const r=RIVALMAP[S.rvMsg&&S.rvMsg[key.slice(6)]];\n'
'      if(r){ whoText=r.n+" \\u00b7 INTERCEPTED"; avHTML=`<div class="rivav" style="--a:${r.col}">${r.n[0]}</div>`; }\n'
'    } else if(n.who){\n'
'      whoText=n.who+" \\u00b7 SHIP INTELLIGENCE"; avHTML=VEGA_SVG;\n'
'    }\n'
'    const who=$("#noticeWho");\n'
'    if(who){ who.hidden=!whoText; if(whoText)who.textContent=whoText; }\n'
'    const av=$("#noticeAv");\n'
'    if(av){ av.hidden=!avHTML; if(avHTML)av.innerHTML=avHTML; }\n'
'  }\n'
'  $("#noticeTxt").textContent=n.t;\n'
'  const go=$("#noticeGo"); if(go)go.hidden=!n.go;\n'
'  el.classList.add("on");\n'
'}\n'
)
h=h.replace(old_render,new_render,1)

# ---- 5. fresh(): S.rvMsg default ----
old_fresh='exo:{}, xp:{}, taken:{}, lost:{}, occ:{}, occAt:{}, sd:{}, sdq:{}, rv:{}, exoSeen:{}, seen:{}, notifyQueue:[],\n'
assert h.count(old_fresh)==1
new_fresh='exo:{}, xp:{}, taken:{}, lost:{}, occ:{}, occAt:{}, sd:{}, sdq:{}, rv:{}, exoSeen:{}, seen:{}, notifyQueue:[], rvMsg:{},\n'
h=h.replace(old_fresh,new_fresh,1)

# ---- 6. adopt(): sanitise S.rvMsg, right by the other rv sanitising ----
old_adopt_rv=(
'  if(!f.rv||typeof f.rv!=="object")f.rv={};\n'
)
assert h.count(old_adopt_rv)==1
new_adopt_rv=(
'  if(!f.rvMsg||typeof f.rvMsg!=="object")f.rvMsg={};\n'
'  for(const k in f.rvMsg){ if(RVACT.indexOf(f.rvMsg[k])<0)delete f.rvMsg[k]; }\n'
'  if(!f.rv||typeof f.rv!=="object")f.rv={};\n'
)
h=h.replace(old_adopt_rv,new_adopt_rv,1)

# ---- 7. adopt(): back-fill, right after the existing ring2/3/4 back-fills ----
old_backfill=(
'  if(level()>=23)S.seen["vega:ring2"]=true;\n'
'  if(level()>=31)S.seen["vega:ring3"]=true;\n'
'  if(level()>=55)S.seen["vega:ring4"]=true;\n'
)
assert h.count(old_backfill)==1
new_backfill=(
'  if(level()>=23)S.seen["vega:ring2"]=true;\n'
'  if(level()>=25)S.seen["vega:drift25"]=true;\n'
'  if(level()>=31)S.seen["vega:ring3"]=true;\n'
'  if(level()>=35)S.seen["vega:drift35"]=true;\n'
'  if(level()>=40)S.seen["rival:rv40"]=true;\n'
'  if(level()>=45)S.seen["vega:drift45"]=true;\n'
'  if(level()>=50)S.seen["rival:rv50"]=true;\n'
'  if(level()>=55)S.seen["vega:ring4"]=true;\n'
'  if(level()>=55)S.seen["vega:drift55"]=true;\n'
'  if(level()>=60)S.seen["rival:rv60"]=true;\n'
'  if(level()>=65)S.seen["vega:drift65"]=true;\n'
'  if((S.en||0)>0)S.seen["vega:project"]=true;   /* inert until Batch B adds S.en */\n'
)
h=h.replace(old_backfill,new_backfill,1)

# ---- 8. __SD export: RIVAL_MSG + the rival-queue helpers, next to the VEGA row ----
anchor_export='  STORY,playScene,sceneAdvance,sceneFinish,sceneClose,get sceneOn(){return sceneOn},\n'
assert h.count(anchor_export)==1
new_export=(
'  STORY,playScene,sceneAdvance,sceneFinish,sceneClose,get sceneOn(){return sceneOn},\n'
'  RIVAL_MSG,queueRivalNotice,rivalMsgWho,get noticeShownKey(){return noticeShownKey},\n'
)
h=h.replace(anchor_export,new_export,1)

# BUILD bump
old_build="const BUILD=579;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=580;")

io.open(F,"w",encoding="utf-8").write(h)
print("patch580 applied")
