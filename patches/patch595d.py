import io

"""patch595d - review fix found in the same screenshot/test pass as 595b/595c
(BUILD stays 595). The grab-handle drag had no pointer capture: a mouse-driven
drag (confirmed with a throwaway Playwright repro while writing tsheet2.js)
moves the cursor off the 38x4px handle within a few pixels, and plain
pointermove/pointerup only ever reach whatever element is actually under the
cursor at that instant - once the drag has moved the sheet down at all, that
is no longer #sshGrab, so pointerup never reaches the release handler and the
sheet gets stuck mid-drag. Touch was very unlikely to show this by hand (touch
pointers get implicit capture to their start target per spec, mouse pointers
do not), but it is a real bug for a mouse/trackpad user and it is what made
the gesture untestable by anything but real fingers. Fixed with the standard
tool for exactly this - grab.setPointerCapture() on pointerdown - so
pointermove/pointerup keep targeting the handle for the rest of the drag
regardless of pointer type."""

F="stellar-dominion-empire2.html"
h=io.open(F,encoding="utf-8").read()

old=(
'  grab.addEventListener("pointerdown",e=>{\n'
'    if(!sheet.classList.contains("open"))return;\n'
'    y0=e.clientY; dy=0; dragging=true; sheet.classList.add("dragging");\n'
'  });\n'
)
assert h.count(old)==1
new=(
'  grab.addEventListener("pointerdown",e=>{\n'
'    if(!sheet.classList.contains("open"))return;\n'
'    y0=e.clientY; dy=0; dragging=true; sheet.classList.add("dragging");\n'
'    try{ grab.setPointerCapture(e.pointerId); }catch(_){}\n'
'  });\n'
)
assert new!=old
h=h.replace(old,new,1)

io.open(F,"w",encoding="utf-8").write(h)
print("patch595d applied")
