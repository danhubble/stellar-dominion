#!/usr/bin/env python3
# patch569 — item 3 (Map: sectors instead of one wheel), part 4/4: cleanup.
#
# The renderer (patch567) and the overlay code (patch568) both switched fully onto
# SYS[].sec/sx/sy - grepped and confirmed nothing in the file still reads SYS[].x or
# SYS[].y (the only other x/y-shaped code near the map, drawTreeLines()'s A/B points,
# operates on tech-tree tile DOM rects, unrelated). So the old wheel coordinates come
# out here, leaving sec/sx/sy as the only positions SYS carries.
# (tmap2.js/tmapoverlap2.js were updated directly, not through this HTML patch - see
# HANDOVER; tchurn2.js needed no change, its Map churn checks already covered the
# sector-paged panel and stayed at 0/28.)
import re
F="stellar-dominion-empire2.html"
src=open(F,encoding="utf-8").read()

pat=re.compile(r'ring:(\d+), x:\d+,\s*y:\d+, sec:')
n=len(pat.findall(src))
assert n==27, n
src=pat.sub(r'ring:\1, sec:', src)

open(F,"w",encoding="utf-8").write(src)
print("patch569 OK,", n, "old x,y wheel coords removed")
