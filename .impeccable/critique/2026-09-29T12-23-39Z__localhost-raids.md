---
target: Raids tab
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "url:http://localhost:8125/raids"
timestamp: 2026-09-29T12-23-39Z
slug: localhost-raids
---
Method: dual-agent. Raids tab (#p-raid, 03-combat.css, 11-combat.js). Score 20/40.
Found P0 global bug: dismissed VEGA banner panel kept pointer-events:auto and swallowed taps above Scan (00-base.css) - fixed locally, pending push.
Sticky #raidTop 178px; at 667 real play ~260px scroll window. >50 text nodes <11px (.risk 8.5px, crew buttons 9.5px, weapon stats 10px). Tap targets: crew buttons 20px, target actions 29px, refits 27px. #flHpT/#bHpT unreadable at low hull (~1.1:1). No errors, 11ms frames.
P1 space: only sub-tabs sticky, fleet strip compacts, single-fleet chip to text (layout/adapt).
P1 buttons/text old style: slabs with verbs and need X, 11px/44px floor (polish/typeset).
P1 signal colours: pink fleet, orange capacity, gold ore rewards, green REPAIR, rose roles; enemy cyan in battle (colorize).
P1 HP label contrast at low hull (harden).
P2 launch has no build-up; RETURN TO EMPIRE mislabelled; no win/loss beat or next step (delight/clarify).
