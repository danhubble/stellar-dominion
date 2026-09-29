/* ============================ planet bodies ============================ */
/* Painted planets for drawSysScene(): every system type gets its own procedural
   surface (ocean+continents+clouds for home, cratered ore/rock, banded gas, cracked
   ice, glowing-vein void, dusty-blue belt), sunlit from the upper left with a soft
   atmosphere rim, turning slowly.

   Cost model: the surface is generated ONCE per (kind, variant) as an equirect
   texture (384x192, 3D value noise so it has no seam), then each frame only maps that
   texture onto the disc with a per-radius cache of lighting (lit, rim, specular), so
   a frame is one pass over the disc pixels with no noise maths. The other systems of
   the same kind get one of 3 variants (seed shift) keyed off their id, so a second
   ore world does not look like a copy of the first. Textures are pre-warmed one per
   tick shortly after boot so the first visit to a kind does not hitch; anything not
   warmed yet is built on demand. Light comes from the upper left to agree with the
   LIGHTS city-light field in 13-sky.js, which sits on the lower right (night) side. */
const PLANETS=(()=>{
  const TW=384, TH=192, TILT=.25, TAU=6.283185307179586;
  const KEY={mixed:"home",home:"home",ore:"ore",rock:"rock",gas:"gas",belt:"belt",ice:"ice",void:"void"};
  const ATMO={home:[90,170,255],ore:[255,150,80],rock:[200,180,150],belt:[143,184,255],
              gas:[255,210,130],ice:[150,215,255],void:[168,120,255]};
  const SEED={home:3.1,ore:7.7,rock:11.3,belt:4.6,gas:2.2,ice:5.5,void:9.4};
  let RM=false; try{ RM=matchMedia("(prefers-reduced-motion:reduce)").matches }catch(e){}

  const Lg=(()=>{const x=-.85,y=-.3,z=.3,m=Math.hypot(x,y,z);return[x/m,y/m,z/m]})();
  const Hg=(()=>{const x=Lg[0],y=Lg[1],z=Lg[2]+1,m=Math.hypot(x,y,z);return[x/m,y/m,z/m]})();

  /* ---- noise ---- */
  const sm=t=>t*t*(3-2*t);
  const cl=(v,a=0,b=1)=>v<a?a:v>b?b:v;
  const ss=(a,b,x)=>sm(cl((x-a)/(b-a)));
  function h3(x,y,z){
    let n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1440662683))|0;
    n=Math.imul(n^(n>>>13),1274126177); n^=n>>>16; return (n>>>0)/4294967295 }
  function noise(x,y,z){
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const fx=sm(x-ix),fy=sm(y-iy),fz=sm(z-iz);
    const c000=h3(ix,iy,iz),c100=h3(ix+1,iy,iz),c010=h3(ix,iy+1,iz),c110=h3(ix+1,iy+1,iz),
          c001=h3(ix,iy,iz+1),c101=h3(ix+1,iy,iz+1),c011=h3(ix,iy+1,iz+1),c111=h3(ix+1,iy+1,iz+1);
    const x00=c000+(c100-c000)*fx,x10=c010+(c110-c010)*fx,x01=c001+(c101-c001)*fx,x11=c011+(c111-c011)*fx;
    const y0=x00+(x10-x00)*fy,y1=x01+(x11-x01)*fy; return y0+(y1-y0)*fz }
  function fbm(x,y,z,o){
    let v=0,a=.5,f=1; for(let i=0;i<o;i++){ v+=a*noise(x*f,y*f,z*f); f*=2.03; a*=.5 } return v/.97 }
  const mixc=(a,b,t,o)=>{o[0]=a[0]+(b[0]-a[0])*t;o[1]=a[1]+(b[1]-a[1])*t;o[2]=a[2]+(b[2]-a[2])*t};

  /* ---- surface recipes: fill o=[r,g,b,spec(0..1),emiR,emiG,emiB] ---- */
  const O=new Float64Array(7), T=new Float64Array(3);
  function surf(kind,x,y,z,sd){
    O[3]=0;O[4]=0;O[5]=0;O[6]=0;
    if(kind==="home"){
      const h=fbm(x*2+sd,y*2,z*2,5);
      if(h<.5){ mixc([8,34,100],[28,108,170],ss(.25,.5,h),O); O[3]=.7 }
      else{ mixc([46,120,68],[140,120,76],ss(.5,.68,h),O);
        const pole=Math.abs(y)>.86||h>.72;
        if(pole){ const a=ss(.86,.94,Math.abs(y)); mixc(O,[236,242,250],a,O) } }
    }else if(kind==="ore"){
      const h=fbm(x*3+sd,y*3,z*3,5), r=1-Math.abs(2*fbm(x*5+sd,y*5,z*5,3)-1);
      mixc([70,34,22],[214,140,74],h,O); mixc(O,[40,18,12],ss(.86,.97,r)*.6,O);
    }else if(kind==="rock"||kind==="belt"){
      const h=fbm(x*4+sd,y*4,z*4,6), r=1-Math.abs(2*fbm(x*7+sd,y*7,z*7,3)-1);
      if(kind==="rock") mixc([88,78,70],[196,182,160],h,O); else mixc([62,72,96],[168,188,220],h,O);
      mixc(O,kind==="rock"?[50,44,40]:[30,36,54],ss(.82,.96,r)*.55,O);
    }else if(kind==="gas"){
      const w=fbm(x*1.2+sd,y*4,z*1.2,4), band=Math.sin(y*13+w*4.5)*.5+.5;
      mixc([160,98,44],[250,216,150],band,O);
      const b2=fbm(x*3+sd,y*14,z*3,3); mixc(O,[120,70,34],ss(.55,.75,b2)*.3,O);
    }else if(kind==="ice"){
      const h=fbm(x*2.5+sd,y*2.5,z*2.5,5), r=1-Math.abs(2*fbm(x*4.2+sd,y*4.2,z*4.2,3)-1);
      mixc([150,200,232],[244,250,255],h,O); mixc(O,[64,122,178],ss(.88,.98,r)*.8,O); O[3]=.35;
    }else{  /* void */
      const h=fbm(x*2.6+sd,y*2.6,z*2.6,5), r=1-Math.abs(2*fbm(x*3.4+sd,y*3.4,z*3.4,4)-1);
      mixc([16,9,30],[44,24,78],h,O); const v=ss(.84,.985,r);
      O[4]=168*v*1.15; O[5]=110*v*1.1; O[6]=255*v;
    }
  }

  /* ---- texture per kind+variant ----
     Built in ~5ms slices (setTimeout between them) so no frame ever waits on it;
     draw() shows a plain lit sphere until .ready flips. */
  const TEX={}, QUEUE=[]; let working=false;
  function newTex(kind,variant){
    return{kind,variant,sd:SEED[kind]+variant*13.7,v:0,ready:false,
      rgb:new Uint8Array(TW*TH*3),spc:new Uint8Array(TW*TH),
      emi:kind==="void"?new Uint8Array(TW*TH*3):null,
      cloud:kind==="home"?new Uint8Array(TW*TH):null,city:new Uint8Array(TW*TH)};
  }
  function slice(tx){
    const t0=performance.now(), sd=tx.sd, kind=tx.kind;
    while(tx.v<TH && performance.now()-t0<5){
      const v=tx.v++, lat=((v+.5)/TH-.5)*Math.PI, sy=Math.sin(lat), c=Math.cos(lat);
      for(let u=0;u<TW;u++){
        const lon=((u+.5)/TW)*TAU-Math.PI, x=c*Math.sin(lon), z=c*Math.cos(lon);
        surf(kind,x,sy,z,sd);
        const i=v*TW+u, j=i*3;
        tx.rgb[j]=O[0]; tx.rgb[j+1]=O[1]; tx.rgb[j+2]=O[2]; tx.spc[i]=O[3]*255;
        if(tx.emi){ tx.emi[j]=O[4]; tx.emi[j+1]=O[5]; tx.emi[j+2]=O[6] }
        if(tx.cloud) tx.cloud[i]=ss(.5,.72,fbm(x*3.1+sd+10,sy*3.1,z*3.1,5))*.88*255;
        /* city density: big clustered regions plus per-texel grain so lights read
           as specks, not a smooth wash. Home builds on land only. Higher = lit sooner. */
        if(!(kind==="home"&&O[3]>0)){
          const big=fbm(x*3.3+sd+40,sy*3.3,z*3.3,4), mid=fbm(x*9+sd+70,sy*9,z*9,3);
          const cv=big*.62+mid*.28+h3(u,v,(sd*100)|0)*.22-.1*Math.abs(sy);
          tx.city[i]=Math.max(1,cl(cv)*255);
        }
      }
    }
    if(tx.v>=TH){
      /* turn city density into a percentile of the habitable surface, so "fill" below
         is simply the share of it that is lit */
      const hist=new Float64Array(256); let n=0;
      for(let i=0;i<tx.city.length;i++){ const c=tx.city[i]; if(c){ hist[c]++; n++ } }
      const map=new Uint8Array(256); let acc=0;
      for(let c=1;c<256;c++){ acc+=hist[c]; map[c]=1+Math.round(254*acc/Math.max(1,n)) }
      for(let i=0;i<tx.city.length;i++){ const c=tx.city[i]; if(c)tx.city[i]=map[c] }
      tx.ready=true; working=false; pump() } else setTimeout(()=>slice(tx),0);
  }
  function pump(){
    if(working||!QUEUE.length)return;
    working=true; const tx=QUEUE.shift(); setTimeout(()=>slice(tx),0);
  }
  function getTex(kind,variant){
    const k=kind+variant;
    if(!TEX[k]){ TEX[k]=newTex(kind,variant); QUEUE.unshift(TEX[k]); pump() }
    return TEX[k];
  }

  /* ---- per-radius lighting cache ---- */
  const BODY={}; let bodyCount=0;
  function buildBody(kind,Rp){
    const N=2*Rp+2, c=Rp+1, a=ATMO[kind];
    const cv=document.createElement("canvas"); cv.width=cv.height=N;
    const ctx=cv.getContext("2d"), img=ctx.createImageData(N,N);
    const cs=Math.cos(TILT), sn=Math.sin(TILT);
    const off=[],u0=[],row=[],lit=[],ar=[],ag=[],ab=[],sp=[];
    for(let py=0;py<N;py++)for(let px=0;px<N;px++){
      const nx=(px+.5-c)/Rp, ny=(py+.5-c)/Rp, r2=nx*nx+ny*ny;
      if(r2>1)continue;
      const nz=Math.sqrt(1-r2), dist=Math.sqrt(r2);
      const y2=ny*cs-nz*sn, z2=ny*sn+nz*cs;
      const dl=nx*Lg[0]+ny*Lg[1]+nz*Lg[2], lt=ss(-.12,.55,dl);
      const fres=Math.pow(1-nz,2.4)*(.22+.95*lt)*.85;
      const dh=Math.max(0,nx*Hg[0]+ny*Hg[1]+nz*Hg[2]);
      off.push((py*N+px)*4);
      u0.push((Math.atan2(nx,z2)+Math.PI)/TAU);
      row.push(Math.min(TH-1,Math.max(0,Math.floor((Math.asin(cl(y2,-1,1))/Math.PI+.5)*TH)))*TW);
      lit.push(lt); ar.push(a[0]*fres); ag.push(a[1]*fres); ab.push(a[2]*fres);
      sp.push(Math.pow(dh,40)*lt);
      img.data[(py*N+px)*4+3]=255*cl((1-dist)*Rp/1.4);
    }
    return{cv,ctx,img,N,c,n:off.length,
      off:Int32Array.from(off),u0:Float32Array.from(u0),row:Int32Array.from(row),
      lit:Float32Array.from(lit),ar:Float32Array.from(ar),ag:Float32Array.from(ag),
      ab:Float32Array.from(ab),sp:Float32Array.from(sp)};
  }
  function getBody(kind,Rp){
    const k=kind+":"+Rp;
    if(!BODY[k]){ if(bodyCount>10){ for(const q in BODY)delete BODY[q]; bodyCount=0 }
      BODY[k]=buildBody(kind,Rp); bodyCount++ }
    return BODY[k];
  }

  function vhash(s){ let h=0; s=String(s); for(let i=0;i<s.length;i++)h=(Math.imul(h,31)+s.charCodeAt(i))|0; return Math.abs(h) }

  /* g: canvas context; (cx,cy,R) the disc in that context's pixels; t: ms clock;
     kindRaw: the system's kind (evs.kind, or undefined/"home" for home); vid: system id. */
  function draw(g,cx,cy,R,t,kindRaw,vid,total){
    const kind=KEY[kindRaw]||"home", variant=kind==="home"?0:vhash(vid)%3;
    const tex=getTex(kind,variant), a=ATMO[kind];
    /* atmosphere glow behind the disc */
    const gg=g.createRadialGradient(cx,cy,R*.9,cx,cy,R*1.42);
    gg.addColorStop(0,"rgba("+a[0]+","+a[1]+","+a[2]+",.26)"); gg.addColorStop(1,"rgba("+a[0]+","+a[1]+","+a[2]+",0)");
    g.fillStyle=gg; g.fillRect(cx-R*1.45,cy-R*1.45,R*2.9,R*2.9);
    if(!tex.ready){   /* texture still being built: a plain lit sphere in the atmosphere colour */
      const pg=g.createRadialGradient(cx-R*.45,cy-R*.5,R*.08,cx,cy,R*1.05);
      pg.addColorStop(0,"rgb("+Math.min(255,a[0]+60)+","+Math.min(255,a[1]+60)+","+Math.min(255,a[2]+60)+")");
      pg.addColorStop(.45,"rgb("+(a[0]*.55|0)+","+(a[1]*.55|0)+","+(a[2]*.55|0)+")"); pg.addColorStop(1,"#070a1c");
      g.fillStyle=pg; g.beginPath(); g.arc(cx,cy,R,0,TAU); g.fill(); return }
    const Rp=Math.max(6,Math.round(R)), B=getBody(kind,Rp);
    const rot=RM?0:(t/150000)%1, d=B.img.data, rgb=tex.rgb, spc=tex.spc, emi=tex.emi, cloud=tex.cloud, city=tex.city;
    /* how much of the planet is built up: 0 with nothing built, easing towards about
       half the habitable surface late in the game. Densest areas light first. */
    const fill=(total>0?.02:0)+.36*(1-Math.exp(-(total||0)/70)), th=1-fill, lc=CITY_COL[kind];
    const flick=RM?1:.93+.07*Math.sin(t/1300);
    const cRot=RM?0:rot*1.15;
    for(let k=0;k<B.n;k++){
      let u=B.u0[k]-rot; u-=Math.floor(u);
      const x=u*TW, xi=x|0, f=x-xi, x2=xi+1>=TW?0:xi+1, ro=B.row[k];
      const i1=ro+xi, i2=ro+x2, b1=i1*3, b2=i2*3, lt=B.lit[k];
      let r=rgb[b1]+(rgb[b2]-rgb[b1])*f, gr=rgb[b1+1]+(rgb[b2+1]-rgb[b1+1])*f, bl=rgb[b1+2]+(rgb[b2+2]-rgb[b1+2])*f;
      let s=spc[i1]/255, ca=0;
      if(cloud){ let cu=B.u0[k]-cRot; cu-=Math.floor(cu);
        ca=cloud[ro+((cu*TW)|0)]/255;
        r+=(244-r)*ca; gr+=(247-gr)*ca; bl+=(255-bl)*ca; s*=1-ca }
      const em=1-.35*lt, l1=.05+1.02*lt, l2=.07+1.02*lt, sv=255*B.sp[k]*s;
      let er=0,eg=0,eb=0; if(emi){ er=emi[b1]*em; eg=emi[b1+1]*em; eb=emi[b1+2]*em }
      if(fill>0){
        const cvv=city[i1]/255;
        if(cvv>th){
          const a=ss(th,th+.06,cvv)*(1-ca*.75);
          const night=1-ss(.05,.45,lt);
          r+=(150-r)*a*.3*lt; gr+=(150-gr)*a*.3*lt; bl+=(158-bl)*a*.3*lt;   /* grey sprawl by day */
          /* specks, not paint: each texel gets its own brightness, and the densest
             cores burn brighter than the fringe */
          const hb=h3(xi,ro,5), core=ss(th,1,cvv);
          const e=a*night*flick*(hb*hb*.9+.1)*(.55+.9*core);
          er+=lc[0]*e; eg+=lc[1]*e; eb+=lc[2]*e;                           /* lights by night */
        }
      }
      const o=B.off[k];
      d[o]=r*l1+er+B.ar[k]+sv; d[o+1]=gr*l1+eg+B.ag[k]+sv; d[o+2]=bl*l2+eb+B.ab[k]+sv;
    }
    B.ctx.putImageData(B.img,0,0);
    const s=R/Rp; g.drawImage(B.cv,cx-B.c*s,cy-B.c*s,B.N*s,B.N*s);
  }

  /* ---- city lights ----
     The texture's city channel is a fixed density map, so the same areas always light
     first and the glow spreads outward as the structure count rises, like a planet
     seen from orbit at night. Colour per kind: */
  const CITY_COL={home:[255,217,160],ore:[255,190,120],rock:[255,210,160],belt:[190,220,255],
                  gas:[255,226,150],ice:[190,230,255],void:[200,150,255]};

  /* pre-warm every kind (variant 0) in the background, one after another */
  const WARM=["home","ore","rock","gas","ice","void","belt"];
  setTimeout(()=>{ for(const k of WARM.slice().reverse())getTex(k,0) },1500);

  return{draw};
})();
