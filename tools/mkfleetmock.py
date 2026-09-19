#!/usr/bin/env python3
"""mkfleetmock.py — throwaway runtime-injection mock for PLAN-fleets.md.

Reads dist/stellar-dominion.html (NEVER writes it) and writes
docs/mocks/fleets-mock.html = the same file plus one extra <style> and one
extra <script> injected right before </body>. No game logic is touched;
the injected script drives everything from window.__SD plus the handful of
bare globals (S, SYSMAP, sysInSec, showModal, toast, hideModal, $, ...) that
live in the same top-level script scope as the game itself, exactly the way
tests/*.js already poke the game in page.evaluate().

Mocks decisions 3, 5, 6 of docs/PLAN-fleets.md:
  3. numbered fleet markers on the map, per current sector, + travel line/marker
  5. FLEETS block in the system sheet (send/transfer) + Raids pane 1·2·3 tabs
  6. one mock threat on a held Frontier system, in the FLEETS block

Run: python3 tools/mkfleetmock.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dist", "stellar-dominion.html")
OUT = os.path.join(ROOT, "docs", "mocks", "fleets-mock.html")

STYLE = """
<style>
/* ---- fleets mock (throwaway, tools/mkfleetmock.py) ---- */
#mkFleetsBlock{margin:10px 0 4px}
#mkFleetsBlock .sechead{margin:0 0 8px}
.mk-threat{font:700 11px/1.4 ui-monospace,monospace;color:var(--rd);margin-bottom:6px}
.mk-defend{width:100%;border:1px solid rgba(255,107,138,.55);background:rgba(255,107,138,.12);
  color:var(--rd);border-radius:8px;padding:8px;font:800 11px/1 system-ui;letter-spacing:.08em;
  margin-bottom:10px;cursor:pointer}
.mk-defend:disabled{opacity:.45;color:var(--dim2);border-color:var(--line);
  background:rgba(255,255,255,.03);cursor:not-allowed}
.mk-empty{font-size:11px;color:var(--dim);margin-bottom:6px}
.mk-frow{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:11px}
.mk-frow:last-child{border-bottom:none}
.mk-fname{font-weight:700;min-width:62px;flex:none}
.mk-hulls{flex:1;color:var(--mut);font-family:ui-monospace,monospace;font-size:10px}
.mk-status{font-family:ui-monospace,monospace;font-size:10px;color:var(--dim2);flex:none}
button.mk-send{border:1px solid var(--line2);background:rgba(72,226,255,.09);color:var(--txt);
  border-radius:8px;padding:6px 8px;font:700 10px/1 ui-monospace,monospace;cursor:pointer;
  white-space:nowrap;flex:none}
button.mk-transfer{width:100%;margin-top:8px;border:1px solid var(--line2);
  background:rgba(168,120,255,.12);color:#a878ff;border-radius:8px;padding:8px;
  font:800 11px/1 system-ui;letter-spacing:.1em;cursor:pointer}

#mkFleetLayer{position:absolute;inset:0;pointer-events:none;z-index:5;transition:opacity .28s ease}
#mapWrap.zoomed #mkFleetLayer{opacity:0}
#mkFleetSvg{position:absolute;inset:0;width:100%;height:100%}
#mkFleetSvg line{stroke-width:1}
.mk-marker{position:absolute;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;font:800 10px/1 ui-monospace,monospace;
  color:#04050d;box-shadow:0 0 0 2px rgba(4,5,13,.75),0 0 10px 1px rgba(0,0,0,.5);z-index:2}
.mk-marker.trav{width:15px;height:15px;font-size:8.5px}
.mk-eta{position:absolute;transform:translate(-50%,7px);font:800 8.5px/1 ui-monospace,monospace;
  color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;pointer-events:none}

#mkRaidTabs{margin:0 0 10px}
.mk-tabrow{display:flex;gap:6px;margin-bottom:6px}
.mk-tab{flex:1;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--mut);
  border-radius:7px;padding:7px 0;font:800 12px/1 ui-monospace,monospace;cursor:pointer}
.mk-tab.on{border-color:var(--a);color:var(--a);background:rgba(255,255,255,.08)}
.mk-tabinfo{font-size:10.5px;color:var(--mut);font-family:ui-monospace,monospace;padding:0 2px}

.mk-loc{font:10.5px/1.4 ui-monospace,monospace;color:var(--dim2)}
button.mk-engage{border:1px solid var(--line2);background:rgba(92,230,165,.10);color:var(--gr);
  border-radius:8px;padding:8px;font:800 11px/1 ui-monospace,monospace;cursor:pointer;
  width:100%;margin-top:2px}
button.mk-engage.wait{color:var(--gd);background:rgba(255,209,102,.10);border-color:rgba(255,209,102,.4)}
button.mk-engage:disabled{opacity:.5;color:var(--dim2);background:rgba(255,255,255,.03);
  border-color:var(--line);cursor:not-allowed}

.mk-trow{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:12px}
.mk-trow span{flex:1;color:var(--mut)}
.mk-tval{min-width:60px;text-align:center;font-family:ui-monospace,monospace}
.mk-tbtn{width:30px;height:30px;border-radius:8px;border:1px solid var(--line2);
  background:rgba(72,226,255,.09);color:var(--txt);font:800 15px/1 system-ui;cursor:pointer}
</style>
"""

SCRIPT = r"""
<script>
/* ---- fleets mock (throwaway, tools/mkfleetmock.py) — no real game logic ---- */
(function(){
try{
  var G = window.__SD;
  if(!G){ return; }

  /* ---------------- fixture ---------------- */
  var INNER = ['ash','fer','cor'];      // 3 held Inner Reach systems (sec 1)
  var FRONT = ['anv','thu','wra'];      // 3 held Frontier systems (sec 2)

  function buildFixture(){
    try{ if(G.sceneOn) G.sceneFinish(); }catch(e){}
    var sceneEl=document.getElementById('scene'); if(sceneEl) sceneEl.style.display='none';
    var sys={ home:{ b:{} } };
    INNER.concat(FRONT).forEach(function(id){ sys[id]={ b:{} }; });
    G.adopt({
      lvl:14, lvSeen:14,
      ore:5e6, cry:2e4, dm:5000, exo:{ir:500,he:500,xe:500,am:200},
      sys:sys, msel:null,
      sh:[12,4,0], fhp:1,
      tg:[ G.newTarget(), G.newTarget(), G.newTarget() ], tgT:0
    });
    G.gotoTab('p-map');
    G.render();
  }
  buildFixture();

  /* ---------------- mock fleet state (script-only, never touches S.fl) ---- */
  var FL=[
    {id:1, n:"1st Fleet", at:"anv",  to:null, from:null, depAt:0, etaAt:0, totalSecs:0, sh:[5,1,0]},
    {id:2, n:"2nd Fleet", at:"home", to:null, from:null, depAt:0, etaAt:0, totalSecs:0, sh:[4,2,0]},
    {id:3, n:"3rd Fleet", at:"ash",  to:null, from:null, depAt:0, etaAt:0, totalSecs:0, sh:[3,1,0]}
  ];
  var MOCK_THREAT = { sysId:"thu", totalSecs:90, startedAt:Date.now() };
  var NEAR_SYS = ["home","ash","fer","cor","anv","thu","wra"];
  var selTab = 1;

  function colorOf(id){ return id===1?"#48e2ff":id===2?"#5ce6a5":"#ffd166"; }
  function fleetById(id){ for(var i=0;i<FL.length;i++) if(FL[i].id===id) return FL[i]; return null; }
  function isIdle(f){ return !f.to; }
  function fleetAt(sysId){ return FL.filter(function(f){ return f.at===sysId && !f.to; }); }
  function hullStr(f){
    var s=f.sh, parts=[s[0]+" Interceptor"+(s[0]===1?"":"s"), s[1]+" Frigate"+(s[1]===1?"":"s")];
    if(s[2]) parts.push(s[2]+" Dreadnought"+(s[2]===1?"":"s"));
    return parts.join(" · ");
  }
  function dist(a,b){ var A=G.SYSMAP[a], B=G.SYSMAP[b]; return Math.hypot(A.sx-B.sx, A.sy-B.sy); }
  /* PLAN-fleets item 4: same sector 20s + 0.4s/unit; crossing sectors +45s per ring
     boundary instead (only within-sector distance counts for the per-unit part). */
  function travelSecs(fromId, toId){
    var A=G.SYSMAP[fromId], B=G.SYSMAP[toId];
    if(A.sec===B.sec) return 20 + 0.4*dist(fromId,toId);
    var rings=Math.max(1, Math.abs(A.ring-B.ring));
    return 20 + 45*rings;
  }
  function nearestIdleFleet(toSysId){
    var idle=FL.filter(isIdle);
    if(!idle.length) return null;
    idle.sort(function(a,b){ return travelSecs(a.at,toSysId)-travelSecs(b.at,toSysId); });
    return idle[0];
  }
  function startTravel(f, destId){
    if(!f || !isIdle(f) || f.at===destId) return;
    var secs=travelSecs(f.at, destId);
    f.from=f.at; f.to=destId; f.at=null;
    f.depAt=Date.now(); f.etaAt=Date.now()+secs*1000; f.totalSecs=secs;
  }
  function tickFleets(){
    FL.forEach(function(f){
      if(f.to && Date.now()>=f.etaAt){
        var destName=G.SYSMAP[f.to].n;
        f.at=f.to; f.to=null; f.from=null;
        mkToast(f.n+" arrived at "+destName, "g");
      }
    });
  }
  function threatSecsLeft(){ return Math.max(0, MOCK_THREAT.totalSecs-(Date.now()-MOCK_THREAT.startedAt)/1000); }

  /* toast()/showModal()/hideModal()/$ are plain top-level functions in the game's
     own (non-module) script, so they live in this page's shared script scope and
     are callable directly here — same trick tests/*.js use via page.evaluate(). */
  function mkToast(msg,cls){ try{ toast(msg,cls); }catch(e){} }

  /* ---------------- map markers (item 3) ---------------- */
  var mapWrap=document.getElementById('mapWrap');
  var mkLayer=document.createElement('div');
  mkLayer.id='mkFleetLayer';
  mkLayer.innerHTML='<svg id="mkFleetSvg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div id="mkFleetMarkers"></div>';
  mapWrap.appendChild(mkLayer);
  var mkSvg=mkLayer.querySelector('#mkFleetSvg');
  var mkMarkers=mkLayer.querySelector('#mkFleetMarkers');

  function addMarker(x,y,id,color,trav,badge){
    var d=document.createElement('div');
    d.className='mk-marker'+(trav?' trav':'');
    /* a static "at this node" marker sits as a badge to the node's upper-right,
       not centred on the dot - centred there, it clips the node's own label
       (mnode stacks dot then name directly beneath it). A sliding travel marker
       has no label under it, so it stays exactly on the line. */
    var dx = badge ? 6 : 0, dy = badge ? -6 : 0;
    d.style.left=(x+dx)+'%'; d.style.top=(y+dy)+'%'; d.style.background=color;
    d.textContent=id;
    mkMarkers.appendChild(d);
  }
  function addEta(x,y,text){
    var d=document.createElement('div');
    d.className='mk-eta'; d.style.left=x+'%'; d.style.top=y+'%'; d.textContent=text;
    mkMarkers.appendChild(d);
  }
  function renderMockMap(){
    mkSvg.innerHTML=''; mkMarkers.innerHTML='';
    var sec=G.mapSec, list=G.sysInSec(sec), byId={};
    list.forEach(function(s){ byId[s.id]=s; });
    FL.forEach(function(f){
      var color=colorOf(f.id);
      if(f.to){
        var A=byId[f.from], B=byId[f.to];
        if(A&&B){
          var ln=document.createElementNS('http://www.w3.org/2000/svg','line');
          ln.setAttribute('x1',A.sx); ln.setAttribute('y1',A.sy);
          ln.setAttribute('x2',B.sx); ln.setAttribute('y2',B.sy);
          ln.setAttribute('stroke',color); ln.setAttribute('stroke-dasharray','2 2');
          mkSvg.appendChild(ln);
          var prog=Math.min(1,Math.max(0,(Date.now()-f.depAt)/(f.totalSecs*1000)));
          var mx=A.sx+(B.sx-A.sx)*prog, my=A.sy+(B.sy-A.sy)*prog;
          addMarker(mx,my,f.id,color,true);
          addEta(mx,my,Math.max(0,Math.ceil((f.etaAt-Date.now())/1000))+'s');
        } else if(A){ addMarker(A.sx,A.sy,f.id,color,true,false); }
        else if(B){ addMarker(B.sx,B.sy,f.id,color,true,false); }
      } else {
        var s=byId[f.at];
        if(s) addMarker(s.sx,s.sy,f.id,color,false,true);
      }
    });
  }

  /* ---------------- system page FLEETS block (item 5) ---------------- */
  var sysSheet=document.getElementById('sysSheet');
  var defWrap=document.getElementById('sysDefWrap');
  var fleetsBlock=document.createElement('div');
  fleetsBlock.id='mkFleetsBlock';
  sysSheet.insertBefore(fleetsBlock, defWrap);

  function fleetRow(f, s, isHere){
    var status;
    if(f.to){
      var secsLeft=Math.max(0,Math.ceil((f.etaAt-Date.now())/1000));
      status='<span class="mk-status">→ '+G.SYSMAP[f.to].n+' · '+secsLeft+'s</span>';
    } else if(isHere){
      status='<span class="mk-status">AT '+s.n+'</span>';
    } else {
      var secs=Math.round(travelSecs(f.at, s.id));
      status='<button class="mk-send" data-send="'+f.id+'">SEND '+f.n.toUpperCase()+' · '+secs+'s</button>';
    }
    return '<div class="mk-frow"><span class="mk-fname" style="color:'+colorOf(f.id)+'">'+f.n+
      '</span><span class="mk-hulls">'+hullStr(f)+'</span>'+status+'</div>';
  }

  function openTransferModal(sysId){
    var here=fleetAt(sysId);
    if(here.length<2) return;
    var A=here[0], B=here[1];
    var labels=['Interceptor','Frigate','Dreadnought'];
    function rowsHtml(){
      return labels.map(function(lab,i){
        return '<div class="mk-trow"><span>'+lab+'</span>'+
          '<button class="mk-tbtn" data-i="'+i+'" data-d="-1">−</button>'+
          '<b class="mk-tval">'+A.sh[i]+' / '+B.sh[i]+'</b>'+
          '<button class="mk-tbtn" data-i="'+i+'" data-d="1">+</button></div>';
      }).join('');
    }
    function wire(){
      $('#mkTransferRows').querySelectorAll('.mk-tbtn').forEach(function(b){
        b.onclick=function(){
          var i=+b.dataset.i, d=+b.dataset.d;
          if(d<0){ if(A.sh[i]>0){ A.sh[i]--; B.sh[i]++; } }
          else { if(B.sh[i]>0){ B.sh[i]--; A.sh[i]++; } }
          $('#mkTransferRows').innerHTML=rowsHtml();
          wire();
        };
      });
    }
    showModal(
      '<h3>TRANSFER</h3><p>'+A.n+' ↔ '+B.n+' at '+G.SYSMAP[sysId].n+'</p>'+
      '<div id="mkTransferRows">'+rowsHtml()+'</div>'+
      '<div class="row" style="margin-top:12px"><button id="mkTransferDone">DONE</button></div>',
      function(){ $('#mkTransferDone').onclick=hideModal; wire(); }
    );
  }

  function renderSysFleets(){
    var sid=G.S.msel, s=sid?G.SYSMAP[sid]:null;
    if(!s){ fleetsBlock.style.display='none'; fleetsBlock.innerHTML=''; return; }
    fleetsBlock.style.display='';
    var html='<div class="sechead">Fleets</div>';
    if(MOCK_THREAT.sysId===s.id){
      var left=threatSecsLeft();
      var canDefend = fleetAt(s.id).length>0 ||
        FL.some(function(f){ return isIdle(f) && travelSecs(f.at,s.id)<=left; });
      html+='<div class="mk-threat">Raiders arrive in '+Math.ceil(left)+'s</div>'+
        '<button class="mk-defend" id="mkDefendBtn" '+(canDefend?'':'disabled')+'>'+
        (canDefend?'DEFEND IT':'NO FLEET CAN REACH IN TIME')+'</button>';
    }
    var here=fleetAt(s.id);
    if(here.length){ here.forEach(function(f){ html+=fleetRow(f,s,true); }); }
    else { html+='<div class="mk-empty">No fleet here.</div>'; }
    FL.filter(function(f){ return f.at!==s.id || f.to; }).forEach(function(f){ html+=fleetRow(f,s,false); });
    if(here.length>1) html+='<button class="mk-transfer" id="mkTransferBtn">TRANSFER</button>';
    fleetsBlock.innerHTML=html;
    var db=fleetsBlock.querySelector('#mkDefendBtn');
    if(db && !db.disabled) db.onclick=function(){ mkToast("would engage here","y"); };
    var tb=fleetsBlock.querySelector('#mkTransferBtn');
    if(tb) tb.onclick=function(){ openTransferModal(s.id); };
    fleetsBlock.querySelectorAll('[data-send]').forEach(function(btn){
      btn.onclick=function(){
        var f=fleetById(+btn.dataset.send);
        startTravel(f, s.id);
        mkToast(f.n+" departing for "+s.n);
      };
    });
  }

  /* ---------------- Raids pane: 1·2·3 tabs (item 5) ---------------- */
  var flStrip=document.getElementById('flStrip');
  var raidTabs=document.createElement('div');
  raidTabs.id='mkRaidTabs';
  flStrip.parentNode.insertBefore(raidTabs, flStrip);

  function renderRaidTabs(){
    var html='<div class="mk-tabrow">';
    FL.forEach(function(f){
      html+='<button class="mk-tab'+(selTab===f.id?' on':'')+'" data-t="'+f.id+
        '" style="--a:'+colorOf(f.id)+'">'+f.id+'</button>';
    });
    html+='</div>';
    var f=fleetById(selTab);
    var status = f.to
      ? ('→ '+G.SYSMAP[f.to].n+' · '+Math.max(0,Math.ceil((f.etaAt-Date.now())/1000))+'s')
      : ('AT '+G.SYSMAP[f.at].n);
    html+='<div class="mk-tabinfo"><b style="color:'+colorOf(selTab)+'">'+f.n+'</b> · '+
      hullStr(f)+' · '+status+'</div>';
    raidTabs.innerHTML=html;
    raidTabs.querySelectorAll('.mk-tab').forEach(function(b){
      b.onclick=function(){ selTab=+b.dataset.t; renderRaidTabs(); };
    });
  }

  /* ---------------- Raids pane: target cards (item 5) ---------------- */
  function renderRaidCards(){
    var tgts=document.getElementById('tgts');
    if(!tgts) return;
    var cards=tgts.querySelectorAll('.tcard');
    cards.forEach(function(card,i){
      var sysId=NEAR_SYS[i % NEAR_SYS.length];
      var sys=G.SYSMAP[sysId];
      card.querySelectorAll(':scope > button:not(.mk-engage)').forEach(function(b){ b.style.display='none'; });
      var loc=card.querySelector('.mk-loc');
      if(!loc){
        loc=document.createElement('div'); loc.className='mk-loc';
        var tr=card.querySelector('.tr');
        tr.parentNode.insertBefore(loc, tr.nextSibling);
      }
      loc.textContent='near '+sys.n;
      var btn=card.querySelector('.mk-engage');
      if(!btn){ btn=document.createElement('button'); btn.className='mk-engage'; card.appendChild(btn); }
      var atHere=fleetAt(sysId).length>0;
      if(atHere){
        btn.textContent='ENGAGE'; btn.disabled=false; btn.classList.remove('wait');
        btn.onclick=function(){ mkToast('would engage here','y'); };
      } else {
        var nf=nearestIdleFleet(sysId);
        if(nf){
          var secs=Math.round(travelSecs(nf.at, sysId));
          btn.textContent='SEND '+nf.n.toUpperCase()+' · '+secs+'s';
          btn.disabled=false; btn.classList.add('wait');
          btn.onclick=function(){ startTravel(nf, sysId); mkToast(nf.n+' departing for '+sys.n); };
        } else {
          btn.textContent='ALL FLEETS BUSY'; btn.disabled=true; btn.classList.remove('wait'); btn.onclick=null;
        }
      }
    });
  }

  /* ---------------- drive it all off a plain interval, not __SD.render ----------
     __SD.render is a copy of the internal render function taken at boot - wrapping
     the exported copy would never touch frame()'s own requestAnimationFrame loop,
     which calls its own closed-over `render` ~11x/s regardless of dirty. Re-running
     our own pass on the same cadence keeps every mock element correct without
     needing to hook the real one. */
  function tickAll(){ tickFleets(); renderMockMap(); renderSysFleets(); renderRaidTabs(); renderRaidCards(); }
  tickAll();
  setInterval(tickAll, 150);

  /* debug-only hook for the verification screenshots (tools/shotfleetmock.js) -
     lets it fast-forward a travel instead of waiting out real seconds. Not part
     of the mock's own UI/behaviour. */
  window.__mockFleetsDebug={ FL:FL, forceArrive:function(id){ var f=fleetById(id); if(f&&f.to) f.etaAt=Date.now()-1; tickAll(); } };
}catch(e){
  console.error("fleets-mock error", e);
}
})();
</script>
"""


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        html = f.read()
    inject = STYLE + SCRIPT
    idx = html.rfind("</body>")
    if idx < 0:
        raise SystemExit("no </body> found in " + SRC)
    out = html[:idx] + inject + html[idx:]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)
    print("wrote " + OUT + " (" + str(len(out)) + " bytes)")


if __name__ == "__main__":
    main()
