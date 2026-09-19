const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tmarket2.js — item 5 of PLAN-batch-sep10.md (patch563): the Market pane.
// Checks: prices follow rate()/cryRate(), the ore/DM floors hold, heat adds +12% per
// sale and halves after 10 simulated minutes (Date.now mocked), a sale deducts the
// spent resource and credits the right counter (dmAll for Dark Matter, like every
// other DM source), the MAX chip sells down to (near) zero, and no XP is granted by
// a sale.
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(500);

 // ---------- base prices follow rate()/cryRate(), and the floors hold at low rates
 const r1=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, cry:1e9, all:1e9, exo:{ir:1e6}, lvl:1});
   const svOreLow=G.svOrePrice();                 // rate() near-zero at a fresh lvl:1 -> floor
   G.S.ore=1e9; // ladder a rate up via a raw override on rate() isn't exposed, so use gens instead
   return { svOreLow, dmOreLow:G.dmOrePrice() };
 });
 ok('svOrePrice() floors at 200 ore when rate() is ~0', r1.svOreLow===200, r1);
 ok('dmOrePrice() floors at 5000 ore when rate() is ~0', r1.dmOreLow===5000, r1);

 const r2=await p.evaluate(()=>{
   const G=window.__SD;
   // buy enough Mining Drones (gen 0) to push rate() comfortably past the floor's
   // break-even point (200/90 ~= 2.22 ore/s for svOrePrice, 5000/1200 ~= 4.17 for dmOrePrice)
   G.S.buy=100; for(let i=0;i<6;i++) G.tick(0);      // gens/rate are read live, no purchase needed to prep state
   G.S.sys.home.b[0]=200;                            // 200 Mining Drones directly, cheaper than buying through the UI
   const rate=G.rate();
   return { rate, svOre:G.svOrePrice(), dmOre:G.dmOrePrice(),
     svMatches: Math.abs(G.svOrePrice()-Math.max(200,90*rate))<1e-6,
     dmMatches: Math.abs(G.dmOrePrice()-Math.max(5000,20*60*rate))<1e-6 };
 });
 ok('svOrePrice() tracks 90s of rate() once rate() clears the floor', r2.svMatches && r2.svOre>200, r2);
 ok('dmOrePrice() tracks 20 minutes of rate() once rate() clears the floor', r2.dmMatches, r2);

 // ---------- exotic price is flat (8 units per salvage), crystal follows cryRate()
 const r3=await p.evaluate(()=>{
   const G=window.__SD;
   return { exo:G.svExoPrice(), cryAtZero:G.svCryPrice() };
 });
 ok('svExoPrice() is a flat 8 units per salvage', r3.exo===8, r3);
 ok('svCryPrice() floors at 20 crystal per salvage when cryRate() is 0 (never free/0/NaN)', r3.cryAtZero===20, r3);

 // ---------- no price is ever 0 or NaN, even at zero income across the board
 const r3b=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:0, cry:0, all:0, exo:{}, lvl:1});
   return {
     sv_ore:G.svOrePrice(), sv_cry:G.svCryPrice(), sv_exo:G.svExoPrice(), dm_ore:G.dmOrePrice(),
     mkt_ore_sv:G.mktPrice('ore','sv'), mkt_cry_sv:G.mktPrice('cry','sv'),
     mkt_ir_sv:G.mktPrice('ir','sv'), mkt_ore_dm:G.mktPrice('ore','dm')
   };
 });
 const allPositiveFinite = Object.values(r3b).every(v=>Number.isFinite(v) && v>0);
 ok('every price (base and mktPrice()) is a positive finite number at zero income', allPositiveFinite, r3b);

 // ---------- a sale deducts the spent resource and credits the right counter
 const r4=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, cry:0, all:1e9, exo:{}, lvl:1});
   const oreBefore=G.S.ore, svBefore=G.S.sv, svAllBefore=G.S.svAll;
   const price=G.svOrePrice();               // ==200 (floor) at this state
   const okSold=G.sellRes('ore','sv',5);
   return { okSold, price,
     oreDelta: oreBefore-G.S.ore, svDelta: G.S.sv-svBefore, svAllDelta: G.S.svAll-svAllBefore };
 });
 ok('sellRes(ore,sv,5) succeeds', r4.okSold, r4);
 ok('...deducts exactly price*5 ore', Math.abs(r4.oreDelta-r4.price*5)<1e-6, r4);
 ok('...credits +5 salvage (and svAll, lifetime)', r4.svDelta===5 && r4.svAllDelta===5, r4);

 const r5=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, all:1e9, lvl:1});
   const dmAllBefore=G.S.dmAll, dmBefore=G.S.dm;
   G.sellRes('ore','dm',3);
   return { dmDelta:G.S.dm-dmBefore, dmAllDelta:G.S.dmAll-dmAllBefore };
 });
 ok('selling ore for Dark Matter credits S.dm', r5.dmDelta===3, r5);
 ok('...and increments S.dmAll, like every other DM source', r5.dmAllDelta===3, r5);

 // ---------- insufficient balance refuses the sale, nothing moves
 const r6=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1, all:1, lvl:1});
   const oreBefore=G.S.ore, svBefore=G.S.sv;
   const okSold=G.sellRes('ore','sv',1000);   // far more than 1 ore can cover
   return { okSold, oreUnchanged:G.S.ore===oreBefore, svUnchanged:G.S.sv===svBefore };
 });
 ok('sellRes() refuses a sale it cannot afford, and moves nothing', !r6.okSold && r6.oreUnchanged && r6.svUnchanged, r6);

 // ---------- heat: +12% per sale, halves after 10 simulated minutes (Date.now mocked)
 const r7=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, lvl:1});
   const base=G.svOrePrice();
   G.sellRes('ore','sv',1);
   const heatRight=G.mktHeat('sv');                 // ~0.12 immediately after one sale
   const priceRight=G.mktPrice('ore','sv');
   const real=Date.now;
   Date.now=()=>real()+10*60*1000;                  // fast-forward 10 minutes
   const heatAfter10=G.mktHeat('sv');
   Date.now=real;
   return { base, heatRight, priceRight, heatAfter10,
     rightMatches: Math.abs(heatRight-0.12)<0.01,
     priceMatches: Math.abs(priceRight-base*1.12)<0.01,
     halved: Math.abs(heatAfter10-0.06)<0.01 };
 });
 ok('one sale adds ~+12% heat', r7.rightMatches, r7);
 ok('...which multiplies straight into mktPrice()', r7.priceMatches, r7);
 ok('heat halves after 10 simulated minutes (Date.now mocked)', r7.halved, r7);

 // ---------- MAX chip sells (close to) everything affordable
 // patch636: mktAmount() reads its own mktBuy now, not S.buy (the Market has its own
 // AMOUNT state - see patch636's own HANDOVER entry) - `G.S.buy="max"` no longer
 // reaches it at all. mktBuy is exported read-only (same shape as mapMode), so this is
 // fixed by a real tap on the MAX chip itself, same as the rest of this batch's own new
 // tests below do - not a poke at the bare variable.
 const r8=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:123456, all:123456, lvl:1});
   document.querySelector('#p-mkt [data-mb="max"]').click();
   const price=G.mktPrice('ore','sv');
   const k=G.mktAmount('ore','sv');
   const oreBefore=G.S.ore;
   const okSold=G.sellRes('ore','sv',k);
   return { okSold, k, price, oreLeft:G.S.ore, oreBefore,
     leavesLessThanOnePrice: G.S.ore < price };
 });
 ok('MAX (mktBuy="max", selected via a real chip tap) computes the largest whole amount the balance affords', r8.k>0, r8);
 ok('...and selling that amount leaves less than one more unit\'s worth of ore', r8.okSold && r8.leavesLessThanOnePrice, r8);

 // ---------- patch636: the Market's own AMOUNT state (mktBuy), independent of the
 // buildings/Nexus chips' S.buy - six chips, a ×1K/×10K sale, and no cross-talk either
 // direction ----------------
 const chipInfo=await p.evaluate(()=>
   [...document.querySelectorAll('#p-mkt .buybar .chip')].map(c=>({mb:c.dataset.mb, label:c.textContent}))
 );
 ok('the Market AMOUNT row has exactly six chips', chipInfo.length===6, chipInfo);
 ok('...in order: ×1, ×10, ×100, ×1K, ×10K, MAX, each data-mb matching its label',
   JSON.stringify(chipInfo)===JSON.stringify([
     {mb:"1",label:"×1"},{mb:"10",label:"×10"},{mb:"100",label:"×100"},
     {mb:"1000",label:"×1K"},{mb:"10000",label:"×10K"},{mb:"max",label:"MAX"},
   ]), chipInfo);

 const sel1k=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, lvl:1});
   document.querySelector('#p-mkt [data-mb="1000"]').click();
   return { mktBuy:G.mktBuy, k:G.mktAmount('ore','sv'),
     chipOn: document.querySelector('#p-mkt [data-mb="1000"]').classList.contains('on') };
 });
 ok('selecting ×1K sets mktBuy to 1000', sel1k.mktBuy===1000, sel1k);
 ok('...and mktAmount() returns 1000 with plenty of balance to cover it', sel1k.k===1000, sel1k);
 ok('...and the ×1K chip itself shows the highlight', sel1k.chipOn, sel1k);

 const sale10k=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, lvl:1});
   document.querySelector('#p-mkt [data-mb="10000"]').click();
   const price=G.mktPrice('ore','sv');
   const k=G.mktAmount('ore','sv');
   const oreBefore=G.S.ore, svBefore=G.S.sv;
   const okSold=G.sellRes('ore','sv',k);
   return { k, price, okSold, oreDelta:oreBefore-G.S.ore, svDelta:G.S.sv-svBefore, expectedCost:k*price };
 });
 ok('×10K selects exactly 10000 units', sale10k.k===10000, sale10k);
 ok('...and the sale moves exactly 10000 output units, for exactly k*price ore',
   sale10k.okSold && sale10k.svDelta===10000 && Math.abs(sale10k.oreDelta-sale10k.expectedCost)<1e-6, sale10k);

 // the ×10K SELL label reads sanely through fmt() (tens of millions) and disables when short
 const label10k=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, lvl:1});
   G.gotoTab('p-mkt');
   document.querySelector('#p-mkt [data-mb="10000"]').click();
   dirty=true; render();
   const btn=[...document.querySelectorAll('#mktSv .mktcard')].find(c=>c.dataset.kind==='ore').querySelector('.mktsell');
   const affordableText=btn.textContent, affordableDisabled=btn.disabled, k=G.mktAmount('ore','sv'), price=G.mktPrice('ore','sv');
   G.S.ore=1;   // now far too little to afford even one more sale at this amount
   dirty=true; render();
   return { affordableText, affordableDisabled, shortDisabled:btn.disabled, k, cost:k*price };
 });
 ok('the ×10K SELL label is fmt()-scaled (a K/M/B suffix, not a raw tens-of-millions integer string)',
   /[KMB]/.test(label10k.affordableText) && label10k.cost>1e6, label10k);
 ok('...enabled while the balance can cover it', !label10k.affordableDisabled, label10k);
 ok('...disables once the balance falls short', label10k.shortDisabled, label10k);

 // no cross-talk either direction (item 1's own "verify...and vice versa")
 const crosstalk=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, lvl:1});
   const sBuyBefore=G.S.buy;
   const empChipOnBefore=document.querySelector('[data-b="1"]').classList.contains('on');
   document.querySelector('#p-mkt [data-mb="10000"]').click();
   const sBuyAfterMktClick=G.S.buy;
   const empChipOnAfterMktClick=document.querySelector('[data-b="1"]').classList.contains('on');
   document.querySelector('[data-b="100"]').click();   // any Empire/buildings chip - shared S.buy handler
   const mktBuyAfterEmpClick=G.mktBuy;
   const mktChipOnAfterEmpClick=document.querySelector('#p-mkt [data-mb="10000"]').classList.contains('on');
   return { sBuyBefore, sBuyAfterMktClick, empChipOnBefore, empChipOnAfterMktClick,
     mktBuyAfterEmpClick, mktChipOnAfterEmpClick };
 });
 ok('selecting a Market amount leaves S.buy completely unchanged', crosstalk.sBuyAfterMktClick===crosstalk.sBuyBefore, crosstalk);
 ok('...and leaves the Empire/buildings chips\' own highlight untouched too', crosstalk.empChipOnAfterMktClick===crosstalk.empChipOnBefore, crosstalk);
 ok('clicking an Empire/buildings chip leaves mktBuy completely unchanged', crosstalk.mktBuyAfterEmpClick===10000, crosstalk);
 ok('...and the Market chip\'s own highlight survives an Empire/buildings chip click', crosstalk.mktChipOnAfterEmpClick, crosstalk);

 // ---------- no XP anywhere from a sale
 const r9=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, all:1e9, lvl:1});
   const xpnBefore=G.S.xpn;
   G.sellRes('ore','sv',1); G.sellRes('ore','dm',1);
   return { xpnBefore, xpnAfter:G.S.xpn };
 });
 ok('selling grants no XP', r9.xpnAfter===r9.xpnBefore, r9);

 // ---------- "First Sale" record (ACHS) fires once, worth XPV.record (15)
 const r10=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, all:1e9, lvl:1});
   const before=G.S.xpn;
   G.sellRes('ore','sv',1);
   G.checkAchs();
   return { before, after:G.S.xpn, a36:!!G.S.ac.a36 };
 });
 ok('checkAchs() grants "First Sale" (a36) after a sale, +15 XP', r10.a36 && (r10.after-r10.before)>=15, r10);

 // ---------- migration/sanitize: adopt() gives every save a well-shaped S.mkt
 const r11=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({ore:0,all:0,lvl:1});                    // no mkt field at all on this "save"
   return G.S.mkt && G.S.mkt.heat && G.S.mkt.heat.sv && G.S.mkt.heat.dm ? {ok:true, mkt:G.S.mkt} : {ok:false};
 });
 ok('adopt() backfills a missing S.mkt with the {heat:{sv,dm}} shape', r11.ok, r11);

 // ---------- the pane itself: cards render, SELL works end to end through the DOM
 const r12=await p.evaluate(async()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e9, cry:0, all:1e9, exo:{}, lvl:10});
   G.gotoTab('p-mkt');
   dirty=true; render();
   await new Promise(r=>setTimeout(r,50));
   const cards=[...document.querySelectorAll('#mktSv .mktcard')];
   const oreBefore=G.S.ore, svBefore=G.S.sv;
   const oreCard=cards.find(c=>c.dataset.kind==='ore');
   const btn=oreCard.querySelector('.mktsell');
   btn.click();
   return { cardCount:cards.length, oreDelta:oreBefore-G.S.ore, svDelta:G.S.sv-svBefore };
 });
 ok('the Market pane renders at least one SALVAGE card (ore)', r12.cardCount>=1, r12);
 ok('clicking a card\'s SELL button actually sells', r12.oreDelta>0 && r12.svDelta>0, r12);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
