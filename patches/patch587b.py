import io

"""patch587b - PLAN-ending.md Batch C, review follow-up (still b587, not a new BUILD
number - same convention patch581b/patch582b set for a same-batch fix found during the
batch's own testing).

Writing the map-marker test for patch587's "make the sab threat show on Sol Reach's
node like other threats" turned up a pre-existing, unrelated latent bug that was
silently blocking it: both `thqAt(s.id)` call sites on the Map tab (the node's own
"incoming" ring, and the per-system inspector's "Incoming fleet" row) pass a SYSTEM id
(a string, e.g. "kor") into `thqAt(id)`, which has only ever matched a THQ ENTRY's own
`id` (a numeric S.thqSeq sequence number - see startDefence/holdLine, the two call
sites that actually want that lookup). A string can never strictly-equal a number, so
both call sites have always evaluated to null/false for every threat, sab or not -
confirmed by direct reproduction against an ordinary (non-sab) threat on an unrelated
system, pre-dating this batch entirely (patch568, per its own HANDOVER reference in
the plan's code map). Left alone, patch587's own stated deliverable simply would not
work for anyone.

Fixed with a new `thqAtSys(sysId)` (finds an entry by `sysId`, the correct field for
this use, alongside the existing id-keyed `thqAt`) used at exactly those two call
sites - `thqAt` itself is untouched, so startDefence()/holdLine() (the two call sites
that correctly want an entry's own numeric id) are unaffected. This one fix also
happens to repair the "incoming" ring and "Incoming fleet" row for every ORDINARY
threat, not only sab ones - a real, if incidental, improvement outside this batch's
own scope, called out here rather than left unmentioned.

While in there: home's own inspector branch (`if(s.home)`) never had an "Incoming
fleet" row at all (the ordinary held-system branch that gets one is in the `else`),
so a sab threat was invisible on tapping Sol Reach itself even with the map fix above.
Given the same row markup already exists one branch over, added the identical row to
home's branch too - the plan's own "as for other threats" standard, applied to the one
other place a threat is already shown per-system."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---- thqAtSys(): the sysId-keyed lookup the map code actually needs ----
old_thqat='function thqAt(id){ return thq().find(q=>q.id===id)||null }\n'
assert h.count(old_thqat)==1
new_thqat=old_thqat+(
'/* the map code wants "is there a live threat AGAINST this system", which is keyed by\n'
'   sysId, not by a threat entry\'s own id - thqAt(s.id) (a string) could never match\n'
'   q.id (always numeric) and silently returned null/false everywhere it was tried;\n'
'   see patch587b\'s own header for how this was actually found and confirmed. */\n'
'function thqAtSys(sysId){ return thq().find(q=>q.sysId===sysId)||null }\n'
)
h=h.replace(old_thqat,new_thqat,1)

# ---- renderMap(): the node's own "incoming" ring ----
old_inc='    el.classList.toggle("incoming",held&&(!!thqAt(s.id)||(LF&&LF.sysId===s.id)));  /* STAGE 2 (2C) + STAGE 3 live fleet + STAGE C sab */\n'
assert h.count(old_inc)==1
new_inc='    el.classList.toggle("incoming",held&&(!!thqAtSys(s.id)||(LF&&LF.sysId===s.id)));  /* STAGE 2 (2C) + STAGE 3 live fleet + STAGE C sab */\n'
h=h.replace(old_inc,new_inc,1)

# ---- per-system inspector: the "Incoming fleet" row, home branch gains one too ----
old_home_rows=(
'  if(s.home){\n'
'    rows=`<div class="sysrow"><span>Structures</span><b>${fmt(tot())}</b></div>\n'
'      <div class="sysrow"><span>Output</span><b>${fmt(rate())} /s</b></div>`;\n'
'  } else {'
)
assert h.count(old_home_rows)==1
new_home_rows=(
'  if(s.home){\n'
'    rows=`<div class="sysrow"><span>Structures</span><b>${fmt(tot())}</b></div>\n'
'      <div class="sysrow"><span>Output</span><b>${fmt(rate())} /s</b></div>`;\n'
'    /* STAGE C: the one place a sab threat can show up per-system - same row the\n'
'       ordinary held-system branch below already uses. */\n'
'    { const th=thqAtSys(s.id);\n'
'      if(th){ const thrv=RIVALMAP[th.rv];\n'
'        rows+=`<div class="sysrow"><span style="color:var(--rd)">Incoming fleet</span><b style="color:var(--rd)">${\n'
'          thrv?thrv.n+" \\u00b7 ":""}${thqClock(th.t)}</b></div>`; } }\n'
'  } else {'
)
h=h.replace(old_home_rows,new_home_rows,1)

old_th=(
'      /* STAGE 2 (2C): a telegraphed fleet is visible here too, not only on Raids */\n'
'      const th=thqAt(s.id);\n'
)
assert h.count(old_th)==1
new_th=(
'      /* STAGE 2 (2C): a telegraphed fleet is visible here too, not only on Raids */\n'
'      const th=thqAtSys(s.id);\n'
)
h=h.replace(old_th,new_th,1)

# ---- __SD export ----
old_exp='  holdOdds,holdLine,holdResolve,thq,thqAt,thqDrop,thqTick,thqPrune,thqClock,\n'
assert h.count(old_exp)==1
new_exp='  holdOdds,holdLine,holdResolve,thq,thqAt,thqAtSys,thqDrop,thqTick,thqPrune,thqClock,\n'
h=h.replace(old_exp,new_exp,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch587b applied")
