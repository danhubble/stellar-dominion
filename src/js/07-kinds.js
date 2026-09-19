/* ============================ rendering ============================ */
/* patch612: the old Empire tab (a grouped, collapsible system accordion - empOpen
   held the one open row's id) is gone; its per-system body is what patch610 turned
   into the sheet's own BUILDINGS section (see ladderTierRow, renderSysBuild). */
/* Per-kind colors: --k-* on :root is the single source of truth (patch443) - read
   here via getComputedStyle at boot so JS and CSS can never drift out of sync with
   each other. .rgb is the same color as a comma-separated triplet, for the
   rgba(var(--a-rgb-ish),alpha) tint layers empSysRow builds; .txt is the stat-text
   color (see the --k-* comment in :root for the contrast numbers behind it) - the
   raw kind color for six of seven kinds, a lightened variant for void only. */
const KIND_INFO=(()=>{
  const cs=getComputedStyle(document.documentElement);
  const g=v=>cs.getPropertyValue(v).trim();
  const hexToRgbTriplet=hex=>{ const n=parseInt(hex.replace("#",""),16);
    return ((n>>16)&255)+","+((n>>8)&255)+","+(n&255); };
  const mk=(n,base,txtVar)=>{ const col=g(base);
    return {n,col,rgb:hexToRgbTriplet(col),txt:g(txtVar||base)}; };
  return {
    ore:mk("ORE","--k-ore"), rock:mk("ROCK","--k-rock"), gas:mk("GAS","--k-gas"),
    belt:mk("BELT","--k-belt"), ice:mk("ICE","--k-ice"),
    void:mk("VOID","--k-void","--k-void-text"), mixed:mk("HOME","--k-home")
  };
})();
function gotoTab(pid){ const t=$$(".tab").find(x=>x.dataset.p===pid); if(t)t.click(); }
