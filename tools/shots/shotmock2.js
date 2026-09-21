const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const {chromium}=require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium'});
 const p=await b.newPage({viewport:{width:1340,height:940},deviceScaleFactor:2});
 await p.goto(GAME_URL);
 await p.waitForTimeout(400);
 const fs=await p.$$('.frame');
 for(let i=0;i<fs.length;i++){
   await fs[i].screenshot({path:SHOTS+'fortify-row-'+"DEF"[i]+'.png'});
 }
 await b.close(); console.log('ok');
})();
