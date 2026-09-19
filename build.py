#!/usr/bin/env python3
"""Build the one-file game: src/ -> dist/stellar-dominion.html
Usage: python3 build.py [--check <file>]   (--check: cmp output against a file)
Concatenation order = sorted filename order in src/styles and src/js."""
import os, sys, glob, filecmp

BUILD = 640   # bumped per release, not per commit

ROOT = os.path.dirname(os.path.abspath(__file__))
def cat(folder):
    files = sorted(glob.glob(os.path.join(ROOT, "src", folder, "*")))
    return "".join(open(f, encoding="utf-8").read() for f in files)

skel = open(os.path.join(ROOT, "src", "index.html"), encoding="utf-8").read()
assert skel.count("@@CSS@@\n") == 1 and skel.count("@@JS@@\n") == 1
js = cat("js")
assert js.count("const BUILD=@@BUILD@@;") == 1
js = js.replace("@@BUILD@@", str(BUILD), 1)
out = skel.replace("@@CSS@@\n", cat("styles"), 1).replace("@@JS@@\n", js, 1)

os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
dst = os.path.join(ROOT, "dist", "stellar-dominion.html")
open(dst, "w", encoding="utf-8", newline="\n").write(out)
print(f"built {dst} b{BUILD} {len(out)} bytes")
if len(sys.argv) > 2 and sys.argv[1] == "--check":
    same = filecmp.cmp(dst, sys.argv[2], shallow=False)
    print("IDENTICAL" if same else "DIFFERS"); sys.exit(0 if same else 1)
