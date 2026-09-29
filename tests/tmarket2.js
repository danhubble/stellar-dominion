const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
// tmarket2.js — item 5 of PLAN-batch-sep10.md (patch563): the Market pane.
// Checks: prices follow rate()/cryRate(), the ore/DM floors hold, heat adds +12% per
// sale and halves after 10 simulated minutes (Date.now mocked), a sale deducts the
// spent resource and credits the right counter (dmAll for Dark Matter, like every
// other DM source), the SELL share chips never sell below mktReserve(), and no XP is granted by
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

 // ---------- Market refresh: SELL chips are shares of each card's SURPLUS (stock minus
 // mktReserve()), not fixed amounts - so no chip can sell below what the player keeps
 // for their next purchase. Selected via real chip taps (mktBuy is exported read-only).
 const chipInfo=await p.evaluate(()=>
   [...document.querySelectorAll('#p-mkt .buybar .chip')].map(c=>({mb:c.dataset.mb, label:c.textContent}))
 );
 ok('the Market SELL row has exactly four chips: 10%, 25%, 50%, SURPLUS',
   JSON.stringify(chipInfo)===JSON.stringify([
     {mb:"10",label:"10%"},{mb:"25",label:"25%"},{mb:"50",label:"50%"},{mb:"100",label:"SURPLUS"},
   ]), chipInfo);

 const shares=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:123456, all:123456, lvl:1});
   const res={};
   for(const mb of ["10","25","50","100"]){
     document.querySelector('#p-mkt [data-mb="'+mb+'"]').click();
     const price=G.mktPrice('ore','sv'), spare=G.mktSurplus('ore');
     res[mb]={ k:G.mktAmount('ore','sv'), want:Math.floor(spare*(+mb)/100/price),
       pressed:document.querySelector('#p-mkt [data-mb="'+mb+'"]').getAttribute('aria-pressed') };
   }
   return { res, reserve:G.mktReserve('ore'), mktBuy:G.mktBuy };
 });
 ok('each chip sells its share of the ore SURPLUS, floored to whole output units',
   Object.values(shares.res).every(r=>r.k===r.want && r.k>0), shares);
 ok('...the selected chip is aria-pressed, mktBuy holds the percent', shares.res["100"].pressed==="true" && shares.mktBuy===100, shares);
 ok('the ore reserve is a real, positive next-build cost', shares.reserve>0, shares);

 const surplusSale=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:123456, all:123456, lvl:1});
   document.querySelector('#p-mkt [data-mb="100"]').click();
   const reserve=G.mktReserve('ore'), k=G.mktAmount('ore','sv');
   const okSold=G.sellRes('ore','sv',k);
   return { okSold, k, reserve, oreLeft:G.S.ore, againK:G.mktAmount('ore','sv') };
 });
 ok('SURPLUS sells, and never takes ore below the reserve', surplusSale.okSold && surplusSale.oreLeft>=surplusSale.reserve-1e-6, surplusSale);
 ok('...after which a second SURPLUS tap has (almost) nothing left to sell', surplusSale.againK<=1, surplusSale);

 const zero=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:5, all:5, lvl:10});
   G.gotoTab('p-mkt');
   document.querySelector('#p-mkt [data-mb="100"]').click();
   dirty=true; render();
   const card=[...document.querySelectorAll('#mktSv .mktcard')].find(c=>c.dataset.kind==='ore');
   const btn=card.querySelector('.mktsell'), oreBefore=G.S.ore;
   btn.click();
   return { disabled:btn.disabled, text:btn.textContent, reserve:G.mktReserve('ore'), oreAfter:G.S.ore, oreBefore };
 });
 ok('with nothing spare the SELL slab is disabled and says so', zero.disabled && /NOTHING SPARE/.test(zero.text), zero);
 ok('...and a tap on it moves nothing', zero.oreAfter===zero.oreBefore, zero);

 // no cross-talk either direction (item 1's own "verify...and vice versa")
 const crosstalk=await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e12, all:1e12, lvl:1});
   const sBuyBefore=G.S.buy;
   const empChipOnBefore=document.querySelector('[data-b="1"]').classList.contains('on');
   document.querySelector('#p-mkt [data-mb="50"]').click();
   const sBuyAfterMktClick=G.S.buy;
   const empChipOnAfterMktClick=document.querySelector('[data-b="1"]').classList.contains('on');
   document.querySelector('[data-b="100"]').click();   // any Empire/buildings chip - shared S.buy handler
   const mktBuyAfterEmpClick=G.mktBuy;
   const mktChipOnAfterEmpClick=document.querySelector('#p-mkt [data-mb="50"]').classList.contains('on');
   return { sBuyBefore, sBuyAfterMktClick, empChipOnBefore, empChipOnAfterMktClick,
     mktBuyAfterEmpClick, mktChipOnAfterEmpClick };
 });
 ok('selecting a Market share leaves S.buy completely unchanged', crosstalk.sBuyAfterMktClick===crosstalk.sBuyBefore, crosstalk);
 ok('...and leaves the Empire/buildings chips\' own highlight untouched too', crosstalk.empChipOnAfterMktClick===crosstalk.empChipOnBefore, crosstalk);
 ok('clicking an Empire/buildings chip leaves mktBuy completely unchanged', crosstalk.mktBuyAfterEmpClick===50, crosstalk);
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
