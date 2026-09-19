# PLAN-clip — the auto-resolve battle clip

16 Sep 2026. Base build b634. Patches start at 633. House rules unchanged (one-purpose
anchor-asserted patch scripts, pcheck + tq2 after each, full suite per batch, shipped
`stellar-dominion.html` md5 `bcb806896f1a737146d08d7674adbce6` untouched, BUILD bump and
HANDOVER entry per patch, `mkartifact2.py` at batch end, publish by updating the existing
artifact URL).

## The problem

`autoResolveTarget()` calls `engageTarget()` (spawns the real hostiles, raises the battle
screen), marks every hostile dead in the same tick, and calls `endBattle("win")`. The
player sees the battle screen for one frame with the "Auto-Resolved" card stamped over
it. The card's own copy says "resolved without a fight you needed to play" — the feeling
is that nothing happened. Owner: "give more of a punch to the auto resolve", Advance
Wars style — your units and theirs, a short exchange, the outcome shown as a process.

## Owner decision (settled, 16 Sep)

A ~2.5 s scripted clip on the existing battle screen, then the existing result card.
Honest — the real fleet's fitted weapons, the real hostiles, the real 3% integrity
cost, never a random light show. Tap anywhere to skip to the card. No pacing impact.

## What exists (reuse, don't rebuild)

- `engageTarget(t,idx)` builds `BT` (hostiles in `BT.en` with `x,y,hp,shp,alive,k`),
  raises `#battle`, sets `BT.mode="wep"`, `BT.wep` = the fitted weapons.
- The main `frame()` loop runs `bUpdate(dt); bDraw(); bAdapt(rawMs)` while `BT` is set
  (~5247). `bUpdate()` returns early on `BT.done` but `bDraw()` keeps drawing, so fx
  finish animating after the fight ends.
- `fireFx(D,e,crit)` — the visual half of a weapon shot, already separate from the
  damage: `shell` travels (`dur:0.34`), `beam`→`lance`, `spray`→3 beams, default
  `beam`. `WEPMAP[w.id]` gives `D`.
- Enemy fire visual: `BT.fx.push({t:"shot",x:e.x*BW,y:e.y*BH,ty:playerY(),p:0,w:0,
  dur:SHOT_T,d,raw,miss,blk,a:1})` + `sfx("foeShot")`; the hull bar shows `BT.hpShown`,
  eased toward `BT.hp` at 7/s (~9176) and held by `BT.hpHold` while shots are in flight.
- `hitEnemy(i,dmg,manual)` — the real kill path: shield `shbreak`, `boom` fx,
  `sfx("foeDead")`, `BT.kills++`, hydra split (which ADDS hostiles and raises `BT.tot`).
- `endBattle("win")` with `BT.auto` set: applies `AUTO_YIELD` and
  `S.fhp = max(0.05, S.fhp − AUTO_FHP_COST)`, builds the card into `#bRes`.
- Tap surface: `bcv` pointerdown → `bTapWep()` in wep mode. `#bRetreat` →
  `endBattle("timeout")`. `closeBattle()` only from the card's button.
- The pacing sim (`tests/csim4.js`) never calls auto-resolve. Verified by grep.

## Patch plan

**633 — the clip.** `autoResolveTarget()`: after `engageTarget()`, instead of the
instant kill, set `BT.auto=1` and `BT.cine={t:0, step:0, ...}`; `render()` as before.
`bUpdate(dt)`: first line after the `BT.done` early-return, `if(BT.cine) return
bUpdateCine(dt);` — the real sim (enemy fire, weapon charge, waves) never runs during
the clip. `bUpdateCine(dt)` advances `BT.cine.t` and fires beats once each:

- 0.35 s — enemy volley. Up to three alive hostiles (spread across the formation)
  each push the `shot` fx above with `d:0` (the visual only; the cost is applied
  below), `sfx("foeShot")`. At `0.35+SHOT_T` apply the cost ONCE:
  `BT.hp -= AUTO_FHP_COST*BT.hpm; BT.cine.charged=1;` plus the existing player-side
  impact fx the real arrival uses (find it in `bUpdateWep`'s shot-arrival branch and
  reuse it, don't invent one). Keep `hpShown`'s easing running in cine mode — if the
  easing lives inside `bUpdateWep`, lift that one line into `bUpdateCine` so the bar
  visibly dips.
- 0.9 s → ~2.0 s — fleet volley. Order the alive hostiles left→right, boss (`EK[k].boss`)
  last. Fire one per ~0.22 s (compress the interval if there are more than five so the
  clip stays ≤ ~2.6 s): pick the next fitted weapon in rotation (`BT.wep` non-null
  entries; `pulse` if none — can't happen, `canAutoResolve` needs `fleetDPS()>0`), call
  `fireFx(D,e,false)`, then kill on arrival — `shell` after its `dur`, everything else
  immediately — via `hitEnemy(i, e.hp+e.shp+1, 0)` so the real boom/sound/kills++/hydra
  split all happen. Hydra pieces join the queue. Loop until nothing is alive.
- +0.25 s after the last kill — `sfx("win")` is already played by `endBattle`; call
  `endBattle("win")`. Safety net first: `for(const e of BT.en)e.alive=0; BT.kills=BT.tot;`
  and charge the cost if a skip landed before 0.35 s.

`endBattle()`: the line `if(how==="win"&&BT.auto)S.fhp=Math.max(0.05,S.fhp-AUTO_FHP_COST)`
becomes conditional on `!(BT.cine&&BT.cine.charged)` — the clip already took it off
`BT.hp`, and `S.fhp=max(0.05,BT.hp/BT.hpm)` on the line above carries it. Net result
must be identical to today's to within floating point; assert that in the test by
running the same fixture through both paths (a save before/after with the clip skipped
at t=0 vs the old instant path — the old path is gone, so compute the expected value by
hand: `max(0.05, fhpBefore − 0.03)`).

Skip: `bcv` pointerdown → `if(BT&&BT.cine&&!BT.done){ cineFinish(); return; }` before
the mode dispatch. `cineFinish()` = the safety net + `endBattle("win")`. `#bRetreat` is
hidden (class toggle on `#battle`, e.g. `#battle.cine #bRetreat{display:none}`) while the
clip runs — a retreat from an auto-resolve would pay out as "Withdrew", which is wrong.
`#bTip`/`#bWep`/`#bPwr`: hide the weapon rack and tip during the clip the same way
(`#battle.cine`), so the screen reads as a cutscene, not a paused fight. The header
(`#bName`), hull bar and the canvas stay.

Reduced motion: honour `prefers-reduced-motion` by skipping straight to the card
(`cineFinish()` on the first cine frame).

**634 — tests + ship.** `tests/tclip2.js`: auto-resolve opens the battle screen with
`BT.cine` set and no `#bRes.on`; after ~3 s (drive `bUpdate` with fixed dt rather than
waiting wall-clock, the way `tcombat2.js` drives fights — check how it does it) every
hostile is dead, `#bRes.on`, title "Auto-Resolved", and `S.fhp` equals the hand-computed
expectation; a tap on `bcv` at t=0.1 s ends it immediately with the same numbers; a hydra
in the formation still ends with everything dead; `#bRetreat` hidden during, visible
after; the pacing sim byte-identical; full suite zero failures; HANDOVER; `mkartifact2.py`.
Screenshots at 390x667 mid-clip (t≈1.2 s, shells in flight, one or two booms) and at the
card — read back honestly.

## Watch for

- `Math.random()` inside the clip is fine ONLY because nothing here is in `tick()`'s call
  graph — `bUpdate` runs from `frame()`, and csim never auto-resolves. Do not add any
  randomness to `autoResolveTarget()` itself before `engageTarget()`, which the sim
  could conceivably reach through `engage`; keep the clip's own randomness (if any)
  inside `bUpdateCine`.
- `BT.done` is what stops `bUpdate`; `bDraw` continues. `endBattle` sets it. Don't add
  a second flag for "clip over".
- Old saves: nothing persists. `BT` is runtime only.
- `tchurn2` doesn't sweep `#battle` (not the on-pane), but don't rebuild the header or
  the bars anyway — class toggles.
- The final battle (`t.final`) never auto-resolves (`canAutoResolve` isn't offered
  there). Assert `BT.t.final` is falsy at the top of the cine path regardless.
