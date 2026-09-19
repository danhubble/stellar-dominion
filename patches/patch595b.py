import io

"""patch595b - review fix found while taking this run's own required screenshots
(BUILD stays 595 - same "same-batch fix" convention as 589b/591b/593b).

patch595's under-attack block put DEFEND IT / LET THEM HOLD inside the red top
block itself. Screenshotting it against fortify-mock2.html's own state F (the
owner-approved reference for this exact state) showed the mock puts those two
buttons in their own row AFTER the defences row/FORTIFY button, not bundled
into the threat card at the top - the plan's own line ("red threat block at
the top ... then the defences row, then DEFEND IT / LET THEM HOLD") reads the
same way once checked against the actual mock markup, and this patch was the
one that misread it. Fixed by splitting the "under attack" render into two
parts: #sysThreat stays the red top block, now info-only (rival + clock);
a new #sysThreatActs sits after #sysAct and carries the two buttons, styled
with the game's own existing `.row`/`.row button.warn` idiom (no new button
CSS needed) - matching the mock's `.acts`/`.acts button.foe` look with classes
that already exist for exactly this purpose. Still the exact same
startDefence()/holdLine() calls; only the layout moved."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

# ---------------- CSS: #sysThreatActs must hide reliably even though it reuses
#      .row (an ID rule beats the class on specificity, no cascade-order gamble) ----------------
old_css=(
'#sysSheet.dragging{transition:none}\n'
)
assert h.count(old_css)==1
new_css=(
'#sysSheet.dragging{transition:none}\n'
'#sysThreatActs[hidden]{display:none}\n'
)
assert new_css!=old_css
h=h.replace(old_css,new_css,1)

# ---------------- HTML: the new actions row, after #sysAct ----------------
old_html=(
'          <div id="sysThreat" hidden></div>\n'
'          <div id="sysInfo"></div>\n'
'          <div id="sysAct"></div>\n'
'        </div>\n'
)
assert h.count(old_html)==1
new_html=(
'          <div id="sysThreat" hidden></div>\n'
'          <div id="sysInfo"></div>\n'
'          <div id="sysAct"></div>\n'
'          <div id="sysThreatActs" class="row" hidden></div>\n'
'        </div>\n'
)
h=h.replace(old_html,new_html,1)

# ---------------- JS: #sysThreat becomes info-only; the buttons move to the
#      new #sysThreatActs, guarded by the same key ----------------
old_js=(
'  if(thrBox){\n'
'    const th=held?thqAtSys(s.id):null;\n'
'    if(!th){\n'
'      if(thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n'
'    } else {\n'
'      const trv=RIVALMAP[th.rv], tod=Math.round(holdOdds(th)*100), tkey=th.id+"|"+tod;\n'
'      thrBox.hidden=false;\n'
'      if(thrBox.dataset.h!==tkey){\n'
'        thrBox.dataset.h=tkey;\n'
'        thrBox.innerHTML=`<div class="thrc${th.t<3600?" soon":""}">\n'
'          <h5>UNDER ATTACK<span class="thrt" id="sshThrCd">${thqClock(th.t)} left</span></h5>\n'
'          <div class="who" style="color:${trv?trv.col:"var(--rd)"}">${trv?trv.n:"Hostiles"}</div>\n'
'          <button class="thrgo" id="sshThrGo">DEFEND IT</button>\n'
'          <button class="thrhold" id="sshThrHold">LET THEM HOLD \\u00b7 ${tod}%</button>\n'
'        </div>`;\n'
'        $("#sshThrGo").onclick=()=>{ startDefence(th.id); };\n'
'        $("#sshThrHold").onclick=()=>{ holdLine(th.id); };\n'
'      }\n'
'      const tcd=thrBox.querySelector("#sshThrCd"); if(tcd)tcd.textContent=thqClock(th.t)+" left";\n'
'    }\n'
'  }\n'
)
assert h.count(old_js)==1
new_js=(
'  if(thrBox){\n'
'    const th=held?thqAtSys(s.id):null;\n'
'    const acts=$("#sysThreatActs");\n'
'    if(!th){\n'
'      if(thrBox.dataset.h!==""){ thrBox.dataset.h=""; thrBox.innerHTML=""; thrBox.hidden=true }\n'
'      if(acts&&acts.dataset.h!==""){ acts.dataset.h=""; acts.innerHTML=""; acts.hidden=true }\n'
'    } else {\n'
'      const trv=RIVALMAP[th.rv], tod=Math.round(holdOdds(th)*100), tkey=th.id+"|"+tod;\n'
'      thrBox.hidden=false;\n'
'      if(thrBox.dataset.h!==tkey){\n'
'        thrBox.dataset.h=tkey;\n'
'        thrBox.innerHTML=`<div class="thrc${th.t<3600?" soon":""}">\n'
'          <h5>UNDER ATTACK<span class="thrt" id="sshThrCd">${thqClock(th.t)} left</span></h5>\n'
'          <div class="who" style="color:${trv?trv.col:"var(--rd)"}">${trv?trv.n:"Hostiles"}</div>\n'
'        </div>`;\n'
'      }\n'
'      const tcd=thrBox.querySelector("#sshThrCd"); if(tcd)tcd.textContent=thqClock(th.t)+" left";\n'
'      if(acts){\n'
'        acts.hidden=false;\n'
'        if(acts.dataset.h!==tkey){\n'
'          acts.dataset.h=tkey;\n'
'          acts.innerHTML=`<button class="warn" id="sshThrGo">DEFEND IT</button>\n'
'            <button class="ghost" id="sshThrHold">LET THEM HOLD \\u00b7 ${tod}%</button>`;\n'
'          $("#sshThrGo").onclick=()=>{ startDefence(th.id); };\n'
'          $("#sshThrHold").onclick=()=>{ holdLine(th.id); };\n'
'        }\n'
'      }\n'
'    }\n'
'  }\n'
)
assert new_js!=old_js
h=h.replace(old_js,new_js,1)

# BUILD stays 595 - same-batch fix (589b/591b/593b convention)

io.open(F,"w",encoding="utf-8").write(h)
print("patch595b applied")
