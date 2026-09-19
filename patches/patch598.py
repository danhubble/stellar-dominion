#!/usr/bin/env python3
"""
patch598 — PLAN-defences.md Run 2, patch 2 of 3: the defences row (three
cards), the detail strip, the module picker, and the Held state's
"GARRISON HOLDS n%" bar, in the system sheet. Also fixes the two Run-1
polish items named in the plan: the sshClose (✕) button overlapping the
red under-attack block's corner, and the "Incoming fleet" row duplicating
what that same red block already says.

New containers in the #sysSheet skeleton, after #sysAct: #sysOdds (the odds
bar), #sysDefWrap (#sysDefHead sechead + #sysDefRow three cards +
#sysDefDetail strip/picker) - all hidden/empty for anything that is not a
held, non-home system. #sysAct itself no longer renders anything for a held
system - the row of cards replaces the single FORTIFY button outright.

Selection state (which card is tapped, and whether it is in "detail" or
"pick" mode) is UI-only, kept in a plain module-level `defSel` variable,
never in S - reopening the sheet, or picking a different system, always
starts with nothing selected.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---------------------------------------------------------------------------
# 1) HTML skeleton: new containers between #sysAct and #sysThreatActs
# ---------------------------------------------------------------------------
OLD_SKEL = """        <div id="sysSheet">
          <div class="sshgrab" id="sshGrab"></div>
          <button type="button" class="sshx" id="sshClose" aria-label="Close">✕</button>
          <div id="sysThreat" hidden></div>
          <div id="sysInfo"></div>
          <div id="sysAct"></div>
          <div id="sysThreatActs" class="row" hidden></div>
        </div>"""
NEW_SKEL = """        <div id="sysSheet">
          <div class="sshgrab" id="sshGrab"></div>
          <button type="button" class="sshx" id="sshClose" aria-label="Close">✕</button>
          <div id="sysThreat" hidden></div>
          <div id="sysInfo"></div>
          <div id="sysAct"></div>
          <div id="sysOdds" hidden></div>
          <div id="sysDefWrap" hidden>
            <div id="sysDefHead"></div>
            <div id="sysDefRow"></div>
            <div id="sysDefDetail" hidden></div>
          </div>
          <div id="sysThreatActs" class="row" hidden></div>
        </div>"""
do(OLD_SKEL, NEW_SKEL, label="sheet skeleton")

# ---------------------------------------------------------------------------
# 2) CSS: the odds bar, the three cards, the detail strip, the picker, and
#    polish fix 1 (padding-top on #sysThreat clears the ✕ button).
# ---------------------------------------------------------------------------
OLD_CSS_ANCHOR = "#sysInfo button:disabled,#sysAct button:disabled{opacity:.4;cursor:not-allowed}"
NEW_CSS = OLD_CSS_ANCHOR + """
/* patch598: polish fix 1 (carried from Run 1) - the ✕ (.sshx, position:absolute,
   top:10/right:12 on #sysSheet) sat right over the red under-attack block's own
   top-right corner. Padding (not margin - it must not collapse away) pushes the
   block's content below the button's own footprint; harmless when #sysThreat is
   hidden/empty (padding on a display:none element has no visible effect). */
#sysThreat{padding-top:28px}
/* ---- Held state: "garrison holds n%" bar (patch598) ---- */
#sysOdds[hidden]{display:none}
#sysOdds .odds{display:flex;justify-content:space-between;align-items:baseline;
  font:600 10px/1 system-ui;letter-spacing:.14em;color:var(--dim);text-transform:uppercase;margin-top:6px}
#sysOdds .odds b{font:700 13px/1 ui-monospace,monospace;color:var(--gr);letter-spacing:0}
#sysOdds .obar{height:7px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:3px}
#sysOdds .obar i{display:block;height:100%;background:linear-gradient(90deg,#3fbf8a,#5ce6a5)}
#sysOdds .onote{font-size:10.5px;color:var(--dim);margin-top:5px;line-height:1.45}
/* ---- the defences row: three equal cards (patch598) ---- */
#sysDefWrap[hidden]{display:none}
#sysDefHead{font:600 9.5px/1 system-ui;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;
  margin:14px 0 7px;display:flex;justify-content:space-between;gap:8px}
#sysDefRow{display:flex;gap:7px}
#sysDefRow .sc{flex:1 1 0;min-width:0;border:1px solid var(--line);border-radius:11px;
  background:rgba(255,255,255,.02);padding:9px 6px 8px;display:flex;flex-direction:column;
  align-items:center;gap:5px;text-align:center;border-top:3px solid var(--a,var(--line2));
  position:relative;cursor:pointer}
#sysDefRow .sc .si{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;
  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a,var(--mut));
  font:700 11px/1 ui-monospace,monospace}
#sysDefRow .sc .n{font:700 9.5px/1.2 system-ui;color:var(--txt)}
#sysDefRow .sc .lv{font:700 8px/1 ui-monospace,monospace;color:var(--dim);letter-spacing:.06em;min-height:8px}
#sysDefRow .sc .e{font:700 9.5px/1.2 ui-monospace,monospace;color:var(--a,var(--gd))}
#sysDefRow .sc button{width:100%;margin-top:auto;border:1px solid var(--line2);
  background:rgba(72,226,255,.09);color:var(--cy);border-radius:8px;padding:6px 2px;
  font:700 9px/1.15 ui-monospace,monospace;cursor:pointer}
#sysDefRow .sc button.warn{border-color:rgba(255,180,92,.55);background:rgba(255,180,92,.12);color:#ffb45c}
#sysDefRow .sc button:disabled{opacity:.45;cursor:not-allowed}
#sysDefRow .sc.empty{border-style:dashed;border-top-style:solid;border-top-color:var(--line);background:rgba(255,255,255,.015)}
#sysDefRow .sc.empty .n{color:var(--dim2)}
#sysDefRow .sc.sel{border-color:var(--a);box-shadow:0 0 0 1px var(--a) inset,0 0 14px -6px var(--a)}
#sysDefRow .sc .tag{position:absolute;top:-8px;right:5px;font:800 6.8px/1 system-ui;letter-spacing:.08em;
  padding:2px 4px;border-radius:4px;background:#0b1026;border:1px solid currentColor}
#sysDefRow .sc .tag.ok{color:var(--gr)} #sysDefRow .sc .tag.bad{color:var(--rd)}
#sysDefRow .sc .tag:not(.ok):not(.bad){color:var(--gd)}
/* ---- detail strip / module picker (patch598) ---- */
#sysDefDetail[hidden]{display:none}
#sysDefDetail .detail{margin-top:9px;border:1px solid var(--line);border-left:3px solid var(--a);
  border-radius:10px;padding:9px 11px;background:rgba(255,255,255,.03)}
#sysDefDetail .dn{font:700 12px/1.2 system-ui;display:flex;justify-content:space-between;gap:8px;color:var(--txt)}
#sysDefDetail .dn span{font:700 10px/1.2 ui-monospace,monospace;color:var(--ice,var(--cy))}
#sysDefDetail .de{font:600 10.5px/1.35 ui-monospace,monospace;color:var(--a);margin-top:4px}
#sysDefDetail p{margin:4px 0 0;font-size:10.5px;color:var(--dim);line-height:1.45}
#sysDefDetail .acts{display:flex;gap:8px;margin-top:10px}
#sysDefDetail .acts button{flex:1;border-radius:9px;padding:9px;font:800 10.5px/1 system-ui;
  letter-spacing:.12em;cursor:pointer;background:transparent;border:1px solid var(--line);color:var(--mut)}
#sysDefDetail .acts button:hover{color:var(--txt);border-color:var(--line2)}
#sysDefDetail .pk{margin-top:8px;border:1px solid var(--line);border-left:3px solid var(--a);
  border-radius:10px;padding:8px 10px;display:flex;gap:9px;align-items:flex-start;cursor:pointer}
#sysDefDetail .pk:first-child{margin-top:0}
#sysDefDetail .pk.dim{opacity:.42;cursor:not-allowed}
#sysDefDetail .pki{width:22px;height:22px;flex:none;border-radius:7px;display:grid;place-items:center;
  border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--a);font:700 10px/1 ui-monospace,monospace}
#sysDefDetail .pkb{min-width:0;flex:1}
#sysDefDetail .pkn{font:700 11px/1.2 system-ui;color:var(--txt);display:flex;justify-content:space-between;gap:8px}
#sysDefDetail .pkn span{font:700 9.5px/1.2 ui-monospace,monospace;color:var(--dim)}
#sysDefDetail .pkg{font-size:10px;color:var(--dim);line-height:1.4;margin-top:2px}
"""
do(OLD_CSS_ANCHOR, NEW_CSS, label="css block")

# ---------------------------------------------------------------------------
# 3) JS: module-level selection state + icon/colour tables + the render
#    helpers, placed right before renderMap() for locality.
# ---------------------------------------------------------------------------
NEW_JS_BEFORE_RENDERMAP = """/* ---------------------------------------------------------------------
   patch598: the defences row, detail strip and module picker. Selection
   is UI-only (never saved) - `defSel` is null, {slot,mode:"detail"} for a
   tap on a filled card, or {slot,mode:"pick"} for a tap on an empty one.
   Reset whenever the sheet is pointed at a different system (or closed).
--------------------------------------------------------------------- */
let defSel=null, defSelSys=null;
const DEF_ICON={ tur:"TUR", min:"MIN", shd:"SHD", sen:"SEN", han:"HAN" };
const DEF_COLOR={ tur:"var(--cy)", min:"var(--gd)", shd:"var(--vi)", sen:"var(--gr)", han:"var(--dim2)" };
function defClearSel(){ defSel=null; defSelSys=null; }
/* the balance this system can actually spend on its own defences right now -
   its own exotic if it produces one, ore otherwise (same rule dmodPrice() uses). */
function defBalanceLabel(s){
  const ex=s.res?exoDef(s.res):null;
  return fmt(ex?exo(s.res):S.ore)+" "+(ex?ex.n.toUpperCase():"ORE");
}
/* a single card's own odds contribution - "what holdOdds() would be WITHOUT this
   slot" subtracted from what it is WITH it, so the number on the card is always
   traceable to the exact function the fight itself resolves against. Without a
   live threat, this previews against a flat reference weight (Helion, dif 1) so
   the row still means something before anyone is actually inbound. */
function defCardPct(s,slotIdx){
  const th=thqAtSys(s.id)||{rv:"hel",dif:1,sysId:s.id};
  const full=Math.round(holdOdds(th)*100);
  const without=Math.round(holdOdds(th,defStrength(s.id,slotIdx))*100);
  return full-without;
}
function renderSysOdds(s){
  const host=$("#sysOdds"); if(!host)return;
  if(s.home||!sysHeld(s.id)){
    if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true }
    return;
  }
  host.hidden=false;
  const th=thqAtSys(s.id)||{rv:"hel",dif:1,sysId:s.id};
  const pct=Math.round(holdOdds(th)*100), key="odds|"+pct;
  if(host.dataset.h!==key){
    host.dataset.h=key;
    host.innerHTML=`<div class="odds"><span>Garrison holds</span><b>${pct}%</b></div>
      <div class="obar"><i style="width:${pct}%"></i></div>
      <div class="onote">What your defences manage on their own, if you let them fight it without you.</div>`;
  }
}
function defCardHTML(s,i,slot){
  if(!slot){
    const sel=!!(defSel&&defSel.slot===i&&defSel.mode==="pick");
    return `<div class="sc empty${sel?" sel":""}" data-slot="${i}" data-empty="1">
      <div class="si">+</div>
      <div class="n">Empty</div><div class="lv">SLOT ${i+1}</div>
      <div class="e" style="color:var(--dim)">\\u2014</div>
      <button type="button" data-slot="${i}">BUILD</button>
    </div>`;
  }
  const def=DEF_MODULES[slot.m]||{n:slot.m,maxLv:1,oneUse:false};
  const sel=!!(defSel&&defSel.slot===i&&defSel.mode==="detail");
  const building=!!slot.q;
  const spent=slot.m==="min"&&!slot.armed&&!building;
  const armed=slot.m==="min"&&slot.armed;
  let badge="";
  if(building)badge=`<span class="tag">BUILDING</span>`;
  else if(armed)badge=`<span class="tag ok">ARMED</span>`;
  else if(spent)badge=`<span class="tag bad">SPENT</span>`;
  const lvText = building ? `<span class="cardcd" data-slot="${i}"></span>`
    : def.oneUse ? (slot.armed?"ONE USE":"EMPTY")
    : "LV "+slot.lv+"/"+def.maxLv;
  const pct = spent ? 0 : defCardPct(s,i);
  const pctTxt = (pct>=0?"+":"")+pct+"%";
  let btnHTML;
  if(building){
    btnHTML=`<button type="button" disabled><span class="cardcd" data-slot="${i}"></span></button>`;
  } else if(def.oneUse && !slot.armed){
    btnHTML=`<button type="button" class="warn" data-act="rearm" data-slot="${i}">${dmodPrice(s,slot.lv)} \\u00b7 REARM</button>`;
  } else if(!def.oneUse && slot.lv<def.maxLv){
    btnHTML=`<button type="button" data-act="up" data-slot="${i}">${dmodPrice(s,slot.lv)} \\u00b7 UP</button>`;
  } else {
    btnHTML=`<button type="button" disabled>MAXED</button>`;
  }
  return `<div class="sc${sel?" sel":""}" data-slot="${i}" style="--a:${DEF_COLOR[slot.m]||"var(--cy)"}">${badge}
    <div class="si">${DEF_ICON[slot.m]||"?"}</div>
    <div class="n">${def.n}</div><div class="lv">${lvText}</div>
    <div class="e"${spent?' style="color:var(--rd)"':""}>${pctTxt}</div>
    ${btnHTML}
  </div>`;
}
function renderDefDetail(s,slots){
  const host=$("#sysDefDetail"); if(!host)return;
  if(!defSel){ if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true } return; }
  if(defSel.mode==="pick"){
    const i=defSel.slot, key="pick|"+i;
    host.hidden=false;
    if(host.dataset.h!==key){
      host.dataset.h=key;
      const price=dmodPrice(s,0), unit=s.res?exoDef(s.res).n.toUpperCase():"ORE";
      host.innerHTML=Object.keys(DEF_MODULES).map(id=>{
        const def=DEF_MODULES[id];
        const afford=s.res?exo(s.res)>=price:S.ore>=price;
        const usable=!def.disabled&&afford;
        const short = def.disabled?"Not available yet"
          : !afford?("Need "+fmt(price)+" "+unit+" \\u2014 short "+fmt(Math.max(0,price-(s.res?exo(s.res):S.ore)))+" "+unit)
          : def.guidance;
        return `<div class="pk${usable?"":" dim"}" data-m="${id}" style="--a:${DEF_COLOR[id]}">
          <div class="pki">${DEF_ICON[id]}</div>
          <div class="pkb">
            <div class="pkn">${def.n}<span>${price} ${unit}</span></div>
            <div class="pkg">${short}</div>
          </div>
        </div>`;
      }).join("");
      host.querySelectorAll(".pk").forEach(el=>{
        el.onclick=()=>{
          const m=el.dataset.m, def=DEF_MODULES[m]; if(!def||def.disabled)return;
          const price=dmodPrice(s,0), afford=s.res?exo(s.res)>=price:S.ore>=price;
          if(!afford)return;
          if(dmodBuild(s,i,m)){ defSel=null; render(); save(); }
        };
      });
    }
    return;
  }
  const i=defSel.slot, slot=slots[i];
  if(!slot){ defSel=null; if(host.dataset.h!==""){ host.dataset.h=""; host.innerHTML=""; host.hidden=true } return; }
  host.hidden=false;
  const def=DEF_MODULES[slot.m];
  const key="detail|"+slot.m+":"+slot.lv+":"+(slot.armed?1:0)+":"+(slot.q?1:0);
  if(host.dataset.h!==key){
    host.dataset.h=key;
    const unit=s.res?exoDef(s.res).n.toUpperCase():"ORE";
    const costLine = slot.q ? "Building\\u2026"
      : dmodPrice(s,slot.lv)+" "+unit+" \\u00b7 "+dmodBuildSecs(slot.lv)+"s";
    const pctPer=Math.round((DEF_STR[slot.m]||0)*100);
    const effect = def.oneUse ? "Breaks the first wave \\u00b7 +"+pctPer+"% hold while armed"
      : "+"+pctPer+"% hold per level"
        +(slot.m==="shd"?" \\u00b7 +"+Math.round(SHD_HULL_PER*100)+"% hull/level"
          :slot.m==="tur"?" \\u00b7 1 turret/level":"");
    host.innerHTML=`<div class="detail" style="--a:${DEF_COLOR[slot.m]}">
      <div class="dn">${def.n}<span>${costLine}</span></div>
      <div class="de">${effect}</div>
      <p>${def.desc}</p>
      ${slot.q?"":`<div class="acts"><button type="button" id="sshDefSwap">SWAP MODULE</button></div>`}
    </div>`;
    const swapBtn=$("#sshDefSwap");
    if(swapBtn)swapBtn.onclick=()=>{ if(dmodSwap(s,i)){ defSel=null; render(); save(); } };
  }
}
function renderSysDef(s){
  const wrap=$("#sysDefWrap"), head=$("#sysDefHead"), row=$("#sysDefRow");
  if(!wrap)return;
  if(s.home||!sysHeld(s.id)){
    wrap.hidden=true;
    if(head&&head.dataset.h!==""){ head.dataset.h=""; head.innerHTML="" }
    if(row&&row.dataset.h!==""){ row.dataset.h=""; row.innerHTML="" }
    const detail=$("#sysDefDetail");
    if(detail&&detail.dataset.h!==""){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    return;
  }
  if(defSelSys!==s.id){ defSelSys=s.id; defSel=null; }
  wrap.hidden=false;
  const slots=dmodSlots(s.id);
  const filled=slots.filter(Boolean).length;
  const headKey="head|"+filled+"|"+defBalanceLabel(s);
  if(head.dataset.h!==headKey){
    head.dataset.h=headKey;
    head.innerHTML=`<span>Defences</span><span>${filled} of 3 slots \\u00b7 ${defBalanceLabel(s)}</span>`;
  }
  const rowKey=slots.map(sl=>sl?(sl.m+":"+sl.lv+":"+(sl.armed?1:0)+":"+(sl.q?1:0)):"e").join("|")
    +"|sel="+(defSel?defSel.slot+":"+defSel.mode:"-");
  if(row.dataset.h!==rowKey){
    row.dataset.h=rowKey;
    row.innerHTML=slots.map((sl,i)=>defCardHTML(s,i,sl)).join("");
    row.querySelectorAll(".sc").forEach(el=>{
      el.onclick=()=>{
        const i=+el.dataset.slot, mode=el.dataset.empty?"pick":"detail";
        defSel=(defSel&&defSel.slot===i&&defSel.mode===mode)?null:{slot:i,mode};
        render();
      };
    });
    row.querySelectorAll("[data-act]").forEach(btn=>{
      btn.onclick=(ev)=>{
        ev.stopPropagation();
        const i=+btn.dataset.slot, act=btn.dataset.act;
        let ok=false;
        if(act==="up")ok=dmodUpgrade(s,i);
        else if(act==="rearm")ok=dmodRearm(s,i);
        if(ok){ render(); save(); }
      };
    });
  }
  /* live countdown text, independent of the structural guard above - same idiom
     as #sysFort's own .fortcd used to be (tchurn2: never rebuild for a tick). */
  row.querySelectorAll(".cardcd").forEach(el=>{
    const i=+el.dataset.slot, sl=slots[i];
    if(sl&&sl.q) el.textContent=Math.max(0,Math.ceil((sl.q.dueAt-Date.now())/1000))+"s";
  });
  renderDefDetail(s,slots);
}
function renderMap(){"""

do("function renderMap(){", NEW_JS_BEFORE_RENDERMAP, label="pre-renderMap helpers")

# ---------------------------------------------------------------------------
# 4) renderMap(): clear the new containers too when nothing is selected
# ---------------------------------------------------------------------------
OLD_NOSEL = """  if(!s){
    if(sheet)sheet.classList.remove("open");
    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }
    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }
    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }
    return;
  }"""
NEW_NOSEL = """  if(!s){
    if(sheet)sheet.classList.remove("open");
    if(info.dataset.h!==""){ info.dataset.h=""; info.innerHTML="" }
    if(act&&act.dataset.h!==""){ act.dataset.h=""; act.innerHTML="" }
    if(thrBox&&thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }
    defClearSel();
    const oddsBox=$("#sysOdds"); if(oddsBox&&oddsBox.dataset.h!==""){ oddsBox.dataset.h=""; oddsBox.innerHTML=""; oddsBox.hidden=true }
    const defWrap=$("#sysDefWrap");
    if(defWrap&&!defWrap.hidden){
      defWrap.hidden=true;
      const head=$("#sysDefHead"), row=$("#sysDefRow"), detail=$("#sysDefDetail");
      if(head){ head.dataset.h=""; head.innerHTML="" }
      if(row){ row.dataset.h=""; row.innerHTML="" }
      if(detail){ detail.dataset.h=""; detail.innerHTML=""; detail.hidden=true }
    }
    return;
  }"""
do(OLD_NOSEL, NEW_NOSEL, label="renderMap no-selection clear")

# ---------------------------------------------------------------------------
# 5) polish fix 2: drop the duplicate "Incoming fleet" row - home branch
# ---------------------------------------------------------------------------
OLD_HOME_ROWS = """  if(s.home){
    rows=`<div class="sysrow"><span>Structures</span><b>${fmt(tot())}</b></div>
      <div class="sysrow"><span>Output</span><b>${fmt(rate())} /s</b></div>`;
    /* STAGE C: the one place a sab threat can show up per-system - same row the
       ordinary held-system branch below already uses. */
    { const th=thqAtSys(s.id);
      if(th){ const thrv=RIVALMAP[th.rv];
        rows+=`<div class="sysrow"><span style="color:var(--rd)">Incoming fleet</span><b style="color:var(--rd)">${
          thrv?thrv.n+" \\u00b7 ":""}${thqClock(th.t)}</b></div>`; } }
  } else {"""
NEW_HOME_ROWS = """  if(s.home){
    rows=`<div class="sysrow"><span>Structures</span><b>${fmt(tot())}</b></div>
      <div class="sysrow"><span>Output</span><b>${fmt(rate())} /s</b></div>`;
    /* patch598 polish fix: dropped the "Incoming fleet" row here - #sysThreat's own
       red block (held systems, home included) already says rival + clock, so this
       was saying the same thing twice. */
  } else {"""
do(OLD_HOME_ROWS, NEW_HOME_ROWS, label="home Incoming fleet dedupe")

# ---------------------------------------------------------------------------
# 6) held branch: drop the old "Defences" summary row (the row of cards below
#    is the authoritative one now) AND the duplicate "Incoming fleet" row.
# ---------------------------------------------------------------------------
OLD_HELD_ROWS = """    rows=`<div class="sysrow"><span>Yields</span><b style="color:${e?e.col:"var(--cy)"}">${e?e.n:"Ore"}</b></div>`;
    if(held){
      rows+=`<div class="sysrow"><span>Defences</span><b${dmodSlots(s.id).some(Boolean)?' style="color:var(--cy)"':''}>${
          (()=>{ const n=dmodSlots(s.id).filter(Boolean).length; return n?(n+" of 3 fitted"):"none"; })()}</b></div>`;
      /* STAGE 2 (2C): a telegraphed fleet is visible here too, not only on Raids */
      const th=thqAtSys(s.id);
      if(th){ const thrv=RIVALMAP[th.rv];
        rows+=`<div class="sysrow"><span style="color:var(--rd)">Incoming fleet</span><b style="color:var(--rd)">${
          thrv?thrv.n+" \\u00b7 ":""}${thqClock(th.t)}</b></div>`; }
      /* STAGE 3: the live fleet gets its own row too, gold not red, so this one"""
NEW_HELD_ROWS = """    rows=`<div class="sysrow"><span>Yields</span><b style="color:${e?e.col:"var(--cy)"}">${e?e.n:"Ore"}</b></div>`;
    if(held){
      /* patch598: the old one-line "Defences" summary is gone - the row of cards
         below (#sysDefRow) is now the one true, detailed picture of what is fitted.
         The "Incoming fleet" row that used to sit here is gone too, same polish fix
         as the home branch above - #sysThreat's own red block already says it. */
      /* STAGE 3: the live fleet gets its own row too, gold not red, so this one"""
do(OLD_HELD_ROWS, NEW_HELD_ROWS, label="held Defences+Incoming dedupe")

# ---------------------------------------------------------------------------
# 7) the interim FORTIFY placeholder (patch597) -> #sysAct has nothing to show
#    for a held, non-home system any more; the row of cards owns this now.
# ---------------------------------------------------------------------------
OLD_FORTIFY_PLACEHOLDER = """  } else {
    /* patch597: the single FORTIFY button is retired with the old flat defence level -
       PLAN-defences.md's row-of-three-cards UI lands immediately next, in patch598.
       Interim placeholder so the sheet's action area does not reference removed
       functions in between the two patches. */
    const filled=dmodSlots(s.id).filter(Boolean).length;
    const ah=`<div class="sysrow" style="border:0;color:var(--dim)"><span>Defences</span><b>${filled} of 3 slots fitted</b></div>`;
    if(act.dataset.h!==ah){ act.dataset.h=ah; act.innerHTML=ah; }
  }
  /* patch595: under attack - the 4th sheet state. Only a held system (home"""
NEW_FORTIFY_PLACEHOLDER = """  } else {
    /* patch598: FORTIFY is retired - the defences row (renderSysDef(), below)
       replaces it outright, so #sysAct has nothing left to show for a held,
       non-home system. */
    if(act.dataset.h!==""){ act.dataset.h=""; act.innerHTML=""; }
  }
  renderSysOdds(s);
  renderSysDef(s);
  /* patch595: under attack - the 4th sheet state. Only a held system (home"""
do(OLD_FORTIFY_PLACEHOLDER, NEW_FORTIFY_PLACEHOLDER, label="sysAct held branch + wiring")

# ---------------------------------------------------------------------------
# 8) __SD export: expose the new pieces for tests
# ---------------------------------------------------------------------------
do(
    "  dmodBuild,dmodUpgrade,dmodRearm,dmodSwap,dmodLv,dmodSummary,dmodConsumeMines,",
    "  dmodBuild,dmodUpgrade,dmodRearm,dmodSwap,dmodLv,dmodSummary,dmodConsumeMines,\n"
    "  renderSysDef,renderSysOdds,defCardPct,defBalanceLabel,defClearSel,get defSel(){return defSel},\n"
    "  DEF_ICON,DEF_COLOR,",
    label="__SD export additions",
)

# ---------------------------------------------------------------------------
# BUILD bump (same-BUILD convention would apply to a same-day review fix, but
# this is the plan's own next-numbered patch, so BUILD advances normally)
# ---------------------------------------------------------------------------
do("const BUILD=597;", "const BUILD=598;", label="BUILD bump")

open(PATH, "w", encoding="utf-8").write(h)
print("patch598 applied OK")
