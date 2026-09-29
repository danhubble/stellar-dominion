---
target: Market tab
total_score: 13
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "url:http://localhost:8125/market"
timestamp: 2026-09-29T12-50-26Z
slug: localhost-market
---
Method: dual-agent. Market tab (#p-mkt, index.html:279-298, 09-render.js:815-930). Score 13/40.
Measured: 0 text <11px, 0 contrast fails, no errors; all 7 .mktsell 27px tall, #mktStatsLink 31px; first sale adds .mktheat line so every card grows 16px and SELL buttons shift (2/3 taps missed); DM section 3-4 screens down; MARKET tab clipped to MARKE at 390.
P0 MAX / high chip sells entire stock in one tap, no confirm (harden).
P1 no visible balances; chip counts output not input (clarify).
P1 sell button old style, no NEED X; use bronze slab for salvage, gold for DM, 44px (polish).
P2 layout shift + DM last; reserve heat line, DM first, compact rows (layout).
P2 no focus-visible on chips/sell/link; prices not mono (audit).
