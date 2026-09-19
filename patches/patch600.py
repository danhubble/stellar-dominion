#!/usr/bin/env python3
"""
patch600 — PLAN-defences.md Run 3, patch 1 of 3: the Hangar.

Flips the `han` module (defined DISABLED-ONLY since patch597) on, and gives it the
one thing every other module already had and it never did: state of its own.

  - S.han[sysId] = [n0,n1,n2] - counts of SHIPS[] hull classes stationed at that
    system's Hangar. Stationing MOVES hulls out of S.sh (the active/raidable
    fleet) into S.han; recalling moves them back. shipPower() now sums both, so
    the total fleet you can ever own (active + every garrison combined) still
    respects fleetCap() exactly as before - stationing never frees capacity to
    buy replacements with, it only relocates hulls you already paid for out of
    your raiding roster (the plan's own "come off fleetCap availability... until
    recalled").
  - HAN_CAP=8 (TUNING-PENDING) is a plain ship-COUNT cap per Hangar, any mix of
    hull classes - not a power-unit cap. A power cap this small would exclude a
    Frigate (pw 16) and a Dreadnought (pw 64) outright, and the picker's own
    "pick hull class, +/- counts... capacity used/left" wants one simple,
    class-independent number to show either way.
  - defStrength()'s Hangar term (hanStrength()) is the one genuinely new formula
    this run adds: HAN_STR_MULT * average(stationed DPS / parDPS(), stationed HP
    / parHP()) - the same blended-against-par thinking the raid targets already
    use, so a Hangar stays worth fitting at level 12 and at level 80 alike. An
    empty, built Hangar is worth exactly 0, same as an empty slot.
  - occupySystem() recalls every stationed hull the instant a system is lost -
    the kinder of the plan's two offered readings (vs. locking them away until
    the system is retaken, which for a system near the frontier might be never).
    dmodSwap() does the same when the Hangar module itself is swapped out.
  - Two Run 1/2 polish items named in this run's own brief, folded in here since
    both touch the same sheet surface this patch is already editing: the
    DEFEND IT / LET THEM HOLD row becomes a sticky footer inside the sheet
    (position:sticky, not a DOM restructure - keeps every existing test's
    #sysSheet-children assumption intact), and the defence cards' three-letter
    text badges (TUR/MIN/SHD) become small SVG glyphs matching fortify-mock2.html,
    in the module's own colour.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------------------------------------------------------------------
# 1) fresh(): S.han defaults to {}
# ---------------------------------------------------------------------------
do(
    "    exo:{}, xp:{}, taken:{}, lost:{}, occ:{}, occAt:{}, def:{}, rv:{}, exoSeen:{}, seen:{}, notifyQueue:[], rvMsg:{},",
    "    exo:{}, xp:{}, taken:{}, lost:{}, occ:{}, occAt:{}, def:{}, han:{}, rv:{}, exoSeen:{}, seen:{}, notifyQueue:[], rvMsg:{},",
    label="fresh() S.han",
)

# ---------------------------------------------------------------------------
# 2) DEF_MODULES.han: flip disabled off, real copy
# ---------------------------------------------------------------------------
do(
    """ han:{ id:"han", n:"Hangar", maxLv:1, oneUse:false, disabled:true,
   guidance:"Stations fleet here \\u2014 arriving soon.",
   desc:"Stations part of your fleet at this system so it fights beside the garrison. Not yet available \\u2014 arriving in a later update." }""",
    """ han:{ id:"han", n:"Hangar", maxLv:1, oneUse:false,
   guidance:"Best against the Covenant \\u2014 stations fleet, not firepower.",
   desc:"Stations part of your fleet at this system, fighting beside the garrison and the automated defences. The more (and the heavier) you station, the stronger this gets \\u2014 open STATION FLEET to assign hulls." }""",
    label="DEF_MODULES.han enabled",
)

# ---------------------------------------------------------------------------
# 3) Hangar accounting - a new block right after DEF_MODULES, before dmodSlots()
# ---------------------------------------------------------------------------
do(
    "/* read-only: never mutates S.def, so it is safe to call every render() tick. */\nfunction dmodSlots(id){",
    """/* PLAN-defences.md Run 3 (patch600): Hangar stationing. S.han[sysId]=[n0,n1,n2] -
   counts of each SHIPS[] hull class stationed at that system, moved OUT of S.sh (the
   active/raidable fleet) while stationed - recallHan()/recallHanAll() move them back.
   shipPower() (below) sums both, so the total fleet you can ever own - active plus
   every garrison combined - still respects fleetCap() exactly as it did before this
   patch; stationing never frees capacity to buy replacements with, it only relocates
   hulls you already paid for out of your raiding roster. */
const HAN_CAP=8;   /* TUNING-PENDING: ship COUNT per Hangar, any mix of hull classes -
   not a power-unit cap (a single Frigate's pw alone would already exceed a power cap
   this size, excluding two of the three hulls outright), and the picker's own
   "pick hull class, +/- counts... capacity used/left" wants one simple number. */
function hanFleet(id){ const h=S.han&&S.han[id]; return (Array.isArray(h)&&h.length===3)?h:[0,0,0]; }
function hanCount(id){ const h=hanFleet(id); return h[0]+h[1]+h[2]; }
function hanLeft(id){ return Math.max(0,HAN_CAP-hanCount(id)); }
function hanDPS(id){ const h=hanFleet(id); let d=0; for(let i=0;i<SHIPS.length;i++)d+=h[i]*SHIPS[i].dps; return d; }
function hanHP(id){  const h=hanFleet(id); let d=0; for(let i=0;i<SHIPS.length;i++)d+=h[i]*SHIPS[i].hp;  return d; }
/* every hull stationed ANYWHERE, summed once for shipPower()'s own cap accounting -
   see the header note above. */
function hanTotalPower(){
  let p=0;
  if(S.han)for(const id in S.han){ const hh=S.han[id]; if(!Array.isArray(hh))continue;
    for(let i=0;i<SHIPS.length;i++)p+=(hh[i]||0)*SHIPS[i].pw; }
  return p;
}
/* TUNING-PENDING: garrison-strength coefficient. Blended against PAR, not the
   player's own raw numbers, so a Hangar stays meaningful at every level, same as the
   raid targets: dpsR/hpR are what the stationed fleet is worth as a FRACTION of
   parDPS()/parHP() (what a player at this level "should" field), averaged, then
   scaled once by HAN_STR_MULT. A built, empty Hangar is worth exactly 0. */
const HAN_STR_MULT=1.2;
function hanStrength(id){
  const pD=parDPS(), pH=parHP();
  const dpsR = pD>0 ? hanDPS(id)/pD : 0;
  const hpR  = pH>0 ? hanHP(id)/pH  : 0;
  return HAN_STR_MULT*(dpsR+hpR)*0.5;
}
/* stations n hulls of class hullIdx (0..2) from the fleet you actually own (S.sh)
   into this system's Hangar. Refuses without a built+armed Hangar, refuses past
   HAN_CAP, and clamps to however many of that hull are actually free to move -
   "stationing is per hull class, from the fleet you actually own" (the plan's own
   words), never a number the caller merely asked for. */
function stationHan(sysId,hullIdx,n){
  const s=SYSMAP[sysId]; if(!s||s.home||!sysHeld(sysId))return false;
  if(dmodLv(sysId,"han")<=0)return false;
  if(!SHIPS[hullIdx])return false;
  n=Math.floor(n||0); if(n<=0)return false;
  n=Math.min(n, S.sh[hullIdx]||0, hanLeft(sysId));
  if(n<=0)return false;
  S.sh[hullIdx]-=n;
  const arr=hanFleet(sysId).slice(); arr[hullIdx]=(arr[hullIdx]||0)+n;
  if(!S.han||typeof S.han!=="object")S.han={};
  S.han[sysId]=arr;
  dirty=true; return true;
}
/* recalls n hulls of class hullIdx back into the active fleet - n omitted (or too
   large) recalls everything of that class this system has stationed. */
function recallHan(sysId,hullIdx,n){
  const arr=hanFleet(sysId).slice(); const have=arr[hullIdx]||0;
  n = n===undefined ? have : Math.min(Math.max(0,Math.floor(n)), have);
  if(n<=0)return false;
  arr[hullIdx]=have-n;
  if(!S.han||typeof S.han!=="object")S.han={};
  S.han[sysId]=arr;
  S.sh[hullIdx]=(S.sh[hullIdx]||0)+n;
  dirty=true; return true;
}
/* every hull this system has stationed, home in one call - occupySystem()'s own
   "kindest reading" recall, and the RECALL ALL button in the stationing modal. */
function recallHanAll(sysId){
  const arr=hanFleet(sysId); let any=false;
  for(let i=0;i<3;i++) if(arr[i]>0){ recallHan(sysId,i); any=true; }
  return any;
}
/* read-only: never mutates S.def, so it is safe to call every render() tick. */
function dmodSlots(id){""",
    label="Hangar accounting block",
)

# ---------------------------------------------------------------------------
# 4) shipPower(): fold in every stationed hull's power too - see header note.
# ---------------------------------------------------------------------------
do(
    "function shipPower(){ let p=0; for(let i=0;i<SHIPS.length;i++)p+=S.sh[i]*SHIPS[i].pw; return p }",
    "function shipPower(){ let p=0; for(let i=0;i<SHIPS.length;i++)p+=S.sh[i]*SHIPS[i].pw; return p+hanTotalPower() }",
    label="shipPower() includes hangar power",
)

# ---------------------------------------------------------------------------
# 5) defStrength(): the Hangar's own contribution, and dmodSummary()'s ship count
# ---------------------------------------------------------------------------
do(
    """    if(slot.m==="min"){ if(slot.armed)str+=DEF_STR.min; continue }
    if(slot.armed===false)continue;
    str += (DEF_STR[slot.m]||0) * Math.max(1,slot.lv||1);""",
    """    if(slot.m==="min"){ if(slot.armed)str+=DEF_STR.min; continue }
    if(slot.armed===false)continue;
    if(slot.m==="han"){ str+=hanStrength(id); continue }
    str += (DEF_STR[slot.m]||0) * Math.max(1,slot.lv||1);""",
    label="defStrength() Hangar term",
)
do(
    """    if(slot.m==="min"){ parts.push(def.n.toUpperCase()+(slot.armed?"":" (SPENT)")); continue; }
    if(slot.armed===false)continue;
    parts.push(def.n.toUpperCase()+" L"+(slot.lv||1));""",
    """    if(slot.m==="min"){ parts.push(def.n.toUpperCase()+(slot.armed?"":" (SPENT)")); continue; }
    if(slot.armed===false)continue;
    if(slot.m==="han"){ parts.push(def.n.toUpperCase()+" \\u00b7 "+hanCount(id)+" SHIPS"); continue; }
    parts.push(def.n.toUpperCase()+" L"+(slot.lv||1));""",
    label="dmodSummary() Hangar ship count",
)

# ---------------------------------------------------------------------------
# 6) dmodSwap(): recall everything before a Hangar slot can be emptied
# ---------------------------------------------------------------------------
do(
    """  const d=dmodEnsure(s.id), slot=d.s[slotIdx]; if(!slot||slot.q)return false;
  const def=DEF_MODULES[slot.m];
  let spent=0; for(let L=0;L<Math.max(1,slot.lv);L++)spent+=dmodPrice(s,L);""",
    """  const d=dmodEnsure(s.id), slot=d.s[slotIdx]; if(!slot||slot.q)return false;
  const def=DEF_MODULES[slot.m];
  if(slot.m==="han")recallHanAll(s.id);   /* no Hangar left here, so nothing may stay stationed */
  let spent=0; for(let L=0;L<Math.max(1,slot.lv);L++)spent+=dmodPrice(s,L);""",
    label="dmodSwap() recalls on Hangar removal",
)

# ---------------------------------------------------------------------------
# 7) occupySystem(): the kindest reading - stationed ships come straight home
# ---------------------------------------------------------------------------
do(
    """  if(!S.occAt||typeof S.occAt!=="object")S.occAt={};
  S.occAt[id]=Date.now();
  queueNotice("vega:firstLoss");
  return true;
}""",
    """  if(!S.occAt||typeof S.occAt!=="object")S.occAt={};
  S.occAt[id]=Date.now();
  /* PLAN-defences.md: "keeps stationed ships out of the fleet until retaken - or
     returns them; pick the reading that is kindest". Chosen: returns them, right
     now - a system near the frontier might never be retaken, and losing real fleet
     over that is a harsher penalty than the plan's own "buildings intact" framing
     for everything else occupySystem() touches. */
  recallHanAll(id);
  queueNotice("vega:firstLoss");
  return true;
}""",
    label="occupySystem() recalls the Hangar",
)

# ---------------------------------------------------------------------------
# 8) adopt(): S.han sanitiser, placed AFTER S=f (needs sysHeld()/dmodLv(), both
#    of which read the global S - the save just adopted, not the outgoing game).
# ---------------------------------------------------------------------------
do(
    """  S=f;
  if(S.__seedXp){ delete S.__seedXp; xpSeedAll() }""",
    """  S=f;
  /* S.han[sysId] - always exactly 3 non-negative integers, never more than HAN_CAP
     combined. Placed here (not with the S.def sanitiser above, before S=f) because
     it needs sysHeld()/dmodLv() to see the save's OWN, already-sanitised state, not
     whatever game was running before this load. An entry naming a system that is
     not currently held, or that carries no built+armed Hangar (never reachable from
     the real UI - stationHan() itself checks both) is not deleted outright: its
     counts fold straight back into S.sh instead, the same "never actually destroy a
     ship over a save/sanitiser edge case" kindness occupySystem()'s own
     recallHanAll() already applies during ordinary play. */
  if(!S.han||typeof S.han!=="object")S.han={};
  for(const k in S.han){
    const raw=S.han[k];
    const arr=(Array.isArray(raw)&&raw.length===3) ? raw.map(x=>Math.max(0,Math.floor(x||0))) : [0,0,0];
    const ok = SYSMAP[k] && !SYSMAP[k].home && sysHeld(k) && dmodLv(k,"han")>0;
    if(!ok){
      for(let i=0;i<3;i++) if(arr[i]>0) S.sh[i]=(S.sh[i]||0)+arr[i];
      delete S.han[k];
      continue;
    }
    let total=arr[0]+arr[1]+arr[2];
    for(let i=0;i<3&&total>HAN_CAP;i++){
      const cut=Math.min(arr[i], total-HAN_CAP);
      arr[i]-=cut; S.sh[i]=(S.sh[i]||0)+cut; total-=cut;
    }
    S.han[k]=arr;
  }
  if(S.__seedXp){ delete S.__seedXp; xpSeedAll() }""",
    label="adopt() S.han sanitiser",
)

# ---------------------------------------------------------------------------
# 9) polish item: proper SVG glyphs (fortify-mock2.html's own style) in place
#    of the old three-letter text labels, in the module's own colour.
# ---------------------------------------------------------------------------
do(
    """let defSel=null, defSelSys=null;
const DEF_ICON={ tur:"TUR", min:"MIN", shd:"SHD", sen:"SEN", han:"HAN" };
const DEF_COLOR={ tur:"var(--cy)", min:"var(--gd)", shd:"var(--vi)", sen:"var(--gr)", han:"var(--dim2)" };""",
    """let defSel=null, defSelSys=null;
/* patch600 polish: small line-icon glyphs (fortify-mock2.html's own style - 24x24,
   stroke=currentColor, no fill) in place of the old three-letter text labels.
   Colour comes from DEF_COLOR via CSS currentColor, same as everywhere else that
   already keys off --a. Turret Ring/Minefield are the mock's own two example
   icons, used verbatim; Shield Array/Sensor Mast/Hangar (not in the mock) are new,
   drawn in the same visual language. */
const DEF_GLYPH={
 tur:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2"/>',
 min:'<circle cx="12" cy="12" r="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8"/>',
 shd:'<path d="M12 3l7 3.2v5.3c0 4.6-3 7.6-7 8.7-4-1.1-7-4.1-7-8.7V6.2z"/>',
 sen:'<path d="M12 21v-9M7.8 9.6a5.2 5.2 0 018.4 0M4.6 6.6a9.4 9.4 0 0114.8 0"/><circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none"/>',
 han:'<path d="M4 20h16M6 20v-6.5a6 6 0 0112 0V20"/><path d="M9.5 20l1-4h3l1 4"/>'
};
function defIconHTML(m){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DEF_GLYPH[m]||""}</svg>`; }
const DEF_ICON=DEF_GLYPH;   /* kept as an alias so the existing __SD export name still resolves */
const DEF_COLOR={ tur:"var(--cy)", min:"var(--gd)", shd:"var(--vi)", sen:"var(--gr)", han:"var(--sv)" };""",
    label="DEF_GLYPH + defIconHTML",
)
do(
    '    <div class="si">${DEF_ICON[slot.m]||"?"}</div>',
    '    <div class="si">${defIconHTML(slot.m)}</div>',
    label="defCardHTML glyph",
)
do(
    '          <div class="pki">${DEF_ICON[id]}</div>',
    '          <div class="pki">${defIconHTML(id)}</div>',
    label="picker glyph",
)

# ---------------------------------------------------------------------------
# 10) defCardHTML(): Hangar-specific level text (ship count, not "LV 1/1") and
#     renderDefDetail(): Hangar-specific effect line (its bonus isn't per-level).
# ---------------------------------------------------------------------------
do(
    """  const lvText = building ? `<span class="cardcd" data-slot="${i}"></span>`
    : def.oneUse ? (slot.armed?"ONE USE":"EMPTY")
    : "LV "+slot.lv+"/"+def.maxLv;""",
    """  const lvText = building ? `<span class="cardcd" data-slot="${i}"></span>`
    : slot.m==="han" ? hanCount(s.id)+"/"+HAN_CAP+" SHIPS"
    : def.oneUse ? (slot.armed?"ONE USE":"EMPTY")
    : "LV "+slot.lv+"/"+def.maxLv;""",
    label="defCardHTML Hangar lvText",
)
do(
    """    const pctPer=Math.round((DEF_STR[slot.m]||0)*100);
    const effect = def.oneUse ? "Breaks the first wave \\u00b7 +"+pctPer+"% hold while armed"
      : "+"+pctPer+"% hold per level"
        +(slot.m==="shd"?" \\u00b7 +"+Math.round(SHD_HULL_PER*100)+"% hull/level"
          :slot.m==="tur"?" \\u00b7 1 turret/level":"");""",
    """    const pctPer=Math.round((DEF_STR[slot.m]||0)*100);
    const effect = slot.m==="han" ? "Garrison bonus scales with the fleet you station here \\u2014 see STATION FLEET"
      : def.oneUse ? "Breaks the first wave \\u00b7 +"+pctPer+"% hold while armed"
      : "+"+pctPer+"% hold per level"
        +(slot.m==="shd"?" \\u00b7 +"+Math.round(SHD_HULL_PER*100)+"% hull/level"
          :slot.m==="tur"?" \\u00b7 1 turret/level":"");""",
    label="renderDefDetail Hangar effect line",
)

# ---------------------------------------------------------------------------
# 11) HTML: #sysHanWrap - STATION FLEET, shown only once a system has a built
#     Hangar. Sits right after the defences row, before the (still separate)
#     under-attack action row - matches fortify-mock2.html's own D/E state,
#     whose held-system `.acts` row is STATION FLEET / CLOSE.
# ---------------------------------------------------------------------------
do(
    """          <div id="sysDefWrap" hidden>
            <div id="sysDefHead"></div>
            <div id="sysDefRow"></div>
            <div id="sysDefDetail" hidden></div>
          </div>
          <div id="sysThreatActs" class="row" hidden></div>""",
    """          <div id="sysDefWrap" hidden>
            <div id="sysDefHead"></div>
            <div id="sysDefRow"></div>
            <div id="sysDefDetail" hidden></div>
          </div>
          <div id="sysHanWrap" class="row" hidden></div>
          <div id="sysThreatActs" class="row" hidden></div>""",
    label="HTML #sysHanWrap",
)

# ---------------------------------------------------------------------------
# 12) CSS: glyph sizing, the Hangar row/button, the stationing modal's stepper
#     rows, and the sticky footer (owner review polish item 1) - position:sticky
#     rather than a DOM restructure, so #sysSheet's existing children (every
#     current test's own assumption) are untouched.
# ---------------------------------------------------------------------------
do(
    "#sysDefRow .sc .si{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;\n  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a,var(--mut));\n  font:700 11px/1 ui-monospace,monospace}",
    "#sysDefRow .sc .si{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;\n  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a,var(--mut));\n  font:700 11px/1 ui-monospace,monospace}\n#sysDefRow .sc .si svg{width:16px;height:16px;display:block}",
    label="css .si svg sizing",
)
do(
    "#sysDefDetail .pki{width:22px;height:22px;flex:none;border-radius:7px;display:grid;place-items:center;\n  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a);font:700 10px/1 ui-monospace,monospace}",
    "#sysDefDetail .pki{width:22px;height:22px;flex:none;border-radius:7px;display:grid;place-items:center;\n  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a);font:700 10px/1 ui-monospace,monospace}\n#sysDefDetail .pki svg{width:14px;height:14px;display:block}",
    label="css .pki svg sizing",
)
do(
    "#sysThreatActs[hidden]{display:none}\n#sysThreatActs button.ghost{background:transparent;border-color:var(--line);color:var(--mut)}",
    """#sysThreatActs[hidden]{display:none}
#sysThreatActs button.ghost{background:transparent;border-color:var(--line);color:var(--mut)}
/* owner review polish item 1: DEFEND IT / LET THEM HOLD pinned to the bottom of the
   sheet, always visible at 390x844 even with the threat block + defences row both
   showing, everything above scrolling underneath it. #sysSheet is the scrolling
   ancestor (overflow-y:auto) already - position:sticky needs nothing else from it,
   and keeps #sysThreatActs a direct child of #sysSheet exactly as before (every
   existing test's own DOM assumption stays true). The gradient masks scrolled
   content that would otherwise show through the row's own button gaps. */
#sysThreatActs{position:sticky;bottom:0;margin:10px -14px 0;padding:10px 14px 4px;
  background:linear-gradient(180deg,rgba(10,14,36,0) 0%,#0a0e24 38%,#0a0e24 100%);z-index:2}
#sysHanWrap[hidden]{display:none}
#sysHanWrap button.ghost{background:transparent;border-color:var(--line);color:var(--mut)}
.hanrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.hanrow:last-child{border-bottom:none}
.hanrow .hi{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;
  border:1px solid var(--line);background:rgba(255,255,255,.03)}
.hanrow .hi svg{width:20px;height:20px;display:block}
.hanrow .hn{font:700 11px/1.2 system-ui;color:var(--txt)}
.hanrow .hd2{font:600 9.5px/1.3 ui-monospace,monospace;color:var(--dim)}
.hanstep{display:flex;align-items:center;gap:8px;margin-left:auto;flex:none}
.hanstep button{width:28px;height:28px;border-radius:8px;border:1px solid var(--line2);
  background:rgba(72,226,255,.09);color:var(--cy);font:700 15px/1 system-ui;cursor:pointer;padding:0}
.hanstep button:disabled{opacity:.35;cursor:not-allowed}
.hanstep .hcnt{min-width:16px;text-align:center;font:700 12px/1 ui-monospace,monospace;color:var(--txt)}""",
    label="css sticky footer + hangar rows",
)

# ---------------------------------------------------------------------------
# 13) renderSysHan() / the stationing modal - inserted right after renderSysDef()
# ---------------------------------------------------------------------------
do(
    "function renderMap(){\n  initMapSec();",
    """/* STATION FLEET row - shown only once this system carries a built+armed Hangar
   (dmodLv>0). Separate from the defences row's own per-card buttons: the Hangar's
   card just reads BUILT/MAXED like Sensor Mast's does, all the actual interaction
   (picking hull classes, how many) lives in this one button + its modal, per the
   plan's own "STATION FLEET ... opens the stationing UI". */
function renderSysHan(s){
  const wrap=$("#sysHanWrap"); if(!wrap)return;
  if(s.home||!sysHeld(s.id)||dmodLv(s.id,"han")<=0){
    if(!wrap.hidden||wrap.dataset.h!==""){ wrap.hidden=true; wrap.dataset.h=""; wrap.innerHTML=""; }
    return;
  }
  wrap.hidden=false;
  const used=hanCount(s.id), key="han|"+used;
  if(wrap.dataset.h!==key){
    wrap.dataset.h=key;
    wrap.innerHTML=`<button type="button" class="ghost" id="sysHanBtn">STATION FLEET${used?" \\u00b7 "+used+"/"+HAN_CAP:""}</button>`;
    $("#sysHanBtn").onclick=()=>hanModal(s.id);
  }
}
function hanRowHTML(sysId,i){
  const owned=S.sh[i]||0, stationed=hanFleet(sysId)[i]||0, left=hanLeft(sysId);
  const canAdd=owned>0&&left>0, canSub=stationed>0;
  return `<div class="hanrow">
    <div class="hi" style="color:${SHIPS[i].col}"><svg viewBox="0 0 48 48">${SHIPS[i].ic}</svg></div>
    <div style="min-width:0;flex:1">
      <div class="hn">${SHIPS[i].n}</div>
      <div class="hd2">${fmt(SHIPS[i].dps)} dps \\u00b7 ${fmt(SHIPS[i].hp)} hull \\u00b7 ${owned} in fleet</div>
    </div>
    <div class="hanstep">
      <button type="button" data-hstep="-1" data-i="${i}" ${canSub?"":"disabled"}>\\u2212</button>
      <span class="hcnt">${stationed}</span>
      <button type="button" data-hstep="1" data-i="${i}" ${canAdd?"":"disabled"}>+</button>
    </div>
  </div>`;
}
function hanModalHTML(sysId){
  const s=SYSMAP[sysId], used=hanCount(sysId);
  const th=thqAtSys(sysId)||{rv:"hel",dif:1,sysId};
  const pct=Math.round(holdOdds(th)*100);
  return `<div class="nmh" style="--a:${DEF_COLOR.han};--a2:rgba(255,255,255,.06)">
      <div class="nmt" style="color:${DEF_COLOR.han}">${defIconHTML("han")}</div>
      <div style="min-width:0"><h3 style="margin:0 0 2px;color:${DEF_COLOR.han}">Hangar \\u2014 ${s.n}</h3>
        <div class="nmm">${used} of ${HAN_CAP} stationed</div></div>
    </div>
    <p>Stationed hulls fight beside the garrison and come off your raiding fleet until recalled \\u2014 they still cost fleet capacity either way.</p>
    <div id="hanRows">${[0,1,2].map(i=>hanRowHTML(sysId,i)).join("")}</div>
    <div class="rrow" style="margin-top:8px"><span>Garrison holds</span><b>${pct}%</b></div>
    <div class="row" style="margin-top:10px"><button id="hanRecallAll" class="ghost">RECALL ALL</button><button id="hanDone">DONE</button></div>`;
}
function hanModal(sysId){
  showModal(hanModalHTML(sysId), ()=>hanModalWire(sysId));
}
function hanModalWire(sysId){
  const refresh=()=>{ $("#modal").innerHTML=hanModalHTML(sysId); hanModalWire(sysId); render(); };
  $("#modal").querySelectorAll("[data-hstep]").forEach(btn=>{
    btn.onclick=()=>{
      const i=+btn.dataset.i, step=+btn.dataset.hstep;
      const did = step>0 ? stationHan(sysId,i,1) : recallHan(sysId,i,1);
      if(did){ save(); refresh(); }
    };
  });
  const ra=$("#hanRecallAll"); if(ra)ra.onclick=()=>{ if(recallHanAll(sysId)){ save(); refresh(); } };
  const done=$("#hanDone"); if(done)done.onclick=()=>{ hideModal(); render(); };
}
function renderMap(){
  initMapSec();""",
    label="renderSysHan + stationing modal",
)

do(
    "  renderSysOdds(s);\n  renderSysDef(s);",
    "  renderSysOdds(s);\n  renderSysDef(s);\n  renderSysHan(s);",
    label="renderMap() calls renderSysHan",
)

do(
    """    const defWrap=$("#sysDefWrap");
    if(defWrap&&!defWrap.hidden){
      defWrap.hidden=true;
      const head=$("#sysDefHead"), row=$("#sysDefRow"), detail=$("#sysDefDetail");
      if(head){ head.dataset.h=""; head.innerHTML="" }
      if(row){ row.dataset.h=""; row.innerHTML="" }
      if(detail){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    }
    return;""",
    """    const defWrap=$("#sysDefWrap");
    if(defWrap&&!defWrap.hidden){
      defWrap.hidden=true;
      const head=$("#sysDefHead"), row=$("#sysDefRow"), detail=$("#sysDefDetail");
      if(head){ head.dataset.h=""; head.innerHTML="" }
      if(row){ row.dataset.h=""; row.innerHTML="" }
      if(detail){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    }
    const hanWrap=$("#sysHanWrap");
    if(hanWrap&&!hanWrap.hidden){ hanWrap.hidden=true; hanWrap.dataset.h=""; hanWrap.innerHTML=""; }
    return;""",
    label="renderMap() clears #sysHanWrap",
)

# ---------------------------------------------------------------------------
# 14) __SD export
# ---------------------------------------------------------------------------
do(
    "  DEF_ICON,DEF_COLOR,hasSensorMast,defBestPreview,",
    "  DEF_ICON,DEF_COLOR,DEF_GLYPH,defIconHTML,hasSensorMast,defBestPreview,\n  HAN_CAP,HAN_STR_MULT,hanFleet,hanCount,hanLeft,hanDPS,hanHP,hanTotalPower,hanStrength,\n  stationHan,recallHan,recallHanAll,renderSysHan,hanModal,hanModalHTML,",
    label="__SD export additions",
)

do("const BUILD=599;", "const BUILD=600;", label="BUILD bump")

open(PATH, "w", encoding="utf-8").write(h)
print("patch600 applied OK")
