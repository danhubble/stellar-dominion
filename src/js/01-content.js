/* ============================ content ============================ */
const GENS=[
 {n:"Mining Drone",      kind:"ore", b:10,      r:0.2,    L:"Asteroid Belt",     d:"Autonomous rigs chewing raw ore out of the belt above your homeworld."},
 {n:"Smelter Pod",       kind:"ore", b:140,     r:1.6,    L:"Homeworld Surface", d:"Ground-side cracking towers. Turns raw ore into usable metal \u2014 and sheds crystal as slag."},
 {n:"Crust Borer",       kind:"ore", b:1800,    r:13,     L:"Homeworld Crust",   d:"Shafts driven into the mantle. Raw tonnage, straight up the elevator."},
 {n:"Fabricator",        kind:"ore", b:24000,   r:110,    L:"Homeworld",         d:"Prints hulls, plate and drone frames from refined feedstock."},
 /* STAGE 2: Orbital Harvester and every tier from here up costs a flat amount of a
    NAMED exotic (exo/exoC) - fixed by the TIER itself, not by whatever the host system
    happens to produce (the old rule, removed). exoC is a flat cost per unit - the ore
    price still climbs, the exotic amount does not. Tuning-pending, see HANDOVER. */
 {n:"Orbital Harvester", kind:"ore", exo:"ir", exoC:1, b:3.2e5,   r:1000,   L:"Low Orbit",         d:"A skyhook ring that scoops belt material without ever touching a gravity well."},
 {n:"Fusion Forge",      kind:"ore", exo:"he", exoC:1, b:4.6e6,   r:9800,   L:"High Orbit",        d:"Star-hot smelting held in a magnetic bottle the size of a moon."},
 /* PACING PASS (2026-09-04): b and exoC raised on all eight tiers below (Dyson
    Swarm..Antimatter Loom) - see comment above patch450 for why. */
 {n:"Dyson Swarm",       kind:"ore", exo:"xe", exoC:3, b:7.2e9,   r:1.05e5, L:"Stellar Orbit",     d:"Collector panels wrapped around your sun, stripping mass from the star itself."},
 {n:"Wormhole Crucible", kind:"ore", exo:"am", exoC:3, b:1.8e11,  r:1.15e6, L:"System Edge",       d:"Folds space at the heliopause and processes matter through a throat two metres wide."},
 {n:"Singularity Well",  kind:"ore", exo:"am", exoC:4, b:5.5e12,  r:1.4e7,  L:"Deep Space",        d:"A captured black hole on an accretion leash. The densest mine ever dug."},
 {n:"Galactic Nexus",    kind:"ore", exo:"am", exoC:4, b:3.6e13,  r:1.9e8,  L:"Galactic Arm",      d:"One whole spiral arm, refining end to end. This was a mining outfit once."},
 {n:"Iridium Foundry",   kind:"ore", b:8.0e14,  r:2.4e9,  L:"Inner Reach",  exo:"ir", exoC:4,
  d:"Casts refractory hulls no ordinary furnace can hold. Needs iridium, and iridium only comes from the map."},
 {n:"Helium Spindle",    kind:"ore", b:2.1e16,  r:3.0e10, L:"Mid Reach",    exo:"he", exoC:5,
  d:"Spins helium-3 into a fusion cascade that never has to be relit."},
 {n:"Xenon Array",       kind:"ore", b:6.5e17,  r:4.0e11, L:"Outer Reach",  exo:"xe", exoC:7,
  d:"A lattice of xenon chambers burning cold and impossibly fast."},
 {n:"Antimatter Loom",   kind:"ore", b:1.75e19, r:5.5e12, L:"The Deep",     exo:"am", exoC:9,
  d:"Weaves caged annihilation into matter. Nothing you own is stranger than this."},
 /* PATCH 1 (v3 tuning): kind-ladder tiers produce EXOTIC now, not ore - `r` on
    these 15 entries is this system's own exotic, units/s per unit (see patch438 for
    the engine rewrite that actually reads it that way; rate()/exoRate() no longer
    touch these rows for ore at all). The marquee's old "+1%/unit exotic yield" nudge
    is gone with sysYield() itself - the marquee just produces exotic directly now,
    same as tiers 1-2, at its own (higher) rate. TUNING-PENDING - see HANDOVER for the
    calibration this was checked against. Icons/colors still reused cyclically from
    the ore ladder's own ICONS/TCOL arrays (see iconFor). */
 {n:"Regolith Crusher",  kind:"rock", b:5e3,   r:0.012, L:"Rock Surface",     d:"Grinds loose surface stone, sieving the trace exotic out as it goes."},
 {n:"Iron Vein Driller", kind:"rock", b:3e6,   r:0.05,  L:"Subsurface Veins", d:"Follows the good seams straight through the mantle."},
 {n:"Bedrock Refinery",  kind:"rock", b:2e9,   r:0.16,  L:"Planetary Core",   exo:"ir", exoC:2,
  d:"Cracks the whole crust at once. The iridium comes first now, not along for free."},

 {n:"Cloud Skimmer",     kind:"gas", b:2e5,   r:0.010, L:"Upper Atmosphere", d:"Skims workable gas off the cloud deck without ever landing."},
 {n:"Storm Refinery",    kind:"gas", b:1.2e8, r:0.045, L:"Storm Band",       d:"Rides the deep storm bands where the gas runs thickest."},
 {n:"Helios Cascade",    kind:"gas", b:8e10,  r:0.15,  L:"Gas Giant Core",   exo:"he", exoC:2,
  d:"Taps straight into the planet's own fusion churn."},

 {n:"Salvage Claw",      kind:"belt", b:3e6,  r:0.014, L:"Debris Field",  d:"Drags wreckage and rock alike out of the belt for sorting."},
 {n:"Rubble Crusher",    kind:"belt", b:5e9,  r:0.055, L:"Dense Cluster", d:"Grinds a whole cluster of rubble down to shippable grade."},
 {n:"Shard Array",       kind:"belt", b:2e12, r:0.18,  L:"Belt Core",     exo:"ir", exoC:3,
  d:"A ring of collectors working every rock in the field at once."},

 /* PACING PASS (2026-09-04): b lowered on all six tiers below (ice and void
    kind-ladders), exoC lowered on the two tier-3 exotic gates - see comment
    above patch451 for why. Rock and gas kind-ladders are UNCHANGED. */
 {n:"Frost Auger",       kind:"ice", b:5e7,  r:0.018, L:"Ice Sheet", d:"Bores through kilometres of ancient ice for whatever it has trapped inside."},
 {n:"Cryo Extractor",    kind:"ice", b:3e10, r:0.07,  L:"Deep Ice",  d:"Melts and refines in the same pass, so nothing is lost to the cold."},
 {n:"Glacier Refinery",  kind:"ice", b:2e13, r:0.22,  L:"Ice Core",  exo:"xe", exoC:3,
  d:"Works the whole ice sheet down to the rock underneath."},

 {n:"Dark Collector",    kind:"void", b:3e8,  r:0.022, L:"Deep Void",     d:"Sweeps drifting matter out of the space between the stars."},
 {n:"Event Horizon Tap", kind:"void", b:2e11, r:0.085, L:"Event Horizon", d:"Draws raw mass off the edge of a gravity well too strong to land near."},
 {n:"Null Furnace",      kind:"void", b:4e14, r:0.28,  L:"Singularity Rim", exo:"am", exoC:3,
  d:"Burns matter down in a furnace with no bottom, keeping only what does not burn."}
];
/* STAGE 2: five kind ladders plus the ore ladder, each just GENS filtered to one
   kind, in array order (kept contiguous above for readability, but this filters
   regardless of order). Computed once GENS exists - everything below reads this,
   nothing above needs it. */
const LADDER_KINDS=["ore","rock","gas","belt","ice","void"];
const LADDERS=(()=>{ const m={}; for(const k of LADDER_KINDS)m[k]=[];
  GENS.forEach((g,i)=>{ if(m[g.kind])m[g.kind].push(i) }); return m })();
/* home (mixed) and every kind:"ore" system build the ore ladder; every other system
   builds the ladder matching its own kind. */
function ladderKindOf(s){ return (s.kind==="mixed"||s.kind==="ore") ? "ore" : s.kind }
function sysLadder(id){ const s=SYSMAP[id]; return (s&&LADDERS[ladderKindOf(s)])||[] }
/* the marquee (final, most expensive) tier of a kind ladder. PATCH 1 removed its
   only internal caller (the old sysYield() self-nudge) - the marquee now just
   produces exotic directly, same as every other kind-ladder row - but the concept
   is still useful (e.g. UI), so the function stays. */
function ladderMarquee(kind){ const l=LADDERS[kind]; return (l&&l.length)?l[l.length-1]:-1 }
/* first not-yet-owned tier in this system's own ladder, in order - what the body
   shows greyed-out with a price. null once every tier on this ladder is owned. */
/* PLAN-polish batch B item 5: tiers below sysT0(id) are never the next reveal -
   they're skipped outright, not shown-then-bought (see sysT0()'s own comment). */
function sysNextGi(id){
  const t0=sysT0(id);
  for(const gi of sysLadder(id)){ if(gi<t0)continue; if(sysTierCount(id,gi)<=0) return gi; }
  return null;
}
const TCOL=["#48e2ff","#5fd6f4","#79c6ef","#93b3f3","#a89df6","#ffb45c","#ffd166","#b07cff","#d76cff","#ff8fd0",
  "#8fb8ff","#ffd166","#c58fff","#ff6b8a"];
const ICONS=[
/* Mining Drone */
`<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 15h14l4 7.5-4 7.5H17l-4-7.5z" fill="currentColor" fill-opacity=".14"/>
  <path d="M13 22.5H8M35 22.5h5"/>
  <ellipse class="sp1" cx="6" cy="22.5" rx="4.5" ry="1.7"/>
  <ellipse class="sp1" cx="42" cy="22.5" rx="4.5" ry="1.7"/>
  <path d="M19.5 30h9l-4.5 10z" fill="currentColor" fill-opacity=".55"/></g>
 <circle class="pl" cx="24" cy="22.5" r="3.3" fill="currentColor" opacity=".75"/>`,
/* Smelter Pod */
`<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <rect x="6" y="19" width="15" height="21" rx="3" fill="currentColor" fill-opacity=".13"/>
  <path d="M6 25.5h15"/>
  <path d="M27.5 40V14h9.5v26" fill="currentColor" fill-opacity=".1"/>
  <path d="M21 34h6.5M5 40h38"/></g>
 <path class="pl" d="M32.2 13.2c0-3.4 2.6-4.5 1.8-7.2 2.9 1.7 3.9 5.2 2.1 7.2z" fill="currentColor"/>
 <circle cx="13.5" cy="33" r="2.6" fill="currentColor" opacity=".5"/>`,
/* Crust Borer */
`<g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <path d="M13 8h22v9H13z" fill="currentColor" fill-opacity=".14"/>
  <path d="M17 8V5M31 8V5M24 17v6"/>
  <path d="M4 29h40" opacity=".5"/>
  <path d="M18 23h12l-1.6 6h-8.8z" fill="currentColor" fill-opacity=".22"/></g>
 <path class="pl" d="M19.6 29h8.8L24 43z" fill="currentColor"/>
 <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".38">
  <path d="M8 34h6M34 34h6M11 40h5M32 40h5"/></g>`,
/* Fabricator */
`<rect x="8" y="8" width="32" height="9.5" rx="2" fill="currentColor" opacity=".16"/>
 <g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="8" width="32" height="9.5" rx="2"/>
  <path d="M24 17.5v5.5"/>
  <path d="M6 40h36"/>
  <path d="M14.5 40L18 28h12l3.5 12" fill="currentColor" fill-opacity=".12"/>
  <path d="M17 33.5h14"/></g>
 <circle class="pl" cx="24" cy="25" r="2" fill="currentColor"/>`,
/* Orbital Ring */
`<circle cx="24" cy="24" r="9.5" fill="currentColor" opacity=".22"/>
 <g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
  <circle cx="24" cy="24" r="9.5"/>
  <path d="M15.4 20h17.2M16.5 28.6h15" opacity=".45"/>
  <g class="sp2"><ellipse cx="24" cy="24" rx="20" ry="7.5" transform="rotate(-18 24 24)"/></g></g>
 <circle cx="43" cy="17.8" r="2.3" fill="currentColor"/>
 <circle cx="5" cy="30.2" r="2.3" fill="currentColor"/>`,
/* Fusion Forge */
`<circle class="pl" cx="24" cy="24" r="7.5" fill="currentColor" opacity=".9"/>
 <circle cx="24" cy="24" r="11" fill="currentColor" opacity=".12"/>
 <g class="sp3" fill="none" stroke="currentColor" stroke-width="2" opacity=".9">
  <ellipse cx="24" cy="24" rx="18" ry="7"/>
  <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(60 24 24)"/>
  <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(120 24 24)"/></g>`,
/* Dyson Swarm */
`<circle cx="24" cy="24" r="10" fill="currentColor" opacity=".14"/>
 <circle class="pl" cx="24" cy="24" r="6.5" fill="currentColor"/>
 <g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
  <circle class="sp4" cx="24" cy="24" r="12" stroke-dasharray="5.5 4.2"/>
  <circle class="sp5" cx="24" cy="24" r="16.5" stroke-dasharray="5 6.5"/>
  <circle class="sp6" cx="24" cy="24" r="21" stroke-dasharray="4 9" opacity=".65"/></g>`,
/* Wormhole Array */
`<ellipse cx="24" cy="24" rx="10.5" ry="15.5" fill="currentColor" opacity=".13"/>
 <g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 7v34M42 7v34"/>
  <path d="M6 7h5M6 41h5M37 7h5M37 41h5"/>
  <ellipse cx="24" cy="24" rx="10.5" ry="15.5"/>
  <ellipse cx="24" cy="24" rx="5.6" ry="8.6" opacity=".65"/></g>
 <circle class="pl" cx="24" cy="24" r="2.8" fill="currentColor"/>`,
/* Singularity Core */
`<circle cx="24" cy="24" r="18" fill="currentColor" opacity=".07"/>
 <g class="sp6" fill="none" stroke="currentColor" stroke-linecap="round">
  <path d="M24 6.2A17.8 17.8 0 0 1 41.8 24" stroke-width="2.1" opacity=".9"/>
  <path d="M24 41.8A17.8 17.8 0 0 1 6.2 24" stroke-width="2.1" opacity=".9"/>
  <path d="M24 10.5A13.5 13.5 0 0 0 10.5 24" stroke-width="1.9" opacity=".55"/>
  <path d="M24 37.5A13.5 13.5 0 0 0 37.5 24" stroke-width="1.9" opacity=".55"/></g>
 <circle cx="24" cy="24" r="9.6" fill="#04050d"/>
 <circle class="pl" cx="24" cy="24" r="9.6" fill="none" stroke="currentColor" stroke-width="2.8"/>`,
/* Galactic Nexus */
`<circle cx="24" cy="24" r="15" fill="currentColor" opacity=".08"/>
 <g class="sp7">
  <g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
   <path d="M24 18.6c6.4-1 11.6 3.2 11 9.4-.6 6.4-8 10.6-15.4 7.8C12.1 33 8.4 22.6 13.7 12.6"/>
   <path d="M24 29.4c-6.4 1-11.6-3.2-11-9.4.6-6.4 8-10.6 15.4-7.8C35.9 15 39.6 25.4 34.3 35.4"/></g>
  <circle cx="24" cy="24" r="3.8" fill="currentColor"/></g>`,
/* Iridium Foundry */
`<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round">
  <path d="M10 40V22l14-9 14 9v18z" fill="currentColor" fill-opacity=".14"/>
  <path d="M17 40V29h6v11M27 40V29h6v11"/></g>
 <circle class="pl" cx="24" cy="19" r="3.2" fill="currentColor"/>`,
/* Helium Spindle */
`<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
  <ellipse cx="24" cy="24" rx="7" ry="17"/>
  <ellipse class="sp3" cx="24" cy="24" rx="17" ry="7"/></g>
 <circle cx="24" cy="24" r="4" fill="currentColor"/>`,
/* Xenon Array */
`<g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round">
  <path d="M24 6l8 6v12l-8 6-8-6V12z" fill="currentColor" fill-opacity=".16"/>
  <path d="M8 42v-8l8-5M40 42v-8l-8-5"/></g>
 <circle class="pl" cx="24" cy="18" r="2.8" fill="currentColor"/>`,
/* Antimatter Loom */
`<g class="sp6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
  <circle cx="24" cy="24" r="15"/><path d="M9 24h30M24 9v30"/></g>
 <circle cx="24" cy="24" r="6" fill="currentColor" opacity=".22"/>
 <circle class="pl" cx="24" cy="24" r="3.4" fill="currentColor"/>`
];
const RES_ICON={
  sv:`<g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M9 17l9-8 10 4 9-3 3 11-7 6 3 10-13 2-9-7-7 4z" fill="currentColor" fill-opacity=".17"/>
    <path d="M18 9l5 13-9 6M28 13l-5 9 13 4" opacity=".85"/></g>
   <circle class="pl" cx="24" cy="24" r="2.6" fill="currentColor"/>`,
 ore:`<g stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" fill="currentColor" fill-opacity=".16">
   <path d="M21 3l13 3 6 12-7 11H20l-7-11z"/>
   <path d="M8 26l10 3 3 9-8 7-8-4z"/>
   <path d="M32 27l11 4 1 9-9 5-6-7z"/></g>
  <path d="M21 3l5 12 14 3M26 15l7 14M26 15l-13 3" fill="none" stroke="currentColor" stroke-width="1.7" opacity=".55" stroke-linejoin="round"/>`,
 cry:`<path d="M24 3l11 15-6 26h-10L13 18z" fill="currentColor" opacity=".2"/>
  <path d="M24 3l11 15-6 26h-10L13 18z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M13 18h22M24 3v41" fill="none" stroke="currentColor" stroke-width="1.9" opacity=".6"/>
  <path d="M7 27l4 6-3 11-4-6z" fill="currentColor" opacity=".5"/>`,
 pw:`<path d="M27 3L9 27h11l-3 18 20-25H26z" fill="currentColor" opacity=".2"/>
  <path d="M27 3L9 27h11l-3 18 20-25H26z" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/>`,
 dm:`<path d="M24 3l17 9.6v20.8L24 43 7 33.4V12.6z" fill="currentColor" opacity=".14"/>
  <path d="M24 3l17 9.6v20.8L24 43 7 33.4V12.6z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>
  <g class="sp3"><path d="M24 12.6a11.4 11.4 0 1 1-10.6 15.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
   <circle cx="24" cy="12.6" r="2.7" fill="currentColor"/></g>
  <circle class="pl" cx="24" cy="24" r="3.1" fill="currentColor"/>`
};
function RI(k,cls){return '<svg class="'+(cls||'ci '+k)+'" viewBox="0 0 48 48" aria-hidden="true">'+RES_ICON[k]+'</svg>'}
function iconFor(i){return '<svg viewBox="0 0 48 48" aria-hidden="true">'+ICONS[i%ICONS.length]+'</svg>'}

const GROW=1.15;
/* STAGE 2: buildings live on a per-system, per-tier count (S.sys[id].b), not in
   slots and not in a flat empire-wide count. Which LADDER a system can build is fixed
   by its kind (see LADDERS, defined once GENS exists) - no fit multiplier: the ladder
   choice already says "the right building for this world". */
/* ---------------- levels from deeds ----------------
   Level = f(XP). XP is granted only by grantXp() for firsts and milestones (a new
   tier, a claimed system, a mission, a raid-win threshold...) - never per unit,
   never per ore, never per second. So the level curve is bounded by what the game
   contains, offline earns nothing, and pace is set by what the player does rather
   than by an exponential economy the curve could never track (see HANDOVER
   2026-09-07 for the three LVKHI retunes that proved that).
   LVXP[N] is the cumulative XP to BE level N, built by linear interpolation
   through LVXP_PTS - not a formula, because no single formula fit both the early
   game (34-minute first claim, measured) and the mid/late game (the level gate
   must sit just behind the ore-cost gate, never ahead of it, for every claimable
   system - see HANDOVER 2026-09-07's Stage 5 fit against csim4's xpAtCost/need
   per system). Retune by moving/adding LVXP_PTS anchors, not by re-deriving a
   formula. */
const LVMAX=80;
/* PLAN-polish batch B item 1: LVXP_PTS[3] is a new anchor, not an interpolated
   point - it used to fall out of the straight line from 2 (38) to 8 (330), i.e.
   ~87 (49 XP for the 2->3 step). Owner: too much for the second level-up. Anchored
   lower instead, at 55 (17 XP for the 2->3 step) - see docs/HANDOVER.md for the
   before/after csim table this moved. */
const LVXP_PTS={1:0,2:38,3:55,8:330,12:600,14:760,16:920,18:1200,20:1500,22:1900,23:2300,25:2900,27:3450,29:3700,31:3950,33:4450,36:5300,38:5700,41:7300,45:9300,51:11500,55:13000,63:15000,69:16000,80:20000};
const LVXP=(()=>{ const ks=Object.keys(LVXP_PTS).map(Number).sort((a,b)=>a-b), t=[0];
  for(let n=1;n<=LVMAX;n++){ let i=0; while(i<ks.length-1&&ks[i+1]<n)i++;
    const a=ks[i], b=ks[Math.min(i+1,ks.length-1)];
    t[n]= b===a ? LVXP_PTS[a] : Math.round(LVXP_PTS[a]+(LVXP_PTS[b]-LVXP_PTS[a])*(n-a)/(b-a)); }
  return t })();
/* a non-increasing table would make a level unreachable or free; say so in the
   console rather than refusing to boot - tuning the anchors must never brick a save */
for(let n=2;n<=LVMAX;n++) if(!(LVXP[n]>LVXP[n-1])) console.error("LVXP not strictly increasing at "+n);
/* manual scan ceiling: a tap asymptotes to SCAP seconds of production, plus a flat
   SFLOOR allowance (x price level) so tapping still bootstraps a brand new empire
   where rate() is still zero. */
const SCAP=0.6, SFLOOR=20;
/* ---------------- history, for the Stats page ----------------
   One row per sample, in MEAS order. Values are rounded to four significant digits
   because the save is a base64 blob in localStorage and full float precision would
   triple it for no visible benefit. */
const HMAX=120, HIV0=15;
const MEAS=[
 {id:"rate",  n:"Production",   unit:"ore/s",  col:"#48e2ff", log:1, v:()=>rate()},
 {id:"cry",   n:"Crystal",      unit:"/s",     col:"#a878ff", log:1, v:()=>cryRate()},
 {id:"all",   n:"All-time ore", unit:"ore",    col:"#5fd6f4", log:1, v:()=>S.all},
 {id:"str",   n:"Structures",   unit:"built",  col:"#5ce6a5", log:0, v:()=>tot()},
 {id:"lvl",   n:"Level",        unit:"",       col:"#ffd166", log:0, v:()=>level()},
 {id:"dm",    n:"Dark Matter",  unit:"held",   col:"#ffb45c", log:0, v:()=>S.dm},
 {id:"sys",   n:"Systems",      unit:"held",   col:"#8fb8ff", log:0, v:()=>heldSystems().length}
];
/* One of three of these is chosen per level. Effects stack additively on purpose:
   compounding them would run away over the sixty-odd levels a long game reaches. */
const PERKS=[
 {id:"out",  n:"Deeper Seams",   col:"#48e2ff", inc:"+3% ore production",
  t:"Every structure pulls more out of the same rock.",
  d:n=>"+"+(3*n)+"% ore production"},
 {id:"cost", n:"Bulk Contracts", col:"#5ce6a5", inc:"Structures cost less",
  t:"Standing orders with the yards. Everything you build is cheaper.",
  d:n=>"\u2212"+Math.round((1-1/(1+0.02*n))*100)+"% structure cost"},
 {id:"scan", n:"Sharper Optics", col:"#ffd166", inc:"+15% manual scan",
  t:"A hand scan pulls a bigger haul, and the limit on one rises to match.",
  d:n=>"+"+(15*n)+"% manual scan"},
 {id:"off",  n:"Deep Reserves",  col:"#a878ff", inc:"+1h offline cap",
  t:"Bank more of what your empire earns while you are away.",
  d:n=>"+"+n+"h offline cap"},
 {id:"cry",  n:"Slag Sorting",   col:"#d76cff", inc:"+6% crystal", req:5,
  t:"More crystal shaken out of the same smelting.",
  d:n=>"+"+(6*n)+"% crystal"},
 {id:"war",  n:"Gun Drill",      col:"#ff5f6d", inc:"+4% fleet damage & hull", req:12,
  t:"Your warships hit harder and come home in better shape.",
  d:n=>"+"+(4*n)+"% fleet damage & hull"}
];
const UNLOCK=[
 {lv:3,  p:"p-mis",  n:"Missions", d:"Objectives that pay crystal and Dark Matter."},
 {lv:5,  p:"p-res",  n:"Research", d:"Spend crystal on a tech tree of lasting upgrades."},
 {lv:5,  p:"p-map",  n:"Map",      d:"Claim other systems for Dark Matter and exotic resources."},
 /* PLAN-polish batch B item 3: Market moved from 6 to 9, so it opens alongside
    Raids (also 9) - salvage has a use the moment it appears. */
 {lv:9,  p:"p-mkt",  n:"Market",  d:"Sell surplus ore, crystal and exotics for Salvage or Dark Matter."},
 {lv:9,  p:"p-raid", n:"Raids",    d:"Build a fleet and raid convoys for loot and salvage."},
 {lv:20, p:"p-nex",  n:"Nexus",    d:"Permanent upgrades bought with Dark Matter."}
];
/* PLAN-pacing: single place every map-reveal literal reads instead of a bare 8/12 -
   grep for unlockLv("p-map")/unlockLv("p-raid") to find every site this batch touched. */
function unlockLv(p){ const u=UNLOCK.find(x=>x.p===p); return u?u.lv:Infinity; }
const MILE=[10,25,50,100,150,200,300,400,500];
/* ---------------- exotic resources, one per system type ---------------- */
const EXO=[
 {id:"ir", n:"Iridium",    col:"#8fb8ff", t:"Dense refractory metal. The frame of anything meant to last."},
 {id:"he", n:"Helium-3",   col:"#ffd166", t:"Clean fusion fuel, scooped out of gas giants."},
 {id:"xe", n:"Xenon",      col:"#c58fff", t:"A heavy noble gas that burns cold, and impossibly fast."},
 {id:"am", n:"Antimatter", col:"#ff6b8a", t:"Caged annihilation. The densest energy anyone has ever held."}
];
/* ---------------- exotic programmes ----------------
   The sink that makes an exotic a currency rather than a gate. Every node is priced in
   its own exotic and competes with the structure tier that eats the same pile. */
const XPROG=[
 {x:"ir", id:"frame", n:"Refractory Frames",  max:10, c:9, cg:2.2,
  d:lv=>"\u00d7"+fmt(Math.pow(1.07,lv))+" all production",
  t:"Iridium spars let every structure carry more load."},
 {x:"ir", id:"found", n:"Deep Foundations",   max:15, c:12, cg:2.2,
  d:lv=>"\u2212"+Math.round((1-1/(1+0.05*lv))*100)+"% structure cost",
  t:"Anchored into bedrock, so nothing ever needs rebuilding."},
 {x:"ir", id:"latt",  n:"Iridium Lattice",    max:10, c:18, cg:2.2,
  d:lv=>"\u00d7"+fmt(Math.pow(1.08,lv))+" from exotic structures",
  t:"The four deep tiers run hotter when their frames are pure iridium."},

 {x:"he", id:"core",  n:"Fusion Cores",       max:20, c:9, cg:2.2,
  d:lv=>"+"+(lv*6)+" fleet capacity",
  t:"Denser powerplants mean more hulls under one command."},
 {x:"he", id:"casc",  n:"Cascade Ignition",   max:15, c:15, cg:2.2,
  d:lv=>"\u00d7"+fmt(Math.pow(1.22,lv))+" fleet damage & hull",
  t:"A fusion cascade that never has to be relit."},
 /* polish batch A #11: Command Lattice only ever paid off in turn mode, which is
    dev-only - removing it from XPROG outright moved csim4.js's pacing output
    (doProg() buys the cheapest affordable programme each pass, and something else
    always ends up cheapest once this slot is gone). Kept as a real, unchanged
    XPROG entry so csim's own buyXp() calls behave exactly as before; made inert
    for an actual player instead - INERT_PROGS below (09-render.js reads it to skip
    the row, 15-wiring.js/buyXp() block a purchase through the UI). */
 {x:"he", id:"comm",  n:"Command Lattice",    max:12, c:24, cg:2.2,
  d:lv=>"+"+Math.floor(lv/3)+" command points in battle",
  t:"More of the fleet answers at once."},

 {x:"xe", id:"burn",  n:"Cold Burn",          max:18, c:9, cg:2.2,
  d:lv=>"\u00d7"+fmt(Math.pow(1.15,lv))+" crystal",
  t:"Xenon-cooled refineries shed far more crystal as slag."},
 {x:"xe", id:"optic", n:"Xenon Optics",       max:15, c:12, cg:2.2,
  d:lv=>"Manual scan \u00d7"+fmt(Math.pow(1.7,lv)),
  t:"Optics that see through the dark between systems."},
 {x:"xe", id:"vault", n:"Chilled Vaults",     max:15, c:18, cg:2.2,
  d:lv=>"+"+(lv*3)+"h offline cap",
  t:"Cold storage keeps production banked while you are away."},

 {x:"am", id:"yield", n:"Annihilation Yield", max:10, c:9, cg:2.2,
  d:lv=>"\u00d7"+fmt(Math.pow(1.08,lv))+" all production",
  t:"Caged annihilation feeding every furnace you own."},
 {x:"am", id:"caged", n:"Caged Suns",         max:15, c:15, cg:2.2,
  d:lv=>"\u00d7"+fmt(Math.pow(1.4,lv))+" Dark Matter from raids",
  t:"Annihilation cores make a raid worth crossing the dark for."},
 {x:"am", id:"loom",  n:"Loom Resonance",     max:12, c:24, cg:2.2,
  d:lv=>"\u00d7"+fmt(Math.pow(1.35,lv))+" exotic yield everywhere",
  t:"Every system you hold gives up more of what it holds."}
];
/* polish batch A #11: XPROG entries a real player never sees or buys through the
   UI (Command Lattice, "comm" - see its own header note above). The XPROG data and
   buyXp() are untouched so csim4.js's own buys are unaffected; renderProg() /
   updateEmpBars() (09-render.js) skip any row whose id is in this set instead. */
const INERT_PROGS=new Set(["comm"]);
/* ---------------- the map ----------------
   Every system carries an `owner`. Nothing owns anything yet, but rival empires are
   the planned next step and retrofitting ownership later would be painful.
   x / y are percentages of the map box, so the layout is resolution independent. */
/* ---------------- map sectors (item 3, patch566) ----------------
   The wheel is replaced by 5 sector "pages" the player swipes/taps between (build
   in patch567); this is just the static data, matching the owner-approved mock
   (/home/claude/sd/map-mock.html, /home/claude/sd/map-mock-notes.md) exactly:
   Core = home + ring1, Inner Reach = ring2, Frontier = ring3 west,
   The Deep = ring3 east + ring4 west, Beyond = ring4 east. Each SYS entry below
   carries sec (0..4, index into SECTORS) and sx/sy (its hand-laid position on that
   sector's own 0-100% box - NOT the old wheel x/y, which stay for now). */
const SECTORS=[
 {key:"core",    n:"Core",        tag:"CORE"},
 {key:"inner",   n:"Inner Reach", tag:"INNER REACH", chip:"REACH"},  /* chip: short label, "INNER REACH" clips on the map chip */
 {key:"frontier",n:"Frontier",    tag:"FRONTIER"},
 {key:"deep",    n:"The Deep",    tag:"THE DEEP"},
 {key:"beyond",  n:"Beyond",      tag:"BEYOND"}
];
/* lane graphs: pairs of system ids to connect within each sector (index into SECTORS) */
const SEC_LANES=[
 [["home","kor"],["home","dra"],["home","vel"],["home","tan"],["home","mir"]],
 [["ash","cor"],["cor","lys"],["ash","hal"],["hal","noc"],["noc","fer"],["fer","lys"]],
 [["thu","wra"],["wra","cal"],["cal","anv"],["thu","anv"]],
 [["erb","sab"],["erb","zen"],["zen","sab"],["zen","vor"],["vor","umb"],["umb","oro"],["oro","sab"]],
 [["aur","kal"],["kal","sev"],["sev","nyx"],["nyx","tha"],["tha","aur"]]
];
/* exit lane: which node in a sector leads onward, and to where (last sector has none) */
const SEC_EXIT=[
 {from:"tan", label:"INNER REACH \u2192"},
 {from:"fer", label:"FRONTIER \u2192"},
 {from:"anv", label:"THE DEEP \u2192"},
 {from:"oro", label:"BEYOND \u2192"},
 null
];
const SYS=[
 {id:"home", kind:"mixed", n:"Sol Reach", ring:0, sec:0, sx:50, sy:54, res:null, yld:0, cost:0, dm:0, lvl:0, owner:null, home:1,
  d:"Your homeworld, and everything you have built on it."},

 {id:"kor", kind:"rock", n:"Koru",      ring:1, sec:0, sx:22, sy:28, res:"ir", yld:0.055, cost:1.8e4,  dm:12,  lvl:12, owner:null,
  d:"A stripped rock orbiting close in. The crust is threaded with iridium."},
 {id:"dra", kind:"ore", n:"Draskhold",  ring:1, sec:0, sx:52, sy:14, res:null, yld:0, cost:1.0e5,  dm:15,  lvl:12, owner:null,
  d:"A close, unremarkable rock. No exotic worth naming \u2014 just a very great deal of ore."},
 {id:"vel", kind:"gas", n:"Velis",     ring:1, sec:0, sx:80, sy:26, res:"he", yld:0.050, cost:6.1e5,  dm:18,  lvl:14, owner:null,
  d:"A banded gas giant. Skimmers can work its upper cloud deck almost indefinitely."},
 {id:"tan", kind:"belt", n:"Tannhau",   ring:1, sec:0, sx:78, sy:80, res:"ir", yld:0.090, cost:8.4e6,  dm:26,  lvl:17, owner:null,
  d:"A shattered planetoid belt. Whatever broke it left the good metal exposed."},
 {id:"mir", kind:"gas", n:"Mireth",    ring:1, sec:0, sx:20, sy:82, res:"he", yld:0.080, cost:1.2e8,  dm:36,  lvl:20, owner:null,
  d:"Twin gas giants locked around a common centre. Twice the skimming, half the fuel."},

 /* PACING PASS (2026-09-04): this block's file ORDER now matches ascending
    cost/level exactly (tmap2.js's "claim costs increase down the list" /
    "level requirements never decrease" checks the raw array order, not the
    `ring` field) - ring2 and ring3 entries are interleaved here by that order
    while keeping each system's own `ring` field exactly as before, so map
    grouping/display is unaffected. Only the four systems this pass actually
    needed cheap-and-early (ash, fer, hal, anv - the ones a simple claim can
    reach; see HANDOVER) moved far down in cost/level; the rival-garrisoned
    systems around them (cor, lys, noc, cal, erb, sab, zen - never reachable
    by a simple claim regardless of these numbers) were nudged just enough to
    keep the whole sequence monotonic, not retuned for their own sake. */
 {id:"ash", kind:"void", n:"Ashfall",   ring:2, sec:1, sx:14, sy:40, res:"xe", yld:0.045, cost:3.9e9, dm:60,  lvl:23, owner:null,
  d:"A dead star's shell. The xenon here has been settling since before your species."},
 {id:"fer", kind:"ore", n:"Ferrous Hold", ring:2, sec:1, sx:78, sy:62, res:null, yld:0, cost:5.0e10, dm:70,  lvl:25, owner:null,
  d:"A whole belt collapsed onto one core. Nothing here but iron, and endless amounts of it."},
 {id:"cor", kind:"rock", n:"Corvid",    ring:2, sec:1, sx:52, sy:14, res:"ir", yld:0.170, cost:1.3e11, dm:90,  lvl:27, owner:null,
  d:"An iron world, nearly pure. The single richest metal find on the map."},
 {id:"hal", kind:"void", n:"Halcyon",   ring:2, sec:1, sx:18, sy:78, res:"am", yld:0.012, cost:5.0e11, dm:250, lvl:29, owner:null,
  d:"A calm system with a violent secret: a natural antimatter trap at its heart."},
 {id:"lys", kind:"ice", n:"Lysander",  ring:2, sec:1, sx:88, sy:36, res:"he", yld:0.160, cost:7.0e11, dm:130, lvl:30, owner:null,
  d:"A gas giant with a ring of frozen fuel. You can mine it without descending at all."},
 {id:"anv", kind:"ore", n:"Anvilreach",  ring:3, sec:2, sx:78, sy:34, res:null, yld:0, cost:9.0e11, dm:550, lvl:31, owner:null,
  d:"The ore here runs so deep that survey teams gave up trying to find the bottom."},
 {id:"noc", kind:"void", n:"Nocturne",  ring:2, sec:1, sx:52, sy:88, res:"xe", yld:0.075, cost:2.0e13, dm:180, lvl:33, owner:null,
  d:"A rogue world lit by nothing. Xenon pools in its canyons like water."},
 {id:"thu", kind:"ice", n:"Thule",     ring:3, sec:2, sx:24, sy:22, res:"am", yld:0.030, cost:4.0e13, dm:600, lvl:36, owner:null,
  d:"The edge of the charted map. Antimatter forms here and nobody knows why."},
 {id:"wra", kind:"ice", n:"Wraithe",   ring:3, sec:2, sx:14, sy:64, res:"xe", yld:0.115, cost:1.2e14, dm:740, lvl:38, owner:null,
  d:"Cold, empty, and far too quiet for a system with this much xenon in it."},
 {id:"cal", kind:"rock", n:"Caldera",   ring:3, sec:2, sx:46, sy:86, res:"ir", yld:0.190, cost:2.8e16, dm:330, lvl:41, owner:null,
  d:"A shield volcano the size of a continent, still venting after nine million years."},
 {id:"erb", kind:"void", n:"Erebus",    ring:3, sec:3, sx:18, sy:18, res:"xe", yld:0.210, cost:1.6e17, dm:400, lvl:43, owner:null,
  d:"Deep dark, far out. Nothing here has ever been catalogued."},
 {id:"sab", kind:"belt", n:"Sablemark", ring:3, sec:3, sx:84, sy:26, res:"he", yld:0.200, cost:9.0e17, dm:490, lvl:45, owner:null,
  d:"A gas giant with a ring of wrecks. Somebody lost a war here and nobody says whose."},
 {id:"zen", kind:"void", n:"Zenith",    ring:3, sec:3, sx:54, sy:52, res:"am", yld:0.055, cost:1.7e20, dm:900, lvl:51, owner:null,
  d:"The furthest light you can still call yours."},

 /* ring 4 - the deep map. Every one of these is held by a rival, so the far half of
    the board is taken by force rather than bought. */
 {id:"vor", kind:"void", n:"Vorn",      ring:4, sec:3, sx:16, sy:68, res:"am", yld:0.090, cost:5.7e21, dm:1300, lvl:55, owner:null,
  d:"A dead star with something still orbiting it. The Covenant got here first."},
 {id:"aur", kind:"gas", n:"Aurelis",   ring:4, sec:4, sx:50, sy:16,  res:"he", yld:0.300, cost:3.2e22, dm:1550, lvl:57, owner:null,
  d:"Refineries still running on standing orders from an authority that no longer exists."},
 {id:"kal", kind:"gas", n:"Kalthex",   ring:4, sec:4, sx:84, sy:38, res:"xe", yld:0.340, cost:1.9e23, dm:1800, lvl:59, owner:null,
  d:"Xenon storms deep enough to hide a fleet in. Helion mines them anyway."},
 {id:"umb", kind:"rock", n:"Umbra",     ring:4, sec:3, sx:46, sy:86, res:"ir", yld:0.420, cost:6.2e24, dm:2400, lvl:63, owner:null,
  d:"No light reaches it and nothing here was ever charted. The iridium is almost pure."},
 {id:"sev", kind:"gas", n:"Sevrin",    ring:4, sec:4, sx:80, sy:78, res:"he", yld:0.380, cost:2.1e26, dm:3200, lvl:67, owner:null,
  d:"A gas giant the Vasht have been draining for a century."},
 {id:"tha", kind:"void", n:"Thanaris",  ring:4, sec:4, sx:16, sy:58, res:"am", yld:0.200, cost:1.2e27, dm:3700, lvl:69, owner:null,
  d:"A cold void system the Covenant fortified generations ago. What they are guarding there was never explained." /* PLACEHOLDER, patch578 */},
 {id:"oro", kind:"void", n:"Orokh",     ring:4, sec:3, sx:80, sy:78,  res:"am", yld:0.150, cost:6.9e27, dm:4200, lvl:71, owner:null,
  d:"The Covenant call it holy ground. They will not discuss why."},
 {id:"nyx", kind:"void", n:"Nyx",       ring:4, sec:4, sx:46, sy:90, res:"am", yld:0.260, cost:2.3e29, dm:5500, lvl:75, owner:null,
  d:"Named for the dark. The survey team that named it did not come back to explain. Past it, the maps simply stop." /* PLACEHOLDER 2nd sentence, patch578 */}
];
const SYSMAP=(()=>{ const m={}; for(const s of SYS)m[s.id]=s; return m })();
const RIVALS=[
 {id:"cov", n:"The Covenant", col:"#ff8fd0",
  t:"Zealots who believe the deep dark is owed to them. They fortify and they do not trade."},
 {id:"hel", n:"Helion Reach", col:"#ffb45c",
  t:"An old mining consortium gone feral. Whatever they hold, they hold for the ore."},
 {id:"vsh", n:"Vasht Collective", col:"#5ce6a5",
  t:"A drifting swarm-culture. They take what they need and leave the husk behind."}
];
const RIVALMAP=(()=>{ const m={}; for(const r of RIVALS)m[r.id]=r; return m })();
/* Two of the three are promoted to real antagonists. Vasht stays ambient garrison
   flavour deliberately - three escalating enemies at once is noise, and the contrast
   between "a faction that reacts" and "a faction that just sits there" is what makes
   the other two read as characters.

   They differ ONLY in how they react, which is what the design interview asked for:
   Helion wants the ore, so holding a wide rich empire angers them and they come for
   your richest system, often, in numbers. The Covenant only cares that you intruded,
   so they build slowly and arrive rarely, heavily, at whatever you hold nearest to
   their space. */
const RVACT=["hel","cov"];
const RVBEH={
 hel:{ id:"hel", assault:22, perSys:0.20, cool:150, secs:40, wave:1.30, hard:0.86, pick:"rich",
       warn:"Helion Reach is moving on", flav:"They want the ore. They always want the ore." },
 cov:{ id:"cov", assault:34, perSys:0.09, cool:260, secs:46, wave:0.96, hard:0.92, pick:"deep",
       warn:"The Covenant is descending on", flav:"You went into their dark. They do not forgive it." }
};
const RV_MAX=100;          /* pressure at which a fleet is despatched */
const RV_GRACE=95;         /* seconds between meeting a rival and their first fleet */
const RV_MINGAP=7200;      /* no two attacks closer than this, whoever sends them */
const RV_EXPAND=21600;     /* how often a rival claims neutral ground: slower than a fleet,
                              so the map drifts rather than nags */
const RV_FREEMIN=2;        /* never squeeze the neutral frontier below this many systems */
const RV_AMBMIN=1;         /* and never wipe the ambient faction off the map entirely */
const RV_AWAYMAX=4;        /* most moves a single absence can report, however long it was */
const THQ_MAX=4;           /* how many can be waiting at once */
const THQ_LIFE=24*3600;    /* how long each one waits for you */
const DEFLV=20;            /* rivals ignore you until raiding is established */
/* STAGE C (owner decision 8): late-game sabotage threats aimed at home instead of a
   held system. All three TUNING-PENDING - see rvMaybeThreat()'s own gate for exactly
   where these are read and why the roll can never reach csim4.js. */
const SAB_CHANCE=0.35;     /* TUNING-PENDING: chance an eligible launch targets home instead */
const SAB_STEAL=0.25;      /* TUNING-PENDING: fraction of banked S.en stolen on a loss */
const SAB_EN_MIN=10;       /* TUNING-PENDING: S.en must be at least this before sabotage can start */
/* ======================= STAGE 2: occupation & the frontier =======================
   See HANDOVER "combat build, Stage 2" for the full reasoning. Short version:
   - occupation replaces destruction: a held system a rival takes keeps its buildings
     and stockpiles untouched (S.occ marks it; S.sys is never deleted for this reason
     again) - production simply stops until it is retaken, then resumes instantly
     because nothing about the system itself ever changed.
   - frontier rule: a rival can only reach a held system that borders rival/contested
     ground (see sysIsFrontier, patch460) - home and the true interior are
     structurally unreachable, not just unlikely.
   - action budget: a token bucket per rival, not a flat timer - refills at one move
     every RIVAL_MOVE_HOURS of real time, capped at RIVAL_MOVE_CAP so no absence,
     however long, hands back more than a couple of losses at once.
   SCOPE NOTE (see HANDOVER for the full writeup): the frontier rule and the action
   budget below govern the NEW offline occupation mechanic (rvMoveAway, patch461)
   ONLY, not the pre-existing live thq "day to answer" pipeline - rvTargetFor()/
   rvMaybeThreat()/holdResolve()'s online branch are byte-for-byte untouched by this
   stage, verified against csim4.js, which must stay identical. There is no live,
   ticking, in-session telegraph countdown in this build for that reason - a rival
   move made possible by the action budget is only ever visible after the fact, in
   the return report (2D). */
const RIVAL_MOVE_HOURS=8;      /* one new move-token every this many real hours */
const RIVAL_MOVE_CAP=2;        /* token bucket size - the hard ceiling per rival, any timescale */
const RIVAL_MOVE_SECS=RIVAL_MOVE_HOURS*3600;
const OCC_WEAKEN_SECS=3*3600;  /* a freshly occupied system's garrison stays weak this long */
const OCC_WEAKEN_MULT=0.55;    /* its assault difficulty is cut to this fraction while weak */
/* ======================= STAGE 3: telegraphed LIVE fleets =======================
   Same idea as 2B/2C (frontier + weakest-defended targeting, occupation on arrival)
   but with a real 30-60s on-screen countdown while the player is actually in the
   app, per the original 2C design text this build had scoped down to "offline only".
   Structurally unreachable from tick()/rvTick()/csim4.js: every function that spends
   these constants (patch471/472) is called ONLY from frame() or from boot - see
   HANDOVER for the full writeup and the csim4.js evidence.
   DELIBERATELY SEPARATE from the offline action budget: S.lfCd is its own per-rival
   real-time cooldown, spent immediately on launch (no banking, no cap-of-2), and
   never read or written by rvMoveAway()/rvOf().mv or vice versa. Sharing the token
   bucket would couple two mechanisms with different reload semantics for no real
   benefit - a live fleet is ephemeral runtime state (LF, below), the offline budget
   is a saved counter that must survive a reload exactly. A separate gate is simpler
   to reason about and to verify in isolation. LIVE_FLEET_COOL_HOURS is chosen so this
   mechanism cannot be meaningfully more aggressive than the offline one it mirrors
   (principle 3, "capped, soft consequences") - see the tuning note in HANDOVER. */
const LIVE_FLEET_ETA_MIN=30, LIVE_FLEET_ETA_MAX=60;   /* 2C: "30-60s from launch notice to battle" */
const LIVE_FLEET_COOL_HOURS=6;  /* real hours of ACTIVE PLAY (frame() time only - see below)
   a rival must wait between live fleets, independent per rival and independent of
   the offline action budget */
const LIVE_FLEET_COOL_SECS=LIVE_FLEET_COOL_HOURS*3600;
/* Garrison strength. Deliberately on the map's richest systems: the fight is what
   makes them expensive, not the price tag. */
/* Wraithe is deliberately unheld: ring 3 keeps one system a player can simply buy,
   so the whole of the late map is not gated behind a fight. The deep map is
   entirely rival-held. arch is STAGE 1: see HANDOVER for the full per-system
   reasoning - short version below each ring. */
const GARRISON={
 /* ring 1: Fortress alone, and gently (lowest def in the table) - introduces the
    archetype before the player has to solve it under real pressure. */
 tan:{o:"vsh",def:2.2,  arch:"fortress"},
 /* ring 2: all of Swarm/Ghost/Fortress now on the table for map texture. */
 cor:{o:"cov",def:3.4,  arch:"swarm"},    lys:{o:"hel",def:4.2,  arch:"ghost"},
 noc:{o:"vsh",def:5.0,  arch:"fortress"},
 /* ring 3: Lance debuts here, so a player reaches the deep map having already met
    all four archetypes at least once. */
 cal:{o:"hel",def:5.8,  arch:"swarm"},    erb:{o:"cov",def:6.4,  arch:"lance"},
 sab:{o:"cov",def:7.0,  arch:"ghost"},    zen:{o:"hel",def:8.0,  arch:"fortress"},
 /* ring 4: leans Lance (3 of 8) for a run of dramatic signature fights on the
    toughest defences in the table, Fortress/Ghost for variety, one Swarm kept as
    a contrast/breather target rather than every deep system being a set-piece. */
 vor:{o:"cov",def:9.5,  arch:"swarm"},    aur:{o:"hel",def:10.2, arch:"lance"},
 kal:{o:"hel",def:11.0, arch:"ghost"},    umb:{o:"vsh",def:13.0, arch:"fortress"},
 sev:{o:"vsh",def:15.0, arch:"lance"},    oro:{o:"cov",def:17.0, arch:"ghost"},
 nyx:{o:"hel",def:20.0, arch:"lance"},    tha:{o:"cov",def:16.0, arch:"fortress"}
};
for(const s of SYS){ const g=GARRISON[s.id]; if(g){ s.owner=g.o; s.def=g.def; s.arch=g.arch } }


const RESH=[
 {id:"drill", n:"Deep Core Drilling", max:12, c:6,  cg:3.0, col:"#48e2ff", req:null,
  ic:`<path d="M24 4v14M17 18h14l-3 10h-8z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M20 28h8l-4 14z" fill="currentColor"/>`,
  d:lv=>"+"+Math.round((Math.pow(1.15,lv)-1)*100)+"% all ore production", t:"Every structure pulls more out of the same rock."},
 {id:"amp",   n:"Scanner Amplifier",  max:12, c:4,  cg:3.0, col:"#5ce6a5", req:null,
  ic:`<circle cx="24" cy="34" r="4" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M14 27a13 13 0 0 1 20 0"/><path d="M8 20a21 21 0 0 1 32 0"/></g>`,
  d:lv=>"Manual scan ×"+fmt(Math.pow(2.2,lv)), t:"Sharper sensors mean a hand scan pulls a real haul."},
 {id:"cryo",  n:"Crystal Resonance",  max:10, c:10, cg:3.1, col:"#a878ff", req:{id:"drill",lv:2},
  ic:`<path d="M24 5l10 13-5 25h-10L14 18z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 18h20M24 5v38" fill="none" stroke="currentColor" stroke-width="2" opacity=".6"/>`,
  d:lv=>"+"+Math.round((Math.pow(1.6,lv)-1)*100)+"% crystal rate", t:"Tuned refineries shed far more crystal as slag."},
 {id:"cold",  n:"Cryo Storage",       max:10, c:18, cg:3.2, col:"#79c6ef", req:{id:"amp",lv:2},
  ic:`<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 5v38M8 14l32 20M40 14L8 34"/><path d="M18 9l6 5 6-5M18 39l6-5 6 5"/></g>`,
  d:lv=>"Offline cap "+(2+lv*2)+"h", t:"Frozen buffers keep production banked while you are away."},
 /* PLAN-governors: renamed in copy only - id stays "auto" so saves and Void
    Cartography's req:{id:"auto",lv:2} are untouched. max 10->3 (a save with
    S.rs.auto>3 is clamped in adopt()); cost curve (c/cg) unchanged. The node's old
    per-tier auto-buy effect was retired in patch403 - see the comment at govTick()'s
    call site in tick() (06-progress.js) for what actually spends these levels now.
    PLAN-polish batch C #2 (Governors v2): max 3->6 (adopt()'s own clamp raised to
    match); cost curve still unchanged. */
 /* sec:1 (owner): Governors only open once the empire reaches the second sector -
    the player has to hold a system in the Inner Reach before the first level can be
    researched. See resLocked(). */
 {id:"auto",  n:"Governors",   max:6, c:25, cg:3.2, col:"#ffd166", req:{id:"drill",lv:4}, sec:1,
  ic:`<rect x="14" y="14" width="20" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><rect x="21" y="21" width="6" height="6" fill="currentColor"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M19 14V7M29 14V7M19 41v-7M29 41v-7M14 19H7M14 29H7M41 19h-7M41 29h-7"/></g>`,
  d:lv=>lv?("Appoint up to "+lv+" governor"+(lv>1?"s":"")):"No governors yet",
  t:"Each level hands one more system's buildings to a governor who buys on their own."}, /* PLACEHOLDER */
 {id:"void",  n:"Void Cartography",   max:8,  c:60, cg:3.6, col:"#ff8fd0", req:{id:"auto",lv:2},
  ic:`<circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="3"/><path d="M31 17l-4 10-10 4 4-10z" fill="currentColor"/><path d="M24 3v5M24 40v5M3 24h5M40 24h5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  d:lv=>"+"+(lv*12)+"% Dark Matter from raids", t:"Charted deep-space routes turn up richer prizes."},

 /* ---- the war branch: paid in SALVAGE, not crystal ----
    Crystal income passes a billion an hour once the economy is running, so a
    crystal-priced defence upgrade would be free the moment it unlocked. Salvage is won
    by fighting and already competes with the armoury and the refits, which makes these
    a real choice rather than a queue. Gated behind Void Cartography so the branch
    appears about when the rivals start sending fleets. */
 {id:"pdef", n:"Point Defence Grid", max:10, c:30, cg:1.75, col:"#ff5f6d", cur:"sv",
  req:{id:"void",lv:2},
  ic:`<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="24" cy="24" r="6"/><path d="M24 5v7M24 36v7M5 24h7M36 24h7"/><path d="M11 11l5 5M32 32l5 5M37 11l-5 5M16 32l-5 5" opacity=".7"/></g>`,
  d:lv=>"\u00d7"+fmt(Math.pow(1.13,lv))+" system defence damage",
  t:"Tracking mounts on every platform. Your own guns bite harder when you fly the defence yourself."},
 {id:"bat",  n:"Orbital Batteries",  max:10, c:40, cg:1.72, col:"#ff9a6b", cur:"sv",
  req:{id:"pdef",lv:3},
  ic:`<g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M8 34h32l-4-10H12z"/><path d="M16 24V14h6v10M26 24V17h6v7"/><path d="M12 40h24" stroke-linecap="round"/></g>`,
  d:lv=>"+"+(lv*0.42).toFixed(1)+" garrison strength",
  t:"Crewed guns that keep firing when you are not there. Better odds every time you hold the line without me."},
 {id:"bul",  n:"Reinforced Bulkheads", max:8, c:50, cg:1.80, col:"#9fb2d9", cur:"sv",
  req:{id:"pdef",lv:2},
  ic:`<g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M24 5l15 6v13c0 9-6 15-15 19-9-4-15-10-15-19V11z"/><path d="M24 15v18M16 22h16" stroke-linecap="round" opacity=".75"/></g>`,
  d:lv=>"\u00d7"+fmt(Math.pow(1.10,lv))+" system hull in a defence",
  t:"Deeper armour on the installations themselves. The system takes longer to fall, however the fight is going."}
];
const RESOFF=(()=>{const m={};const get=id=>{const r=RESH.find(x=>x.id===id);
  if(m[id]!==undefined)return m[id];
  m[id]= r.req ? get(r.req.id)+r.req.lv : 0; return m[id]};
  RESH.forEach(r=>get(r.id)); return m})();
const RNAMES={
 drill:["Percussive Bits","Diamond Tipping","Thermal Lance","Slurry Reclaim","Seam Mapping","Resonant Fracture",
   "Mantle Tap","Plasma Bore","Continuous Face","Deep Mantle Rig","Core Siphon","Planetary Unmaking"],
 amp:["Wide Aperture","Signal Gain","Phased Array","Doppler Sieve","Harmonic Lock","Neutrino Sounding",
   "Beam Focus","Quantum Ranging","Echo Stacking","Gravitic Sounding","Predictive Sweep","Omniscan"],
 cryo:["Slag Sorting","Lattice Seeding","Annealing Cycle","Resonant Casting","Flux Purge","Vapour Deposition",
   "Zero-G Growth","Phase Alignment","Supercritical Bloom","Perfect Lattice"],
 cold:["Insulated Silos","Vacuum Jacketing","Helium Cascade","Stasis Cells","Superfluid Buffer",
   "Time-Dilated Vault","Bose Reservoir","Frozen Ledger","Absolute Zero Array","Eternal Cache"],
 auto:["Task Scheduler","Fleet Dispatch","Supply Heuristics","Predictive Ordering","Self-Repair Loop",
   "Distributed Consensus","Autonomous Foremen","Strategic Planner","Recursive Delegation","Total Autonomy"],
 void:["Collapse Survey","Horizon Charting","Entropy Ledger","Fold Navigation","Null Geodesics",
   "Vacuum Harvest","Brane Mapping","Grand Atlas"],
 pdef:["Tracking Mounts","Predictive Lead","Linked Fire","Cooled Barrels","Spread Control",
   "Sensor Fusion","Rapid Cycling","Overcharged Coils","Saturation Doctrine","Killing Ground"],
 bat:["Crewed Turrets","Standing Watch","Interlocking Arcs","Magazine Depth","Drilled Gunners",
   "Hardened Cupolas","Fire Discipline","Counter-Battery","Siege Reserve","The Wall"],
 bul:["Blast Doors","Ablative Skin","Honeycomb Frame","Compartment Seals","Load Spreading",
   "Redundant Spars","Deep Keel","Fortress Spine"]
};
const GLYPH=[
 `<circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="3"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/></g>`,
 `<path d="M24 5l16 9v20l-16 9-16-9V14z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="24" r="5" fill="currentColor"/>`,
 `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M10 34c8-4 8-16 0-20M38 34c-8-4-8-16 0-20"/><path d="M24 10v28"/></g>`,
 `<rect x="9" y="9" width="30" height="30" rx="5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M17 24h14M24 17v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
 `<path d="M24 6l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`,
 `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 30c5 0 5-12 10-12s5 12 10 12 5-12 10-12 5 12 6 12"/></g>`,
 `<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 8v16l11 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>`,
 `<path d="M14 8h20l-6 14 8 18H12l8-18z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`,
 `<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="24" cy="24" r="5"/><ellipse cx="24" cy="24" rx="18" ry="7"/><ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(60 24 24)"/></g>`,
 `<path d="M8 38V20l16-12 16 12v18z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M19 38V27h10v11" stroke="currentColor" stroke-width="3" fill="none"/>`,
 `<g stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"><path d="M24 40V16"/><path d="M13 27l11-11 11 11"/><path d="M10 8h28"/></g>`,
 `<circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="33" cy="33" r="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 20l9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
 `<path d="M10 24h28M24 10v28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5 5"/>`,
 `<path d="M24 6C14 16 14 32 24 42 34 32 34 16 24 6z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 24h32" stroke="currentColor" stroke-width="3"/>`,
 `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 42V24"/><circle cx="24" cy="15" r="9"/><path d="M17 38h14"/></g>`,
 `<path d="M6 24l10-10v6h16v-6l10 10-10 10v-6H16v6z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`,
 `<g fill="none" stroke="currentColor" stroke-width="3"><rect x="8" y="14" width="32" height="22" rx="4"/><path d="M8 22h32"/></g><circle cx="24" cy="30" r="3" fill="currentColor"/>`,
 `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M24 24m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/><path d="M24 8a16 16 0 0 1 16 16"/><path d="M24 40A16 16 0 0 1 8 24"/></g>`
];
function glyphFor(bi,k){ return GLYPH[(bi*5+k*7)%GLYPH.length] }
/* r.sec: the node also needs a held system in that sector (or further out) before its
   FIRST level - never re-locks something already researched (an older save). */
function resSecLocked(r){ return !!r.sec && lv(S.rs,r.id)<1 && !heldSystems().some(s=>s.sec>=r.sec) }
function resLocked(r){ return (r.req ? lv(S.rs,r.req.id) < r.req.lv : false) || resSecLocked(r) }
function resReqText(r){
  if(r.req && lv(S.rs,r.req.id)<r.req.lv){ const src=RESH.find(x=>x.id===r.req.id); return "Requires "+src.n+" "+r.req.lv }
  if(resSecLocked(r))return "Requires a system in the "+SECTORS[r.sec].n;
  return "";
}
/* ---------------- the Research tab's four trees (owner: "separate it into an
   offensive/combat tree, defense tree, economy tree... programmes could be folded
   in") ----------------
   Presentation only: every id here is an existing RESH node (bought with buyRes()) or
   an existing XPROG programme (bought with buyXp()) - same costs, same maxes, same
   requirements, same save fields. TECH_TREES says where each one is shown; TECH_FX is
   the plain one-line "what it does per level" each card leads with, so nobody has to
   guess what a Scanner Amplifier is. Economy forks under its trunk: the everyday
   resources on one side, the exotics on the other. Command Lattice (INERT_PROGS)
   is in no tree, exactly as it had no card before. */
const TECH_TREES=[
 {id:"eco", n:"ECONOMY", what:"What your empire earns. One trunk, then two branches: the everyday resources on the left, the rare exotics on the right.",
  trunk:"drill", cols:[{h:"ORE & CRYSTAL", ids:["cryo","frame","found","burn","yield"]},{h:"EXOTICS", ids:["latt","loom"]}]},
 {id:"war", n:"COMBAT",  what:"How hard your fleets hit, and what a raid pays.", ids:["core","casc","void","caged"]},
 {id:"def", n:"DEFENCE", what:"What protects the systems you hold when a rival comes for them.", ids:["pdef","bat","bul"]},
 {id:"cmd", n:"COMMAND", what:"Running the empire: your own scans, time away, and who manages your worlds.", ids:["amp","optic","cold","vault","auto"]}
];
const TECH_FX={
 drill:"<b>+15% ore</b> from every structure, per level",
 cryo:"<b>+60% crystal</b> per level", frame:"<b>\u00d71.07 all production</b> per level",
 found:"<b>Cheaper structures</b>, about \u22125% per level", burn:"<b>\u00d71.15 crystal</b> per level",
 yield:"<b>\u00d71.08 all production</b> per level", latt:"<b>\u00d71.08 from exotic structures</b> per level",
 loom:"<b>\u00d71.35 exotic yield</b> everywhere, per level",
 core:"<b>+6 fleet capacity</b> per level", casc:"<b>\u00d71.22 fleet damage and hull</b> per level",
 void:"<b>+12% Dark Matter</b> from raids, per level", caged:"<b>\u00d71.4 Dark Matter</b> from raids, per level",
 pdef:"<b>\u00d71.13 defence damage</b> when you fly the defence, per level",
 bat:"<b>+0.4 garrison strength</b> per level, for fights without you",
 bul:"<b>\u00d71.10 system hull</b> in a defence, per level",
 amp:"<b>Manual scan \u00d72.2</b> per level", optic:"<b>Manual scan \u00d71.7</b> per level",
 cold:"<b>+2h offline cap</b> per level", vault:"<b>+3h offline cap</b> per level",
 auto:"<b>One more governor</b> per level, and one per extra sector you hold"
};
function techIds(t){ return t.trunk ? [t.trunk].concat(...t.cols.map(c=>c.ids)) : t.ids }
const PJ1_MUL=1.25, PJ2_MUL=1.25, PJ3_MUL=1.5;   /* TUNING-PENDING: THE PROJECT bonuses */
const NEXUS=[
 /* cg was 1.55: 25 levels of that is 521,065 DM, 84% of the whole tree and about
    fifteen times every source in the game put together. 1.345 keeps the same first level
    and the same x95 payoff at the top, for 23,930. */
 {id:"ent", n:"Quantum Entanglement", max:25, c:5,  cg:1.345, d:lv=>"×"+fmt(Math.pow(1.2,lv))+" all production", t:"Compounding empire-wide output."},
 {id:"chr", n:"Chronal Buffer",       max:5,  c:20, cg:2.0,  d:lv=>"Offline earns "+(50+lv*10)+"%", t:"Idle production efficiency while away."},
 {id:"ovs", n:"Drone Overseer",       max:10, c:30, cg:1.621,  d:lv=>"Auto-scans "+(lv*3)+"×/sec", t:"Fires manual scans for you, forever."},
 {id:"syn", n:"Crystal Synthesis",    max:10, c:22, cg:1.781,  d:lv=>"×"+fmt(Math.pow(2,lv))+" crystal gain", t:"Doubles crystal per level."},
 {id:"war", n:"War Doctrine",       max:15, c:16, cg:1.532,  d:lv=>"×"+fmt(Math.pow(1.3,lv))+" fleet damage & hull", t:"Permanent multiplier on every warship you field."},
 /* ---- THE PROJECT (patch583): priced in Exotic Nodes, each gated on owning the
    one before it. Names/effects placeholder-ish; PJ1_MUL/PJ2_MUL/PJ3_MUL (below,
    where they are actually applied - patch584) are TUNING-PENDING. */
 {id:"pj1", n:"Resonance Array", max:1, c:60,  cg:1, cur:"en",
  d:lv=>lv?"\u00d71.25 exotic production":"No bonus yet",
  t:"Feeds a fraction of every Node straight back into the exotic lattices that made it."},
 {id:"pj2", n:"Deep Lattice", max:1, c:250, cg:1, cur:"en", req:"pj1",
  d:lv=>lv?"\u00d71.25 fleet damage & hull":"No bonus yet",
  t:"Reinforces every hull in the fleet along the same lattice the Array first opened."},
 {id:"pj3", n:"Sovereign Key", max:1, c:900, cg:1, cur:"en", req:"pj2",
  d:lv=>lv?"\u00d71.5 ore production":"No bonus yet",
  t:"Something in it reads the whole map at once. Ore comes easier wherever it is watching."},
 /* the ??? node (patch584) - req:"pj3" is only HALF its lock; nexLocked()/
    nexReqText() special-case "pjx" for the other half (Nyx held). Its own `t`
    is never read (renderNex() special-cases pjx to show STORY.nodeHint instead -
    see the patch header for why), kept here only so the object shape matches
    every other NEXUS entry. */
 {id:"pjx", n:"???", max:1, c:1500, cg:1, cur:"en", req:"pj3",
  d:lv=>lv?"The turn begins.":"Unknown",
  t:""}
];
/* PLAN-polish batch C (Parked "mission tag", decided mock variant C): missions whose
   `k` gates on a specific GENS tier via gCount(gi) now name that tier explicitly as
   `gi` (and how many it takes as `need`) instead of the strip having to parse `d`'s
   own English text back apart to find it - see ladderTierRow()'s own header note
   (09-render.js) for the reader. Every other mission (scans, ore/rate thresholds,
   level, wins, salvage, crew, warships, structure totals) has no single tier behind
   it, so it carries neither field and the strip never matches a row for it. */
const MISSIONS=[
 {d:"Own 15 Mining Drones",          k:s=>gCount(0)>=15,       p:s=>gCount(0)/15,             r:{c:4},  gi:0, need:15},
 {d:"Perform 25 manual scans",       k:s=>s.clicks>=25,        p:s=>s.clicks/25,               r:{c:5}},
 {d:"Own 10 Smelter Pods",             k:s=>gCount(1)>=10,       p:s=>gCount(1)/10,             r:{c:8},  gi:1, need:10},
 {d:"Bank 50,000 ore at once",       k:s=>s.ore>=5e4,          p:s=>s.ore/5e4,                 r:{c:12}},
 {d:"Reach 250 ore per second",      k:s=>rate()>=250,         p:s=>rate()/250,                r:{c:14}},
 {d:"Sink your first Crust Borer",     k:s=>gCount(2)>=1,        p:s=>gCount(2)>=1?1:0,         r:{c:15}, gi:2, need:1},
 {d:"Perform 100 manual scans",       k:s=>s.clicks>=100,       p:s=>s.clicks/100,              r:{c:22}},
 {d:"Reach 5,000 ore per second",    k:s=>rate()>=5000,        p:s=>rate()/5000,               r:{c:35}},
 {d:"Own 25 Fabricators",            k:s=>gCount(3)>=25,       p:s=>gCount(3)/25,              r:{c:60,dm:2},  gi:3, need:25},
 {d:"Reach level 12",                k:s=>level()>=12,         p:s=>level()/12,                r:{c:80,dm:5}},
 {d:"Own 100 Mining Drones",         k:s=>gCount(0)>=100,      p:s=>gCount(0)/100,             r:{c:120}, gi:0, need:100},
 {d:"Build an Orbital Harvester",         k:s=>gCount(4)>=1,        p:s=>gCount(4)>=1?1:0,         r:{c:180,dm:3}, gi:4, need:1},
 {d:"Hold 250 crystal at once",      k:s=>s.cry>=250,          p:s=>s.cry/250,                 r:{dm:6}},
 {d:"Win your first raid",           k:s=>(s.wins||0)>=1,      p:s=>(s.wins||0)>=1?1:0,        r:{c:220,dm:4}},
 {d:"Field 20 warships",             k:s=>allFleetShips(s)>=20, p:s=>allFleetShips(s)/20, r:{c:500,dm:7}},
 {d:"Strip 100 salvage",             k:s=>(s.svAll||0)>=100,  p:s=>(s.svAll||0)/100,           r:{c:600,dm:6}},
 {d:"Sign your first crew",          k:s=>(s.crew||[]).length>=1, p:s=>(s.crew||[]).length>=1?1:0, r:{c:800,dm:8}},
 {d:"Reach 1M ore per second",       k:s=>rate()>=1e6,         p:s=>rate()/1e6,                r:{c:400,dm:8}},
 {d:"Reach level 20",                k:s=>level()>=20,         p:s=>level()/20,                r:{c:600,dm:14}},
 {d:"Own 50 Fusion Forges",          k:s=>gCount(5)>=50,       p:s=>gCount(5)/50,              r:{c:900,dm:18}, gi:5, need:50},
 {d:"Own 400 structures in total",   k:s=>tot()>=400,          p:s=>tot()/400,                 r:{c:1500,dm:25}},
 {d:"Build a Dyson Swarm",           k:s=>gCount(6)>=1,        p:s=>gCount(6)>=1?1:0,          r:{c:2500,dm:35}, gi:6, need:1},
 {d:"Reach 1B ore per second",       k:s=>rate()>=1e9,         p:s=>rate()/1e9,                r:{c:5000,dm:50}},
 {d:"Reach level 30",                k:s=>level()>=30,         p:s=>level()/30,                r:{c:9000,dm:90}},
 {d:"Open a Wormhole Crucible",         k:s=>gCount(7)>=1,        p:s=>gCount(7)>=1?1:0,         r:{c:2e4,dm:150}, gi:7, need:1},
 {d:"Reach 1T ore per second",       k:s=>rate()>=1e12,        p:s=>rate()/1e12,               r:{c:6e4,dm:300}},
 {d:"Sink a Singularity Well",     k:s=>gCount(8)>=1,        p:s=>gCount(8)>=1?1:0,           r:{c:2e5,dm:600}, gi:8, need:1},
 {d:"Own 1,000 structures in total", k:s=>tot()>=1000,         p:s=>tot()/1000,                r:{c:8e5,dm:1200}},
 {d:"Claim the Galactic Nexus",      k:s=>gCount(9)>=1,        p:s=>gCount(9)>=1?1:0,          r:{c:5e6,dm:5000}, gi:9, need:1}
];
const ACHS=[
 {id:"a1", n:"First Contact",     d:"Perform a manual scan",        k:s=>s.clicks>=1,   b:.01},
 {id:"a2", n:"Rock Hound",        d:"1,000 manual scans",           k:s=>s.clicks>=1000,b:.02},
 {id:"a3", n:"Swarm",             d:"Own 100 Mining Drones",        k:s=>gCount(0)>=100, b:.02},
 {id:"a4", n:"Logistics",         d:"Own 100 Ore Barges",           k:s=>gCount(1)>=100, b:.02},
 {id:"a5", n:"Millionaire",       d:"Earn 1M total ore",            k:s=>s.all>=1e6,    b:.01},
 {id:"a6", n:"Industrialist",     d:"Earn 1B total ore",            k:s=>s.all>=1e9,    b:.02},
 {id:"a7", n:"Tycoon",            d:"Earn 1T total ore",            k:s=>s.all>=1e12,   b:.03},
 {id:"a8", n:"Star Eater",        d:"Earn 1Qa total ore",           k:s=>s.all>=1e15,   b:.05},
 {id:"a9", n:"Crystalline",       d:"Hold 100 crystal",             k:s=>s.cry>=100,    b:.02},
 {id:"a10",n:"Refractor",         d:"Hold 10,000 crystal",          k:s=>s.cry>=1e4,    b:.03},
 {id:"a11",n:"Established",       d:"Reach level 10",               k:s=>level()>=10,   b:.03},
 {id:"a12",n:"Ascendant",         d:"Reach level 25",               k:s=>level()>=25,   b:.04},
 {id:"a13",n:"Ascendancy",        d:"Reach level 40",               k:s=>level()>=40,   b:.08},
 {id:"a14",n:"Ringworld",         d:"Build an Orbital Ring",        k:s=>gCount(4)>=1,   b:.02},
 {id:"a15",n:"Sunwrapped",        d:"Build a Dyson Swarm",          k:s=>gCount(6)>=1,   b:.04},
 {id:"a16",n:"Shortcut",          d:"Open a Wormhole Array",        k:s=>gCount(7)>=1,   b:.05},
 {id:"a17",n:"Tamed Gravity",     d:"Ignite a Singularity Core",    k:s=>gCount(8)>=1,   b:.07},
 {id:"a18",n:"Dominion",          d:"Claim the Galactic Nexus",     k:s=>gCount(9)>=1,   b:.10},
 {id:"a19",n:"Sprawl",            d:"Own 500 structures",           k:s=>tot()>=500,    b:.04},
 {id:"a20",n:"Deep Pockets",      d:"Earn 500 Dark Matter",         k:s=>s.dmAll>=500,  b:.06},
 {id:"a21",n:"Scholar",           d:"25 research levels",           k:s=>Object.values(s.rs).reduce((a,b)=>a+b,0)>=25, b:.05},
 {id:"a23",n:"First Blood",     d:"Win a raid",                    k:s=>(s.wins||0)>=1,  b:.02},
 {id:"a24",n:"Privateer",      d:"Win 25 raids",                  k:s=>(s.wins||0)>=25, b:.05},
 {id:"a25",n:"Admiralty",      d:"Field 50 warships",             k:s=>allFleetShips(s)>=50, b:.05},
 {id:"a26",n:"Untouchable",    d:"Win a raid at 100% hull",       k:s=>!!s.flawless,    b:.06},
 {id:"a27",n:"Steady Output",  d:"Reach 1,000 ore per second",     k:s=>rate()>=1000, b:.05},
 {id:"a28",n:"Full Line",     d:"Own one of every structure",     k:s=>GENS.every((g,gi)=>gCount(gi)>=1), b:.06},
 {id:"a29",n:"Mass Production",d:"Own 100 of a single structure", k:s=>GENS.some((g,gi)=>gCount(gi)>=100), b:.06},
 {id:"a30",n:"Wrecker",       d:"Strip 500 salvage",              k:s=>(s.svAll||0)>=500, b:.04},
 {id:"a31",n:"Shipwright",    d:"Reach refit level 5 on anything", k:s=>REFIT.some(r=>(s.rf&&s.rf[r.id]||0)>=5), b:.05},
 {id:"a32",n:"Press-Ganged",  d:"Sign 8 crew",                    k:s=>(s.crew||[]).length>=8, b:.05},
 {id:"a33",n:"Legend Aboard", d:"Field a Legendary crew member",   k:s=>(s.crew||[]).some(c=>c.r===3), b:.07},
 {id:"a34",n:"Unbroken Chain",d:"Land a 25-hit chain",             k:s=>(s.bestCmb||0)>=25, b:.06},
 {id:"a35",n:"Kingslayer",    d:"Destroy an enemy Flagship",       k:s=>(s.flags||0)>=1, b:.08},
 {id:"a22",n:"Contractor",        d:"Claim 10 missions",            k:s=>((s.mi||0)-((s.miq&&s.miq.length)||0))>=10, b:.04},
 {id:"a36",n:"First Sale",        d:"Sell anything on the Market",  k:s=>!!(s.mkt&&s.mkt.sold), b:.02}
];

/* ---------------- fleet & raids ---------------- */
/* ---------------- fleet capacity ----------------
   RAIDLV IS the Raids entry in UNLOCK (read, not copied - PLAN-pacing moved Raids
   to lv 9 and the old literal 12 was left behind, giving three levels of an open
   Raids tab with zero fleet cap); below it there is no fleet and the cap reads 0
   rather than a negative number. */
const RAIDLV=unlockLv("p-raid"), FCAP0=20, FCAPK=8, CP_PER=24;
/* ---------------- the par curve ----------------
   What a player at this level fields if they just fill capacity with the best hull that
   fits - no refits, no crew, no programmes. Enemies are sized off THIS, never off the
   player's actual fleet, so everything you buy is a genuine advantage instead of an
   arms race against yourself. Numbers measured with dpar.js. */
function parFleet(){
  /* base capacity only - the `core` programme is investment, so it should beat par.
     Floored at RAIDLV: below that par collapses to nothing and enemies come out with
     ~20 hp between them. */
  let left = FCAP0+FCAPK*Math.max(0, level()-RAIDLV);
  let dps=0, hp=0;
  for(let i=SHIPS.length-1;i>=0;i--){
    const n=Math.floor(left/SHIPS[i].pw); if(n<=0)continue;
    left-=n*SHIPS[i].pw; dps+=n*SHIPS[i].dps; hp+=n*SHIPS[i].hp;
  }
  return {dps:Math.max(1,dps), hp:Math.max(1,hp)};
}
function parDPS(){ return parFleet().dps }
function parHP(){  return parFleet().hp }
/* Enemies are sized between par and what you actually field. Pure par is a cliff - a
   player at a quarter of par loses every fight including the tutorial one - and pure
   self-scaling means nothing you buy matters. The exponent picks how much of the gap
   carries: at 0.35, falling to 25% of par makes enemies 61% as strong, while doubling
   par makes them only 27% tougher. */
const PAR_BLEND=0.35;
/* Early-game ramp: at 0 raid wins the blend exponent is 0.80 (enemies close to your
   own actual strength - par barely pulls at all), falling straight-line to 0.35
   (today's always-on number) by 20 wins. A thin first fleet no longer faces a
   par-sized enemy 4x its own strength; a veteran past 20 wins sees this unchanged. */
function parBlend(){ const w=S.wins||0; return 0.35+0.45*Math.max(0,1-w/20) }
function blendPar(par, actual){
  if(!(par>0))return Math.max(1,actual||1);
  const r=Math.max(0.05, (actual||0)/par);
  return par*Math.pow(r, parBlend());
}
function refDPS(){ return blendPar(parDPS(), fleetDPS()) }
function refHP(){  return blendPar(parHP(),  fleetHPMax()) }
/* How a fight is actually likely to go: how long they last against how long you do.
   Above 1 means you outlive them. Uses the same reference the battle uses, so the
   label cannot drift away from the fight it is describing. */
function fightOdds(t,f){
  f=f||curFleet();
  const dmg=loadoutDPS(t.en);
  if(!(dmg>0))return 0;
  const foeHP=refDPS()*t.secs*t.dif*wepHpMul();
  const ttk=foeHP/dmg;
  const inc=refHP()*t.dmg/t.secs*WEP_INC*(1-fleetEvade(f)*0.85);
  const mine=fleetHPMax(f)*Math.max(0.05,f.hp||0);
  const ttd=inc>0 ? mine/inc : 1e9;
  /* the wave clock is part of the risk: a fight a real player (about 70% of ideal
     fire) cannot finish before reinforcements is not LOW whatever the hull maths says */
  const wf=Math.min(1, waveTFor(t)*0.85/(ttk/0.7));
  return (ttd/Math.max(0.001,ttk))*wf;
}
function riskOf(t,f){
  const o=fightOdds(t,f);
  /* a neutral -> rose ramp: gold means reward and orange is the ore kind, so neither
     may say "risk". The word always carries the level; the colour only backs it up. */
  if(o>=2.2)return ["LOW","var(--mut)"];
  if(o>=1.45)return ["MODERATE","#ffb3c2"];
  if(o>=1.05)return ["HIGH","var(--rd)"];
  return ["SEVERE","var(--rd)"];
}
/* STAGE 1 auto-resolve (2026-09-05). AUTO_MULT TUNING-PENDING - "the fight is not
   really a fight" starts here. AUTO_YIELD/AUTO_FHP_COST are the "small time cost":
   an auto-resolved win pays slightly less than playing it out perfectly would, and
   nicks fleet integrity a little rather than nothing at all - the fleet did fight,
   nobody just watched a number change. */
const AUTO_MULT=3, AUTO_YIELD=0.92, AUTO_FHP_COST=0.03;
/* run 2 (decision 3): a raid target (t.sys set) needs a fleet actually AT that
   system - fleetAtSys(t.sys), not "whichever fleet the Raids pane happens to be
   showing". Anything without a t.sys (the assault target's own t.sysId, or the
   final battle's t.final - see engageTarget()'s own comment) is unaffected and
   keeps defaulting to curFleet(), exactly as run 1 left it. */
function canAutoResolve(t,f){
  f=f||curFleet();
  return !!t && !!f && fleetDPS(f)>0 && f.hp>=0.15 && fightOdds(t,f)>=AUTO_MULT;
}
/* engageTarget() does all the real setup (spawn, mode, DOM); this just fast-forwards
   the result before the first frame draws, and tags BT.auto so endBattle() knows to
   apply the small time-cost above instead of a full manual-win payout. */
function autoResolveTarget(t, idx, f){
  f=f||curFleet();
  if(!f)return false;
  if(!canAutoResolve(t,f))return false;
  engageTarget(t, idx, f);
  if(!BT)return false;
  BT.auto=1;
  /* patch633: the old instant kill (kill everyone, endBattle("win") the same frame) is
     replaced by a ~2.5s scripted clip - see bUpdateCine(), next to bUpdate() - so the
     player sees their own fitted weapons and the real hostiles trade shots, not a
     single frame of the battle screen with the result card already stamped over it. */
  BT.cine={t:0};
  $("#battle").classList.add("cine");
  return true;
}
function autoEngage(idx){ const t=S.tg[idx]; return t?autoResolveTarget(t, idx):false }
/* ---------------- weapons ----------------
   mul is a multiplier on fleetDPS, delivered once per `chg` seconds. `shots` fires that
   many bolts, `all` hits every hostile, `pierce` ignores screens, acc<1 can miss. */
const WEAPONS=[
 {id:"pulse", n:"Pulse Laser",     mul:0.90, chg:2.2, acc:0.92, crit:0.10, cost:0,   start:1, fx:"bolt",
  t:"Standard issue. Charges fast, hits light, never lets you down."},
 {id:"rocket",n:"Rocket Pod",      mul:2.60, chg:5.0, acc:1.00, crit:0.18, cost:0, start:1, ammo:1, fx:"shell",
  t:"Hits like nothing else you own and never misses \u2014 but every shot spends a rocket."},
 {id:"burst", n:"Burst Laser",     mul:0.55, chg:3.0, shots:3, acc:0.85, crit:0.12, cost:15, fx:"bolt",
  t:"Three bolts a cycle. Accuracy suffers for the volume."},
 {id:"heavy", n:"Heavy Cannon",    mul:3.20, chg:6.5, acc:0.80, crit:0.22, cost:90, fx:"shell",
  t:"Slow and brutal. When it connects, something stops existing."},
 {id:"ion",   n:"Ion Lance",       mul:1.40, chg:4.0, acc:1.00, crit:0.05, pierce:1, cost:170, fx:"beam",
  t:"Cuts straight through a screen. Never misses, never crits."},
 {id:"mis",   n:"Seeker Missile",  mul:2.40, chg:5.5, acc:1.00, crit:0.15, cost:280, fx:"shell",
  t:"Tracks its target. Slow to load, but it always finds the hull."},
 {id:"flak",  n:"Flak Battery",    mul:0.80, chg:4.5, all:1, acc:0.75, crit:0.08, cost:420, fx:"spray",
  t:"Sprays the whole formation at once. Wasteful, and worth it."}
];
const WEPMAP=(()=>{ const m={}; for(const w of WEAPONS)m[w.id]=w; return m })();
const SHIPS=[
 {n:"Interceptor", b:400,   g:1.16, pw:4,  dps:5,   hp:16,  ev:0.34, col:"#48e2ff",
  d:"Cheap, fast, flimsy. Numbers do the work.",
  ic:`<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M24 5l9 22-9 7-9-7z" fill="currentColor" fill-opacity=".18"/><path d="M15 27L6 38l9-3M33 27l9 11-9-3"/></g>`},
 {n:"Frigate",     b:9000,  g:1.17, pw:16, dps:38,  hp:120, ev:0.13, col:"#a878ff",
  d:"Line ship. Trades speed for guns and plating.",
  ic:`<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M24 4l7 12v20l-7 8-7-8V16z" fill="currentColor" fill-opacity=".18"/><path d="M17 18H8v12h9M31 18h9v12h-9M24 40v4"/></g>`},
 {n:"Dreadnought", b:2.4e5, g:1.18, pw:64, dps:290, hp:1000, ev:0.03, col:"#ffd166",
  d:"A moving fortress. Draws power like a small city.",
  ic:`<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M24 3l10 9v24l-10 9-10-9V12z" fill="currentColor" fill-opacity=".2"/><path d="M14 15L5 20v10l9 5M34 15l9 5v10l-9 5M24 14v20"/></g>`}
];
const RAIDS=[
 {k:"convoy",  col:"#48e2ff", dif:1.0, secs:20, dmg:.40, en:[2,3], rw:"ore",
  names:["Ore Convoy","Bulk Freighter","Slag Tender","Supply Train"]},
 {k:"hauler",  col:"#a878ff", dif:1.4, secs:26, dmg:.58, en:[2,3], rw:"cry",
  names:["Crystal Hauler","Prism Barge","Lattice Runner"]},
 {k:"patrol",  col:"#ff8fd0", dif:1.9, secs:30, dmg:.74, en:[3,4], rw:"both",
  names:["Pirate Patrol","Corsair Wing","Raider Screen","Blackline Escort"]},
 {k:"anomaly", col:"#ffd166", dif:3.0, secs:40, dmg:.92, en:[3,4], rw:"dm",
  names:["Void Anomaly","Derelict Titan","Silent Leviathan"]},
 {k:"flag",    col:"#ff5f6d", dif:4.6, secs:52, dmg:1.05, en:[1,1], rw:"all", boss:1,
  names:["Enemy Flagship","Dreadline Command","The Iron Verdict","Warlord's Barge"]}
];
const RAIDW=[40,25,22,9,4];
/* enemy archetypes. hp/dps are shares of the encounter budget, not absolutes, so a
   nastier mix never silently changes how hard a raid hits overall. */
const EK={
 grunt: {n:"Runner",   hp:1,    dps:1,    r:1.00, sp:1.0, ev:0.10, acc:0.80},
 shield:{n:"Bulwark",  hp:1.15, dps:0.90, r:1.06, sp:0.7, sh:0.55, ev:0.04, acc:0.86},
 swift: {n:"Lancer",   hp:0.50, dps:1.55, r:0.76, sp:2.3, ev:0.34, acc:0.92},
 bomber:{n:"Charger",  hp:0.80, dps:0.25, r:1.00, sp:0.9, fuse:7.0, blast:0.15, ev:0.14, acc:0.70},
 split: {n:"Hydra",    hp:1.10, dps:0.85, r:1.05, sp:0.9, split:2, ev:0.10, acc:0.78},
 heal:  {n:"Mender",   hp:0.90, dps:0.45, r:0.94, sp:0.8, heal:0.055, ev:0.08, acc:0.74},
 boss:  {n:"Flagship", hp:1,    dps:1,    r:2.30, sp:0.42, sh:0.42, boss:1, regen:9, ev:0, acc:0.95},
 /* STAGE 1 archetype signature units (2026-09-05). Not raid-mix fodder - only
    drawn via ARCH[].mix for a garrison assigned that archetype. */
 /* Fortress: a Bulwark's shield share and a Mender's heal share, both weighted
    much harder, on one hull - outheals slow grinding, rewards burst or repair-first. */
 warden: {n:"Warden",  hp:1.35, dps:0.55, r:1.10, sp:0.60, sh:0.85, heal:0.09, ev:0.05, acc:0.80},
 /* Ghost: sits right at the sysListFor(k) ev>=0.3 threshold so its engines are a
    real system (evadeOf below), then evEng is the big swing - hard to hit until
    the engines go down, not just somewhat harder. */
 phantom:{n:"Phantom", hp:0.65, dps:0.95, r:0.85, sp:1.60, ev:0.30, evEng:0.42, acc:0.85},
 /* Lance: the Charger's own fuse/ring mechanic (FUSE_S/WEP_BLAST), made the
    archetype's signature via the fuseS/rawBlast overrides those systems read when
    set (bomber leaves both unset, so its own tuning is untouched). blast is the
    existing per-kind field turn/live mode already read for a fuse hit. */
 impaler:{n:"Impaler", hp:1.00, dps:0.30, r:1.15, sp:0.75, fuse:18, fuseS:18,
   blast:0.30, rawBlast:0.24, ev:0.12, acc:0.75}
};
/* ---------------- turn-based combat ----------------
   TROUND is the yardstick: spend most of your points on guns every round and a fight
   lasts about this many rounds. Volley damage is derived from it rather than fixed,
   so a convoy and a flagship both pace the same way. */
/* NB: the player-facing word is SHIELDS. The `scr` / SCR_* naming here predates that
   and is left alone so the tests and this file's own notes stay valid. */
const TROUND=8, SCR_CUT=0.28, SCR_MAX=0.85, REP_PIP=0.07;
/* Take INCK hulls of damage across TROUND rounds if you never defend. Above 1 this
   is fatal, which is the point: guns alone must not be a winning line. */
const INCK=1.6;
/* incoming lands within this fraction either side of the forecast, so the HUD number
   is an estimate rather than a promise */
const INC_VAR=0.15;
/* rounds between a Charger's breach shots, and what it re-arms to after firing */
const FUSE_N=3;
/* weapon mode: how often a hostile shoots, and how long a fight is allowed to run */
const EFIRE=2.6, WEP_CAP=125;
/* STAGE 1 escalation clock (2026-09-05): a fight that runs long draws rival
   reinforcements, with a lighter pressure tick before they arrive. Both are timed
   off BT.el, wep mode only (bUpdateWep) - the audit found no per-fight timer/wave
   existed before this; S.thq/rival pressure is a separate, hours-timescale system
   one layer up and is untouched here.
   RECONCILING WITH WEP_CAP: the plan's own default (a flat T+90s wave) sits only
   5s before WEP_CAP=95's hard timeout - the wave would barely matter. Fixing this
   by scaling the wave threshold OFF WEP_CAP (a fraction of it) rather than
   extending WEP_CAP itself: every other fight's pacing is already tuned against
   WEP_CAP=95, so leaving it alone and only picking a sane fraction for the wave is
   the smaller, safer change. WAVE_FRAC=0.55 -> wave at ~52s, leaving ~43s (45% of
   the fight) before the hard timeout - a real window to deal with it, not 5s. */
const WAVE_FRAC=0.55, WAVE_T=52;
/* ECON/COMBAT (2026-09-09): the wave clock scales with the raid. A convoy (20s) keeps
   the 52s wave; a patrol (30s, 3-4 hostiles) gets 78s; anomalies cap at 90s. A
   realistic player (0.7s reactions, aiming systems) was finishing convoys in 20-38s
   but patrols in 50-90s against a flat 52s wave - and the risk label still said LOW. */
function waveTFor(t){ return Math.min(WEP_CAP-35, Math.round(WAVE_T*(t&&t.secs?t.secs/20:1))) }
/* reinforcement strength: WAVE_ADD new hostiles, each sized off the ORIGINAL
   spawn's average per-enemy HP/DPS share (BT.spawnAvgHP/DPS, set in engageTarget)
   scaled down by *_MULT - reinforcements read as real but not a second full fight
   stacked on the first. All four TUNING-PENDING. */
const WAVE_ADD=2, WAVE_HP_MULT=0.65, WAVE_DPS_MULT=0.65;
/* pressure tick: a small direct hit to hull (the cheaper of the two options this
   stage sketched - "station fire" vs a hull-stress repair debuff - a flat hit reuses
   the existing raw-hit/BT.hp plumbing directly, a repair debuff would need a new
   temporary-modifier concept threaded through REP_HULL). Two ticks land before the
   default wave (20s, 40s vs a 52s wave). TUNING-PENDING. */
const PRESSURE_IV=20, PRESSURE_DMG=0.035;
/* ---------------- power ----------------
   Four systems share one budget, moved mid-fight. Small enough early that you cannot
   run guns and shields at once, which is the choice the whole model hangs on. */
/* WEAPONS is deliberately NOT here: each gun is armed on its own button, so you can
   choose which one comes back. Armed guns still draw from the same budget. */
const PWR_SYS=[
 {id:"shd", n:"SHIELDS", col:"#48e2ff", t:"Each point is a layer that blocks one shot outright."},
 {id:"eng", n:"ENGINES", col:"#5ce6a5", t:"Each point makes more of their shots miss."},
 {id:"rep", n:"REPAIR",  col:"#ff8fd0", t:"Mends the hull, and brings downed guns back."}
];
const PWR_MAX=12, ENG_EV=0.07, SHD_T=4.2, REP_HULL=0.006;
function powerTotal(){ return Math.min(PWR_MAX, 3+Math.floor(fleetCap()/30)) }
function pwrOf(id){ return (S.pwr&&S.pwr[id])||0 }
function armedCount(){ let c=0;
  const sl=wepSlots();
  for(let i=0;i<sl.length;i++) if(sl[i]&&S.wpow&&S.wpow[i])c++;
  return c }
function pwrUsed(){ let v=armedCount(); for(const p of PWR_SYS)v+=pwrOf(p.id); return v }
function pwrFree(){ return Math.max(0, powerTotal()-pwrUsed()) }
function setPower(id,v){
  if(!S.pwr||typeof S.pwr!=="object")S.pwr={wep:0,shd:0,eng:0,rep:0};
  v=Math.max(0,Math.floor(v));
  const others=pwrUsed()-pwrOf(id);
  S.pwr[id]=Math.min(v, Math.max(0, powerTotal()-others));
  if(BT&&BT.mode==="wep")BT.shdMax=pwrOf("shd");
  dirty=true; return true;
}
function addPower(id,d){ return setPower(id, pwrOf(id)+d) }
/* a gun is online because you armed it, not because of where it sits in the rack */
function wepOnline(i){ return !!(S.wpow&&S.wpow[i]) }
function armWeapon(i,on){
  const sl=wepSlots();
  if(!sl[i])return false;
  if(!Array.isArray(S.wpow))S.wpow=[];
  if(on===undefined)on=!S.wpow[i];
  if(on&&pwrFree()<1&&!S.wpow[i])return false;    /* no spare power to arm it */
  S.wpow[i]=!!on;
  blip(on?600:340,.07,"sine",.04); dirty=true; return true;
}
/* a Charger is a clock you can see and choose to stop, so it has to be long enough to
   actually react to. FUSE_S is the whole cycle, not a cooldown between shots. */
const FUSE_S=11, WEP_BLAST=0.11;
/* a system breaks after this share of the hostile's hull is put into it, and breaking
   one costs them a little hull as well so system fire is never wasted */
const SYS_HP=0.11, SYS_BLEED=0.07, SYS_REP=13;
/* wep-only scaling. Turn mode keeps the numbers it was tuned with. */
const WEP_HP=0.50, WEP_INC=1.25;
/* early-raid ramp on enemy HP (parallel to patch544's parBlend()): a first fight at
   0 wins sees ~45% less enemy HP than the always-on WEP_HP number, climbing straight-
   line back to exactly WEP_HP by 15 wins - a veteran past that sees today's fights,
   unchanged. */
function wepHpMul(){ const w=S.wins||0; return WEP_HP*(0.55+0.45*Math.min(1,w/15)) }
/* what an enemy will do next round. Named so the board can be read at a glance. */
const TEL={
 strike: {n:"STRIKE",     col:"#ff6b8a"},
 volley: {n:"VOLLEY \u00d73", col:"#ff5f6d"},
 screen: {n:"SHIELDS UP", col:"#48e2ff"},
 charge: {n:"CHARGING",   col:"#ffd166"},
 boom:   {n:"BREACH",     col:"#ff9a6b"},
 mend:   {n:"REPAIRS",    col:"#5ce6a5"}
};
/* per-raid archetype weights */
/* every tier carries a Charger: it is the only telegraph SHIELDS cannot answer, and a
   fight without one has no question in it. Menders from tier 1 add the other kind of
   pressure - damage that undoes itself if you ignore the source. */
const EMIX=[
 {grunt:58, shield:18, swift:10, bomber:14},
 {grunt:36, shield:20, swift:16, bomber:16, split:6, heal:6},
 {grunt:24, shield:18, swift:20, bomber:20, split:6, heal:12},
 {grunt:16, shield:22, swift:14, bomber:24, split:10, heal:14},
 {boss:100}
];
function pickKindFrom(w){
  let tot=0; for(const k in w)tot+=w[k];
  let r=Math.random()*tot;
  for(const k in w){ if(r<w[k])return k; r-=w[k] }
  return "grunt";
}
function pickKind(ti){ return pickKindFrom(EMIX[ti]||EMIX[0]) }
/* STAGE 1 part 1B garrison archetypes. "swarm" has no mix of its own - it falls
   through to the tier's ordinary EMIX (mixFor() below), which is deliberately
   the existing rounded build for contrast against the other three. */
const ARCH={
 swarm:   {n:"Swarm",    tag:"Numbers, not tricks"},
 fortress:{n:"Fortress", tag:"Heavy shields and repair - burn it down fast or grind forever",
   mix:{grunt:14, shield:34, heal:26, warden:26} },
 ghost:   {n:"Ghost",    tag:"Evasive until their engines drop",
   mix:{grunt:18, swift:22, phantom:38, heal:12, bomber:10} },
 lance:   {n:"Lance",    tag:"One huge shot on a long, visible fuse",
   mix:{grunt:22, shield:18, impaler:32, swift:18, heal:10} },
 /* patch590, final battle only: no static mix - mixFor() below special-cases this
    id and asks mirrorMix() for one built from the player's OWN current loadout
    instead, since the whole point is "your own fleet, mirrored". */
 mirror:  {n:"Mirror",   tag:"Weighted from your own loadout, turned against you"}
};
/* the mix a fight actually draws from: a garrison's assigned archetype overrides
   the tier mix; anything without one (raids, un-garrisoned assaults) is untouched. */
function mixFor(t){
  if(t.arch==="mirror")return mirrorMix();          /* patch590 - see mirrorMix() below */
  return (t.arch && ARCH[t.arch] && ARCH[t.arch].mix) || null;
}
/* patch590: the final battle's enemy mix is built from the player's OWN loadout at
   engage time, not a fixed table - "weighted from your own loadout, turned against
   you" (plan wording). No clean 1:1 mapping exists between 3 ship classes / 7
   weapons and 9 EK kinds (the plan's own documented fallback for exactly this case:
   "weight toward the kinds that counter the player's strongest weapon, and say so"
   - done below), so this is a deliberately loose, DOCUMENTED mapping:
     - ship composition sets the base feel: interceptor-heavy leans the mix toward
       numbers and speed (swift/grunt), dreadnought-heavy toward armour and screens
       (warden/shield), frigate-heavy splits the difference (grunt/shield) - roughly
       "a fleet built like yours"
     - the player's single strongest equipped weapon (by mul/chg - damage per second
       of charge, the same ratio that actually drives fleetDPS) then nudges the mix
       toward whatever answers it best:
         pierce (Ion Lance) ignores shields entirely -> countered by evasion, not
           armour: phantom/swift weighted up
         a slow, huge single hit (Heavy Cannon/Seeker Missile/Rocket Pod) rewards a
           target that shrugs off one big hit -> shield/warden/heal weighted up
         a hits-everyone weapon (Flak Battery) punishes standing in a cluster ->
           impaler (a fused, telegraphed threat that rewards spreading out, not
           screens) weighted up
         fast/cheap weapons (Pulse Laser/Burst Laser), or no weapon equipped at all,
           reward attrition over any single counter -> grunt/split weighted up
   Every kind keeps a floor weight so the mix never collapses to one kind, and
   engageTarget()'s own "at least one fused hostile" floor (bomber, unconditional)
   still applies on top of this exactly as it does for every other archetype. */
function mirrorWeaponFocus(){
  const eq=equipped().filter(Boolean);
  if(!eq.length)return null;
  let best=eq[0];
  for(const w of eq) if((w.mul/w.chg)>(best.mul/best.chg)) best=w;
  return best.id;
}
function mirrorMix(){
  const sh=[shipTotal(0),shipTotal(1),shipTotal(2)], tot=Math.max(1,sh[0]+sh[1]+sh[2]);
  const fInt=(sh[0]||0)/tot, fFrig=(sh[1]||0)/tot, fDread=(sh[2]||0)/tot;
  const w={grunt:10, shield:10, swift:8, bomber:8, split:6, heal:6, warden:6, phantom:6, impaler:8};
  w.swift+=fInt*30; w.grunt+=fInt*15;
  w.grunt+=fFrig*15; w.shield+=fFrig*20;
  w.warden+=fDread*30; w.shield+=fDread*15;
  const focus=mirrorWeaponFocus();
  if(focus==="ion"){ w.phantom+=30; w.swift+=15 }
  else if(focus==="heavy"||focus==="mis"||focus==="rocket"){ w.shield+=20; w.warden+=15; w.heal+=15 }
  else if(focus==="flak"){ w.impaler+=30; w.split+=10 }
  else { w.grunt+=20; w.split+=10 }   /* pulse/burst, or no weapon equipped yet */
  return w;
}
/* ---------------- refits: permanent, bought with salvage ---------------- */
const REFIT=[
 {id:"gun", n:"Gun Refit",          c:12, cg:1.60, max:15, col:"#ffd166",
  d:lv=>"\u00d7"+fmt(Math.pow(1.25,lv))+" fleet damage", t:"Heavier throw weight across every hull you field."},
 {id:"arm", n:"Armour Plating",     c:12, cg:1.60, max:15, col:"#5ce6a5",
  d:lv=>"\u00d7"+fmt(Math.pow(1.25,lv))+" fleet hull", t:"Ablative layers. You come home with more of the fleet."},
 {id:"tap", n:"Targeting Rig",      c:16, cg:1.70, max:12, col:"#ff8fd0",
  d:lv=>"\u00d7"+fmt(Math.pow(1.20,lv))+" manual fire", t:"Your own volleys land harder."},
 {id:"rep", n:"Repair Bay",         c:14, cg:1.65, max:10, col:"#48e2ff",
  d:lv=>"Repairs \u00d7"+fmt(Math.pow(1.30,lv))+" faster", t:"Less waiting between raids."},
 {id:"sen", n:"Deep Sensors",       c:20, cg:1.75, max:8,  col:"#a878ff",
  d:lv=>"Contacts "+Math.round((1-1/Math.pow(1.22,lv))*100)+"% sooner", t:"Finds targets further out, so they arrive faster."},
 {id:"crt", n:"Weak-Point Scanner", c:24, cg:1.80, max:8,  col:"#ff5f6d",
  d:lv=>"Weak point "+Math.round(lv*14)+"% wider", t:"Marks the seam in a hull. Critical hits get easier to land."}
];
function rfl(id){ return (S.rf&&S.rf[id])||0 }
function refitCost(r){ return Math.ceil(r.c*Math.pow(r.cg,rfl(r.id))) }
function buyRefit(r){
  const l=rfl(r.id); if(l>=r.max)return false;
  const c=refitCost(r); if(S.sv<c)return false;
  S.sv-=c; S.rf[r.id]=l+1; blip(520,.18,"square",.05);
  toast(r.n+" \u2192 level "+(l+1),"y"); dirty=true; renderRaids(); return true;
}

/* ---------------- crew ---------------- */
const ROLES=[
 {id:"cap", n:"Captain",       col:"#ffd166", t:"Commands the line. Every gun on every hull fires harder.",
  d:m=>"\u00d7"+m.toFixed(2)+" fleet damage"},
 {id:"gun", n:"Gunner",        col:"#ff8fd0", t:"Lays the reticle personally. Your manual volleys bite.",
  d:m=>"\u00d7"+m.toFixed(2)+" manual fire"},
 {id:"eng", n:"Engineer",      col:"#5ce6a5", t:"Keeps plating on the frames and shortens the walk home.",
  d:m=>"\u00d7"+m.toFixed(2)+" hull & repair"},
 {id:"nav", n:"Navigator",     col:"#48e2ff", t:"Reads the lanes. Contacts turn up sooner.",
  d:m=>"\u00d7"+m.toFixed(2)+" contact rate"},
 {id:"qm",  n:"Quartermaster", col:"#a9bcd4", t:"Nothing leaves a wreck that could have been carried.",
  d:m=>"\u00d7"+m.toFixed(2)+" salvage & spoils"}
];
const RAR=[
 {n:"Deckhand",  m:1.10, col:"#8390bd", w:50, v:16},
 {n:"Veteran",   m:1.30, col:"#5ce6a5", w:31, v:44},
 {n:"Elite",     m:1.60, col:"#48e2ff", w:15, v:130},
 {n:"Legendary", m:2.15, col:"#ffd166", w:4,  v:480}
];
const CFIRST=["Vela","Idris","Konrad","Mira","Soren","Ash","Perrin","Yuki","Odell","Rhea","Tam","Bex",
 "Cyrus","Nadia","Wren","Halden","Juno","Kestrel","Marlow","Sable","Toma","Isolde","Garrick","Nyx"];
const CLAST=["Voss","Achebe","Karrik","Lindqvist","Oyelaran","Strand","Bhatt","Renner","Oduya","Falk",
 "Mercado","Ivanova","Tenzin","Duquesne","Okonkwo","Sarraf","Vance","Holt","Mbeki","Reyes","Kaur","Ng"];
function crewRand(){ S.cseed=(S.cseed*1103515245+12345)&0x7fffffff; return S.cseed/0x7fffffff }
function rollCrew(){
  const role=ROLES[Math.floor(crewRand()*ROLES.length)];
  let tot=0; for(const r of RAR)tot+=r.w;
  let x=crewRand()*tot, ri=0;
  for(let i=0;i<RAR.length;i++){ if(x<RAR[i].w){ri=i;break} x-=RAR[i].w }
  return { id:"c"+Date.now().toString(36)+Math.floor(crewRand()*1e6).toString(36),
    role:role.id, r:ri,
    n:CFIRST[Math.floor(crewRand()*CFIRST.length)]+" "+CLAST[Math.floor(crewRand()*CLAST.length)] };
}
function bridgeSlots(){ return 1+(S.wins>=40?1:0)+(S.wins>=150?1:0) }
function crewUnlocked(){ return (S.wins||0)>=5 }
function hireCost(){ return Math.ceil(20*Math.pow(1.34,(S.crew||[]).length)) }
function dismissValue(c){ return Math.max(5,Math.round(RAR[c.r].v*0.45)) }
function onBridge(){ return (S.bridge||[]).slice(0,bridgeSlots())
  .map(id=>(S.crew||[]).find(c=>c.id===id)).filter(Boolean) }
function crewMul(role){
  /* Deckhands (c.deck) are placeholders with no bonus - skipped entirely rather than
     multiplied by RAR[0].m, so a bridge of nothing but Deckhands always yields x1.00. */
  let m=1; for(const c of onBridge()) if(c.role===role && !c.deck) m*=RAR[c.r].m;
  if(role==="gun") m*=Math.pow(1.20,rfl("tap"));
  return m;
}
/* three placeholder crew, one per possible bridge berth (roles in slot order) - see
   the patch562 header. r:0 is RAR's "Deckhand" rarity, used only for label/colour;
   the deck:1 flag is what actually makes them inert (crewMul above, dismiss guard
   below, no SELL button in renderRaids). Deterministic ids so re-seeding never
   duplicates or drifts. */
function makeDeckhands(){
  return ROLES.slice(0,3).map(r=>({ id:"dk_"+r.id, n:"Deckhand", role:r.id, r:0, deck:1 }));
}
function ensureCrewPool(){
  if(!Array.isArray(S.crewPool))S.crewPool=[];
  while(S.crewPool.length<3) S.crewPool.push(rollCrew());
}
/* half hireCost(), rounded up like every other salvage cost in this file */
function crewRefreshCost(){ return Math.ceil(hireCost()/2); }
function refreshCrewPool(){
  const c=crewRefreshCost(); if(S.sv<c)return false;
  S.sv-=c; S.crewPool=[rollCrew(),rollCrew(),rollCrew()];
  blip(480,.12,"sine",.04); dirty=true; renderRaids(); return true;
}
/* an empty berth first, then a Deckhand-held one, and only as a last resort (a
   bridge already full of real hires) the old fallback of replacing slot 0. */
function assignNewHire(id){
  const slots=bridgeSlots();
  let put=-1;
  for(let i=0;i<slots;i++) if(!S.bridge[i]){ put=i; break }
  if(put<0) for(let i=0;i<slots;i++){
    const c=(S.crew||[]).find(x=>x.id===S.bridge[i]);
    if(c&&c.deck){ put=i; break }
  }
  if(put<0)put=0;
  S.bridge[put]=id;
}
/* hires a specific rolled candidate from S.crewPool (the visible-candidates feature) -
   hireCrew() below is left untouched and still rolls+adds a fresh member directly; it
   is part of the tested programmatic surface (txp2.js) as well as still being callable
   on its own terms. */
function hireCandidate(id){
  const c=hireCost(); if(S.sv<c)return false;
  const idx=(S.crewPool||[]).findIndex(x=>x.id===id); if(idx<0)return false;
  S.sv-=c; const m=S.crewPool[idx];
  S.crewPool.splice(idx,1); ensureCrewPool();
  S.crew.push(m);
  grantXp("cr1", XPV.crew1, "First crew signed"); xpCrewFull();
  assignNewHire(m.id);
  blip(700,.2,"sine",.05);
  toast("Signed on: "+m.n+" \u2014 "+RAR[m.r].n+" "+ROLES.find(r=>r.id===m.role).n,"g");
  dirty=true; renderRaids(); return true;
}
function hireCrew(){
  const c=hireCost(); if(S.sv<c)return false;
  S.sv-=c; const m=rollCrew(); S.crew.push(m);
  grantXp("cr1", XPV.crew1, "First crew signed"); xpCrewFull();
  const slots=bridgeSlots();
  for(let i=0;i<slots;i++) if(!S.bridge[i]){ S.bridge[i]=m.id; break }
  blip(700,.2,"sine",.05);
  toast("Signed on: "+m.n+" \u2014 "+RAR[m.r].n+" "+ROLES.find(r=>r.id===m.role).n,"g");
  dirty=true; renderRaids(); return true;
}
function dismissCrew(id){
  const i=(S.crew||[]).findIndex(c=>c.id===id); if(i<0)return;
  const c=S.crew[i]; if(c.deck)return;                 /* Deckhands are not dismissable */
  S.sv+=dismissValue(c);
  S.crew.splice(i,1);
  S.bridge=S.bridge.map(b=>b===id?null:b);
  blip(220,.14,"square",.04); toast("Paid off "+c.n+" \u2014 +"+dismissValue(c)+" salvage");
  dirty=true; renderRaids();
}
function assignCrew(id){
  const slots=bridgeSlots();
  if(S.bridge.indexOf(id)>=0){ S.bridge=S.bridge.map(b=>b===id?null:b) }
  else { let put=-1;
    for(let i=0;i<slots;i++) if(!S.bridge[i]){ put=i; break }
    if(put<0)put=0;                     /* all full: replace the first */
    S.bridge[put]=id; }
  xpCrewFull();
  blip(480,.1,"sine",.04); dirty=true; renderRaids();
}
function xpCrewFull(){ if(bridgeSlots()>=3&&onBridge().filter(c=>!c.deck).length>=3) grantXp("crf", XPV.crewFull, "Full bridge") }
/* STAGE 1 economy decoupling (2026-09-05), constants for all three leaks - see the
   patch456 header comment for what each one is and why this number. */
const CASC_EXP=1.10;                        /* was 1.22: ~19.7x at max level -> ~4.2x */
const CORE_ADD_MAX=30;                      /* was uncapped within level: 6/level to +120 max -> capped here */
const SHIP_SOFT=150;                        /* ship-power units before the log curve engages */
/* f(p)=SHIP_SOFT*(1+ln(p/SHIP_SOFT)) for p>SHIP_SOFT, i.e. the multiplier applied to
   the raw linear ship-stat sum is f(p)/p - continuous (mul=1) at p=SHIP_SOFT, then
   falls away fast enough that even an astronomically-larger ship-power number (from
   ore, or from level pushing fleetCap up over a long playthrough) only buys a slow,
   logarithmic amount of extra combat power instead of a linear one. */
function shipCountMul(){
  const p=shipPower();
  if(!(p>SHIP_SOFT))return 1;
  return (1+Math.log(p/SHIP_SOFT))/(p/SHIP_SOFT);
}
function fleetMult(){ return Math.pow(1.3,nexLv("war"))*achBonus()*(1+0.04*pkl("war"))
  *Math.pow(CASC_EXP,xlv("casc"))*(nexLv("pj2")?PJ2_MUL:1) }
/* ---------------- PLAN-fleets run 1: the fleet model ----------------
   S.fl replaces the old flat S.sh (hulls)/S.fhp (integrity) pair - one fleet, at
   home, plays exactly as before; run 2 gives fleets a place, run 3 a second and
   third one. Cyan/violet/gold - the three ship colours - exported now so run 2's
   map markers/fleet bar can use them without a second patch. */
const FLEET_COL=["#48e2ff","#a878ff","#ffd166"];
const FLEET_NAMES=["1st Fleet","2nd Fleet","3rd Fleet"];
/* run 2's fleet bar shows the slots run 3 unlocks - defined now so run 3 can read it
   without a second patch to this array. Index 0 is Fleet 1's own unlock (reads
   unlockLv("p-raid") rather than a bare literal, so a pacing change to Raids moves
   this with it) - run 2 never actually renders slot 1 locked, since the whole bar
   is hidden below RAIDLV anyway. */
/* PLAN-polish batch B item 4: Fleet 2/3 moved from 14/20 to 16/22 (owner: "should
   come in later"). */
const FLEET_UNLOCK=[unlockLv("p-raid"),16,22];
/* single place every fleet display name is read from, so run 3's level-up modal
   line, the commissioning toast and mkFleet() itself never drift from each other. */
function ordFleet(id){ return FLEET_NAMES[id-1]||("Fleet "+id) }
function mkFleet(id){
  return { id, n:ordFleet(id), sh:[0,0,0], hp:1, at:"home", to:null, eta:0, pos:null, tg:null, hold:null, o:null };
}
/* run 3: how many fleet slots the player's level has opened - Fleet 1 always exists
   (fleets() self-heals to it) regardless of this count; it only gates slots 2/3. */
function fleetSlots(){ return FLEET_UNLOCK.filter(lv=>level()>=lv).length }
/* run 3 (PLAN-fleets decision 1): pushes a fresh Fleet 2/3 the moment the player's
   level opens its slot. Called every tick from checkUnlocks() (same idiom every
   other level-gated unlock in that function uses) and once from adopt() right after
   the fleet array is sanitised, so a save loaded straight at a level past 16/22 (an
   old save from before this run, or one restored from a backup) gets caught up
   immediately rather than waiting for the next tick.
   Normal play only ever crosses one threshold per call (checkUnlocks runs ~11x/s,
   far more often than a level-up), so the single-notice branch is what a live game
   sees; adopt() catching an old save up past BOTH thresholds in the same call is the
   one place two slots can open at once - collapsed into one combined toast instead
   of firing two VEGA cards back to back for something that happened between saves,
   not during this session (decided per BRIEF-fleets-run3.md commit 1). */
function ensureFleets(){
  const added=[];
  while(fleets().length<fleetSlots()){
    const id=fleets().length+1;
    S.fl.push(mkFleet(id));
    added.push(id);
  }
  if(added.length===1){
    queueNotice("vega:fleet"+added[0]);
  } else if(added.length>1){
    if(!S.seen||typeof S.seen!=="object")S.seen={};
    for(const id of added)S.seen["vega:fleet"+id]=true;
    toast(added.map(id=>ordFleet(id).split(" ")[0]).join(" and ")+" Fleet commissioned at Sol Reach","g");
  }
  return added;
}
/* self-healing: a save that somehow lost S.fl (or never had one past adopt()'s own
   sanitiser - defensive only, adopt() should never actually hand this an empty
   array) gets a fresh Fleet 1 rather than the game reading fleet-less forever. */
function fleets(){
  if(!Array.isArray(S.fl)||!S.fl.length)S.fl=[mkFleet(1)];
  return S.fl;
}
function fleet(id){ return fleets().find(f=>f.id===id)||null }
/* the fleet the Raids pane is showing (run 3's tab row picks it) - S.flSel, an id,
   default 1, saved like any other plain state. */
function curFleet(){
  const f=fleet(S.flSel); if(f)return f;
  const f0=fleets()[0]; S.flSel=f0.id; return f0;
}
/* PLAN-raidmap: a fleet is either standing at a system (f.at), holding in open space
   (f.at===null, f.pos), flying to a system (f.to) or flying at a raid contact (f.tg,
   a target id). "Busy" is either kind of flight - every "is this fleet free" check
   goes through here rather than reading f.to alone. */
function fleetBusy(f){ return !!(f&&(f.to||f.tg!=null||f.mv)) }
/* run 2: the first idle (not travelling) fleet sitting at sysId. */
function fleetAtSys(sysId){ return fleets().find(f=>!fleetBusy(f)&&f.at===sysId)||null }
/* run 3: every OTHER idle fleet sitting at f's own system - what TRANSFER needs to
   offer (the fleet card). Empty for a travelling f, for one holding in open space
   (there is no shared system to transfer at), or when f is the only one there. */
function otherIdleFleetsAt(f){
  if(!f||fleetBusy(f)||!f.at)return [];
  return fleets().filter(x=>x.id!==f.id&&!fleetBusy(x)&&x.at===f.at);
}
/* a fleet already en route to sysId, if any - so the system page can show
   "ARRIVING" instead of offering to send a second fleet on top of it. */
function fleetTravelingTo(sysId){ return fleets().find(f=>f.to===sysId)||null }
/* the idle fleet that would take the least time to reach sysId - "nearest" by
   travel time, not map distance. null when every fleet is busy. */
function nearestIdleFleetTo(sysId){
  const s=SYSMAP[sysId]; if(!s)return null;
  const d={sec:s.sec,x:s.sx,y:s.sy,sys:sysId};
  const idle=fleets().filter(f=>!fleetBusy(f));
  if(!idle.length)return null;
  return idle.reduce((best,f)=>
    travelSecsPos(fleetPos(f),d)<travelSecsPos(fleetPos(best),d) ? f : best);
}
/* ---------------- PLAN-fleets run 2: position and travel ----------------
   TUNING-PENDING, all three (PLAN-fleets.md decision 4): same-sector travel is
   TRAVEL_BASE + TRAVEL_PER_UNIT per map unit of on-screen distance (sx/sy, 0-100);
   crossing sectors ignores that distance entirely and charges TRAVEL_PER_RING per
   ring boundary crossed instead - a lane between neighbouring sectors, not a
   straight-line flight. */
const TRAVEL_BASE=20, TRAVEL_PER_UNIT=0.4, TRAVEL_PER_RING=30;
function travelSecs(fromId,toId){
  const A=SYSMAP[fromId], B=SYSMAP[toId];
  if(!A||!B)return Infinity;
  if(A.sec===B.sec)return TRAVEL_BASE+TRAVEL_PER_UNIT*Math.hypot(A.sx-B.sx,A.sy-B.sy);
  return TRAVEL_BASE+TRAVEL_PER_RING*Math.abs(A.ring-B.ring);
}
/* PLAN-raidmap: the same rule between two map positions ({sec,x,y}, plus `sys` when
   the position IS a system). System to system is travelSecs() exactly, so nothing
   about the old lane timings moves; a leg that starts or ends in open space has no
   ring to count, so crossing sectors charges per sector boundary instead. */
function travelSecsPos(a,b){
  if(!a||!b)return Infinity;
  if(a.sys&&b.sys)return travelSecs(a.sys,b.sys);
  if(a.sec===b.sec)return TRAVEL_BASE+TRAVEL_PER_UNIT*Math.hypot(a.x-b.x,a.y-b.y);
  return TRAVEL_BASE+TRAVEL_PER_RING*Math.abs(a.sec-b.sec);
}
function sysPos(id){ const s=SYSMAP[id]; return s?{sec:s.sec,x:s.sx,y:s.sy,sys:id}:null }
/* where a fleet that is NOT flying is standing */
function fleetPos(f){
  if(f.at&&SYSMAP[f.at])return sysPos(f.at);
  if(f.pos)return {sec:f.pos.sec,x:f.pos.x,y:f.pos.y};
  return sysPos("home");
}
function fleetDestPos(f,now){
  if(f.tg!=null){ const t=tgById(f.tg); return t?tgPos(t,now):null }
  if(f.to)return sysPos(f.to);
  if(f.mv)return {sec:f.mv.sec,x:f.mv.x,y:f.mv.y};
  return null;
}
/* where a fleet is on the map right now, flying or not: {sec,x,y,hd}. A flight is a
   straight line from where it set off (f.o) to wherever its destination is NOW - a
   contact keeps drifting, so the line bends toward it and the fleet still arrives
   exactly when the clock says. Crossing sectors: the first half of the clock flies
   out to the sector's edge, the second half flies in from the other side. */
function fleetMapPos(f,now){
  const d=fleetBusy(f)?fleetDestPos(f,now):null;
  if(!d){ const p=fleetPos(f); return {sec:p.sec,x:p.x,y:p.y,hd:null} }
  const o=f.o||fleetPos(f);
  const prog=f.tot>0 ? Math.min(1,Math.max(0,1-f.eta/f.tot)) : 1;
  let ax=o.x, ay=o.y, bx=d.x, by=d.y, q=prog, sec=o.sec;
  if(o.sec!==d.sec){
    const out=d.sec>o.sec;
    if(prog<0.5){ bx=out?104:-4; by=50; q=prog*2 }
    else { ax=out?-4:104; ay=50; q=(prog-0.5)*2; sec=d.sec }
  }
  return {sec, x:ax+(bx-ax)*q, y:ay+(by-ay)*q, hd:Math.atan2(bx-ax,-(by-ay))};
}
/* a fleet that leaves (or is pulled off) a contact it was holding lets it drift again */
function fleetRelease(f){
  if(f.hold==null)return;
  const t=tgById(f.hold);
  if(t){ tgUnfreeze(t); t.auto=0; delete t.fx }
  f.hold=null;
}
/* refuses: already travelling, already there, an unknown system, or mid-fight (a
   battle/defence in progress is not a moment to be reassigning the fleet that is,
   or might be, in it). f.at is left alone while travelling from a system - it is
   still where the fleet departed; fleetAtSys()'s own fleetBusy() guard already
   excludes it from anything that cares "is a fleet actually here right now". */
function fleetSend(f,toId){
  if(!f)return false;
  /* b646: say why, instead of a silent no-op the player reads as "stuck" */
  if(fleetBusy(f)){ toast(f.n+" is already en route","y"); return false }
  if(toId===f.at)return false;
  if(!SYSMAP[toId])return false;
  f.sg=null; f.sga=0; f.mv=null;                         /* a plain SEND drops any attack order */
  if(BT||DT){ toast("Not mid-fight","y"); return false }
  const o=fleetPos(f), eta=travelSecsPos(o,sysPos(toId));
  fleetRelease(f);
  f.o={sec:o.sec,x:o.x,y:o.y,sys:o.sys||null};
  f.to=toId; f.from=f.at; f.eta=eta; f.tot=eta;
  toast(f.n+" departing for "+SYSMAP[toId].n+" · "+Math.round(eta)+"s","y");
  dirty=true; return true;
}
/* PLAN-raidmap: send a fleet at a contact. `auto` is the player's choice in the
   prompt - settle it on arrival without the battle screen (only honoured if the
   fleet still outclasses the contact when it gets there) - otherwise the fleet
   holds beside it and waits for ENGAGE. One fleet per contact. */
function fleetAttack(f,t,auto){
  if(!f||!t)return false;
  if(BT||DT){ toast("Not mid-fight","y"); return false }
  if(fleetBusy(f)){ toast(f.n+" is already en route","y"); return false }
  if(fleetDPS(f)<=0){ toast("Build warships before you engage."); return false }
  if(f.hp<0.15){ toast("Fleet too damaged \u2014 recall it to repair."); return false }
  if(fleets().some(x=>x!==f&&(x.tg===t.id||x.hold===t.id))){ toast("Another fleet is already on it","y"); return false }
  if(f.hold===t.id){ t.auto=auto?1:0; dirty=true; return true }   /* already beside it */
  f.sg=null; f.sga=0; f.mv=null;
  const o=fleetPos(f), eta=travelSecsPos(o,tgPos(t));
  fleetRelease(f);
  f.o={sec:o.sec,x:o.x,y:o.y,sys:o.sys||null};
  f.pos={sec:o.sec,x:o.x,y:o.y};
  f.at=null; f.to=null; f.from=null; f.tg=t.id; f.eta=eta; f.tot=eta;
  t.auto=auto?1:0;
  toast(f.n+" moving to intercept · "+Math.round(eta)+"s","y");
  dirty=true; return true;
}
/* pull a fleet back to Sol Reach from wherever it is - mid-flight included, which
   fleetSend() itself refuses: the flight is cut where the fleet currently is and a
   fresh one home starts from that point. */
function fleetRecall(f){
  if(!f)return false;
  if(BT||DT){ toast("Not mid-fight","y"); return false }
  if(f.to==="home")return false;
  if(!fleetBusy(f)&&f.at==="home")return false;
  if(fleetBusy(f)){
    const p=fleetMapPos(f);
    f.pos={sec:p.sec,x:Math.max(2,Math.min(98,p.x)),y:Math.max(2,Math.min(98,p.y))};
    f.at=null; f.to=null; f.tg=null; f.mv=null; f.from=null; f.eta=0; f.tot=0; f.o=null;
  }
  return fleetSend(f,"home");
}
/* owner: "when a fleet is selected and the player taps on the map, a MOVE button
   appears" - fly to a patch of open space and hold there. Same shape as
   fleetAttack()'s flight, with a fixed point (f.mv) for the destination. */
function fleetMoveTo(f,p){
  if(!f||!p||!SECTORS[p.sec])return false;
  if(BT||DT){ toast("Not mid-fight","y"); return false }
  if(fleetBusy(f)){ toast(f.n+" is already en route","y"); return false }
  const o=fleetPos(f), dest={sec:p.sec,x:Math.max(3,Math.min(97,+p.x)),y:Math.max(3,Math.min(97,+p.y))};
  const eta=travelSecsPos(o,dest);
  fleetRelease(f);
  f.o={sec:o.sec,x:o.x,y:o.y,sys:o.sys||null};
  f.pos={sec:o.sec,x:o.x,y:o.y};
  f.at=null; f.to=null; f.from=null; f.tg=null; f.sg=null; f.sga=0; f.mv=dest; f.eta=eta; f.tot=eta;
  toast(f.n+" moving \u00b7 "+Math.round(eta)+"s","y");
  dirty=true; return true;
}
/* run on the SAME clock thqTick(dt) already runs on (rvTick, called from tick()) -
   never csim's economy path, since csim never sends a fleet anywhere and so never
   has one with `to`/`tg` set to decrement in the first place. `quiet`
   (offlineReport()'s catch-up pass) skips the arrival toast and instead returns
   each arrival's line for the away-report to fold in IF that report is already
   showing something else - a fleet quietly arriving is not, on its own, worth
   waking the player's phone or popping a modal (see offlineReport()'s own comment). */
const TG_FX_SECS=2.4;       /* how long the on-map skirmish of an auto-resolved raid runs */
function fleetTravelTick(dt, quiet){
  const arrived=[], now=Date.now()/1000;
  for(const f of fleets()){
    if(f.hold!=null&&!tgById(f.hold))f.hold=null;      /* fought, or gone with an old save */
    if(f.tg!=null){
      const t=tgById(f.tg);
      if(!t){ f.tg=null; f.eta=0; f.tot=0; f.o=null; dirty=true; continue }
      f.eta-=dt;
      if(f.eta<=0){
        const p=tgPos(t,now);
        t.fz=now;                                        /* it holds still while a fleet is on it */
        f.pos={sec:t.sec,x:Math.max(4,Math.min(96,p.x-6)),y:Math.max(6,Math.min(94,p.y+5))};
        f.tg=null; f.hold=t.id; f.eta=0; f.tot=0; f.o=null;
        if(!(t.auto&&canAutoResolve(t,f))){
          t.auto=0;
          if(!quiet)toast(f.n+" in position \u2014 "+t.name,"g");
          arrived.push(f.n+" is in position at "+t.name);
          flag("p-map");
        }
        dirty=true;
      }
      continue;
    }
    if(f.mv){
      f.eta-=dt;
      if(f.eta<=0){
        f.pos={sec:f.mv.sec,x:f.mv.x,y:f.mv.y};
        f.mv=null; f.at=null; f.eta=0; f.tot=0; f.o=null;
        if(!quiet)toast(f.n+" holding position","g");
        arrived.push(f.n+" is holding position");
        flag("p-map"); dirty=true;
      }
      continue;
    }
    if(!f.to)continue;
    f.eta-=dt;
    if(f.eta<=0){
      const dest=SYSMAP[f.to];
      f.at=f.to; f.to=null; f.eta=0; f.from=null; f.tot=0; f.pos=null; f.o=null;
      if(dest){
        if(!quiet)toast(f.n+" arrived at "+dest.n,"g");
        arrived.push(f.n+" arrived at "+dest.n);
      }
      flag("p-map"); dirty=true;
    }
  }
  /* auto-resolved raids: a short exchange on the map, then the result - never during
     an offline catch-up (the fleet simply waits beside the contact until the game is
     live again) and never underneath an open battle */
  if(!quiet&&!BT&&!DT){
    for(const t of S.tg.slice()){
      if(!t||!t.auto)continue;
      const f=fleets().find(x=>x.hold===t.id); if(!f)continue;
      if(!canAutoResolve(t,f)){ t.auto=0; delete t.fx; toast(f.n+" in position \u2014 "+t.name,"g"); flag("p-map"); dirty=true; continue }
      t.fx=(t.fx||0)+dt;
      if(t.fx>=TG_FX_SECS)raidAutoResolve(t,f);
    }
  }
  /* a fleet sent at an enemy system from the attack prompt (sysAttack): once it is
     there, ATTACK settles it on its own; FIGHT IT MYSELF leaves it waiting under the
     map's ENGAGE banner. An order whose system is no longer an enemy's is dropped. */
  for(const f of fleets()){
    if(!f.sg)continue;
    const s=SYSMAP[f.sg];
    if(!s||!sysContested(s)){ f.sg=null; f.sga=0; continue }
    if(fleetBusy(f)||f.at!==f.sg||!f.sga||quiet||BT||DT)continue;
    const gt=assaultTarget(s);
    f.sg=null; f.sga=0;
    if(!autoResolveTarget(gt,-1,f)){ f.sg=s.id; toast(f.n+" in position — "+s.n,"g"); flag("p-map"); }
    dirty=true;
  }
  tryDrainFleetQueue(quiet);
  return arrived;
}
/* the auto-resolved raid's result, applied without ever opening the battle screen:
   the same numbers endBattle("win") gives a BT.auto fight (AUTO_YIELD off the payout,
   AUTO_FHP_COST off the hull), said in one toast instead of a result card. */
let tgBooms=[];              /* runtime only: where a contact just died, for the map to flash */
function raidAutoResolve(t,f){
  const T=RAIDS[t.ti], full=raidReward(t);
  const o=full.o*AUTO_YIELD, c=full.c*AUTO_YIELD, m=full.m*AUTO_YIELD, sv=Math.floor(svReward(t)*AUTO_YIELD);
  S.wins=(S.wins||0)+1; xpOnWins();
  if(S.wins===1){ queueNotice("vega:firstWin"); svPulse=true; }
  if(T.boss)S.flags=(S.flags||0)+1;
  f.hp=Math.max(0.05,f.hp-AUTO_FHP_COST);
  S.ore+=o; S.all+=o; S.cry+=c; if(m){ S.dm+=m; S.dmAll+=m }
  if(sv>0){ S.sv=(S.sv||0)+sv; S.svAll=(S.svAll||0)+sv }
  S.plunder=(S.plunder||0)+o;
  const p=tgPos(t);
  tgBooms.push({sec:t.sec,x:p.x,y:p.y,t0:Date.now()});
  const i=S.tg.indexOf(t); if(i>=0)S.tg.splice(i,1);
  f.hold=null;
  const got=[o?"+"+fmt(o)+" ore":null, c?"+"+fmt(c)+" crystal":null, m?"+"+fmt(m)+" Dark Matter":null, sv?"+"+fmt(sv)+" salvage":null].filter(Boolean).join(" \u00b7 ");
  toast(t.name+" destroyed \u00b7 "+got,"g");
  sfx("win");
  dirty=true;
}
/* run 3 (decision 6): lands a purchase that had to queue (buyShip(), no fleet was
   idle at home at the time) the moment any fleet next sits idle at home - called
   after every arrival above (an arriving fleet may itself be the one that just
   reached home) and once from adopt() (a fleet can already be sitting idle at home
   when a save with a non-empty queue loads, with nothing due to "arrive"). `quiet`
   mirrors fleetTravelTick()'s own - no toast during an offline catch-up or a load,
   same reasoning as a quiet arrival. */
function tryDrainFleetQueue(quiet){
  if(!Array.isArray(S.flQ)||!(S.flQ[0]||S.flQ[1]||S.flQ[2]))return false;
  const f=fleets().find(fl=>!fleetBusy(fl)&&fl.at==="home"); if(!f)return false;
  for(let i=0;i<3;i++){ if(S.flQ[i]){ f.sh[i]+=S.flQ[i]; S.flQ[i]=0; } }
  if(!quiet)toast("Delivery arrived — "+f.n,"g");
  dirty=true; return true;
}
function fleetDPS(f){ f=f||curFleet(); let d=0; for(let i=0;i<SHIPS.length;i++)d+=f.sh[i]*SHIPS[i].dps;
  return d*shipCountMul()*fleetMult()*Math.pow(1.25,rfl("gun"))*crewMul("cap") }
function fleetHPMax(f){ f=f||curFleet(); let h=0; for(let i=0;i<SHIPS.length;i++)h+=f.sh[i]*SHIPS[i].hp;
  return h*shipCountMul()*fleetMult()*Math.pow(1.25,rfl("arm"))*crewMul("eng") }
function fleetCount(f){ f=f||curFleet(); return f.sh.reduce((a,b)=>a+b,0) }
/* every hull owned, empire-wide, of class i - buy/sell/max price off this total
   (summed across every fleet, same shape the single S.sh total used to give) so the
   cost curve is unchanged whichever fleet you are actually buying into. Run 3: a
   hull sitting in the delivery queue (S.flQ - bought while no fleet was home) is
   already paid for, so it counts here too - the cost curve must not reset the
   moment a purchase queues instead of landing directly. */
function shipTotal(i){ let n=0; for(const f of fleets())n+=f.sh[i]||0;
  if(Array.isArray(S.flQ))n+=S.flQ[i]||0; return n }
/* every warship any fleet (plus the delivery queue) on a given state object owns -
   missions/achievements take an arbitrary state (s), never necessarily the live S,
   so this reads s.fl/s.flQ directly rather than going through fleets()/S. */
function allFleetShips(s){
  const fl=((s&&s.fl)||[]).reduce((a,f)=>a+(f.sh||[]).reduce((x,y)=>x+y,0),0);
  const q=((s&&s.flQ)||[]).reduce((a,x)=>a+(x||0),0);
  return fl+q;
}
/* a full patch-up is about three minutes of production, pro-rata to the damage. Ore is
   the one thing you always have, so this is a soft gate, not a wall. */
function repairCost(f){
  f=f||curFleet();
  const need=Math.max(0,1-(f.hp||0));
  if(need<=0.001)return 0;
  return Math.max(50, rate()*180*need);
}
function repairFleet(f){
  f=f||curFleet();
  if(BT&&!BT.done)return false;           /* not mid-battle - a finished one is fine,
                                             and is exactly when you want to repair */
  const c=repairCost(f); if(c<=0)return false;
  /* paid repairs are yard work: the fleet has to be docked at Sol Reach or a
     Shipyard (RECALL brings it home). Out in the dark it only mends slowly by itself. */
  if(!idleAtYard(f)){ toast("Dock at Sol Reach or a Shipyard to repair","y"); return false }
  if(S.ore<c)return false;
  S.ore-=c; f.hp=1;
  blip(660,.22,"sine",.05); toast("Fleet repaired","g"); dirty=true; return true;
}
/* ---------------- loadout ---------------- */
function hardpoints(){ const c=fleetCap(); return 2+(c>=100?1:0)+(c>=250?1:0) }
function wepOwned(id){ return id==="pulse" || id==="rocket"
  || !!(S.wep&&S.wep.own&&S.wep.own[id]) }
/* rockets are a consumable, priced off production so they stay affordable forever */
const AMMO_LOT=5;
function ammoCost(k){ return Math.max(25, rate()*15)*(k||1) }
function buyAmmo(k){
  k=k||AMMO_LOT;
  const c=ammoCost(k); if(S.ore<c)return false;
  S.ore-=c; S.ammo=(S.ammo||0)+k;
  blip(420,.12,"square",.05); dirty=true; return true;
}
function wepSlots(){
  const s=(S.wep&&Array.isArray(S.wep.slot))?S.wep.slot.slice(0,hardpoints()):[];
  while(s.length<hardpoints())s.push(null);
  return s;
}
function equipped(){ return wepSlots().map(id=>id&&wepOwned(id)?WEPMAP[id]:null) }
function wepCost(w){ return w.cost }
function buyWeapon(w){
  if(!w||wepOwned(w.id))return false;
  if(S.sv<w.cost)return false;
  S.sv-=w.cost;
  if(!S.wep||typeof S.wep!=="object")S.wep={own:{},slot:[]};
  if(!S.wep.own)S.wep.own={};
  S.wep.own[w.id]=1;
  /* drop it straight into the first empty hardpoint - nobody buys a gun to leave it
     in the crate */
  const sl=wepSlots(); const free=sl.indexOf(null);
  if(free>=0){ sl[free]=w.id; S.wep.slot=sl }
  blip(300,.18,"square",.05);
  /* say what actually happened. With every hardpoint full this used to announce
     "Fitted: Heavy Cannon" and then fit nothing, which is its own version of the same
     complaint - the player is told the gun is on the ship when it is in the hold. */
  toast(free>=0 ? "Fitted: "+w.n
                : w.n+" bought \u2014 no free hardpoint, tap FIT to swap it in","g");
  dirty=true; return true;
}
function equipWeapon(id, idx){
  if(idx<0||idx>=hardpoints())return false;
  if(id&&!wepOwned(id))return false;
  const sl=wepSlots();
  if(id){ const at=sl.indexOf(id); if(at>=0&&at!==idx)sl[at]=null }  /* no duplicates */
  sl[idx]=id||null;
  if(!S.wep||typeof S.wep!=="object")S.wep={own:{},slot:[]};
  S.wep.slot=sl; dirty=true; return true;
}
/* dps-equivalent, used for balance readouts and by the sims */
function wepDPS(w,foes){
  const n=w.all?Math.max(1,foes||1):1;
  return w.mul*(w.shots||1)*n*w.acc/w.chg;
}
function loadoutDPS(foes){ let d=0;
  for(const w of equipped())if(w)d+=wepDPS(w,foes);
  return d*fleetDPS();
}
/* capacity: what the fleet costs you in command, and what you have to spend -
   empire-wide, every fleet plus every garrisoned Hangar summed exactly as the old
   single S.sh+hangar total was. Still used empire-wide by cpTotal()/hardpoints() -
   PLAN-fleets follow-up ("per-fleet cap") only changes capLeft()/capMax()/shipMax(),
   below. */
/* run 3: a queued-but-not-yet-delivered hull (S.flQ) still costs command capacity -
   it is a real, paid-for hull, just not aboard a fleet yet. Left out here, buyShip()'s
   own capLeft() check would never see it and capacity could be bypassed entirely by
   queuing purchases while every fleet is away (deviation from BRIEF-fleets-run3.md's
   literal text, which only calls out shipCost/shipTotal - not covering this leaves a
   real exploit, see the commit message). */
function shipPower(){ let p=0; for(const f of fleets())for(let i=0;i<SHIPS.length;i++)p+=f.sh[i]*SHIPS[i].pw;
  if(Array.isArray(S.flQ))for(let i=0;i<SHIPS.length;i++)p+=(S.flQ[i]||0)*SHIPS[i].pw;
  return p+hanTotalPower() }
/* PLAN-fleets follow-up ("per-fleet cap", shipped with governors): a fleet's own
   onboard power only - no hangar, no queue - the building block fleetTotalPower()
   below adds those back in, attributed to whichever fleet they actually count
   against. */
function fleetPower(f){ f=f||curFleet(); let p=0; for(let i=0;i<SHIPS.length;i++)p+=f.sh[i]*SHIPS[i].pw; return p }
/* S.flQ (decision 6: a purchase with no fleet home queues, landing on Fleet 1 the
   moment one next reaches home) counts against Fleet 1's own cap the moment it is
   bought - it is already paid for, just not aboard yet, same reasoning shipPower()'s
   own comment gives for including it in the empire-wide total. */
function flQPower(){ let p=0; if(Array.isArray(S.flQ))for(let i=0;i<SHIPS.length;i++)p+=(S.flQ[i]||0)*SHIPS[i].pw; return p }
/* everything that counts against ONE fleet's own share of fleetCap(): its onboard
   hulls, whatever Hangar power is attributed to it (hanPowerFor(), 03-defence.js -
   "hangar hulls count against the fleet they were stationed from"), and the
   delivery queue if this is Fleet 1. */
function fleetTotalPower(f){ f=f||curFleet();
  return fleetPower(f) + hanPowerFor(f.id) + (f.id===1 ? flQPower() : 0) }
/* how hard a fleet is to hit. Weighted by capacity rather than hull count, so this
   is a real composition choice: light hulls dodge, heavy hulls simply endure. */
function fleetEvade(f){
  f=f||curFleet();
  let w=0, e=0;
  for(let i=0;i<SHIPS.length;i++){ const p=f.sh[i]*SHIPS[i].pw; w+=p; e+=p*(SHIPS[i].ev||0) }
  const hull = w>0 ? e/w : 0;
  /* engines are a live choice on top of what you fly */
  return Math.min(0.75, hull + ENG_EV*pwrOf("eng"));
}
/* the cap itself is still one empire-wide number, from level - PLAN-fleets follow-up
   (owner, 21 Sep) makes it apply PER FLEET now: "each fleet may hold fleetCap()
   power", not the three of them sharing one pool. */
function fleetCap(){ return level()<RAIDLV ? 0 : FCAP0+FCAPK*(level()-RAIDLV)+Math.min(CORE_ADD_MAX,6*xlv("core")) }
/* f defaults to curFleet() so every existing no-arg call site (raidSubFlags(),
   the Raids strip, etc) already reads "this fleet's own room" with no call-site
   change - only buyShip() (below) needs to pass an explicit fleet, since what it
   is buying into is not always curFleet(). */
function capLeft(f){ f=f||curFleet(); return fleetCap()-fleetTotalPower(f) }
/* how many of tier i the remaining capacity on fleet f allows (may be 0, never negative) */
function capMax(i,f){ return Math.max(0,Math.floor(capLeft(f)/SHIPS[i].pw)) }
/* priced off the empire-wide owned count of class i (summed across every fleet),
   so the cost curve is unchanged whichever fleet is actually buying. */
function shipCost(i,k){ const S1=SHIPS[i]; return S1.b*Math.pow(S1.g,shipTotal(i))*(Math.pow(S1.g,k)-1)/(S1.g-1) }
function shipMax(i,f){ const S1=SHIPS[i];
  const inner=1+S.ore*(S1.g-1)/(S1.b*Math.pow(S1.g,shipTotal(i))); if(inner<=1)return 0;
  const byOre=Math.max(0,Math.floor(Math.log(inner)/Math.log(S1.g)));
  return Math.min(byOre, capMax(i,f));          /* whichever runs out first */ }
/* run 3 (decision 6, PLAN-fleets.md): adds to curFleet() when it is idle and at
   home; else the first idle fleet at home; else queues on S.flQ (counts per class)
   and lands into the first fleet that next reaches home idle - drained by
   tryDrainFleetQueue(), called from fleetTravelTick() on every arrival and once
   from adopt() so a save loaded with a fleet already idle at home clears the
   queue immediately rather than waiting for a fleet to arrive that is already
   there. PLAN-fleets follow-up: capacity is now checked against whichever fleet the
   purchase actually LANDS on (tgt, or Fleet 1 if it queues - flQPower() counts
   against Fleet 1, see fleetTotalPower()) rather than an empire-wide total, since
   the cap itself is per fleet now - price is still off the empire-wide cost curve
   (shipCost() unchanged).
   PLAN-polish batch C #1 (Shipyard): "home" is no longer the only place a purchase
   can land on the spot - any system with a built Shipyard (sysHasShipyard(),
   03-defence.js) counts too. idleAtYard() is the one predicate both the routing
   below and the buy button's own label (11-combat.js) read, so they can never
   disagree about which fleet a purchase would land on. */
function idleAtYard(fl){ return !fleetBusy(fl) && !!fl.at && (fl.at==="home" || sysHasShipyard(fl.at)); }
/* Owner, after playing the raid map: buying for a fleet that was away took the ore
   and the count on screen never moved (the hulls went to another fleet, or into the
   delivery queue). A purchase now only ever goes to the fleet on screen, and only
   while that fleet is docked - at Sol Reach or a Shipyard. Away, the button says so
   and is disabled. Nothing new is ever queued; S.flQ/tryDrainFleetQueue() stay only
   so hulls an older save already had on order still arrive. */
function buyShip(i,k){ if(k<1)return false;
  const cf=curFleet();
  if(!idleAtYard(cf))return false;
  if(k*SHIPS[i].pw>capLeft(cf))return false;    /* capacity is checked before price */
  const c=shipCost(i,k); if(S.ore<c)return false;
  S.ore-=c;
  cf.sh[i]+=k;
  blip(300+i*60,.1,"triangle",.05); dirty=true; return true }
/* the fleet is away or mid-fight is fine to buy into (it queues), but not to sell
   from: a hull already travelling can't be un-sold out from under an in-flight
   fleet, so a travelling curFleet() simply can't sell until it lands. */
function sellShip(i,k){ const f=curFleet(); if(fleetBusy(f))return false;
  k=Math.min(k,f.sh[i]); if(k<1)return false; const S1=SHIPS[i];
  S.ore+=0.5*S1.b*Math.pow(S1.g,shipTotal(i)-k)*(Math.pow(S1.g,k)-1)/(S1.g-1);
  f.sh[i]-=k; blip(150,.09,"square",.04); dirty=true; return true }
function pick(a){ return a[Math.floor(Math.random()*a.length)] }
/* ---------------- PLAN-raidmap: contacts roam the sector map ----------------
   A contact belongs to a sector (t.sec) and drifts around open space inside it. Its
   position is NOT stored and never ticked: it is a pure function of the clock and
   the contact's own seed (tgPos), so nothing here spends a Math.random() call or a
   per-frame state write - the map can draw it at any frame rate, offline time
   needs no catch-up, and csim (which never looks at a contact) is untouched.
   TUNING-PENDING: TG_SEC_DIF is how much stronger (and richer - raidReward() pays
   off t.dif) a contact is per sector out from the Core; TG_W is the raid-type mix
   per sector, the Core row being the old one-size mix exactly. */
const TG_SEC_DIF=0.2;
const TG_W=[[40,25,22,9,4],[32,25,25,12,6],[24,23,28,16,9],[17,20,30,20,13],[10,16,30,25,19]];
/* the furthest sector a contact can turn up in: one past the furthest the player holds */
function tgMaxSec(){
  if(level()<unlockLv("p-map"))return 0;
  const m=heldSystems().reduce((a,s)=>Math.max(a,s.sec),0);
  return Math.min(SECTORS.length-1,m+1);
}
function tgById(id){ return id==null?null:((S.tg||[]).find(t=>t&&t.id===id)||null) }
const TGP={};
function tgPath(t){
  let p=TGP[t.id]; if(p&&p.sd===t.sd)return p;
  const r=mulberry32(t.sd|0);
  p={sd:t.sd, w1:.022+r()*.02, w2:.018+r()*.02, w3:.05+r()*.04, w4:.045+r()*.04,
     p1:r()*6.283, p2:r()*6.283, p3:r()*6.283, p4:r()*6.283};
  TGP[t.id]=p; return p;
}
/* {sec,x,y,hd} - hd is the heading (radians, 0 = up the screen) off the path's own
   derivative, so a marker always points the way it is actually drifting. t.fz freezes
   the clock while a fleet sits on it; t.off is the contact's own clock offset, moved
   by exactly the frozen time on release so it carries on from where it stopped. */
function tgPos(t,now){
  const p=tgPath(t);
  const T=(t.fz!=null?t.fz:(now!=null?now:Date.now()/1000))-(t.off||0);
  const a1=p.w1*T+p.p1, a2=p.w2*T+p.p2, a3=p.w3*T+p.p3, a4=p.w4*T+p.p4;
  const dx=30*p.w1*Math.cos(a1)+9*p.w3*Math.cos(a3);
  const dy=27*p.w2*Math.cos(a2)-8*p.w4*Math.sin(a4);
  return {sec:t.sec, x:50+30*Math.sin(a1)+9*Math.sin(a3), y:52+27*Math.sin(a2)+8*Math.cos(a4), hd:Math.atan2(dx,-dy)};
}
function tgUnfreeze(t){
  if(t.fz==null)return;
  t.off=(t.off||0)+(Date.now()/1000-t.fz); t.fz=null;
}
/* `rng` defaults to Math.random and is always drawn from exactly four times, in one
   place, the same count the pre-map newTarget() spent - raidTick() runs on tick()'s
   own path and csim4.js seeds Math.random, so a fifth draw here would shift every
   random call after the first contact a run generates and break the byte-identical
   pacing baseline for a field the sim never reads. The sector rides on the same roll
   as the strength (r3): a stronger roll IS a contact from further out. */
function newTarget(rng){
  rng=rng||Math.random;
  const r1=rng(), r2=rng(), r3=rng(), r4=rng();
  const maxSec=tgMaxSec();
  const sec=Math.min(maxSec,Math.floor(r3*(maxSec+1)));
  const W=TG_W[sec]||TG_W[0];
  let r=r1*W.reduce((a,b)=>a+b,0), ti=W.length-1;
  for(let i=0;i<W.length;i++){ if(r<W[i]){ti=i;break} r-=W[i] }
  const T=RAIDS[ti];
  const en=T.en[0]+Math.floor(r2*(T.en[1]-T.en[0]+1));
  const v=0.85+r3*0.45;
  S.tgN=(S.tgN||0)+1;
  return {id:S.tgN, ti, name:T.names[Math.min(T.names.length-1,Math.floor(r4*T.names.length))], en,
    dif:T.dif*v*(1+TG_SEC_DIF*sec), secs:T.secs, dmg:T.dmg*v, sec,
    sd:(Math.floor(r1*0x3fffffff)^Math.floor(r4*0xffff))|0, off:Date.now()/1000, fz:null};
}
const SVBASE=[4,7,11,24,80];
function svReward(t){
  const b=SVBASE[t.ti]||4;
  return Math.max(1,Math.round(b*t.dif*(0.85+Math.random()*0.3)*crewMul("qm")));
}
function raidReward(t){
  const T=RAIDS[t.ti], d=t.dif;
  const all=T.rw==="all", q=crewMul("qm");
  const o=(all||T.rw==="ore"||T.rw==="both")?Math.max(rate()*180*d, 30*d)*q:0;
  const c=(all||T.rw==="cry"||T.rw==="both")?Math.max(cryRate()*600*d, 2*d)*q:0;
  const m=(all||T.rw==="dm")?Math.max(1,Math.round(1.5*d*(1+level()*0.06)*(1+0.12*lv(S.rs,"void"))*Math.pow(1.4,xlv("caged"))*q)):0;
  return {o,c,m};
}

