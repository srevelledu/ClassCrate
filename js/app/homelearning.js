'use strict';
/* =================================================================
   6. HOME LEARNING
   Tasks (title, set date, due date) and, for each student, whether it came in: submitted, late or
   excused. Tapping a cell steps through the statuses. Once a task is past due, anything not handed
   in shows as missing.
================================================================= */
const HL_STATES = ['', 'done', 'late', 'excused'];
const HL_LABEL = { '': 'Not in yet', done: 'Submitted', late: 'Submitted late', excused: 'Excused', missing: 'Missing' };
const HL_MARK = { '': '', done: '✓', late: 'L', excused: '–', missing: '!' };
const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
const shortDate = iso => iso ? new Date(iso + 'T00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const pastDue = t => t.due && t.due < isoDate();
/* A student's status for a task, with "missing" for anything not in once the due date has passed. */
const hlStatus = (t, id) => t.subs[id] || (pastDue(t) ? 'missing' : '');

function hlStudentRate(cls, id) {
  const counted = cls.homework.filter(t => pastDue(t) || t.subs[id]);
  const due = counted.filter(t => t.subs[id] !== 'excused');
  const inn = due.filter(t => t.subs[id] === 'done' || t.subs[id] === 'late').length;
  return { inn, due: due.length };
}
function hlTaskCount(cls, t) {
  const ids = cls.students.map(s => s.id);
  const inn = ids.filter(id => t.subs[id] === 'done' || t.subs[id] === 'late').length;
  const excused = ids.filter(id => t.subs[id] === 'excused').length;
  return { inn, of: ids.length - excused };
}

/* Tasks, newest due date first. */
const hlOrder = cls => cls.homework.slice().sort((a, b) => (b.due || '').localeCompare(a.due || '') || b.created - a.created);
function hlCellAttrs(cls, t, s) {
  const st = hlStatus(t, s.id);
  return { cls: `hl-cell hl-${st || 'none'}`, mark: HL_MARK[st], title: `${s.name}: ${HL_LABEL[st]} (tap to change)`, label: `${s.name}, ${t.title}: ${HL_LABEL[st]}` };
}
function hlRateCell(cls, s) {
  const r = hlStudentRate(cls, s.id), pct = r.due ? Math.round(100 * r.inn / r.due) : null;
  return `<td class="hl-rate ${pct !== null && pct < 70 ? 'low' : ''}">${pct === null ? '—' : `${r.inn}/${r.due}<span class="hl-bar"><i style="width:${pct}%"></i></span>`}</td>`;
}
function renderHlTaskList(cls, order) {
  $('#hlTaskList').innerHTML = order.length ? order.map(t => {
    const c = hlTaskCount(cls, t), missing = pastDue(t) ? cls.students.filter(s => hlStatus(t, s.id) === 'missing').length : 0;
    return `<div class="set-row"><div class="grow"><b>${esc(t.title)}</b><div class="hint">Due ${esc(shortDate(t.due)) || '—'} · ${c.inn}/${c.of} in${missing ? ` · <span class="hl-miss-text">${missing} missing</span>` : ''}</div></div>
      <button class="btn sm ghost icon" data-hl-menu="${t.id}" aria-label="Options for ${esc(t.title)}">${UI_ICON.dots}</button></div>`;
  }).join('') : '<div class="hint">No tasks yet.</div>';
}

function renderHomeLearningTab() {
  const cls = activeClass(), tasks = cls.homework;
  if (document.activeElement !== $('#hlDue') && !$('#hlDue').value) $('#hlDue').value = addDays(isoDate(), 7);
  const order = hlOrder(cls);
  renderHlTaskList(cls, order);

  const grid = $('#hlGrid');
  // a redraw (undo, marking everyone in...) keeps the grid scrolled to where it was
  const old = grid.querySelector('.hl-scroll'), keep = old && { top: old.scrollTop, left: old.scrollLeft };
  if (!cls.students.length) { grid.innerHTML = '<div class="empty">Add students on the Students tab first.</div>'; return; }
  if (!tasks.length) { grid.innerHTML = '<div class="empty">No home learning yet. Add a task on the left, then tap each student’s box as their work comes in.</div>'; return; }
  const head = order.map(t => {
    const c = hlTaskCount(cls, t);
    return `<th class="hl-th ${pastDue(t) ? 'past' : ''}" scope="col"><button class="hl-head" data-hl-menu="${t.id}"><b>${esc(t.title)}</b><span>Due ${esc(shortDate(t.due))}</span><span class="hl-count">${c.inn}/${c.of}</span></button></th>`;
  }).join('');
  const rows = cls.students.map(s => {
    const cells = order.map(t => {
      const a = hlCellAttrs(cls, t, s);
      return `<td><button class="${a.cls}" data-hl="${t.id}|${s.id}" title="${esc(a.title)}" aria-label="${esc(a.label)}">${a.mark}</button></td>`;
    }).join('');
    return `<tr><th scope="row" class="hl-name">${avatar(s.name)}<span>${esc(s.name)}</span></th>${cells}${hlRateCell(cls, s)}</tr>`;
  }).join('');
  grid.innerHTML = `<div class="hl-legend">${['done', 'late', 'excused', 'missing'].map(k => `<span><i class="hl-cell hl-${k}">${HL_MARK[k]}</i>${HL_LABEL[k]}</span>`).join('')}<span class="hint">Tap a box to change it.</span></div>
    <div class="hl-scroll"><table class="hl-table"><thead><tr><th class="hl-name" scope="col">Student</th>${head}<th class="hl-rate" scope="col">Handed in</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  if (keep) { const sc = grid.querySelector('.hl-scroll'); sc.scrollTop = keep.top; sc.scrollLeft = keep.left; }
}
/* After one box changes: update that box, the student's total, the task's count and the task list in
   place, so the grid isn't redrawn and nothing scrolls. */
function updateHlCell(btn, t, sid) {
  const cls = activeClass(), s = cls.students.find(x => x.id === sid);
  const a = hlCellAttrs(cls, t, s);
  btn.className = a.cls; btn.textContent = a.mark; btn.title = a.title; btn.setAttribute('aria-label', a.label);
  const rate = btn.closest('tr').querySelector('td.hl-rate');
  if (rate) rate.outerHTML = hlRateCell(cls, s);
  const c = hlTaskCount(cls, t), count = document.querySelector(`.hl-head[data-hl-menu="${t.id}"] .hl-count`);
  if (count) count.textContent = `${c.inn}/${c.of}`;
  renderHlTaskList(cls, hlOrder(cls));
}

/* A small form dialog (title + fields) resolving to the entered values, or null on cancel. */
function formModal({ title, fields, ok = 'Save' }) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<form class="modal" role="dialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3>
      ${fields.map(f => `<label class="field"><span>${esc(f.label)}</span><input class="input" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value || '')}" ${f.required ? 'required' : ''}></label>`).join('')}
      <div class="btn-row"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">${esc(ok)}</button></div></form>`;
    document.body.appendChild(bg);
    const done = v => { bg.remove(); resolve(v); };
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) done(null); });
    bg.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); });
    bg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      done(Object.fromEntries(fields.map(f => [f.name, bg.querySelector(`[name="${f.name}"]`).value.trim()])));
    });
    bg.querySelector('input').focus();
  });
}

function hlTaskMenu(anchor, id) {
  const cls = activeClass(), t = cls.homework.find(x => x.id === id);
  if (!t) return;
  popMenu(anchor, [
    { label: 'Copy who hasn’t handed it in', fn: async () => {
      const names = cls.students.filter(s => !['done', 'late', 'excused'].includes(t.subs[s.id])).map(s => s.name);
      if (!names.length) return toast('Everyone has handed it in.');
      const txt = `${t.title} (due ${shortDate(t.due)}), not handed in: ${names.join(', ')}`;
      try { await navigator.clipboard.writeText(txt); toast(`Copied ${names.length} name${names.length === 1 ? '' : 's'} ✓`); } catch { toast("Couldn't copy in this browser."); }
    } },
    { label: 'Mark everyone not in yet as submitted', fn: () => mutate(() => { for (const s of cls.students) if (!t.subs[s.id]) t.subs[s.id] = 'done'; }) },
    { label: 'Edit task', fn: async () => {
      const v = await formModal({ title: 'Edit task', fields: [{ name: 'title', label: 'Task', value: t.title, required: true }, { name: 'set', label: 'Set on', type: 'date', value: t.set }, { name: 'due', label: 'Due', type: 'date', value: t.due }] });
      if (v && v.title) mutate(() => Object.assign(t, v));
    } },
    { label: 'Delete task', danger: true, fn: async () => {
      if (await confirmBox(`Delete “${t.title}”?`, 'Its submission record will be removed. You can undo this.')) mutate(() => { cls.homework = cls.homework.filter(x => x !== t); });
    } },
  ]);
}

function bindHomeLearning() {
  $('#hlAdd').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#hlTitle').value.trim();
    if (!title) { $('#hlTitle').focus(); return toast('Give the task a name first.'); }
    mutate(() => { activeClass().homework.push({ id: uid('hw'), title, set: isoDate(), due: $('#hlDue').value || addDays(isoDate(), 7), created: Date.now(), subs: {} }); });
    $('#hlTitle').value = ''; $('#hlDue').value = '';
    toast(`Added “${title}”`);
  });
  $('#view-homework').addEventListener('click', e => {
    const m = e.target.closest('[data-hl-menu]');
    if (m) return hlTaskMenu(m, m.dataset.hlMenu);
    const c = e.target.closest('[data-hl]');
    if (!c) return;
    const [tid, sid] = c.dataset.hl.split('|');
    const t = activeClass().homework.find(x => x.id === tid);
    if (!t) return;
    mutate(() => {
      const next = HL_STATES[(HL_STATES.indexOf(t.subs[sid] || '') + 1) % HL_STATES.length];
      if (next) t.subs[sid] = next; else delete t.subs[sid];
    }, { noRender: true });
    updateHlCell(c, t, sid);   // the box keeps its place and keyboard focus
  });
}
