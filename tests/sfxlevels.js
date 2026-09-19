const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tests/sfxlevels.js — measures peak and RMS-over-active-window for every named SFX
// cue via OfflineAudioContext, so cue levels can be sanity-checked by hand after any
// cue edit. Not part of the automated suite: loudness targets are a mixing judgment
// call, not a pass/fail regression. Run with: node sfxlevels.js
//
// "Active window" trims trailing near-silence (below 1% of the cue's own peak) off
// the padded render buffer first, so a long buffer doesn't dilute the RMS with
// silence the cue itself never filled.
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(GAME_URL);
  await p.waitForTimeout(300);
  const rows = await p.evaluate(async () => {
    const G = window.__SD;
    const names = Object.keys(G.SFX);
    const out = [];
    for (const name of names) {
      const data = await G.renderCueOffline(name, 1.2);
      let peak = 0;
      for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
      const floor = Math.max(1e-5, peak * 0.01);
      let end = 0;
      for (let i = data.length - 1; i >= 0; i--) { if (Math.abs(data[i]) > floor) { end = i + 1; break; } }
      if (end === 0) end = data.length;
      let sum = 0;
      for (let i = 0; i < end; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / Math.max(1, end));
      const dB = v => (v > 0 ? 20 * Math.log10(v) : -Infinity);
      out.push({ name, peak, rms, peakDB: dB(peak), rmsDB: dB(rms), windowMs: Math.round((end / 44100) * 1000) });
    }
    return out;
  });
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('cue', 15) + pad('peak', 9) + pad('peakDB', 10) + pad('rms', 9) + pad('rmsDB', 10) + 'window(ms)');
  for (const r of rows) {
    console.log(
      pad(r.name, 15) +
      pad(r.peak.toFixed(4), 9) +
      pad(r.peakDB.toFixed(1), 10) +
      pad(r.rms.toFixed(4), 9) +
      pad(r.rmsDB.toFixed(1), 10) +
      r.windowMs
    );
  }
  await b.close();
})();
