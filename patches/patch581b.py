import io

"""patch581b - follow-up to patch578-581 (PLAN-ending.md Batch A story review).
BUILD stays 581 (this batch's review fixes, not a new numbered patch - 582 is
reserved for Batch B). Three review findings, all in the story-layer code the
578-581 patches added:

1. Ghost intro text after the scene ends. `sceneClose()` already removed the
   "on" class and cleared innerHTML, but only from a single `setTimeout(...,360)`
   with nothing guaranteeing it actually ran, and nothing stopping the element
   from still intercepting/being visible during the ~350ms CSS fade. Hardened:
   `pointer-events:none` is set the instant closing starts (never intercepts a
   tap mid-fade), and the actual removal (class + innerHTML clear) now fires on
   BOTH `transitionend` and a 400ms fallback timer (whichever comes first, via a
   `done` guard so it only runs once) - removes the single point of failure a
   bare timeout was. A loaded save never creates the scene at all (playScene()
   is only ever called from the `!had` boot branch), so nothing changes there.

2. Rival notice avatar had no gap before the text. VEGA's avatar gets its
   44x44 + margin-right:10px sizing from the `.vegaav` class (already on the
   VEGA_SVG element); the rival avatar div only carried `.rivav` (same 44x44
   circle look, no margin). Fix: the rival avatar div now carries BOTH classes
   (`class="vegaav rivav"`) - reuses VEGA's own sizing/spacing rule instead of
   adding new CSS, exactly matching the VEGA layout. Measured before/after:
   avatar box 44px -> 54px (44 + the reused 10px margin), text start position
   shifts the same 10px - matches VEGA's box exactly.

3. Rival initial included "The ". `RIVALS` has "The Covenant" and "Helion
   Reach" - `r.n[0]` gave "T" for the Covenant instead of "C". New shared
   `rivalInitial(r)` strips a leading "The " before taking the first letter,
   used by both `sceneAvatarHTML()` (scene component) and `renderNotice()`
   (notice card) so the two can never drift apart on this again."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- 1. sceneClose(): deterministic removal, pointer-events off immediately ----
old_close=(
'function sceneClose(){\n'
'  sceneOn=false;\n'
'  const el=$("#scene"); if(!el)return;\n'
'  el.classList.add("closing"); el.onclick=null;\n'
'  setTimeout(()=>{ el.classList.remove("on","closing"); el.innerHTML=""; },360);\n'
'  sceneLines=null; sceneOpts=null;\n'
'}\n'
)
assert h.count(old_close)==1
new_close=(
'function sceneClose(){\n'
'  sceneOn=false;\n'
'  const el=$("#scene"); if(!el)return;\n'
'  el.classList.add("closing"); el.onclick=null;\n'
'  el.style.pointerEvents="none";   /* never intercept a tap mid-fade, even before removal */\n'
'  let done=false;\n'
'  const finish=()=>{\n'
'    if(done)return; done=true;\n'
'    el.classList.remove("on","closing"); el.innerHTML=""; el.style.pointerEvents="";\n'
'  };\n'
'  /* whichever fires first - the real fade finishing, or the fallback in case\n'
'     transitionend never does (e.g. reduced-motion, a tab that was backgrounded\n'
'     mid-fade) - either way the overlay is fully gone well under 1s, never just\n'
'     opacity:0 left sitting in the DOM. */\n'
'  el.addEventListener("transitionend",finish,{once:true});\n'
'  setTimeout(finish,400);\n'
'  sceneLines=null; sceneOpts=null;\n'
'}\n'
)
h=h.replace(old_close,new_close,1)

# ---- 2 & 3. rivalInitial() shared helper, used by sceneAvatarHTML() ----
old_avatar=(
'function sceneAvatarHTML(who){\n'
'  if(who==="vega")return VEGA_SVG;\n'
'  const r=RIVALMAP[who];\n'
'  return r?`<div class="rivav" style="--a:${r.col}">${r.n[0]}</div>`:"";\n'
'}\n'
)
assert h.count(old_avatar)==1
new_avatar=(
'/* the rival\'s displayed initial, skipping a leading "The " ("The Covenant" ->\n'
'   "C", not "T") - shared by the scene component and renderNotice() so they\n'
'   cannot drift apart on this again. */\n'
'function rivalInitial(r){ return (r.n.replace(/^The\\s+/,"")||r.n)[0]; }\n'
'function sceneAvatarHTML(who){\n'
'  if(who==="vega")return VEGA_SVG;\n'
'  const r=RIVALMAP[who];\n'
'  return r?`<div class="rivav" style="--a:${r.col}">${rivalInitial(r)}</div>`:"";\n'
'}\n'
)
h=h.replace(old_avatar,new_avatar,1)

# ---- 2 & 3. renderNotice(): reuse .vegaav sizing, use rivalInitial() ----
old_notice_av=(
'      const r=RIVALMAP[S.rvMsg&&S.rvMsg[key.slice(6)]];\n'
'      if(r){ whoText=r.n+" \\u00b7 INTERCEPTED"; avHTML=`<div class="rivav" style="--a:${r.col}">${r.n[0]}</div>`; }\n'
)
assert h.count(old_notice_av)==1
new_notice_av=(
'      const r=RIVALMAP[S.rvMsg&&S.rvMsg[key.slice(6)]];\n'
'      /* .vegaav supplies VEGA\'s own 44x44 + margin-right:10px box - reused here\n'
'         (not new CSS) so the rival card lines up with the VEGA one exactly. */\n'
'      if(r){ whoText=r.n+" \\u00b7 INTERCEPTED"; avHTML=`<div class="vegaav rivav" style="--a:${r.col}">${rivalInitial(r)}</div>`; }\n'
)
h=h.replace(old_notice_av,new_notice_av,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch581b applied (BUILD stays 581)")
