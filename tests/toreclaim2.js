const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
let out=[], errs=[];
function ok(label, cond, extra){ out.push((cond?'PASS ':'FAIL ')+label+(extra!==undefined?'  '+JSON.stringify(extra):'')); }
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errs.push(e.message));
 await p.goto(GAME_URL);
 await p.waitForTimeout(400);

 // Regression for: kind:"ore" systems (res:null - Draskhold, Ferrous Hold, Anvilreach)
 // used to throw in renderMap() reading e.col on a null exotic def, which aborted the
 // function before it built the CLAIM button.
 const result = await p.evaluate(()=>{
   const G=window.__SD;
   G.adopt({...G.fresh(), ore:1e18, all:1e18, lvl:50});
   G.gotoTab('p-map');
   const out={};
   for(const id of ['dra','fer','anv']){
     S.msel=id;
     let threw=null;
     try{ renderMap(); }catch(e){ threw=e.message; }
     const btn=document.querySelector('#sysClaim');
     out[id]={ threw, hasClaimBtn: !!btn, disabled: btn?btn.disabled:null };
   }
   return out;
 });
 for(const id of ['dra','fer','anv']){
   ok('no throw inspecting ore-kind system '+id, result[id].threw===null, result[id]);
   ok('CLAIM button renders for '+id, result[id].hasClaimBtn, result[id]);
   ok('CLAIM button is enabled (affordable) for '+id, result[id].disabled===false, result[id]);
 }

 // end-to-end: clicking CLAIM on an ore-kind system actually claims it
 const claimed = await p.evaluate(()=>{
   S.msel='dra'; renderMap();
   document.querySelector('#sysClaim').click();
   return !!(S.sys && S.sys.dra);
 });
 ok('clicking CLAIM on an ore-kind system actually claims it', claimed);

 console.log(out.join('\n'));
 console.log(out.filter(l=>l.startsWith('FAIL')).length+' failures');
 console.log(errs.length?'ERR '+errs.join('|'):'NO JS ERRORS');
 await b.close();
})();
