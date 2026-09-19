import io

"""patch581 - PLAN-ending.md Batch A, item 4: dev panel.

Two additions to the dev tools, both preview-only (neither touches S.seen in a
way that survives - "SHOW" already worked this way for VEGA beats):

1. The "show any beat" select (#devVegaSel) now also lists every RIVAL_MSG key,
   prefixed "rival:" per the plan, right after the VEGA ones. show() used to
   hardcode the "vega:" namespace onto whatever the select held; it now branches
   on that prefix - a rival:* pick calls queueRivalNotice() (rolls a fresh
   speaker every time, which is exactly what a preview tool should do) instead
   of queueNotice(), and unqueues/requeues at the front under the resolved full
   key ("rival:<beat>" vs "vega:<beat>") either way.

2. A REPLAY INTRO button (data-dev="introReplay") calls playScene(STORY.intro)
   directly. Deliberately does NOT touch S.seen.intro or queue vega:boot when it
   finishes - it is a preview of the sequence, not a real re-arm of the boot
   flow (there is nothing to re-arm: intro only ever plays once, on a save that
   never existed, and REPLAY ALL/SHOW already establish the "preview does not
   persist" precedent for VEGA)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- HTML: REPLAY INTRO button, in the main dev button row ----
old_dvg='    <button class="dvb" data-dev="atk">SEND A FLEET</button>\n  </div>\n'
assert h.count(old_dvg)==1
new_dvg='    <button class="dvb" data-dev="atk">SEND A FLEET</button>\n    <button class="dvb" data-dev="introReplay">REPLAY INTRO</button>\n  </div>\n'
h=h.replace(old_dvg,new_dvg,1)

# ---- JS: devAction() gains the introReplay branch ----
old_devaction=(
'  else if(k==="vega"){\n'
'    /* clears every vega:* S.seen key (and any of its beats still sitting in the queue)\n'
'       so the owner can re-trigger every beat on demand while editing VEGA\'s lines -\n'
'       does not touch lvClaim/xpHow or any other S.seen key. */\n'
'    if(S.seen&&typeof S.seen==="object"){\n'
'      for(const key in S.seen) if(key.indexOf("vega:")===0) delete S.seen[key];\n'
'    }\n'
'    if(Array.isArray(S.notifyQueue))S.notifyQueue=S.notifyQueue.filter(key=>key.indexOf("vega:")!==0);\n'
'    toast("DEV \\u2014 VEGA beats reset","y");\n'
'  }\n'
'  dirty=true; renderAll(); save(); devInfo();\n'
)
assert h.count(old_devaction)==1
new_devaction=(
'  else if(k==="vega"){\n'
'    /* clears every vega:* S.seen key (and any of its beats still sitting in the queue)\n'
'       so the owner can re-trigger every beat on demand while editing VEGA\'s lines -\n'
'       does not touch lvClaim/xpHow or any other S.seen key. */\n'
'    if(S.seen&&typeof S.seen==="object"){\n'
'      for(const key in S.seen) if(key.indexOf("vega:")===0) delete S.seen[key];\n'
'    }\n'
'    if(Array.isArray(S.notifyQueue))S.notifyQueue=S.notifyQueue.filter(key=>key.indexOf("vega:")!==0);\n'
'    toast("DEV \\u2014 VEGA beats reset","y");\n'
'  }\n'
'  else if(k==="introReplay"){\n'
'    /* preview only - does not set S.seen.intro or queue vega:boot when it ends,\n'
'       same "does not persist" rule SHOW/REPLAY ALL already use for VEGA beats */\n'
'    playScene(STORY.intro,{skip:true,onDone:()=>toast("DEV \\u2014 intro replay done","y")});\n'
'  }\n'
'  dirty=true; renderAll(); save(); devInfo();\n'
)
h=h.replace(old_devaction,new_devaction,1)

# ---- JS: the select also lists RIVAL_MSG beats, and show() branches on the
#      "rival:" prefix instead of always assuming "vega:" ----
old_sel=(
'  const sel=$("#devVegaSel"); if(!sel)return;\n'
'  for(const k in VEGA){ const o=document.createElement("option"); o.value=k; o.textContent=k; sel.appendChild(o); }\n'
'  function show(key){\n'
'    if(!key)return;\n'
'    const full="vega:"+key;\n'
'    if(!S.seen||typeof S.seen!=="object")S.seen={};\n'
'    delete S.seen[full];\n'
'    queueNotice(full);\n'
'    /* the picked card must appear NOW, not queue behind whatever else is already\n'
'       waiting (a level-1 save already has vega:boot queued the moment it loads) */\n'
'    if(Array.isArray(S.notifyQueue)){\n'
'      const i=S.notifyQueue.indexOf(full);\n'
'      if(i>0){ S.notifyQueue.splice(i,1); S.notifyQueue.unshift(full); }\n'
'    }\n'
'    dirty=true; render();\n'
'  }\n'
)
assert h.count(old_sel)==1
new_sel=(
'  const sel=$("#devVegaSel"); if(!sel)return;\n'
'  for(const k in VEGA){ const o=document.createElement("option"); o.value=k; o.textContent=k; sel.appendChild(o); }\n'
'  for(const k in RIVAL_MSG){ const o=document.createElement("option"); o.value="rival:"+k; o.textContent="rival:"+k; sel.appendChild(o); }\n'
'  function show(optVal){\n'
'    if(!optVal)return;\n'
'    const isRival=optVal.indexOf("rival:")===0;\n'
'    const full=isRival?optVal:"vega:"+optVal;\n'
'    if(!S.seen||typeof S.seen!=="object")S.seen={};\n'
'    delete S.seen[full];\n'
'    if(isRival)queueRivalNotice(optVal.slice(6)); else queueNotice(full);\n'
'    /* the picked card must appear NOW, not queue behind whatever else is already\n'
'       waiting (a level-1 save already has vega:boot queued the moment it loads) */\n'
'    if(Array.isArray(S.notifyQueue)){\n'
'      const i=S.notifyQueue.indexOf(full);\n'
'      if(i>0){ S.notifyQueue.splice(i,1); S.notifyQueue.unshift(full); }\n'
'    }\n'
'    dirty=true; render();\n'
'  }\n'
)
h=h.replace(old_sel,new_sel,1)

# BUILD bump
old_build="const BUILD=580;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=581;")

io.open(F,"w",encoding="utf-8").write(h)
print("patch581 applied")
