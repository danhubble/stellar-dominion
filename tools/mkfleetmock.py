#!/usr/bin/env python3
"""mkfleetmock.py — throwaway runtime-injection mock for PLAN-fleets.md.

Reads dist/stellar-dominion.html (NEVER writes it) and writes
docs/mocks/fleets-mock.html = the same file plus one extra <style> and one
extra <script> injected right before </body>. No game logic is touched;
the injected script drives everything from window.__SD plus the handful of
bare globals (S, SYSMAP, sysInSec, showModal, toast, hideModal, $, ...) that
live in the same top-level script scope as the game itself, exactly the way
tests/*.js already poke the game in page.evaluate().

Mocks decisions 3, 5, 6 of docs/PLAN-fleets.md, revised after the owner
played mock v1 and asked for control moved onto the map as a FLEET BAR
(interaction "A" — see the design chat): a 3-button row right below
#mapWrap that selects a fleet, then a confirm chip on a tapped node sends
it; a second tap on the selected button opens the fleet's card.

Run: python3 tools/mkfleetmock.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dist", "stellar-dominion.html")
OUT = os.path.join(ROOT, "docs", "mocks", "fleets-mock.html")

STYLE = """
<style>
/* ---- fleets mock (throwaway, tools/mkfleetmock.py) ---- */
#mapWrap{margin-bottom:0}                 /* base rule's 10px replaced by #mkFleetBar's own 8px top margin, in both map and syspage layouts */

#mkFleetBar{display:flex;gap:6px;margin:8px 0 10px}
.mk-fbtn{flex:1;min-width:0;cursor:pointer;border:1px solid var(--line);border-radius:10px;
  padding:6px 4px;background:rgba(10,14,32,.7);color:var(--mut);font:700 9px/1.3 system-ui;
  letter-spacing:0;text-align:center;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1px}
.mk-fbtn .mk-fnum{font-weight:800;font-size:12px;line-height:1}
.mk-fbtn .mk-fstat{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mk-fbtn.sel{border-color:var(--cy);background:rgba(72,226,255,.12);color:var(--txt);
  box-shadow:0 0 10px -2px rgba(72,226,255,.6)}
.mk-fbtn.locked{opacity:.42;cursor:not-allowed;color:var(--dim2)}
.mk-fbtn.locked .mk-fnum{color:var(--dim2)!important}

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
.mk-marker.sel{animation:mkPulseSel 1s ease-in-out infinite}
@keyframes mkPulseSel{
  0%,100%{box-shadow:0 0 0 2px rgba(4,5,13,.75),0 0 0 0 rgba(255,255,255,.5)}
  50%{box-shadow:0 0 0 2px rgba(4,5,13,.75),0 0 13px 5px rgba(255,255,255,.6)}
}
.mk-eta{position:absolute;transform:translate(-50%,7px);font:800 8.5px/1 ui-monospace,monospace;
  color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;pointer-events:none}

.mk-confirmchip{position:absolute;transform:translate(-50%,14px);pointer-events:auto;cursor:pointer;
  border:1px solid var(--cy);background:rgba(4,10,24,.92);color:var(--txt);border-radius:7px;
  padding:5px 8px;font:800 9.5px/1 ui-monospace,monospace;letter-spacing:.04em;white-space:nowrap;
  box-shadow:0 0 12px -1px rgba(72,226,255,.7);z-index:7}

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

.mk-cardhulls{font:11px/1.5 ui-monospace,monospace;color:var(--mut);margin:8px 0}
.mk-cardint{font:700 12px/1.4 system-ui;color:var(--txt);margin-bottom:4px}
.mk-cardrow{display:flex;gap:8px;margin-top:12px}
.mk-cardrow button{flex:1;border:1px solid var(--line2);border-radius:8px;padding:9px 6px;
  font:800 11px/1 system-ui;letter-spacing:.08em;cursor:pointer}
#mkCardRepair{background:rgba(72,226,255,.09);color:var(--txt)}
#mkCardTransfer{background:rgba(168,120,255,.12);color:#a878ff}
#mkCardTransfer:disabled{opacity:.4;color:var(--dim2);background:rgba(255,255,255,.03);
  border-color:var(--line);cursor:not-allowed}
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
  var FLEET3_LV = 20;                   // PLAN-fleets decision 1: Fleet 3 unlocks at level 20

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
    {id:1, n:"1st Fleet", at:"anv",  to:null, from:null, depAt:0, etaAt:0, totalSecs:0, sh:[5,1,0], locked:false},
    {id:2, n:"2nd Fleet", at:"home", to:null, from:null, depAt:0, etaAt:0, totalSecs:0, sh:[4,2,0], locked:false},
    {id:3, n:"3rd Fleet", at:"ash",  to:null, from:null, depAt:0, etaAt:0, totalSecs:0, sh:[3,1,0], locked:true}
  ];
  var INTEGRITY_MOCK={1:92,2:74,3:58};
  var MOCK_THREAT = { sysId:"thu", totalSecs:90, startedAt:Date.now() };
  var NEAR_SYS = ["home","ash","fer","cor","anv","thu","wra"];
  var selTab = 1;

  /* ---- fleet bar selection / confirm-chip state (decision "A") ---- */
  var selFleet = null;              // id of the fleet picked from the bar, or null
  var pendingConfirm = null;        // {sysId, fleetId} while a "SEND · Ns" chip is showing

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
    var idle=FL.filter(function(f){ return isIdle(f) && !f.locked; });
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

  function deselectFleet(){ selFleet=null; pendingConfirm=null; }

  /* ---------------- fleet bar (owner decision "A": control moved off the
     system card, onto the map view) ---------------- */
  var mapWrap=document.getElementById('mapWrap');
  var fleetBar=document.createElement('div');
  fleetBar.id='mkFleetBar';
  mapWrap.parentNode.insertBefore(fleetBar, mapWrap.nextSibling);

  function fleetBarLabel(f){
    if(f.locked) return 'LOCKED LV '+FLEET3_LV;
    if(f.to){
      var secsLeft=Math.max(0,Math.ceil((f.etaAt-Date.now())/1000));
      return '→ '+G.SYSMAP[f.to].n.toUpperCase()+' '+secsLeft+'s';
    }
    return 'AT '+G.SYSMAP[f.at].n.toUpperCase();
  }
  function renderFleetBar(){
    var html='';
    FL.forEach(function(f){
      var cls='mk-fbtn'+(f.locked?' locked':'')+(selFleet===f.id?' sel':'');
      var numColor=f.locked?'var(--dim2)':colorOf(f.id);
      html+='<button type="button" class="'+cls+'" data-fbtn="'+f.id+'"'+(f.locked?' disabled':'')+'>'+
        '<span class="mk-fnum" style="color:'+numColor+'">'+f.id+'</span>'+
        '<span class="mk-fstat">'+fleetBarLabel(f)+'</span>'+
        '</button>';
    });
    fleetBar.innerHTML=html;
    fleetBar.querySelectorAll('[data-fbtn]').forEach(function(b){
      b.onclick=function(){
        var id=+b.dataset.fbtn, f=fleetById(id);
        if(!f || f.locked) return;
        if(f.to){ openFleetCardModal(id); return; }               /* travelling: nothing to select, just view the card */
        if(selFleet===id){ openFleetCardModal(id); deselectFleet(); }
        else { selFleet=id; pendingConfirm=null; }
        tickAll();
      };
    });
  }

  /* ---------------- map: node taps while a fleet is selected ---------------- */
  var mapNodesEl=document.getElementById('mapNodes');
  mapNodesEl.addEventListener('click', function(e){
    if(selFleet==null) return;                 /* nothing selected: let the real game's own node tap (open system page) run */
    e.stopPropagation();                        /* selected: never let the tap fall through to the real open-system-page handler */
    var btn=e.target.closest('.mnode'); if(!btn) return;
    var sysId=btn.dataset.s, f=fleetById(selFleet);
    if(!f || !isIdle(f)){ pendingConfirm=null; tickAll(); return; }
    if(f.at===sysId){ mkToast('already here','y'); pendingConfirm=null; tickAll(); return; }
    pendingConfirm={ sysId:sysId, fleetId:selFleet };
    tickAll();
  }, true);
  mapWrap.addEventListener('click', function(e){
    if(selFleet==null) return;
    if(e.target.closest('.mnode') || e.target.closest('.mk-confirmchip')) return;  /* handled above / by the chip's own handler */
    deselectFleet(); tickAll();                 /* tap elsewhere on the map: deselect */
  });
  function confirmSend(){
    if(!pendingConfirm) return;
    var f=fleetById(pendingConfirm.fleetId), destId=pendingConfirm.sysId;
    if(f && isIdle(f) && f.at!==destId){
      startTravel(f, destId);
      mkToast(f.n+' departing for '+G.SYSMAP[destId].n);
    }
    deselectFleet();
    tickAll();
  }

  /* ---------------- fleet card modal (2nd tap on the selected bar button) --- */
  function openFleetCardModal(id){
    var f=fleetById(id); if(!f) return;
    var statusLine = f.to
      ? ('EN ROUTE TO '+G.SYSMAP[f.to].n.toUpperCase()+' · '+Math.max(0,Math.ceil((f.etaAt-Date.now())/1000))+'s')
      : ('AT '+G.SYSMAP[f.at].n.toUpperCase());
    var hereFleets = f.to ? [] : fleetAt(f.at);
    var canTransfer = !f.to && hereFleets.length>1;
    var html='<h3 style="color:'+colorOf(id)+'">'+f.n+'</h3>'+
      '<p class="mk-loc">'+statusLine+'</p>'+
      '<div class="mk-cardhulls">'+hullStr(f)+'</div>'+
      '<div class="mk-cardint">Integrity <b>'+(INTEGRITY_MOCK[id]||80)+'%</b></div>'+
      '<div class="mk-cardrow">'+
        '<button id="mkCardRepair">REPAIR</button>'+
        '<button id="mkCardTransfer"'+(canTransfer?'':' disabled')+'>TRANSFER</button>'+
      '</div>';
    function wire(){
      var rb=document.getElementById('mkCardRepair');
      if(rb) rb.onclick=function(){ mkToast('would repair '+f.n,'g'); };
      var tb=document.getElementById('mkCardTransfer');
      if(tb && !tb.disabled) tb.onclick=function(){ hideModal(); openTransferModal(f.at); };
    }
    if(typeof showModal==='function') showModal(html, wire);
  }

  /* ---------------- map markers + confirm chip (item 3) ---------------- */
  var mkLayer=document.createElement('div');
  mkLayer.id='mkFleetLayer';
  mkLayer.innerHTML='<svg id="mkFleetSvg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div id="mkFleetMarkers"></div>';
  mapWrap.appendChild(mkLayer);
  var mkSvg=mkLayer.querySelector('#mkFleetSvg');
  var mkMarkers=mkLayer.querySelector('#mkFleetMarkers');

  function addMarker(x,y,id,color,trav,badge,sel){
    var d=document.createElement('div');
    d.className='mk-marker'+(trav?' trav':'')+(sel?' sel':'');
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
  function addConfirmChip(x,y,text){
    var d=document.createElement('div');
    d.className='mk-confirmchip'; d.style.left=x+'%'; d.style.top=y+'%'; d.textContent=text;
    d.onclick=function(){ confirmSend(); };
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
          addMarker(mx,my,f.id,color,true,false,false);
          addEta(mx,my,Math.max(0,Math.ceil((f.etaAt-Date.now())/1000))+'s');
        } else if(A){ addMarker(A.sx,A.sy,f.id,color,true,false,false); }
        else if(B){ addMarker(B.sx,B.sy,f.id,color,true,false,false); }
      } else {
        var s=byId[f.at];
        if(s) addMarker(s.sx,s.sy,f.id,color,false,true,selFleet===f.id);
      }
    });
    if(pendingConfirm && byId[pendingConfirm.sysId]){
      var node=byId[pendingConfirm.sysId];
      var f2=fleetById(pendingConfirm.fleetId);
      var secs=f2?Math.round(travelSecs(f2.at,node.id)):0;
      addConfirmChip(node.sx,node.sy,'SEND · '+secs+'s');
    }
  }

  /* ---------------- system page FLEETS block (item 5) — shrunk per owner's
     decision "A": SEND buttons removed (sending is now the bar's job); the
     block is just fleets-here + the mock threat/DEFEND-IT line. ---------- */
  var sysSheet=document.getElementById('sysSheet');
  var defWrap=document.getElementById('sysDefWrap');
  var fleetsBlock=document.createElement('div');
  fleetsBlock.id='mkFleetsBlock';
  sysSheet.insertBefore(fleetsBlock, defWrap);

  function fleetHereRow(f){
    return '<div class="mk-frow"><span class="mk-fname" style="color:'+colorOf(f.id)+'">'+f.n+
      '</span><span class="mk-hulls">'+hullStr(f)+'</span></div>';
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
        FL.some(function(f){ return isIdle(f) && !f.locked && travelSecs(f.at,s.id)<=left; });
      html+='<div class="mk-threat">Raiders arrive in '+Math.ceil(left)+'s</div>'+
        '<button class="mk-defend" id="mkDefendBtn" '+(canDefend?'':'disabled')+'>'+
        (canDefend?'DEFEND IT':'NO FLEET CAN REACH IN TIME')+'</button>';
    }
    var here=fleetAt(s.id);
    if(here.length){ here.forEach(function(f){ html+=fleetHereRow(f); }); }
    else { html+='<div class="mk-empty">No fleet here.</div>'; }
    fleetsBlock.innerHTML=html;
    var db=fleetsBlock.querySelector('#mkDefendBtn');
    if(db && !db.disabled) db.onclick=function(){ mkToast("would engage here","y"); };
  }

  /* ---------------- Raids pane: 1·2·3 tabs (item 5, unchanged) ---------- */
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

  /* ---------------- Raids pane: target cards (item 5, unchanged — a raid
     card's SEND button already just calls startTravel(), same as the bar) - */
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
  function tickAll(){ tickFleets(); renderFleetBar(); renderMockMap(); renderSysFleets(); renderRaidTabs(); renderRaidCards(); }
  tickAll();
  setInterval(tickAll, 150);

  /* debug-only hook for the verification screenshots (tools/shotfleetmock.js) -
     lets it fast-forward a travel instead of waiting out real seconds, and drive
     the fleet-bar selection without simulating real taps pixel-for-pixel. Not
     part of the mock's own UI/behaviour. */
  window.__mockFleetsDebug={
    FL:FL,
    forceArrive:function(id){ var f=fleetById(id); if(f&&f.to) f.etaAt=Date.now()-1; tickAll(); },
    selectFleet:function(id){ selFleet=id; pendingConfirm=null; tickAll(); },
    tapNode:function(sysId){
      /* dispatched on the real .mnode button so it runs through the exact same
         capture-phase listener the real UI uses - no separate logic to drift. */
      var btn=mapNodesEl.querySelector('.mnode[data-s="'+sysId+'"]');
      if(btn) btn.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
      tickAll();
    },
    confirmSend:confirmSend,
    get selFleet(){ return selFleet; },
    get pendingConfirm(){ return pendingConfirm; }
  };
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
