# PLAN-split — from one file to a project

19 Sep 2026. Base build b638. Done BEFORE PLAN-pacing and everything after it. No
gameplay change of any kind: the build output must be byte-identical to today's
`stellar-dominion-empire2.html` until step 5, and every existing test must pass against
the built file exactly as it does now.

## Why

Every change today goes through an anchor-asserted patch script because editing one
12,262-line file safely needs scaffolding. Splitting it into modules with a build step
keeps the one-file game we ship and makes each change an ordinary edit of a small file.
A repo on top gives history, branches for experiments, and revert — the sheet would
have been a branch. Hosting off that repo makes publishing a push and the game an
installable app.

## Target layout

```
stellar-dominion/
  src/
    index.html          markup skeleton only (today's lines 1483–1821)
    styles/
      base.css          :root, reset, header, tabs, #view, notices    (7–303)
      empire.css        generator rows, system list, map, system page (304–443, 1024–1341)
      combat.css        fleet, raids, battle, defence overlays        (532–878)
      panes.css         research, market, stats, cards, contracts    (444–531, 879–1023)
      overlays.css      modal, scene, ending, dev panel, toasts       (1342–1481)
    js/  (concatenated in this order — it is today's order)
      00-core.js        storage, helpers, audio                       (1827–2156)
      01-content.js     every table: GENS, SHIPS, RAIDS, EK, UNLOCK, LVXP, SECTORS, SYS, EXO, research, nexus
      02-story.js       VEGA, RIVAL_MSG, STORY, NOTICES — the copy file
      03-state.js       fresh(), adopt(), save/load
      04-economy.js     production maths, ladders, market, actions
      05-defence.js     modules, holdOdds, threats, occupation
      06-rivals.js      rival AI, live fleets, sabotage
      07-combat.js      weapons, power, engage, battle loop, clip, endBattle
      08-progress.js    levels, XP, missions, records, unlocks, tick()
      09-render.js      render(), syncSysPage, map, system page, header
      10-panes.js       research, raids, market, nexus, stats renderers
      11-boot.js        wiring, handlers, __SD export
  build.py              src → dist/stellar-dominion.html (one file, same as today)
  dist/                 the built game; what gets published
  tests/                unchanged, pointed at dist/
  tools/                pcheck.sh, csim, mkartifact, screenshot scripts
  docs/                 HANDOVER.md, PLAN-*.md, mocks
  patches/              frozen. History only. No new patch scripts after this.
```

Module boundaries are the file's own banners (`/* ==== state ==== */` etc.). Where a
banner's region references something defined later, that is fine — it is one script
after the build, same as today. No renames, no reordering, no reformatting in the split.

## Steps

1. **Repo.** `git init` in sd-bundle (it is already the folder Dan keeps). First commit:
   everything as it is today, including all 636 patch scripts, so history starts with the
   truth. `.gitignore` for screenshots and scratch.
2. **Split, mechanically.** A one-off script cuts the current file at the line ranges
   above into `src/`. `build.py` concatenates them back. Gate: `build.py` output ===
   the current file, byte for byte (`cmp`). Nothing proceeds until that holds.
3. **Retarget tooling.** Tests, `pcheck`, `csim`, `mkartifact` read `dist/`. Full
   suite runs against the built file; zero failures, csim byte-identical. Commit.
4. **Rules change.** From here: edit `src/`, run `build.py`, test `dist/`, commit with a
   message that says what and why (the HANDOVER entry becomes the commit message; HANDOVER
   itself stays as the narrative log). Effort-level, mocks-first and verification habits
   unchanged. `BUILD` constant becomes a line in `build.py` bumped per release, not per
   commit.
5. **Only after 1–4:** the first real change, which is PLAN-pacing.
6. **Hosting** (same day if the bridge is up): GitHub Pages serving `dist/`. The
   artifact link stays live until the Pages URL is on Dan's phone, then the artifact is
   retired. A `manifest.json` and icon make it installable; a service worker for offline
   is a separate decision (it is a second file the game would fetch — no longer a
   constraint once we host).

## What this costs

One working day at high effort, most of it step 3 (tests reference `file:///home/claude/
stellar-dominion-empire2.html` in ~34 places) and step 6 (needs Dan's computer for the
push). The split itself is safe by construction: if the build isn't byte-identical, it
didn't happen.

## What it does not do

No renames, no dead-code removal (Automation Cores, `S.core`, `S.site`), no CSS tidy,
no test speed-up. Each of those is its own commit afterwards, small, on the new layout.
