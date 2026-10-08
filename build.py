#!/usr/bin/env python3
"""Build the one-file game: src/ -> dist/stellar-dominion.html
Usage: python3 build.py [--check <file>]   (--check: cmp output against a file)
Concatenation order = sorted filename order in src/styles and src/js."""
import os, sys, glob, filecmp, json, base64, shutil

BUILD = 646   # bumped per release, not per commit

ROOT = os.path.dirname(os.path.abspath(__file__))
def cat(folder):
    files = sorted(glob.glob(os.path.join(ROOT, "src", folder, "*")))
    return "".join(open(f, encoding="utf-8").read() for f in files)

skel = open(os.path.join(ROOT, "src", "index.html"), encoding="utf-8").read()
assert skel.count("@@CSS@@\n") == 1 and skel.count("@@JS@@\n") == 1
js = cat("js")
assert js.count("const BUILD=@@BUILD@@;") == 1
js = js.replace("@@BUILD@@", str(BUILD), 1)
# sound clips: src/audio/sfx/<cue>.ogg, inlined as data URIs (they are small, and the
# game is one file); the music is streamed from dist/audio/ instead (see below)
sfx = {os.path.splitext(os.path.basename(f))[0]:
       "data:audio/ogg;base64," + base64.b64encode(open(f, "rb").read()).decode()
       for f in sorted(glob.glob(os.path.join(ROOT, "src", "audio", "sfx", "*.ogg")))}
assert js.count("@@SAMPLES@@") == 1
js = js.replace("@@SAMPLES@@", json.dumps(sfx, separators=(",", ":")), 1)
out = skel.replace("@@CSS@@\n", cat("styles"), 1).replace("@@JS@@\n", js, 1)

os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "dist", "audio"), exist_ok=True)
for f in glob.glob(os.path.join(ROOT, "src", "audio", "*.mp3")):   # music: a file beside the page
    d = os.path.join(ROOT, "dist", "audio", os.path.basename(f))
    if not os.path.exists(d) or not filecmp.cmp(f, d, shallow=False): shutil.copyfile(f, d)
dst = os.path.join(ROOT, "dist", "stellar-dominion.html")
open(dst, "w", encoding="utf-8", newline="\n").write(out)
open(os.path.join(ROOT, "dist", "index.html"), "w", encoding="utf-8", newline="\n").write(out)   # GitHub Pages entry, same bytes
print(f"built {dst} b{BUILD} {len(out)} bytes")
if len(sys.argv) > 2 and sys.argv[1] == "--check":
    same = filecmp.cmp(dst, sys.argv[2], shallow=False)
    print("IDENTICAL" if same else "DIFFERS"); sys.exit(0 if same else 1)
