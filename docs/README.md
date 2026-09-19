# Stellar Dominion — dev bundle

- `stellar-dominion.html` — the SHIPPED game. Never edit this one directly.
- `stellar-dominion-empire2.html` — the working/test build. All changes happen here first.
- `sd-empire2-artifact.html` — the working build wrapped for publishing (built by `mkartifact2.py`).
- `bak-good.html` — last known-good backup, promoted at a decision gate.
- `HANDOVER.md` — dated log of every change made, why, and how it was verified.
- `CLAUDE.md` — house rules for how replies should be written (short, plain language).
- `mkartifact2.py` / `mkpreview2.py` — build scripts that wrap the working file for publishing/preview.
- `runall.sh` / `pcheck.sh` — helper scripts for running the test suite / a parse check.
- `tests/` — the regression suite (`t*2.js` + `tq2.js`) and the economy pacing simulator (`csim*.js`).
- `patches/` — every patch script ever applied to the game, in order, as a record of history.

## Normal workflow

1. Never touch `stellar-dominion.html`.
2. Make changes to `stellar-dominion-empire2.html` via a small one-purpose Python patch script (see `patches/` for style/examples), asserting the anchor text exists before replacing it.
3. Verify: md5 the shipped file (must be unchanged), parse-check the script tag, run `tests/tq2.js` (boot check), then the full suite (`for f in tests/t*2.js; do node "$f"; done`) — compare against the known-acceptable baseline noted in `HANDOVER.md`.
4. If the change touches the economy, run `tests/csim4.js` before and after (swap-and-diff) and confirm output is byte-identical unless the change is meant to affect pacing.
5. Regenerate the artifact with `mkartifact2.py`, then publish it.
6. Add a dated entry to `HANDOVER.md`.
