const GAME_URL='file://'+require('path').resolve(__dirname,'../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:1280,height:860}});
 p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
 p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE:',m.text())});
 await p.goto(GAME_URL);
 await p.waitForTimeout(900);
 console.log('SD before reload:', await p.evaluate(()=>typeof window.__SD));
 await p.reload(); await p.waitForTimeout(1200);
 console.log('SD after reload:', await p.evaluate(()=>typeof window.__SD));
 await b.close();
})();
