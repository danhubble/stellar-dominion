---
target: Empire screen
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:E:\\My Applications\\stellar-dominion-repo\\stellar-dominion\\dist\\stellar-dominion.html"
target_fingerprint: "sha256:9b444b422d8b1be8ee8817399b96f9ab2b8b5f3a1ed4d931d524206bd1a53109"
target_path: "E:\\My Applications\\stellar-dominion-repo\\stellar-dominion\\dist\\stellar-dominion.html"
timestamp: 2026-09-29T10-16-48Z
slug: dist-stellar-dominion-html
---
Method: dual-agent. Score 26/40. Empire screen (Sol Reach), after text/tap/layout/Scan/planet work.
Measured wins: low-contrast 14->0 (CLI), visible <11px text 22->0, tap targets all >=44 except mute (29.5 wide), planet band 34%->25%, no console errors, 11ms frames.
P1 VEGA notice modal (.noticebar, 00-base.css:74) dims screen and covers Scan, recurs on level-up (clarify/harden).
P1 toasts stack uncapped over building rows after MAX buy (#toasts 06-overlays.css:89) (distill).
P1 at 390x667 only one row fits; system header ~130px, duplicate SOL REACH title (layout/adapt).
P2 Buy button (.gb 01-empire.css:60) thin glass pill, no press state, 11px price, BUY x0 copy, opacity .4 disabled; BUY x1 caption 4.1:1 (polish/typeset).
P2 cyan overused, violet decorative in progress bar; Signal Rule broken (colorize).
Note: uniform 11px flattened type hierarchy.
