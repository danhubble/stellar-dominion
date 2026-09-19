#!/usr/bin/env python3
"""
mkpreview.py - wrap sd-artifact.html the way the Artifact publisher does, so the packaged
payload can be tested locally before it is published.

The publisher wraps the uploaded file in <!doctype html><head>...</head><body> and adds a
minimal CSS reset. Without a local stand-in for that, the only way to find out whether the
unwrapped payload still runs is to publish it and open it on a phone - which is exactly
the loop this whole exercise is trying to shorten.

The reset here is a deliberate over-estimate of what the real one does. If the game
survives a harsher reset than it will actually meet, the real one is not a risk.
"""
import io, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "dist/sd-artifact.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "dist/sd-preview.html"
payload = io.open(SRC, encoding="utf-8").read()

SKELETON = ("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
/* stand-in for the publisher's reset - intentionally more opinionated than the real one */
*,*::before,*::after{box-sizing:border-box}
body{margin:0;padding:0;font-family:system-ui,sans-serif;line-height:1.5;
     background:#ffffff;color:#111111}
img,svg,canvas,video{display:block;max-width:100%}
h1,h2,h3,h4,h5,h6,p{margin:0 0 1em}
</style>
</head>
<body>
""" + payload + """
</body>
</html>
""")

io.open(OUT, "w", encoding="utf-8").write(SKELETON)
print("%s written (%d bytes)" % (OUT, len(SKELETON)))
