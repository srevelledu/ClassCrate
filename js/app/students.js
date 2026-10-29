'use strict';
/* =================================================================
   2. STUDENTS & RULES
================================================================= */
function parseNames(text) {
  return text.split(/\r?\n/).map(l => {
    let s = l.replace(/\t+/g, ' ').replace(/^\s*\d+[.)]\s+/, '').replace(/\s+/g, ' ').trim();
    const m = s.match(/^([^,]+),\s*([^,]+)$/); // "Surname, First" → "First Surname"
    if (m) s = `${m[2]} ${m[1]}`;
    return s;
  }).filter(Boolean);
}
function renderStudentsTab() {
  const cls = activeClass();
  if (document.activeElement !== $('#className')) $('#className').value = cls.name;
  if (document.activeElement !== $('#classTeacher')) $('#classTeacher').value = cls.teacher || '';
  $('#classRoom').innerHTML = data.rooms.map(r => `<option value="${r.id}" ${r.id === cls.roomId ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  $$('input[name="adj"]').forEach(r => { r.checked = r.value === cls.adjacency; });
  $('#classDel').disabled = data.classes.length < 2;
  const ic = SubjectIcons.get(classIconId(cls)), th = classTheme(cls);
  $('#classIconPreview').innerHTML = `<span class="mini-ico lg" style="background:${th.color};color:${th.ink}">${SubjectIcons.svg(ic.id)}</span>`;
  $('#classIconName').textContent = ic.label + (cls.icon && cls.icon !== 'auto' ? '' : ' (automatic)');
  const room = classRoom(cls);
  const seatN = room ? Core.roomSeats(room).filter(s => !s.unavailable).length : 0;
  const n = cls.students.length;
  $('#classSummary').innerHTML = `<h2>Summary</h2>
    <div>${n} students · ${seatN} seats in ${esc(room ? room.name : '-')}</div>
    <div>${cls.students.filter(s => s.front).length} front-priority · ${cls.students.filter(s => s.lock).length} locked</div>
    <div>${cls.rules.filter(r => r.type === 'apart').length} keep-apart · ${cls.rules.filter(r => r.type === 'together').length} keep-together</div>
    ${n > seatN ? `<div class="msg warn">There are ${n - seatN} more students than seats. Add seats in the Room tab, or some students will be left unseated.</div>` : ''}
    <button class="btn primary" data-goto="plan">Next: Seating Plan →</button>`;

  const list = $('#studentList');
  const focusedId = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.sid;
  if (!focusedId) {
    list.innerHTML = cls.students.length ? cls.students.map((s, i) => `<div class="srow" data-sid="${s.id}">
      <span class="idx">${i + 1}</span>
      <span class="srow-name">${avatar(s.name)}<input class="name" data-sid="${s.id}" value="${esc(s.name)}" aria-label="Student name"></span>
      <button class="pill-toggle ${s.front ? 'on' : ''}" data-front="${s.id}" title="Prioritise front">★ Front</button>
      <span class="lockinfo ${s.lock ? 'on' : ''}">${s.lock ? `🔒 Locked <button class="btn ghost sm" data-unlock="${s.id}" title="Unlock">✕</button>` : ''}</span>
      <button class="btn ghost sm icon" data-delst="${s.id}" title="Remove student">🗑</button></div>`).join('')
      : '<div class="empty">No students yet. Paste a list above.</div>';
  }

  const f = ui.chipFilter.toLowerCase();
  $('#ruleChips').innerHTML = cls.students.filter(s => !f || s.name.toLowerCase().includes(f))
    .map(s => `<button class="chip ${ui.ruleSel.has(s.id) ? 'sel' : ''} ${s.front ? 'front' : ''}" data-chip="${s.id}">${esc(s.name)}</button>`).join('') || '<span class="muted small">No students</span>';
  const bad = new Set(ui.result && ui.result.classId === cls.id ? [...ui.result.conflictRules, ...ui.result.brokenRules] : []);
  const ruleChip = r => `<span class="rule-chip ${r.type} ${bad.has(r.id) ? 'bad' : ''}" title="${bad.has(r.id) ? 'This rule could not be satisfied last time' : ''}">${r.members.map(id => esc(shortName(cls, id))).join(`<span class="x">${r.type === 'apart' ? '✕' : '+'}</span>`)}<button data-delrule="${r.id}" title="Remove rule">×</button></span>`;
  const ap = cls.rules.filter(r => r.type === 'apart'), tg = cls.rules.filter(r => r.type === 'together');
  $('#apartList').innerHTML = ap.length ? ap.map(ruleChip).join('') : '<span class="muted small">None yet</span>';
  $('#togetherList').innerHTML = tg.length ? tg.map(ruleChip).join('') : '<span class="muted small">None yet (optional, e.g. an EAL buddy)</span>';
  $('#makeApart').disabled = $('#makeTogether').disabled = ui.ruleSel.size < 2;
}
function bindStudents() {
  $('#classDel').addEventListener('click', async () => {
    const c = activeClass();
    if (!(await confirmBox(`Delete class “${c.name}”?`, 'Its students, rules, seating plan and groups will be removed. You can undo this.'))) return;
    mutate(() => { data.classes = data.classes.filter(x => x !== c); fixRefs(); ui.tab = 'classes'; });
    saveUI();
  });
  $('#classIconBtn').addEventListener('click', () => iconPicker(activeClass()));
  $('#className').addEventListener('change', e => { const v = e.target.value.trim(); if (v) mutate(() => { activeClass().name = v; }); });
  $('#classTeacher').addEventListener('change', e => mutate(() => { activeClass().teacher = e.target.value.trim(); }));
  $('#classRoom').addEventListener('change', e => mutate(() => { activeClass().roomId = e.target.value; }));
  $$('input[name="adj"]').forEach(r => r.addEventListener('change', e => mutate(() => { activeClass().adjacency = e.target.value; })));
  $('#addNames').addEventListener('click', () => {
    const names = parseNames($('#pasteNames').value);
    if (!names.length) return toast('Paste some names first (one per line).');
    const cls = activeClass();
    const existing = new Set(cls.students.map(s => s.name.toLowerCase()));
    let added = 0, dup = 0;
    mutate(() => {
      for (const n of names) {
        if (existing.has(n.toLowerCase())) { dup++; continue; }
        existing.add(n.toLowerCase());
        cls.students.push({ id: uid('st'), name: n, front: false, lock: null }); added++;
      }
    });
    $('#pasteNames').value = '';
    toast(`Added ${added} student${added === 1 ? '' : 's'}${dup ? ` (${dup} duplicate${dup > 1 ? 's' : ''} skipped)` : ''}.`);
  });
  const addOne = () => {
    const n = parseNames($('#oneName').value)[0];
    if (!n) return;
    const cls = activeClass();
    if (cls.students.some(s => s.name.toLowerCase() === n.toLowerCase())) return toast('That name is already in the class.');
    mutate(() => { cls.students.push({ id: uid('st'), name: n, front: false, lock: null }); });
    $('#oneName').value = '';
    $('#oneName').focus();
  };
  $('#addOne').addEventListener('click', addOne);
  $('#oneName').addEventListener('keydown', e => { if (e.key === 'Enter') addOne(); });
  $('#sortNames').addEventListener('click', () => mutate(() => { activeClass().students.sort((a, b) => a.name.localeCompare(b.name)); }));
  $('#clearNames').addEventListener('click', async () => {
    const cls = activeClass();
    if (!cls.students.length) return;
    if (!(await confirmBox(`Remove all ${cls.students.length} students from ${cls.name}?`, 'Rules and the seating plan will be cleared too. You can undo this.', 'Remove all'))) return;
    mutate(() => { cls.students = []; cls.rules = []; cls.plan = { assign: {} }; });
  });
  const list = $('#studentList');
  list.addEventListener('change', e => {
    const id = e.target.dataset.sid;
    if (!id || !e.target.classList.contains('name')) return;
    const v = e.target.value.trim();
    const cls = activeClass();
    e.target.blur();
    if (!v) { render(); return; }
    mutate(() => { cls.students.find(s => s.id === id).name = v; });
  });
  list.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('name')) e.target.blur(); });
  list.addEventListener('focusout', () => setTimeout(() => { if (ui.tab === 'students' && !list.contains(document.activeElement)) renderStudentsTab(); }, 0));
  list.addEventListener('click', e => {
    const cls = activeClass();
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.front) mutate(() => { const s = cls.students.find(x => x.id === b.dataset.front); s.front = !s.front; });
    if (b.dataset.unlock) mutate(() => { cls.students.find(x => x.id === b.dataset.unlock).lock = null; });
    if (b.dataset.delst) removeStudent(cls, b.dataset.delst);
  });
  $('#chipFilter').addEventListener('input', e => { ui.chipFilter = e.target.value; renderStudentsTab(); });
  $('#ruleChips').addEventListener('click', e => {
    const c = e.target.closest('[data-chip]');
    if (!c) return;
    const id = c.dataset.chip;
    ui.ruleSel.has(id) ? ui.ruleSel.delete(id) : ui.ruleSel.add(id);
    renderStudentsTab();
  });
  $('#clearSel').addEventListener('click', () => { ui.ruleSel.clear(); renderStudentsTab(); });
  const makeRule = type => {
    const cls = activeClass();
    const members = [...ui.ruleSel].filter(id => cls.students.some(s => s.id === id));
    if (members.length < 2) return toast('Pick at least two students.');
    const key = [...members].sort().join('|');
    if (cls.rules.some(r => r.type === type && [...r.members].sort().join('|') === key)) return toast('That rule already exists.');
    const opposite = cls.rules.find(r => r.type !== type && r.members.filter(m => members.includes(m)).length >= 2);
    mutate(() => { cls.rules.push({ id: uid('rule'), type, members }); ui.ruleSel.clear(); });
    if (opposite) toast(`Heads up: this clashes with “${ruleLabel(cls, opposite)}”.`);
  };
  $('#makeApart').addEventListener('click', () => makeRule('apart'));
  $('#makeTogether').addEventListener('click', () => makeRule('together'));
  $('#view-students').addEventListener('click', e => {
    const d = e.target.closest('[data-delrule]');
    if (d) mutate(() => { const c = activeClass(); c.rules = c.rules.filter(r => r.id !== d.dataset.delrule); });
  });
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) setTab(g.dataset.goto); });
}
function removeStudent(cls, id) {
  mutate(() => {
    cls.students = cls.students.filter(s => s.id !== id);
    cls.rules = cls.rules.map(r => ({ ...r, members: r.members.filter(m => m !== id) })).filter(r => r.members.length >= 2);
    for (const [k, v] of Object.entries(cls.plan.assign)) if (v === id) delete cls.plan.assign[k];
    cls.groups.list = cls.groups.list.map(g => g.filter(m => m !== id));
    cls.picker.picked = cls.picker.picked.filter(m => m !== id);
    if (cls.picker.last === id) cls.picker.last = null;
    cls.absent = cls.absent.filter(m => m !== id);
    ui.ruleSel.delete(id);
  });
}

/* ---------- CSV class-list import ---------- */
/* Reads a CSV (school system export or spreadsheet), shows what it found, and adds the names to the
   class or replaces the class list. Parsing lives in Tools.parseCSV / Tools.namesFromRows (tested). */
async function importCsv(file) {
  let text;
  try { text = await file.text(); } catch { return toast("Couldn't read that file."); }
  const rows = Tools.parseCSV(text);
  if (!rows.length) return toast('That file is empty.');
  const cls = activeClass();
  let swap = false;
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  const draw = () => {
    const res = Tools.namesFromRows(rows, { swap }), have = new Set(cls.students.map(s => s.name.toLowerCase()));
    const fresh = res.names.filter(n => !have.has(n.toLowerCase()));
    const twoCols = res.columns.includes('+');
    bg.innerHTML = `<form class="modal wide" role="dialog" aria-label="Import class list"><h3>Import class list</h3>
      <p>Found <b>${res.names.length}</b> name${res.names.length === 1 ? '' : 's'} using <b>${esc(res.columns)}</b>${res.names.length - fresh.length ? `. ${res.names.length - fresh.length} already in ${esc(cls.name)}.` : '.'}</p>
      <div class="csv-preview">${res.names.slice(0, 12).map(n => `<span class="chip">${esc(n)}</span>`).join('')}${res.names.length > 12 ? `<span class="hint">…and ${res.names.length - 12} more</span>` : ''}</div>
      ${twoCols ? '<label class="check"><input type="checkbox" id="csvSwap" ' + (swap ? 'checked' : '') + '> Names look back to front? Swap first name and surname</label>' : ''}
      ${cls.students.length ? `<label class="check"><input type="radio" name="csvMode" value="add" checked> Add the ${fresh.length} new name${fresh.length === 1 ? '' : 's'} to ${esc(cls.name)}</label>
      <label class="check"><input type="radio" name="csvMode" value="replace"> Replace the class list (removes ${cls.students.length} students, their rules and seats)</label>` : ''}
      <div class="btn-row"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary" ${res.names.length ? '' : 'disabled'}>Import</button></div></form>`;
    bg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const replace = (bg.querySelector('input[name=csvMode]:checked') || {}).value === 'replace';
      bg.remove();
      const list = replace ? res.names : fresh;
      mutate(() => {
        if (replace) { cls.students = []; cls.rules = []; cls.plan = { assign: {} }; cls.groups.list = []; cls.picker.picked = []; cls.picker.last = null; cls.absent = []; }
        for (const n of list) cls.students.push({ id: uid('st'), name: n, front: false, lock: null });
      });
      toast(`${replace ? 'Replaced the class list with' : 'Added'} ${list.length} student${list.length === 1 ? '' : 's'}`);
    });
  };
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) bg.remove(); });
  bg.addEventListener('change', e => { if (e.target.id === 'csvSwap') { swap = e.target.checked; draw(); } });
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') bg.remove(); });
  draw();
  document.body.appendChild(bg);
  bg.querySelector('button[type=submit]').focus();
}
function bindCsvImport() {
  $('#csvBtn').addEventListener('click', () => $('#csvFile').click());
  $('#csvFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importCsv(f); });
}
