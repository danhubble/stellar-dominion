/* ============================ actions ============================ */
/* a tier is buildable on a system if it is already owned there (buy more) or is
   exactly the next reveal in that system's own ladder - never a tier further down the
   ladder, and never a tier from a different kind's ladder. The exotic requirement is
   NOT part of this gate on purpose: the whole point of STAGE 2 is that the next tier
   shows its price, exotic included, before you can pay it - see ladderBuy for where
   the exotic is actually checked. */
function tierBuildable(id,gi){
  if(!sysHeld(id))return false;
  const s=SYSMAP[id]; if(!s||!GENS[gi]||GENS[gi].kind!==ladderKindOf(s))return false;
  return sysTierCount(id,gi)>0 || sysNextGi(id)===gi;
}
function ladderBuy(id,gi){
  if(!tierBuildable(id,gi))return false;
  const st=sysState(id); if(!st)return false;
  if(!st.b||typeof st.b!=="object")st.b={};
  let k = S.buy==="max" ? ladderMaxAff(id,gi) : Math.min(S.buy, 1e9);
  if(S.buy!=="max"){ if(S.ore<ladderCost(id,gi,k)) k=Math.min(k,ladderMaxAff(id,gi)); }
  const xid=ladderExoId(gi);
  if(xid) k=Math.min(k, Math.floor(exo(xid)/GENS[gi].exoC));
  if(k<1)return false;
  const c=ladderCost(id,gi,k), xc=xid?GENS[gi].exoC*k:0;
  if(S.ore<c)return false;
  if(xc>0&&exo(xid)<xc)return false;
  S.ore-=c; if(xc>0)S.exo[xid]-=xc;
  const t0=tot();
  st.b[gi]=(st.b[gi]||0)+k;
  if(t0===0&&tot()>0)queueNotice("vega:firstDrone");
  xpOnBuild(id,gi,st.b[gi]-k,st.b[gi]);
  blip(240+gi*38,.09,"triangle",.05);
  dirty=true; return true;
}
/* Returns whether anything was actually bought. Every other purchase in the game does
   (buyGen, buyNex, buyRefit, buySysDef, claimSystem); this one silently returned undefined
   either way, which is how a caller could ask for the same refused node twenty times a
   tick and never find out. */
function buyRes(r){
  const l=lv(S.rs,r.id); if(l>=r.max)return false;
  if(resLocked(r)){ toast(resReqText(r)); return false }
  const c=r.c*Math.pow(r.cg,l);
  if(resBal(r)<c)return false;
  if(resCur(r)==="sv")S.sv-=c; else S.cry-=c;
  S.rs[r.id]=l+1; grantXp("rs:"+r.id+":"+(l+1), XPV.research, r.n+" "+(l+1)); blip(520,.16,"sine",.05);
  toast(r.n+" → level "+(l+1),"g"); dirty=true; renderRes();
  return true;
}
/* cur:"en" nodes spend Exotic Nodes instead of Dark Matter - same shape as RESH's
   own resCur()/resBal() pair for cur:"sv". */
/* every EFFECT read of a Nexus level goes through here (never cost/display, which
   always want the real level - see nexCost/buyNex/renderNex). patch589: the single
   suspension point - every bonus (DM nodes and Project nodes alike) reads 0 while
   S.end===1 (the turn is running). S.end===2 (won, a later Batch D patch) restores
   it, same as S.end===0 (never started) - deliberately ===1, not >=1. */
function nexLv(id){ return S.end===1 ? 0 : lv(S.nx,id) }
function nexCur(r){ return r.cur||"dm" }
function nexBal(r){ return nexCur(r)==="en" ? (S.en||0) : S.dm }
/* every NEXUS req so far names a max:1 node, so "owned" only ever means "bought" -
   a plain node id is enough (unlike RESH's req, which can name a level partway
   through a longer branch and so needs a {id,lv} pair). */
function nexOwned(id){ return lv(S.nx,id)>=1 }
function nexLocked(r){
  if(r.id==="pjx") return !nexOwned(r.req) || !sysHeld("nyx");
  return r.req ? !nexOwned(r.req) : false;
}
function nexReqText(r){
  if(!r.req)return "";
  const src=NEXUS.find(x=>x.id===r.req), reqName=src?src.n:r.req;
  if(r.id==="pjx") return "Requires "+reqName+" \u00b7 Requires Nyx";
  return "Requires "+reqName;
}
function nexCost(r,l){ if(l===undefined)l=lv(S.nx,r.id);
  return Math.ceil(r.c*Math.pow(r.cg,l)) }
function buyNex(r){
  if(S.end===1)return false;   /* patch589: every Nexus card is SEIZED while the finale runs */
  const l=lv(S.nx,r.id); if(l>=r.max)return false;
  if(nexLocked(r))return false;
  const c=nexCost(r,l);
  if(nexBal(r)<c)return false;
  if(nexCur(r)==="en")S.en-=c; else S.dm-=c;
  S.nx[r.id]=l+1; blip(400,.22,"sine",.06);
  toast(r.n+" → level "+(l+1),"y"); dirty=true; renderNex();
  if(r.id==="pjx")startFinale();
  return true;
}
/* patch589 ("the turn"), for real: S.end=1 fans out through nexLv() (Nexus bonuses),
   renderNex() (SEIZED), queueNotice()/purgeVegaNotices() (advisor dark) and every
   rival tick's own S.end>=1 guard (quiet) - see this patch's header for the full
   list. Any live threat/fleet is cleared on the spot so nothing survives the turn,
   then the scene plays: VEGA's own line uses the turned/dimmed avatar (opts.turned),
   the three rivals each get a line in their own colour. Ends on ENGAGE (patch590's
   real fight - a stub here) / NOT YET (closes - the game never forces the choice). */
function startFinale(){
  S.end=1;
  purgeVegaNotices();
  S.thq=[];
  lfClear();
  dirty=true; save();
  playScene(STORY.turn,{turned:true,buttons:[
    {t:"ENGAGE", cls:"warn", onClick:()=>startFinalBattle()},
    {t:"NOT YET", onClick:()=>{}}
  ]});
}
/* stub - patch590 turns this into the scripted final-battle target through
   engageTarget(). Both the turn scene's own ENGAGE button and the pinned Raids
   card (#endCard, below) call this same function.
   patch589b: gated directly, not only via the now-disabled buttons above - "the
   scene's ENGAGE must not start a fight with no fleet." sceneFinish() already
   closes the turn scene before this runs (playScene()'s buttons branch calls
   sceneClose() first), so the sceneOn check below only matters for a future direct
   caller (e.g. a dev shortcut) that skips that flow. */
function startFinalBattle(){
  if(fleetDPS()<=0){
    if(sceneOn)sceneClose();
    toast("No fleet \u2014 build warships first.","r");
    return;
  }
  /* patch590: the scripted final target. ti:4 is RAIDS' own "flag" entry (col
     "#ff5f6d") - only read for BT.T.col's fallback (bDraw's enemy colour line,
     untouched by this patch - see its own header note) and the boom-fx colour, so
     this alone makes most of the fleet read VEGA-red for free. secs/dif/dmg are
     unused by engageTarget()'s own t.final branch (totalHP/totalDPS read
     hpm/dps*FINAL_WAVE_MULT instead) - kept at sane placeholder values only in
     case something else ever reads them. en is wave 1's own hostile count. */
  engageTarget({ final:1, name:"VEGA's Fleet", arch:"mirror", ti:4,
    en:FINAL_WAVE_EN[0], secs:FINAL_CAP, dif:1, dmg:1 }, -1);
}
function doScan(ev){
  const v=clickPow();
  S.ore+=v; S.all+=v; S.clicks++;
  blip(700+Math.random()*120,.05,"sine",.03);
  if(ev){
    const f=document.createElement("div"); f.className="float"; f.textContent="+"+fmt(v);
    f.style.left=(ev.clientX-14)+"px"; f.style.top=(ev.clientY-18)+"px";
    document.body.appendChild(f); setTimeout(()=>f.remove(),1000);
  }
  dirty=true;
}
