---
name: Stellar Dominion
description: A dark command-console idle game: solid tactile controls and precise readouts over deep space.
colors:
  void-black: "#04050d"
  deep-navy: "#080b1c"
  console-panel: "rgba(14, 19, 42, 0.72)"
  console-panel-raised: "rgba(20, 26, 54, 0.85)"
  edge-line: "rgba(96, 142, 255, 0.20)"
  edge-line-active: "rgba(96, 142, 255, 0.38)"
  starlight-text: "#dde5ff"
  muted-blue: "#8390bd"
  dim-blue: "#7683ad"
  faint-blue: "#7280ae"
  scan-cyan: "#48e2ff"
  nexus-violet: "#a878ff"
  credit-gold: "#ffd166"
  go-green: "#5ce6a5"
  alarm-rose: "#ff6b8a"
  silver-steel: "#a9bcd4"
  salvage-bronze: "#b97a45"
  kind-ore: "#ffb45c"
  kind-rock: "#c7b299"
  kind-belt: "#8fb8ff"
  kind-ice: "#79c6ef"
typography:
  brand:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.30em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.14em"
  numeral:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.15
rounded:
  xs: "4px"
  sm: "7px"
  md: "9px"
  lg: "11px"
  xl: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "12px"
components:
  button-scan:
    backgroundColor: "{colors.scan-cyan}"
    textColor: "#04121a"
    typography: "{typography.title}"
    rounded: "{rounded.xl}"
    padding: "14px 10px 15px"
  slab-ore:
    backgroundColor: "#1d4460"
    textColor: "{colors.scan-cyan}"
    rounded: "{rounded.md}"
    height: "44px"
  slab-reward:
    backgroundColor: "#e9b444"
    textColor: "#2b1c00"
    rounded: "{rounded.md}"
    height: "44px"
  slab-crystal:
    backgroundColor: "#7a52d6"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "44px"
  slab-salvage:
    backgroundColor: "{colors.salvage-bronze}"
    textColor: "#1e0f04"
    rounded: "{rounded.md}"
    height: "44px"
  slab-disabled:
    backgroundColor: "rgba(255, 255, 255, 0.035)"
    textColor: "{colors.muted-blue}"
    rounded: "{rounded.md}"
    height: "44px"
  chip:
    backgroundColor: "{colors.console-panel}"
    textColor: "{colors.muted-blue}"
    rounded: "{rounded.md}"
    height: "44px"
  chip-selected:
    textColor: "{colors.starlight-text}"
  generator-row:
    backgroundColor: "{colors.console-panel}"
    textColor: "{colors.starlight-text}"
    rounded: "{rounded.lg}"
    padding: "9px 10px"
  resource-card:
    backgroundColor: "{colors.console-panel}"
    textColor: "{colors.starlight-text}"
    rounded: "10px"
    padding: "6px 8px"
---

# Design System: Stellar Dominion

## Overview

**Creative North Star: "The Command Console"**

Stellar Dominion looks like the instrument panel of a ship: dark panels with thin blue edge lines over a live starfield, painted planets turning in the scene, and controls that feel like physical keys. Numbers are the hero, set in monospace and coloured by what they are. Everything else stays quiet so the numbers read at a glance, one-handed, in short sessions.

Controls are solid and tactile. Every action a player pays for is a raised slab with a darker lip that presses down, and the slab's colour says what it spends. Moments that matter confirm themselves the way a console would: a status label types itself in behind a blinking cursor. The game never goes cartoony or candy-bright.

**Key Characteristics:**
- Deep-space navy base with a faint violet and cyan atmospheric glow.
- Solid slab buttons for every purchase; the fill colour is the currency.
- Monospace numerals; uppercase tracked labels at 11px and up.
- Colour as signal, never decoration.
- Phone-first: verified at 390x667 and 390x844, 44px tap targets.

## Colors

A near-black navy field with cold blue-grey text, and a small set of signal hues that each carry one meaning.

### Primary
- **Scan Cyan** (#48e2ff): act, and ore. The Scan key, ore prices and ore slabs, ENGAGE, live map lanes.

### Secondary
- **Nexus Violet** (#a878ff): crystal, research and the Nexus. Research and Nexus slabs, the Project chamber, linked-state dots.
- **Credit Gold** (#ffd166): reward. Missions, Dark Matter, ready-to-claim, XP. Gold slabs claim missions and buy Dark Matter.
- **Salvage Bronze** (#b97a45): anything paid or earned in salvage (weapons, refits, crew, market sales for salvage). Chosen because salvage is scrap: rougher and dirtier than ore's clean cyan.

### Tertiary
- **Go Green** (#5ce6a5): good news and done. Income rates, claimed/fulfilled confirmations, the home system.
- **Alarm Rose** (#ff6b8a): danger and enemies. Threats, enemy-held systems on the map (whoever holds them), enemy ships and their health rings in battle, risk labels at the high end.

### Neutral
- **Void Black** (#04050d), **Deep Navy** (#080b1c): backgrounds.
- **Console Panel** / **Console Panel Raised**: card and sheet surfaces.
- **Edge Line** / **Edge Line Active**: all borders and dividers.
- **Starlight Text** (#dde5ff): primary text.
- **Muted Blue** (#8390bd), **Dim Blue** (#7683ad), **Faint Blue** (#7280ae): secondary text. All three pass 4.5:1 on panels; nothing the player must read goes dimmer than Faint Blue.
- **Silver Steel** (#a9bcd4): neutral identity accent (research branches, crew roles, refits, the salvage icon).
- **System-kind colours** (ore, rock, gas, belt, ice, void, home): planets, system rows and map bodies. Read by the JS at boot from `--k-*`.

### Named Rules
**The Signal Rule.** Each bright hue has one meaning: cyan act/ore, violet crystal/Nexus, gold reward, bronze salvage, green good/done, rose danger/enemy. Never borrow one to tell things apart; use Silver Steel for identity.

**The Enemy Is Red Rule.** Anything hostile is rose, regardless of faction. Faction colours are for faction names only; they are never used for system dots or ships, because some collide with the signal colours (Vasht's green is home's green).

**The Kind Tint Rule.** A held system row takes its kind colour as a wash, a border and an inset left bar; stat text on that wash must clear 4.5:1.

## Typography

**Display / Body Font:** system-ui stack
**Numeral / Label Font:** ui-monospace stack

**Character:** Utilitarian system type for words, monospace for every number and readout. It reads like a console, not a brand.

### Hierarchy
- **Brand** (700, 15px, tracking .30em): the title, cyan to violet to gold.
- **Title** (600, 13-15px): row, card and node names; a contract's goal is its title.
- **Body** (400, 12-14px): descriptions and hints.
- **Label** (700, 11px, tracking .1-.16em, uppercase): tabs, section heads, status words (READY, NEXT UP, LINKED).
- **Numeral** (600-800, 11-17px, monospace): values, rates, prices, "have / keep", progress "7 / 15".

### Named Rules
**The 11px Floor Rule.** Nothing the player reads is smaller than 11px, including labels, captions and in-battle overlays.

**The Numbers Are Mono Rule.** Every quantity the player might compare is monospace.

## Layout

Single column, capped at 1360px. Header (brand, level, three resource cards), a scrolling tab row (the selected tab scrolls fully into view), then the pane with 12px gutters. System pages pin the Scan bar to the bottom and reserve `--sysbarh` above it; other panes keep Scan and stats in a compact strip below the view. Only a pane's sub-tab row may be sticky; strips and headers scroll away. Routine VEGA notices dock as a banner just above Scan and the scroller gains the banner's height as bottom room. Toasts show one at a time. Tap targets are at least 44px (a small visual control can carry an invisible 44px hit area). Every layout is checked at 390x667 and 390x844.

## Elevation & Depth

Depth comes from tonal panels over a starfield plus the physical lip on slabs. Glow means status (ready, active, waiting), never decoration on a resting control. The one sanctioned ambient effect is the sealed "???" node's slow violet breathe, which is itself a status: waiting.

### Named Rules
**The Glow Is Status Rule.** A glow means something is ready, active or waiting. Resting controls do not glow.

## Shapes

Softly rounded rectangles: 9-11px on cards, rows and slabs, 12px on the Scan key, 50% for dots. Borders are 1px. Slabs carry a 3px darker lip along the bottom edge (a pseudo-element, not a border) that collapses to 1px when pressed. Tracks (research, the Project) are a vertical line of 28px dots.

## Components

### Slab buttons (the purchase family)
- **Build:** gradient fill, 1px lighter border, 1px inner highlight, 3px darker lip via `::after`; `:active` moves 2px down and the lip collapses; `:focus-visible` ring; 44px minimum height; the amount sits in a monospace `<b>`.
- **Colour = currency:** cyan (`.gb`, ore; the Scan key is the bright cyan version), gold (`.misslab`, rewards and Dark Matter), violet (`.resslab`, crystal research and the Nexus), bronze (`.svslab`, salvage).
- **Label:** a verb plus the amount ("BUY 2.4K", "UPGRADE 12", "LINK 9 DM", "SELL 5.34M Ore +11 Salvage").
- **Unaffordable:** never faded. The slab turns flat and neutral and says what is missing: "NEED 6.6K", live, updated in place. Other honest states: "NOTHING SPARE", "SHARE TOO SMALL".

### Typed confirmations
A bought or claimed thing confirms console-style: the status types itself letter by letter behind a blinking block cursor, with a short hold before the list rebuilds. Missions: "FULFILLED" (green, with a scan line sweeping the card). Research: "RESEARCHED". Nexus: "LINKED". Reduced motion shows the word instantly.

### Chips
44px, muted text on a faint fill; selected gets the cyan edge and starlight text. Market chips are shares of surplus (10% / 25% / 50% / SURPLUS).

### Cards, rows and tracks
- **Generator row:** icon, name and rates, count, cyan slab; thin progress underline; gold mission strip hung beneath when a mission counts it.
- **Contract (Missions ledger):** number (CA-008), status label, the goal as title, gold progress with "cur / goal", reward line naming currencies and XP.
- **Track (Research, the Project):** one line for what is done, the next node as a card with its effect and slab, the rest listed below.
- **Sealed node:** hatched dark panel, redacted bars, "Effect: unknown", cost and requirements only.

### Navigation
Tab row with uppercase 11px labels; the active tab gets a panel fill and a cyan bar. Sub-tab toggles are 44px.

### Map
System dots in their kind or exotic colour; enemy-held systems in rose; faction names as labels, no territory wash. Painted planets with night-side city lights that spread as the player builds; small sunlit satellites in orbit.

## Do's and Don'ts

### Do:
- **Do** make every paid action a slab in its currency's colour, with a verb and the amount.
- **Do** say "NEED X" (or the honest reason) instead of fading a button.
- **Do** keep text at 11px and above, contrast at 4.5:1 and taps at 44px, checked at 390x667 and 390x844.
- **Do** confirm meaningful actions with a typed status word.
- **Do** protect the player from selling what they need (surplus only).
- **Do** honour `prefers-reduced-motion`.

### Don't:
- **Don't** go cartoony or bright mobile-game.
- **Don't** use a signal colour to tell things apart; use Silver Steel.
- **Don't** colour enemies by faction; enemies are rose.
- **Don't** fade whole locked cards; dim the frame and keep the text readable, with a drawn lock, not an emoji.
- **Don't** hint at the VEGA twist in the interface; the "???" node reveals nothing.
- **Don't** add ambient glow to resting controls.
