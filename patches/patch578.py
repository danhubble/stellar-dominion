import io

"""patch578 - PLAN-ending.md Batch A, item 1: Nyx/Thanaris swap.

Owner decision 1: Nyx is the last system, taking the old L75 slot; Thanaris moves
to L69 (the old Nyx slot). Swaps `lvl`, `cost`, `dm`, `yld` between the two SYS
entries only - id/kind/n/ring/sec/sx/sy stay put on each system (sector position is
untouched, per the plan) - and re-files the array so raw order stays sev -> tha ->
oro -> nyx: still strictly ascending cost and non-decreasing lvl, which is what
tmap2.js's "claim costs increase down the list" / "level requirements never
decrease" checks actually read (raw array order, not the `ring` field - see the
PACING PASS comment already sitting a few dozen lines above this block).

GARRISON rows swap the same way: Nyx becomes the harder fight (def:20, arch:"lance",
owner hel), Thanaris the easier one it displaces (def:16, arch:"fortress", owner
cov) - literally trading the two entries' o/def/arch, ids untouched.

Descriptions: Nyx keeps its own first sentence and gains a placeholder second one
about the charts stopping past it (now true - it's the last system). Thanaris
loses "the last charted system" (no longer true) and gets a new placeholder d:.
Both marked /* PLACEHOLDER */ inline for the owner to find and rewrite, same as
every other new story line this batch."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old_sys=(
' {id:"sev", kind:"gas", n:"Sevrin",    ring:4, sec:4, sx:80, sy:78, res:"he", yld:0.380, cost:2.1e26, dm:3200, lvl:67, owner:null,\n'
'  d:"A gas giant the Vasht have been draining for a century."},\n'
' {id:"nyx", kind:"void", n:"Nyx",       ring:4, sec:4, sx:46, sy:90, res:"am", yld:0.200, cost:1.2e27, dm:3700, lvl:69, owner:null,\n'
'  d:"Named for the dark. The survey team that named it did not come back to explain."},\n'
' {id:"oro", kind:"void", n:"Orokh",     ring:4, sec:3, sx:80, sy:78,  res:"am", yld:0.150, cost:6.9e27, dm:4200, lvl:71, owner:null,\n'
'  d:"The Covenant call it holy ground. They will not discuss why."},\n'
' {id:"tha", kind:"void", n:"Thanaris",  ring:4, sec:4, sx:16, sy:58, res:"am", yld:0.260, cost:2.3e29, dm:5500, lvl:75, owner:null,\n'
'  d:"The last charted system. Past it the maps simply stop."}\n'
)
assert h.count(old_sys)==1
new_sys=(
' {id:"sev", kind:"gas", n:"Sevrin",    ring:4, sec:4, sx:80, sy:78, res:"he", yld:0.380, cost:2.1e26, dm:3200, lvl:67, owner:null,\n'
'  d:"A gas giant the Vasht have been draining for a century."},\n'
' {id:"tha", kind:"void", n:"Thanaris",  ring:4, sec:4, sx:16, sy:58, res:"am", yld:0.200, cost:1.2e27, dm:3700, lvl:69, owner:null,\n'
'  d:"A cold void system the Covenant fortified generations ago. What they are guarding there was never explained." /* PLACEHOLDER, patch578 */},\n'
' {id:"oro", kind:"void", n:"Orokh",     ring:4, sec:3, sx:80, sy:78,  res:"am", yld:0.150, cost:6.9e27, dm:4200, lvl:71, owner:null,\n'
'  d:"The Covenant call it holy ground. They will not discuss why."},\n'
' {id:"nyx", kind:"void", n:"Nyx",       ring:4, sec:4, sx:46, sy:90, res:"am", yld:0.260, cost:2.3e29, dm:5500, lvl:75, owner:null,\n'
'  d:"Named for the dark. The survey team that named it did not come back to explain. Past it, the maps simply stop." /* PLACEHOLDER 2nd sentence, patch578 */}\n'
)
h=h.replace(old_sys,new_sys)

old_garr=(
' sev:{o:"vsh",def:15.0, arch:"lance"},    oro:{o:"cov",def:17.0, arch:"ghost"},\n'
' nyx:{o:"cov",def:16.0, arch:"fortress"}, tha:{o:"hel",def:20.0, arch:"lance"}\n'
)
assert h.count(old_garr)==1
new_garr=(
' sev:{o:"vsh",def:15.0, arch:"lance"},    oro:{o:"cov",def:17.0, arch:"ghost"},\n'
' nyx:{o:"hel",def:20.0, arch:"lance"},    tha:{o:"cov",def:16.0, arch:"fortress"}\n'
)
h=h.replace(old_garr,new_garr)

# BUILD bump
old_build="const BUILD=577;"
assert h.count(old_build)==1
h=h.replace(old_build,"const BUILD=578;")

io.open(F,"w",encoding="utf-8").write(h)
print("patch578 applied")
