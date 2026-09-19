#!/usr/bin/env python3
"""
patch602 — PLAN-zoom.md, patch 1/3: pure refactor, no visible change.

Extracts the system-scene branch of draw() (the `else if(ox&&OW){...}` block that
draws the planet + orbiting sprites for the Empire tab's #orb canvas) into a
standalone function `drawSysScene(g,W,H,vid,t,D)` that takes an explicit 2D
context and dimensions instead of reading the module-level `ox`/`OW`/`OH`
globals directly. `sprite(o)` becomes `sprite(g,o,D)` for the same reason (the
`D` param is unused inside sprite() today, same as before - it is carried
through only for signature parity/future use, exactly like the approved mock's
own `sprite(ctx,o,D)`).

This is prep for patch603 (the map zoom canvas), which will call the same
drawSysScene()/sprite() against a second canvas context - "no second loop, no
extra cost" per the plan, since only one of #orb / the zoom canvas is ever
visible at a time.

Mechanical transform, built programmatically off exact string slices of the
original (not retyped by hand) so the two are provably identical modulo the
renames below - see the asserts:
  - every `ox.` -> `g.` (the new context parameter)
  - `OW`/`OH` -> `W`/`H` (the new dimension parameters) in the body only - the
    call site keeps passing the real `ox`/`OW`/`OH` globals in, unchanged
  - the local gradient variable that was named `g` (the planet's own radial
    gradient) is renamed to `pg` first, so it doesn't collide with the new `g`
    context parameter
  - `sprite(o)` -> `sprite(g,o,D)`
  - `vid` becomes an explicit parameter (computed by the caller exactly as
    before: `evs=S.site==null?empViewSys():null; vid=evs?evs.id:"home"`)
    instead of computed inline; drawSysScene reconstructs `evs` from `vid` as
    `vid==="home"?null:SYSMAP[vid]` - equivalent to the original by
    construction, since evs is non-null in the original iff vid!=="home"
    (empViewSys() never returns the home system - see its own doc comment)
  - `const D=devicePixelRatio;` is dropped inside the function; the caller
    passes `devicePixelRatio` in as the `D` argument instead

Nothing here touches sprite sizing, settlement lights, or the orbit-lane
maths - those are patch604. Verified behaviour-identical by screenshotting
the Empire tab's orb before and after (see /home/claude/shots/zoom-602-*).
"""
import re

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()

# ---------------- sprite(o) -> sprite(g,o,D) ----------------
assert h.count("function sprite(o){") == 1
assert h.count("\nlet ang=0, orbChk=0;") == 1
si = h.index("function sprite(o){")
ei = h.index("\nlet ang=0, orbChk=0;", si)
old_sprite = h[si:ei]
assert old_sprite.endswith("}")

new_sprite = old_sprite.replace("function sprite(o){", "function sprite(g,o,D){", 1)
ox_count = new_sprite.count("ox.")
new_sprite = new_sprite.replace("ox.", "g.")
assert "ox." not in new_sprite
assert new_sprite.count("g.") == ox_count

# ---------------- else-if(ox&&OW) block -> drawSysScene() + short call ----------------
assert h.count("  else if(ox&&OW){") == 1
assert h.count("\n  requestAnimationFrame(draw);") == 1
s2 = h.index("  else if(ox&&OW){")
e2 = h.index("\n  requestAnimationFrame(draw);", s2)
block = h[s2:e2]

head_old = (
    '  else if(ox&&OW){\n'
    '    const D=devicePixelRatio;\n'
    '    ox.clearRect(0,0,OW,OH);\n'
    '    const cx=OW/2, cy=OH*0.52, RY=0.55, R=Math.min(OW*0.125,OH*0.215);\n'
    '    ang+=0.0042;\n'
    '    /* the system currently shown in this view (Empire-tab drill-in), falling back to\n'
    '       home - every building-count below reads THIS system, not the global total. */\n'
    '    const evs=S.site==null?empViewSys():null;\n'
    '    const vid=evs?evs.id:"home";\n'
    '    const vc=gi=>sysTierCount(vid,gi);\n'
)
assert block.count(head_old) == 1, "head_old anchor not found"
tail_marker = "\n  }"
assert block.endswith(tail_marker)
body_rest = block[len(head_old):-len(tail_marker)]

# rename the local planet-gradient var g -> pg BEFORE the ox.->g. pass below,
# so it never collides with the new context parameter also named g
r1 = (
    '    const g=ox.createRadialGradient(cx-R*.45,cy-R*.5,R*.08,cx,cy,R*1.05);\n'
    '    g.addColorStop(0,"#8ee6ff"); g.addColorStop(.42,evKind?evKind.col:"#3a72dd"); g.addColorStop(1,"#0a1236");\n'
    '    ox.fillStyle=g; ox.beginPath(); ox.arc(cx,cy,R,0,6.2832); ox.fill();\n'
)
assert body_rest.count(r1) == 1, "gradient-var anchor not found"
r1new = (
    '    const pg=ox.createRadialGradient(cx-R*.45,cy-R*.5,R*.08,cx,cy,R*1.05);\n'
    '    pg.addColorStop(0,"#8ee6ff"); pg.addColorStop(.42,evKind?evKind.col:"#3a72dd"); pg.addColorStop(1,"#0a1236");\n'
    '    ox.fillStyle=pg; ox.beginPath(); ox.arc(cx,cy,R,0,6.2832); ox.fill();\n'
)
body_rest = body_rest.replace(r1, r1new, 1)

assert body_rest.count("sprite(o)") == 2
body_rest = body_rest.replace("sprite(o)", "sprite(g,o,D)")

ox_count2 = body_rest.count("ox.")
body_rest = body_rest.replace("ox.", "g.")
assert "ox." not in body_rest
assert body_rest.count("g.") >= ox_count2  # >= because pg./pg lines above also add "g."-free text; sanity only

body_rest = re.sub(r'\bOW\b', 'W', body_rest)
body_rest = re.sub(r'\bOH\b', 'H', body_rest)
assert not re.search(r'\bOW\b', body_rest)
assert not re.search(r'\bOH\b', body_rest)

new_head = (
    'function drawSysScene(g,W,H,vid,t,D){\n'
    '  g.clearRect(0,0,W,H);\n'
    '  const cx=W/2, cy=H*0.52, RY=0.55, R=Math.min(W*0.125,H*0.215);\n'
    '  ang+=0.0042;\n'
    '  /* vid is the system id to draw (empViewSys(), falling back to "home"); reconstruct\n'
    '     evs (null exactly when vid is the "home" fallback - empViewSys() never returns\n'
    '     home itself) so the planet-colour fallback below matches the pre-refactor\n'
    '     behaviour exactly, without the caller having to pass evs separately. */\n'
    '  const evs=vid==="home"?null:SYSMAP[vid];\n'
    '  const vc=gi=>sysTierCount(vid,gi);\n'
)
draw_sys_scene = new_head + body_rest + "\n}"

new_call = (
    '  else if(ox&&OW){\n'
    '    const evs=S.site==null?empViewSys():null;\n'
    '    const vid=evs?evs.id:"home";\n'
    '    drawSysScene(ox,OW,OH,vid,t,devicePixelRatio);\n'
    '  }'
)

# ---------------- assemble ----------------
assert h.count("function draw(t){") == 1
draw_marker = "function draw(t){"
di = h.index(draw_marker)

h = h[:si] + new_sprite + h[ei:]              # sprite -> sprite(g,o,D)
# recompute offsets after the sprite edit (lengths shift) by re-finding anchors
assert h.count("  else if(ox&&OW){") == 1
assert h.count("\n  requestAnimationFrame(draw);") == 1
s2 = h.index("  else if(ox&&OW){")
e2 = h.index("\n  requestAnimationFrame(draw);", s2)
h = h[:s2] + new_call + h[e2:]                 # inline block -> short call

assert h.count("function draw(t){") == 1
di = h.index("function draw(t){")
h = h[:di] + draw_sys_scene + "\n" + h[di:]    # insert drawSysScene() right before draw()

h = h.replace("const BUILD=601;", "const BUILD=602;", 1)
assert "const BUILD=602;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch602 applied OK")
