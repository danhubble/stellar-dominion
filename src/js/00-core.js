"use strict";
/* bumped by hand, one per patch that ships - shown in the dev panel so the owner
   can tell which build a report/screenshot came from. */
const BUILD=@@BUILD@@;
/* ============================ storage (safe) ============================ */
const Store=(()=>{let mem={},ok=false;
  try{const k="__sd";window.localStorage.setItem(k,"1");window.localStorage.removeItem(k);ok=true}catch(e){ok=false}
  return{available:ok,
    get(k){if(ok){try{return window.localStorage.getItem(k)}catch(e){}}return k in mem?mem[k]:null},
    set(k,v){if(ok){try{window.localStorage.setItem(k,v);return}catch(e){}}mem[k]=v},
    del(k){if(ok){try{window.localStorage.removeItem(k)}catch(e){}}delete mem[k]}}
})();
const KEY="stellar-dominion-v1";

/* ============================ helpers ============================ */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const SUF=["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc","Ud","Dd","Td","Qad","Qid"];
function fmt(n){
  if(!isFinite(n))return "∞"; if(n<0)return "-"+fmt(-n);
  if(n<1000){ if(n===0)return "0"; if(n<10)return (Math.round(n*100)/100).toString(); if(n<100)return (Math.round(n*10)/10).toString(); return Math.floor(n).toString(); }
  let t=Math.floor(Math.log10(n)/3); if(t>=SUF.length){return n.toExponential(2)}
  const v=n/Math.pow(1000,t);
  return (v<10?v.toFixed(2):v<100?v.toFixed(1):v.toFixed(0))+SUF[t];
}
function fmtT(s){ s=Math.max(0,Math.floor(s));
  const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;
  if(d)return d+"d "+h+"h"; if(h)return h+"h "+m+"m"; if(m)return m+"m "+x+"s"; return x+"s";
}
/* PLAN-governors: a governor purchase's normal toast/blip fire only while the
   system's own page is open (owner decision 5) - govBuyStep() sets this around its
   ladderBuy()/grantXp() call rather than teaching either function about governors.
   Never set anywhere else; always false again before the next player-facing call. */
let hush=false;
function toast(msg,cls){
  if(hush)return;
  const host=$("#toasts");
  const d=document.createElement("div"); d.className="toast "+(cls||""); d.textContent=msg;
  host.appendChild(d);
  while(host.children.length>4) host.firstChild.remove();
  setTimeout(()=>{d.style.transition="opacity .4s";d.style.opacity="0";setTimeout(()=>d.remove(),420)},2600);
}
/* ============================ audio: synthesis engine ============================
   No samples, pure Web Audio. One AudioContext, built lazily on first sound and torn
   down never. Every voice runs through a shared graph: bus -> soft-clip WaveShaper ->
   master -> destination, with battle cues additionally sending into a short feedback
   delay that folds back into the bus (a little space, not an echo). UI blips (the
   plain blip() callers scattered outside combat) stay dry - they never touch the
   delay send. */
let AC=null, AG=null;
/* builds one full graph (bus/shaper/master/delay/shared noise buffer) on whatever
   context it is given - the real AudioContext for actual play, or a throwaway
   OfflineAudioContext for the offline peak check below. */
function buildAudioGraph(ctx){
  const master=ctx.createGain(); master.gain.value=0.46;      /* ~0.8x an old blip's peak, net of the shaper's small-signal boost below */
  const shaper=ctx.createWaveShaper();
  const n=1024, curve=new Float32Array(n);
  for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; curve[i]=Math.tanh(x*1.6)/Math.tanh(1.6) }
  shaper.curve=curve; shaper.oversample="2x";
  const bus=ctx.createGain(); bus.gain.value=1;
  bus.connect(shaper); shaper.connect(master); master.connect(ctx.destination);
  /* a short feedback delay - battle cues send into this, UI blips never do */
  const delay=ctx.createDelay(1); delay.delayTime.value=0.09;
  const fb=ctx.createGain(); fb.gain.value=0.22;
  const dlp=ctx.createBiquadFilter(); dlp.type="lowpass"; dlp.frequency.value=2500;
  const wet=ctx.createGain(); wet.gain.value=0.18;
  const delaySend=ctx.createGain(); delaySend.gain.value=1;
  delaySend.connect(delay);
  delay.connect(fb); fb.connect(dlp); dlp.connect(delay);     /* the feedback loop */
  delay.connect(wet); wet.connect(bus);                       /* wet mixed back into dry */
  /* one shared 2s noise buffer every noiseVoice() slices a random window from, rather
     than allocating a fresh buffer per call */
  const nn=Math.floor(ctx.sampleRate*2);
  const noiseBuf=ctx.createBuffer(1,nn,ctx.sampleRate);
  const nd=noiseBuf.getChannelData(0);
  for(let i=0;i<nn;i++)nd[i]=Math.random()*2-1;
  return {ctx,bus,master,shaper,delaySend,noiseBuf};
}
function A(){
  if(AG)return AG;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  AG=buildAudioGraph(AC);
  return AG;
}
/* autoplay policies start a fresh AudioContext suspended - resume it on the first
   tap/keypress, same as any other "needs a gesture" unlock */
function resumeAudio(){ try{ if(AC&&AC.state==="suspended")AC.resume() }catch(e){} }
document.addEventListener("pointerdown",resumeAudio,{passive:true});
document.addEventListener("keydown",resumeAudio);
let _audioWarned=false;
function audioWarn(e){ if(_audioWarned)return; _audioWarned=true; try{ console.warn("[sfx]",e&&e.message) }catch(_){} }
/* +-pct jitter on a value - jit(440,8) is 440 give or take 8% */
function jit(v,pct){ return v*(1+(Math.random()*2-1)*(pct||0)/100) }
/* the per-cue loudness trim currently in effect - set by sfx() around a cue's
   (fully synchronous) body so every osc()/noiseVoice() layer it fires picks it up
   through env(), with no need to thread a gain multiplier through every call site. */
let _trim=1;
/* exponential attack/decay/sustain/release on a GainNode - every voice gets exactly
   one. Never ramps linearly to 0 (that clicks); the release always targets a tiny
   epsilon exponentially instead. */
function env(g,t0,o){
  o=o||{};
  const a=o.a??.006, d=o.d??.05, s=o.s??.4, r=o.r??.05, peak=Math.max(.0002,(o.peak??.05)*_trim);
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(.0001,t0);
  g.gain.exponentialRampToValueAtTime(peak,t0+a);
  g.gain.exponentialRampToValueAtTime(Math.max(.0001,peak*Math.max(s,.001)),t0+a+d);
  g.gain.exponentialRampToValueAtTime(.0001,t0+a+d+r);
}
/* one oscillator voice: a steady tone (f1 omitted/equal) or an exponential sweep from
   f0 to f1 over dur. Optional tremolo (LFO on gain) or vibrato (LFO on frequency),
   optional post-filter (lp/hp/bp, itself optionally sweeping f0->f1), optional wet
   send into the shared delay - that's the "lp/hp/bp via BiquadFilter" and "battle
   cues route through the delay" pieces for oscillator voices. A multi-layer cue's
   later layers use `delay` (seconds, scheduled on the AUDIO clock via
   ctx.currentTime) rather than setTimeout - setTimeout is real wall-clock time, which
   both jitters against the audio clock and never fires inside an OfflineAudioContext
   render, so a delayed layer would go missing from the offline peak check below. */
function osc(type,f0,f1,dur,o,G){
  if(S.muted)return;
  try{
    G=G||A(); const ctx=G.ctx, t0=ctx.currentTime+((o&&o.delay)||0), D=dur||.1;
    const o1=ctx.createOscillator(), g=ctx.createGain();
    o1.type=type||"sine";
    const F0=Math.max(1,f0), F1=Math.max(1,f1==null?f0:f1);
    o1.frequency.setValueAtTime(F0,t0);
    if(F1!==F0)o1.frequency.exponentialRampToValueAtTime(F1,t0+D);
    let node=o1;
    if(o&&o.filter){
      const filt=ctx.createBiquadFilter();
      filt.type=o.filter.type||"lowpass";
      const Ff0=o.filter.f0!=null?o.filter.f0:800;
      filt.frequency.setValueAtTime(Math.max(1,Ff0),t0);
      if(o.filter.f1!=null)filt.frequency.exponentialRampToValueAtTime(Math.max(1,o.filter.f1),t0+D);
      if(o.filter.q!=null)filt.Q.value=o.filter.q;
      node.connect(filt); node=filt;
    }
    node.connect(g);
    if(o&&o.tremolo){
      /* amplitude wobble - an LFO summed straight onto the gain AudioParam, so its
         swing has to be scaled to the note's own (trimmed) peak, not a flat number:
         a flat +-0.3 added on top of a much quieter trimmed note would swamp the
         envelope entirely and ignore SFX_TRIM - exactly what made fireLance so much
         louder than everything else before patch560. */
      const trimmedPeak=Math.max(.0002,((o&&o.vol)||.05)*_trim);
      const lfo=ctx.createOscillator(), lg=ctx.createGain();
      lfo.type="sine"; lfo.frequency.value=o.tremolo.hz||30;
      lg.gain.value=trimmedPeak*(o.tremolo.depth??.3);
      lfo.connect(lg); lg.connect(g.gain); lfo.start(t0); lfo.stop(t0+D+.05);
    }
    if(o&&o.vibrato){                               /* frequency wobble */
      const lfo=ctx.createOscillator(), lg=ctx.createGain();
      lfo.type="sine"; lfo.frequency.value=o.vibrato.hz||6;
      lg.gain.value=o.vibrato.depth||10;
      lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t0); lfo.stop(t0+D+.05);
    }
    env(g,t0,Object.assign({peak:(o&&o.vol)||.05},o&&o.env));
    g.connect(G.bus);
    if(o&&o.wet)g.connect(G.delaySend);
    o1.start(t0); o1.stop(t0+D+.05);
  }catch(e){ audioWarn(e) }
}
/* one noise voice: a random slice of the shared buffer through an optional filter
   (lowpass/highpass/bandpass, optionally sweeping f0->f1) */
function noiseVoice(dur,o,G){
  if(S.muted)return;
  try{
    G=G||A(); const ctx=G.ctx, t0=ctx.currentTime+((o&&o.delay)||0), D=dur||.15;
    const src=ctx.createBufferSource(); src.buffer=G.noiseBuf;
    const off=Math.random()*Math.max(.01,G.noiseBuf.duration-D-.01);
    const g=ctx.createGain();
    let node=src;
    if(o&&o.filter){
      const filt=ctx.createBiquadFilter();
      filt.type=o.filter.type||"lowpass";
      const Ff0=o.filter.f0!=null?o.filter.f0:800;
      filt.frequency.setValueAtTime(Math.max(1,Ff0),t0);
      if(o.filter.f1!=null)filt.frequency.exponentialRampToValueAtTime(Math.max(1,o.filter.f1),t0+D);
      if(o.filter.q!=null)filt.Q.value=o.filter.q;
      node.connect(filt); node=filt;
    }
    node.connect(g);
    env(g,t0,Object.assign({peak:(o&&o.vol)||.04},o&&o.env));
    g.connect(G.bus);
    if(o&&o.wet)g.connect(G.delaySend);
    src.start(t0,off,D);
  }catch(e){ audioWarn(e) }
}
/* the plain single-tone helper every non-combat call site already uses - same
   signature as before, now voiced through the shared engine, always dry (never sent
   to the delay - that send is reserved for battle cues). */
function blip(f,dur,type,vol){
  if(S.muted||hush)return;
  try{
    const G=A(), t0=G.ctx.currentTime, D=dur||.12;
    const o1=G.ctx.createOscillator(), g=G.ctx.createGain();
    o1.type=type||"sine"; o1.frequency.value=f; o1.connect(g);
    env(g,t0,{a:.006,d:D*.5,s:.001,r:D*.5,peak:vol||.05});
    g.connect(G.bus);
    o1.start(t0); o1.stop(t0+D+.05);
  }catch(e){ audioWarn(e) }
}
/* named cues, 2-3 synthesised layers each, every one kept under ~0.6s per layer and
   at/below the old volumes. Every layer that isn't explicitly dry (waveIn only) sends
   into the shared delay - "battle cues route through the delay". jit() gives every
   call a little pitch/volume variation so repeats don't sound identical. */
const SFX={
 fireLaser: ()=>{
   noiseVoice(.012,{vol:jit(.025,15),filter:{type:"highpass",f0:3000},wet:true});
   osc("square",jit(1100,8),jit(420,8),.07,{vol:jit(.028,15),wet:true});
   osc("sine",jit(420,8),jit(420,8),.06,{vol:jit(.018,15),wet:true});
 },
 fireBurst: ()=>{
   for(let i=0;i<3;i++){
     const dl=i*.045;
     noiseVoice(.012,{vol:jit(.022,15),filter:{type:"highpass",f0:3000},wet:true,delay:dl});
     osc("square",jit(1100+i*45,8),jit(420+i*15,8),.06,{vol:jit(.026,15),wet:true,delay:dl});
   }
 },
 fireRocket: ()=>{
   noiseVoice(.32,{vol:jit(.05,15),filter:{type:"lowpass",f0:1800,f1:300},wet:true});
   osc("sawtooth",jit(180,8),jit(70,8),.25,{vol:jit(.045,15),wet:true});
   noiseVoice(.015,{vol:jit(.02,15),filter:{type:"highpass",f0:3500},wet:true});
 },
 fireLance: ()=>{
   osc("sine",jit(250,8),jit(1600,8),.22,{vol:jit(.035,15),tremolo:{hz:30,depth:.35},wet:true});
   noiseVoice(.2,{vol:jit(.02,15),filter:{type:"highpass",f0:4000},wet:true});
 },
 fireFlak: ()=>{
   noiseVoice(.06,{vol:jit(.04,15),filter:{type:"bandpass",f0:900,q:6},wet:true});
   noiseVoice(.06,{vol:jit(.04,15),filter:{type:"bandpass",f0:900,q:6},wet:true,delay:.07});
 },
 hitHull: ()=>{
   noiseVoice(.07,{vol:jit(.04,15),filter:{type:"lowpass",f0:900},wet:true});
   osc("sine",jit(150,8),jit(90,8),.06,{vol:jit(.045,15),wet:true});
 },
 crit: ()=>{
   sfx("hitHull");
   osc("triangle",jit(1300,8),jit(800,8),.09,{vol:jit(.06,15),wet:true});
 },
 shieldBlock: ()=>{
   osc("sine",jit(1500,8),jit(1500,8),.06,{vol:jit(.03,15),env:{a:.002,d:.02,s:.001,r:.04},wet:true});
   osc("sine",jit(2250,8),jit(2250,8),.06,{vol:jit(.022,15),env:{a:.002,d:.02,s:.001,r:.04},wet:true});
   noiseVoice(.01,{vol:jit(.015,15),filter:{type:"highpass",f0:5000},wet:true});
 },
 shieldShatter: ()=>{
   osc("sine",jit(1800,8),jit(350,8),.35,{vol:jit(.045,15),wet:true});
   noiseVoice(.3,{vol:jit(.035,15),filter:{type:"bandpass",f0:3000,f1:400,q:4},wet:true});
   [2000,1600,1200].forEach((f,i)=>
     osc("sine",jit(f,8),jit(f,8),.05,{vol:jit(.025,15),env:{a:.002,d:.015,s:.001,r:.03},wet:true,delay:i*.04}));
 },
 sysDown: ()=>{
   osc("sawtooth",jit(120,8),jit(120,8),.2,{vol:jit(.045,15),env:{a:.004,d:.06,s:.001,r:.13},wet:true});
   noiseVoice(.15,{vol:jit(.035,15),filter:{type:"lowpass",f0:500},wet:true});
   for(let i=0;i<6;i++)
     noiseVoice(.01,{vol:jit(.018,15),filter:{type:"highpass",f0:4000},wet:true,delay:Math.random()*.19});
 },
 sysDestroyed: ()=>{
   sfx("sysDown");
   osc("sine",60,60,.4,{vol:jit(.05,15),env:{a:.08,d:.15,s:.4,r:.17},wet:true});
   osc("sawtooth",jit(400,8),jit(50,8),.45,{vol:jit(.045,15),wet:true});
 },
 engOut: ()=>{
   sfx("sysDown");
   osc("triangle",200,200,.35,{vol:jit(.035,15),vibrato:{hz:6,depth:20},wet:true,delay:.12});
 },
 foeDead: ()=>{
   noiseVoice(.6,{vol:jit(.045,15),filter:{type:"lowpass",f0:2500,f1:150},wet:true});
   osc("sine",55,55,.45,{vol:jit(.05,15),env:{a:.01,d:.15,s:.3,r:.29},wet:true});
   noiseVoice(.015,{vol:jit(.025,15),filter:{type:"highpass",f0:3500},wet:true,delay:.18});
   noiseVoice(.015,{vol:jit(.025,15),filter:{type:"highpass",f0:3500},wet:true,delay:.32});
 },
 foeShot: ()=>{
   osc("sine",jit(320,8),jit(260,8),.06,{vol:jit(.025,15),wet:true});
   noiseVoice(.008,{vol:jit(.012,15),filter:{type:"highpass",f0:4000},wet:true});
 },
 playerHit: ()=>{
   noiseVoice(.09,{vol:jit(.04,15),filter:{type:"lowpass",f0:1200},wet:true});
   osc("sine",110,110,.08,{vol:jit(.04,15),wet:true});
   osc("sine",60,60,.04,{vol:jit(.03,15),wet:true});
 },
 waveIn: ()=>{                                       /* the alarm - stays dry on purpose */
   osc("sawtooth",110,110,.35,{vol:jit(.05,15),filter:{type:"highpass",f0:200},env:{a:.05,d:.1,s:.6,r:.2}});
   osc("sawtooth",110,110,.35,{vol:jit(.05,15),filter:{type:"highpass",f0:200},env:{a:.05,d:.1,s:.6,r:.2},delay:.4});
 },
 win: ()=>{
   [523,659,784].forEach((f,i)=>
     osc("sine",f,f,.12,{vol:jit(.045,15),env:{a:.004,d:.03,s:.001,r:.09},wet:true,delay:i*.09}));
   [523,659,784].forEach(f=>
     osc("sine",f,f,.2,{vol:jit(.03,15),env:{a:.01,d:.08,s:.4,r:.11},wet:true,delay:.24}));
 },
 loss: ()=>{
   osc("sawtooth",jit(330,8),jit(220,8),.5,{vol:jit(.045,15),wet:true});
   noiseVoice(.3,{vol:jit(.03,15),filter:{type:"lowpass",f0:400},wet:true});
 },
};
/* patch560 - equal peaks are not equal loudness: fireLance (a 220ms sustained sine)
   measured ~23dB louder by RMS than fireLaser (a 70ms click) despite similar peaks,
   and fireFlak measured far under everything else. Levels below are RMS-matched
   (tests/sfxlevels.js measures peak+RMS-over-active-window for every cue) rather
   than peak-matched: every fire* cue within ~1.5dB RMS of fireLaser; hitHull/
   foeShot/shieldBlock within ~2dB of each other and ~2dB under the fire group;
   crit/shieldShatter/sysDown/engOut ~2dB over fire; the "event" cues (foeDead,
   sysDestroyed, waveIn, win, loss, playerHit) ~3dB over fire, since they mark
   something happening rather than every shot fired. Applied in sfx() via the
   shared _trim multiplier env() reads - no per-layer vol numbers above changed. */
const SFX_TRIM={
 fireLaser:1.00, fireBurst:0.84, fireRocket:1.19, fireLance:1.04, fireFlak:10.68,
 hitHull:0.73, foeShot:1.27, shieldBlock:3.00,
 crit:0.78, shieldShatter:1.28, sysDown:2.72, engOut:1.73,
 foeDead:0.87, sysDestroyed:0.78, waveIn:1.52, win:1.19, loss:2.02, playerHit:1.21,
};
function sfx(name){
  if(S.muted)return;
  const f=SFX[name]; if(!f)return;
  const prevTrim=_trim;
  _trim=SFX_TRIM[name]!=null?SFX_TRIM[name]:1;
  try{ f() } finally { _trim=prevTrim }
}
/* fireWeapon() picks a cue by weapon id, not by D.fx alone - two shell weapons
   (rocket, heavy/mis) do not sound alike, and flak's "spray" fx gets its own cue. */
function fireCueFor(D){
  return ({pulse:"fireLaser",burst:"fireBurst",rocket:"fireRocket",ion:"fireLance",flak:"fireFlak"})[D&&D.id]
    || "fireLaser";
}
/* dev/test hook only, never called during play: renders one named cue through a
   throwaway OfflineAudioContext (so nothing is actually heard) and resolves with its
   rendered samples, letting a one-off check the peak/RMS level for clipping and
   loudness balance. Swaps the module's audio graph for the offline one just for the
   call, then restores it. Goes through sfx() (not SFX[name] directly) so SFX_TRIM is
   applied exactly as it would be in play. */
function renderCueOffline(name,dur){
  const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const ctx=new OAC(1,Math.max(1,Math.ceil(44100*(dur||1))),44100);
  const prevAG=AG, prevMuted=S.muted;
  AG=buildAudioGraph(ctx); S.muted=false;
  try{ sfx(name) } finally { /* restore is queued below, after render */ }
  return ctx.startRendering().then(buf=>{ AG=prevAG; S.muted=prevMuted; return buf.getChannelData(0) },
    err=>{ AG=prevAG; S.muted=prevMuted; throw err });
}

