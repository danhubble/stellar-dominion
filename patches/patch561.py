import io

"""patch561 - item 1 of PLAN-batch-sep10.md: exotic dots wrap onto a second line.

#exoStrip was `flex-wrap:wrap`, and each dot+number's width grows/shrinks as the
number's digit count changes (e.g. 99.9 -> 999.9), so on narrow screens the 4th
exotic wraps onto a second row and un-wraps again as digits come and go - a
visible height jitter. Fix: `flex-wrap:nowrap; overflow:hidden` on the strip so it
never wraps, `flex:1 1 0;min-width:0` on each item so the four share the row
width evenly and shrink instead of overflowing, and the live number moved into a
tabular-nums span with a fixed min-width (6ch, enough for the widest short form
fmt() produces, e.g. "999.9K") so the number's own width no longer changes the
layout as digits change.

renderExoStrip() already rebuilds the whole strip's innerHTML from a single
template string every render() tick regardless of whether the numbers changed -
this predates patch538/546/548's per-frame-button-identity fix, but exoStrip has
no buttons/handlers inside it (pure display, no onclick), so identity churn there
is not the same bug those patches fixed (nothing loses click-handler wiring by
being rebuilt). Confirmed via tchurn2.js (still 0 failures after this patch -
Empire pane's button set is unaffected) and via Playwright (see HANDOVER). Left
as innerHTML-per-tick since it's cheap and correct, not a behavioural bug - only
the CSS wrap issue is being fixed here, per the plan's scope.

updateOrbBadge()'s single-item badge reuses the same .exi/.exdot classes; it is
not itself a wrapping strip (only one exotic shown at a time) so it needed no CSS
change, but the shared .exi/.exdot rules are edited in place so both stay visually
consistent."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old_css=(
'#exoStrip{display:flex;gap:14px;margin-bottom:10px;flex-wrap:wrap;align-items:center}\n'
'.exi{display:flex;align-items:center;gap:6px}\n'
'.exi .exdot{width:9px;height:9px;border-radius:50%;background:var(--a);flex:none}\n'
'.exi:not(.held) .exdot{opacity:.35}\n'
'.exi:not(.held){opacity:.45}\n'
'.exi b{font:700 12px/1 ui-monospace,monospace;color:var(--txt)}\n'
'.exi span{font:600 9.5px/1 ui-monospace,monospace;color:var(--dim)}\n'
)
assert h.count(old_css)==1
new_css=(
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
h=h.replace(old_css,new_css)

# BUILD bump
old_build="const BUILD=560;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=561;")

io.open(F,"w",encoding="utf-8").write(h)
print("patch561 applied")
