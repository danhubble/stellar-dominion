#!/usr/bin/env python3
"""
mkartifact.py - repackage stellar-dominion.html for publishing as an Artifact.

WHY THIS EXISTS
    The player was downloading a fresh copy of the file for every build - about 150 of
    them on his phone. An Artifact is a page at a fixed URL that can be republished in
    place, so the link he saves once keeps pointing at the newest build.

WHAT HAS TO CHANGE
    The publisher wraps the uploaded file in its own <!doctype>/<html>/<head>/<body>, so
    the file must contain PAGE CONTENT ONLY. A second <html> or <body> in the payload is
    not a warning - it is a broken document. So:

      - <!DOCTYPE>, <html>, </html>, <body>, </body> are dropped
      - <title> is hoisted to the very top: only the first 8KB is scanned for it
      - the <style> block is kept verbatim and simply moves into the body, where it wins
        over the publisher's reset on document order
      - the viewport meta is re-emitted inside the body AND re-asserted from script

    That last one is the only real subtlety. A meta viewport is honoured wherever it sits
    in the document, but it is the difference between a phone-shaped game and a desktop
    page shrunk to 30%, so it is worth asserting twice rather than trusting placement.

DELIBERATELY NOT CHANGED
    Nothing about the game. This script only unwraps and re-tags; it never edits game
    code, so a build that passes the test suite is the build that gets published. Run it
    after any patch and republish.

USAGE
    python3 mkartifact.py                 # stellar-dominion.html -> sd-artifact.html
"""
import io, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "dist/stellar-dominion.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "dist/sd-artifact.html"

h = io.open(SRC, encoding="utf-8").read()

# ---- pull the pieces out of the standalone document -------------------------------
m = re.search(r"<title>(.*?)</title>", h, re.S)
assert m, "no <title> in the source document"
# The standalone file's title doubles as a description ("... - Idle Space Empire"), which
# is right for a browser tab and wrong for the artifact gallery, where the title is the
# page's NAME and sits next to a one-line description of its own.
title = "Stellar Dominion"
print("  source title: %s" % m.group(1).strip())

m = re.search(r"(<style>.*?</style>)", h, re.S)
assert m, "no <style> block in the source document"
style = m.group(1)

m = re.search(r"<body>(.*)</body>", h, re.S)
assert m, "no <body> in the source document"
body = m.group(1).strip()

# The unwrapped payload must not carry a second document shell. Matched with a trailing
# [\s/>] so the check cannot fire on <header>, which is legitimate page content and did
# trip the first, sloppier version of this guard.
for bad in ("<!doctype", "<html", "</html", "<body", "</body", "<head", "</head"):
    hit = re.search(re.escape(bad) + r"[\s/>]", body, re.I)
    assert not hit, "document shell leaked into the payload: %s" % hit.group(0)

# ---- the viewport, asserted twice --------------------------------------------------
# Without this the game renders at desktop width on a phone. The literal tag covers the
# first paint; the script covers the case where a host strips tags it does not expect
# from the body, and is a no-op when the tag is already doing its job.
VIEWPORT = 'width=device-width,initial-scale=1,viewport-fit=cover'
head_bits = (
    '<title>%s</title>\n'
    '<meta name="viewport" content="%s">\n'
    '<script>\n'
    '(function(){\n'
    '  /* The game is a phone-first layout, so a missing viewport is the difference\n'
    '     between playable and a desktop page scaled to nothing. The tag above covers the\n'
    '     first paint from wherever it sits; this MOVES it into <head>, which is where\n'
    '     viewport-fit=cover has to be for iOS to report real safe-area insets - the\n'
    '     notch padding that made the bottom row tappable in the first place. */\n'
    '  try{\n'
    '    var m=document.querySelector(\'meta[name="viewport"]\');\n'
    '    if(!m){ m=document.createElement("meta"); m.name="viewport" }\n'
    '    m.setAttribute("content","%s");\n'
    '    if(m.parentNode!==document.head)document.head.appendChild(m);\n'
    '  }catch(e){}\n'
    '})();\n'
    '</script>\n'
) % (title, VIEWPORT, VIEWPORT)

out = head_bits + style + "\n" + body + "\n"

io.open(OUT, "w", encoding="utf-8").write(out)
print("%s -> %s" % (SRC, OUT))
print("  title:  %s" % title)
print("  bytes:  %d (source %d)" % (len(out), len(h)))
