import io

"""patch585 - PLAN-ending.md Batch B, item 4: tests + pacing check.

Adds tests/tnodes2.js (39 checks - see the file header for the full list: EN_RING3/
EN_RING4 rate, occupied systems excluded, tick()/offlineReport() accrual, save round-
trip and its sanitiser, #exoStrip visibility and the patch582b fit fix, req/lock
gating for pj1-pj3, cur:"en" spending Nodes not DM, pjx's dual Nyx+pj3 lock, S.end's
default/clamp, all three multipliers applying exactly once each, nexLv() being a live
passthrough this batch (no suspension - that's Batch D), the DM "Nexus levels" totals
excluding Project nodes, and Nodes never being sellable in Market) plus a printed (not
asserted) Nodes/day + days-to-afford table for the owner - see HANDOVER for the actual
numbers this run produced.

Two functions the test needs were not yet on window.__SD: renderExoStrip() (to force a
redraw of the strip after directly mutating S, the same reason several existing tests
reach for a render* function instead of trusting the frame loop's own `dirty` flag,
which is not itself exported) and mktSvKinds() (to assert "en" is never in the sellable
list, rather than just assuming Market's own EXO-only loop was never touched)."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old_build="const BUILD=584;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=585;",1)

old_exp="  svOrePrice,svCryPrice,svExoPrice,dmOrePrice,renderMarket,openStatsPane};\n"
assert h.count(old_exp)==1
new_exp="  svOrePrice,svCryPrice,svExoPrice,dmOrePrice,renderMarket,openStatsPane,\n  renderExoStrip,mktSvKinds};\n"
h=h.replace(old_exp,new_exp,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch585 applied")
