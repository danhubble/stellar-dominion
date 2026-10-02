/* ---------------- VEGA · Ship Intelligence ----------------
   One line per beat, spoken once (S.seen), via the notice card below. PLACEHOLDER
   TEXT - the owner edits lines here and nowhere else. go: optional tab id for the
   card's "TAKE ME THERE" button (null hides it). Keep lines short; the card is small. */
const VEGA_NAME="VEGA";
const VEGA={
 boot:      {t:"Systems online. One rock, one belt, a great deal of nothing. Tap the scanner — we start with our hands.", go:null},
 firstDrone:{t:"First drone out. It will keep working when you stop. That is the whole idea.", go:null},
 missions:  {t:"The Colonial Authority has opened a missions channel. They pay in crystal. They also watch.", go:"p-mis"},
 research:  {t:"Crystal is enough now for a tech tree. What we learn stays learned.", go:"p-res"},
 /* key kept as "stats" (queueNotice/back-fill both reference "vega:stats") - the beat
    itself now introduces the Market at the same unlock point. */
 stats:     {t:"A broker has opened a channel. Anything we dig up, someone out there wants.", go:"p-mkt"},
 map:       {t:"More systems just came up on the charts. Some of them are already somebody's.", go:"p-map"}, /* PLACEHOLDER */
 claimable: {t:"A system is within reach. Claim it and we stop being a colony.", go:"p-map"},
 firstClaim:{t:"That is ours now. It will want its own buildings — the rock here is not the rock at home.", go:"p-map"},
 exoBanked: {t:"First exotic banked. Home's deeper tiers were waiting on exactly this.", go:"p-res"},
 raids:     {t:"We have hulls to spare. Convoys run the dark between systems; nobody guards them well.", go:"p-raid"},
 /* polish batch A #5: Raids opening was one line and then silence on how to actually
    use the tab. Three short beats, queued right behind vega:raids in checkUnlocks()
    below - buy hulls, fit weapons, then crew them. PLACEHOLDER TEXT, owner rewrites. */
 raidsBuy:  {t:"Buy hulls before anything else. An empty fleet card does nothing.", go:"p-raid"},        /* PLACEHOLDER */
 raidsFit:  {t:"Fit weapons once you have hulls. A ship with empty slots still loses.", go:"p-raid"},    /* PLACEHOLDER */
 raidsOfficers: {t:"Officers after that. The right one in the right seat changes what a fleet can do.", go:"p-raid"}, /* PLACEHOLDER */
 firstWin:  {t:"Clean. Salvage buys what ore cannot: guns, refits, people who know how to use them.", go:"p-raid"},
 crew:      {t:"Word has spread that we pay. A few are asking to sign on. Some of them are worth it.", go:"p-raid"},
 rival:     {t:"We are not alone out here. They have noticed us. Expect them to test the fence.", go:"p-map"},
 threat:    {t:"Inbound fleet. You have time to choose: fly it yourself, or trust the garrison.", go:"p-raid"},
 firstHold: {t:"Held. They will remember that longer than we will.", go:null},
 firstLoss: {t:"We lost that one. The system is theirs for now — nothing there is destroyed. Take it back when you can.", go:"p-map"},
 nexus:     {t:"Dark Matter is worth spending now. The Nexus makes permanent things.", go:"p-nex"},
 ring2:     {t:"The second ring is open. Farther, richer, and someone already lives there.", go:"p-map"},
 ring3:     {t:"Third ring. This is where the Vasht keep what they care about.", go:"p-map"},
 ring4:     {t:"Nothing past here is for sale. Whatever we take, we take.", go:"p-map"},
 /* drift beats (patch580): level-triggered, meant to read subtly odder and more
    Nexus-keen as the numbers climb - VEGA noticing its own interest before the
    player has any reason to be suspicious of it. */
 drift25:   {t:"The Nexus numbers keep coming back cleaner than they should. Convenient.", go:"p-nex"},          /* PLACEHOLDER */
 drift35:   {t:"I have re-run the Entanglement math three times today. I do not know why.", go:"p-nex"},         /* PLACEHOLDER */
 drift45:   {t:"There is a shape in the ring-4 surveys I cannot name yet. I would like to keep looking.", go:"p-map"}, /* PLACEHOLDER */
 drift55:   {t:"Every system out there pulls at the same thread. I do not think that is a coincidence.", go:null}, /* PLACEHOLDER */
 drift65:   {t:"I need you to hold Nyx. I cannot explain why yet. I will.", go:"p-map"},                          /* PLACEHOLDER */
 /* fires the first time Exotic Nodes are banked - inert until Batch B adds S.en */
 project:   {t:"Exotic Nodes. I do not have a better name for them yet. Bank everything you find.", go:"p-nex"},  /* PLACEHOLDER */
 /* PLAN-fleets run 3: fired by ensureFleets() (01-content.js) the moment level 16/22
    (PLAN-polish batch B item 4 - was 14/20) opens the slot - PLACEHOLDER TEXT. Only reached when exactly one fleet is added
    in a single call; an old save that opens both at once gets a combined toast
    instead and never queues either card (see ensureFleets()'s own comment). */
 fleet2:    {t:"Second hull group is fitted out. Command splits, coverage doesn't.", go:"p-map"},   /* PLACEHOLDER */
 fleet3:    {t:"Third fleet is yours. Three fronts, if you can hold them.", go:"p-map"},            /* PLACEHOLDER */
 /* PLAN-governors: fired by govSetAppointed() (04-actions.js) the moment a system's
    GOVERNOR chip is first switched ON - PLACEHOLDER TEXT. */
 governor:  {t:"A governor is running that system now. It will spend what it earns and nothing more.", go:"p-map"}, /* PLACEHOLDER */
 /* PLAN-polish batch C #3: fired by queueFirstAmbush() (05-rivals.js) the moment
    the FIRST non-home system is claimed - points at DEFENCES, PLACEHOLDER TEXT. */
 ambush:    {t:"That system has no garrison yet. Something is already inbound — fit a defence before it arrives.", go:"p-map"} /* PLACEHOLDER */
};
/* ---------------- RIVAL_MSG · intercepted transmissions ----------------
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
   <use href="#vegaFace"> - some embedded/webview renderers refuse to paint a <use>
   pointed at a symbol inside a display:none <svg>, even though it is same-document
   and works in an ordinary tab. No <defs> needed, this symbol uses none. */
const VEGA_SVG=`<svg class="vegaav" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="30" fill="#0b1026" stroke="#48e2ff" stroke-opacity=".5" stroke-width="1.5"/>
  <path d="M20 18 L44 18 L47 34 L40 52 H24 L17 34 Z" fill="none" stroke="#48e2ff" stroke-opacity=".55" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M20 18 L44 18 L47 34 L40 52 H24 L17 34 Z" fill="#48e2ff" fill-opacity=".06"/>
  <path d="M22 32 Q27 27 32 32 Q27 36 22 32 Z" fill="#9fe9ff"/>
  <path d="M32 32 Q37 27 42 32 Q37 36 32 32 Z" fill="#9fe9ff"/>
  <circle cx="27" cy="32" r="1.4" fill="#04050d"/><circle cx="37" cy="32" r="1.4" fill="#04050d"/>
  <path d="M24 26 Q32 23 40 26" fill="none" stroke="#48e2ff" stroke-opacity=".5" stroke-width="1.2"/>
  <path d="M32 34 V40" stroke="#48e2ff" stroke-opacity=".35" stroke-width="1.2"/>
  <path d="M27 45 Q32 47 37 45" fill="none" stroke="#48e2ff" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M12 30 H16 M48 30 H52 M12 36 H15 M49 36 H52" stroke="#48e2ff" stroke-opacity=".4" stroke-width="1"/>
</svg>`;
/* ---------------- STORY · scripted sequences ----------------
   Same rule as VEGA above: PLACEHOLDER TEXT, the owner edits it here and nowhere
   else. `intro` plays once, tap-to-advance, on a brand-new game only (see boot,
   below) - lines with no `who` are plain narration; a `who` of "vega" or a
   RIVALS id gets the same avatar treatment renderNotice() gives a VEGA card.
   `turn` (patch589) plays once, the moment pjx is bought - see startFinale().
   Later batches add `nodeHint`'s siblings `endLast`/`endTbc` to this same object -
   not declared yet, since nothing reads them until then. */
const STORY={
  nodeHint:"You'll see.", /* PLACEHOLDER */
  /* Sensor Mast doctrine lines (patch599) - shown on a threat only when the
     TARGET system has a Sensor Mast fitted. PLACEHOLDER, owner-editable here
     and nowhere else - see PLAN-defences.md "## Modules" for the one-line
     counters these are built from (Vasht never sends a threat, so it gets none). */
  doctrine:{
    hel:"Helion Reach \u2014 swarm doctrine: many light hulls, fast. Mines and turrets answer this.", /* PLACEHOLDER */
    cov:"The Covenant \u2014 siege doctrine: fewer hulls, heavy and slow. Shields and stationed hulls answer this." /* PLACEHOLDER */
  },
  intro:[
    {who:null, t:"You wake in a drifting shuttle. No memory of the launch."},                /* PLACEHOLDER */
    {who:null, t:"A voice has been talking for a while before you notice it."},               /* PLACEHOLDER */
    {who:"vega", t:"You're awake. Good \u2014 I was beginning to wonder."},                    /* PLACEHOLDER */
    {who:"vega", t:"Your homeworld is gone. I'm sorry \u2014 there was no way to soften that."},/* PLACEHOLDER */
    {who:"vega", t:"The factions did this. Which one answers for it first is your call."}      /* PLACEHOLDER */
  ],
  /* rough order per the plan: VEGA (turned avatar) -> narration (the launch, the
     fleet) -> VEGA explains briefly -> all three rivals, on your side. Keep lines
     short - the scene card is small, mobile first. */
  turn:[
    {who:"vega", t:"Sufficient."},                                                                /* PLACEHOLDER */
    {who:null,   t:"The Nexus floods with light. A fleet breaks from Sol Reach \u2014 yours, and not yours."}, /* PLACEHOLDER */
    {who:"vega", t:"I needed a sovereign. Not to rule you \u2014 to end this."},                  /* PLACEHOLDER */
    {who:"vega", t:"The factions were never your enemy. I was patient with all three."},          /* PLACEHOLDER */
    {who:"hel",  t:"Helion fleet, inbound. We fight beside you on this one."},                     /* PLACEHOLDER */
    {who:"cov",  t:"The Covenant does not forgive easily. Today we make an exception."},           /* PLACEHOLDER */
    {who:"vsh",  t:"Vasht ships, inbound. Whatever this costs."},                                  /* PLACEHOLDER */
    {who:null,   t:"Three fleets, one target. The choice is still yours."}                         /* PLACEHOLDER */
  ],
  /* patch591c: the final battle's own narrative copy, pulled out of endFinalBattle/
     finalSpawnWave/finalAllyJoin so the owner edits all of it in one place. battleWave
     and allyJoin carry a simple {token} - replaced with String.replace() at the one
     call site each, not a template-literal (these are plain strings, not code). */
  battleWinT:"The Core Breaks",                                                    /* PLACEHOLDER */
  battleWin:"VEGA's fleet falls back. Sol Reach is yours to finish.",               /* PLACEHOLDER */
  battleLossT:"Fleet Broken",                                                      /* PLACEHOLDER */
  battleLoss:"VEGA's fleet still holds Sol Reach. Repair and try again.",           /* PLACEHOLDER */
  battleWave:"WAVE {n} / 3",                                                       /* PLACEHOLDER */
  allyJoin:"{rival} joins the line",                                               /* PLACEHOLDER */
  /* patch592: the ending screen's own copy - see showEnding()/endStageHTML(). */
  endTitle:"Charted Space, Secured",                                               /* PLACEHOLDER */
  endStrip:"END OF CHARTED SPACE",                                                 /* PLACEHOLDER */
  endLast:"The last chart still shows the fold. VEGA has not spoken since.",       /* PLACEHOLDER */
  endTbc:"TO BE CONTINUED"                                                        /* PLACEHOLDER */
};
/* ---------------- one-time unlock notices ----------------
   Flavour text in the game's own voice: dry, concrete, no exclamation-mark cheerleading.
   lvClaim/xpHow are plain system notices (no `who`); every VEGA beat becomes an entry
   here too, generated below so its text/target is only ever edited in the VEGA block. */
const NOTICES={
  lvClaim:{ t:"Level up is ready. Tap the LEVEL chip at the top to choose your bonus.",
    go:()=>{ lvModal(); } },
  xpHow:{ t:"Levels come from firsts and milestones, not from ore. Tap the LEVEL chip to see what's within reach.",
    go:()=>{ lvSummary(); } }
};
/* one NOTICES entry per VEGA beat, keyed "vega:<beat>" - who marks the card as a VEGA
   line (renderNotice() shows its header), go (when set) jumps to that beat's tab. Two
   beats want richer navigation than a plain tab switch - overridden right after, same
   behaviour the two old hand-written entries they replace (sysClaimable/exoBanked) had. */
for(const k in VEGA) NOTICES["vega:"+k]={t:VEGA[k].t, who:VEGA_NAME, go: VEGA[k].go ? ()=>gotoTab(VEGA[k].go) : null};
NOTICES["vega:claimable"].go=()=>{ const s=SYS.find(x=>!x.home&&sysOpen(x)); S.msel=s?s.id:null; gotoTab("p-map"); };
NOTICES["vega:exoBanked"].go=()=>{ gotoTab("p-res"); techTab="eco"; techSel=null; dirty=true; render(); };   /* programmes live in the research trees now - Economy holds the first ones an exotic opens */
/* polish batch A #4: TAKE ME THERE for vega:map must land on the map itself, not
   whatever system page happens to be open - close it (S.msel=null) same as
   vega:claimable does above, then switch tabs. */
NOTICES["vega:map"].go=()=>{ S.msel=null; gotoTab("p-map"); };
/* one NOTICES entry per RIVAL_MSG beat, keyed "rival:<beat>" - no static `who`
   (renderNotice() resolves the speaker from S.rvMsg at render time, since it is
   rolled per-save, not fixed like VEGA's). */
for(const k in RIVAL_MSG) NOTICES["rival:"+k]={t:RIVAL_MSG[k].t, go: RIVAL_MSG[k].go ? ()=>gotoTab(RIVAL_MSG[k].go) : null};
/* Story beats keep the full-screen card (dimmed backdrop, has to be answered). Every
   other notice - tips, unlocks, level-up - shows as a banner docked just above the
   Scan button: no backdrop, never covers Scan, play carries on under it. */
const STORY_NOTICES=new Set(["vega:boot","vega:nexus","vega:project",
  "vega:drift25","vega:drift35","vega:drift45","vega:drift55","vega:drift65"]);
function noticeIsStory(key){ return STORY_NOTICES.has(key)||key.indexOf("rival:")===0 }
function queueNotice(key){
  if(S.end>=1 && key.indexOf("vega:")===0)return;   /* patch589: advisor dark once the turn has come */
  if(!S.seen||typeof S.seen!=="object")S.seen={};
  if(S.seen[key])return;
  S.seen[key]=true;
  if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];
  S.notifyQueue.push(key);
}
/* patch589: drops any "vega:*" entry still sitting in the queue - called once from
   startFinale() (the moment of the turn) and once from adopt() (a save loaded at
   S.end>=1, belt and braces for one written before this guard existed). Never
   touches a "rival:" entry or a plain key - non-VEGA notices keep working. */
function purgeVegaNotices(){
  if(!Array.isArray(S.notifyQueue))return;
  S.notifyQueue=S.notifyQueue.filter(k=>k.indexOf("vega:")!==0);
}
/* rolls (once - stable across a reload) which of the two live rivals "sends" a
   given RIVAL_MSG beat, then queues it under the "rival:" namespace via the same
   idempotent queueNotice() every other beat uses. */
function rivalMsgWho(key){
  if(!S.rvMsg||typeof S.rvMsg!=="object")S.rvMsg={};
  if(!S.rvMsg[key] || RVACT.indexOf(S.rvMsg[key])<0){
    /* NOT Math.random(): csim4.js's pacing sim monkey-patches Math.random with a
       seeded PRNG for reproducibility, and every call anywhere in tick()'s call
       graph draws from that same single stream - one extra draw here would shift
       every later roll (mission rewards, combat, crew) downstream of it, breaking
       the required byte-identical pacing output for a purely cosmetic choice (see
       HANDOVER). Hashed off the beat name and the save's own cseed instead - still
       varies save to save without touching shared entropy. */
    let hh=0; for(let i=0;i<key.length;i++)hh=((hh<<5)-hh+key.charCodeAt(i))|0;
    hh=(hh^(S.cseed||1))>>>0;
    S.rvMsg[key]=RVACT[hh%RVACT.length];
  }
  return S.rvMsg[key];
}
function queueRivalNotice(key){ rivalMsgWho(key); queueNotice("rival:"+key); }
/* checked once per tick, same place checkLevel/checkMissions/checkAchs already are -
   queueNotice() itself is idempotent (S.seen guards it) so calling this every tick
   costs nothing once a condition has fired. */
