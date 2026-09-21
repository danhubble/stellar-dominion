const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
// shots_r1.js — PLAN-unify.md Run 1 required screenshots, 390x844 dpr2.
// Drives window.__SD in the page (per instruction) rather than editing game data.
const { chromium } = require('playwright-core');
const URL = GAME_URL;

async function fresh(browser) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(500);
  // dismiss the intro overlay deterministically (see tmap2.js's own note)
  await p.evaluate(() => { if (window.__SD && __SD.sceneOn) __SD.sceneFinish(); });
  await p.waitForFunction(() => { const el = document.getElementById('scene'); return !el || getComputedStyle(el).display === 'none'; });
  await p.waitForTimeout(300);
  return { p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium' });

  // (a) fresh save at level 1 - map, only Sol Reach, no chips, sheet open.
  // #right's own flex share (below the fixed #core + the tutorial box in #left) is
  // narrow at this viewport - true on the shipped game's own Map tab too, not
  // something these patches changed - so the map pane needs a small internal
  // scroll (#view has its own overflow:auto) to bring the node above the fold
  // alongside the sheet. Noted in HANDOVER; not a regression from this run.
  {
    const { p, errs } = await fresh(b);
    await p.waitForTimeout(300);
    await p.evaluate(() => { document.getElementById('view').scrollTop = 140; });
    await p.waitForTimeout(150);
    await p.screenshot({ path: SHOTS+'unify-r1-a-fresh-map-solreach.png' });
    console.log('(a) errs:', errs);
    await p.close();
  }

  // (b) mid-game save, a rock system selected - context card shows its exotic
  {
    const { p, errs } = await fresh(b);
    await p.evaluate(() => {
      const G = window.__SD;
      G.adopt({ ...G.fresh(), lvl: 20, lvSeen: 20, ore: 5e6, dm: 400 });
      G.claimSystem(G.SYSMAP.kor);
      G.S.buy = 10; G.ladderBuy('kor', 14);
      G.S.msel = 'kor'; G.setMapZoom(null);
      G.S.notifyQueue = [];
      dirty = true; render();
    });
    await p.waitForTimeout(500);
    // achievement/level toasts from this setup's own big ore/dm grant fire on the
    // NEXT natural tick() after adopt(), not synchronously inside it - clear them in
    // a separate pass, after they've had a chance to appear, so the clear actually
    // lands after them (same idea as shotsdef1.js's own toast-clear, timed right).
    await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
    await p.waitForTimeout(150);
    await p.screenshot({ path: SHOTS+'unify-r1-b-context-card-exotic.png' });
    console.log('(b) errs:', errs);
    await p.close();
  }

  // (c) Research tab top - crystal strip
  {
    const { p, errs } = await fresh(b);
    await p.evaluate(() => {
      const G = window.__SD;
      G.adopt({ ...G.fresh(), lvl: 10, lvSeen: 10, cry: 4200, rs: { drill: 2 } });
      G.S.notifyQueue = [];
      G.gotoTab('p-res');
      dirty = true; render();
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: SHOTS+'unify-r1-c-research-crystal-strip.png' });
    console.log('(c) errs:', errs);
    await p.close();
  }

  // (d) header on a system with no exotic (home selected)
  {
    const { p, errs } = await fresh(b);
    await p.evaluate(() => {
      const G = window.__SD;
      G.adopt({ ...G.fresh(), lvl: 20, lvSeen: 20, ore: 5e6, dm: 400 });
      G.S.msel = 'home'; G.setMapZoom(null);
      G.S.notifyQueue = [];
      dirty = true; render();
    });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
    await p.waitForTimeout(150);
    await p.screenshot({ path: SHOTS+'unify-r1-d-header-home-no-exotic.png' });
    console.log('(d) errs:', errs);
    await p.close();
  }

  await b.close();
})().catch(err => { console.error(err); process.exit(1); });
