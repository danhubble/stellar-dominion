# Implementer brief — Stellar Dominion ending (read fully before touching anything)

Workspace: /home/claude. You are implementing ONE batch of /home/claude/PLAN-ending.md. Read
that plan fully (all batches, for context), then README.md, then the last ~120 lines of
HANDOVER.md for house style. Do only your batch.

## Files
- `stellar-dominion-empire2.html` — the working build. ALL game changes go here, only via patch
  scripts.
- `stellar-dominion.html` — shipped file. NEVER edit. md5 must stay
  `bcb806896f1a737146d08d7674adbce6`.
- `patches/patchNNN.py` — one script per patch number. Style: see patches/patch561.py and
  patch566.py. Docstring explains what and why. Read file, `assert h.count(anchor)==1` for every
  anchor BEFORE replacing, replace, bump `const BUILD=NNN;` to the patch number, write file.
  A patch that fails an assert must change nothing. One purpose per patch (the plan's numbers).
- `tests/` — Playwright tests (`require('playwright-core')`, file:///home/claude/...,
  internals via `window.__SD`, alias `G`). Add any new internals a test needs to the `__SD`
  export at the end of the script. New tests follow the pattern of tests/tmap2.js and print
  `N failures` as the last result line (`0 failures` when clean) plus `NO JS ERRORS` / `JS ERRORS`.

## After EVERY patch
1. `python3 patches/patchNNN.py`
2. `./pcheck.sh` → must print `JS PARSES OK`
3. `cd tests && node tq2.js` → both lines `object`, no PAGEERROR
4. `md5sum stellar-dominion.html` unchanged

## End of batch
- Full suite: `cd tests && for f in t*2.js; do echo "== $f"; timeout 200 node "$f" 2>&1 | grep -E "failures|^FAIL|PAGEERROR|JS ERRORS|Error" | head -8; done`
  Baseline: ONLY `tcore2.js` has 4 known failures ("old save with the panel hidden" x2 per
  device). Everything else 0 failures. (tq2/tsilhouette2/ttree2 print differently — no
  PAGEERROR/Error means OK.)
- Plain pacing sim must be byte-identical: before your first patch run
  `cd tests && node csim4.js > /home/claude/csim-before-<batch>.txt 2>&1`, after your last patch
  run it again to `csim-after-<batch>.txt` and `diff` them. Any difference = stop and report.
- `python3 mkartifact2.py` (rebuilds sd-empire2-artifact.html). Do NOT publish anything.
- Screenshots at 390x844, deviceScaleFactor 2, of every new visible UI in your batch, saved to
  /home/claude/shots/<batch>-*.png, and look at each one with the Read tool. Fix anything broken
  (overlap, clipped text, unreadable colours) before finishing.
- Append one HANDOVER.md entry per patch (or one batch entry with a sub-section per patch),
  dated 2026-09-11, same tone as existing entries but SHORTER: what changed, where (function
  names), any deviation from the plan and why, test results.

## Rules
- Follow the plan literally. If the plan is wrong or impossible against the real code, pick the
  smallest sensible deviation, write it in HANDOVER and in your final report. Do not redesign.
- All new player-facing story text goes in the `VEGA` / `RIVAL_MSG` / `STORY` blocks and is
  marked `/* PLACEHOLDER */`. Keep lines short (the notice card is small, mobile first).
- Tunable numbers go in named consts marked `TUNING-PENDING`.
- Mobile first: 390px wide must look right. No new external assets.
- Old saves must load cleanly: every new save field defaults in `fresh()` and is sanitised in
  `adopt()`; every new one-shot notice gets an `S.seen` back-fill in `adopt()`.
- Don't touch the ore economy numbers.
- Don't delete or rewrite existing tests to make them pass. If an existing test must change
  because the plan intentionally changes behaviour, say exactly which assertion and why.

## Final report (your last message) — short
- Patches done (number + one line each), BUILD now.
- Deviations from plan.
- Full-suite result per file that is not 0, csim diff result, md5.
- Screenshot paths.
- Anything you think the planner must look at.

## Lessons from earlier batches
- csim4.js runs the real game code with a seeded Math.random. Any new Math.random() call inside
  tick()'s call graph (or anything csim reaches) shifts the stream and breaks the byte-identical
  csim diff. For new randomness in tick paths, hash off `S.cseed` (see the rival picker from
  patch580) or only roll in live-only code csim never reaches. Batch A's accepted csim diff is the
  nyx/tha label swap only — compare against csim-after-batchA.txt, not the b577 output.
- A fresh boot now shows the intro overlay (playScene, patch579). Tests that click real UI on a
  fresh page must dismiss it deterministically (see tmap2/tsave2/tchurn2 `waitForFunction`).
