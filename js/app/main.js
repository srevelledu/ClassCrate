'use strict';
/* =================================================================
   keyboard + init
================================================================= */
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || $('.modal-bg');
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (!typing && ui.tab === 'picker' && e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); pickOne(); return; }
  if (!typing && ui.tab === 'timer' && e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); toggleTimer(); return; }
  if (typing || ui.tab !== 'room') return;
  if (ui.tool === 'draw') {
    if (e.key === 'Escape') { ui.drawPts = []; ui.drawHover = null; renderRoomSvg(); }
    if (e.key === 'Enter') finishPolygon();
    if (e.key === 'Backspace' && ui.drawPts && ui.drawPts.length) { e.preventDefault(); ui.drawPts.pop(); renderRoomSvg(); }
    return;
  }
  if (ui.tool === 'shape' && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); deleteVertex(); return; }
  if (ui.tool !== 'select' || !ui.selItem) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); itemAction('del'); }
  else if (e.key.toLowerCase() === 'r' && !mod) itemAction('rotate');
  else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); itemAction('dup'); }
  else if (e.key === 'Escape') { ui.selItem = null; renderRoomTab(); }
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const room = activeRoom(), it = getItem(room, ui.selItem);
    const k = fstep(room);
    const d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key];
    const t = { ...it, x: r2(it.x + d[0]), y: r2(it.y + d[1]) };
    if (Core.isWall(it)) { mutate(() => snapWallItem(room, it, { x: it.x + d[0], y: it.y + d[1] })); return; }
    if (Core.itemProblem(room, t)) return toast("Can't move it there.");
    mutate(() => { it.x = t.x; it.y = t.y; });
  }
});

function init() {
  const stored = readJSON(STORE_KEY);
  if (stored && Array.isArray(stored.rooms) && Array.isArray(stored.classes)) {
    data = { ...stored, rooms: stored.rooms.map(normRoom), classes: stored.classes.map(normClass) };
    if ((stored.version || 1) < 2) {
      // v1 furniture was oversized; swap the untouched sample rooms for the realistically sized ones (same ids, so plans still fit)
      const fresh = Sample.rooms().map(normRoom);
      data.rooms = data.rooms.map(r => (r.sample && fresh.find(f => f.id === r.id)) || r);
      data.version = 2;
      save();
    }
    if (data.version < 3) {
      // v3: plans default to "First L." labels, which print far more legibly
      for (const c of data.classes) c.nameFormat = 'initial';
      data.version = 3;
      save();
    }
    if (data.version < 4) {
      // v4: the example class switches from realistic-sounding names to famous scientists, so it can't be
      // mistaken for a real class list. Only an untouched copy (every name still the original) is swapped.
      const ex = data.classes.find(c => c.sample && c.id === 'class_10sci');
      if (ex && ex.students.length === Sample.OLD_NAMES.length && ex.students.every((s, i) => s.name === Sample.OLD_NAMES[i])) {
        const fresh = Sample.classes()[0];
        ex.students.forEach((s, i) => { s.name = fresh.students[i].name; s.front = fresh.students[i].front; });
        ex.rules = fresh.rules;
        if (ex.name === '10SCI') ex.name = fresh.name;
        if (ex.teacher === 'Ms Delaney') ex.teacher = fresh.teacher;
      }
      data.version = 4;
      save();
    }
  } else {
    data = freshData();
    // pre-generate the sample so the plan tab shows something straight away
    const c = data.classes[0], r = classRoom(c);
    const res = Core.solve({ seats: Core.roomSeats(r), students: c.students, rules: c.rules, mode: c.adjacency, fill: c.fill, seed: 20261027, label: x => ruleLabel(c, x) });
    c.plan = { assign: res.assignment, at: Date.now() };
    ui.result = { classId: c.id, ...res };
    save();
  }
  fixRefs();
  if (isNarrow()) ui.railOpen = false;
  $$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#dataBtn').addEventListener('click', dataMenu);
  bindHome(); bindRoom(); bindStudents(); bindPlan(); bindGroups(); bindPicker(); bindHomeLearning(); bindCsvImport(); bindClassTools(); bindPresent(); bindGuide();
  window.addEventListener('resize', () => { if (ui.tab === 'room') renderRoomSvg(); });
  render();
  if (document.fonts && document.fonts.load) {
    Promise.all(['400', '500', '600', '700'].map(w => document.fonts.load(`${w} 16px Poppins`))).then(() => render()).catch(() => {});
  }
}
init();
window.__seating = { get data() { return data; }, ui, generate, buildPlanSVG, renderCanvas, makePdf };
