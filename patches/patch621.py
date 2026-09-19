#!/usr/bin/env python3
"""
patch621 (BUILD 622) - Patch C / PLAN-open.md Run 2 item 2: the defence gate.

On a just-claimed exotic-kind system, renderSysDef() drew three Empty slot
cards with live BUILD buttons before the player had banked a single unit of
that system's own exotic - dmodBuild()/dmodUpgrade() both price a slot in
exactly that exotic (dmodPrice()), so with none banked all three are dead
controls the moment they render (shots/fresh-3-defences.png).

One branch added before the slots render: while nothing is filled yet AND the
system's own exotic (s.res) has never once been banked (exoEverBanked(s.res),
the same one-way-forever gate patch613c already uses for #exoStrip), the
DEFENCES header keeps its normal "N of 3 slots - balance" line and gains one
dim sentence naming what's needed; #sysDefRow is left empty outright - not
three disabled cards, nothing to tap at all. The instant that exotic is ever
banked (or a slot gets filled some other way), the gate drops permanently,
same exoEverBanked() semantics as everywhere else it's used: no un-hiding
tested, none needed.

Ore-kind systems (s.res===null, e.g. Draskhold) are never gated - dmodPrice()
prices their slots in plain ore instead, which the player always has some of,
so there is no dead-control problem for them to begin with.

Both dataset.h keys (head and row) now include the gate flag, not just filled
count - required by the plan and confirmed against the actual failure mode: with
filled staying 0 across the banking moment, the OLD headKey/rowKey (built purely
from filled + slot contents) would be byte-identical before and after the first
bank, and the churn guard would never re-render the newly-unlocked cards at all.
Tested for exactly that transition, not just the initial gated state (see
HANDOVER for the Playwright check: gated -> bank the exotic -> render() again ->
real cards appear, all in one page session, no reload).
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=621;", "const BUILD=622;", label="BUILD bump")

# ==================================================================== CSS
do(
    "#sysDefHead{font:600 9.5px/1 system-ui;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;\n"
    "  margin:14px 0 7px;display:flex;justify-content:space-between;gap:8px}\n",
    "#sysDefHead{font:600 9.5px/1 system-ui;letter-spacing:.18em;color:var(--dim);text-transform:uppercase;\n"
    "  margin:14px 0 7px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}\n"
    "/* patch621: the defence gate's one dim line - sentence case, not the header's own\n"
    "   uppercase/tracked style, so it reads as a helper note not a section label.\n"
    "   flex-basis:100% (on a flex-wrap:wrap parent, added above) forces it onto its\n"
    "   own row under the existing \"Defences ... N of 3 slots\" line rather than\n"
    "   squeezing into the same row as them. */\n"
    ".defgatehint{flex:1 0 100%;margin-top:2px;font:600 10.5px/1.45 system-ui;\n"
    "  letter-spacing:0;text-transform:none;color:var(--dim)}\n",
    label="defgatehint CSS",
)

# ==================================================================== JS: renderSysDef()
do(
    "  if(defSelSys!==s.id){ defSelSys=s.id; defSel=null; }\n"
    "  wrap.hidden=false;\n"
    "  const slots=dmodSlots(s.id);\n"
    "  const filled=slots.filter(Boolean).length;\n"
    '  const headKey="head|"+filled+"|"+defBalanceLabel(s);\n'
    "  if(head.dataset.h!==headKey){\n"
    "    head.dataset.h=headKey;\n"
    '    head.innerHTML=`<span>Defences</span><span>${filled} of 3 slots \\u00b7 ${defBalanceLabel(s)}</span>`;\n'
    "  }\n"
    '  const rowKey=slots.map(sl=>sl?(sl.m+":"+sl.lv+":"+(sl.armed?1:0)+":"+(sl.q?1:0)):"e").join("|")\n'
    '    +"|sel="+(defSel?defSel.slot+":"+defSel.mode:"-");\n'
    "  if(row.dataset.h!==rowKey){\n"
    "    row.dataset.h=rowKey;\n"
    "    row.innerHTML=slots.map((sl,i)=>defCardHTML(s,i,sl)).join(\"\");\n"
    '    row.querySelectorAll(".sc").forEach(el=>{\n'
    "      el.onclick=()=>{\n"
    '        const i=+el.dataset.slot, mode=el.dataset.empty?"pick":"detail";\n'
    "        defSel=(defSel&&defSel.slot===i&&defSel.mode===mode)?null:{slot:i,mode};\n"
    "        render();\n"
    "      };\n"
    "    });\n"
    '    row.querySelectorAll("[data-act]").forEach(btn=>{\n'
    "      btn.onclick=(ev)=>{\n"
    "        ev.stopPropagation();\n"
    '        const i=+btn.dataset.slot, act=btn.dataset.act;\n'
    "        let ok=false;\n"
    '        if(act==="up")ok=dmodUpgrade(s,i);\n'
    '        else if(act==="rearm")ok=dmodRearm(s,i);\n'
    "        if(ok){ render(); save(); }\n"
    "      };\n"
    "    });\n"
    "  }\n",
    "  if(defSelSys!==s.id){ defSelSys=s.id; defSel=null; }\n"
    "  wrap.hidden=false;\n"
    "  const slots=dmodSlots(s.id);\n"
    "  const filled=slots.filter(Boolean).length;\n"
    "  /* patch621: gated only while nothing is filled yet AND this system's own exotic\n"
    "     has never once been banked - dmodBuild()/dmodUpgrade() price a slot in exactly\n"
    "     that exotic (dmodPrice()), so with none banked every Empty card's BUILD button\n"
    "     is a dead control. Ore-kind systems (s.res===null) price in plain ore instead -\n"
    "     never gated, there is nothing to wait for. Permanent once cleared, same\n"
    "     exoEverBanked() one-way semantics as #exoStrip (patch613c). */\n"
    "  const gated = !!(s.res && !exoEverBanked(s.res) && filled===0);\n"
    "  /* both keys below carry the gate flag, not just filled - filled stays 0 across\n"
    "     the banking moment itself, so without this the churn guard would never notice\n"
    "     the transition and the real cards would never appear the first time the\n"
    "     exotic is banked. */\n"
    '  const headKey="head|"+filled+"|"+defBalanceLabel(s)+"|g"+(gated?s.res:"0");\n'
    "  if(head.dataset.h!==headKey){\n"
    "    head.dataset.h=headKey;\n"
    '    head.innerHTML=`<span>Defences</span><span>${filled} of 3 slots \\u00b7 ${defBalanceLabel(s)}</span>`\n'
    "      +(gated?`<div class=\"defgatehint\"><!-- PLACEHOLDER: patch621, owner rewrites all "
    "story/tutorial copy later -->Bank ${exoDef(s.res).n.toLowerCase()} here to fit defences.</div>`:\"\");\n"
    "  }\n"
    "  const rowKey = gated\n"
    '    ? "gated|"+s.res\n'
    '    : slots.map(sl=>sl?(sl.m+":"+sl.lv+":"+(sl.armed?1:0)+":"+(sl.q?1:0)):"e").join("|")\n'
    '      +"|sel="+(defSel?defSel.slot+":"+defSel.mode:"-");\n'
    "  if(row.dataset.h!==rowKey){\n"
    "    row.dataset.h=rowKey;\n"
    '    row.innerHTML = gated ? "" : slots.map((sl,i)=>defCardHTML(s,i,sl)).join("");\n'
    "    if(!gated){\n"
    '      row.querySelectorAll(".sc").forEach(el=>{\n'
    "        el.onclick=()=>{\n"
    '          const i=+el.dataset.slot, mode=el.dataset.empty?"pick":"detail";\n'
    "          defSel=(defSel&&defSel.slot===i&&defSel.mode===mode)?null:{slot:i,mode};\n"
    "          render();\n"
    "        };\n"
    "      });\n"
    '      row.querySelectorAll("[data-act]").forEach(btn=>{\n'
    "        btn.onclick=(ev)=>{\n"
    "          ev.stopPropagation();\n"
    '          const i=+btn.dataset.slot, act=btn.dataset.act;\n'
    "          let ok=false;\n"
    '          if(act==="up")ok=dmodUpgrade(s,i);\n'
    '          else if(act==="rearm")ok=dmodRearm(s,i);\n'
    "          if(ok){ render(); save(); }\n"
    "        };\n"
    "      });\n"
    "    }\n"
    "  }\n",
    label="renderSysDef gate branch",
)

assert h.count("const BUILD=622;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch621 applied OK")
