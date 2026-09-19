const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tmapoverlap2.js — FIX 3 regression guard: at a real phone-width viewport (390px,
// the width the owner specified), no two map nodes' dots or labels may visually
// overlap. Coordinate-only concern (SYS[].sx/.sy) - this test does not care about
// ring membership, adjacency, or anything gameplay-related, only pixel geometry.
//
// item 3 (patch566-569): the wheel is gone - the map is 5 sector pages now, each
// rendering only its own 4-6 systems (SYS[].sec). Every SYS[] entry still gets a
// real, positioned, clickable .mnode - just on whichever page it belongs to, not
// all at once - so this now checks each of the 5 pages in turn, at 390px.
//
// Method: load the game, switch to the Map tab, read getBoundingClientRect() for
// every .mdot and .mlab currently in #mapNodes, and flag any pair (dot-dot,
// dot-label or label-label, across DIFFERENT systems) whose boxes intersect after
// a small safety margin - exact pixel-touching is not the same as a genuine visual
// overlap a player would notice, so a few px of shared edge is not flagged.
const { chromium } = require('playwright-core');
const MARGIN = 2; // px of allowed shared edge before it counts as a real overlap

function intersects(a, b, margin) {
  return a.left < b.right - margin && a.right > b.left + margin &&
         a.top < b.bottom - margin && a.bottom > b.top + margin;
}

async function findOverlaps(page) {
  const boxes = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#mapNodes .mnode').forEach(n => {
      const id = n.dataset.s;
      const dot = n.querySelector('.mdot'), lab = n.querySelector('.mlab');
      if (dot) { const r = dot.getBoundingClientRect(); out.push({ id, part: 'dot', left: r.left, right: r.right, top: r.top, bottom: r.bottom }); }
      if (lab) { const r = lab.getBoundingClientRect(); out.push({ id, part: 'lab', left: r.left, right: r.right, top: r.top, bottom: r.bottom }); }
    });
    return out;
  });
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.id === b.id) continue; // a system's own dot/label sitting near each other is fine
      if (intersects(a, b, MARGIN)) {
        overlaps.push(`${a.id}.${a.part} <-> ${b.id}.${b.part}`);
      }
    }
  }
  return { boxes, overlaps };
}

(async () => {
  const b = await chromium.launch({ executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium' });
  const out = [];
  const ok = (n, c, x) => out.push((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : ''));
  const errs = [];

  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(GAME_URL);
  await p.waitForTimeout(500);
  // patch609's level-8 reveal (Run 1) means a fresh, low-level save only ever shows
  // Sol Reach - the "every SYS[] entry belongs to exactly one sector page" check
  // below sums nodes actually rendered across every page, so it needs the reveal
  // past level 8 to see the full roster, same as tmapoverlap2's own per-page counts
  // (G.sysInSec(sec).length) already implicitly get from the fixture elsewhere.
  await p.evaluate(() => { const G = __SD; G.adopt({...G.fresh(), lvl:40, lvSeen:40}); });
  await p.evaluate(() => __SD.gotoTab('p-map'));
  await p.waitForTimeout(300);

  const sectorCount = await p.evaluate(() => __SD.SECTORS.length);
  let everySysSeen = 0;
  const declaredTotal = await p.evaluate(() => __SD.SYS.length);
  const allOverlaps = [];
  for (let i = 0; i < sectorCount; i++) {
    await p.evaluate(sec => __SD.setMapSec(sec), i);
    await p.waitForTimeout(150);
    const [nodeCount, expect] = await p.evaluate(sec => {
      const G = __SD;
      return [document.querySelectorAll('#mapNodes .mnode').length, G.sysInSec(sec).length];
    }, i);
    everySysSeen += nodeCount;
    ok(`sector ${i}: renders exactly its own systems as nodes`, nodeCount === expect, { nodeCount, expect });
    const { overlaps } = await findOverlaps(p);
    ok(`sector ${i}: no two nodes' dots/labels overlap at 390px width`, overlaps.length === 0, overlaps);
    if (overlaps.length) { console.log(`OVERLAPS (sector ${i}):\n` + overlaps.join('\n')); allOverlaps.push(...overlaps); }
  }
  ok('every SYS[] entry belongs to exactly one sector page (counts sum to SYS.length)',
     everySysSeen === declaredTotal, { everySysSeen, declaredTotal });

  await b.close();
  console.log(out.join('\n'));
  console.log(out.filter(l => l.startsWith('FAIL')).length + ' failures');
  console.log(errs.length ? 'ERR ' + errs.join('|') : 'NO JS ERRORS');
})();
