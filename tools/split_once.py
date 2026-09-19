#!/usr/bin/env python3
"""One-off: cut stellar-dominion-empire2.html (b638) into src/ at its own banners.
Run once. Kept for history. build.py is the inverse and must reproduce the input
byte for byte (tools/split_once.py verifies that at the end)."""
import os, subprocess, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/stellar-dominion-empire2.html"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = open(SRC, encoding="utf-8").read().split("\n")
assert lines[-1] == "", "file must end with newline"
lines = lines[:-1]
L = lambda a, b: "\n".join(lines[a-1:b]) + "\n"   # 1-based inclusive

# skeleton: everything that is not CSS or JS, with two marker lines
assert lines[6] == "<style>" and lines[1481] == "</style>"
assert lines[1821] == "<script>" and lines[12259] == "</script>"
skeleton = L(1, 7) + "@@CSS@@\n" + L(1482, 1822) + "@@JS@@\n" + L(12260, 12262)

CSS = [  # (file, first line, last line) — banner-aligned, file order
 ("00-base.css",     8, 303),    # :root, reset, notices, top bar, main, tabs, level
 ("01-empire.css", 304, 443),    # generator rows, grouped system list
 ("02-cards.css",  444, 531),    # cards, claiming a contract
 ("03-combat.css", 532, 878),    # fleet & raids, battle
 ("04-panes.css",  879, 1023),   # research, dev panel, stats
 ("05-map.css",   1024, 1341),   # map, system page
 ("06-overlays.css",1342,1481),  # big callout, modal, scene, ending, toasts
]
JS = [
 ("00-core.js",     1823, 2156),  # "use strict", BUILD, storage, helpers, audio
 ("01-content.js",  2157, 3560),  # every table: GENS, LVXP, UNLOCK, EXO, SECTORS, SYS, NEXUS, SHIPS, RAIDS, EK, weapons, crew, loadout
 ("02-state.js",    3561, 3698),  # fresh(), history, systems maths
 ("03-defence.js",  3699, 4509),  # system defences, Exotic Nodes, level()
 ("04-actions.js",  4510, 4646),  # buy/claim/sell actions
 ("05-rivals.js",   4647, 5022),  # rival AI, live fleets
 ("06-progress.js", 5023, 5279),  # progression checks, tick(), frame()
 ("07-kinds.js",    5280, 5303),  # KIND_INFO, gotoTab
 ("08-story.js",    5304, 5485),  # VEGA, RIVAL_MSG, STORY, NOTICES — the copy file
 ("09-render.js",   5486, 7533),  # checkUnlocks, render(), market, system page, map, research, stats
 ("10-raids.js",    7534, 7678),  # raids pane
 ("11-combat.js",   7679, 10395), # engage, battle loop, clip, endBattle, ending
 ("12-save.js",    10396, 11003), # save/load/adopt, story scenes
 ("13-sky.js",     11004, 11213), # starfield, syncSysPage
 ("14-site.js",    11214, 11744), # site view
 ("15-wiring.js",  11745, 11976), # handlers
 ("16-dev.js",     11977, 12146), # dev tools
 ("17-boot.js",    12147, 12259), # boot, __SD export
]
# contiguity
prev = 7
for _, a, b in CSS: assert a == prev + 1, (a, prev); prev = b
assert prev == 1481
prev = 1822
for _, a, b in JS: assert a == prev + 1, (a, prev); prev = b
assert prev == 12259

os.makedirs(f"{ROOT}/src/styles", exist_ok=True)
os.makedirs(f"{ROOT}/src/js", exist_ok=True)
open(f"{ROOT}/src/index.html", "w", encoding="utf-8").write(skeleton)
for f, a, b in CSS:
    open(f"{ROOT}/src/styles/{f}", "w", encoding="utf-8").write(L(a, b))
for f, a, b in JS:
    body = L(a, b)
    if f == "00-core.js":
        assert "const BUILD=638;\n" in body
        body = body.replace("const BUILD=638;\n", "const BUILD=@@BUILD@@;\n", 1)
    open(f"{ROOT}/src/js/{f}", "w", encoding="utf-8").write(body)
print("split done")
