#!/usr/bin/env python3
"""Throwaway mock (PLAN-polish, parked item): a MISSION tag on building rows whose
tier feeds an active mission. Injects one <style>+<script> into dist; writes
docs/mocks/missiontag-mock.html. Two variants side by side via ?v=A|B in the mock:
  A - small pill after the name: "MISSION 3/15"
  B - a left stripe + one line under the stats: "Mission: Own 15 Mining Drones · 3/15"
"""
import io, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=io.open(f"{ROOT}/dist/stellar-dominion.html",encoding="utf-8").read()
inject=r"""
<style>
.g .mtag{display:inline-block;margin-left:6px;padding:2px 6px 1px;border-radius:5px;
  font:700 8.5px/1.35 system-ui;letter-spacing:.12em;text-transform:uppercase;
  color:var(--gd);border:1px solid rgba(255,209,102,.6);background:rgba(255,209,102,.10);
  vertical-align:2px;white-space:nowrap}
.g .mtag b{font-family:ui-monospace,monospace;letter-spacing:0;margin-left:4px}
.g.mB{box-shadow:inset 3px 0 0 var(--gd)}
.g .mline{font:600 10px/1.3 system-ui;color:var(--gd);margin-top:3px}
.g .mline b{font-family:ui-monospace,monospace}
/* C: thin accordion strip hanging under the row, in the row's own accent colour */
.g.mC{border-bottom-left-radius:0;border-bottom-right-radius:0;margin-bottom:0}
.mstrip{display:flex;justify-content:space-between;align-items:center;gap:8px;
  margin:0 0 7px;padding:4px 10px 4px 12px;border:1px solid var(--line);border-top:none;
  border-radius:0 0 11px 11px;background:var(--panel);
  box-shadow:inset 3px 0 0 var(--a);font:600 10px/1.3 system-ui;color:var(--mut)}
.mstrip b{color:var(--a);font-family:ui-monospace,monospace}
.mstrip i{font-style:normal;color:var(--a);letter-spacing:.14em;font-size:8.5px;margin-right:6px}
</style>
<script>
(function(){
  const V=(location.search.match(/v=([ABC])/)||[])[1]||"C";
  const NAMES={0:"Mining Drone",1:"Smelter Pod",2:"Crust Borer",3:"Fabricator",4:"Orbital Harvester",5:"Fusion Forge"};
  function active(){ const S=window.__SD.S; return window.__SD.MISSIONS.slice(S.mi,S.mi+3); }
  function need(m){ const n=m.d.match(/(\d+)/); return n?+n[1]:1; }
  function apply(){
    const SD=window.__SD; if(!SD)return;
    const act=active();
    document.querySelectorAll('#sysSheet .g').forEach(row=>{
      const name=row.querySelector('.gn'); if(!name)return;
      const base=name.textContent.replace(/\s*MISSION.*$/,'').trim();
      let gi=null; for(const k in NAMES)if(base.startsWith(NAMES[k]))gi=+k;
      if(gi===null)return;
      const m=act.find(x=>x.d.includes(NAMES[gi]));
      row.querySelectorAll('.mtag,.mline').forEach(e=>e.remove()); row.classList.remove('mB','mC'); if(row.nextElementSibling&&row.nextElementSibling.classList.contains('mstrip'))row.nextElementSibling.remove();
      if(!m)return;
      const have=SD.gCount(gi), n=need(m);
      if(V==="A"){
        const t=document.createElement('span'); t.className='mtag';
        t.innerHTML='Mission<b>'+Math.min(have,n)+'/'+n+'</b>';
        name.appendChild(t);
      } else if(V==="C"){
        row.classList.add('mC');
        const st=document.createElement('div'); st.className='mstrip';
        st.style.setProperty('--a',row.style.getPropertyValue('--a'));
        st.innerHTML='<span><i>MISSION</i>'+m.d+'</span><b>'+Math.min(have,n)+'/'+n+'</b>';
        row.after(st);
      } else {
        row.classList.add('mB');
        const l=document.createElement('div'); l.className='mline';
        l.innerHTML='Mission: '+m.d+' · <b>'+Math.min(have,n)+'/'+n+'</b>';
        row.querySelector('.gtxt').appendChild(l);
      }
    });
  }
  setInterval(apply,200);
  // fixture: skip intro, level 3, a few drones, home page open
  setTimeout(()=>{ const SD=window.__SD,S=SD.S; document.querySelector('#sceneSkip')?.click();
    S.lvl=3; S.xpn=60; S.ore=5000; S.sys.home.b={0:3}; S.msel="home"; SD.render(); },600);
})();
</script>
"""
out=src.replace("</body>",inject+"</body>",1)
os.makedirs(f"{ROOT}/docs/mocks",exist_ok=True)
io.open(f"{ROOT}/docs/mocks/missiontag-mock.html","w",encoding="utf-8").write(out)
print("ok")
