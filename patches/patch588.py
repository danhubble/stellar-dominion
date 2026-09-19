import io

"""patch588 - PLAN-ending.md Batch C, item 3: tests.

Adds tests/tsabotage2.js (26 checks) covering the plan's own list for this patch: no
sabotage before pj1 is owned (and separately, S.en below SAB_EN_MIN also blocks it),
sabotage can target home once pj1+S.en+S.end are all eligible, a loss steals exactly
floor(SAB_STEAL*S.en) on both the "hold the line without me" road (holdResolve()) and
the DEFEND-it-yourself road (startDefence()/endDefence()), a win steals nothing on
either road, sabotage never occupies home (S.occ.home stays unset both ways), the same
odds roll happens online and offline (an offline absence does not auto-lose the way an
ordinary held system does), save/load keeps a live sab threat, the old-save sanitiser
still strips any NON-sab entry naming home while keeping a legitimate sab one, and
S.end>0 stops a new sabotage from being chosen. Also covers patch586's holdOdds()
"best held garrison falls back to defend home" fallback, thqPrune() never dropping a
live sab entry, and patch587's copy (the .sab card class/text, Nodes-at-risk figure,
rival:rvSab queued on the first sabotage, and the map's "incoming" marker landing on
Sol Reach's own node).

No new functions needed exporting to window.__SD - patch586 already added
bestHeldSdLv/SAB_CHANCE/SAB_STEAL/SAB_EN_MIN, and everything else the test drives
(holdOdds/holdResolve/startDefence/endDefence/thq*/adopt/gotoTab/setMapSec/render) was
already on it."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old_build="const BUILD=587;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=588;",1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch588 applied")
