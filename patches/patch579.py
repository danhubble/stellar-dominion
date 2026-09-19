import io

"""patch579 - PLAN-ending.md Batch A, item 2: the intro sequence.

Owner decision 4: a short, skippable text sequence on a brand-new game only,
before `vega:boot`. Built as a generic full-screen "scene" component (per the
code map: reused for the turn scene in Batch D) rather than a one-off intro
widget - `playScene(lines, opts)` lives next to showModal/hideModal since it's
the same kind of thing (a full-page state toggle driven by one div's innerHTML),
while the actual lines live in a new `STORY` object next to VEGA, per the plan's
"text lives in one place" rule.

Pieces:
- CSS: `.scene` and friends - a fixed full-screen overlay, separate from `.mask`/
  `#modal` (that one is for in-flow dialogs the player summons; this one is a
  scripted sequence nothing else should be able to open underneath).
- HTML: one empty `<div id="scene" class="scene"></div>`, filled by playScene()
  exactly the way `#modal` is filled by showModal() - no static markup.
- JS: STORY.intro (5 placeholder lines - narration waking with no memory, VEGA's
  voice, the homeworld gone, the factions did it), playScene()/sceneAdvance()/
  sceneFinish()/sceneClose() (tap-anywhere or SKIP to advance; when opts has no
  `buttons`, the last line fades the scene and calls onDone once - which is all
  the intro needs; the `buttons` branch instead swaps in a button row and waits,
  unused until Batch D's turn scene reuses this same component).
- Boot: `if(!had)queueNotice("vega:boot")` becomes `if(!had) playScene(STORY.intro,
  {onDone:()=>queueNotice("vega:boot")})`, with `S.seen.intro=true` set up front
  (a fresh game has just "opened" it, same moment the old code queued vega:boot).
- adopt(): back-fills `S.seen.intro=true` unconditionally - adopt() only ever runs
  for a save that already exists (load() returns before calling it when there is
  none), so every loaded game has, by definition, already had its intro moment.

KNOWN TEST-SUITE INTERACTION (see HANDOVER for the full note): this overlay
captures taps for the whole viewport until dismissed, and a fresh Playwright
context has no localStorage - so it now shows on every test that does a plain
page load without first adopting a save. Files that click real UI elements after
a bare `page.goto()` need one extra line to dismiss it; see HANDOVER for exactly
which files and why - not part of this patch (this patch only touches the game
file), fixed alongside the batch's own full-suite run."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- CSS: the scene overlay, inserted right before #toasts ----
anchor_css='#toasts{position:fixed;left:50%;transform:translateX(-50%);z-index:30;\n'
assert h.count(anchor_css)==1
scene_css='''/* ---------- full-screen story scene (intro / turn - patch579) ---------- */
.scene{position:fixed;inset:0;z-index:52;display:none;flex-direction:column;
  align-items:center;justify-content:center;background:#03040c;
  padding:22px 18px;box-sizing:border-box;opacity:1;transition:opacity .35s ease}
.scene.on{display:flex}
.scene.closing{opacity:0}
.sceneskip{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px;
  border:1px solid var(--line2);background:rgba(255,255,255,.05);color:var(--mut);
  border-radius:8px;padding:7px 12px;font:700 10px/1 system-ui;letter-spacing:.14em;cursor:pointer}
.scenewrap{width:min(440px,100%);display:flex;flex-direction:column;align-items:center;gap:16px}
.scenecard{width:100%;display:flex;align-items:flex-start;gap:12px;min-height:90px}
.sceneav{flex:none;width:44px;height:44px}
.rivav{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font:700 18px/1 ui-monospace,monospace;color:#04050d;background:var(--a);flex:none}
.scenebody{flex:1;min-width:0}
.scenewho{font:700 9px/1 ui-monospace,monospace;letter-spacing:.18em;color:var(--dim);
  text-transform:uppercase;margin-bottom:6px}
.scenetxt{font:600 15px/1.5 system-ui;color:var(--txt)}
.scenehint{font:600 9.5px/1 ui-monospace,monospace;letter-spacing:.14em;color:var(--dim);
  text-transform:uppercase;opacity:.55}
.sceneend{display:flex;gap:10px;width:100%}
.sceneend button{flex:1;border:1px solid var(--line2);background:rgba(72,226,255,.10);color:var(--txt);
  border-radius:10px;padding:12px;font:700 11px/1 system-ui;letter-spacing:.08em;cursor:pointer}
.sceneend button.warn{border-color:rgba(255,107,138,.5);background:rgba(255,107,138,.10)}

'''+anchor_css
h=h.replace(anchor_css,scene_css,1)

# ---- HTML: the empty scene container, filled only by playScene() ----
anchor_html='<div id="defence">'
assert h.count(anchor_html)==1
h=h.replace(anchor_html,'<div id="scene" class="scene"></div>\n<div id="defence">',1)

# ---- JS: STORY block, next to VEGA (same file location the plan requires all
#      new player-facing text to live in) ----
anchor_story=(
'</svg>`;\n'
'/* ---------------- one-time unlock notices ----------------\n'
)
assert h.count(anchor_story)==1
story_block='''</svg>`;
/* ---------------- STORY · scripted sequences ----------------
   Same rule as VEGA above: PLACEHOLDER TEXT, the owner edits it here and nowhere
   else. `intro` plays once, tap-to-advance, on a brand-new game only (see boot,
   below) - lines with no `who` are plain narration; a `who` of "vega" or a
   RIVALS id gets the same avatar treatment renderNotice() gives a VEGA card.
   Later batches add `turn`/`nodeHint`/`endLast`/`endTbc` to this same object -
   not declared yet, since nothing reads them until then. */
const STORY={
  intro:[
    {who:null, t:"You wake in a drifting shuttle. No memory of the launch."},                /* PLACEHOLDER */
    {who:null, t:"A voice has been talking for a while before you notice it."},               /* PLACEHOLDER */
    {who:"vega", t:"You're awake. Good \\u2014 I was beginning to wonder."},                    /* PLACEHOLDER */
    {who:"vega", t:"Your homeworld is gone. I'm sorry \\u2014 there was no way to soften that."},/* PLACEHOLDER */
    {who:"vega", t:"The factions did this. Which one answers for it first is your call."}      /* PLACEHOLDER */
  ]
};
/* ---------------- one-time unlock notices ----------------
'''
h=h.replace(anchor_story,story_block,1)

# ---- JS: playScene() and friends, next to showModal/hideModal (same kind of
#      thing - a full-page overlay driven entirely by one div's innerHTML) ----
anchor_modal=(
'function showModal(html,after){ $("#modal").innerHTML=html; $("#mask").classList.add("on"); after&&after(); }\n'
'function hideModal(){ $("#mask").classList.remove("on"); nmLive=null; rmLive=null; }\n'
)
assert h.count(anchor_modal)==1
scene_js='''function showModal(html,after){ $("#modal").innerHTML=html; $("#mask").classList.add("on"); after&&after(); }
function hideModal(){ $("#mask").classList.remove("on"); nmLive=null; rmLive=null; }

/* ---------------- full-screen story scenes (patch579) ----------------
   Generic tap-to-advance overlay - the intro uses it now, the turn scene
   (Batch D) reuses the exact same component per the code map. `lines`: strings
   or {who,t} objects (who: "vega", a RIVALS id, or null/absent for plain
   unattributed narration - no avatar, no name line). `opts.skip` (default true)
   shows a SKIP button that jumps straight to the end. `opts.buttons`: an array
   of {t,cls,onClick} - when given, the scene stops on its last line and shows
   these instead of closing itself; when omitted (the intro's case) the scene
   fades itself out and calls opts.onDone exactly once, right after the fade
   starts. Unused for now beyond the intro; kept generic on purpose. */
let sceneOn=false, sceneLines=null, sceneI=0, sceneOpts=null;
function sceneAvatarHTML(who){
  if(who==="vega")return VEGA_SVG;
  const r=RIVALMAP[who];
  return r?`<div class="rivav" style="--a:${r.col}">${r.n[0]}</div>`:"";
}
function sceneWhoName(who){
  if(who==="vega")return VEGA_NAME;
  const r=RIVALMAP[who]; return r?r.n:"";
}
function playScene(lines,opts){
  opts=opts||{};
  sceneLines=(lines||[]).map(l=>typeof l==="string"?{who:null,t:l}:l);
  if(!sceneLines.length)return;
  sceneI=0; sceneOpts=opts; sceneOn=true;
  const el=$("#scene"); if(!el)return;
  el.innerHTML=(opts.skip===false?"":'<button id="sceneSkip" class="sceneskip">SKIP</button>')+
    '<div class="scenewrap"><div class="scenecard"><div id="sceneAv" class="sceneav" hidden></div>'+
    '<div class="scenebody"><div id="sceneWho" class="scenewho" hidden></div>'+
    '<div id="sceneTxt" class="scenetxt"></div></div></div>'+
    '<div id="sceneHint" class="scenehint">TAP TO CONTINUE</div>'+
    '<div id="sceneEnd" class="sceneend" hidden></div></div>';
  el.classList.remove("closing"); el.classList.add("on");
  const skipBtn=$("#sceneSkip");
  if(skipBtn)skipBtn.onclick=e=>{ e.stopPropagation(); sceneFinish(); };
  el.onclick=()=>sceneAdvance();
  sceneRender();
}
function sceneRender(){
  if(!sceneLines)return;
  const n=sceneLines[sceneI], av=$("#sceneAv"), who=$("#sceneWho"), has=!!n.who;
  if(av){ av.hidden=!has; if(has)av.innerHTML=sceneAvatarHTML(n.who); }
  if(who){ who.hidden=!has; if(has)who.textContent=sceneWhoName(n.who); }
  const tx=$("#sceneTxt"); if(tx)tx.textContent=n.t;
}
function sceneAdvance(){
  if(!sceneLines)return;
  sceneI++;
  if(sceneI>=sceneLines.length){ sceneFinish(); return; }
  sceneRender();
}
function sceneFinish(){
  if(!sceneOn)return;
  if(sceneOpts && Array.isArray(sceneOpts.buttons) && sceneOpts.buttons.length){
    const wrap=$("#sceneEnd"), hint=$("#sceneHint"), sk=$("#sceneSkip"), el=$("#scene");
    if(hint)hint.hidden=true; if(sk)sk.hidden=true; if(el)el.onclick=null;
    wrap.hidden=false;
    wrap.innerHTML=sceneOpts.buttons.map((b,i)=>`<button class="scenebtn ${b.cls||""}" data-i="${i}">${b.t}</button>`).join("");
    [...wrap.querySelectorAll("button")].forEach((btn,i)=>btn.onclick=e=>{
      e.stopPropagation(); const cb=sceneOpts.buttons[i].onClick; sceneClose(); cb&&cb();
    });
    return;
  }
  const done=sceneOpts&&sceneOpts.onDone;
  sceneClose();
  if(done)done();
}
function sceneClose(){
  sceneOn=false;
  const el=$("#scene"); if(!el)return;
  el.classList.add("closing"); el.onclick=null;
  setTimeout(()=>{ el.classList.remove("on","closing"); el.innerHTML=""; },360);
  sceneLines=null; sceneOpts=null;
}
'''
h=h.replace(anchor_modal,scene_js,1)

# ---- boot: intro plays first on a brand-new game only; vega:boot now queues
#      from the scene's onDone instead of firing immediately ----
anchor_boot='const had=load();\nif(!had)queueNotice("vega:boot");\n'
assert h.count(anchor_boot)==1
new_boot='''const had=load();
if(!had){
  S.seen.intro=true;
  playScene(STORY.intro,{skip:true,onDone:()=>queueNotice("vega:boot")});
}
'''
h=h.replace(anchor_boot,new_boot,1)

# ---- adopt(): every loaded save has already "opened" the game ----
anchor_backfill='if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];\n  if(unlockedAt("p-mis"))'
assert h.count(anchor_backfill)==1
new_backfill=(
'if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];\n'
'  S.seen.intro=true;   /* patch579: adopt() only ever runs for a save that already\n'
'     exists (load() returns before calling it when there is none) - so every\n'
'     loaded game has, by definition, already had its intro moment */\n'
'  if(unlockedAt("p-mis"))'
)
h=h.replace(anchor_backfill,new_backfill,1)

# ---- __SD export: expose the scene component for tests (patch581) ----
anchor_export='  VEGA,VEGA_NAME,NOTICES,queueNotice,checkUnlocks,dismissNotice,\n'
assert h.count(anchor_export)==1
new_export=(
'  VEGA,VEGA_NAME,NOTICES,queueNotice,checkUnlocks,dismissNotice,\n'
'  STORY,playScene,sceneAdvance,sceneFinish,sceneClose,get sceneOn(){return sceneOn},\n'
)
h=h.replace(anchor_export,new_export,1)

# BUILD bump
old_build="const BUILD=578;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=579;")

io.open(F,"w",encoding="utf-8").write(h)
print("patch579 applied")
