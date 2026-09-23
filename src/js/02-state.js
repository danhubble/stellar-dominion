/* ============================ state ============================ */
function fresh(){
  return{
    ore:0,cry:0,dm:0,en:0,enAll:0, all:0, dmAll:0, xpn:0, xf:{},
    /* STAGE 2: buildings live on a per-system tier count, not in a flat per-tier
       count and not in slots. Home is always held, so it starts with its count map
       already there - claiming is what gives a system one, see claimSystem(). */
    clicks:0,
    mkt:{heat:{sv:{v:0,t:0},dm:{v:0,t:0}},sold:false},
    /* PLAN-fleets run 1: S.fl replaces the old flat S.sh/S.fhp pair - see mkFleet()/
       fleets()/curFleet() next to fleetDPS() in 01-content.js. S.flSel is the id of
       the fleet the Raids pane is showing (run 3 adds more than one to pick from). */
    /* run 3: the delivery queue (S.flQ) must be seeded here too, not just sanitised
       in adopt() - adopt()'s copy loop is `for(const k in f) if(k in o) f[k]=o[k]`,
       keyed on fresh()'s OWN keys, so a key fresh() never mentions is silently
       dropped from every incoming save even when the save carries it (found while
       testing the queue surviving a reload - a real save-loss bug, not just a
       fixture gap). */
    fl:[mkFleet(1)], flSel:1, flQ:[0,0,0], tg:[], tgT:0, wins:0, losses:0, plunder:0, flawless:0,
    sv:0, svAll:0, rf:{}, crew:makeDeckhands(), bridge:makeDeckhands().map(c=>c.id), crewPool:[],
    cseed:1, bestCmb:0, flags:0, end:0,
    /* PLAN-polish batch B item 2: lvEarn is the one-level-per-check ratchet
       earnedLevel() advances - see its own header comment in 03-defence.js. */
    rs:{}, nx:{}, ac:{}, mi:0, miq:[], lvSeen:1, lvl:1, lvEarn:1, pk:{}, pkLog:[], lvOffer:null,
    sys:{ home:{ b:{} } },
    exo:{}, xp:{}, taken:{}, lost:{}, occ:{}, occAt:{}, def:{}, han:{}, rv:{}, exoSeen:{}, seen:{}, notifyQueue:[], rvMsg:{},
    thq:[], thqSeq:1, thrRep:[], thrCd:0, rvExp:0, defw:0, defl:0,
    lfMark:null, lfCd:{},
    cmode:"wep", ammo:12, pwr:{shd:1,eng:0,rep:0},
    wpow:[true,true,false,false],
    wep:{own:{},slot:["pulse","rocket",null,null]},
    /* patch618: a brand-new save boots with the sheet CLOSED - initMapSec()
       already falls back to secOf(S.msel||"home") whenever this is null
       (patch609), so nothing else needs to change for the map itself to still
       land on home's sector. */
    msel:null, trip:null, hist:{iv:HIV0,a:0,d:[]}, mtab:"rate",
    muted:false, buy:1, core:1, rtab:0, site:null,
    t0:Date.now(), last:Date.now()
  };
}
let S=fresh();

/* ============================ math ============================ */
function lv(o,id){return o[id]||0}
/* ---------------- history ---------------- */
function histFresh(){ return {iv:HIV0, a:0, d:[]} }
function histOk(){
  if(!S.hist||typeof S.hist!=="object"||!Array.isArray(S.hist.d))S.hist=histFresh();
  if(!(S.hist.iv>0))S.hist.iv=HIV0;
  return S.hist;
}
function histSample(){
  return MEAS.map(m=>{ const v=m.v(); return (v&&isFinite(v))?+v.toPrecision(4):0 });
}
function histTick(dt){
  const H=histOk();
  H.a=(H.a||0)+dt;
  if(H.a<H.iv)return;
  H.a=0;
  H.d.push(histSample());
  if(H.d.length>HMAX){                    /* halve the resolution, double the span */
    const keep=[]; for(let i=0;i<H.d.length;i+=2)keep.push(H.d[i]);
    H.d=keep; H.iv*=2;
  }
}
/* seconds of game time each sample sits at */
function histAt(i){ return i*histOk().iv }
function histSeries(id){
  const H=histOk(), k=MEAS.findIndex(m=>m.id===id);
  if(k<0)return [];
  return H.d.map(row=>+row[k]||0);
}
/* ---------------- systems ---------------- */
function exo(id){ return (S.exo&&S.exo[id])||0 }
function exoDef(id){ return EXO.find(e=>e.id===id) }
/* "ever banked", not "currently banked" - a program row should not vanish because
   its exotic got spent down to zero on an upgrade. */
function exoEverBanked(id){ return !!(S.exoSeen&&S.exoSeen[id]) }
/* patch630: the whole-empire "is there anything to show" gate - same OR-of-
   conditions #exoStrip itself used (patch613c) to decide whether to render at
   all, reused to decide whether the context card is tappable and whether its
   modal (exoModal()) has anything in it. Permanent, like exoEverBanked() itself:
   S.exoSeen/S.en never clear once set. */
function exoEverBankedAny(){ return EXO.some(e=>exoEverBanked(e.id)) || enRate()>0 || (S.en||0)>0 }
function xlv(id){ return (S.xp&&S.xp[id])||0 }
function xpDef(id){ return XPROG.find(r=>r.id===id) }
function xpCost(r,l){ if(l===undefined)l=xlv(r.id); return Math.ceil(r.c*Math.pow(r.cg,l)) }
/* the four deep tiers only - the ones an exotic actually builds */
function xTierMul(i){ return GENS[i].exo ? Math.pow(1.08,xlv("latt")) : 1 }
function buyXp(r){
  const l=xlv(r.id); if(l>=r.max)return false;
  const c=xpCost(r,l); if(exo(r.x)<c)return false;
  if(!S.xp||typeof S.xp!=="object")S.xp={};
  S.exo[r.x]=exo(r.x)-c; S.xp[r.id]=l+1;
  grantXp("pg:"+r.id+":"+(l+1), XPV.programme[Math.min(l,XPV.programme.length-1)], r.n+" "+(l+1));
  blip(560,.16,"sine",.05);
  toast(r.n+" \u2192 level "+(l+1),"g"); dirty=true; return true;
}
function sysState(id){ return (S.sys&&S.sys[id])||null }
/* STAGE 2: "held" now means mine AND producing. The raw building data an occupied
   system carries is unaffected - read it with sysState()/sysTierCount() directly,
   never with sysHeld() - so builtSystems()/heldSystems() (both filter on sysHeld)
   correctly stop counting an occupied system's output without anything having to
   know occupation exists, and sysContested()/canAssault() correctly start treating
   it exactly like any other rival-held ground, for the same reason. */
function sysHeld(id){ return !!sysState(id) && !sysOccupied(id) }
/* PATCH 1: dev level is gone - sysDev() deleted along with it. */
/* ---- STAGE 2: kind ladders ----
   Slots are gone. A system builds exactly the ladder matching its kind, in a fixed
   order, tracked as a plain {gi:count} map - "b" for built. LADDERS is filled in once
   GENS exists (right after it, below), so every lookup here is a handful of array
   entries, not a scan of all of GENS. */
function sysTierCount(id,gi){ const st=sysState(id); return (st&&st.b&&st.b[gi])||0 }
/* PLAN-polish batch B item 5: the GENS index a newly-claimed system's ladder starts
   at - set once, on claim (see claimSystem()), to the lowest tier whose first unit
   already costs a meaningful slice of current production, so a rich economy does
   not have to click through a dozen trivial early tiers it can already outright
   skip. Home is exempt (its own ladder always starts at 0), and an old save (or
   any system claimed before this batch) has no t0 at all, which reads as 0 here -
   "nothing skipped", exactly the pre-batch behaviour. sysNextGi()/tierBuildable()
   and the BUILDINGS render all key off this. */
function sysT0(id){
  const s=SYSMAP[id]; if(!s||s.home)return 0;
  const st=sysState(id); return (st&&st.t0>0)?st.t0:0;
}
/* every system the player holds, home included - heldSystems() deliberately excludes it */
function builtSystems(){ return SYS.filter(s=>sysHeld(s.id)) }
/* a garrison you have beaten stops counting as an owner */
function sysLost(id){ return (S.lost&&S.lost[id])||null }
/* STAGE 2: was mine, a rival holds it now. Buildings/stockpile untouched - see
   occupySystem(). Checked before S.lost precisely because it is the more specific,
   more recent fact: a system can only ever be BOTH if a save is stale, and "you
   currently hold ground here" (occupied) must win over "you once lost this ground
   entirely" (lost). */
function sysOccupied(id){ return (S.occ&&S.occ[id])||null }
function sysOwner(s){
  if(S.occ&&S.occ[s.id])return S.occ[s.id];
  /* a system taken off you outranks the table both ways: it can hand a rival a system
     that was never theirs, and it survives having previously been "taken" by you */
  if(S.lost&&S.lost[s.id])return S.lost[s.id];
  return (s.owner && !(S.taken&&S.taken[s.id])) ? s.owner : null;
}
function sysContested(s){ return !s.home && !sysHeld(s.id) && !!sysOwner(s) }
function sysOpen(s){ return !s.home && !sysHeld(s.id) && level()>=s.lvl && !sysOwner(s) }
/* a garrison you have beaten stops counting as an owner */
function sysLost(id){ return (S.lost&&S.lost[id])||null }
/* STAGE 2: was mine, a rival holds it now. Buildings/stockpile untouched - see
   occupySystem(). Checked before S.lost precisely because it is the more specific,
   more recent fact: a system can only ever be BOTH if a save is stale, and "you
   currently hold ground here" (occupied) must win over "you once lost this ground
   entirely" (lost). */
function sysOccupied(id){ return (S.occ&&S.occ[id])||null }
function sysOwner(s){
  if(S.occ&&S.occ[s.id])return S.occ[s.id];
  /* a system taken off you outranks the table both ways: it can hand a rival a system
     that was never theirs, and it survives having previously been "taken" by you */
  if(S.lost&&S.lost[s.id])return S.lost[s.id];
  return (s.owner && !(S.taken&&S.taken[s.id])) ? s.owner : null;
}
function sysContested(s){ return !s.home && !sysHeld(s.id) && !!sysOwner(s) }
function sysOpen(s){ return !s.home && !sysHeld(s.id) && level()>=s.lvl && !sysOwner(s) }
