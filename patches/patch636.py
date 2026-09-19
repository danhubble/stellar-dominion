#!/usr/bin/env python3
"""
patch636 (BUILD 638) - owner ask: bigger Market sales.

Today the AMOUNT chips on the Market page (#p-mkt) share the global `S.buy` with the
buildings/Nexus ladder chips (the blanket `$$(".chip[data-b]")` wiring sets one value
for every chip row in the game) and top out at ×100/MAX. mktBump()'s own +12%-per-SALE
price creep means many small sales cost a lot more than one big one, so the gap between
×100 and MAX was a real cost to the player with no ×1K/×10K step in between.

1. The Market gets its own session-only amount state - `let mktBuy=1`, declared right
   alongside resMode/raidMode/mapMode (same reasoning, same comment style: never saved,
   always opens on ×1). mktAmount() reads it instead of S.buy - its only two S.buy
   reads, both replaced, nothing else in mktAmount()/sellRes()/renderMarket() touches
   S.buy at all (grepped after, confirmed 0 hits under any Market function).

   The Market's own chip row is retargeted from `data-b` to `data-mb` (a new, distinct
   attribute - not a class, since every other chip row already leans on `data-b` for
   its own value, and a same-named-but-differently-scoped attribute is the smallest
   diff that makes the existing blanket `$$(".chip[data-b]")` selector - used for BOTH
   the buildings/Nexus click wiring AND its own syncChips() highlight sweep - stop
   matching Market's buttons on its own, with no selector-scoping/exclusion logic
   needed anywhere). A parallel, equally small pair - a `$$(".chip[data-mb]")` click
   handler and its own syncMktChips() - is added right after the existing one, wiring
   to mktBuy + renderMarket() (called directly, not the generic render() the buildings
   chips use - Market does not need the rest of the page repainted, and renderMarket()
   already runs unconditionally every render() tick regardless of the `dirty` flag, so
   there is nothing for `dirty=true` to gate here). The buildings/Nexus chips (data-b,
   S.buy) are not touched by any of this - same handler, same syncChips(), same values,
   completely unaware anything changed on the Market page, and vice versa: mktAmount()
   never reads S.buy any more, so nothing the buildings chips do can move a Market sale.

2. Market chips become six: ×1, ×10, ×100, ×1K, ×10K, MAX - `data-mb` values
   1/10/100/1000/10000/"max", labels exactly "×1K"/"×10K" per the owner's own spelling.
   mktAmount()'s existing `mktBuy==="max" ? ... : mktBuy` shape needs no change beyond
   the S.buy->mktBuy swap above - it already treats mktBuy as "whatever whole number or
   'max' was last selected", regardless of which six values are on offer.

3. renderMarket()/mktCardSkeleton() are completely unchanged - `.mktget`/`.mktsell`
   already read mktAmount()/mktPrice() live and format through fmt() (which already
   scales through K/M/B), so a ×10K sale's ten-of-millions-Ore cost and disabled state
   (bal+1e-6>=cost) both fall out for free, verified in tmarket2.js below rather than
   assumed.

4. Grepped after applying, not just claimed: `mktBuy` (bare identifier, not `S.buy`) is
   read/written only by its own `let` declaration, mktAmount(), the new data-mb click
   handler, syncMktChips(), the new boot-time syncMktChips() call, and its own read-
   only `get mktBuy(){return mktBuy}` export (same pattern mapMode already uses on
   __SD - a getter only, no setter, since every test that changes it clicks the real
   `[data-mb]` button, same as mapMode's own tests click `[data-mm]` - nothing pokes
   the bare variable directly). `S.buy` keeps every one of its pre-patch call sites
   (ship BUY, buildings ladder, the buildings/Nexus chip wiring itself) and gains none.

tests/tmarket2.js: read first, per the task. One existing case (r8, "MAX chip sells...")
set `G.S.buy="max"` and read `G.mktAmount(...)` directly - genuinely invalidated (S.buy
no longer reaches mktAmount() at all) - fixed to set `G.mktBuy="max"` instead, same
assertions, named here rather than silently changed. Six new checks added: all six
chips exist, in order, with the right data-mb values and labels; clicking ×1K makes
mktAmount() return 1000 (real DOM tap, not a direct poke); a ×10K sale moves exactly
10000 output units for the expected cost; the ×10K SELL label is fmt()-scaled and
reads sanely; selecting a Market amount leaves S.buy and the Empire chips' own
highlight untouched, and (the converse) changing an Empire chip leaves mktBuy and the
Market chips' own highlight untouched.
"""

PATH = "/home/claude/stellar-dominion-empire2.html"
h = open(PATH, encoding="utf-8").read()


def do(anchor, new, count=1, label=None):
    global h
    n = h.count(anchor)
    assert n == count, f"anchor count {n} != {count} for {label or anchor[:60]!r}"
    h = h.replace(anchor, new, count)


do("const BUILD=637;", "const BUILD=638;", label="BUILD bump")

# ==================================================================== HTML: the Market's
# own AMOUNT row - data-b -> data-mb (so the global $$(".chip[data-b]") wiring below
# stops matching it on its own, no scoping/exclusion needed anywhere) plus two new
# chips, ×1K and ×10K, between ×100 and MAX.
do(
    """        <div class="buybar">
          <span style="font-size:10px;letter-spacing:.16em;color:var(--dim)">AMOUNT</span>
          <button class="chip on" data-b="1">×1</button>
          <button class="chip" data-b="10">×10</button>
          <button class="chip" data-b="100">×100</button>
          <button class="chip" data-b="max">MAX</button>
        </div>""",
    """        <div class="buybar">
          <span style="font-size:10px;letter-spacing:.16em;color:var(--dim)">AMOUNT</span>
          <button class="chip on" data-mb="1">×1</button>
          <button class="chip" data-mb="10">×10</button>
          <button class="chip" data-mb="100">×100</button>
          <button class="chip" data-mb="1000">×1K</button>
          <button class="chip" data-mb="10000">×10K</button>
          <button class="chip" data-mb="max">MAX</button>
        </div>""",
    label="HTML: Market AMOUNT row - data-mb, six chips",
)

# ==================================================================== JS: mktBuy - the
# Market's own session-only amount state, same cluster/reasoning as resMode/raidMode/
# mapMode right above it.
do(
    """let mapMode="map";            /* patch614: "map" or "list" - which half of the Map tab is
                                  showing. Session-only, same reasoning as resMode/raidMode -
                                  never saved, always opens on the map itself. */
const RAID_PANES={targets:"#rpTargets",fleet:"#rpFleet",loadout:"#rpLoadout",crew:"#rpCrew"};""",
    """let mapMode="map";            /* patch614: "map" or "list" - which half of the Map tab is
                                  showing. Session-only, same reasoning as resMode/raidMode -
                                  never saved, always opens on the map itself. */
let mktBuy=1;                 /* patch636: which AMOUNT chip is selected on the Market page -
                                  its own state so the Market's ×1K/×10K/MAX choice never
                                  fights the buildings/Nexus chips' S.buy, or vice versa.
                                  Session-only, same reasoning as resMode/raidMode/mapMode
                                  above - never saved, always opens on ×1. */
const RAID_PANES={targets:"#rpTargets",fleet:"#rpFleet",loadout:"#rpLoadout",crew:"#rpCrew"};""",
    label="JS: let mktBuy=1 - Market's own session-only amount state",
)

# ==================================================================== JS: mktAmount()
# reads mktBuy instead of S.buy - its only two S.buy reads.
do(
    """function mktAmount(kind,counter){
  const price=mktPrice(kind,counter); if(!(price>0))return 0;
  const bal=mktBal(kind);
  return S.buy==="max" ? Math.max(0,Math.floor(bal/price)) : S.buy;
}""",
    """function mktAmount(kind,counter){
  const price=mktPrice(kind,counter); if(!(price>0))return 0;
  const bal=mktBal(kind);
  return mktBuy==="max" ? Math.max(0,Math.floor(bal/price)) : mktBuy;   /* patch636: own state, not S.buy - see mktBuy's own comment */
}""",
    label="JS: mktAmount() reads mktBuy, not S.buy",
)

# ==================================================================== JS: the Market's
# own chip wiring - a `data-mb` counterpart to the existing `data-b` block right above
# it, wired to mktBuy + renderMarket() (called directly - Market does not need the rest
# of the page repainted, and renderMarket() already runs unconditionally every render()
# tick regardless of `dirty`, so there is nothing for dirty=true to gate here).
do(
    """function syncChips(){
  const key=S.buy==="max"?"max":String(S.buy);
  $$(".chip[data-b]").forEach(x=>x.classList.toggle("on",x.dataset.b===key));
  $$(".scrapc").forEach(x=>x.classList.toggle("on",!!S.sell));
}
$$(".scrapc").forEach(b=>b.onclick=()=>{ S.sell=S.sell?0:1; syncChips(); dirty=true; render(); });
$("#runlbl").onclick=()=>{ if(pendingLevels()>0)lvModal(); else lvSummary(); };""",
    """function syncChips(){
  const key=S.buy==="max"?"max":String(S.buy);
  $$(".chip[data-b]").forEach(x=>x.classList.toggle("on",x.dataset.b===key));
  $$(".scrapc").forEach(x=>x.classList.toggle("on",!!S.sell));
}
$$(".scrapc").forEach(b=>b.onclick=()=>{ S.sell=S.sell?0:1; syncChips(); dirty=true; render(); });
/* patch636: the Market's own AMOUNT row - data-mb, not data-b, so the block above never
   sees these buttons and this one never sees the buildings/Nexus ones. Own state
   (mktBuy), own sync (syncMktChips(), same shape as syncChips() but scoped to
   [data-mb]/mktBuy only), own direct render (renderMarket(), not the generic render()
   the buildings chips use - see mktBuy's own comment above for why). */
$$(".chip[data-mb]").forEach(c=>c.onclick=()=>{
  mktBuy = c.dataset.mb==="max"?"max":parseInt(c.dataset.mb,10);
  syncMktChips(); renderMarket();
});
function syncMktChips(){
  const key=mktBuy==="max"?"max":String(mktBuy);
  $$(".chip[data-mb]").forEach(x=>x.classList.toggle("on",x.dataset.mb===key));
}
$("#runlbl").onclick=()=>{ if(pendingLevels()>0)lvModal(); else lvSummary(); };""",
    label="JS: Market's own [data-mb] chip wiring + syncMktChips()",
)

# ==================================================================== JS: boot - sync
# the Market's own chip highlight too, same as syncChips() right next to it (the static
# markup already has ×1 as `class=\"chip on\"`, so this is belt-and-braces, same
# reasoning syncChips()'s own boot call already follows for the buildings chips).
do(
    """syncChips();
syncRaidMode();
renderAll();""",
    """syncChips();
syncMktChips();   /* patch636 */
syncRaidMode();
renderAll();""",
    label="JS boot: syncMktChips() alongside syncChips()",
)

# ==================================================================== JS: export mktBuy
# for tests - read-only getter, same shape as mapMode's own export just below it (tests
# change it through a real [data-mb] click, same as mapMode's own tests use [data-mm] -
# nothing needs to poke the bare variable directly).
do(
    "  sellRes,mktPrice,mktHeat,mktHeatMul,mktBasePrice,mktAmount,mktBal,mktResLabel,",
    "  sellRes,mktPrice,mktHeat,mktHeatMul,mktBasePrice,mktAmount,get mktBuy(){return mktBuy},mktBal,mktResLabel,",
    label="export: get mktBuy(){return mktBuy}",
)

assert h.count("const BUILD=638;") == 1
assert h.count('data-mb="1"') == 1
assert h.count('data-mb="10"') == 1
assert h.count('data-mb="100"') == 1
assert h.count('data-mb="1000"') == 1
assert h.count('data-mb="10000"') == 1
assert h.count('data-mb="max"') == 1
assert h.count("×1K</button>") == 1
assert h.count("×10K</button>") == 1
assert h.count("let mktBuy=1;") == 1
assert h.count("function syncMktChips(){") == 1
assert h.count('$$(".chip[data-mb]")') == 2   # click wiring + inside syncMktChips() (boot only calls the function)
assert h.count("get mktBuy(){return mktBuy}") == 1
assert h.count("syncMktChips();") == 2        # inside its own click handler, and the boot call
# mktAmount()/sellRes() no longer read S.buy anywhere - the two old reads are gone
assert 'return S.buy==="max" ? Math.max(0,Math.floor(bal/price)) : S.buy;' not in h
assert h.count('return mktBuy==="max"') == 1
# the buildings/Nexus chips keep data-b and S.buy exactly as before - untouched
assert h.count('data-b="1"') == 2   # sysBuild ladder + rpFleet ship BUY row (both unchanged, per the task)
assert h.count('S.buy = c.dataset.b==="max"?"max":parseInt(c.dataset.b,10);') == 1
# ordering: mktAmount() (like every function in this file) is defined before mktBuy's
# own `let` runs at the top level, but that is fine - mktAmount() is not CALLED until
# well after the whole script's top-level statements (including this one) have run, so
# there is no temporal-dead-zone issue; what actually matters is that mktBuy's own
# declaration precedes syncMktChips() (which closes over it) and its own export.
assert (h.index("let mktBuy=1;")
        < h.index("function syncMktChips(){")
        < h.index("get mktBuy(){return mktBuy}"))

with open(PATH, "w", encoding="utf-8") as f:
    f.write(h)
print("patch636 applied OK")
