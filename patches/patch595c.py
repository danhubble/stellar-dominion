import io

"""patch595c - review fix found in the same screenshot pass as 595b (BUILD stays
595, same convention). LET THEM HOLD reused the game's global `button.ghost`
class for its muted/secondary look, but `.row button` (line ~1080) is declared
AFTER `button.ghost` (line ~244) in the stylesheet, so on the tie in specificity
between the two `(class + type)` selectors, source order handed the win to
`.row button`'s cyan fill - LET THEM HOLD rendered looking exactly as
"go" as DEFEND IT instead of the mock's deliberately de-emphasised second
choice. One ID-scoped override (specificity (1,1,1), beats the tie outright,
independent of source order) fixes it without touching the shared `.ghost`
class anywhere else it is used."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old="#sysThreatActs[hidden]{display:none}\n"
assert h.count(old)==1
new=(
'#sysThreatActs[hidden]{display:none}\n'
'#sysThreatActs button.ghost{background:transparent;border-color:var(--line);color:var(--mut)}\n'
)
assert new!=old
h=h.replace(old,new,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch595c applied")
