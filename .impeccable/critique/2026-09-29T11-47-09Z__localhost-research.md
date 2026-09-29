---
target: Research tab
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "url:http://localhost:8125/research"
timestamp: 2026-09-29T11-47-09Z
slug: localhost-research
---
Method: dual-agent. Research tab (#p-res, 09-render.js ~1922-2140, 04-panes.css). Score 20/40.
Measured: at 390x667 #view 275px, 0/12 nodes visible on open; 844: 4/12. Text <11px: .rn .nm 8.6px, .rchip b 9.5, .ri-t .lv 9.5, .ri-b 10.5, .k 10. Contrast: .rn.far ~1.8, .rchip.on b 3.93. Tap targets all <44 (RESEARCH 27px, rmbtn 29, rchip 33, programme cost 27). Nodes are divs, not focusable. No errors, 11ms frames.
GLOBAL: off system pages on mobile, #left stack (Scan, Getting Started, stats) sits below #view taking ~240px at 667 (36%).
P0 tree invisible at 667: remove #resCryStrip context card from tab, one-line #rinfo with slab, vertical track per branch (adapt/distill).
P1 buy controls old outline style (#rinfo button, #nmBuy, programme .card button "9 Iridium"); use slab + "need X", violet crystal variant (polish).
P1 signal colours: RESH branch colours reuse signal hues; .rn.sel green; locked in rose; He-3 header gold (colorize).
P1 text <11px, far/locked opacity contrast, no keyboard/focus on nodes (audit/harden).
P2 no feedback beat on research; mirror misClaimFx (animate).
