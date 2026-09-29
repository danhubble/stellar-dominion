/* ==================== site view: zoom into one structure ==================== */
/* backdrop kind + how the units are arranged + how many we bother drawing */
const SITE=[
 {bg:"belt",    lay:"field",   cap:80},
 {bg:"surface", lay:"field",   cap:54},
 {bg:"crust",   lay:"field",   cap:30, band:[0.00,0.42]},   /* derricks line the surface, shafts hang below */
 {bg:"floor",   lay:"field",   cap:54},
 {bg:"limb",    lay:"arc",     cap:60},
 {bg:"space",   lay:"scatter", cap:44},
 {bg:"star",    lay:"arc",     cap:84},
 {bg:"edge",    lay:"scatter", cap:32},
 {bg:"deep",    lay:"scatter", cap:26},
 {bg:"galaxy",  lay:"scatter", cap:22},
 {bg:"space",   lay:"scatter", cap:30},
 {bg:"limb",    lay:"arc",     cap:34},
 {bg:"edge",    lay:"scatter", cap:26},
 {bg:"deep",    lay:"scatter", cap:20}
];
let siteT0=0;
/* patch612: the old core-widget repaint call is gone with the widget itself -
   S.site's own toggle logic is untouched (Run 3/patch615 reuses it on the zoom
   canvas), just nothing left here to repaint a widget that no longer exists. */
function openSite(i){
  if(S.site===i){ S.site=null } else { S.site=i; siteT0=performance.now(); if(!S.core)S.core=1 }
  dirty=true; render(); save();
}
/* stable per-slot jitter so the field doesn't crawl between frames */
function srnd(k){ const x=Math.sin(k*127.1+311.7)*43758.5453; return x-Math.floor(x) }

function siteSlots(n,lay,X,Y,W,H,band){
  const L=[]; let u;
  if(lay==="arc"){
    const cx=X+W*0.5, cy=Y+H*1.42, rx=W*0.70, ry=H*1.02;
    const a0=Math.PI*1.14, a1=Math.PI*1.86;
    for(let k=0;k<n;k++){
      const f=n===1?0.5:k/(n-1), a=a0+(a1-a0)*f;
      L.push({x:cx+Math.cos(a)*rx, y:cy+Math.sin(a)*ry, s:1, a:a+1.5708});
    }
    const arc=(a1-a0)*((rx+ry)/2);
    u=Math.min(arc/Math.max(n,1)*1.25, Math.min(W,H)*0.30);
  } else if(lay==="scatter"){
    const cols=Math.max(1,Math.round(Math.sqrt(n*W/Math.max(H,1)))), rows=Math.ceil(n/cols);
    for(let k=0;k<n;k++){
      const c=k%cols, r=(k/cols)|0;
      L.push({x:X+W*((c+0.5)/cols)+(srnd(k)-0.5)*(W/cols)*0.42,
              y:Y+H*((r+0.5)/rows)+(srnd(k+99)-0.5)*(H/rows)*0.42,
              s:0.85+srnd(k+7)*0.28, a:0});
    }
    u=Math.min(W/cols*0.78, H/rows*0.78, Math.min(W,H)*0.30);
  } else {
    /* field: ranks receding from the horizon, newest (and ghosts) nearest the camera */
    const lo=band?band[0]:0.30, hi=band?band[1]:0.88;
    const rows=Math.max(1,Math.min(6,Math.round(Math.sqrt(n/2.6))));
    const per=Math.ceil(n/rows);
    for(let k=0;k<n;k++){
      const r=(k/per)|0, c=k%per;
      const d=rows===1?0.72:(r+1)/rows;                     /* 0 far .. 1 near */
      L.push({x:X+W*((c+0.5)/per)+(srnd(k)-0.5)*(W/per)*0.30,
              y:Y+H*(lo+(hi-lo)*d)+(srnd(k+31)-0.5)*H*0.014,
              s:0.66+0.34*d, a:0, d:d});
    }
    u=Math.min(W/per*0.88, H*(hi-lo)/rows*1.15, Math.min(W,H)*0.30);
  }
  L.u=Math.max(4,u);
  return L;
}
function siteBG(g,kind,t,X,Y,W,H,D,hz){
  const B=(a,b)=>{const gr=g.createLinearGradient(X,Y,X,Y+H);gr.addColorStop(0,a);gr.addColorStop(1,b);return gr};
  const stars=(n,frac)=>{ for(let k=0;k<n;k++){ g.globalAlpha=0.16+srnd(k+5)*0.5;
      g.fillStyle="#cfe4ff"; g.beginPath();
      g.arc(X+srnd(k)*W,Y+srnd(k+50)*H*(frac||1),(0.5+srnd(k+3)*0.8)*D,0,6.2832); g.fill() }
    g.globalAlpha=1 };
  g.save(); g.beginPath(); g.rect(X,Y,W,H); g.clip();

  if(kind==="belt"||kind==="space"||kind==="edge"||kind==="deep"){
    g.fillStyle=kind==="deep"?"#01020a":kind==="edge"?"#03040e":"#04060f"; g.fillRect(X,Y,W,H);
    stars(26);
    if(kind==="belt"){
      for(let k=0;k<7;k++){
        const rx=X+((srnd(k+11)*W+t*0.004*(0.3+srnd(k)*0.6))%(W*1.3))-W*0.15;
        const ry=Y+srnd(k+21)*H, rr=(5+srnd(k+31)*11)*D;
        g.fillStyle="rgba(70,84,120,.34)"; g.beginPath();
        g.ellipse(rx,ry,rr,rr*0.74,srnd(k+41)*3,0,6.2832); g.fill();
        g.fillStyle="rgba(150,175,225,.12)"; g.beginPath();
        g.ellipse(rx-rr*0.25,ry-rr*0.25,rr*0.5,rr*0.36,srnd(k+41)*3,0,6.2832); g.fill();
      }
    }
    if(kind==="edge"){
      g.strokeStyle="rgba(255,143,208,.22)"; g.lineWidth=2.5*D;
      g.beginPath(); g.ellipse(X+W*0.5,Y-H*0.55,W*0.95,H*1.2,0,0,6.2832); g.stroke();
    }
    if(kind==="deep"){
      for(let k=0;k<3;k++){ g.globalAlpha=.10; g.fillStyle="#9fb4ff";
        g.beginPath(); g.ellipse(X+srnd(k+80)*W,Y+srnd(k+90)*H,W*0.09,W*0.03,srnd(k)*3,0,6.2832);
        g.fill() } g.globalAlpha=1;
    }
  }
  else if(kind==="surface"){
    g.fillStyle=B("#0b1636","#2a1d33"); g.fillRect(X,Y,W,hz-Y);
    stars(14,(hz-Y)/H);
    g.fillStyle="rgba(50,36,56,.96)"; g.beginPath(); g.moveTo(X,hz);
    for(let k=0;k<=10;k++)g.lineTo(X+W*k/10, hz+Math.sin(k*1.7)*H*0.012);
    g.lineTo(X+W,Y+H); g.lineTo(X,Y+H); g.closePath(); g.fill();
    g.strokeStyle="rgba(255,180,92,.16)"; g.lineWidth=1.2*D;
    g.beginPath(); g.moveTo(X,hz); g.lineTo(X+W,hz); g.stroke();
  }
  else if(kind==="crust"){
    g.fillStyle=B("#0a1230","#132043"); g.fillRect(X,Y,W,hz-Y);
    stars(10,(hz-Y)/H);
    const bands=["#3d2c25","#31231a","#261b15","#1c140f"], bh=(Y+H-hz)/4;
    for(let k=0;k<4;k++){ g.fillStyle=bands[k]; g.fillRect(X,hz+k*bh,W,bh+1);
      g.strokeStyle="rgba(0,0,0,.25)"; g.lineWidth=D;
      g.beginPath(); g.moveTo(X,hz+k*bh); g.lineTo(X+W,hz+k*bh); g.stroke(); }
    g.strokeStyle="rgba(255,209,102,.26)"; g.lineWidth=1.4*D;
    g.beginPath(); g.moveTo(X,hz); g.lineTo(X+W,hz); g.stroke();
  }
  else if(kind==="floor"){
    g.fillStyle=B("#070c22","#0e1533"); g.fillRect(X,Y,W,H);
    const vpx=X+W*0.5, vpy=hz-(Y+H-hz)*0.30;    /* vanishing point above the horizon */
    g.strokeStyle="rgba(96,142,255,.14)"; g.lineWidth=D;
    for(let k=0;k<=10;k++){                       /* rails converging on the vanishing point */
      g.beginPath(); g.moveTo(vpx+(k/10-0.5)*W*0.18, hz);
      g.lineTo(X+(k/10)*W*2.2-W*0.6, Y+H); g.stroke(); }
    for(let k=1;k<=6;k++){                        /* sleepers, spaced by perspective */
      const f=k/6, yy=hz+(Y+H-hz)*(f*f*0.92+0.06);
      g.beginPath(); g.moveTo(X,yy); g.lineTo(X+W,yy); g.stroke(); }
    g.strokeStyle="rgba(96,142,255,.30)"; g.lineWidth=1.3*D;
    g.beginPath(); g.moveTo(X,hz); g.lineTo(X+W,hz); g.stroke();
  }
  else if(kind==="limb"){
    g.fillStyle="#04060f"; g.fillRect(X,Y,W,H); stars(18,.6);
    const cy=Y+H*2.15, rr=H*1.55;
    const gr=g.createRadialGradient(X+W*0.4,cy-rr*0.25,rr*0.2,X+W*0.5,cy,rr);
    gr.addColorStop(0,"#4d8bf0"); gr.addColorStop(.6,"#1d3f8f"); gr.addColorStop(1,"#0a1236");
    g.fillStyle=gr; g.beginPath(); g.arc(X+W*0.5,cy,rr,0,6.2832); g.fill();
    g.strokeStyle="rgba(150,215,255,.55)"; g.lineWidth=1.4*D; g.stroke();
    g.strokeStyle="rgba(110,200,255,.16)"; g.lineWidth=7*D;
    g.beginPath(); g.arc(X+W*0.5,cy,rr+4*D,0,6.2832); g.stroke();
  }
  else if(kind==="star"){
    g.fillStyle="#06040c"; g.fillRect(X,Y,W,H);
    const sx0=X-W*0.20, sy0=Y+H*0.5, sr=H*0.58;
    const gr=g.createRadialGradient(sx0,sy0,sr*0.2,sx0,sy0,sr*2.4);
    gr.addColorStop(0,"rgba(255,232,160,.9)"); gr.addColorStop(.28,"rgba(255,170,60,.45)");
    gr.addColorStop(1,"rgba(255,120,30,0)");
    g.fillStyle=gr; g.beginPath(); g.arc(sx0,sy0,sr*2.4,0,6.2832); g.fill();
    g.fillStyle="#ffe9a8"; g.beginPath();
    g.arc(sx0,sy0,sr*(1+0.012*Math.sin(t/420)),0,6.2832); g.fill();
  }
  else if(kind==="galaxy"){
    g.fillStyle="#02030b"; g.fillRect(X,Y,W,H); stars(20);
    g.save(); g.translate(X+W*0.5,Y+H*0.52); g.rotate(t/40000);
    for(let arm=0;arm<2;arm++){
      g.rotate(Math.PI);
      g.strokeStyle="rgba(255,143,208,.13)"; g.lineWidth=3.2*D;
      g.beginPath();
      for(let k=0;k<90;k++){ const th=k/90*3.5, rr=H*0.055*Math.exp(0.34*th);
        const px=Math.cos(th)*rr, py=Math.sin(th)*rr*0.46; k?g.lineTo(px,py):g.moveTo(px,py) }
      g.stroke();
    }
    const cg=g.createRadialGradient(0,0,0,0,0,H*0.22);
    cg.addColorStop(0,"rgba(255,236,214,.34)"); cg.addColorStop(1,"rgba(255,180,140,0)");
    g.fillStyle=cg; g.beginPath(); g.ellipse(0,0,H*0.22,H*0.12,0,0,6.2832); g.fill();
    g.restore();
  }
  g.restore();
}

/* Ghosts are deliberately generic: one silhouette for every tier, so "not built yet"
   reads instantly instead of looking like a broken version of the real thing. */
function siteGhost(g,o,u,t,k,col,D,first){
  g.save(); g.translate(o.x,o.y);
  g.globalAlpha=0.30+0.16*Math.sin(t/300+k*0.9);
  g.strokeStyle=col; g.lineWidth=Math.max(1,u*0.075);
  g.setLineDash([u*0.17,u*0.13]);
  const r=u*0.42;
  g.beginPath();
  for(let q=0;q<6;q++){ const a=q*1.0472-0.5236;
    const px=Math.cos(a)*r, py=Math.sin(a)*r*0.86; q?g.lineTo(px,py):g.moveTo(px,py) }
  g.closePath(); g.stroke();
  g.setLineDash([]);
  g.lineWidth=Math.max(1,u*0.07);
  g.beginPath(); g.moveTo(-r*0.34,0); g.lineTo(r*0.34,0);
  g.moveTo(0,-r*0.34); g.lineTo(0,r*0.34); g.stroke();
  g.restore(); g.globalAlpha=1;
}

/* one built (or ghosted) structure */
function siteUnit(g,i,o,u,t,k,col,D,ground){
  g.save(); g.translate(o.x,o.y);
  if(ground)g.translate(0,-u*0.02);
  if(o.a)g.rotate(o.a);
  g.lineWidth=Math.max(1,u*0.11);
  g.strokeStyle=col; g.fillStyle=col;
  const bob=Math.sin(t/620+k*1.7)*u*0.05;
  const A=a=>{g.globalAlpha=a};
  switch(i){
    case 0:{ /* mining drone: hull, side pods, cutting beam */
      g.translate(0,bob);
      g.beginPath(); g.moveTo(0,-u*0.50); g.lineTo(u*0.38,-u*0.10);
      g.lineTo(u*0.27,u*0.38); g.lineTo(-u*0.27,u*0.38); g.lineTo(-u*0.38,-u*0.10);
      g.closePath(); g.fill();
      A(.7); g.beginPath(); g.ellipse(-u*0.55,0,u*0.13,u*0.26,0,0,6.2832); g.fill();
      g.beginPath(); g.ellipse(u*0.55,0,u*0.13,u*0.26,0,0,6.2832); g.fill();
      A(0.25+0.35*Math.abs(Math.sin(t/300+k)));
      g.lineWidth=Math.max(1,u*0.08);
      g.beginPath(); g.moveTo(0,u*0.38); g.lineTo(u*0.08,u*0.92); g.stroke();
      break; }
    case 1:{ /* smelter pod: drum + stack + flare, standing on the ground */
      A(.9); g.fillRect(-u*0.46,-u*0.46,u*0.92,u*0.46);          /* drum */
      A(.55); g.fillRect(-u*0.46,-u*0.30,u*0.92,u*0.05);          /* band */
      A(.75); g.fillRect(-u*0.34,-u*0.70,u*0.24,u*0.24);          /* cracking head */
      A(.8);  g.fillRect(u*0.16,-u*1.00,u*0.15,u*0.54);           /* flare stack */
      A(.8);  g.fillRect(u*0.00,-u*0.78,u*0.11,u*0.32);           /* short stack */
      const fl=0.6+0.4*Math.abs(Math.sin(t/210+k));
      A(fl); g.fillStyle="#ffb45c"; g.beginPath();
      g.ellipse(u*0.235,-u*(1.04+0.07*fl),u*0.085,u*0.16*fl,0,0,6.2832); g.fill();
      A(.30); g.beginPath(); g.ellipse(0,0,u*0.62,u*0.10,0,0,6.2832); g.fill();  /* heat pool */
      g.fillStyle=col;
      break; }
    case 2:{ /* crust borer: an open derrick on the surface, shaft driven into the strata */
      g.lineWidth=Math.max(1,u*0.075);
      A(.95);                                        /* derrick frame, drawn open so it reads as rigging */
      g.beginPath(); g.moveTo(-u*0.30,0); g.lineTo(-u*0.09,-u*0.86);
      g.lineTo(u*0.09,-u*0.86); g.lineTo(u*0.30,0); g.stroke();
      A(.55);
      g.beginPath();
      g.moveTo(-u*0.235,-u*0.24); g.lineTo(u*0.235,-u*0.24);
      g.moveTo(-u*0.17,-u*0.50);  g.lineTo(u*0.17,-u*0.50);
      g.moveTo(-u*0.30,0);        g.lineTo(u*0.09,-u*0.86);
      g.moveTo(u*0.30,0);         g.lineTo(-u*0.09,-u*0.86); g.stroke();
      A(.9); g.fillRect(-u*0.13,-u*1.00,u*0.26,u*0.16);      /* crown block */
      const dp=Math.abs(Math.sin(t/430+k))*u*0.26;
      A(.75); g.fillRect(-u*0.045,0,u*0.09,u*1.05+dp);        /* drill string */
      A(1);                                                     /* bit */
      g.beginPath(); g.moveTo(-u*0.15,u*1.05+dp); g.lineTo(u*0.15,u*1.05+dp);
      g.lineTo(0,u*1.36+dp); g.closePath(); g.fill();
      A(.30); g.fillRect(-u*0.34,-u*0.06,u*0.68,u*0.09);       /* rig deck */
      break; }
    case 3:{ /* fabricator: gantry with a travelling print head */
      A(.9); g.fillRect(-u*0.52,-u*0.62,u*1.04,u*0.12);
      A(.6); g.fillRect(-u*0.52,-u*0.50,u*0.10,u*0.50);
      g.fillRect(u*0.42,-u*0.50,u*0.10,u*0.50);
      A(1); g.fillRect(Math.sin(t/700+k)*u*0.32-u*0.11,-u*0.50,u*0.22,u*0.20);
      A(.42); g.fillRect(-u*0.32,-u*0.14,u*0.64,u*0.14);
      break; }
    case 4:{ /* orbital harvester: ring segment with an intake scoop */
      A(.95); g.fillRect(-u*0.52,-u*0.18,u*1.04,u*0.36);
      A(.45); g.beginPath(); g.moveTo(-u*0.30,-u*0.18); g.lineTo(-u*0.46,-u*0.74);
      g.lineTo(u*0.46,-u*0.74); g.lineTo(u*0.30,-u*0.18); g.closePath(); g.fill();
      A(.7); g.fillStyle="#04060f"; g.fillRect(-u*0.16,-u*0.10,u*0.32,u*0.20); g.fillStyle=col;
      A(.55); g.fillRect(-u*0.36,u*0.18,u*0.72,u*0.09);
      break; }
    case 5:{ /* fusion forge: magnetic bottle around a hot core */
      const gr=g.createRadialGradient(0,0,u*0.04,0,0,u*0.80);
      gr.addColorStop(0,"rgba(255,240,190,.9)"); gr.addColorStop(.4,"rgba(255,170,70,.38)");
      gr.addColorStop(1,"rgba(255,140,40,0)");
      g.fillStyle=gr; g.beginPath(); g.arc(0,0,u*0.80,0,6.2832); g.fill();
      g.fillStyle=col;
      g.beginPath(); g.arc(0,0,u*0.22*(1+0.06*Math.sin(t/240+k)),0,6.2832); g.fill();
      A(.85); g.lineWidth=Math.max(1,u*0.055);
      for(let a=0;a<3;a++){ g.beginPath();
        g.ellipse(0,0,u*0.56,u*0.20,a*1.047+t/2600,0,6.2832); g.stroke() }
      break; }
    case 6:{ /* dyson panel: tilted collector on a strut */
      g.rotate(-0.5+srnd(k)*0.4);
      const gr=g.createLinearGradient(-u*0.52,0,u*0.52,0);
      gr.addColorStop(0,"rgba(255,226,150,.95)"); gr.addColorStop(1,"rgba(120,90,40,.7)");
      g.fillStyle=gr; g.fillRect(-u*0.52,-u*0.24,u*1.04,u*0.48); g.fillStyle=col;
      A(.8); g.lineWidth=Math.max(1,u*0.05);
      g.beginPath(); g.moveTo(-u*0.52,0); g.lineTo(u*0.52,0);
      g.moveTo(0,-u*0.24); g.lineTo(0,u*0.24); g.stroke();
      break; }
    case 7:{ /* wormhole crucible: brackets holding an open throat */
      A(.9); g.lineWidth=Math.max(1,u*0.085);
      g.beginPath(); g.moveTo(-u*0.50,-u*0.52); g.lineTo(-u*0.50,u*0.52);
      g.moveTo(u*0.50,-u*0.52); g.lineTo(u*0.50,u*0.52); g.stroke();
      g.lineWidth=Math.max(1,u*0.06);
      for(let r=0;r<3;r++){ const ph=((t/900+r*0.9)%3)/3;
        A((1-ph)*0.8);
        g.beginPath(); g.ellipse(0,0,u*0.30*(0.45+ph),u*0.50*(0.45+ph),0,0,6.2832); g.stroke() }
      A(1); g.beginPath(); g.ellipse(0,0,u*0.10,u*0.20,0,0,6.2832); g.fill();
      break; }
    case 8:{ /* singularity well: accretion disc around a dark core */
      const gr=g.createLinearGradient(-u*0.7,0,u*0.7,0);
      gr.addColorStop(0,"rgba(120,60,255,.18)"); gr.addColorStop(.5,"rgba(255,200,120,.85)");
      gr.addColorStop(1,"rgba(120,60,255,.18)");
      g.fillStyle=gr; g.beginPath();
      g.ellipse(0,0,u*0.70,u*0.22,0.28+0.10*Math.sin(t/3400+k),0,6.2832); g.fill();
      g.fillStyle="#02030a"; g.beginPath(); g.arc(0,0,u*0.25,0,6.2832); g.fill();
      g.fillStyle=col; A(.9); g.lineWidth=Math.max(1,u*0.055);
      g.beginPath(); g.arc(0,0,u*0.34,0,6.2832); g.stroke();
      break; }
    default:{ /* galactic nexus: a bound spiral */
      g.lineWidth=Math.max(1,u*0.075);
      g.save(); g.rotate(t/6000+k); A(.9);
      for(let arm=0;arm<2;arm++){ g.rotate(Math.PI); g.beginPath();
        for(let q=0;q<26;q++){ const th=q/26*3.0, rr=u*0.095*Math.exp(0.32*th);
          const px=Math.cos(th)*rr, py=Math.sin(th)*rr*0.5; q?g.lineTo(px,py):g.moveTo(px,py) }
        g.stroke() }
      g.restore();
      A(.35); g.lineWidth=Math.max(1,u*0.05);
      g.beginPath(); g.arc(0,0,u*0.46,0,6.2832); g.stroke();
      const hg=g.createRadialGradient(0,0,0,0,0,u*0.34);
      hg.addColorStop(0,"rgba(255,220,240,.9)"); hg.addColorStop(1,"rgba(255,143,208,0)");
      A(1); g.fillStyle=hg; g.beginPath(); g.arc(0,0,u*0.34,0,6.2832); g.fill();
      g.fillStyle=col; g.beginPath(); g.arc(0,0,u*0.11,0,6.2832); g.fill();
      break; }
  }
  g.restore(); g.globalAlpha=1;
}
function drawSite(g,CW,CH,t,D,sysId,gi){
  const i=gi, cfg=SITE[i], col=TCOL[i%TCOL.length];
  const padT=Math.round(CH*0.17), padB=Math.round(CH*(innerWidth<=760?0.13:0.05));
  const X=CW*0.03, Y=padT, W=CW*0.94, H=Math.max(12,CH-padT-padB);
  const ground = cfg.bg==="surface"||cfg.bg==="crust"||cfg.bg==="floor";
  const hz = ground ? Y+H*0.34 : Y;                 /* horizon: where the field starts */
  const fY = ground ? hz : Y, fH = ground ? (Y+H-hz) : H;

  g.clearRect(0,0,CW,CH);
  siteBG(g,cfg.bg,t,X,Y,W,H,D,hz);

  const built=sysTierCount(sysId,gi);
  /* "max" no longer resolves to a single number without a slot to price it against -
     this is a ghost-unit preview, already clamped to 4 below, so a flat guess reads the
     same on screen as the old figure did for every buy setting that matters visually */
  const want=S.buy==="max"?4:S.buy;
  const ghosts=Math.min(4,Math.max(1,want));
  const shown=Math.min(built,cfg.cap);
  const n=Math.min(cfg.cap+ghosts, shown+ghosts);
  const L=siteSlots(n,cfg.lay,X,fY,W,fH,cfg.band);
  const u0=L.u;

  const zoom=Math.min(1,(t-siteT0)/240);
  g.save();
  if(zoom<1){ g.translate(CW/2,CH/2); const z=0.88+0.12*zoom;
    g.scale(z,z); g.translate(-CW/2,-CH/2); g.globalAlpha=zoom }
  g.save(); g.beginPath(); g.rect(X,Y,W,H); g.clip();
  for(let k=0;k<L.length;k++){
    const o=L[k], u=u0*(o.s||1);
    if(k<shown) siteUnit(g,i,o,u,t,k,col,D,ground);
    else siteGhost(g,o,u,t,k,col,D,k===shown);
  }
  g.restore(); g.restore(); g.globalAlpha=1;

  if(built>cfg.cap){
    const txt="+"+fmt(built-cfg.cap)+" more";
    g.font="700 "+(7*D)+"px ui-monospace,monospace";
    g.textAlign="right"; g.textBaseline="bottom";
    g.globalAlpha=.55; g.fillStyle=col;
    g.fillText(txt, X+W-3*D, Y+H-2*D);
    g.globalAlpha=1; g.textAlign="left"; g.textBaseline="alphabetic";
  }
}

/* TUNING-PENDING: the Empire tab's #orb radius, per devicePixelRatio unit, at the
   mobile layout - #core is height:120px (minus its 1px border = 118 CSS px) at every
   width under the @media(max-width:760px) breakpoint, and R=Math.min(W*0.125,H*0.215)
   is always height-bound there (0.215*118 < 0.125*any plausible mobile width), so
   R===D*118*0.215 exactly. Sprite size below divides by this to turn "D*(...)" into
   an R-based formula that reproduces the OLD D-based one exactly at the Empire tab's
   own size, while scaling up for a bigger scene (the map zoom) - see patch604. */
const ORB_R0=118*0.215;
function drawSysScene(g,W,H,vid,t,D,compose){
  g.clearRect(0,0,W,H);
  /* compose (map-zoom only - the Empire tab call passes nothing, so cy/R below are
     its EXACT original expressions, untouched): {cy,bandH}. patch626: the map-zoom
     canvas is now a dedicated 34vh page header that nothing else ever overlaps (the
     old #sysSheet-overlap accounting - see mapZoomMeasure(), deleted this patch -
     no longer applies), so bandH is simply the canvas's own full height and cy its
     vertical centre; compose is still passed, not dropped, because the
     ladder-length R-cap just below still needs it. */
  const bandH=compose?compose.bandH:H;
  const cx=W/2, cy=compose?compose.cy:H*0.52, RY=0.55;
  let R=Math.min(W*0.125,bandH*0.215);
  ang+=0.0042;
  /* vid is the system id to draw (empViewSys(), falling back to "home"); reconstruct
     evs (null exactly when vid is the "home" fallback - empViewSys() never returns
     home itself) so the planet-colour fallback below matches the pre-refactor
     behaviour exactly, without the caller having to pass evs separately. */
  const evs=vid==="home"?null:SYSMAP[vid];
  const vc=gi=>sysTierCount(vid,gi);
  /* this system's own ladder - moved up from the orbit-lanes loop below (which still
     uses this same `ladder`, not a second lookup) so its LENGTH is available for the
     safety cap right here. */
  const ladder=sysLadder(vid);
  if(compose && ladder.length>1){
    /* zoom-only: cap R so the OUTERMOST possible lane - this system's full ladder,
       not just what is currently built, so the planet never visibly resizes the
       moment a new tier finishes - stays inside the visible band on both axes. Only
       home's 14-tier ore ladder ever actually binds this; every other kind is 3
       tiers and already comfortably inside the size above. */
    const maxRingMul=1.82+(ladder.length-1)*0.20;
    const hHalf=(W/2)*0.94, vHalf=Math.min(cy,bandH-cy)*0.94;
    R=Math.min(R, Math.min(hHalf,vHalf/RY)/maxRingMul);
  }

    // galactic backdrop (tier 10)
    if(vc(9)>0){
      g.save(); g.translate(cx,cy); g.rotate(t/26000);
      g.strokeStyle="rgba(255,143,208,.16)"; g.lineWidth=1.6*D;
      for(let arm=0;arm<2;arm++){
        g.rotate(Math.PI); g.beginPath();
        for(let k=0;k<70;k++){ const th=k/70*3.4, rr=R*0.9*Math.exp(0.30*th);
          const px=Math.cos(th)*rr, py=Math.sin(th)*rr*0.45;
          k?g.lineTo(px,py):g.moveTo(px,py); }
        g.stroke();
      }
      g.restore();
    }
    // wormhole portal (tier 8)
    if(vc(7)>0){
      const px=cx+Math.min(W,H)*0.36, py=cy-Math.min(W,H)*0.30;
      g.strokeStyle="rgba(176,124,255,.5)"; g.lineWidth=1.4*D;
      for(let k=0;k<3;k++){
        const ph=(t/900+k*0.9)%3, sc=1-ph/3;
        g.globalAlpha=Math.min(1,ph)*sc*0.9;
        g.beginPath(); g.ellipse(px,py,R*0.62*sc,R*0.30*sc,0.5,0,6.2832); g.stroke();
      }
      g.globalAlpha=1;
      g.fillStyle="rgba(215,108,255,.85)";
      g.beginPath(); g.arc(px,py,2.2*D,0,6.2832); g.fill();
    }

    // orbit lanes - iterate this system's own kind ladder, radius/size/angle keyed
    // to POSITION within that ladder (0..n-1), not the raw GENS index.
    const lanes=[];
    for(let pos=0;pos<ladder.length;pos++){
      const i=ladder[pos];
      if(vc(i)<1)continue;
      const rr=R*(1.82+pos*0.20);
      g.strokeStyle=rgba(TCOL[i%TCOL.length],.10); g.lineWidth=D;
      g.beginPath(); g.ellipse(cx,cy,rr,rr*RY,0,0,6.2832); g.stroke();
      const n=Math.min(9,vc(i));
      for(let k=0;k<n;k++){
        const a=ang*(1.5-pos*0.105)+k*(6.2832/n)+pos*1.13;
        /* R-based, not D-based - see ORB_R0 above. Exactly reproduces the old
           D*(2.1+pos*0.20) size at the Empire tab's own R, scales up cleanly for
           the much bigger map-zoom canvas. */
        lanes.push({i,a,x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr*RY,s:R*(2.1+pos*0.20)/ORB_R0});
      }
    }
    for(const o of lanes) if(Math.sin(o.a)<0) sprite(g,o,D);

    // planet
    const evKind=evs?(KIND_INFO[evs.kind]||KIND_INFO.mixed):null;
    /* the painted, lit, slowly turning body - see 13b-planets.js. It carries its own
       terminator and atmosphere, which replaced the flat gradient + continent
       ellipses + night-side overlay that used to be drawn here. */
    /* city lights spread over the surface with the system's structure count (replaced
       a screen-fixed field of night-side dots, LIGHTS in 13-sky.js) */
    PLANETS.draw(g,cx,cy,R,t,evs?evs.kind:"home",vid,ladder.reduce((sum,gi)=>sum+vc(gi),0));
    g.beginPath(); g.arc(cx,cy,R,0,6.2832);
    g.strokeStyle=evKind?rgba(evKind.col,.16):"rgba(150,215,255,.14)"; g.lineWidth=1.2*D; g.stroke();
    g.strokeStyle="rgba(110,200,255,.12)"; g.lineWidth=4*D;
    g.beginPath(); g.arc(cx,cy,R*1.10,0,6.2832); g.stroke();
    // orbital ring band (tier 5)
    if(vc(4)>0){
      g.strokeStyle="rgba(168,157,246,.75)"; g.lineWidth=2*D;
      g.beginPath(); g.ellipse(cx,cy,R*1.55,R*0.66,-0.30,0,6.2832); g.stroke();
    }
    // dyson shell (tier 7)
    if(vc(6)>0){
      g.save(); g.setLineDash([5*D,7*D]); g.lineDashOffset=-t/60;
      g.strokeStyle="rgba(255,209,102,.45)"; g.lineWidth=1.6*D;
      g.beginPath(); g.arc(cx,cy,R*1.28,0,6.2832); g.stroke(); g.restore();
    }
    for(const o of lanes) if(Math.sin(o.a)>=0) sprite(g,o,D);
}
function draw(t){
  if(BT){ requestAnimationFrame(draw); return }   /* battle overlay hides all of this */
  // starfield
  sx.clearRect(0,0,W,H);
  for(const s of stars){
    s.y+=s.z*.18*devicePixelRatio; if(s.y>H)s.y=-2;
    const a=(.35+.65*Math.abs(Math.sin(t/900+s.p)))*s.z;
    sx.globalAlpha=a; sx.fillStyle=s.z>.7?"#cfe4ff":"#8fb0ff";
    sx.beginPath(); sx.arc(s.x,s.y,s.r*devicePixelRatio*s.z,0,6.2832); sx.fill();
  }
  sx.globalAlpha=1;
  /* patch612: the #core/#orb "core scene" branch that used to sit here - the orb
     canvas resize check, drawSite()/drawSysScene() onto it, the pick-what-to-draw
     lookup - is gone with the widget itself. draw() now only ever paints the
     starfield (above) and the map-zoom canvas (below). */
  // ---------- map zoom scene (patch603) ----------
  if(mzx===null || (++mzChk%20===0 &&
      (MZW!==Math.round(mapZoomCv.clientWidth*devicePixelRatio)
    || MZH!==Math.round(mapZoomCv.clientHeight*devicePixelRatio)))) mapZoomResize();
  if(mzx&&MZW&&mapZoom){
    /* same entry-transition shape drawSite() already uses for its own zoom-in. Clear
       the FULL (untransformed) canvas first - drawSysScene()/drawSite() do their own
       clearRect too, but that one happens inside the scale below, so on its own it
       would only ever clear the shrunk sub-rect and leave a stale ring round the edge
       while zoom<1. This one is what actually keeps every frame clean. */
    mzx.clearRect(0,0,MZW,MZH);
    const zoom=Math.min(1,(t-mapZoomT0)/250);
    mzx.save();
    if(zoom<1){ mzx.translate(MZW/2,MZH/2); const z=0.88+0.12*zoom;
      mzx.scale(z,z); mzx.translate(-MZW/2,-MZH/2); mzx.globalAlpha=zoom }
    /* patch615: the site view, one system's one tier, replaces the planet on this
       same canvas while mapSite is set - see setMapZoom()/syncMapZoomBack() for how
       it's entered/left. */
    if(mapSite!=null){
      drawSite(mzx,MZW,MZH,t,devicePixelRatio,mapZoom,mapSite);
    } else {
      /* patch626: the whole canvas is always the visible band now - see
         drawSysScene()'s own comment. */
      drawSysScene(mzx,MZW,MZH,mapZoom,t,devicePixelRatio,{cy:MZH*0.5,bandH:MZH});
    }
    mzx.restore(); mzx.globalAlpha=1;
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

