/* ============================ save / load ============================ */
function pack(){ S.last=Date.now(); return JSON.stringify(S); }
function save(){ try{ Store.set(KEY, btoa(unescape(encodeURIComponent(pack())))) }catch(e){} }
function load(){
  const raw=Store.get(KEY); if(!raw)return false;
  try{
    const o=JSON.parse(decodeURIComponent(escape(atob(raw))));
    return adopt(o);
  }catch(e){ return false }
}
function adopt(o){
  if(!o||typeof o!=="object")return false;
  /* EMPIRE2 is a fresh save by design - no migration. A pre-empire2 save carries a
     populated global S.g and no slots on any system; loading it would silently delete
     every building the player owned and hand back an empire-shaped hole. Refuse it
     outright (same rule the earlier, UI-rejected empire experiment used) and let the
     caller's "false means no save" fall through to a new game instead of a half-load. */
  if(Array.isArray(o.g) && o.g.some(x=>x&&(x.c|0)>0)){
    const hasSlots = o.sys && typeof o.sys==="object" &&
      Object.keys(o.sys).some(k=>o.sys[k]&&Array.isArray(o.sys[k].slots)&&o.sys[k].slots.some(Boolean));
    if(!hasSlots)return false;
  }
  /* STAGE 2 (v3) is ALSO a fresh save by design - no migration, same rule as above.
     A pre-v3 save carries `slots` arrays on its systems (the empire2 shape); the
     ladder engine reads a {gi:count} map instead, and reinterpreting one as the other
     would produce nonsense (slot array indices are not GENS indices). Any save with
     a `slots` array on ANY system - even an empty one, since a held system always had
     one - is refused outright rather than half-loaded. */
  if(o.sys && typeof o.sys==="object" &&
     Object.keys(o.sys).some(k=>o.sys[k]&&Array.isArray(o.sys[k].slots))){
    return false;
  }
  /* A claim animation in flight is describing the game being replaced right now. Letting
     its rebuild-hold survive would protect cards belonging to a save that no longer
     exists, and refuse the rebuild that should have swapped them out. */
  misFxUntil=0;
  const f=fresh();
  for(const k in f) if(k in o) f[k]=o[k];
  if(f.site!=null&&!SITE[f.site])f.site=null;
  /* PLAN-fleets run 1: S.fl replaces the old flat S.sh/S.fhp pair. A save (or test
     fixture) carrying o.sh/o.fhp - anything from before this patch - always wins as
     the legacy hint and becomes Fleet 1, even over a stray o.fl a `{...fresh()}`
     spread incidentally carries (fresh() itself now seeds one). A save already
     carrying S.fl (and no o.sh/o.fhp) is sanitised fleet-by-fleet instead; neither
     present self-heals to a single fresh Fleet 1, same as fleets() does live. */
  if(Array.isArray(o.sh) || o.fhp!==undefined){
    const sh=Array.isArray(o.sh)&&o.sh.length===3?o.sh.slice():[0,0,0];
    f.fl=[{id:1,n:"1st Fleet",sh,hp:o.fhp===undefined?1:o.fhp,at:"home",to:null,eta:0}];
  }
  if(!Array.isArray(f.fl)||!f.fl.length)f.fl=[mkFleet(1)];
  f.fl=f.fl.map((fl,i)=>{
    const id=Math.max(1,Math.floor((fl&&fl.id)||i+1));
    const n=(fl&&typeof fl.n==="string"&&fl.n)||mkFleet(id).n;
    let sh=(fl&&Array.isArray(fl.sh)&&fl.sh.length===3)?fl.sh:[0,0,0];
    sh=sh.map(x=>Math.max(0,Math.floor(x||0)));
    const hpRaw=(fl&&fl.hp!==undefined)?fl.hp:1;
    const hp=Math.max(0,Math.min(1,hpRaw));
    /* PLAN-raidmap: a fleet may be holding in open space - at===null with a valid
       pos ({sec,x,y}). Anything else unknown falls back to home, as before. */
    const okPos=q=>q&&typeof q==="object"&&SECTORS[q.sec]&&isFinite(q.x)&&isFinite(q.y);
    const pos=(fl&&okPos(fl.pos))?{sec:fl.pos.sec,x:+fl.pos.x,y:+fl.pos.y}:null;
    const at=(fl&&typeof fl.at==="string"&&(fl.at==="home"||SYSMAP[fl.at]))?fl.at:(pos?null:"home");
    /* PLAN-fleets run 2: `to`/`eta`/`from`/`tot` now survive a reload (a save mid-
       flight resumes exactly where it was - offlineReport()'s fleetTravelTick()
       call is what actually catches the eta up for the time away). An unknown
       `to` (a removed system id, or just garbage) clears the whole travel - there
       is nowhere to arrive, so the fleet is simplest left standing at `at`. */
    const to=(fl&&typeof fl.to==="string"&&SYSMAP[fl.to])?fl.to:null;
    /* tg (flying at a contact) and hold (sitting beside one) are target ids - checked
       against the contact list itself just below, once that has been sanitised */
    const tg=(!to&&fl&&Number.isFinite(fl.tg))?fl.tg:null;
    const hold=(!to&&tg==null&&fl&&Number.isFinite(fl.hold))?fl.hold:null;
    const moving=!!to||tg!=null;
    const eta=moving?Math.max(0,+((fl&&fl.eta))||0):0;
    const from=to?((fl&&typeof fl.from==="string"&&(fl.from==="home"||SYSMAP[fl.from]))?fl.from:at):null;
    const tot=moving?Math.max(eta,+((fl&&fl.tot))||0):0;
    /* where the flight started: the saved origin, else (a save from before origins
       were recorded) the system it left */
    let o=null;
    if(moving){
      if(fl&&okPos(fl.o))o={sec:fl.o.sec,x:+fl.o.x,y:+fl.o.y,sys:(typeof fl.o.sys==="string"&&SYSMAP[fl.o.sys])?fl.o.sys:null};
      else { const s=SYSMAP[from||at||"home"]||SYSMAP.home; o={sec:s.sec,x:s.sx,y:s.sy,sys:s.id}; }
    }
    return {id,n,sh,hp,at,to,eta,from,tot,pos,tg,hold,o};
  });
  if(f.flSel==null || !f.fl.some(fl=>fl.id===f.flSel))f.flSel=f.fl[0].id;
  /* run 3: the delivery queue (S.flQ, decision 6) - three non-negative counts,
     same shape as a fleet's own sh. */
  f.flQ=(Array.isArray(f.flQ)&&f.flQ.length===3) ? f.flQ.map(x=>Math.max(0,Math.floor(x||0))) : [0,0,0];
  if(!Array.isArray(f.tg))f.tg=[];
  /* PLAN-fleets run 2: a target from before t.sys existed becomes "home" - the one
     system every save always has, so ENGAGE never has to invent a location for it. */
  /* PLAN-raidmap: every contact carries an id, a sector and a path seed now. One from
     before that (it had a system, t.sys, or nothing) keeps its sector and gets the
     rest made up; the runtime skirmish clock never survives a load. */
  f.tg=f.tg.filter(t=>t&&typeof t==="object"&&RAIDS[t.ti]);
  f.tgN=Math.max(0,Math.floor(f.tgN||0));
  { const seen={};
    f.tg.forEach((t,i)=>{
      if(!Number.isFinite(t.id)||seen[t.id]){ f.tgN++; t.id=f.tgN; }
      seen[t.id]=1; if(t.id>f.tgN)f.tgN=t.id;
      if(!SECTORS[t.sec])t.sec=(typeof t.sys==="string"&&SYSMAP[t.sys])?SYSMAP[t.sys].sec:0;
      delete t.sys; delete t.fx;
      if(!Number.isFinite(t.sd))t.sd=((t.id*2654435761)^Math.floor((t.dif||1)*1e6))|0;
      if(!Number.isFinite(t.off))t.off=Date.now()/1000-i*40;
      if(!Number.isFinite(t.fz))t.fz=null;
      t.auto=t.auto?1:0;
    });
    /* a fleet pointing at a contact that is not there any more just stops where it is;
       a contact nobody is sitting on is never left frozen */
    for(const fl of f.fl){
      if(fl.tg!=null&&!seen[fl.tg]){ fl.tg=null; fl.eta=0; fl.tot=0; fl.o=null; if(!fl.at&&!fl.pos)fl.at="home"; }
      if(fl.tg!=null&&!fl.pos){ const s=fl.o||{sec:0,x:50,y:54}; fl.pos={sec:s.sec,x:s.x,y:s.y}; fl.at=null; }
      if(fl.hold!=null&&(!seen[fl.hold]||!fl.pos)){ fl.hold=null; if(!fl.pos&&!fl.at)fl.at="home"; }
    }
    for(const t of f.tg){ if(t.fz!=null&&!f.fl.some(fl=>fl.hold===t.id)){ t.off=(t.off||0)+(Date.now()/1000-t.fz); t.fz=null; t.auto=0; } }
  }
  f.sv=Math.max(0,Math.floor(f.sv||0)); f.svAll=Math.max(0,Math.floor(f.svAll||0));
  if(!f.rf||typeof f.rf!=="object")f.rf={};
  if(!Array.isArray(f.crew))f.crew=[];
  f.crew=f.crew.filter(c=>c&&c.id&&ROLES.some(r=>r.id===c.role)&&RAR[c.r]);
  /* migration: a save whose roster is empty gets the same three Deckhands a fresh
     save starts with, so the bridge is never empty either way (patch562). A save
     that already has crew - even just one - is left exactly as it was. */
  if(!f.crew.length){ f.crew=makeDeckhands(); }
  if(!Array.isArray(f.crewPool))f.crewPool=[];
  f.crewPool=f.crewPool.filter(c=>c&&c.id&&ROLES.some(r=>r.id===c.role)&&RAR[c.r]).slice(0,3);
  if(!Array.isArray(f.bridge))f.bridge=[null,null,null];
  f.bridge=f.bridge.slice(0,3); while(f.bridge.length<3)f.bridge.push(null);
  f.bridge=f.bridge.map(id=>f.crew.some(c=>c.id===id)?id:null);
  if(f.bridge.every(id=>id===null) && f.crew.some(c=>c.deck)){
    const dk=f.crew.filter(c=>c.deck);
    for(let i=0;i<Math.min(3,dk.length);i++) f.bridge[i]=dk[i].id;
  }
  f.cseed=f.cseed||((Date.now()^0x5bf03635)&0x7fffffff)||1;
  if(!f.exoSeen||typeof f.exoSeen!=="object")f.exoSeen={};
  if(!f.mkt||typeof f.mkt!=="object")f.mkt={};
  if(!f.mkt.heat||typeof f.mkt.heat!=="object")f.mkt.heat={};
  for(const hk of ["sv","dm"]){
    const hv=f.mkt.heat[hk];
    f.mkt.heat[hk] = (hv&&typeof hv==="object") ? {v:Math.max(0,+hv.v||0), t:+hv.t||0} : {v:0,t:0};
  }
  f.mkt.sold=!!f.mkt.sold;
  for(const id in f.exo) if((f.exo[id]||0)>0) f.exoSeen[id]=true;
  /* pre-collapse-removal saves: asc/run/runStart are gone, and prices are no longer
     inflated. Ore earned under an inflated price level would be a windfall against
     flat prices, so scale the spendable balances back down by the old price level.
     All-time ore is a lifetime record and is deliberately left alone, so nobody
     loses the level they earned. */
  if("asc" in o && (o.asc||0)>0){
    const oldInf=Math.pow(1.7,o.asc||0);
    f.ore=(f.ore||0)/oldInf;
    f.cry=(f.cry||0)/oldInf;
  }
  delete f.asc; delete f.run; delete f.runStart;
  if(!f.pk||typeof f.pk!=="object")f.pk={};
  for(const k in f.pk){ if(!PERKS.some(p=>p.id===k)||!(f.pk[k]>0))delete f.pk[k];
    else f.pk[k]=Math.floor(f.pk[k]); }
  /* per-pick log, added for the level-summary overlay: {id, lv} entries only, an
     unknown perk id or a level number that cannot be a real takeLevel() result
     (always >=2, since level() starts at 1) is dropped rather than kept or
     rewritten - an existing save's picks made before this field existed simply
     have no log entries, which the summary UI treats as "taken before this was
     tracked" rather than inventing a level for them. */
  if(!Array.isArray(f.pkLog))f.pkLog=[];
  f.pkLog=f.pkLog.filter(e=>e&&typeof e==="object"&&PERKS.some(p=>p.id===e.id)&&
    Number.isFinite(e.lv)&&e.lv>=2&&e.lv<=100000)
    .map(e=>({id:e.id, lv:Math.floor(e.lv)}));
  if(!Array.isArray(f.lvOffer)||!f.lvOffer.length)f.lvOffer=null;
  /* the claim queue holds indices of finished-but-unpaid contracts. Anything outside
     the chain, duplicated, or ahead of the pointer is nonsense and is dropped - an
     unclaimable entry would sit on the Missions page forever. */
  /* rival pressure: unknown ids are dropped, values clamped. A threat naming a system
     you no longer hold, or a rival that does not exist, is unfightable - drop it. */
  if(!f.rvMsg||typeof f.rvMsg!=="object")f.rvMsg={};
  for(const k in f.rvMsg){ if(RVACT.indexOf(f.rvMsg[k])<0)delete f.rvMsg[k]; }
  if(!f.rv||typeof f.rv!=="object")f.rv={};
  for(const k in f.rv){
    if(RVACT.indexOf(k)<0){ delete f.rv[k]; continue }
    const v=f.rv[k]||{};
    f.rv[k]={ p:Math.max(0,Math.min(RV_MAX*1.5,+v.p||0)), cd:Math.max(0,+v.cd||0),
              seen:v.seen?1:0, w:Math.max(0,+v.w||0), ew:Math.max(0,+v.ew||0),
              /* STAGE 2: the action-budget token bucket - absent (old save) starts full */
              mv: v.mv===undefined ? RIVAL_MOVE_CAP : Math.max(0,Math.min(RIVAL_MOVE_CAP,+v.mv||0)) };
  }
  /* a save from before the queue carries a single standing threat; it becomes the
     first entry rather than being thrown away */
  if(!Array.isArray(f.thq))f.thq=[];
  if(o && o.thr && !f.thq.length && RVACT.indexOf(o.thr.rv)>=0 && SYSMAP[o.thr.sysId]){
    f.thq=[{id:1, rv:o.thr.rv, sysId:o.thr.sysId, dif:+o.thr.dif||1, t:THQ_LIFE, life:THQ_LIFE}];
  }
  /* an entry naming a rival or a system that does not exist is unfightable - EXCEPT a
     kind:"sab" entry naming home exactly, which is the one legitimate case a threat is
     ever allowed to target home (owner decision 8, STAGE C). Anything else naming home
     (every kind that existed before this patch) is still dropped, unchanged. */
  f.thq=f.thq.filter(q=>q&&RVACT.indexOf(q.rv)>=0&&
    (q.kind==="sab" ? q.sysId==="home" : (SYSMAP[q.sysId]&&!SYSMAP[q.sysId].home)))
             .slice(0,THQ_MAX)
             .map((q,i)=>{
               const isSab=q.kind==="sab";
               /* patch599: `life` survives a reload untouched - a sab entry (home,
                  never a Sensor Mast) is forced back to the flat THQ_LIFE regardless
                  of what a save claims, everything else keeps its own stamped value
                  (clamped to the x1.5 range dmodLv-fitted systems can ever reach). */
               const life = isSab ? THQ_LIFE : Math.max(THQ_LIFE,Math.min(THQ_LIFE*1.5,+q.life||THQ_LIFE));
               return { id:Math.max(1,Math.floor(q.id||i+1)), rv:q.rv, sysId:q.sysId,
                        dif:Math.max(0.1,+q.dif||1),
                        t:Math.max(0,Math.min(life,+q.t||life)),
                        life,
                        ...(isSab?{kind:"sab"}:{}) };
             });
  f.thqSeq=Math.max(1,Math.floor(f.thqSeq||1), ...f.thq.map(q=>q.id+1));
  if(!Array.isArray(f.thrRep))f.thrRep=[];
  f.thrRep=f.thrRep.slice(-8);
  delete f.thr;
  /* A save from before first contact existed has met anyone whose space it is already
     past. Firing rvMeet for those on load would dump two hostile fleets on a returning
     player for something they did twenty levels ago. */
  {
    /* THE LEVEL OF THE SAVE BEING LOADED, not of the game still in memory. level() reads
       S, which adopt() has not replaced yet, so it would answer about the previous game. */
    const fLvl=Math.max(1, f.lvl||1);
    for(const id of RVACT){
      if(f.rv[id]&&f.rv[id].seen)continue;
      let first=null;
      for(const s of SYS){ if(s.owner!==id)continue; if(!first||s.lvl<first.lvl)first=s }
      if(first && fLvl>=first.lvl){
        f.rv[id]=f.rv[id]||{p:0,cd:0,seen:0};
        f.rv[id].seen=1;
      }
    }
  }
  f.defw=Math.max(0,Math.floor(f.defw||0)); f.defl=Math.max(0,Math.floor(f.defl||0));
  f.thrCd=Math.max(0,Math.min(RV_MINGAP,+f.thrCd||0));
  f.rvExp=Math.max(0,Math.min(RV_EXPAND,+f.rvExp||0));
  /* systems taken off you. An entry naming a system that does not exist, a rival that
     does not exist, or a system you currently hold is stale and would show the map a
     border that is not there. */
  /* PLAN-defences.md owner decision 1: the old flat defence level is dropped outright -
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
  }
  /* an in-flight (or arrived-and-waiting) assault. Only "assault" trips exist so far;
     an unrecognised kind, a system that no longer exists, or home itself (never a
     valid assault target) drops the whole trip rather than half-loading a fleet with
     nowhere to arrive. t0/dueAt are just clamped to numbers, t0<=dueAt - a reload
     mid-trip should resume exactly where the countdown was, never restart it. */
  if(f.trip && (typeof f.trip!=="object" || f.trip.kind!=="assault" ||
                !SYSMAP[f.trip.sysId] || SYSMAP[f.trip.sysId].home))
    f.trip=null;
  if(f.trip){
    const t0=Math.max(0,+f.trip.t0||0), dueAt=Math.max(t0,+f.trip.dueAt||t0);
    f.trip={ sysId:f.trip.sysId, kind:"assault", t0, dueAt };
  }
  if(!f.lost||typeof f.lost!=="object")f.lost={};
  for(const k in f.lost){
    if(!SYSMAP[k]||SYSMAP[k].home||!RIVALMAP[f.lost[k]]||f.sys[k])delete f.lost[k];
  }
  if(!Array.isArray(f.miq))f.miq=[];
  f.mi=Math.max(0,Math.min(MISSIONS.length,Math.floor(f.mi||0)));
  f.miq=[...new Set(f.miq.map(x=>Math.floor(x)).filter(x=>x>=0&&x<f.mi))].sort((a,b)=>a-b);
  if(!f.nx||typeof f.nx!=="object")f.nx={};
  for(const k in f.nx) if(!NEXUS.some(x=>x.id===k)) delete f.nx[k];
  /* PLAN-governors: the "auto" research node's max dropped 10->3 in copy (Governors).
     A save from before that (still legitimately at levels 4-10, bought under the old
     max) is clamped down - "a save with S.rs.auto>3 is clamped to 3" (owner decision
     1). Nothing else about S.rs needs sanitising - buyRes() itself already refuses
     past a node's own max going forward, this only guards an existing save.
     PLAN-polish batch C #2 (Governors v2): max raised 3->6, clamp raised to match -
     a save already sitting at exactly 3 (last run's real ceiling) is untouched, one
     already over 6 from further back is still caught. */
  if(!f.rs||typeof f.rs!=="object")f.rs={};
  if((f.rs.auto||0)>6)f.rs.auto=6;
  if(!f.sys||typeof f.sys!=="object")f.sys={};
  for(const k in f.sys){
    if(!SYSMAP[k]){ delete f.sys[k]; continue }
    /* PATCH 1: dev level is gone - an incoming save that still carries one (a save
       from before this pass) simply has it silently dropped here, same as any other
       stale field. No hard rejection the way the pre-v3 slots shape gets one below:
       reading past a `dev` key that no longer means anything cannot corrupt `b`, so
       there is nothing to protect against beyond just not copying it forward. */
    const bin=(f.sys[k]&&typeof f.sys[k].b==="object"&&f.sys[k].b)||{};
    const b={};
    for(const gk in bin){
      const gi=Math.floor(gk), c=Math.max(0,Math.floor(bin[gk]||0));
      if(gi>=0 && GENS[gi] && c>0) b[gi]=c;
    }
    /* PLAN-governors: gov/gb/gt/gl live on the same per-system entry as b. gov is a
       plain 1/0 flag (appointing past govCount()<lv(S.rs,"auto") is a UI gate, not a
       save invariant - a save from a game that has since lost research levels is
       left over-appointed rather than silently un-appointing something the player
       chose; renderSysGov() just clamps what NEW appointments are offered). gb/gt
       are never negative; gl (last buy) is dropped unless it names a real tier. */
    const gin=f.sys[k]||{};
    const gov=gin.gov?1:0;
    const gb=Math.max(0,+gin.gb||0);
    const gt=Math.max(0,+gin.gt||0);
    const gl=(gin.gl&&typeof gin.gl==="object"&&GENS[Math.floor(gin.gl.gi)]&&+gin.gl.t>0)
      ? {gi:Math.floor(gin.gl.gi), t:+gin.gl.t} : null;
    /* PLAN-polish batch C #2 (Governors v2): gft/gfl are the module-fitting side's
       own timer/last-fit, sanitised the same way gt/gl are just above. gfl.m must
       still name a real, non-Shipyard module - a save from a build that once
       allowed something else here (there isn't one, but the check costs nothing
       and matches gl's own belt-and-braces reading of `gi`). */
    const gft=Math.max(0,+gin.gft||0);
    const gfl=(gin.gfl&&typeof gin.gfl==="object"&&DEF_MODULES[gin.gfl.m]&&gin.gfl.m!=="shy"&&+gin.gfl.t>0)
      ? {m:gin.gfl.m, t:+gin.gfl.t} : null;
    /* PLAN-polish batch B item 5: t0 is a GENS index (never negative) naming a real
       tier, or absent - a save from before this batch (or any system claimed
       before it) simply never carries the key, which sysT0() already reads as 0
       ("nothing skipped"), exactly the old behaviour. */
    const t0raw=Math.floor(gin.t0||0);
    const t0=(t0raw>0 && GENS[t0raw]) ? t0raw : 0;
    f.sys[k]={b, ...(gov?{gov}:{}), ...(gb?{gb}:{}), ...(gt?{gt}:{}), ...(gl?{gl}:{}),
      ...(gft?{gft}:{}), ...(gfl?{gfl}:{}), ...(t0?{t0}:{})};
  }
  /* home is always held - a save that predates a claim, or one that simply never had
     home in S.sys, still needs its count map to exist */
  if(!f.sys.home)f.sys.home={b:{}};
  /* STAGE 2: occupied systems - a marker on top of an unmodified S.sys entry, never
     a replacement for it. An entry naming a system that no longer exists, is home,
     names an unrecognised rival, or - critically - has no surviving building data is
     stale and is dropped rather than half-honoured; S.occAt (when the weakened-
     garrison window started) follows the same fate as whatever it is timestamping. */
  if(!f.occ||typeof f.occ!=="object")f.occ={};
  for(const k in f.occ){
    if(!SYSMAP[k]||SYSMAP[k].home||!RIVALMAP[f.occ[k]]||!f.sys[k])delete f.occ[k];
  }
  if(!f.occAt||typeof f.occAt!=="object")f.occAt={};
  for(const k in f.occAt){ if(!f.occ[k])delete f.occAt[k]; else f.occAt[k]=Math.max(0,+f.occAt[k]||0); }
  /* STAGE 3: the live-fleet marker - a reload restores its countdown (if still
     running) or resolves it straight to occupation (if its ETA already passed) via
     lfSettleMarkOnLoad(), called at boot; see patch472/473. */
  if(f.lfMark && (typeof f.lfMark!=="object" || !SYSMAP[f.lfMark.sysId] ||
                  SYSMAP[f.lfMark.sysId].home || RVACT.indexOf(f.lfMark.rv)<0))
    f.lfMark=null;
  if(f.lfMark)
    f.lfMark={ sysId:f.lfMark.sysId, rv:f.lfMark.rv, dueAt:Math.max(0,+f.lfMark.dueAt||0) };
  if(!f.lfCd||typeof f.lfCd!=="object")f.lfCd={};
  for(const k in f.lfCd){
    if(RVACT.indexOf(k)<0){ delete f.lfCd[k]; continue }
    f.lfCd[k]=Math.max(0,+f.lfCd[k]||0);
  }
  /* no loadout at all means this save predates weapon mode, so its cmode is the
     default of its era rather than anything the player chose - move it across. Saves
     written since keep their value, so the dev toggle still sticks. */
  const preWep = !o.wep || typeof o.wep!=="object";   /* `o`, not `f`: adopt()
     seeds f from fresh(), so f.wep always exists by here */
  f.ammo=Math.max(0,Math.floor(f.ammo||0));
  if(!f.pwr||typeof f.pwr!=="object")f.pwr={};
  /* a save from when WEAPONS was a power tile: turn that count into armed guns */
  const oldWep = Math.max(0,Math.floor((o.pwr&&o.pwr.wep)||0));
  for(const p of PWR_SYS)f.pwr[p.id]=Math.max(0,Math.floor(f.pwr[p.id]||0));
  for(const k in f.pwr) if(!PWR_SYS.some(p=>p.id===k)) delete f.pwr[k];
  if(!Array.isArray(f.wpow))f.wpow=[];
  f.wpow=f.wpow.map(x=>!!x);
  if(oldWep>0 && !f.wpow.some(Boolean))
    for(let i=0;i<oldWep;i++)f.wpow[i]=true;
  if(!f.wpow.some(Boolean))f.wpow[0]=true;      /* never leave someone unarmed */
  /* a save from before the Rocket Pod has an empty second hardpoint and no rockets */
  if(preWep||!o.ammo&&o.ammo!==0)f.ammo=Math.max(f.ammo,12);
  if(f.cmode!=="live"&&f.cmode!=="turn"&&f.cmode!=="wep")f.cmode="wep";
  if(preWep)f.cmode="wep";
  if(preWep)f.wep={own:{},slot:[]};
  if(!f.wep.own||typeof f.wep.own!=="object")f.wep.own={};
  for(const k in f.wep.own) if(!WEPMAP[k]) delete f.wep.own[k];
  if(!Array.isArray(f.wep.slot))f.wep.slot=[];
  f.wep.slot=f.wep.slot.map(id=>WEPMAP[id]?id:null);
  /* a save with nothing fitted still gets its starter gun, or the fight is unwinnable */
  if(!f.wep.slot.some(Boolean))f.wep.slot[0]="pulse";
  /* fit the Rocket Pod for anyone who predates it, if they have a free hardpoint */
  if(preWep&&!f.wep.slot.includes("rocket")){
    const k=f.wep.slot.indexOf(null);
    if(k>=0)f.wep.slot[k]="rocket"; else f.wep.slot[1]="rocket";
  }
  if(!f.taken||typeof f.taken!=="object")f.taken={};
  for(const k in f.taken) if(!SYSMAP[k]||!SYSMAP[k].owner) delete f.taken[k];
  if(!f.xp||typeof f.xp!=="object")f.xp={};
  for(const k in f.xp){ const r=XPROG.find(z=>z.id===k);
    if(!r||!(f.xp[k]>0))delete f.xp[k]; else f.xp[k]=Math.min(r.max,Math.floor(f.xp[k])) }
  /* polish batch A #11: Command Lattice is inert for a real player (see INERT_PROGS,
     01-content.js) - a save that already banked levels in it (from before this
     change) loses them on load, no refund, same as the plan's own instruction for
     an outright removal. Kept out of the generic pass above because "comm" is still
     a normal XPROG entry (csim4.js needs it to stay exactly as it was, see its own
     header note) - this is the one spot that actually drops it for a player save. */
  if(f.xp.comm)delete f.xp.comm;
  if(!f.exo||typeof f.exo!=="object")f.exo={};
  for(const k in f.exo){ if(!EXO.some(e=>e.id===k)||!(f.exo[k]>0))delete f.exo[k] }
  /* Exotic Nodes (patch582): a separate resource from S.exo, not one of EXO -
     see the header note on why. enAll is a lifetime total and can never sit
     below what is currently banked. */
  f.en=Math.max(0,+f.en||0);
  f.enAll=Math.max(0,+f.enAll||0); if(f.enAll<f.en)f.enAll=f.en;
  if(f.msel!==null&&!SYSMAP[f.msel])f.msel=null;
  if(!f.hist||typeof f.hist!=="object"||!Array.isArray(f.hist.d))f.hist={iv:HIV0,a:0,d:[]};
  f.hist.iv=(f.hist.iv>0)?f.hist.iv:HIV0;
  f.hist.a=+f.hist.a||0;
  /* drop malformed rows, and any row that predates a change to MEAS */
  f.hist.d=f.hist.d.filter(r=>Array.isArray(r)&&r.length===MEAS.length)
                   .map(r=>r.map(x=>+x||0)).slice(-HMAX);
  if(!MEAS.some(m=>m.id===f.mtab))f.mtab="rate";
  {
    /* pre-XP save, or any save whose xpn doesn't match its claimed level: set XP to
       exactly the threshold for that level, so the bar starts at 0% and nothing is
       owed or lost. Can't key this off "xpn in o" alone - fresh() always supplies
       xpn:0, so a bare presence/type check can never tell a genuine pre-XP save
       (xpn absent, defaults to 0) apart from a real level-1 game (xpn genuinely 0).
       The real signal is xpn===0 while lvl>1: since xpNeed(n) for n>=2 is always >0
       (LVXP_PTS[2]=38, and LVXP is asserted strictly increasing at load), a
       legitimately-earned level above 1 can never carry zero banked XP -
       so that combination only ever means stale/missing data. xpSeedAll() (Stage 1: a
       no-op; Stage 2+: back-fills every milestone already true) runs once, right after
       S is assigned below. */
    if(typeof f.xpn!=="number"||!(f.xpn>=0)||(f.xpn===0&&(f.lvl||1)>1)){
      f.xpn=xpNeed(Math.max(1,Math.floor(f.lvl||1))); f.xf={}; f.__seedXp=1;
    }
    if(!f.xf||typeof f.xf!=="object")f.xf={};
    f.lvl=Math.max(1,Math.min(LVMAX,Math.floor(f.lvl||1)));
    /* 0 none, 1 finale, 2 won (patch584) - Batch D is what ever sets 1 or 2 */
    f.end=Math.max(0,Math.min(2,Math.floor(f.end||0)));
    /* patch592: S.t0 (session start, fresh()) - a save written before this field
       existed, or carrying a corrupt value, has no reliable start time. Back-filled
       to null ("unknown") rather than quietly keeping adopt()'s own fresh()-supplied
       Date.now() (which would read as "started just now") - same "in o" presence
       test the XP block above uses. Ending-screen display only (endStats()) - S.t0
       is otherwise unread anywhere in the game. */
    if(!("t0" in o) || !(f.t0>0))f.t0=null;
    if(!("lvSeen" in o))f.lvSeen=f.lvl;
    /* PLAN-polish batch B item 2: lvEarn (the one-level-per-check ratchet) is
       ALWAYS recomputed here, from this save's own (already-sanitised) xpn/lvl -
       never carried through from `o` - rather than trying to tell a genuine old
       save apart from a `{...fresh(), xpn:X}` test fixture (fresh() deliberately
       never seeds this key any more - see its own comment - so that ambiguity
       does not arise, but recomputing unconditionally is simpler regardless, and
       cheap: xpn/lvl are already fixed by the two lines above). This is a
       load-time-only jump straight to the save's true entitlement, uncapped by
       the one-per-check gate - the same "an old save catching up past several
       thresholds in one go gets ONE combined moment, not a cascade" rule
       ensureFleets()/PLAN-fleets run 3 already applies to Fleet 2/3. */
    let lvEarn=Math.max(1,f.lvl);
    while(lvEarn<LVMAX && (f.xpn||0)>=xpNeed(lvEarn+1))lvEarn++;
    f.lvEarn=lvEarn;
  }
  S=f;
  /* S.han[sysId] - always exactly 3 non-negative integers, never more than HAN_CAP
     combined. Placed here (not with the S.def sanitiser above, before S=f) because
     it needs sysHeld()/dmodLv() to see the save's OWN, already-sanitised state, not
     whatever game was running before this load. An entry naming a system that is
     not currently held, or that carries no built+armed Hangar (never reachable from
     the real UI - stationHan() itself checks both) is not deleted outright: its
     counts fold straight back into Fleet 1 instead (PLAN-fleets run 1: S.sh is gone,
     and this fold-back is not "the fleet you happen to be looking at" territory -
     it is a load-time sanitiser, so it always lands on Fleet 1, same as every other
     fold-back this function does), the same "never actually destroy a ship over a
     save/sanitiser edge case" kindness occupySystem()'s own recallHanAll() already
     applies during ordinary play. */
  if(!S.han||typeof S.han!=="object")S.han={};
  const homeFl=fleet(1);
  for(const k in S.han){
    const raw=S.han[k];
    /* PLAN-fleets follow-up: S.han[id] is now {n:[..], from:fleetId}, not a bare
       array - a save from before the follow-up (still a bare array) becomes
       from:1 ("old entries default to fleet 1", the plan's own words); `from`
       naming a fleet that no longer exists (a slot never opened, or - impossible
       today, but defensive - one somehow removed) also falls back to 1. */
    const isOld=Array.isArray(raw)&&raw.length===3;
    const nRaw=isOld ? raw : (raw&&Array.isArray(raw.n)&&raw.n.length===3?raw.n:[0,0,0]);
    const arr=nRaw.map(x=>Math.max(0,Math.floor(x||0)));
    const fromRaw=isOld?1:(raw&&raw.from);
    const from=fleet(Math.floor(fromRaw))?Math.floor(fromRaw):1;
    const ok = SYSMAP[k] && !SYSMAP[k].home && sysHeld(k) && dmodLv(k,"han")>0;
    if(!ok){
      for(let i=0;i<3;i++) if(arr[i]>0) homeFl.sh[i]=(homeFl.sh[i]||0)+arr[i];
      delete S.han[k];
      continue;
    }
    let total=arr[0]+arr[1]+arr[2];
    for(let i=0;i<3&&total>HAN_CAP;i++){
      const cut=Math.min(arr[i], total-HAN_CAP);
      arr[i]-=cut; homeFl.sh[i]=(homeFl.sh[i]||0)+cut; total-=cut;
    }
    S.han[k]={n:arr, from};
  }
  /* patch609 (PLAN-pacing: level moved to unlockLv("p-map")): an old save can carry
     S.msel naming a system that sysInSec() no longer draws a node for below the map
     unlock level (the map used to show every system in a sector regardless of level)
     - left alone, renderMap() would still find it in SYSMAP and open its sheet on a
     node that isn't there. Placed after S=f, like the S.han sanitiser just above,
     because it needs level() to read this save's OWN S.lvl. */
  if(S.msel && S.msel!=="home" && level()<unlockLv("p-map")) S.msel=null;
  if(S.__seedXp){ delete S.__seedXp; xpSeedAll() }
  /* one-time unlock notices: back-fill "already seen" for whatever this save already
     satisfies, so loading an existing game never queues a flood of "just unlocked"
     notices for things that have been true for a long time. */
  if(!S.seen||typeof S.seen!=="object")S.seen={};
  if(!Array.isArray(S.notifyQueue))S.notifyQueue=[];
  S.seen.intro=true;   /* patch579: adopt() only ever runs for a save that already
     exists (load() returns before calling it when there is none) - so every
     loaded game has, by definition, already had its intro moment */
  if(unlockedAt("p-mis"))S.seen["vega:missions"]=true;
  if(unlockedAt("p-res"))S.seen["vega:research"]=true;
  if(unlockedAt("p-mkt"))S.seen["vega:stats"]=true;
  if(unlockedAt("p-map"))S.seen["vega:map"]=true;
  if(SYS.some(s=>!s.home&&sysOpen(s)))S.seen["vega:claimable"]=true;
  if(EXO.some(e=>exoEverBanked(e.id)))S.seen["vega:exoBanked"]=true;
  if(unlockedAt("p-raid")){ S.seen["vega:raids"]=true; S.seen["vega:raidsBuy"]=true;
    S.seen["vega:raidsFit"]=true; S.seen["vega:raidsOfficers"]=true; }
  /* PLAN-fleets run 3: catches an old save up on Fleet 2/3 the instant it loads,
     same reasoning as every backfill around it - a level-22 save from before this
     run existed should not wait for the next tick to gain fleets it has clearly
     earned. ensureFleets() itself decides one notice vs. one combined toast; see
     its own comment (01-content.js) for why an old save opening both at once never
     queues either vega:fleet2/3 card. */
  ensureFleets();
  /* run 3: a fleet can already be idle at home the instant a save with a queued
     purchase loads (nothing has to "arrive" for that) - drain it now rather than
     waiting on the next travel tick. Quiet: a load is not the moment to toast a
     delivery that landed between sessions. */
  tryDrainFleetQueue(true);
  if(crewUnlocked())S.seen["vega:crew"]=true;
  if(unlockedAt("p-nex"))S.seen["vega:nexus"]=true;
  if(level()>=23)S.seen["vega:ring2"]=true;
  if(level()>=25)S.seen["vega:drift25"]=true;
  if(level()>=31)S.seen["vega:ring3"]=true;
  if(level()>=35)S.seen["vega:drift35"]=true;
  if(level()>=40)S.seen["rival:rv40"]=true;
  if(level()>=45)S.seen["vega:drift45"]=true;
  if(level()>=50)S.seen["rival:rv50"]=true;
  if(level()>=55)S.seen["vega:ring4"]=true;
  if(level()>=55)S.seen["vega:drift55"]=true;
  if(level()>=60)S.seen["rival:rv60"]=true;
  if(level()>=65)S.seen["vega:drift65"]=true;
  if(hasRing3Held())S.seen["vega:project"]=true;   /* PLAN-pacing: first ring-3+ claim, not first Node */
  /* the beats below have no "unlockedAt" equivalent - back-filled off the closest
     thing this save already tracks, so an old save never gets a first-time beat for
     something it did long ago. threat/firstLoss are best-effort (thqSeq/S.occ do not
     perfectly reconstruct history) - acceptable for flavour text that fires once, ever. */
  if(tot()>0)S.seen["vega:firstDrone"]=true;
  if(heldSystems().length>0)S.seen["vega:firstClaim"]=true;
  /* PLAN-polish batch C #3: "old saves that already hold systems never get it" -
     S.seen.ambush is the same guard queueFirstAmbush() checks (05-rivals.js), so a
     save that already holds a non-home system on load is backfilled true here, same
     rule vega:firstClaim just above already follows for the exact same condition. */
  if(heldSystems().length>0)S.seen.ambush=true;
  if((S.wins||0)>=1)S.seen["vega:firstWin"]=true;
  if((S.defw||0)>=1)S.seen["vega:firstHold"]=true;
  if((S.thqSeq||1)>1)S.seen["vega:threat"]=true;
  if((S.losses||0)>0||Object.keys(S.occ||{}).length>0)S.seen["vega:firstLoss"]=true;
  if(RVACT.some(id=>rvOf(id).seen))S.seen["vega:rival"]=true;
  if((S.xpn||0)>=60 && pendingLevels()===0)S.seen.xpHow=true;
  /* patch589: a save loaded at S.end>=1 (the turn already happened) never gets the
     advisor back - belt and braces for a save written before this guard existed. */
  if(S.end>=1)purgeVegaNotices();
  /* patch592: a real reload reruns the module-scope GARRISON loop (~line 2344)
     regardless of S.end, handing every rival system its owner back before this
     ever runs - re-apply peace on every boot the save itself says is already won,
     not only at the instant finaleWon() fires it. */
  if(S.end===2)applyPeace();
  return true;
}
function offlineReport(){
  dmodComplete();
  tripTick(true);
  const away=(Date.now()-(S.last||Date.now()))/1000;
  if(away<60)return;
  /* PLAN-fleets run 2: land any fleet that was mid-flight when the tab closed -
     quiet (no toast; see fleetTravelTick's own comment), folded into the report
     below only if it is already showing something else. */
  const fleetArrivals=fleetTravelTick(away, true);
  /* Age the queue for the whole time away - NOT capped like production is. The window is
     a promise about wall-clock time; capping it would mean an attack survived a week
     because the offline cap is eight hours. Quiet, because the report speaks for it. */
  S.thrRep=[];
  /* expansion first: it can hand a rival a system, and thqPrune drops attacks aimed at
     systems that are no longer the player's, so the order decides whether a stale attack
     survives the night */
  if(rvAwake())rvExpandAway(away);
  thqPrune();
  /* STAGE 2: offline=true - any thq entry whose telegraph expired while the page was
     shut resolves straight to occupation (holdResolve, patch462), never an odds roll. */
  thqTick(away, true, true);
  /* STAGE 2: THEN spend whatever action-budget the absence regenerated - see
     rvMoveAway for why this can never be more than RIVAL_MOVE_CAP per rival no
     matter how long `away` is. */
  if(rvAwake())rvMoveAway(away);
  /* the report carries three kinds of news now: fights the garrison had, ground the
     rivals took that was never the player's, and - STAGE 2 - the player's own systems
     that were occupied */
  const rep=(S.thrRep||[]).slice();
  const fought=rep.filter(f=>!f.claim&&!f.occ);
  const claims=rep.filter(f=>f.claim);
  const occupied=rep.filter(f=>f.occ);
  const cap=offlineCapH()*3600, t=Math.min(away,cap), eff=offlineEff();
  const ore=rate()*t*eff, cry=cryRate()*t*eff, en=enRate()*t*eff;
  /* "Now affordable" replaces the old "you gained a level" return - with levels
     off ore, offline had a built-in next-action. First 3 of: a held system's next
     tier whose first unit is already covered by the ore just banked above, and any
     unclaimed system whose level requirement is met and whose ore cost is covered. */
  const affordable=(()=>{ const out=[], projOre=S.ore+ore;
    for(const s of builtSystems()){ const gi=sysNextGi(s.id); if(gi==null)continue;
      if(ladderCost(s.id,gi,1)<=projOre) out.push(GENS[gi].n+" on "+s.n); }
    for(const s of SYS){ if(s.home||sysHeld(s.id))continue;
      if(level()>=s.lvl&&s.cost<=projOre) out.push("Claim "+s.n); }
    return out.slice(0,3);
  })();
  /* even with nothing earned, a garrison action is worth showing */
  /* fleetArrivals is deliberately NOT one of these conditions - a fleet arriving
     with nothing else to report is not worth a modal on its own (see the comment
     where fleetArrivals is computed above); it only ever shows as an extra line
     folded into a report already popping up for some other reason. */
  if(ore<=0&&cry<=0&&en<=0&&!fought.length&&!claims.length&&!occupied.length)return;
  S.ore+=ore;S.all+=ore;S.cry+=cry;S.en+=en;S.enAll+=en;
  for(const e of EXO){ const r=exoRate(e.id); if(r>0)S.exo[e.id]=exo(e.id)+r*t*eff }
  /* PLAN-governors commit 2: offlineReport() never calls tick(), so governor bank
     accrual/purchases need their own catch-up here - AFTER the away production above
     has already landed in S.ore, so a governor purchase spends real, already-banked
     ore. away (not the production-capped t) is what "one per GOV_EVERY of away time"
     is measured against - a governor keeps checking in whether or not the offline
     cap capped production. */
  offlineGovCatchup(away, eff);
  showModal(`<h3>While you were away</h3>
   <p>Away for <b>${fmtT(away)}</b> — banked <b>${fmtT(t)}</b> at ${Math.round(eff*100)}% efficiency.</p>
   <div style="font:700 26px/1.2 ui-monospace,monospace;color:var(--cy);margin:10px 0">+${fmt(ore)} ${RI("ore")}</div>
   ${cry>0?`<div style="font:700 16px/1.2 ui-monospace,monospace;color:var(--vi)">+${fmt(cry)} ${RI("cry")}</div>`:""}
   ${en>0?`<div style="font:700 16px/1.2 ui-monospace,monospace;color:${EN_COL}">+${fmt(en)} Exotic Nodes</div>`:""}
   ${fleetArrivals.length?`<p class="awnote">${fleetArrivals.join(", ")}.</p>`:""}
   ${claims.length?`<div class="awrep claims"><h5>The map moved while you were gone</h5>${
     claims.map(f=>`<div class="awrow bad"><span>${f.sys}</span><b>${f.rv}</b></div>`).join("")
     }<p class="awnote">None of these were yours \u2014 the war between them moves whether
       you are watching or not. A system that changes hands gets dug in, so anything you
       meant to take is easier today than it will be tomorrow.</p></div>`:""}
   ${fought.length?`<div class="awrep fought"><h5>Your garrisons fought without you</h5>${
     fought.map(f=>`<div class="awrow ${f.won?"ok":"bad"}"><span>${f.sys}</span><b>${
       f.won ? "held" : "occupied"}</b></div>`).join("")
     }<p class="awnote">${fought.some(f=>!f.won)
       ? "A system that fell is occupied, not destroyed \u2014 buildings and stockpile untouched. Retake it on the map."
       : "Nothing was lost. Defences pay for themselves."}</p></div>`:""}
   ${occupied.length?`<div class="awrep occupied"><h5>Occupied while you were away</h5>${
     occupied.map(f=>`<div class="awrow bad"><span>${f.sys}</span><b>${
       RIVALMAP[f.rv]?RIVALMAP[f.rv].n:f.rv}</b></div>`).join("")
     }<p class="awnote">Buildings and stockpiles are untouched \u2014 production has simply
       stopped. These are freshly dug in and weakened: retake them on the map for an
       easy win before that wears off.</p></div>`:""}
   ${affordable.length?`<p style="margin-top:12px">Now affordable: <b>${affordable.join(", ")}</b></p>`:""}
   <p style="margin-top:12px">Offline cap is <b>${offlineCapH()}h</b> (Cryo Storage) at <b>${Math.round(eff*100)}%</b> rate (Chronal Buffer).</p>
   <div class="row"><button id="mOk">CONTINUE</button></div>`,()=>{ $("#mOk").onclick=hideModal; });
  S.thrRep=[];
}
function showModal(html,after){ $("#modal").innerHTML=html; $("#mask").classList.add("on"); after&&after(); }
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
/* the rival's displayed initial, skipping a leading "The " ("The Covenant" ->
   "C", not "T") - shared by the scene component and renderNotice() so they
   cannot drift apart on this again. */
function rivalInitial(r){ return (r.n.replace(/^The\s+/,"")||r.n)[0]; }
/* turned param (patch589): "the turn" scene wants a red/dimmed VEGA, everyone else
   (the intro, every notice card) wants the normal one - a second class on the SAME
   VEGA_SVG markup (.vegaturn, CSS filter - see the stylesheet), not a new asset. */
function sceneAvatarHTML(who,turned){
  if(who==="vega")return turned ? VEGA_SVG.replace('class="vegaav"','class="vegaav vegaturn"') : VEGA_SVG;
  const r=RIVALMAP[who];
  return r?`<div class="rivav" style="--a:${r.col}">${rivalInitial(r)}</div>`:"";
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
  const turned=!!(sceneOpts&&sceneOpts.turned&&n.who==="vega");   /* patch589 */
  if(av){ av.hidden=!has; if(has)av.innerHTML=sceneAvatarHTML(n.who,turned); }
  if(who){ who.hidden=!has; if(has)who.textContent=sceneWhoName(n.who); }
  /* patch617: same has flag, reflected onto the card so a speakerless line can be
     centred in CSS - see the .scenecard.solo rule in the stylesheet. */
  const card=$(".scenecard"); if(card)card.classList.toggle("solo",!has);
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
  el.style.pointerEvents="none";   /* never intercept a tap mid-fade, even before removal */
  let done=false;
  const finish=()=>{
    if(done)return; done=true;
    el.classList.remove("on","closing"); el.innerHTML=""; el.style.pointerEvents="";
  };
  /* whichever fires first - the real fade finishing, or the fallback in case
     transitionend never does (e.g. reduced-motion, a tab that was backgrounded
     mid-fade) - either way the overlay is fully gone well under 1s, never just
     opacity:0 left sitting in the DOM. */
  el.addEventListener("transitionend",finish,{once:true});
  setTimeout(finish,400);
  sceneLines=null; sceneOpts=null;
}
/* patch594: the one moment a brand-new empire opens on - boot (a fresh save)
   and RESTART GAME (a deliberately fresh one) must both reach this, and only
   this, so neither can drift from the other again. */
function playOpening(){
  S.seen.intro=true;
  playScene(STORY.intro,{skip:true,onDone:()=>queueNotice("vega:boot")});
}

