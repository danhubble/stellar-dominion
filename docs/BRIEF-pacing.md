# Brief — PLAN-pacing on the new repo layout

Repo: `/home/claude/stellar-dominion` (git, branch main, one commit). Read `README.md`
(Workflow) and `docs/PLAN-pacing.md` first. This is the FIRST change under the new
rules: edit `src/`, `python3 build.py`, test `dist/`, commit. No patch scripts.

Working rules
- Run everything from the repo root. `bash tools/pcheck.sh && node tests/tq2.js` after
  every build. Full suite: `cd tests && bash ../tools/runall.sh` (clean = only
  `SWEEP DONE` plus the three no-count files `tq2`/`tsilhouette2`/`ttree2`).
- One commit per lever, in this order, each with a message that says what and why
  (this replaces the old HANDOVER entry). Use `git commit` with the trailer lines:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01KtysoD2g8NwPFeacL27KVd`.
- Do NOT touch `dist/` by hand, `patches/`, `tools/split_once.py`, or `BUILD` in
  `build.py` (I bump it at release). Do not run mkartifact2 or publish.
- Churn guard idiom everywhere a rendered thing changes: `if(el.dataset.h!==key){…}`.
  `tests/tchurn2.js` sweeps on-pane buttons.
- No `Math.random()` in anything `tick()` reaches.

Sim protocol (the plan's one deliberate exception to byte-identical)
- BEFORE any code change: `node tests/csim4.js > /tmp/csim-before.txt` and confirm
  `cmp /tmp/csim-before.txt docs/sim/csim-baseline.txt` is identical.
- After commit 1 and again after commit 2: `node tests/csim4.js > /tmp/csim-after-N.txt`.
  Diff against before. Commit 1 (unlock levels) and commit 2 (Node rates) may move
  rows; commit 3 (explanation) and 4 (tests) must NOT move the sim at all — if they
  do, something else changed, stop and report.
- Final: copy the last output over `docs/sim/csim-baseline.txt` in commit 4, and put
  a short before/after table in `docs/HANDOVER.md` (time to lv 5 / lv 8 / lv 12 /
  first raid / first Node / Resonance Array, whatever csim prints that maps to those;
  say plainly which rows csim cannot tell you).

Commit 1 — unlock levels (`src/js/01-content.js` + every literal)
- `UNLOCK`: map lv 8→5, raids lv 12→9. XP thresholds untouched.
- Replace every `level()<8` / `level()>=8` map-reveal literal with the table entry.
  Add one helper next to `UNLOCK` (e.g. `function unlockLv(p){…}` returning the lv
  for a pane id) and use it. Known sites (grep again yourself, `\b8\b` near `level(`):
  `09-render.js` lines ~221 (`sysInSec`), ~245, ~344, ~425 (`mapRevealBuilt`),
  ~1111 (`homeonly`), ~1115; `12-save.js` ~377 (`S.msel` clamp in `adopt()`).
  NOT `03-defence.js:382` (`nd>=8`, a distance) and NOT `13-sky.js:27` (canvas size).
- Old saves: `checkUnlocks()` (`09-render.js` ~5) queues `vega:map` when
  `unlockedAt("p-map")`; `adopt()` (`12-save.js` ~390) marks it seen. Confirm a
  level-6 save with `S.seen["vega:map"]` already true does not get the notice twice
  and a level-6 save without it gets it once. Same for raids (`vega:raids` or whatever
  the key is — check).
- Check `UNLOCK` order still sorts by lv (Research 5 and Map 5 tie — confirm nothing
  assumes distinct levels; the level-up summary `tlvsummary2.js` may list both).

Commit 2 — Node rates (`src/js/03-defence.js` ~523)
- `EN_RING3=4`, `EN_RING4=12`. Keep the TUNING-PENDING comment. Nothing else.

Commit 3 — tell the player (`src/js/09-render.js` THE PROJECT block ~1774, `08-story.js`)
- Under the "THE PROJECT" header, one line reading the constants:
  "Nodes come from held systems in Frontier (EN_RING3/h each), The Deep and Beyond
  (EN_RING4/h)." — build the text from `EN_RING3`/`EN_RING4` and the sector names
  from `SECTORS`, never hard-code the numbers.
- Each Project card: when `enRate()>0` and not maxed/locked/seized, add a line
  "you make R/h · ~T to go" (R = enRate()*3600 with one decimal, T = human time to
  afford the next level from current `S.en`; "ready" when affordable). Guarded render.
- VEGA `project` beat: fires when the first ring-3-or-higher system is CLAIMED, not
  on first Node. Find where claims happen (`claimSystem()` in `04-actions.js`) and
  the current trigger (`09-render.js` ~22 `if((S.en||0)>0)queueNotice("vega:project")`).
  Move the condition to "any held system with ring>=3". Keep `adopt()`'s seen-marking
  consistent. The line text stays PLACEHOLDER (owner copy) — you may reword it to
  mention that held Frontier systems produce them, marked `/* PLACEHOLDER */`.
- The Project section's visibility gate (`(S.en||0)>0 || enRate()>0`) is unchanged.

Commit 4 — tests + baseline
- `tests/tpacing2.js`: unlock levels are 5/9; map reveals systems at lv 5 (and not at
  4); no double `vega:map` notice on an old save; `EN_RING3===4`, `EN_RING4===12`;
  the header line contains the constants' values; the per-card ETA maths for one
  fixture; VEGA project beat fires on first ring-3 claim with `S.en===0`.
- Update `tunify2`, `topen2`, `tlockstates2`, `ttaborder2`, `tlvsummary2` and any
  other test that hard-codes 8 or 12 for these unlocks. Name each changed assertion in
  the commit message with the reason.
- Full suite clean. Baseline replaced as above. HANDOVER table.

Report back: the four commit hashes, the sim table, every changed assertion, and
anything you deviated from with the reason. Do not summarise the plan back to me.
