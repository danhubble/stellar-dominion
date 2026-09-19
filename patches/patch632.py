#!/usr/bin/env python3
"""
patch632 (BUILD 634) - PLAN-page.md Run 2 follow-up: short-phone header height.

The coordinator's own measurement at 390x667, fresh save, VEGA dismissed, home
tapped: the first buy row (#sysBuildRows .g, Mining Drone) sat top 550 / bottom
614 while #sshScanBar (the pinned SCAN SECTOR bar) sat top 576 - the BUY button
half-covered by the bar. A brand-new player's very first purchase should not
need a scroll to reach it.

Fix: body.syspage #mapWrap and body.syspage #mapWrap.homeonly (patch626's own
34vh page-header band, added right after each other precisely so the .homeonly
case can never silently drift from the base one - see patch626's own comment)
both drop to 26vh under a new @media(max-height:720px) query - 173px at 667,
freeing enough of #view's own height for the first row to clear the pinned bar.
390x844 does not match max-height:720px, so it is untouched: same 34vh as
before. Equal-specificity selectors (body.syspage #mapWrap is identical inside
and outside the query), later in source order, inside a query that only
matches the short case - the standard "override under a query" shape, nothing
new needed to make it win only where it should.
"""
import re

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=633;", "const BUILD=634;", label="BUILD bump")

# ==================================================================== CSS: short-phone override for the
# page-header band. Placed right after the two 34vh rules it overrides (same source-order-wins mechanism
# every other same-specificity override in this file already relies on - see patch626's own comment on
# why .homeonly is listed explicitly rather than left to selector-count arithmetic).
do(
    """body.syspage #mapWrap{height:34vh;max-height:34vh;aspect-ratio:auto;width:auto;
  margin:0 calc(-12px - env(safe-area-inset-right,0px)) 0 calc(-12px - env(safe-area-inset-left,0px));
  border-radius:0;border-left:none;border-right:none}
body.syspage #mapWrap.homeonly{height:34vh;max-height:34vh}
#mapLinks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}""",
    """body.syspage #mapWrap{height:34vh;max-height:34vh;aspect-ratio:auto;width:auto;
  margin:0 calc(-12px - env(safe-area-inset-right,0px)) 0 calc(-12px - env(safe-area-inset-left,0px));
  border-radius:0;border-left:none;border-right:none}
body.syspage #mapWrap.homeonly{height:34vh;max-height:34vh}
/* patch632: on a short phone (max-height:720px - 390x667, not 390x844) the 34vh
   band above leaves #sysBuildRows' first row's own BUY button half-covered by
   #sshScanBar, the pinned SCAN SECTOR bar - a brand-new player's very first
   purchase should never need a scroll to reach it. 26vh is 173px at 667 -
   verified in HANDOVER to clear the bar with no scroll, planet still drawn.
   Equal specificity to the two rules just above, later in source order, only
   inside a query the taller 390x844 case never matches - the standard shape
   for "override under a query", same as the base rule needing no changes. */
@media(max-height:720px){
  body.syspage #mapWrap{height:26vh;max-height:26vh}
  body.syspage #mapWrap.homeonly{height:26vh;max-height:26vh}
}
#mapLinks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}""",
    label="@media(max-height:720px): body.syspage #mapWrap/.homeonly -> 26vh",
)

assert h.count("const BUILD=634;") == 1
assert h.count("@media(max-height:720px)") == 1
assert "body.syspage #mapWrap{height:26vh;max-height:26vh}" in h
assert "body.syspage #mapWrap.homeonly{height:26vh;max-height:26vh}" in h
# the 34vh rules must still exist too (the base, unconditional case taller phones keep) -
# only a NEW conditional override was added, nothing about the original two rules changed.
assert h.count("body.syspage #mapWrap{height:34vh;max-height:34vh;aspect-ratio:auto;width:auto;") == 1
assert h.count("body.syspage #mapWrap.homeonly{height:34vh;max-height:34vh}") == 1
# ordering: the query must come AFTER both 34vh rules (source-order-wins requires it)
assert h.index("body.syspage #mapWrap.homeonly{height:34vh;max-height:34vh}") < h.index("@media(max-height:720px)")
assert h.index("@media(max-height:720px)") < h.index("#mapLinks{position:absolute")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch632 applied OK")
