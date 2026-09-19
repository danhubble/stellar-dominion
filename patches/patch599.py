#!/usr/bin/env python3
"""
patch599 — PLAN-defences.md Run 2, patch 3 of 3: Sensor Mast.

Three effects, all information, all gated on the SAME check (dmodLv(sysId,
"sen")>0, exposed as hasSensorMast()) so "without a Sensor Mast none of this
appears" is one guard, not three separate ones that could drift apart:

  1. The threat's own telegraph window lives x1.5 longer. THQ_LIFE-shaped:
     a `life` field is stamped onto the threat AT CREATION (rvMaybeThreat()),
     survives save/load (adopt()'s thq sanitiser), and both `t`'s own clamp
     and thqClock() read against it instead of the flat THQ_LIFE.
  2. The threat card (Raids) and the sheet's under-attack block name the
     attacker's doctrine in words - STORY.doctrine, PLACEHOLDER, owner-
     editable, per rival.
  3. The sheet shows a "rises to n%" preview of what an immediate rearm/
     upgrade would do to the odds - computed with holdOdds() itself (its
     strOverride argument, added in patch597), never a second formula.

Sabotage threats (home) never get any of this - home never carries a Sensor
Mast (S.def has no "home" key), so hasSensorMast("home") is always false.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------------------------------------------------------------------
# 1) hasSensorMast() + defBestPreview(), next to the rest of the dmod family
# ---------------------------------------------------------------------------
do(
    "function bestHeldDefStrength(){",
    """/* Sensor Mast: the one gate for every piece of information the module unlocks -
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
function bestHeldDefStrength(){""",
    label="hasSensorMast + defBestPreview",
)

# ---------------------------------------------------------------------------
# 2) STORY.doctrine - PLACEHOLDER, owner-editable
# ---------------------------------------------------------------------------
do(
    '  nodeHint:"You\'ll see.", /* PLACEHOLDER */',
    '''  nodeHint:"You\'ll see.", /* PLACEHOLDER */
  /* Sensor Mast doctrine lines (patch599) - shown on a threat only when the
     TARGET system has a Sensor Mast fitted. PLACEHOLDER, owner-editable here
     and nowhere else - see PLAN-defences.md "## Modules" for the one-line
     counters these are built from (Vasht never sends a threat, so it gets none). */
  doctrine:{
    hel:"Helion Reach \\u2014 swarm doctrine: many light hulls, fast. Mines and turrets answer this.", /* PLACEHOLDER */
    cov:"The Covenant \\u2014 siege doctrine: fewer hulls, heavy and slow. Shields and stationed hulls answer this." /* PLACEHOLDER */
  },''',
    label="STORY.doctrine",
)

# ---------------------------------------------------------------------------
# 3) rvMaybeThreat(): stamp `life` at creation - x1.5 THQ_LIFE with a Sensor
#    Mast on the actual target, flat THQ_LIFE for a sab entry (home) or a
#    target with no mast.
# ---------------------------------------------------------------------------
OLD_CREATE = """    r.p=0; r.cd=b.cool; r.w=0;
    S.thqSeq=Math.max(1,(S.thqSeq||1))+1;
    const entry={ id:S.thqSeq, rv:id, sysId,
                  dif:1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012, t:THQ_LIFE };
    if(sab)entry.kind="sab";"""
NEW_CREATE = """    r.p=0; r.cd=b.cool; r.w=0;
    S.thqSeq=Math.max(1,(S.thqSeq||1))+1;
    /* patch599: a Sensor Mast on the system actually being targeted (never checked
       for a sab entry - it redirects to home, which never carries one) buys x1.5
       THQ_LIFE, stamped once here so it survives save/load untouched (see adopt()). */
    const life = (!sab && hasSensorMast(s.id)) ? Math.round(THQ_LIFE*1.5) : THQ_LIFE;
    const entry={ id:S.thqSeq, rv:id, sysId,
                  dif:1+s.ring*0.34+Math.max(0,level()-DEFLV)*0.012, t:life, life };
    if(sab)entry.kind="sab";"""
do(OLD_CREATE, NEW_CREATE, label="rvMaybeThreat life stamp")

# ---------------------------------------------------------------------------
# 4) adopt(): preserve `life` across save/load, clamp `t` against it instead
#    of the flat THQ_LIFE (and stamp the pre-queue migration path too).
# ---------------------------------------------------------------------------
do(
    "    f.thq=[{id:1, rv:o.thr.rv, sysId:o.thr.sysId, dif:+o.thr.dif||1, t:THQ_LIFE}];",
    "    f.thq=[{id:1, rv:o.thr.rv, sysId:o.thr.sysId, dif:+o.thr.dif||1, t:THQ_LIFE, life:THQ_LIFE}];",
    label="adopt() o.thr migration life",
)
OLD_THQMAP = """  f.thq=f.thq.filter(q=>q&&RVACT.indexOf(q.rv)>=0&&
    (q.kind==="sab" ? q.sysId==="home" : (SYSMAP[q.sysId]&&!SYSMAP[q.sysId].home)))
             .slice(0,THQ_MAX)
             .map((q,i)=>({ id:Math.max(1,Math.floor(q.id||i+1)), rv:q.rv, sysId:q.sysId,
                            dif:Math.max(0.1,+q.dif||1),
                            t:Math.max(0,Math.min(THQ_LIFE,+q.t||THQ_LIFE)),
                            ...(q.kind==="sab"?{kind:"sab"}:{}) }));"""
NEW_THQMAP = """  f.thq=f.thq.filter(q=>q&&RVACT.indexOf(q.rv)>=0&&
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
             });"""
do(OLD_THQMAP, NEW_THQMAP, label="adopt() thq life sanitiser")

# ---------------------------------------------------------------------------
# 5) renderThreat() (Raids tab): doctrine line, Sensor Mast only
# ---------------------------------------------------------------------------
OLD_RT = """    const dl=defStrength(s.id);
    return `<div class="thrc${soon?" soon":""}" data-q="${th.id}">
      <h5>INCOMING — ${s.n}<span class="thrt">${thqClock(th.t)} left</span></h5>
      <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>
      <p>${b.flav} Hold the system for ${b.secs} seconds. Your shots take time to arrive — aim ahead of them.</p>
      <button class="thrgo" data-q="${th.id}">DEFEND ${s.n.toUpperCase()}</button>"""
NEW_RT = """    const dl=defStrength(s.id);
    const hasSen=hasSensorMast(s.id);
    return `<div class="thrc${soon?" soon":""}" data-q="${th.id}">
      <h5>INCOMING — ${s.n}<span class="thrt">${thqClock(th.t)} left</span></h5>
      <div class="who" style="color:${rv?rv.col:"var(--rd)"}">${rv?rv.n:"Hostiles"}</div>
      <p>${b.flav} Hold the system for ${b.secs} seconds. Your shots take time to arrive — aim ahead of them.</p>
      ${hasSen&&STORY.doctrine&&STORY.doctrine[th.rv]?`<p>${STORY.doctrine[th.rv]}</p>`:""}
      <button class="thrgo" data-q="${th.id}">DEFEND ${s.n.toUpperCase()}</button>"""
do(OLD_RT, NEW_RT, label="renderThreat doctrine")

# ---------------------------------------------------------------------------
# 6) the sheet's #sysThreat block: doctrine + "rises to n%" preview, and the
#    dataset.h key extended so a preview appearing/changing forces a rebuild.
# ---------------------------------------------------------------------------
OLD_SHEET_THREAT = """      const trv=RIVALMAP[th.rv], tod=Math.round(holdOdds(th)*100), tkey=th.id+"|"+tod;
      thrBox.hidden=false;
      if(thrBox.dataset.h!==tkey){
        thrBox.dataset.h=tkey;
        thrBox.innerHTML=`<div class="thrc${th.t<3600?" soon":""}">
          <h5>UNDER ATTACK<span class="thrt" id="sshThrCd">${thqClock(th.t)} left</span></h5>
          <div class="who" style="color:${trv?trv.col:"var(--rd)"}">${trv?trv.n:"Hostiles"}</div>
        </div>`;
      }"""
NEW_SHEET_THREAT = """      const trv=RIVALMAP[th.rv], tod=Math.round(holdOdds(th)*100);
      /* patch599: Sensor Mast is the one gate for the doctrine line AND the
         "rises to n%" preview - both computed via defBestPreview()/holdOdds()
         itself, never a parallel estimate, and both simply absent without one. */
      const hasSen=th.kind!=="sab"&&hasSensorMast(s.id);
      const preview=hasSen?defBestPreview(s):null;
      const prevPct=preview?Math.round(holdOdds(th,defStrength(s.id)+preview.gain)*100):null;
      const tkey=th.id+"|"+tod+"|"+(prevPct!==null?prevPct:"-");
      thrBox.hidden=false;
      if(thrBox.dataset.h!==tkey){
        thrBox.dataset.h=tkey;
        const doctrine=hasSen&&STORY.doctrine&&STORY.doctrine[th.rv];
        thrBox.innerHTML=`<div class="thrc${th.t<3600?" soon":""}">
          <h5>UNDER ATTACK<span class="thrt" id="sshThrCd">${thqClock(th.t)} left</span></h5>
          <div class="who" style="color:${trv?trv.col:"var(--rd)"}">${trv?trv.n:"Hostiles"}</div>
          ${doctrine?`<p>${doctrine}</p>`:""}
          ${preview?`<div class="rec">${preview.verb} lifts you to ${prevPct}%.</div>`:""}
        </div>`;
      }"""
do(OLD_SHEET_THREAT, NEW_SHEET_THREAT, label="sheet under-attack doctrine+preview")

# ---------------------------------------------------------------------------
# 7) CSS: the "rec" line (mock's own .thr .rec, scoped onto the shared .thrc
#    class both the Raids card and the sheet's block already use)
# ---------------------------------------------------------------------------
do(
    ".thrc.sab .thrt{color:#8dffda}",
    ".thrc.sab .thrt{color:#8dffda}\n.thrc .rec{margin-top:2px;font:600 10.5px/1.4 system-ui;color:#ffe9b8}",
    label="css .thrc .rec",
)

# ---------------------------------------------------------------------------
# 8) __SD export
# ---------------------------------------------------------------------------
do(
    "  DEF_ICON,DEF_COLOR,",
    "  DEF_ICON,DEF_COLOR,hasSensorMast,defBestPreview,",
    label="__SD export additions",
)

do("const BUILD=598;", "const BUILD=599;", label="BUILD bump")

open(PATH, "w", encoding="utf-8").write(h)
print("patch599 applied OK")
