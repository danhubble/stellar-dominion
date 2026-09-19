#!/usr/bin/env python3
"""
patch628 (BUILD 629) - PLAN-page.md, Run 1 patch 3 of 3: "tests".

Test-only patch: nothing else in this batch needed an HTML-side fix, so this
script's only job is the house-convention BUILD bump. Every substantive change
is in tests/, documented in full in HANDOVER.md's own patch628 entry:

  - tests/topen2.js: rewritten. Lost the whole patch620/623 drag/PEEK/mzVisFrac
    section (none of it exists any more); gained the "a system is a page" 626-628
    coverage the plan asks for (node tap opens the page zoomed, `< MAP` closes the
    whole thing, claimSystem() opens the claimed page with no further tap, an
    unclaimed page's own `< MAP` bar, chips visible after all four named close
    paths, tab-away-then-back scroll reset, Research-tab-does-not-hide-#left, the
    #mapWrap.homeonly specificity trap). One real bug this file's own first run
    caught before it shipped further: the claimSystem() canvas check read pixels
    in the same evaluate() as the claim itself, before the rAF-driven draw() loop
    had painted anything - split into two evaluate() calls with a wait between,
    same pattern the node-tap test right above it already used correctly.
  - tests/tsheet2.js: the X button (#sshClose) and the map-background-tap-to-close
    paths are replaced with `< MAP` (the X button test) and an explicit inverse
    regression guard (background tap no longer closes anything - patch627 deleted
    that handler outright). The whole three-state grab-handle drag section
    (FULL/PEEK/CLOSED) is deleted, not reworded - #sshGrab and __SD.sheetState are
    both gone. Every content-state assertion (UNCLAIMED/CONTESTED/HELD/UNDER
    ATTACK, DOM order, DEFEND IT/LET THEM HOLD, no-churn) needed no change at all.
  - tests/tzoom2.js: `< MAP` now closes the whole page (msel included), not just
    the zoom - the old "back button leaves the sheet open" split no longer exists,
    so its own separate "closing the sheet closes the zoom" test (via #sshClose)
    is gone, not rewritten. Sector change no longer reaches into the page at all
    (setMapSec()'s own zoom-clear was deleted) - rewritten to confirm the chips
    are genuinely unreachable and that a direct setMapSec() call no longer clears
    anything. The save/reload test is FLIPPED: S.msel lives inside S, so it
    survives a reload now (it did not, under the old ephemeral-zoom model) - this
    is also where the coordinator's "old-save note" (S.msel naming a system in
    another sector still opens correctly) is verified. The sector-swipe guard
    gained a second case: an unclaimed (never-zoomed) page must also refuse the
    swipe, since the guard now checks body.syspage rather than mapZoom directly.
  - tests/tscrolldevfix2.js, tests/tunify2.js: both had a scroll-position check
    that targeted #sysSheet directly (dead - it is in-flow now, not a scroll
    container; patch626 already retargeted the real capture/restore logic inside
    renderSysBuild() to #view, see its own comment). Retargeted both tests to
    #view. Along the way, caught a second, genuinely subtle test-authoring bug in
    both: #view carries CSS scroll-behavior:smooth, so a raw `.scrollTop=` write
    to POSITION the test's own fixture animates instead of jumping, and was still
    mid-flight when the test read it back a short wait later. Fixed with
    scrollTo(..., {behavior:'instant'}), the same escape hatch the game's own tab
    handler already uses for the same reason (see its "instant, not smooth"
    comment). Neither was an HTML bug - renderSysBuild()'s own restore already
    uses this correctly - both were the tests' own setup code doing the naive
    thing.
  - tests/thangar2.js: #sysThreatActs' position assertion updated sticky->fixed
    (patch626 changed the CSS; flagged in patch626's own HANDOVER as not named by
    the coordinator but in the same bucket as the other sheet/handle tests).
  - tests/tchurn2.js, tests/tmapoverlap2.js, tests/tlockstates2.js, tests/tmap2.js,
    tests/ttree2.js: read and run in full, needed no changes - either they never
    touched sheet/zoom internals, or (ttree2.js) the one #sysSheet/.open read they
    do is a diagnostic-only console.log with no assertion to break, still correct
    under the new model (msel stays null all through that script, same as before).
  - tests/shotsR2.js, tests/shotsR2b.js: retired to tests/retired/, not updated.
    Both are one-off, non-suite screenshot scripts documenting an already-shipped,
    already-reviewed historical batch (patch610-613/613b) - both reference
    #sshClose, one of them (shotsR2b.js) unguarded, which would throw outright if
    run today. Fixing them would cost the same as writing new coverage for no
    ongoing value, since neither feeds a pass/fail gate; moved as-is, matching how
    tcollapse2.js/tcore2.js/torbfollow2.js were retired earlier.

Full sweep (runall.sh) after all of the above: every t*.js prints 0 failures and
NO JS ERRORS, except three pre-existing, unrelated output-format quirks that
predate this batch and were not touched - tq2.js and tsilhouette2.js use their own
different completion-line conventions ("SD before/after reload" and "ALL PASS (N
checks)" respectively, neither ever printed "0 failures"), and ttree2.js is a
diagnostic script with no ok()/PASS-FAIL assertions to fail in the first place.
All three read clean by hand; none regressed by this batch.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=628;", "const BUILD=629;", label="BUILD bump")

assert h.count("const BUILD=629;") == 1
with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch628 applied OK")
