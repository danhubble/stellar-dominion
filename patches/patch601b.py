#!/usr/bin/env python3
"""
patch601b — review fix, same BUILD as patch601 (convention: 600b/595b/595c/595d/
587b/etc.): DEF_MINE_RING sat almost exactly on top of the Hangar ships' own draw
radius (0.30 vs 2.6*DEF_RING=0.338), so the detonation flash and the stationed
ships' fixed ring visually merged into one blob in the 601 screenshot pass instead
of reading as two separate things happening near the system. Pulled the mine ring
in to 0.22 - still clearly further out than DEF_LEAK (0.16, where hostiles stop and
start biting) so it still reads as "on approach", but now with real daylight
between it and the Hangar ships parked further out at 0.338.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do(
    """      DEF_MINE_RING=0.30,  /* TUNING-PENDING: fraction of dMin() at which an armed
                               Minefield detonates against the first wave - further
                               out than DEF_LEAK (0.16), so it visibly happens on
                               approach, before anything starts biting the hull. */""",
    """      DEF_MINE_RING=0.22,  /* TUNING-PENDING: fraction of dMin() at which an armed
                               Minefield detonates against the first wave - further
                               out than DEF_LEAK (0.16, where hostiles stop and start
                               biting), and clear of the Hangar ships' own fixed draw
                               radius (2.6*DEF_RING=0.338) so the flash and the ships
                               read as two separate things, not one overlapping ring. */""",
    label="DEF_MINE_RING tuning",
)

open(PATH, "w", encoding="utf-8").write(h)
print("patch601b applied OK")
