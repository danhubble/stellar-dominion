#!/usr/bin/env python3
"""
patch609c (same BUILD, review fix) — the context card's sub-line overflowed, and its
empty state read as broken.

Two bugs the coordinator caught in the r1 screenshots:

1. With an exotic, #vCtxSub crammed name+rate into one string
   (ex.n.toUpperCase()+" +"+fmt(r)+"/s") - fine for short names/rates, but at 390px a
   longer name ("IRIDIUM") plus a nonzero rate already ellipsis-truncated the rate
   ("IRIDIUM +0.1…", unify-r1-b-context-card-exotic.png). This is the exact overflow
   patch582b already fixed for #exoStrip's own name/rate pair, and for the same reason:
   one line has to fit the SUM of two strings instead of just the wider of the two.
   Same fix reused here - #vCtxSub is split into #vCtxName over #vCtxRate, stacked in a
   new .ctxnums flex column (mirrors #exoStrip's .exnums), so each line only has to fit
   its own string. Both are still plain .rcard .sub nodes - same 10px weight as the
   ore/DM cards' sub line, nothing new invented.

2. With no exotic, val="—"/sub="—" read as an unloaded/broken card
   (unify-r1-a-fresh-map-solreach.png, unify-r1-d-header-home-no-exotic.png), not a
   deliberate empty state. unify-mock.html already shipped copy for exactly these two
   cases - ctx2 (a system selected with no exotic, e.g. home): "NO EXOTIC HERE", and the
   no-selection card: "MAP ONLY" - so that's what #vCtxName gets instead of a second dash;
   the value line stays "—" either way, per the mock.

#vCtxRate is never left textContent="" - a truly empty text node can collapse a block's
line box to 0 height in some engines, which would make the card taller with an exotic
(two real lines) than without one (one real line + one collapsed line), i.e. exactly the
height shift the coordinator said not to introduce. A "\u00A0" keeps the line real and
invisible instead.

Markup/CSS/JS only - #ctxCard is still non-tappable (no data-res, the three .c-ctx
overrides from patch607 untouched), and nothing outside the .c-ctx card is touched:
no #left, #core, map hint paragraph or tutorial box changes.

Follow-up caught in this same patch's own re-shoot (shots/unify-r1-b2-context-home.png):
"NO EXOTIC HERE" itself ellipsis-truncated to "NO EXOTIC HE…" at 390px (measured:
76px needed, 71px available) - the mock's own copy, never rendered at real width/font,
turned out to have the same overflow this patch exists to fix. Same fix again: split
across the name/rate lines instead of shrinking or truncating - "NO EXOTIC" / "HERE".
"MAP ONLY" measured exactly 43px==43px, no change needed there.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# --- CSS: stacked name/rate column, mirrors #exoStrip's .exnums (patch582b) ---
do(
    '.c-ctx .val{color:var(--a,var(--txt))}\n'
    '.c-ctx .sub{color:var(--a,var(--mut))}\n',
    '.c-ctx .val{color:var(--a,var(--txt))}\n'
    '.c-ctx .sub{color:var(--a,var(--mut))}\n'
    '/* patch609c: name+rate stack instead of sharing one line - see the patch header,\n'
    '   same overflow patch582b fixed for #exoStrip\'s own name/rate pair. */\n'
    '.c-ctx .ctxnums{display:flex;flex-direction:column;min-width:0;overflow:hidden}\n',
    label="ctxnums CSS",
)

# --- markup: #vCtxSub -> .ctxnums wrapping #vCtxName / #vCtxRate ---
do(
    '<button class="rcard c-ctx" id="ctxCard" title="Selected system"><div class="ricon"><i class="exdot" id="ctxDot"></i></div><div><div class="val" id="vCtxVal">—</div><div class="sub" id="vCtxSub">—</div></div></button>',
    '<button class="rcard c-ctx" id="ctxCard" title="Selected system"><div class="ricon"><i class="exdot" id="ctxDot"></i></div><div><div class="val" id="vCtxVal">—</div><div class="ctxnums"><div class="sub" id="vCtxName">—</div><div class="sub" id="vCtxRate">\u00A0</div></div></div></button>',
    label="ctxCard markup",
)

# --- renderCtxCard(): write name/rate separately, empty-state copy from unify-mock.html ---
do(
    '/* patch607 - the header context card. Reads S.msel -> SYSMAP[..].res -> exoDef, same\n'
    '   chain empSysRow()/updateOrbBadge() already read for the same purpose. Runs every\n'
    '   render() tick, unconditionally, like the ore/DM cards it sits beside - it is meant\n'
    '   to answer "what am I looking at" from any tab, not just the map (plan\'s own note:\n'
    '   "that is intended - it tells you what you last looked at"). Written into the same\n'
    '   #vCtxVal/#vCtxSub nodes every time (textContent, never innerHTML) - nothing here\n'
    '   ever rebuilds the button, so it costs nothing extra for tchurn2 to sample it. */\n'
    'function renderCtxCard(){\n'
    '  const dot=$("#ctxDot"), val=$("#vCtxVal"), sub=$("#vCtxSub"), card=$("#ctxCard");\n'
    '  if(!dot||!val||!sub||!card)return;\n'
    '  const s = S.msel ? SYSMAP[S.msel] : null;\n'
    '  const ex = s && s.res ? exoDef(s.res) : null;\n'
    '  if(!ex){\n'
    '    card.style.setProperty("--a","var(--dim)");\n'
    '    val.textContent="—"; sub.textContent="—";\n'
    '    return;\n'
    '  }\n'
    '  card.style.setProperty("--a",ex.col);\n'
    '  const r=exoRate(ex.id);\n'
    '  val.textContent=fmt(exo(ex.id));\n'
    '  sub.textContent=ex.n.toUpperCase()+(r>0?" +"+fmt(r)+"/s":"");\n'
    '}',
    '/* patch607 - the header context card. Reads S.msel -> SYSMAP[..].res -> exoDef, same\n'
    '   chain empSysRow()/updateOrbBadge() already read for the same purpose. Runs every\n'
    '   render() tick, unconditionally, like the ore/DM cards it sits beside - it is meant\n'
    '   to answer "what am I looking at" from any tab, not just the map (plan\'s own note:\n'
    '   "that is intended - it tells you what you last looked at"). Written into the same\n'
    '   #vCtxVal/#vCtxName/#vCtxRate nodes every time (textContent, never innerHTML) -\n'
    '   nothing here ever rebuilds the button, so it costs nothing extra for tchurn2 to\n'
    '   sample it.\n'
    '   patch609c - review fix: name+rate used to share one #vCtxSub line\n'
    '   ("IRIDIUM +0.1/s") which overflowed and ellipsis-truncated the rate for longer\n'
    '   exotic names - the same overflow class patch582b fixed for #exoStrip. Same fix\n'
    '   reused: name and rate now write into their own stacked lines (#vCtxName over\n'
    '   #vCtxRate, inside the .ctxnums column) so each line only has to fit the WIDER of\n'
    '   the two strings, not their sum. Also replaces the old bare "—"/"—" empty state\n'
    '   (read as broken/unloaded, see HANDOVER) with the exact copy unify-mock.html\n'
    '   already ships for these two cases: a selected system with no exotic (e.g. home)\n'
    '   reads "NO EXOTIC HERE" (mock\'s ctx2), nothing selected reads "MAP ONLY" (mock\'s\n'
    '   3rd screen) - the value line stays "—" either way. #vCtxRate always gets a real\n'
    '   character (a non-breaking space when there is no rate) rather than "" - an empty\n'
    '   text node can collapse to zero height, which would make the card taller with an\n'
    '   exotic than without one. */\n'
    'function renderCtxCard(){\n'
    '  const dot=$("#ctxDot"), val=$("#vCtxVal"), name=$("#vCtxName"), rate=$("#vCtxRate"), card=$("#ctxCard");\n'
    '  if(!dot||!val||!name||!rate||!card)return;\n'
    '  const s = S.msel ? SYSMAP[S.msel] : null;\n'
    '  const ex = s && s.res ? exoDef(s.res) : null;\n'
    '  if(!ex){\n'
    '    card.style.setProperty("--a","var(--dim)");\n'
    '    val.textContent="—";\n'
    '    /* patch609c follow-up: "NO EXOTIC HERE" (unify-mock.html\'s ctx2 copy) is 5px too\n'
    '       wide for this card\'s real column at 390px (measured: 76px needed, 71px to give\n'
    '       it) - the mock never hit that limit because it never rendered the card at real\n'
    '       width/font. Same fix as the rate-line overflow above: split across the two\n'
    '       stacked lines instead of shrinking the font or truncating the words - "NO\n'
    '       EXOTIC" / "HERE" reads the same as one phrase and both halves fit with room to\n'
    '       spare. "MAP ONLY" already fits the single name line (measured 43px==43px) so it\n'
    '       keeps the rate line as the nbsp strut, same as every other empty rate line. */\n'
    '    if(s){ name.textContent="NO EXOTIC"; rate.textContent="HERE"; }\n'
    '    else{ name.textContent="MAP ONLY"; rate.textContent="\\u00A0"; }\n'
    '    return;\n'
    '  }\n'
    '  card.style.setProperty("--a",ex.col);\n'
    '  const r=exoRate(ex.id);\n'
    '  val.textContent=fmt(exo(ex.id));\n'
    '  name.textContent=ex.n.toUpperCase();\n'
    '  rate.textContent = r>0 ? "+"+fmt(r)+"/s" : "\\u00A0";\n'
    '}',
    label="renderCtxCard body",
)

assert "const BUILD=609;" in h  # same BUILD - review fix, not a new patch number

open(PATH, "w", encoding="utf-8").write(h)
print("patch609c applied OK")
