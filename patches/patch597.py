#!/usr/bin/env python3
"""
patch597 — PLAN-defences.md Run 2, patch 1 of 3: S.def, the five module
definitions, defStrength() (replaces sdStrength()'s level read), the
build/upgrade/rearm/swap economy, adopt()'s drop of S.sd/S.sdq.

Old model: one flat defence level per system (S.sd[id], 0-8), one queued
build (S.sdq[id]). New model: three independent slots per system
(S.def[id].s, each null or {m,lv,armed,q}), one of five modules per slot -
see PLAN-defences.md "## Modules". Owner decision 1: no conversion, no
refund - a save carrying the old S.sd/S.sdq just loses it; every system
starts with empty slots.

This patch is the RULES layer only. It intentionally leaves the Map sheet's
held-system UI as a minimal placeholder (a plain "N of 3 slots fitted" line,
no button) wherever the old single FORTIFY button used to live - the real
row-of-three-cards UI is patch598's whole job, immediately next in this run.
Every mini-game/holdOdds/threat-card call site that used to read the old
sdLv()/sdStrength()/sdTurrets() is repointed here so nothing throws.
"""
import re

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------------------------------------------------------------------
# 1) constants + module table + dmod*/defStrength functions, replacing the
#    old SD_MAX..bestHeldSdLv() block. occupySystem()/occWeakMul() (which sit
#    between bestHeldSdLv() and buySysDef() in the original) are untouched.
# ---------------------------------------------------------------------------
OLD_BLOCK_A = """/* ============================ system defences ============================ */
/* Bought with the exotic the system itself produces, so a system pays for its own
   protection. Everything a level buys is VISIBLE in the defence fight - reload, hull,
   and from SD_AUTO an automated turret that fires on its own. A defence you can watch
   working is worth ten times one that only exists in a formula. */
const SD_MAX=8,            /* levels per system */
      SD_C0=14,            /* first level, in that system's exotic */
      SD_CG=1.55,          /* cost growth */
      SD_RATE=0.075,       /* fire rate, per level */
      SD_HULL=0.13,        /* system hull, per level */
      SD_AUTO=3,           /* automated turrets start here */
      SD_AUTOEV=4.2,       /* seconds between automated shots */
      SD_BUILD_BASE=20,    /* fortify build time, seconds - flat part */
      SD_BUILD_PER=5;      /* + this many seconds per level already held */
function sdLv(id){ return (S.sd&&S.sd[id])||0 }
function sdCost(id){ return Math.ceil(SD_C0*Math.pow(SD_CG,sdLv(id))) }
/* ore worlds (res:null) have no exotic to spend - fortifying them costs ORE instead,
   scaled off the system's own claim cost so cheaper/pricier ore systems fortify at a
   matching pace, same SD_CG growth curve as the exotic price. */
function sdCostOre(s){ return Math.ceil(s.cost*0.35*Math.pow(SD_CG,sdLv(s.id))) }
function sdQueued(id){ return (S.sdq&&S.sdq[id])||null }
function sdBuildSecs(l){ return SD_BUILD_BASE+SD_BUILD_PER*l }
/* promotes any due build from S.sdq to S.sd - called every tick() and once from
   offlineReport(), so a build finished while the tab was shut completes on load
   rather than silently waiting for the next purchase to notice. */
function sdqComplete(){
  if(!S.sdq)return;
  for(const id in S.sdq){
    const q=S.sdq[id]; if(!q||Date.now()<q.dueAt)continue;
    if(!S.sd||typeof S.sd!=="object")S.sd={};
    S.sd[id]=q.to;
    delete S.sdq[id];
    dirty=true;
  }
}
function sdTurretsForLv(l){ return l>=SD_AUTO ? 1+Math.floor((l-SD_AUTO)/3) : 0 }
function sdTurrets(id){ return sdTurretsForLv(sdLv(id)) }
/* what the defence is worth when nobody is flying it - patch133 resolves against this */
/* Orbital Batteries feed the GARRISON, so they only pay off on the road where you are
   not flying the defence yourself. Deliberately a different node from the one that helps
   when you are: the choice between the two roads is what the whole rival layer rests on,
   and one upgrade improving both would quietly collapse it. */
/* PATCH 1: development no longer exists, so it no longer contributes here either -
   defence strength is now just the defence level itself plus the research node. */
function sdStrength(id){ return sdLv(id)*1.0 + lv(S.rs,"bat")*0.42 }
/* sabotage targets home, which never carries its own defence level (S.sd has no
   "home" key - see adopt()'s S.sd sanitiser) - "your best garrison falls back to
   defend home" (owner decision 8), so it borrows the strongest held system's own
   level/strength instead. 0 with nothing held, same as an undefended system. */
function bestHeldSdLv(){ let best=0; for(const s of heldSystems())best=Math.max(best,sdLv(s.id)); return best }"""

NEW_BLOCK_A = """/* ============================ system defences ============================ */
/* PLAN-defences.md, Run 2 (patch597). Old model - one flat defence level per system
   (S.sd/S.sdq) - is retired outright: owner decision 1, "no conversion, no refund".
   Every held system now carries three independent slots (S.def[id].s, each null or
   {m,lv,armed,q}), one of the five DEF_MODULES per slot. Bought with the exotic the
   system itself produces (ore worlds pay ore - same rule the old sdCostOre() used),
   same SD_C0/SD_CG cost curve and SD_BUILD_BASE/SD_BUILD_PER build-time shape the old
   single level used, applied per-slot now - see dmodPrice()/dmodBuildSecs(). */
const SD_C0=14,            /* first level, in THIS slot's own exotic (or ore-equivalent) */
      SD_CG=1.55,          /* cost growth, per level the slot already has */
      SD_AUTOEV=4.2,       /* seconds between automated turret shots */
      SD_BUILD_BASE=20,    /* build/upgrade/rearm time, seconds - flat part */
      SD_BUILD_PER=5;      /* + this many seconds per level the slot already has */
/* TUNING-PENDING: every module's own per-level (min/sen: flat, since they never go
   past level 1) contribution to defStrength() - garrison strength fed straight into
   holdOdds(), the exact job the old sdLv()*1.0 term did. */
const DEF_STR={ tur:0.6, min:0.9, shd:0.4, sen:0.3, han:0 };
const SHD_HULL_PER=0.25;   /* TUNING-PENDING: Shield Array's own hull mult per level -
                               the mini-game's DT.hullMul slot, replacing the old flat
                               SD_HULL (which applied to every level of the one-size-
                               fits-all defence, not a specific module) */
/* The five modules (PLAN-defences.md "## Modules"). `desc` is the two-sentence
   detail-strip copy (patch598): what it does, then what it is good against, per the
   plan's own one-liners (Helion swarm many light hulls -> mines and turrets; the
   Covenant arrive heavy and slow -> shields and stationed hulls). `disabled` (Hangar
   only): DEFINITION ONLY this run - Run 3 (patch600) wires fleet stationing up.
   Shown in the picker, dimmed, rather than hidden entirely - named in HANDOVER. */
const DEF_MODULES={
 tur:{ id:"tur", n:"Turret Ring", maxLv:3, oneUse:false,
   guidance:"Best against Helion \\u2014 many light hulls, fast.",
   desc:"One automated turret per level, firing on its own in the mini-game. Strongest against a swarm of light, numerous hulls." },
 min:{ id:"min", n:"Minefield", maxLv:1, oneUse:true,
   guidance:"One use \\u2014 spent whether it fires or not.",
   desc:"Breaks the first wave as it arrives. One use: spent the moment an attack on this system resolves, however it resolves \\u2014 rearm it after every fight." },
 shd:{ id:"shd", n:"Shield Array", maxLv:3, oneUse:false,
   guidance:"Best against the Covenant \\u2014 heavy, slow hulls.",
   desc:"Raises this system's own hull in the mini-game as well as its garrison strength. Strongest against a small number of heavy, slow attackers." },
 sen:{ id:"sen", n:"Sensor Mast", maxLv:1, oneUse:false,
   guidance:"Information, not firepower.",
   desc:"Extends this system's warning window and names exactly who is coming and how they fight, including what rearming now would do to the odds. Useless once a fleet is already inbound \\u2014 fit it before you need it." },
 han:{ id:"han", n:"Hangar", maxLv:1, oneUse:false, disabled:true,
   guidance:"Stations fleet here \\u2014 arriving soon.",
   desc:"Stations part of your fleet at this system so it fights beside the garrison. Not yet available \\u2014 arriving in a later update." }
};
/* read-only: never mutates S.def, so it is safe to call every render() tick. */
function dmodSlots(id){ const d=S.def&&S.def[id]; return (d&&Array.isArray(d.s))?d.s:[null,null,null]; }
function dmodSlot(id,i){ return dmodSlots(id)[i]||null }
function dmodEnsure(id){
  if(!S.def||typeof S.def!=="object")S.def={};
  let d=S.def[id];
  if(!d||typeof d!=="object"||!Array.isArray(d.s)||d.s.length!==3) d=S.def[id]={s:[null,null,null]};
  return d;
}
/* one queued build per system (owner decision, same rule the old S.sdq had) - true if
   ANY of the three slots is mid-build/upgrade/rearm. */
function dmodBusy(id){ return dmodSlots(id).some(sl=>sl&&sl.q); }
/* same SD_C0/SD_CG curve the old single defence level used, keyed on the level THIS
   slot already has (0 for an empty slot, so BUILD and REARM both land on SD_C0 - a
   rearm never advances lv, so its price never grows either, which is exactly the flat
   running cost the plan calls for: "costs exotic every time"). */
function dmodCost(curLv){ return Math.ceil(SD_C0*Math.pow(SD_CG,curLv)) }
function dmodCostOre(s,curLv){ return Math.ceil(s.cost*0.35*Math.pow(SD_CG,curLv)) }
function dmodPrice(s,curLv){ return s.res?dmodCost(curLv):dmodCostOre(s,curLv) }
function dmodBuildSecs(curLv){ return SD_BUILD_BASE+SD_BUILD_PER*curLv }
/* promotes any due build/upgrade/rearm across every slot of every system - called
   every tick() and once from offlineReport(), same job sdqComplete() did before. */
function dmodComplete(){
  if(!S.def||typeof S.def!=="object")return;
  for(const id in S.def){
    const d=S.def[id]; if(!d||!Array.isArray(d.s))continue;
    for(const slot of d.s){
      if(!slot||!slot.q||Date.now()<slot.q.dueAt)continue;
      slot.lv=slot.q.to; slot.armed=true; slot.q=null; dirty=true;
    }
  }
}
function dmodBuild(s,slotIdx,moduleId){
  if(!s||s.home||!sysHeld(s.id)||slotIdx<0||slotIdx>2)return false;
  const def=DEF_MODULES[moduleId]; if(!def||def.disabled)return false;
  const d=dmodEnsure(s.id); if(d.s[slotIdx])return false;      /* BUILD is for an empty slot */
  if(dmodBusy(s.id))return false;
  const price=dmodPrice(s,0);
  if(s.res){ if(exo(s.res)<price)return false; S.exo[s.res]=exo(s.res)-price; }
  else { if(S.ore<price)return false; S.ore-=price; }
  const dur=dmodBuildSecs(0);
  d.s[slotIdx]={ m:moduleId, lv:0, armed:false, q:{to:1, dueAt:Date.now()+dur*1000} };
  blip(520,.16,"square",.05);
  toast(s.n+" building "+def.n+" \\u2014 "+dur+"s","g");
  dirty=true; return true;
}
function dmodUpgrade(s,slotIdx){
  if(!s||s.home||!sysHeld(s.id))return false;
  const d=dmodEnsure(s.id), slot=d.s[slotIdx]; if(!slot||slot.q)return false;
  const def=DEF_MODULES[slot.m]; if(!def||def.oneUse||slot.lv>=def.maxLv)return false;
  if(dmodBusy(s.id))return false;
  const price=dmodPrice(s,slot.lv);
  if(s.res){ if(exo(s.res)<price)return false; S.exo[s.res]=exo(s.res)-price; }
  else { if(S.ore<price)return false; S.ore-=price; }
  const dur=dmodBuildSecs(slot.lv);
  slot.q={to:slot.lv+1, dueAt:Date.now()+dur*1000};
  blip(520,.16,"square",.05);
  toast(s.n+" upgrading "+def.n+" \\u2014 "+dur+"s","g");
  dirty=true; return true;
}
function dmodRearm(s,slotIdx){
  if(!s||s.home||!sysHeld(s.id))return false;
  const d=dmodEnsure(s.id), slot=d.s[slotIdx]; if(!slot||slot.q)return false;
  const def=DEF_MODULES[slot.m]; if(!def||!def.oneUse||slot.armed)return false;
  if(dmodBusy(s.id))return false;
  const price=dmodPrice(s,slot.lv);
  if(s.res){ if(exo(s.res)<price)return false; S.exo[s.res]=exo(s.res)-price; }
  else { if(S.ore<price)return false; S.ore-=price; }
  const dur=dmodBuildSecs(slot.lv);
  slot.q={to:slot.lv, dueAt:Date.now()+dur*1000};
  blip(520,.16,"square",.05);
  toast(s.n+" rearming "+def.n+" \\u2014 "+dur+"s","g");
  dirty=true; return true;
}
/* Swapping refunds half of what building this slot up to its CURRENT level actually
   cost (summed over dmodPrice(s,0..lv-1)), then empties the slot - the replacement is
   a separate BUILD action (patch598's picker), so this never has to guess one. */
function dmodSwap(s,slotIdx){
  if(!s||s.home||!sysHeld(s.id))return false;
  const d=dmodEnsure(s.id), slot=d.s[slotIdx]; if(!slot||slot.q)return false;
  const def=DEF_MODULES[slot.m];
  let spent=0; for(let L=0;L<Math.max(1,slot.lv);L++)spent+=dmodPrice(s,L);
  const refund=Math.floor(spent*0.5);
  if(refund>0){ if(s.res)S.exo[s.res]=(exo(s.res)||0)+refund; else S.ore+=refund; }
  d.s[slotIdx]=null;
  toast(s.n+" \\u2014 "+(def?def.n:"module")+" removed"+(refund?", "+refund+" refunded":""),"g");
  dirty=true; return true;
}
/* a module's own level for mini-game purposes - 0 if the system never fitted it, or
   it is a spent (unarmed) one-use module. */
function dmodLv(id,m){
  const slot=dmodSlots(id).find(x=>x&&x.m===m); if(!slot)return 0;
  if(m==="min")return slot.armed?1:0;
  return slot.armed===false?0:Math.max(1,slot.lv||1);
}
/* short, human line of what is actually fitted - used on the mini-game's own #dMeta
   line (startDefence()/lfOpenDefence()), replacing the old "DEFENCES L"+level text. */
function dmodSummary(id){
  if(!id)return "none fitted";
  const parts=[];
  for(const slot of dmodSlots(id)){
    if(!slot)continue;
    const def=DEF_MODULES[slot.m]; if(!def)continue;
    if(slot.m==="min"){ parts.push(def.n.toUpperCase()+(slot.armed?"":" (SPENT)")); continue; }
    if(slot.armed===false)continue;
    parts.push(def.n.toUpperCase()+" L"+(slot.lv||1));
  }
  return parts.length?parts.join(" \\u00b7 "):"none fitted";
}
/* what the defence is worth when nobody is flying it - patch133 resolves against this.
   PATCH 1: development no longer exists. PLAN-defences.md: replaces the old flat
   sdLv()*1.0 term with the sum of every fitted module's own contribution - the
   research node keeps its existing +0.42/level on top, unchanged. `excludeIdx`
   (optional): sum every slot EXCEPT this index - lets the sheet (patch598) show each
   card's own marginal odds contribution via holdOdds() itself rather than a second,
   parallel formula (see holdOdds()'s own `strOverride` argument). */
function defStrength(id,excludeIdx){
  let str=0;
  const slots=dmodSlots(id);
  for(let i=0;i<slots.length;i++){
    if(i===excludeIdx)continue;
    const slot=slots[i]; if(!slot)continue;
    if(slot.m==="min"){ if(slot.armed)str+=DEF_STR.min; continue }
    if(slot.armed===false)continue;
    str += (DEF_STR[slot.m]||0) * Math.max(1,slot.lv||1);
  }
  return str + lv(S.rs,"bat")*0.42;
}
/* sabotage targets home, which never carries defences of its own (S.def has no "home"
   key - see adopt()'s S.def sanitiser) - "your best garrison falls back to defend
   home" (owner decision 8), so it borrows the strongest held system's own defStrength
   instead. 0 with nothing held, same as an undefended system. */
function bestHeldDefStrength(){ let best=0; for(const s of heldSystems())best=Math.max(best,defStrength(s.id)); return best }
/* the actual held system bestHeldDefStrength() just measured - startDefence()'s sab
   branch borrows ITS tur/shd LEVELS for the mini-game (turret count / hull mult),
   same fallback in spirit as the old bestHeldSdLv()-driven DT setup. */
function bestHeldDefSys(){
  let best=null, bv=-1;
  for(const s of heldSystems()){ const v=defStrength(s.id); if(v>bv){ bv=v; best=s } }
  return best;
}"""

do(OLD_BLOCK_A, NEW_BLOCK_A, label="constants+dmod block")

# buySysDef() is retired outright - dmodBuild()/dmodUpgrade()/dmodRearm() above do its
# job per-slot, per-module (occupySystem()/occWeakMul(), which sit between the old
# bestHeldSdLv() and buySysDef() in the file, are untouched and not part of this anchor).
OLD_BUYSYSDEF = """function buySysDef(s){
  if(!s||s.home||!sysHeld(s.id))return false;
  const l=sdLv(s.id); if(l>=SD_MAX)return false;
  if(sdQueued(s.id))return false;   /* one queue per system */
  if(s.res){
    const c=sdCost(s.id);
    if(exo(s.res)<c)return false;
    S.exo[s.res]=exo(s.res)-c;
  } else {
    const c=sdCostOre(s);
    if(S.ore<c)return false;
    S.ore-=c;
  }
  if(!S.sdq||typeof S.sdq!=="object")S.sdq={};
  const dur=sdBuildSecs(l);
  S.sdq[s.id]={to:l+1, dueAt:Date.now()+dur*1000};
  blip(520,.16,"square",.05);
  toast(s.n+" fortifying \\u2014 "+dur+"s","g");
  dirty=true; return true;
}"""
NEW_BUYSYSDEF = """/* buySysDef() (single flat defence level) is retired - dmodBuild()/dmodUpgrade()/
   dmodRearm()/dmodSwap() above do its job per-slot, per-module. PLAN-defences.md Run 2. */"""
do(OLD_BUYSYSDEF, NEW_BUYSYSDEF, label="buySysDef removal")

# ---------------------------------------------------------------------------
# 2) fresh(): S.sd/S.sdq -> S.def
# ---------------------------------------------------------------------------
do(
    "exo:{}, xp:{}, taken:{}, lost:{}, occ:{}, occAt:{}, sd:{}, sdq:{}, rv:{}, exoSeen:{}, seen:{}, notifyQueue:[], rvMsg:{},",
    "exo:{}, xp:{}, taken:{}, lost:{}, occ:{}, occAt:{}, def:{}, rv:{}, exoSeen:{}, seen:{}, notifyQueue:[], rvMsg:{},",
    label="fresh() S.def",
)

# ---------------------------------------------------------------------------
# 3) adopt(): drop S.sd/S.sdq outright, sanitise S.def instead
# ---------------------------------------------------------------------------
OLD_ADOPT = """  /* defence levels. A level on a system you do not hold is meaningless, but it is NOT
     deleted - losing a system and taking it back should not wipe what you built there.
     Only impossible entries go. */
  if(!f.sd||typeof f.sd!=="object")f.sd={};
  for(const k in f.sd){
    if(!SYSMAP[k]||SYSMAP[k].home){ delete f.sd[k]; continue }
    f.sd[k]=Math.max(0,Math.min(SD_MAX,Math.floor(f.sd[k]||0)));
    if(!f.sd[k])delete f.sd[k];
  }
  /* a queued fortify build. An entry naming a system that does not exist, is home,
     is already at SD_MAX, or whose target level does not sit exactly one above the
     level it names is nonsense and is dropped; dueAt just gets floored at 0 (a build
     due in the past completes on the very next sdqComplete() call, same as any other
     due-in-the-past timer in this game). */
  if(!f.sdq||typeof f.sdq!=="object")f.sdq={};
  for(const k in f.sdq){
    const q=f.sdq[k], base=(f.sd&&f.sd[k])||0;
    if(!SYSMAP[k]||SYSMAP[k].home||!q||typeof q!=="object"||
       Math.floor(q.to)!==base+1||base+1>SD_MAX){ delete f.sdq[k]; continue }
    f.sdq[k]={ to:base+1, dueAt:Math.max(0,+q.dueAt||0) };
  }"""

NEW_ADOPT = """  /* PLAN-defences.md owner decision 1: the old flat defence level is dropped outright -
     "no conversion, no refund". A save carrying the old S.sd/S.sdq simply loses them;
     every system starts with empty slots, same as a save that never had defences. */
  delete f.sd; delete f.sdq;
  /* S.def[id].s is always exactly 3 slots (null or a module). An entry naming a system
     that does not exist or is home is dropped outright (home never gets slots); a slot
     naming an unknown module id is dropped (emptied) rather than half-honoured. A
     queued build/upgrade/rearm whose target level is not EXACTLY one above (build/
     upgrade) or equal to (rearm) the slot's own current level is nonsense - the old
     S.sdq sanitiser's own rule, applied per-slot now - and is dropped; dueAt is just
     floored at 0 (a build due in the past completes on the very next dmodComplete()
     call, same as any other due-in-the-past timer in this game). A slot at level 0
     with no queue is a contradiction (nothing built, nothing pending) and is dropped. */
  if(!f.def||typeof f.def!=="object")f.def={};
  for(const k in f.def){
    if(!SYSMAP[k]||SYSMAP[k].home){ delete f.def[k]; continue }
    const din=f.def[k], sin=(din&&Array.isArray(din.s))?din.s:[null,null,null];
    const sout=[];
    for(let i=0;i<3;i++){
      const raw=sin[i];
      if(!raw||typeof raw!=="object"||!DEF_MODULES[raw.m]){ sout.push(null); continue }
      const def=DEF_MODULES[raw.m];
      const lvv=Math.max(0,Math.min(def.maxLv,Math.floor(raw.lv||0)));
      const armed=!!raw.armed;
      let q=null;
      if(raw.q && typeof raw.q==="object"){
        const to=Math.floor(raw.q.to);
        if(to===lvv+1 && to<=def.maxLv) q={to, dueAt:Math.max(0,+raw.q.dueAt||0)};
        else if(to===lvv && lvv>=1) q={to, dueAt:Math.max(0,+raw.q.dueAt||0)};  /* rearm */
      }
      if(lvv===0 && !q){ sout.push(null); continue }
      sout.push({ m:raw.m, lv:lvv, armed, q });
    }
    if(sout.every(x=>!x)) delete f.def[k];
    else f.def[k]={ s:sout };
  }"""

do(OLD_ADOPT, NEW_ADOPT, label="adopt() S.def sanitiser")

# ---------------------------------------------------------------------------
# 4) rvFrontierTargetFor(): sdStrength -> defStrength
# ---------------------------------------------------------------------------
do(
    "   weighted by defence too: dividing by 1+sdStrength() favours the weakest-defended",
    "   weighted by defence too: dividing by 1+defStrength() favours the weakest-defended",
    label="rvFrontierTargetFor comment",
)
do(
    "    const v = want/(1+sdStrength(s.id));",
    "    const v = want/(1+defStrength(s.id));",
    label="rvFrontierTargetFor code",
)

# ---------------------------------------------------------------------------
# 5) mnode "sdfort" class toggle
# ---------------------------------------------------------------------------
do(
    '    el.classList.toggle("sdfort",held&&!s.home&&sdLv(s.id)>0);',
    '    el.classList.toggle("sdfort",held&&!s.home&&dmodSlots(s.id).some(Boolean));',
    label="mnode sdfort class",
)

# ---------------------------------------------------------------------------
# 6) renderMap(): the "Defences" info row - interim placeholder, patch598
#    replaces this (and the whole odds/row/detail area) with the real UI.
# ---------------------------------------------------------------------------
OLD_DEFROW = """      rows+=`<div class="sysrow"><span>Defences</span><b${sdLv(s.id)?' style="color:var(--cy)"':''}>${
          sdLv(s.id)?("Level "+sdLv(s.id)+(sdTurrets(s.id)?" \\u00b7 "+sdTurrets(s.id)+"\\u00d7 turret":"")):"none"}</b></div>`;"""
NEW_DEFROW = """      rows+=`<div class="sysrow"><span>Defences</span><b${dmodSlots(s.id).some(Boolean)?' style="color:var(--cy)"':''}>${
          (()=>{ const n=dmodSlots(s.id).filter(Boolean).length; return n?(n+" of 3 fitted"):"none"; })()}</b></div>`;"""
do(OLD_DEFROW, NEW_DEFROW, label="renderMap defences info row")

# ---------------------------------------------------------------------------
# 7) renderMap(): the FORTIFY action block - interim placeholder (patch598
#    replaces this whole branch with the card row + detail strip + picker).
# ---------------------------------------------------------------------------
OLD_FORTIFY = """  } else {
    const dl=sdLv(s.id), ex=s.res?exoDef(s.res):null, dc=s.res?sdCost(s.id):sdCostOre(s);
    const maxed=dl>=SD_MAX, q=sdQueued(s.id);
    const dcAfford=s.res?exo(s.res)>=dc:S.ore>=dc;
    const ah = q
      ? `<button class="fortbtn" id="sysFort" disabled>Fortifying \\u00b7 <span class="fortcd"></span></button>
         <div class="sysrow" style="border:0;color:var(--dim)"><span>Building</span><b>level ${q.to}</b></div>`
      : `<button class="fortbtn" id="sysFort" ${(!maxed&&dcAfford)?"":"disabled"}>${
          maxed ? "DEFENCES AT MAXIMUM"
                : "FORTIFY \\u00b7 "+fmt(dc)+" "+(ex?ex.n.toUpperCase():RI("ore"))}</button>
        <div class="sysrow" style="border:0;color:var(--dim)"><span>${maxed?"Defences":"Next defence level"}</span>
          <b>${maxed ? "level "+SD_MAX
              : "+"+Math.round(SD_RATE*100)+"% reload \\u00b7 +"+Math.round(SD_HULL*100)+"% hull"
                +((dl+1)>=SD_AUTO&&sdTurrets(s.id)<Math.max(1,Math.floor((dl+1-SD_AUTO)/3)+1)?" \\u00b7 +1 turret":"")}</b></div>`;
    if(act.dataset.h!==ah){
      act.dataset.h=ah; act.innerHTML=ah;
      const fb=$("#sysFort");
      if(fb&&!q)fb.onclick=()=>{ if(buySysDef(s)){ render(); save() } };
    }
    if(q){
      const cd=act.querySelector(".fortcd");
      if(cd)cd.textContent=Math.max(0,Math.ceil((q.dueAt-Date.now())/1000))+"s";
    }
  }"""
NEW_FORTIFY = """  } else {
    /* patch597: the single FORTIFY button is retired with the old flat defence level -
       PLAN-defences.md's row-of-three-cards UI lands immediately next, in patch598.
       Interim placeholder so the sheet's action area does not reference removed
       functions in between the two patches. */
    const filled=dmodSlots(s.id).filter(Boolean).length;
    const ah=`<div class="sysrow" style="border:0;color:var(--dim)"><span>Defences</span><b>${filled} of 3 slots fitted</b></div>`;
    if(act.dataset.h!==ah){ act.dataset.h=ah; act.innerHTML=ah; }
  }"""
do(OLD_FORTIFY, NEW_FORTIFY, label="renderMap FORTIFY block")

# ---------------------------------------------------------------------------
# 8) startDefence(): DT setup now reads per-module levels, not one sdLv()
# ---------------------------------------------------------------------------
OLD_STARTDEF = """function startDefence(id){
  const th = (id===undefined) ? thq()[0] : thqAt(id);
  if(!th)return false;
  const isSab=th.kind==="sab";
  const s=SYSMAP[th.sysId]; if(!s||(!isSab&&!sysHeld(s.id))){ thqDrop(th.id); return false }
  const b=RVBEH[th.rv]||RVBEH.hel;
  bScale=Math.min(devicePixelRatio,2);
  /* home has no defence level of its own - "your best garrison falls back to defend
     home" (owner decision 8), same fallback holdOdds() uses. */
  const sdl=isSab?bestHeldSdLv():sdLv(s.id);
  DT={ rv:th.rv, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif:th.dif||1,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(th.rv), mixi:0, sab:isSab,
       qid:th.id, sd:sdl, hullMul:(1+SD_HULL*sdl)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:sdTurretsForLv(sdl)},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };
  $("#dName").textContent=(RIVALMAP[th.rv]?RIVALMAP[th.rv].n:"Hostiles")+" — "+s.n;
  $("#dMeta").textContent = sdl>0
    ? b.flav+"  \\u00b7  DEFENCES L"+sdl+(sdTurrets(s.id)?"  \\u00b7  "+sdTurrets(s.id)+" auto-turret"+(sdTurrets(s.id)>1?"s":""):"")
    : b.flav;
  $("#dRes").classList.remove("on");
  $("#defence").classList.add("on");
  dResize();                 /* before the first update, not after it */
  blip(120,.4,"sawtooth",.06);
  dirty=true;
  return true;
}"""
NEW_STARTDEF = """function startDefence(id){
  const th = (id===undefined) ? thq()[0] : thqAt(id);
  if(!th)return false;
  const isSab=th.kind==="sab";
  const s=SYSMAP[th.sysId]; if(!s||(!isSab&&!sysHeld(s.id))){ thqDrop(th.id); return false }
  const b=RVBEH[th.rv]||RVBEH.hel;
  bScale=Math.min(devicePixelRatio,2);
  /* home has no defences of its own - "your best garrison falls back to defend home"
     (owner decision 8), same fallback holdOdds() uses. Its tur/shd LEVELS (not just
     its strength number) fall back the same way, so the mini-game's own turret count
     and hull bonus match whichever system is actually helping. */
  const modSys=isSab?bestHeldDefSys():s;
  const turLv=modSys?dmodLv(modSys.id,"tur"):0, shdLv=modSys?dmodLv(modSys.id,"shd"):0;
  const sdl=isSab?bestHeldDefStrength():defStrength(s.id);
  DT={ rv:th.rv, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif:th.dif||1,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(th.rv), mixi:0, sab:isSab,
       qid:th.id, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };
  $("#dName").textContent=(RIVALMAP[th.rv]?RIVALMAP[th.rv].n:"Hostiles")+" — "+s.n;
  $("#dMeta").textContent = sdl>0
    ? b.flav+"  \\u00b7  DEFENCES "+dmodSummary(modSys?modSys.id:null)
    : b.flav;
  $("#dRes").classList.remove("on");
  $("#defence").classList.add("on");
  dResize();                 /* before the first update, not after it */
  blip(120,.4,"sawtooth",.06);
  dirty=true;
  return true;
}"""
do(OLD_STARTDEF, NEW_STARTDEF, label="startDefence")

# ---------------------------------------------------------------------------
# 9) lfOpenDefence(): same repoint, no sab case here (LF never targets home)
# ---------------------------------------------------------------------------
OLD_LFOPEN = """function lfOpenDefence(){
  if(!LF)return;
  const s=SYSMAP[LF.sysId];
  if(!s||!sysHeld(s.id)){ lfClear(); return }
  const rid=LF.rv, b=RVBEH[rid]||RVBEH.hel;
  const dif=1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012;   /* same formula rvMaybeThreat uses */
  bScale=Math.min(devicePixelRatio,2);
  const sdl=sdLv(s.id);
  DT={ rv:rid, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(rid), mixi:0,
       qid:-1, sd:sdl, hullMul:(1+SD_HULL*sdl)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:sdTurrets(s.id)},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };
  $("#dName").textContent=(RIVALMAP[rid]?RIVALMAP[rid].n:"Hostiles")+" \\u2014 "+s.n;
  $("#dMeta").textContent = sdl>0
    ? b.flav+"  \\u00b7  DEFENCES L"+sdl+(sdTurrets(s.id)?"  \\u00b7  "+sdTurrets(s.id)+" auto-turret"+(sdTurrets(s.id)>1?"s":""):"")
    : b.flav;
  $("#dRes").classList.remove("on");
  $("#defence").classList.add("on");
  dResize();
  blip(120,.4,"sawtooth",.06);
  lfClear();
  dirty=true;
}"""
NEW_LFOPEN = """function lfOpenDefence(){
  if(!LF)return;
  const s=SYSMAP[LF.sysId];
  if(!s||!sysHeld(s.id)){ lfClear(); return }
  const rid=LF.rv, b=RVBEH[rid]||RVBEH.hel;
  const dif=1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012;   /* same formula rvMaybeThreat uses */
  bScale=Math.min(devicePixelRatio,2);
  const sdl=defStrength(s.id), turLv=dmodLv(s.id,"tur"), shdLv=dmodLv(s.id,"shd");
  DT={ rv:rid, sysId:s.id, sysName:s.n, el:0, secs:b.secs, dif,
       hp:1, en:[], sh:[], fx:[], cool:0, spawnT:0.8, wave:0, kills:0, leaked:0,
       done:0, paused:false, mix:defMixFor(rid), mixi:0,
       qid:-1, sd:sdl, hullMul:(1+SHD_HULL_PER*shdLv)*Math.pow(1.10,lv(S.rs,"bul")),
       turrets:Array.from({length:turLv},(_,i)=>({cd:SD_AUTOEV*(0.35+i*0.3)})) };
  $("#dName").textContent=(RIVALMAP[rid]?RIVALMAP[rid].n:"Hostiles")+" \\u2014 "+s.n;
  $("#dMeta").textContent = sdl>0
    ? b.flav+"  \\u00b7  DEFENCES "+dmodSummary(s.id)
    : b.flav;
  $("#dRes").classList.remove("on");
  $("#defence").classList.add("on");
  dResize();
  blip(120,.4,"sawtooth",.06);
  lfClear();
  dirty=true;
}"""
do(OLD_LFOPEN, NEW_LFOPEN, label="lfOpenDefence")

# ---------------------------------------------------------------------------
# 10) lfPromptChoice(): sdl text
# ---------------------------------------------------------------------------
OLD_LFPROMPT = """  const sdl=sdLv(s.id);
  showModal(`<h3 style="color:#ffe9b8">Fleet Arriving \\u2014 ${s.n}</h3>
    <div style="font:700 11px/1.3 ui-monospace,monospace;color:${rv?rv.col:"var(--gd)"}">${rv?rv.n:"Hostiles"}</div>
    <p>${b.flav}</p>
    <p>${sdl>0
      ? "Level "+sdl+" defences are up, but this is a live strike \\u2014 walk away and the system will be lost, unless you defend it yourself."
      : "No defences here \\u2014 walk away and the system will be lost, unless you defend it yourself."}</p>"""
NEW_LFPROMPT = """  const sdl=defStrength(s.id);
  showModal(`<h3 style="color:#ffe9b8">Fleet Arriving \\u2014 ${s.n}</h3>
    <div style="font:700 11px/1.3 ui-monospace,monospace;color:${rv?rv.col:"var(--gd)"}">${rv?rv.n:"Hostiles"}</div>
    <p>${b.flav}</p>
    <p>${sdl>0
      ? "Defences are up ("+dmodSummary(s.id)+"), but this is a live strike \\u2014 walk away and the system will be lost, unless you defend it yourself."
      : "No defences here \\u2014 walk away and the system will be lost, unless you defend it yourself."}</p>"""
do(OLD_LFPROMPT, NEW_LFPROMPT, label="lfPromptChoice")

# ---------------------------------------------------------------------------
# 11) defRate(): the old generic reload-speed-per-defence-level term is gone -
#     no module in the plan's table grants a reload bonus (tur -> turrets, min
#     -> detonation (Run3), shd -> hull, sen -> information, han -> Run3
#     stationed fire) - see this patch's HANDOVER entry for this deviation.
# ---------------------------------------------------------------------------
do(
    'function defRate(){ return DEF_RATE*(1+0.14*(hardpoints()-2))*(1+SD_RATE*((DT&&DT.sd)||0)) }',
    'function defRate(){ return DEF_RATE*(1+0.14*(hardpoints()-2)) }',
    label="defRate",
)

# ---------------------------------------------------------------------------
# 12) holdOdds(): sdStrength -> defStrength, plus an optional strOverride so
#     the sheet (patch598) can ask "what would this be WITHOUT module X" using
#     this exact function rather than a second formula.
# ---------------------------------------------------------------------------
OLD_HOLDODDS = """function holdOdds(th){
  if(!th)return 0;
  const b=RVBEH[th.rv]||RVBEH.hel;
  let power;
  if(th.kind==="sab"){
    power=1+heldSystems().reduce((m,s)=>Math.max(m,sdStrength(s.id)),0);
  } else {
    const s=SYSMAP[th.sysId]; if(!s)return 0;
    power=1+sdStrength(s.id);
  }
  const weight=(th.dif||1)*1.55*(b.hard||1);
  return Math.max(0.05, Math.min(0.95, power/(power+weight)));
}"""
NEW_HOLDODDS = """function holdOdds(th,strOverride){
  if(!th)return 0;
  const b=RVBEH[th.rv]||RVBEH.hel;
  let power;
  if(th.kind==="sab"){
    power=1+(strOverride!==undefined?strOverride:heldSystems().reduce((m,s)=>Math.max(m,defStrength(s.id)),0));
  } else {
    const s=SYSMAP[th.sysId]; if(!s)return 0;
    power=1+(strOverride!==undefined?strOverride:defStrength(s.id));
  }
  const weight=(th.dif||1)*1.55*(b.hard||1);
  return Math.max(0.05, Math.min(0.95, power/(power+weight)));
}"""
do(OLD_HOLDODDS, NEW_HOLDODDS, label="holdOdds")

# ---------------------------------------------------------------------------
# 13) renderThreat(): sab bestSd + non-sab dl, repointed
# ---------------------------------------------------------------------------
do(
    "      const bestSd=bestHeldSdLv();",
    "      const bestSd=bestHeldDefStrength();",
    label="renderThreat sab bestSd",
)
OLD_RT_DL = """    const dl=sdLv(s.id);
    return `<div class="thrc${soon?" soon":""}" data-q="${th.id}">
      <h5>INCOMING — ${s.n}<span class="thrt">${thqClock(th.t)} left</span></h5>
      <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>
      <p>${b.flav} Hold the system for ${b.secs} seconds. Your shots take time to arrive — aim ahead of them.</p>
      <button class="thrgo" data-q="${th.id}">DEFEND ${s.n.toUpperCase()}</button>
      <button class="thrhold" data-q="${th.id}">HOLD THE LINE WITHOUT ME · ${od}%</button>
      <div class="thrnote">${dl
        ? "Level "+dl+" defences. Fighting it yourself pays roughly twice as much, and only you can lose the system."
        : "No defences here \\u2014 the garrison will struggle. Fortify it on the map, or fly it yourself."}
        When the clock runs out the garrison fights it for you.</div>
      </div>`;"""
NEW_RT_DL = """    const dl=defStrength(s.id);
    return `<div class="thrc${soon?" soon":""}" data-q="${th.id}">
      <h5>INCOMING — ${s.n}<span class="thrt">${thqClock(th.t)} left</span></h5>
      <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>
      <p>${b.flav} Hold the system for ${b.secs} seconds. Your shots take time to arrive — aim ahead of them.</p>
      <button class="thrgo" data-q="${th.id}">DEFEND ${s.n.toUpperCase()}</button>
      <button class="thrhold" data-q="${th.id}">HOLD THE LINE WITHOUT ME · ${od}%</button>
      <div class="thrnote">${dl
        ? dmodSummary(s.id)+" fitted. Fighting it yourself pays roughly twice as much, and only you can lose the system."
        : "No defences here \\u2014 the garrison will struggle. Fortify it on the map, or fly it yourself."}
        When the clock runs out the garrison fights it for you.</div>
      </div>`;"""
do(OLD_RT_DL, NEW_RT_DL, label="renderThreat non-sab dl")

# ---------------------------------------------------------------------------
# 14) dmodComplete() replaces sdqComplete() at both call sites (tick(), offlineReport())
# ---------------------------------------------------------------------------
do("  sdqComplete();", "  dmodComplete();", count=2, label="sdqComplete call sites")

# ---------------------------------------------------------------------------
# 15) minefield consumption - "spent when an attack on that system resolves,
#     whichever path (player-flown defence, delegated hold, offline expiry)".
# ---------------------------------------------------------------------------
do(
    """function endDefence(how){
  if(!DT||DT.done)return; DT.done=1;
  const s=SYSMAP[DT.sysId], b=RVBEH[DT.rv]||RVBEH.hel, rv=RIVALMAP[DT.rv];""",
    """function endDefence(how){
  if(!DT||DT.done)return; DT.done=1;
  const s=SYSMAP[DT.sysId], b=RVBEH[DT.rv]||RVBEH.hel, rv=RIVALMAP[DT.rv];
  if(s)dmodConsumeMines(s.id);   /* player-flown resolution - spent whether it fired or not */""",
    label="endDefence mine consumption",
)
do(
    """function holdResolve(th, auto, quiet, offline){
  if(!th)return null;
  const isSab=th.kind==="sab";
  const s=SYSMAP[th.sysId]; if(!s)return null;
  if(!isSab && !sysHeld(s.id))return null;
  const b=RVBEH[th.rv]||RVBEH.hel, rv=RIVALMAP[th.rv];""",
    """function holdResolve(th, auto, quiet, offline){
  if(!th)return null;
  const isSab=th.kind==="sab";
  const s=SYSMAP[th.sysId]; if(!s)return null;
  if(!isSab && !sysHeld(s.id))return null;
  if(!isSab)dmodConsumeMines(s.id);   /* delegated hold or offline expiry - either resolution */
  const b=RVBEH[th.rv]||RVBEH.hel, rv=RIVALMAP[th.rv];""",
    label="holdResolve mine consumption",
)
do(
    """function lfOccupy(sysId, rid){
  const s=SYSMAP[sysId];
  if(!s||!sysHeld(s.id)||heldSystems().length<=1)return false;
  return occupySystem(s.id, rid);
}""",
    """function lfOccupy(sysId, rid){
  const s=SYSMAP[sysId];
  if(!s||!sysHeld(s.id)||heldSystems().length<=1)return false;
  dmodConsumeMines(sysId);   /* the live-fleet offline-occupy path also resolves an attack */
  return occupySystem(s.id, rid);
}""",
    label="lfOccupy mine consumption",
)
# the consumption helper itself, placed right next to defStrength() so the whole
# module-effects family reads together.
do(
    "function bestHeldDefStrength(){",
    """/* Minefield: one use, spent the moment an attack on this system resolves - whichever
   road it resolves by (player-flown defence, delegated hold, offline expiry). Spent
   whether it fired or not; a reload/save afterwards never restores it (it is ordinary
   persisted S.def state, sanitised like any other slot in adopt()). */
function dmodConsumeMines(sysId){
  const d=S.def&&S.def[sysId]; if(!d||!Array.isArray(d.s))return;
  for(const slot of d.s){
    if(slot&&slot.m==="min"&&slot.armed&&!slot.q){ slot.armed=false; dirty=true; }
  }
}
function bestHeldDefStrength(){""",
    label="dmodConsumeMines def",
)

# ---------------------------------------------------------------------------
# 16) __SD export block
# ---------------------------------------------------------------------------
OLD_EXPORT = """  SD_MAX,SD_AUTO,SD_RATE,SD_HULL,sdLv,sdCost,sdCostOre,sdTurrets,sdTurretsForLv,sdStrength,bestHeldSdLv,buySysDef,defRate,defAutoFire,
  SD_BUILD_BASE,SD_BUILD_PER,sdQueued,sdBuildSecs,sdqComplete,"""
NEW_EXPORT = """  SD_C0,SD_CG,SD_AUTOEV,SD_BUILD_BASE,SD_BUILD_PER,DEF_STR,SHD_HULL_PER,DEF_MODULES,
  dmodSlots,dmodSlot,dmodEnsure,dmodBusy,dmodCost,dmodCostOre,dmodPrice,dmodBuildSecs,dmodComplete,
  dmodBuild,dmodUpgrade,dmodRearm,dmodSwap,dmodLv,dmodSummary,dmodConsumeMines,
  defStrength,bestHeldDefStrength,bestHeldDefSys,defRate,defAutoFire,"""
do(OLD_EXPORT, NEW_EXPORT, label="__SD export")

# ---------------------------------------------------------------------------
# BUILD bump
# ---------------------------------------------------------------------------
do("const BUILD=595;", "const BUILD=597;", label="BUILD bump")

open(PATH, "w", encoding="utf-8").write(h)
print("patch597 applied OK")
