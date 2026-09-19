#!/usr/bin/env python3
# patch566 — item 3 (Map: sectors instead of one wheel), part 1/4: data only.
#
# Adds per-sector membership + hand-laid per-sector coordinates to SYS (sec, sx, sy),
# matching the owner-approved mock exactly (/home/claude/sd/map-mock.html,
# /home/claude/sd/map-mock-notes.md). The old x,y (wheel coords) are left in place -
# patch567's renderer switches to sx/sy; patch569 removes x,y if nothing still reads
# them. Also introduces SECTORS (chip row data), SEC_LANES (per-sector lane graph)
# and SEC_EXIT (which node in a sector leads onward, and to where) - all static data,
# no renderer changes here.
import re,sys

F="stellar-dominion-empire2.html"
src=open(F,encoding="utf-8").read()

# id -> (ring, x, y) as currently in SYS, used only to build a unique anchor per line;
# sec/sx/sy are the mock's hand-laid values (map-mock-notes.md / map-mock.html SEC_SYS).
ROWS=[
 ("home",0,50,50, 0,50,54),
 ("kor", 1,31,37, 0,22,28),
 ("dra", 1,50,27, 0,52,14),
 ("vel", 1,68,34, 0,80,26),
 ("tan", 1,66,66, 0,78,80),
 ("mir", 1,32,65, 0,20,82),
 ("ash", 2,20,50, 1,14,40),
 ("fer", 2,74,70, 1,78,62),
 ("cor", 2,50,20, 1,52,14),
 ("hal", 2,23,70, 1,18,78),
 ("lys", 2,80,48, 1,88,36),
 ("anv", 3,50,13, 2,78,34),
 ("noc", 2,50,80, 1,52,88),
 ("thu", 3,22,23, 2,24,22),
 ("wra", 3,9, 50, 2,14,64),
 ("cal", 3,22,77, 2,46,86),
 ("erb", 3,77,23, 3,18,18),
 ("sab", 3,91,50, 3,84,26),
 ("zen", 3,78,77, 3,54,52),
 ("vor", 4,9, 31, 3,16,68),
 ("aur", 4,50,6,  4,50,16),
 ("kal", 4,91,31, 4,84,38),
 ("umb", 4,9, 71, 3,46,86),
 ("sev", 4,91,71, 4,80,78),
 ("nyx", 4,50,91, 4,46,90),
 ("oro", 4,34,7,  3,80,78),
 ("tha", 4,66,93, 4,16,58),
]

n_subs=0
for sid,ring,x,y,sec,sx,sy in ROWS:
    m=re.search(r'id:"'+sid+r'".*?ring:'+str(ring)+r', x:'+str(x)+r',\s*y:'+str(y)+r',', src)
    assert m, f"anchor for {sid} not found"
    assert len(re.findall(r'id:"'+sid+r'".*?ring:'+str(ring)+r', x:'+str(x)+r',\s*y:'+str(y)+r',', src))==1, sid
    old=m.group(0)
    new=old+f" sec:{sec}, sx:{sx}, sy:{sy},"
    src=src.replace(old,new,1)
    n_subs+=1
assert n_subs==27, n_subs

anchor="const SYS=[\n"
assert src.count(anchor)==1
sectors_block = '''/* ---------------- map sectors (item 3, patch566) ----------------
   The wheel is replaced by 5 sector "pages" the player swipes/taps between (build
   in patch567); this is just the static data, matching the owner-approved mock
   (/home/claude/sd/map-mock.html, /home/claude/sd/map-mock-notes.md) exactly:
   Core = home + ring1, Inner Reach = ring2, Frontier = ring3 west,
   The Deep = ring3 east + ring4 west, Beyond = ring4 east. Each SYS entry below
   carries sec (0..4, index into SECTORS) and sx/sy (its hand-laid position on that
   sector's own 0-100% box - NOT the old wheel x/y, which stay for now). */
const SECTORS=[
 {key:"core",    n:"Core",        tag:"CORE"},
 {key:"inner",   n:"Inner Reach", tag:"INNER REACH"},
 {key:"frontier",n:"Frontier",    tag:"FRONTIER"},
 {key:"deep",    n:"The Deep",    tag:"THE DEEP"},
 {key:"beyond",  n:"Beyond",      tag:"BEYOND"}
];
/* lane graphs: pairs of system ids to connect within each sector (index into SECTORS) */
const SEC_LANES=[
 [["home","kor"],["home","dra"],["home","vel"],["home","tan"],["home","mir"]],
 [["ash","cor"],["cor","lys"],["ash","hal"],["hal","noc"],["noc","fer"],["fer","lys"]],
 [["thu","wra"],["wra","cal"],["cal","anv"],["thu","anv"]],
 [["erb","sab"],["erb","zen"],["zen","sab"],["zen","vor"],["vor","umb"],["umb","oro"],["oro","sab"]],
 [["aur","kal"],["kal","sev"],["sev","nyx"],["nyx","tha"],["tha","aur"]]
];
/* exit lane: which node in a sector leads onward, and to where (last sector has none) */
const SEC_EXIT=[
 {from:"tan", label:"INNER REACH \\u2192"},
 {from:"fer", label:"FRONTIER \\u2192"},
 {from:"anv", label:"THE DEEP \\u2192"},
 {from:"oro", label:"BEYOND \\u2192"},
 null
];
const SYS=[\n'''
src=src.replace(anchor,sectors_block,1)

open(F,"w",encoding="utf-8").write(src)
print("patch566 OK,", n_subs, "systems tagged with sec/sx/sy")
