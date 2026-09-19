#!/usr/bin/env python3
"""
patch617 (BUILD 617) - Run 1/PLAN-open.md, item 1: prologue text alignment.

sceneRender() already computes `has=!!n.who` (whether the current scene line has
a speaker) to show/hide the avatar and the speaker-name label. This patch reuses
that same flag to toggle a class, "solo", on the .scenecard element: present
when the line has no speaker, removed when it does. No new state, no behaviour
change - has was already recomputed every render, this just also reflects it
onto the DOM.

CSS: .scenecard.solo centres its text (scenewho/scenetxt, via .scenebody) both
horizontally and within the card, matching .scenehint's own "TAP TO CONTINUE"
right below it - today a speakerless line reads as broken (left-aligned body
copy sitting above centred hint text, shots/fresh-1-intro.png). Lines WITH a
VEGA/rival avatar are untouched - .scenecard's base rule (flex row,
align-items:flex-start) still applies, unchanged, since .solo is never added
for those lines - the avatar is what makes the left-aligned layout read.

Because #sceneAv is `hidden` (UA-stylesheet display:none) whenever there is no
speaker, .scenebody is already the sole flex item and already spans the card's
full width in that state - so centring its text via .scenecard.solo .scenebody
is sufficient to also satisfy "centred within the card"; no width/flex-basis
override is needed. justify-content:center on .scenecard.solo itself is added
anyway, harmlessly, as the correct behaviour if that ever changes.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=616;", "const BUILD=617;", label="BUILD bump")

# ==================================================================== CSS
do(
    ".scenecard{width:100%;display:flex;align-items:flex-start;gap:12px;min-height:90px}\n",
    ".scenecard{width:100%;display:flex;align-items:flex-start;gap:12px;min-height:90px}\n"
    "/* patch617: no-speaker lines (VEGA_SVG/rivav both absent, #sceneAv hidden) get\n"
    "   this class from sceneRender()'s own existing has=!!n.who flag - centres the\n"
    "   body copy to match .scenehint's already-centred \"TAP TO CONTINUE\" below it.\n"
    "   Lines WITH an avatar never get this class, so their layout is untouched. */\n"
    ".scenecard.solo{justify-content:center;text-align:center}\n"
    ".scenecard.solo .scenebody{text-align:center}\n",
    label="scenecard.solo CSS",
)

# ==================================================================== JS
do(
    '  const n=sceneLines[sceneI], av=$("#sceneAv"), who=$("#sceneWho"), has=!!n.who;\n'
    '  const turned=!!(sceneOpts&&sceneOpts.turned&&n.who==="vega");   /* patch589 */\n'
    "  if(av){ av.hidden=!has; if(has)av.innerHTML=sceneAvatarHTML(n.who,turned); }\n"
    "  if(who){ who.hidden=!has; if(has)who.textContent=sceneWhoName(n.who); }\n",
    '  const n=sceneLines[sceneI], av=$("#sceneAv"), who=$("#sceneWho"), has=!!n.who;\n'
    '  const turned=!!(sceneOpts&&sceneOpts.turned&&n.who==="vega");   /* patch589 */\n'
    "  if(av){ av.hidden=!has; if(has)av.innerHTML=sceneAvatarHTML(n.who,turned); }\n"
    "  if(who){ who.hidden=!has; if(has)who.textContent=sceneWhoName(n.who); }\n"
    "  /* patch617: same has flag, reflected onto the card so a speakerless line can be\n"
    "     centred in CSS - see the .scenecard.solo rule in the stylesheet. */\n"
    '  const card=$(".scenecard"); if(card)card.classList.toggle("solo",!has);\n',
    label="sceneRender solo class toggle",
)

assert h.count("const BUILD=617;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch617 applied OK")
