#!/usr/bin/env python3
"""
patch608 — PLAN-unify.md Run 1, patch 2 of 3: the tabs.

The Map pane (`#p-map`) becomes the first tab, labelled EMPIRE — the map IS the empire
now. The old accordion's tab button and pane (`#p-emp`) are hidden with a class
(`.legacyhide`, `display:none!important` — beats `.pane.on{display:block}`'s own higher
specificity, which a plain class-only rule would have lost to), not removed: Run 2
(patch612) deletes the dead widget outright, but every existing test that still drives
`p-emp` (`gotoTab('p-emp')`, `.tab[data-p="p-emp"]`, `#p-emp` queries) needs the element
to still exist in the DOM until then, per the owner's own instruction. Default boot tab
is now `p-map` — swapped directly in the static markup (the `on` class moves with it),
so no new boot-time JS is needed.

Every caller that pointed at the old tab now points at the map, per the plan's own grep
list:
 - `VEGA.firstClaim.go` ("p-emp" -> "p-map") - the notice's "TAKE ME THERE" button.
 - `lfLaunch()`'s `flag("p-emp")` dropped outright (not retargeted - it already also
   calls `flag("p-map")` right beside it, so this was two calls doing the same job
   the instant p-emp stopped being a distinct destination).
 - `render()`'s exo-strip/orb-badge line - now gated on `#p-map` being the active pane
   instead of `#p-emp`, so `renderExoStrip()`/`updateOrbBadge()` keep updating on
   whichever tab is actually shown by default now.
 - `applyCore()`'s own `#p-emp` check, which decides whether the `#core` planet widget
   (still in `#left`, untouched by this run - Run 2 removes it) is shown at all - now
   keyed to `#p-map`, so it keeps behaving exactly as before, just following the tab
   that carries its old meaning.
 - `empSysRow()`'s onclick was already `S.msel=id; gotoTab("p-map")` (unclaimed/contested
   rows have pointed taps at the map, not the accordion, since patch546/564) - grepped
   per the plan's own list, needed no change, noted here rather than silently skipped.

`paneNeedsTop` is untouched, per the plan.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


# ---- 1. CSS: a hide that beats .pane.on{display:block}'s own specificity ----
do(
    ".pane{display:none} .pane.on{display:block}\n",
    ".pane{display:none} .pane.on{display:block}\n"
    "/* patch608: the old #p-emp tab/pane, kept in the DOM for tests that still drive it\n"
    "   (Run 2/patch612 deletes both outright) but never shown again - !important because\n"
    "   .pane.on{display:block} (two classes) otherwise outranks a plain .legacyhide\n"
    "   (one class) by specificity alone, on-class or not. */\n"
    ".tab.legacyhide,.pane.legacyhide{display:none!important}\n",
    label="legacyhide CSS",
)

# ---- 2. nav: map first (labelled EMPIRE, now the default "on" tab), old Empire hidden ----
do(
    '      <button class="tab on" data-p="p-emp">Empire<i class="dot"></i></button>\n'
    '      <button class="tab" data-p="p-mis">Missions<i class="dot"></i></button>\n'
    '      <button class="tab" data-p="p-res">Research<i class="dot"></i></button>\n'
    '      <button class="tab" data-p="p-map">Map<i class="dot"></i></button>\n'
    '      <button class="tab" data-p="p-raid">Raids<i class="dot"></i></button>\n',
    '      <button class="tab on" data-p="p-map">Empire<i class="dot"></i></button>\n'
    '      <!-- patch608: kept for tests until Run 2 (patch612) removes it - see the header note -->\n'
    '      <button class="tab legacyhide" data-p="p-emp">Empire<i class="dot"></i></button>\n'
    '      <button class="tab" data-p="p-mis">Missions<i class="dot"></i></button>\n'
    '      <button class="tab" data-p="p-res">Research<i class="dot"></i></button>\n'
    '      <button class="tab" data-p="p-raid">Raids<i class="dot"></i></button>\n',
    label="nav order",
)

# ---- 3. panes: p-map starts open, p-emp hidden (not "on" any more) ----
do(
    '      <div class="pane on" id="p-emp">\n',
    '      <div class="pane legacyhide" id="p-emp">\n',
    label="p-emp pane class",
)
do(
    '      <div class="pane" id="p-map">\n',
    '      <div class="pane on" id="p-map">\n',
    label="p-map pane class",
)

# ---- 4. VEGA firstClaim now points at the map ----
do(
    ' firstClaim:{t:"That is ours now. It will want its own buildings — the rock here is not the rock at home.", go:"p-emp"},\n',
    ' firstClaim:{t:"That is ours now. It will want its own buildings — the rock here is not the rock at home.", go:"p-map"},\n',
    label="VEGA firstClaim.go",
)

# ---- 5. lfLaunch: one flag() call, not two that now mean the same thing ----
do(
    '  flag("p-emp"); flag("p-map"); dirty=true;\n',
    '  flag("p-map"); dirty=true;\n',
    label="lfLaunch flag",
)

# ---- 6. render(): exo-strip/orb-badge line follows the tab that actually shows #core now ----
do(
    '  if($("#p-emp").classList.contains("on")){ renderExoStrip(); updateOrbBadge(); }\n',
    '  if($("#p-map").classList.contains("on")){ renderExoStrip(); updateOrbBadge(); }\n',
    label="render() exo-strip gate",
)

# ---- 7. applyCore(): #core shows while the map (old Empire's replacement) is open ----
do(
    '  const emp=$("#p-emp").classList.contains("on");\n',
    '  const emp=$("#p-map").classList.contains("on");\n',
    label="applyCore emp check",
)

h = h.replace("const BUILD=607;", "const BUILD=608;", 1)
assert "const BUILD=608;" in h

open(PATH, "w", encoding="utf-8").write(h)
print("patch608 applied OK")
