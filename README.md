# Stellar Dominion

Single-file mobile idle/strategy game. The shipped game is ONE html file,
`dist/stellar-dominion.html`, built from `src/`.

## Layout

```
src/index.html      markup skeleton. Two marker lines: @@CSS@@ and @@JS@@
src/styles/*.css    concatenated in filename order (00-base … 06-overlays)
src/js/*.js         concatenated in filename order (00-core … 17-boot)
build.py            src -> dist/stellar-dominion.html. BUILD number lives here.
dist/               the built game (committed, so the phone link always has a file)
tests/              playwright-core tests. tq2.js = boot check. csim4.js = pacing sim.
tools/              pcheck.sh (JS parses), runall.sh (whole suite), mkartifact2.py
                    (packages dist for the claude.ai artifact), shots/ (screenshot scripts)
docs/               HANDOVER.md (narrative log), PLAN-*.md, sim outputs, mocks
patches/            FROZEN. The patch scripts that built b001–b638. History only.
```

Module boundaries are the old file's own banners. `src/js/08-story.js` is the copy
file (VEGA, RIVAL_MSG, STORY, NOTICES). Nothing was renamed or reordered in the
split: `build.py` output was byte-identical to the last single file (b638).

## Workflow

1. Edit files under `src/`.
2. `python3 build.py` — then `bash tools/pcheck.sh` and `node tests/tq2.js`.
3. Full suite before a commit that ships: `cd tests && bash ../tools/runall.sh`
   (clean = only `SWEEP DONE`, plus `tq2`/`tsilhouette2`/`ttree2` which never print
   a failure count). Pacing sim: `node tests/csim4.js > /tmp/c.txt && cmp /tmp/c.txt
   docs/sim/csim-baseline.txt` — must be identical unless the commit changes pacing
   on purpose, in which case the new output replaces the baseline in the same commit.
4. Commit. The message says what and why (this is the old HANDOVER entry). HANDOVER.md
   stays as the narrative log for anything a commit message can't hold.
5. Release: bump `BUILD` in `build.py`, build, `python3 tools/mkartifact2.py`, publish
   `dist/sd-artifact.html` to the existing artifact URL (never a new one).

Tests take the game from `dist/`, so build before testing. Chromium path defaults to
`/opt/pw-browsers/chromium`; override with `SD_CHROME=/path/to/chromium`.

Habits unchanged: mocks before layout changes, verify at 390x667 AND 390x844, one
purpose per commit, no dead-code or rename passes mixed into feature commits.

## Hosting (GitHub Pages)

`.github/workflows/pages.yml` deploys `dist/` on every push to `main`. `build.py`
writes `dist/index.html` (same bytes as `dist/stellar-dominion.html`) so the Pages
URL opens the game directly; `dist/manifest.json` + `icon-*.png` make it installable
("Add to Home Screen"). One-time setup on GitHub: repo → Settings → Pages → Source:
"GitHub Actions". The claude.ai artifact stays as a fallback link.
