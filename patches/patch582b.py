import io

"""patch582b - review follow-up to patch582 (still BUILD 584, not a new patch number -
same "b" convention patch581b used for a same-batch fix found by the plan's own
required check, not a new PLAN item).

The plan's own code-map note for item 1 said to screenshot #exoStrip at 390px with all
4 exotics + Nodes showing large numbers and fix it if the 5th item didn't fit. It
didn't: #exoStrip is flex-wrap:nowrap/overflow:hidden with 5 equal-width flex items
(patch561's fit for 4), and each item laid its banked number and its "+rate/s" span
out SIDE BY SIDE - at ~62px per item that pair only ever fit for small numbers. Two
sizes were built and screenshotted (not guessed): 7 ring-3 + 8 ring-4 held with real
production gave banked figures like "1.01M" and rates like "+64.0K/s" - the rate span's
own right edge measured 48-72px past its own item's 62px-wide box (measured via
getBoundingClientRect on the actual rendered `<b>`/`<span>`, not inferred), because
`#exoStrip`'s overflow:hidden only clips at the STRIP's own left/right edge - nothing
stopped one item's overflowing span from visually running across its neighbours, which
is exactly what the screenshot showed: garbled overlapping digits.

Smallest sensible fix: stack the number over the rate (two lines) inside each item
instead of side by side, so an item's width only has to fit the WIDER of the two
strings, not their sum - the fix that actually addresses "numbers got bigger", not a
band-aid like shaving a few px off the gap (checked: the overflow was 48-72px, a gap
trim could not have closed it). Both `<b>` and `<span>` now sit in a new `.exnums`
column div; `.exi`/`.exnums` both get `overflow:hidden` too, so even a number wide
enough to still not fit gets clipped in place (matching the clip, not ellipsis, choice
the rest of this strip already makes) instead of bleeding into the next item - belt and
braces on top of the real fix. `.exi b`'s old `min-width:6ch` is dropped (it was
fighting the shrink, not helping - a forced minimum is exactly how one item's content
pushed into the next one's space) and the rate span drops from 9.5px to 9px font,
matching how tight 390px genuinely is at 5 items. Re-screenshotted at the same
worst-case (7 ring-3 + 8 ring-4 held, banked exotics at 999.9K-scale) after the fix -
clean, no overlap, see HANDOVER."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old_css=(
'#exoStrip{display:flex;gap:14px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden;align-items:center}\n'
'#exoStrip .exi{flex:1 1 0;min-width:0}\n'
'.exi{display:flex;align-items:center;gap:6px}\n'
'.exi .exdot{width:9px;height:9px;border-radius:50%;background:var(--a);flex:none}\n'
'.exi:not(.held) .exdot{opacity:.35}\n'
'.exi:not(.held){opacity:.45}\n'
'.exi b{font:700 12px/1 ui-monospace,monospace;color:var(--txt);font-variant-numeric:tabular-nums;\n'
'  min-width:6ch;display:inline-block;overflow:hidden;text-overflow:clip;white-space:nowrap}\n'
'.exi span{font:600 9.5px/1 ui-monospace,monospace;color:var(--dim);white-space:nowrap}\n'
)
assert h.count(old_css)==1
new_css=(
'#exoStrip{display:flex;gap:10px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden;align-items:center}\n'
'#exoStrip .exi{flex:1 1 0;min-width:0}\n'
'.exi{display:flex;align-items:center;gap:5px;overflow:hidden}\n'
'.exi .exdot{width:9px;height:9px;border-radius:50%;background:var(--a);flex:none}\n'
'.exi:not(.held) .exdot{opacity:.35}\n'
'.exi:not(.held){opacity:.45}\n'
'/* patch582b: number-over-rate, not side by side - see the patch header for why */\n'
'.exi .exnums{display:flex;flex-direction:column;min-width:0;overflow:hidden}\n'
'.exi b{font:700 12px/1.15 ui-monospace,monospace;color:var(--txt);font-variant-numeric:tabular-nums;\n'
'  display:block;overflow:hidden;text-overflow:clip;white-space:nowrap}\n'
'.exi span{font:600 9px/1.15 ui-monospace,monospace;color:var(--dim);white-space:nowrap;\n'
'  display:block;overflow:hidden;text-overflow:clip}\n'
)
h=h.replace(old_css,new_css,1)

old_render=(
'function renderExoStrip(){\n'
'  const strip=$("#exoStrip");\n'
'  if(!strip)return;\n'
'  let html=EXO.map(e=>{\n'
'    const r=exoRate(e.id), have=exo(e.id), held=r>0||have>0;\n'
'    return `<div class="exi${held?" held":""}" style="--a:${e.col}" title="${e.n}">\n'
'      <i class="exdot"></i>${held?`<b>${fmt(have)}</b><span>${r>0?"+"+fmt(r)+"/s":""}</span>`:""}</div>`;\n'
'  }).join("");\n'
'  /* Exotic Nodes: a 5th strip entry, own colour, hidden until the first ring-3/4\n'
'     claim ever produces or produced one - see enRate()\'s header comment. */\n'
'  const enR=enRate(), enHave=S.en||0;\n'
'  if(enR>0||enHave>0){\n'
'    html+=`<div class="exi held" style="--a:${EN_COL}" title="Exotic Nodes">\n'
'      <i class="exdot"></i><b>${fmt(enHave)}</b><span>${enR>0?"+"+fmt(enR)+"/s":""}</span></div>`;\n'
'  }\n'
'  strip.innerHTML=html;\n'
'}\n'
)
assert h.count(old_render)==1
new_render=(
'function renderExoStrip(){\n'
'  const strip=$("#exoStrip");\n'
'  if(!strip)return;\n'
'  /* patch582b: number and rate stack in their own column now (.exnums) so one\n'
'     item\'s width only has to fit the wider of the two strings, not their sum -\n'
'     see the patch header for the overlap this replaced. */\n'
'  let html=EXO.map(e=>{\n'
'    const r=exoRate(e.id), have=exo(e.id), held=r>0||have>0;\n'
'    return `<div class="exi${held?" held":""}" style="--a:${e.col}" title="${e.n}">\n'
'      <i class="exdot"></i>${held?`<div class="exnums"><b>${fmt(have)}</b><span>${r>0?"+"+fmt(r)+"/s":""}</span></div>`:""}</div>`;\n'
'  }).join("");\n'
'  /* Exotic Nodes: a 5th strip entry, own colour, hidden until the first ring-3/4\n'
'     claim ever produces or produced one - see enRate()\'s header comment. */\n'
'  const enR=enRate(), enHave=S.en||0;\n'
'  if(enR>0||enHave>0){\n'
'    html+=`<div class="exi held" style="--a:${EN_COL}" title="Exotic Nodes">\n'
'      <i class="exdot"></i><div class="exnums"><b>${fmt(enHave)}</b><span>${enR>0?"+"+fmt(enR)+"/s":""}</span></div></div>`;\n'
'  }\n'
'  strip.innerHTML=html;\n'
'}\n'
)
h=h.replace(old_render,new_render,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch582b applied")
