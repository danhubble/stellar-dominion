#!/usr/bin/env python3
"""
patch625 (BUILD 626) - coordinator review of patch624's screenshots caught a real
rendering bug: content shows BELOW the pinned bar, both for the new `#sshScanBar`
(SCAN SECTOR) and for the pre-existing `#sysThreatActs` (DEFEND IT / LET THEM HOLD).

Cause: `#sysSheet` has `padding-bottom:calc(14px + env(safe-area-inset-bottom,0px))`.
A `position:sticky;bottom:0` child sticks within that padding box - the sheet's own
bottom padding is a live 14px(+) gap below the bar that scrolled content keeps
passing through underneath it. Confirmed empirically (390x667, home, scrolled): bar
bottom 653 vs sheet bottom 667, a 14px gap, with a build row visible inside it.

`#sysThreatActs` carries the identical defect, unrelated to patch622/623/624 - it
existed before any of them, from whenever `#sysThreatActs` first became
`position:sticky;bottom:0`. Fixed here too, same bug wearing a different id.

The coordinator's own suggested mechanism - a negative bottom margin on the bar to
cancel the sheet's padding-bottom - was tried first and measured NOT to work in this
Chromium build: overriding `#sshScanBar`'s `margin-bottom` between `0` and a negative
value that should cancel the sheet's padding produced the exact same stuck bottom
edge either way (empirically confirmed with a throwaway override script before
writing this). What DOES move the stuck edge, confirmed the same way, is the
scrolling ancestor's (`#sysSheet`'s) OWN padding-bottom - reducing it by 8px moved
the bar's bottom edge down by exactly 8px, 1:1. So the actual fix moves in the other
direction from what was first suggested: `#sysSheet`'s own bottom padding is now `0`
(it is redundant anyway - one of `#sshScanBar`/`#sysThreatActs` is ALWAYS visible as
the sheet's true last visual row whenever a system is open, so the sheet-level
padding was never doing anything but creating this gap), and each bar's OWN
bottom padding grows to cover both its previous cosmetic gap AND the safe-area inset
the sheet's padding used to provide. Verified empirically (see the same throwaway
override): with the sheet's own padding-bottom at 0 and the bar's own padding-bottom
carrying the full amount, the bar's rendered bottom edge lands within 0.05px of the
sheet's true bottom edge - as close to zero gap as sub-pixel rounding allows.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=625;", "const BUILD=626;", label="BUILD bump")

# ==================================================================== CSS: #sysSheet - the sheet's own bottom
# padding is redundant (one of the two sticky-bottom bars below is always the sheet's true last visual row
# whenever a system is open) and is what was creating the gap in the first place - drop it to 0.
do(
    "  padding:6px 14px calc(14px + env(safe-area-inset-bottom, 0px));\n",
    "  /* patch625: bottom padding dropped to 0 - it used to be the live gap scrolled\n"
    "     content passed through underneath #sshScanBar/#sysThreatActs (both\n"
    "     position:sticky;bottom:0 - one of the two is always the sheet's true last\n"
    "     visual row whenever a system is open, so this padding was never serving a\n"
    "     purpose of its own, only creating the gap). Both bars now carry their own\n"
    "     safe-area-aware bottom padding instead - see their own rules. */\n"
    "  padding:6px 14px 0;\n",
    label="#sysSheet padding-bottom -> 0",
)

# ==================================================================== CSS: #sysThreatActs
do(
    "#sysThreatActs{position:sticky;bottom:0;margin:10px -14px 0;padding:12px 14px 10px;\n"
    "  background:#0a0e24;border-top:1px solid var(--line);box-shadow:0 -10px 18px -8px rgba(0,0,0,.6);z-index:2}\n",
    "/* patch625: bottom padding now carries the safe-area inset #sysSheet's own\n"
    "   padding-bottom used to (that padding is gone - see #sysSheet's own comment).\n"
    "   Confirmed empirically that a negative bottom MARGIN here does not move this\n"
    "   sticky box's stuck edge at all in this Chromium build - only the scrolling\n"
    "   ancestor's own padding does, which is why the fix lives on #sysSheet, not on\n"
    "   a margin trick on this element - margin stays as it was. */\n"
    "#sysThreatActs{position:sticky;bottom:0;margin:10px -14px 0;\n"
    "  padding:12px 14px calc(10px + env(safe-area-inset-bottom,0px));\n"
    "  background:#0a0e24;border-top:1px solid var(--line);box-shadow:0 -10px 18px -8px rgba(0,0,0,.6);z-index:2}\n",
    label="#sysThreatActs bottom-gap fix",
)

# ==================================================================== CSS: .sshscanbot
do(
    ".sshscanbot{position:sticky;bottom:0;z-index:2;margin:10px -14px 0;\n"
    "  padding:10px 14px calc(6px + env(safe-area-inset-bottom,0px));\n"
    "  background:#0a0e24;border-top:1px solid var(--line);\n"
    "  box-shadow:0 -10px 18px -8px rgba(0,0,0,.6)}\n",
    "/* patch625: same bottom-gap fix as #sysThreatActs, same reason - see that rule's\n"
    "   own comment and patch625's header. Margin unchanged on purpose (a negative\n"
    "   bottom margin here was tried and measured to do nothing). */\n"
    ".sshscanbot{position:sticky;bottom:0;z-index:2;margin:10px -14px 0;\n"
    "  padding:10px 14px calc(20px + env(safe-area-inset-bottom,0px));\n"
    "  background:#0a0e24;border-top:1px solid var(--line);\n"
    "  box-shadow:0 -10px 18px -8px rgba(0,0,0,.6)}\n",
    label=".sshscanbot bottom-gap fix",
)

assert h.count("const BUILD=626;") == 1
assert "padding:6px 14px calc(14px + env(safe-area-inset-bottom, 0px));" not in h
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch625 applied OK")
