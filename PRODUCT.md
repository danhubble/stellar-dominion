# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Idle/strategy fans playing on their phones (mobile web, one-handed, portrait). They enjoy numbers, upgrades, and long-term planning, and check in repeatedly through the day.

## Product Purpose
Stellar Dominion is a single-file mobile idle/strategy game. The player builds structures on planets to earn resources, claims systems across a star map, fights raids and rival fleets, and feeds the Nexus. Success is a player who keeps returning and reaches the Act 3 twist.

## Positioning
A story-driven idle game: an amnesiac player is guided by VEGA, a ship AI who is secretly a rogue AI using them. Map-based empire building carries the narrative (see docs/STORY.md).

## Operating Context
Played on a phone, verified at 390x667 and 390x844. Ships as one HTML file (`dist/stellar-dominion.html`) built from `src/` with `python3 build.py`, hosted on GitHub Pages and installable to the home screen.

## Capabilities and Constraints
- Single HTML file output; CSS in `src/styles/`, JS in `src/js/`, concatenated by `build.py`.
- Never edit `dist/` by hand; edit `src/` and rebuild.
- Tests run from `dist/`, so build before testing (`tools/pcheck.sh`, `node tests/tq2.js`).
- Terms: Empire and Missions tabs, Sol Reach (home system), Nexus, VEGA, factions (Vasht Collective, Helion Reach, The Covenant), Smelter Pod, Mining Drone.
- Habits: mocks before layout changes, one purpose per commit.

## Brand Commitments
Existing name "Stellar Dominion". VEGA's voice is calm, helpful, slightly too keen on the Nexus.

## Product Principles
- The story is the hook; UI should never spoil the VEGA twist.
- Numbers must stay scannable at a glance on a phone.
- One-handed, short sessions.

## Accessibility & Inclusion
No product-specific requirement established yet.
