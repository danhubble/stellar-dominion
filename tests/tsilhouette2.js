const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tsilhouette2.js — static regression for the Stage-1 archetype enemy silhouettes
// (warden/phantom/impaler) added to bDraw()'s canvas path selection. Canvas drawing
// isn't practically exercised by this suite's browser harness (no other t*2.js file
// asserts on bx.* draw calls — tcore2.js only measures canvas backing-store size),
// so this checks the thing that actually matters at the source level: the three new
// e.k branches exist, take genuinely different path geometry from each other and
// from the untouched generic/swarm branch, and the color line was left alone.
const fs = require('fs');
let out=[], errs=0;
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); if(!cond)errs++; }

const html = fs.readFileSync(GAME_URL.slice(7), 'utf8');

// pull the bDraw shape-selection if/else chain out by anchoring on the swift needle
// branch (unchanged) through the closePath/fill that ends it.
const m = html.match(/if\(e\.k===["']swift["']\)\{[\s\S]*?bx\.closePath\(\); bx\.fill\(\);/);
ok('found the bDraw shape-selection if/else chain', !!m);
const chain = m ? m[0] : '';

// each of the three new kinds gets its own branch, distinct from a generic e.k check
// that some *other* kind could accidentally satisfy (they can't: warden/phantom/impaler
// are new EK entries used only via ARCH[].mix, per EMIX/ARCH below).
const branchRe = {
  warden:  /e\.k===["']warden["']\)\{([\s\S]*?)\}\s*else/,
  phantom: /e\.k===["']phantom["']\)\{([\s\S]*?)\}\s*else/,
  impaler: /e\.k===["']impaler["']\)\{([\s\S]*?)\}\s*else/,
};
const bodies = {};
for(const k in branchRe){
  const bm = chain.match(branchRe[k]);
  ok('bDraw has a dedicated e.k==="'+k+'" branch', !!bm);
  bodies[k] = bm ? bm[1].replace(/\s+/g,' ').trim() : '';
}

// the generic fallback (used by swarm and every ordinary kind) must be byte-identical
// to what it was before this change — swarm has no signature unit and must not move.
const genericMatch = chain.match(/\}\s*else\s*\{([\s\S]*?)\}\s*bx\.closePath\(\); bx\.fill\(\);\s*$/);
ok('generic fallback branch still present', !!genericMatch);
const generic = genericMatch ? genericMatch[1].replace(/\s+/g,' ').trim() : '';
const ORIGINAL_GENERIC =
  'bx.moveTo(0,ER); bx.lineTo(ER*.55,ER*.1); bx.lineTo(ER*1.05,-ER*.5); ' +
  'bx.lineTo(ER*.35,-ER*.42); bx.lineTo(0,-ER*.78); bx.lineTo(-ER*.35,-ER*.42); ' +
  'bx.lineTo(-ER*1.05,-ER*.5); bx.lineTo(-ER*.55,ER*.1);';
ok('generic/swarm chevron path is unchanged from before this patch', generic === ORIGINAL_GENERIC, generic);

// the three new branches must actually be distinct shapes, and distinct from generic
// and from swift's needle (the two other named branches already in the file).
const swiftBody = 'bx.moveTo(0,ER*1.15); bx.lineTo(ER*.42,-ER*.25); bx.lineTo(0,-ER*.95); ' +
  'bx.lineTo(-ER*.42,-ER*.25);';
const shapes = {warden: bodies.warden, phantom: bodies.phantom, impaler: bodies.impaler,
  generic, swift: swiftBody};
const names = Object.keys(shapes);
let allDistinct = true;
for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
  if(shapes[names[i]] && shapes[names[i]] === shapes[names[j]]) allDistinct=false;
}
ok('warden/phantom/impaler are each geometrically distinct from each other, generic, and swift', allDistinct);

// each new branch should actually draw something (at least a few moveTo/lineTo calls),
// not an empty/no-op branch, and should use ER (the enemy-radius scale) throughout,
// same convention as every existing branch, so it reads correctly at battle-screen size.
for(const k of ['warden','phantom','impaler']){
  const calls = (bodies[k].match(/bx\.(moveTo|lineTo)\(/g)||[]).length;
  ok(k+' branch draws a real multi-point path (>=5 moveTo/lineTo calls)', calls>=5, calls);
  const erUses = (bodies[k].match(/ER/g)||[]).length;
  ok(k+' branch scales every coordinate off ER (enemy radius), same as existing branches',
     erUses>=calls, {erUses,calls});
}

// the color line a few lines above must be byte-identical to before this change —
// this is a shape-only patch and must not touch shield/type color meaning.
// patch591c (D2 review) prepended one legitimate new branch - a single VEGA-red
// override for BT.t.final (the "mirror" final battle draws in one consistent red
// instead of the ordinary per-kind palette) - so the pin below was updated to match
// it, exactly once, per house rules for a pinned test whose behaviour intentionally
// changed. What the pin actually protects (below) still holds unchanged: no
// warden/phantom/impaler-specific color case exists anywhere in this line.
const COL_LINE = 'const col=(BT.t&&BT.t.final)?"#ff4d5e":K.boss?"#ff5f6d":e.k==="swift"?"#ffd166":e.k==="heal"?"#5ce6a5":\n              e.k==="bomber"?"#ff9a6b":e.k==="split"?"#b07cff":BT.T.col;';
ok('enemy fill-color logic (col=...) has exactly the patch591c mirror override and no warden/phantom/impaler color case',
   html.includes(COL_LINE) && !/warden|phantom|impaler/.test(COL_LINE));

// confirm these three kind names are never produced outside their intended archetype:
// only ARCH[].mix tables may mention them, never EMIX (the ordinary raid/tier mix).
const emixMatch = html.match(/const EMIX=\[[\s\S]*?\];/);
ok('found EMIX table', !!emixMatch);
if(emixMatch){
  for(const k of ['warden','phantom','impaler']){
    ok('EMIX (ordinary raid mix) never mentions "'+k+'"', !emixMatch[0].includes(k));
  }
}
const archMatch = html.match(/const ARCH=\{[\s\S]*?\n\};/);
ok('found ARCH table', !!archMatch);
if(archMatch){
  ok('ARCH.fortress.mix mentions warden', /fortress:[\s\S]*?mix:\{[^}]*warden/.test(archMatch[0]));
  ok('ARCH.ghost.mix mentions phantom', /ghost:[\s\S]*?mix:\{[^}]*phantom/.test(archMatch[0]));
  ok('ARCH.lance.mix mentions impaler', /lance:[\s\S]*?mix:\{[^}]*impaler/.test(archMatch[0]));
  ok('ARCH.swarm has no mix at all (unlabelled default, untouched)', /swarm:\s*\{[^}]*\}/.test(archMatch[0]) && !/swarm:\s*\{[^}]*mix/.test(archMatch[0]));
}

console.log(out.join('\n'));
console.log(errs===0 ? ('ALL PASS ('+out.length+' checks)') : (errs+' FAILURE(S)'));
process.exit(errs===0?0:1);
