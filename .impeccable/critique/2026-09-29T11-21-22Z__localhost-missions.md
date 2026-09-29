---
target: Missions tab
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "url:http://localhost:8125/missions"
timestamp: 2026-09-29T11-21-22Z
slug: localhost-missions
---
Method: dual-agent. Missions tab (#p-mis, renderMis 09-render.js:2324). Score 21/40.
Measured: 0 text <11px, 0 contrast fails; CLAIM/CLAIM ALL 34px tall (<44); VEGA banner covers bottom ~109px, last card unreachable at 667 (#view 12px bottom pad); vega:missions banner persists on Missions; no errors, worst frame 12.7ms.
P1 no progress on Active mission (add cur/goal + gold bar) (clarify).
P1 claim buttons flat/34px, no lip/press/focus, inconsistent with .gb (polish).
P1 notice banner hides list content; pad #view by --nbh when nb-on; auto-dismiss vega:missions on opening p-mis (adapt).
P2 inverted hierarchy: status h5 over 11px objective; reward icon unnamed, XP hidden; Completed 0 of 29 card; contradictory hint (clarify/distill).
P2 signal drift: .card.done violet, Active green .ok, .misall stays gold (colorize).
Minor: triple blip per claim; toast drip after Claim All; aria-hidden crystal icon.
