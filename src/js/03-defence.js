/* ============================ system defences ============================ */
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
   guidance:"Best against Helion \u2014 many light hulls, fast.",
   desc:"One automated turret per level, firing on its own in the mini-game. Strongest against a swarm of light, numerous hulls." },
 min:{ id:"min", n:"Minefield", maxLv:1, oneUse:true,
   guidance:"One use \u2014 spent whether it fires or not.",
   desc:"Breaks the first wave as it arrives. One use: spent the moment an attack on this system resolves, however it resolves \u2014 rearm it after every fight." },
 shd:{ id:"shd", n:"Shield Array", maxLv:3, oneUse:false,
   guidance:"Best against the Covenant \u2014 heavy, slow hulls.",
   desc:"Raises this system's own hull in the mini-game as well as its garrison strength. Strongest against a small number of heavy, slow attackers." },
 sen:{ id:"sen", n:"Sensor Mast", maxLv:1, oneUse:false,
   guidance:"Information, not firepower.",
   desc:"Extends this system's warning window and names exactly who is coming and how they fight, including what rearming now would do to the odds. Useless once a fleet is already inbound \u2014 fit it before you need it." },
 han:{ id:"han", n:"Hangar", maxLv:1, oneUse:false,
   guidance:"Best against the Covenant \u2014 stations fleet, not firepower.",
   desc:"Stations part of your fleet at this system, fighting beside the garrison and the automated defences. The more (and the heavier) you station, the stronger this gets \u2014 open STATION FLEET to assign hulls." }
};
/* PLAN-defences.md Run 3 (patch600): Hangar stationing. S.han[sysId]=[n0,n1,n2] -
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
/* PLAN-fleets follow-up (shipped with governors): S.han[sysId] carries a `from` -
   the fleet id its hulls count against for capacity purposes - alongside the counts
   themselves, now {n:[n0,n1,n2], from:fleetId} rather than a bare array. hanFleet()
   stays the one true reader of the counts (n) - every existing caller (hanCount,
   hanDPS, hanHP, render, combat) is unaffected by the shape change underneath it. */
function hanFleet(id){ const h=S.han&&S.han[id]; const n=h&&h.n; return (Array.isArray(n)&&n.length===3)?n:[0,0,0]; }
function hanFrom(id){ const h=S.han&&S.han[id]; return (h&&h.from>0)?h.from:1; }
function hanCount(id){ const h=hanFleet(id); return h[0]+h[1]+h[2]; }
function hanLeft(id){ return Math.max(0,HAN_CAP-hanCount(id)); }
function hanDPS(id){ const h=hanFleet(id); let d=0; for(let i=0;i<SHIPS.length;i++)d+=h[i]*SHIPS[i].dps; return d; }
function hanHP(id){  const h=hanFleet(id); let d=0; for(let i=0;i<SHIPS.length;i++)d+=h[i]*SHIPS[i].hp;  return d; }
/* every hull stationed ANYWHERE, summed once for shipPower()'s own cap accounting -
   see the header note above. Empire-wide, unaffected by per-fleet attribution. */
function hanTotalPower(){
  let p=0;
  if(S.han)for(const id in S.han){ const n=hanFleet(id);
    for(let i=0;i<SHIPS.length;i++)p+=(n[i]||0)*SHIPS[i].pw; }
  return p;
}
/* PLAN-fleets follow-up: "hangar hulls count against the fleet they were stationed
   from" - summed across every system whose hangar entry names this fleet as `from`.
   Old entries (pre-follow-up saves, sanitised in adopt()) default to Fleet 1. */
function hanPowerFor(fleetId){
  let p=0;
  if(S.han)for(const id in S.han){ if(hanFrom(id)!==fleetId)continue;
    const n=hanFleet(id); for(let i=0;i<SHIPS.length;i++)p+=(n[i]||0)*SHIPS[i].pw; }
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
  const f=curFleet();
  n=Math.min(n, f.sh[hullIdx]||0, hanLeft(sysId));
  if(n<=0)return false;
  f.sh[hullIdx]-=n;
  const arr=hanFleet(sysId).slice(); arr[hullIdx]=(arr[hullIdx]||0)+n;
  if(!S.han||typeof S.han!=="object")S.han={};
  /* PLAN-fleets follow-up: the whole entry's `from` is whichever fleet most
     recently stationed into it - simplest reading of "the fleet they were
     stationed from" for one hangar shared by one fleet at a time in the normal
     flow (you can only station from curFleet()). Re-stationing from a DIFFERENT
     fleet while hulls from an earlier one are still here reattributes the whole
     entry - an edge case the plan does not spell out further; accepted rather
     than tracking per-class attribution for one hangar. */
  S.han[sysId]={n:arr, from:f.id};
  dirty=true; return true;
}
/* recalls n hulls of class hullIdx back into the fleet - the first fleet already
   sitting at this system, else the fleet at home, else Fleet 1 (PLAN-fleets run 1
   decision 6) - NOT necessarily the `from` fleet; capacity accounting simply follows
   wherever the hulls physically end up, same as it does for a fleet that was never
   stationed at all. n omitted (or too large) recalls everything of that class
   stationed. */
function recallHan(sysId,hullIdx,n){
  const arr=hanFleet(sysId).slice(); const have=arr[hullIdx]||0;
  n = n===undefined ? have : Math.min(Math.max(0,Math.floor(n)), have);
  if(n<=0)return false;
  arr[hullIdx]=have-n;
  if(!S.han||typeof S.han!=="object")S.han={};
  S.han[sysId]={n:arr, from:hanFrom(sysId)};
  const tgt = fleetAtSys(sysId) || fleets().find(fl=>fl.at==="home") || fleet(1);
  tgt.sh[hullIdx]=(tgt.sh[hullIdx]||0)+n;
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
  toast(s.n+" building "+def.n+" \u2014 "+dur+"s","g");
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
  toast(s.n+" upgrading "+def.n+" \u2014 "+dur+"s","g");
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
  toast(s.n+" rearming "+def.n+" \u2014 "+dur+"s","g");
  dirty=true; return true;
}
/* Swapping refunds half of what building this slot up to its CURRENT level actually
   cost (summed over dmodPrice(s,0..lv-1)), then empties the slot - the replacement is
   a separate BUILD action (patch598's picker), so this never has to guess one. */
function dmodSwap(s,slotIdx){
  if(!s||s.home||!sysHeld(s.id))return false;
  const d=dmodEnsure(s.id), slot=d.s[slotIdx]; if(!slot||slot.q)return false;
  const def=DEF_MODULES[slot.m];
  if(slot.m==="han")recallHanAll(s.id);   /* no Hangar left here, so nothing may stay stationed */
  let spent=0; for(let L=0;L<Math.max(1,slot.lv);L++)spent+=dmodPrice(s,L);
  const refund=Math.floor(spent*0.5);
  if(refund>0){ if(s.res)S.exo[s.res]=(exo(s.res)||0)+refund; else S.ore+=refund; }
  d.s[slotIdx]=null;
  toast(s.n+" \u2014 "+(def?def.n:"module")+" removed"+(refund?", "+refund+" refunded":""),"g");
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
    if(slot.m==="han"){ parts.push(def.n.toUpperCase()+" \u00b7 "+hanCount(id)+" SHIPS"); continue; }
    parts.push(def.n.toUpperCase()+" L"+(slot.lv||1));
  }
  return parts.length?parts.join(" \u00b7 "):"none fitted";
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
    if(slot.m==="han"){ str+=hanStrength(id); continue }
    str += (DEF_STR[slot.m]||0) * Math.max(1,slot.lv||1);
  }
  return str + lv(S.rs,"bat")*0.42;
}
/* sabotage targets home, which never carries defences of its own (S.def has no "home"
   key - see adopt()'s S.def sanitiser) - "your best garrison falls back to defend
   home" (owner decision 8), so it borrows the strongest held system's own defStrength
   instead. 0 with nothing held, same as an undefended system. */
/* Minefield: one use, spent the moment an attack on this system resolves - whichever
   road it resolves by (player-flown defence, delegated hold, offline expiry). Spent
   whether it fired or not; a reload/save afterwards never restores it (it is ordinary
   persisted S.def state, sanitised like any other slot in adopt()). */
function dmodConsumeMines(sysId){
  const d=S.def&&S.def[sysId]; if(!d||!Array.isArray(d.s))return;
  for(const slot of d.s){
    if(slot&&slot.m==="min"&&slot.armed&&!slot.q){ slot.armed=false; dirty=true; }
  }
}
/* Sensor Mast: the one gate for every piece of information the module unlocks -
   the longer telegraph, the doctrine line, and the rearm/upgrade preview all read
   this same function, so "without one, none of it appears" cannot drift into three
   different checks that disagree. */
function hasSensorMast(id){ return dmodLv(id,"sen")>0 }
/* the single best RIGHT NOW rearm/upgrade across a system's three slots (only
   these two actions - the plan's own wording - never a fresh BUILD), gated on
   being affordable this instant so the preview never promises a move the player
   cannot actually make. Returns null when nothing qualifies. */
function defBestPreview(s){
  const slots=dmodSlots(s.id);
  let best=null;
  for(let i=0;i<slots.length;i++){
    const slot=slots[i]; if(!slot||slot.q)continue;
    const def=DEF_MODULES[slot.m]; if(!def)continue;
    let verb=null;
    if(def.oneUse && !slot.armed) verb="Rearming";
    else if(!def.oneUse && slot.lv<def.maxLv) verb="Upgrading";
    if(!verb)continue;
    const price=dmodPrice(s,slot.lv);
    const afford=s.res?exo(s.res)>=price:S.ore>=price;
    if(!afford)continue;
    const gain=DEF_STR[slot.m]||0;
    if(!best||gain>best.gain) best={verb,gain,slot:i};
  }
  return best;
}
function bestHeldDefStrength(){ let best=0; for(const s of heldSystems())best=Math.max(best,defStrength(s.id)); return best }
/* the actual held system bestHeldDefStrength() just measured - startDefence()'s sab
   branch borrows ITS tur/shd LEVELS for the mini-game (turret count / hull mult),
   same fallback in spirit as the old bestHeldSdLv()-driven DT setup. */
function bestHeldDefSys(){
  let best=null, bv=-1;
  for(const s of heldSystems()){ const v=defStrength(s.id); if(v>bv){ bv=v; best=s } }
  return best;
}
/* STAGE 2: the entire "occupation" transition. Deliberately tiny - it sets one flag
   and one timestamp and touches nothing else, which is the whole point: S.sys[id]
   is never read, written or deleted here, so whatever was built stays built, and
   S.exo is never touched, so nothing is haircut. Every caller that used to delete
   S.sys[id] and/or write S.lost[id] on a lost defence now calls this instead - see
   HANDOVER for the endDefence()/holdResolve() reconciliation this replaces. */
function occupySystem(id, rid){
  const s=SYSMAP[id]; if(!s||s.home||!sysState(id))return false;
  if(!S.occ||typeof S.occ!=="object")S.occ={};
  S.occ[id]=rid;
  if(!S.occAt||typeof S.occAt!=="object")S.occAt={};
  S.occAt[id]=Date.now();
  /* PLAN-defences.md: "keeps stationed ships out of the fleet until retaken - or
     returns them; pick the reading that is kindest". Chosen: returns them, right
     now - a system near the frontier might never be retaken, and losing real fleet
     over that is a harsher penalty than the plan's own "buildings intact" framing
     for everything else occupySystem() touches. */
  recallHanAll(id);
  queueNotice("vega:firstLoss");
  return true;
}
/* the "comeback punch" from 2D: a system freshly taken is dug in loosely, not
   fortified - assaultTarget() multiplies its difficulty by this while the window
   is open. A flat time-since-timestamp check rather than a decrementing counter,
   so it costs nothing to keep and needs no tick of its own - the same shape misFxUntil
   uses for exactly the same reason (see HANDOVER, "Claiming a contract is a moment"). */
function occWeakMul(id){
  const at=(S.occAt&&S.occAt[id])||0; if(!at)return 1;
  return (Date.now()-at)<OCC_WEAKEN_SECS*1000 ? OCC_WEAKEN_MULT : 1;
}
/* buySysDef() (single flat defence level) is retired - dmodBuild()/dmodUpgrade()/
   dmodRearm()/dmodSwap() above do its job per-slot, per-module. PLAN-defences.md Run 2. */
/* Each faction's reach, as a translucent wash. One soft blob per system they hold;
   overlaps merge into a region, so no hull maths and no second source of truth - it is
   drawn from SYS like everything else on this map. */
function drawTerritory(svg,sec){
  const NS="http://www.w3.org/2000/svg";
  const defs=document.createElementNS(NS,"defs");
  const g=document.createElementNS(NS,"g"); g.setAttribute("class","terr");
  for(const rv of RIVALS){
    const mine=SYS.filter(s=>s.sec===sec && s.owner===rv.id);
    if(!mine.length)continue;
    /* one gradient per faction, reused by every blob it owns */
    const grad=document.createElementNS(NS,"radialGradient");
    grad.id="tg-"+rv.id;
    const inner=document.createElementNS(NS,"stop");
    inner.setAttribute("offset","0%");
    inner.setAttribute("stop-color",rv.col); inner.setAttribute("stop-opacity","0.20");
    const mid=document.createElementNS(NS,"stop");
    mid.setAttribute("offset","55%");
    mid.setAttribute("stop-color",rv.col);
    mid.setAttribute("stop-opacity","0.10");
    const outer=document.createElementNS(NS,"stop");
    outer.setAttribute("offset","100%");
    outer.setAttribute("stop-color",rv.col); outer.setAttribute("stop-opacity","0");
    grad.appendChild(inner); grad.appendChild(mid); grad.appendChild(outer);
    defs.appendChild(grad);
    let cx=0, cy=0;
    for(const s of mine){
      const c=document.createElementNS(NS,"circle");
      c.setAttribute("cx",s.sx); c.setAttribute("cy",s.sy);
      /* deeper systems claim a wider reach, so the far map reads as properly theirs */
      c.setAttribute("r", 13+s.ring*1.6);
      c.setAttribute("fill","url(#tg-"+rv.id+")");
      c.dataset.rv=rv.id; c.dataset.s=s.id;
      g.appendChild(c);
      cx+=s.sx; cy+=s.sy;
    }
    /* push the label out past the centroid, along the bearing from the map centre:
       the middle of a radial map is the busiest place on it */
    let mx=cx/mine.length, my=cy/mine.length;
    let vx=mx-50, vy=my-50;
    const len=Math.hypot(vx,vy)||1;
    mx=50+vx/len*Math.min(46,len+13);
    my=50+vy/len*Math.min(46,len+13);
    /* and step it off whatever it landed on. A faction whose systems ring the whole map
       has no bearing that avoids the crowd, so solve it locally instead. */
    for(let pass=0; pass<6; pass++){
      let near=null, nd=1e9;
      for(const s of sysInSec(sec)){
        const d=Math.hypot(s.sx-mx, s.sy-my);
        if(d<nd){ nd=d; near=s }
      }
      if(!near||nd>=8)break;
      let ax=mx-near.sx, ay=my-near.sy;
      const al=Math.hypot(ax,ay)||1;
      mx=Math.max(10,Math.min(90, mx+ax/al*4.5));
      my=Math.max(6, Math.min(94, my+ay/al*4.5));
    }
    const lab=document.createElementNS(NS,"text");
    lab.setAttribute("class","terrlab");
    lab.setAttribute("x",mx.toFixed(1));
    lab.setAttribute("y",my.toFixed(1));
    lab.setAttribute("fill",rv.col);
    lab.dataset.rv=rv.id;
    lab.textContent=rv.n.toUpperCase();
    g.appendChild(lab);
  }
  svg.appendChild(defs); svg.appendChild(g);
}
/* A blob belongs to whoever holds the system NOW, so taking one shrinks their border. */
/* a small triangle, interpolated between home and the target on the SAME 0..100
   viewBox buildMap()'s lane <line>s use, so it sits exactly on the lane. One polygon
   node, created once and moved via `transform` every tick - never recreated, so
   there is nothing here for the churn-guard rule to catch (no click handler either). */
function renderTripMarker(){
  const svg=$("#mapLinks"); if(!svg)return;
  let mk=svg.querySelector("#tripMk");
  const t=S.trip;
  if(!t){ if(mk)mk.remove(); return }
  const s=SYSMAP[t.sysId], home=SYSMAP.home;
  if(!s||!home||s.sec!==mapSec){ if(mk)mk.remove(); return }  /* drawn on the target's OWN page only - see renderMapEdge() for the other-page indicator */
  const total=Math.max(1,t.dueAt-t.t0);
  const prog=Math.max(0,Math.min(1,(Date.now()-t.t0)/total));
  /* home is always in Core (sec 0); a target elsewhere is entered from this page's
     left edge, the mirror of the exit lane every earlier sector leaves from its
     right edge - so the marker's start point is the lane entrance, not home itself. */
  const hx = home.sec===s.sec ? home.sx : 0;
  const hy = home.sec===s.sec ? home.sy : 50;
  const x=hx+(s.sx-hx)*prog, y=hy+(s.sy-hy)*prog;
  const ang=Math.atan2(s.sy-hy, s.sx-hx)*180/Math.PI+90;
  if(!mk){
    mk=document.createElementNS("http://www.w3.org/2000/svg","polygon");
    mk.id="tripMk"; mk.setAttribute("points","0,-1.7 1.2,1.3 -1.2,1.3");
    mk.setAttribute("fill","#ffd166"); mk.setAttribute("stroke","#04050d");
    mk.setAttribute("stroke-width","0.3");
    svg.appendChild(mk);
  }
  mk.setAttribute("transform","translate("+x.toFixed(2)+","+y.toFixed(2)+") rotate("+ang.toFixed(1)+")");
}
function refreshTerritory(){
  const svg=$("#mapLinks"); if(!svg)return;
  const seen={};
  svg.querySelectorAll(".terr circle").forEach(c=>{
    const s=SYSMAP[c.dataset.s];
    const theirs=!!(s&&sysOwner(s)===c.dataset.rv);
    c.style.display=theirs?"":"none";
    if(theirs)seen[c.dataset.rv]=(seen[c.dataset.rv]||0)+1;
  });
  svg.querySelectorAll(".terr text").forEach(t=>{
    t.style.display=seen[t.dataset.rv]?"":"none";
  });
}
/* the garrison fight. A mixed defensive formation, scaled by how deep the system is. */
function assaultTarget(s){
  const r=RIVALMAP[sysOwner(s)];
  /* a system taken off you has no entry in GARRISON, so give it a defence from its depth
     - otherwise winning it back would be trivially easier than taking it was. STAGE 2:
     an occupied system (S.occ) never had a static .def either - same fix, same reason. */
  if(!s.def&&S.lost&&S.lost[s.id])s.def=2+s.ring*1.9;
  if(!s.def&&S.occ&&S.occ[s.id])s.def=2+s.ring*1.9;
  /* A system that has changed hands has been dug into by whoever holds it now. It also
     has to answer for its CURRENT owner, not the one in the table - otherwise beating a
     Helion garrison on ground they took from Vasht would anger Vasht. */
  const now=sysOwner(s), captured=!!now && now!==s.owner;
  let dif=(s.def||2)*(captured?1.25:1);
  /* STAGE 2 (2D): a freshly occupied system is dug in loosely, not fortified - the
     comeback punch the design gate asks for. occWeakMul() is 1 once the window has
     passed, so this is a no-op for ground that has sat occupied a while. */
  if(S.occ&&S.occ[s.id])dif*=occWeakMul(s.id);
  return { ti:3, name:(r?r.n:"Garrison")+" \u2014 "+s.n,
    en:Math.max(3,2+Math.round(s.ring*1.6)), dif,
    secs:32+s.ring*8,
    dmg:0.70+s.ring*0.10, sysId:s.id, rival:now, arch:s.arch||"swarm" };
}
function canAssault(s,f){
  f=f||curFleet();
  return sysContested(s) && level()>=s.lvl && fleetDPS(f)>0 && f.hp>=0.15;
}
/* PATCH 4 (2026-09-10): travel time. A launched assault sits in S.trip while the
   fleet is in flight/waiting - it is not a fight yet, just a state the Map panel
   renders around. Only ever one at a time. */
const TRIP_BASE=25, TRIP_PER_RING=15,     /* travel seconds = base + per-ring*ring */
      TRIP_WAIT_MS=10*60*1000;            /* how long an arrived fleet waits for ENGAGE */
function tripSecsFor(ring){ return TRIP_BASE+TRIP_PER_RING*(ring||1) }
function tripFor(id){ return (S.trip&&S.trip.sysId===id)?S.trip:null }
function tripArrived(t){ return !!t && Date.now()>=t.dueAt }
function launchAssault(s){
  if(S.trip)return false;
  if(!canAssault(s))return false;
  const secs=tripSecsFor(s.ring);
  S.trip={ sysId:s.id, kind:"assault", t0:Date.now(), dueAt:Date.now()+secs*1000 };
  toast("Fleet launched toward "+s.n+" \u2014 "+secs+"s out","y");
  blip(300,.18,"triangle",.05);
  dirty=true; return true;
}
/* the 10-minute return-without-fighting clock. `quiet` (offlineReport()) suppresses
   the toast - the offline modal already speaks for whatever happened while the tab
   was shut, same reasoning holdResolve()'s own `quiet` param uses. */
function tripTick(quiet){
  const t=S.trip; if(!t)return;
  const s=SYSMAP[t.sysId];
  if(!s){ S.trip=null; dirty=true; return }
  if(Date.now()>=t.dueAt+TRIP_WAIT_MS){
    S.trip=null;
    if(!quiet)toast("The fleet waited at "+s.n+" and turned back","y");
    dirty=true;
  }
}
/* PATCH 1 (v3 tuning): the development/extraction mechanic (dev level, sysYield(),
   devCost(), developSystem()) is gone entirely. A system's exotic output is now just
   the sum of its own kind-ladder rows - same shape as rate() summing the ore ladder,
   ladderRate() itself unchanged (GENS[gi].r already means "this system's exotic,
   units/s" for a kind!=="ore" row as of patch437). See HANDOVER for the tuning this
   was calibrated against. */
function sysExoRate(id){
  let r=0;
  for(const gi of sysLadder(id)) if(GENS[gi].kind!=="ore") r+=ladderRate(id,gi);
  /* Loom Resonance ("\u00d7N exotic yield everywhere") stays its OWN multiplier on top
     of the full ladderRate stack (globalMul included) rather than folding into
     globalMul itself - it is described as an exotic-only booster, and keeping it
     separate means buying it can never do anything to the ore side by accident. */
  /* pj1 (patch584): same reasoning as Loom above - its own multiplier, not folded
     into globalMul(), so it can never touch ore either. */
  return r*Math.pow(1.35,xlv("loom"))*(nexLv("pj1")?PJ1_MUL:1);
}
/* kept its exact old name/signature (exotic id -> total rate across the map) on
   purpose - every existing caller (programme cards, the exotic strip, tick()) reads
   from here already and needs no changes at all. */
function exoRate(id){ let r=0; for(const s of SYS) if(s.res===id) r+=sysExoRate(s.id); return r }
function heldSystems(){ return SYS.filter(s=>!s.home&&sysHeld(s.id)) }
/* PLAN-pacing: the vega:project beat fires on the first ring-3-or-higher CLAIM, not
   the first Node landing (S.en>0) - a player claiming a Frontier system should be
   told what it produces before the first tick of it shows up. */
function hasRing3Held(){ return heldSystems().some(s=>s.ring>=3) }
/* ---------------- Exotic Nodes (patch582) ----------------
   Owner decision 3: no new verb - Nodes just trickle from held ring-3/4 systems,
   regardless of what they mine. Kept OUT of the EXO/S.exo machinery on purpose
   (see the patch header) so Market can never list them without extra guarding. */
const EN_RING3=4, EN_RING4=12;   /* TUNING-PENDING: Nodes/hour per held system, by ring */
const EN_COL="#5affc2";         /* TUNING-PENDING: own colour, distinct from all 4 EXO cols */
function enRate(){
  let r3=0,r4=0;
  for(const s of heldSystems()){ if(s.ring===3)r3++; else if(s.ring===4)r4++; }
  return (r3*EN_RING3+r4*EN_RING4)/3600;
}
/* holding a system helps even when you do not need what it produces */
function sysBonus(){ return 1+0.03*heldSystems().length }
/* STAGE 2: the frontier rule. A held system is reachable by a rival only if it
   borders ground that already is not fully yours - same ring or one ring either
   side of a contested system (garrison, ambient, rival-held, or now-occupied: all
   of these already answer sysContested() true, so nothing extra has to be listed
   here for "occupied" to count as a border too). Ring adjacency, not map (x,y)
   distance - chosen as the simpler of the two options the plan explicitly allows,
   and one that cannot disagree with the map's own idea of "deeper" since ring IS
   that idea. Home is structurally excluded because heldSystems() already excludes
   it - there is no path through this function that can ever return it. */
function sysIsFrontier(s){
  if(!s||s.home||!sysHeld(s.id))return false;
  for(const t of SYS){
    if(t===s||t.home)continue;
    if(Math.abs(t.ring-s.ring)>1)continue;
    if(sysContested(t))return true;
  }
  return false;
}
function frontierSystems(){ return heldSystems().filter(sysIsFrontier); }
function claimSystem(s){
  if(!s||s.home||sysHeld(s.id)||sysOwner(s))return false;
  if(level()<s.lvl||S.ore<s.cost)return false;
  S.ore-=s.cost;
  if(!S.sys||typeof S.sys!=="object")S.sys={};
  S.sys[s.id]={b:{}};
  grantXp("cl1", XPV.claim1, "First system claimed");
  grantXp("cl:"+s.id, XPV.claim[s.ring]||0, "Claimed "+s.n);
  if(s.dm>0){ S.dm+=s.dm; S.dmAll+=s.dm }
  blip(660,.35,"sine",.06); setTimeout(()=>blip(990,.3,"sine",.05),110);
  toast("Claimed "+s.n+" \u2014 +"+fmt(s.dm)+" Dark Matter","y");
  queueNotice("vega:firstClaim");
  /* patch627 (PLAN-page.md decision 3): claiming opens the claimed system's page
     outright - S.msel is enough, syncSysPage()'s own derivation (called from the
     render() right below) zooms it since it is now held. No second tap. */
  S.msel=s.id;
  dirty=true; render(); return true;
}
/* an exotic tier only appears once you hold a system that produces it */
function exoUnlocked(id){ return exoRate(id)>0 }
function exoCostOf(i,k){ const g=GENS[i]; return g.exo ? g.exoC*k : 0 }
/* cumulative XP needed to be level n (level 1 is free, n past LVMAX is unreachable) */
function xpNeed(n){ return n<=1 ? 0 : (n<=LVMAX ? LVXP[n] : Infinity) }
/* what your XP entitles you to; the claim flow (level()/pendingLevels()/takeLevel())
   is untouched and still keys off S.lvl */
function earnedLevel(){ const x=S.xpn||0; let n=1; while(n<LVMAX && x>=LVXP[n+1]) n++; return n }
/* the one door XP comes through. Idempotent on key: a milestone fires once, ever. */
function grantXp(key, amt, label){
  if(!key||!(amt>0))return false;
  if(!S.xf||typeof S.xf!=="object")S.xf={};
  if(S.xf[key])return false;
  S.xf[key]=1; S.xpn=(S.xpn||0)+amt;
  if(label)toast("+"+amt+" XP \u2014 "+label,"y");
  dirty=true; return true;
}
/* mark a milestone as already earned WITHOUT paying it - migration only */
function xpSeed(key){ if(!S.xf||typeof S.xf!=="object")S.xf={}; S.xf[key]=1 }
/* Marks every Stage 2 + Stage 3 milestone already true in the loaded save, without
   paying for it - see the adopt() migration above. Stage 3's own sources (raid wins,
   defences held, research, programmes, records, crew) land in Stage 3, but their
   keys are seeded here now so a save adopted under Stage 2 never double-pays once
   Stage 3 ships. S.xp here is the exotic-programme store (unchanged, unrelated to
   S.xpn - see the naming note above xpNeed()). */
function xpSeedAll(){
  for(const s of SYS){ const st=sysState(s.id); if(!st||!st.b)continue;
    for(const gi in st.b){ const n=st.b[gi]; if(!(n>0))continue;
      xpSeed("tf:"+gi); xpSeed("sf:"+s.id+":"+gi);
      for(const t in XPV.unit) if(n>=+t) xpSeed("um:"+s.id+":"+gi+":"+t); } }
  const c=tot(); for(const t of MILE) if(c>=t) xpSeed("mi:"+t);
  const held=SYS.filter(s=>!s.home&&sysState(s.id));
  if(held.length) xpSeed("cl1"); for(const s of held) xpSeed("cl:"+s.id);
  for(const sid in (S.taken||{})) xpSeed("aw:"+sid);
  for(let i=0;i<(S.mi||0);i++) if(!(S.miq||[]).includes(i)) xpSeed("ms:"+i);
  /* Stage 3 keys */
  for(const t in XPV.raidWin) if((S.wins||0)>=+t) xpSeed("rw:"+t);
  for(let w=200+XPV.raidWinEvery; w<=(S.wins||0); w+=XPV.raidWinEvery) xpSeed("rwr:"+w);
  for(const t in XPV.defHeld) if((S.defw||0)>=+t) xpSeed("dw:"+t);
  for(const id in (S.rs||{})) for(let l=1;l<=S.rs[id];l++) xpSeed("rs:"+id+":"+l);
  for(const id in (S.xp||{})) for(let l=1;l<=S.xp[id];l++) xpSeed("pg:"+id+":"+l);
  for(const id in (S.ac||{})) if(S.ac[id]) xpSeed("ac:"+id);
  if((S.crew||[]).length) xpSeed("cr1");
  if(onBridge().length>=3) xpSeed("crf");
}
/* XP values. Firsts and milestones only - see grantXp(). */
const XPV={
  tierFirst:[10,15,20,30,50,60,80,100,120,150,200,250,300,400],  /* by ore-ladder index */
  kindFirst:[40,80,160],                                          /* by position in a kind ladder */
  sysFirstMul:0.25,                                               /* per-system repeat of a first */
  unit:{10:5,25:10,50:15,100:20},                                 /* units of one tier on one system */
  mile:30,                                                        /* each MILE structure count */
  claim:[0,80,150,250,400],                                       /* by ring */
  claim1:50, assault:[0,50,80,120,200],                           /* first claim ever; assault win by ring */
  mission:i=>20+Math.round(60*i/(MISSIONS.length-1)),             /* 20 early -> 80 late */
  raidWin:{1:20,5:30,10:40,25:60,50:80,100:100,200:120}, raidWinEvery:10, raidWinRepeat:10,
  defHeld:{1:30,5:40,10:60,25:100},
  research:10, programme:[20,20,20,5], record:15, crew1:20, crewFull:40
};
function xpOnBuild(id,gi,before,after){
  const g=GENS[gi]; if(!g)return;
  if(before<=0&&after>0){
    const lad=LADDERS[g.kind]||[], pos=lad.indexOf(gi);
    const base = g.kind==="ore" ? (XPV.tierFirst[pos]||0) : (XPV.kindFirst[pos]||0);
    if(!grantXp("tf:"+gi, base, g.n+" \u2014 first built"))
      grantXp("sf:"+id+":"+gi, Math.round(base*XPV.sysFirstMul), g.n+" on "+SYSMAP[id].n);
  }
  for(const t in XPV.unit) if(before<+t&&after>=+t) grantXp("um:"+id+":"+gi+":"+t, XPV.unit[t], g.n+" \u00d7"+t);
}
/* what you have actually claimed - this is the one everything else keys off */
function level(){ return Math.max(1,S.lvl||1) }
function pendingLevels(){ return Math.max(0, earnedLevel()-level()) }
/* progress from the last earned level to the next, 0..1. Earned, not claimed:
   the fill shows XP accumulating toward the NEXT level the player could claim,
   whatever is still unclaimed. */
function lvProgress(){
  const e=earnedLevel(), a=xpNeed(e), b=xpNeed(e+1);
  return b>a&&isFinite(b) ? Math.max(0,Math.min(1,((S.xpn||0)-a)/(b-a))) : 1;
}
function pkl(id){ return (S.pk&&S.pk[id])||0 }
function lvlMul(){ return 1+0.03*pkl("out") }
function costMul(){ return 1/((1+0.02*pkl("cost"))*(1+0.05*xlv("found"))) }
function perkPool(){ const L=level(); return PERKS.filter(p=>!p.req||L+1>=p.req) }
function rollOffer(){
  const pool=perkPool().slice(), out=[];
  while(out.length<3 && pool.length) out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0].id);
  return out;
}
/* the offer is stored so it cannot be rerolled by closing and reopening the dialog */
function lvOffer(){
  if(!Array.isArray(S.lvOffer) || !S.lvOffer.length ||
     S.lvOffer.some(id=>!PERKS.some(p=>p.id===id))) S.lvOffer=rollOffer();
  return S.lvOffer;
}
function takeLevel(id){
  if(pendingLevels()<1) return false;
  if(!lvOffer().includes(id)) return false;
  const p=PERKS.find(x=>x.id===id); if(!p) return false;
  if(!S.pk||typeof S.pk!=="object")S.pk={};
  S.pk[id]=(S.pk[id]||0)+1;
  S.lvl=level()+1;
  /* tracking-only: which level each pick happened at, for the read-only level
     summary overlay. Does not feed pkl()/lvlMul()/costMul() or anything else -
     those still key off S.pk's counts, exactly as before. */
  if(!Array.isArray(S.pkLog))S.pkLog=[];
  S.pkLog.push({id, lv:S.lvl});
  S.lvOffer=null;
  blip(1046,.28,"square",.05);
  dirty=true;
  return true;
}
function perkSummary(){
  const bits=PERKS.filter(p=>pkl(p.id)>0).map(p=>p.d(pkl(p.id)));
  return bits.length?bits.join(" \u00b7 "):"no perks yet";
}
/* one line, whatever the perk count - the full breakdown lives in the ore popup */
function perkShort(){
  const taken=PERKS.filter(p=>pkl(p.id)>0);
  if(!taken.length)return "no perks yet";
  const tot=taken.reduce((a,p)=>a+pkl(p.id),0);
  const lead=pkl("out")>0 ? PERKS.find(p=>p.id==="out") : taken[0];
  return lead.d(pkl(lead.id))+(tot>pkl(lead.id)?" \u00b7 "+tot+" perks":"");
}
function unlockedAt(p){ const u=UNLOCK.find(x=>x.p===p); return !u || level()>=u.lv }
function mileMul(c){let m=1;for(const t of MILE)if(c>=t)m*=2;return m}
function achBonus(){let b=0;for(const a of ACHS)if(S.ac[a.id])b+=a.b;return 1+b}
function globalMul(){
  let m=1;
  m*=Math.pow(1.07,xlv("frame"));
  m*=Math.pow(1.08,xlv("yield"));
  m*=Math.pow(1.15,lv(S.rs,"drill"));
  m*=Math.pow(1.2,nexLv("ent"));
  m*=(nexLv("pj3")?PJ3_MUL:1);   /* pj3 (patch584) - globalMul() is ore-only, see the patch header */
  m*=achBonus();
  m*=lvlMul();
  m*=sysBonus();
  return m;
}
/* perk "cost" makes every structure cheaper. */
/* STAGE 2: what a ladder tier produces on a system. No fit multiplier any more - see
   the header comment on sysTierCount above. mileMul is per (system, tier) count, same
   granularity slots used to give it: two Regolith Crushers on two different systems
   each start their own milestone doubling. */
function ladderRate(id,gi){
  const c=sysTierCount(id,gi); if(!(c>0))return 0;
  /* ECON (2026-09-09b): exotic output (kind ladders) scales with count only - no
     milestone doubling either now. Milestones were the remaining runaway: even after
     exotics came off the ore multiplier stack (2026-09-09), the per-tier milestone
     doubling alone let one rock world flood iridium and max every iridium programme
     within about ten minutes. Exotics are meant to GATE the upper ore tiers; a gate
     that grows with what it gates is none. */
  if(GENS[gi].kind!=="ore") return c*GENS[gi].r;
  return c*GENS[gi].r*mileMul(c)*xTierMul(gi)*globalMul();
}
/* output of one more unit of this tier at its current count on this system */
function ladderPerUnit(id,gi){
  const c=sysTierCount(id,gi);
  if(GENS[gi].kind!=="ore") return GENS[gi].r;
  return GENS[gi].r*mileMul(c)*xTierMul(gi)*globalMul();
}
/* total count of a tier across every system that has any - what S.g[i].c used to
   answer directly, and what a single slot's .c used to answer per-slot. */
function gCount(gi){
  let c=0;
  for(const s of builtSystems())c+=sysTierCount(s.id,gi);
  return c;
}
function anyOf(gi){ return gCount(gi)>0 }
function tot(){
  let c=0;
  for(const s of builtSystems()){ for(const gi of sysLadder(s.id))c+=sysTierCount(s.id,gi) }
  return c;
}
/* what buying k more of this tier on this system actually adds. Priced by moving the
   count rather than multiplying out, so a purchase that crosses a x2 milestone
   reports the jump. */
function ladderGain(id,gi,k){
  if(!k)return 0;
  const st=sysState(id); if(!st)return 0;
  if(!st.b||typeof st.b!=="object")st.b={};
  const save=st.b[gi]||0, before=ladderRate(id,gi);
  st.b[gi]=Math.max(0,save+k);
  const after=ladderRate(id,gi);
  if(save>0) st.b[gi]=save; else delete st.b[gi];   /* don't leave a stray zero entry */
  return after-before;
}
/* every ladder row on every held system feeds the same pile - no multipliers beyond
   what ladderRate itself already applies. */
function rate(){
  let r=0;
  /* PATCH 1: only kind:"ore" ladder rows count as ore now - a kind-ladder row (rock/
     gas/belt/ice/void) produces that system's own exotic instead, see sysExoRate(). */
  for(const s of builtSystems()){ for(const gi of sysLadder(s.id)) if(GENS[gi].kind==="ore") r+=ladderRate(s.id,gi) }
  return r;
}
/* x/sqrt(1+(x/c)^2): identity well below c, asymptote c well above, monotonic
   throughout - so another multiplier is never actually wasted, only worth less. */
function softCap(x,c){ if(!(c>0))return 0; const r=x/c; return x/Math.sqrt(1+r*r) }
function clickRaw(){
  let m=1;
  m*=Math.pow(2.2,lv(S.rs,"amp"));
  m*=Math.pow(1.7,xlv("optic"));
  m*=scanPerkMul();
  return (1+rate()*0.10)*m*achBonus();
}
/* Applied to the raw figure and the ceiling alike. Scaling only one of them would
   make the perk worth ~15% at one end of the curve and ~nothing at the other. */
function scanPerkMul(){ return 1+0.15*pkl("scan") }
function clickCap(){ return (SFLOOR+SCAP*rate())*Math.sqrt(scanPerkMul()) }
function clickPow(){ return softCap(clickRaw(), clickCap()) }
function cryRate(){
  if(!anyOf(1))return 0;
  const r=rate(); if(r<=0)return 0;
  return 0.03*Math.pow(r,0.30)*Math.pow(1.6,lv(S.rs,"cryo"))*Math.pow(2,nexLv("syn"))
    *Math.pow(1.15,xlv("burn"))*(1+0.06*pkl("cry"));
}
/* STAGE 2: which exotic a tier costs, and how much - fixed by the TIER now, not by
   the hosting system (the old rule, removed - see the comment on GENS in patch430). */
function ladderExoId(gi){ return GENS[gi].exo||null }
function ladderExoCost(gi,k){ return GENS[gi].exoC ? GENS[gi].exoC*k : 0 }
/* The ore ramp is per (system, tier), same granularity a slot used to give it: each
   one starts its own GROW curve, independent of every other system building the same
   tier. */
function ladderCost(id,gi,k){
  const b=GENS[gi].b*costMul(), o=sysTierCount(id,gi);
  return b*Math.pow(GROW,o)*(Math.pow(GROW,k)-1)/(GROW-1);
}
function ladderMaxAff(id,gi){
  const b=GENS[gi].b*costMul(), o=sysTierCount(id,gi), m=S.ore;
  const inner=1+m*(GROW-1)/(b*Math.pow(GROW,o));
  if(inner<=1)return 0;
  let k=Math.max(0,Math.floor(Math.log(inner)/Math.log(GROW)));
  const xid=ladderExoId(gi);
  if(xid) k=Math.min(k, Math.floor(exo(xid)/GENS[gi].exoC));   /* exotics cap it too */
  return k;
}
function offlineCapH(){return 2+2*lv(S.rs,"cold")+pkl("off")+3*xlv("vault")}
function offlineEff(){return 0.5+0.10*nexLv("chr")}
/* "unlocked" now means "buildable on at least one held system right now" - kept for
   API/test compatibility, no longer the gate that reveals a tier (see tierBuildable,
   which is what the empire list actually renders against). */
function unlocked(gi){ return builtSystems().some(s=>tierBuildable(s.id,gi)) }

