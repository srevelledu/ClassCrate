'use strict';
/* =================================================================
   0. CLASSES HOME + class switcher
================================================================= */
const CLASS_TABS = ['students', 'plan', 'groups', 'picker', 'timer', 'noise', 'homework'];
const TAB_LABEL = { students: 'Students', plan: 'Seating plan', groups: 'Groups', picker: 'Picker', timer: 'Timer', noise: 'Noise meter', homework: 'Home learning' };
function openClass(id, tab) {
  data.activeClassId = id; ui.ruleSel.clear(); ui.selStudent = null; ui.grpSel = null;
  save(); setTab(tab || 'students');
}
/* Set up a class: name plus seat colour (a random unused colour is preselected), with a live
   preview of the automatic subject icon in that colour. */
const seatSwatches = sel => Object.keys(SEAT_COLOURS).map(k => `<button type="button" class="seat-sw ${k === sel ? 'on' : ''}" data-col="${k}" style="background:${SEAT_COLOURS[k]}" title="${k[0].toUpperCase() + k.slice(1)}" aria-label="${k}" aria-pressed="${k === sel}"></button>`).join('');
/* Copy another class's students (with front-priority flags) and keep-apart/together rules into a new
   class. Students get new ids so the two classes stay independent; seat locks aren't copied because
   they belong to the other class's room. */
function copyStudentsAndRules(from, to) {
  const map = new Map();
  to.students = from.students.map(s => { const id = uid('st'); map.set(s.id, id); return { id, name: s.name, front: !!s.front, lock: null }; });
  to.rules = from.rules.map(r => ({ id: uid('rule'), type: r.type, members: r.members.map(m => map.get(m)).filter(Boolean) })).filter(r => r.members.length >= 2);
  to.adjacency = from.adjacency;
}
async function newClass() {
  let colour = pickSeatColour();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal" role="dialog" aria-label="New class"><h3>New class</h3>
    <label class="field"><span>Class name</span><input class="input" id="ncName" placeholder="e.g. 12CHEM or Year 9 Maths" autocomplete="off"></label>
    <div class="field"><span>Colour</span><div class="swatch-row" id="ncSwatches">${seatSwatches(colour)}</div></div>
    <label class="field"><span>Room for seating plans</span><select class="input" id="ncRoom">${data.rooms.map(r => `<option value="${r.id}" ${r.id === (classRoom(activeClass()) || {}).id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Start with</span><select class="input" id="ncFrom"><option value="">An empty class list</option>${data.classes.filter(c => c.students.length).map(c => `<option value="${c.id}">Students and rules from ${esc(c.name)} (${c.students.length})</option>`).join('')}</select></label>
    <div class="nc-preview" id="ncPreview"></div>
    <div class="btn-row"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Create class</button></div></form>`;
  document.body.appendChild(bg);
  const inp = bg.querySelector('#ncName');
  const preview = () => {
    const name = inp.value.trim(), ic = SubjectIcons.get(SubjectIcons.guess(name)), th = classTheme({ color: colour });
    bg.querySelector('#ncPreview').innerHTML = `<span class="mini-ico lg" style="background:${th.color};color:${th.ink}">${SubjectIcons.svg(ic.id)}</span>
      <span><b>${esc(name || 'New class')}</b><span class="hint">Icon: ${esc(ic.label)} (change it later under Colour &amp; icon)</span></span>`;
  };
  const close = () => bg.remove();
  bg.addEventListener('click', e => {
    if (e.target === bg || e.target.closest('[data-close]')) return close();
    const sw = e.target.closest('[data-col]');
    if (sw) {
      colour = sw.dataset.col;
      bg.querySelector('#ncSwatches').innerHTML = seatSwatches(colour);
      bg.querySelector('#ncSwatches .on').focus(); // keep keyboard focus after re-drawing
      preview();
    }
  });
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  inp.addEventListener('input', preview);
  bg.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const name = inp.value.trim();
    if (!name) { inp.focus(); return toast('Give the class a name first.'); }
    const from = data.classes.find(c => c.id === bg.querySelector('#ncFrom').value), roomId = bg.querySelector('#ncRoom').value;
    close();
    mutate(() => {
      const c = blankClass(name);
      c.roomId = roomId || data.activeRoomId; c.color = colour;
      if (from) copyStudentsAndRules(from, c);
      data.classes.push(c); data.activeClassId = c.id; ui.tab = 'students';
    });
    saveUI();
    if (from) toast(`Copied ${from.students.length} students and ${from.rules.length} rule${from.rules.length === 1 ? '' : 's'} from ${from.name}`);
  });
  preview();
  inp.focus();
}
const UI_ICON = { dots: '<svg class="ico fill" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>' };
function renderCrumb() {
  const el = $('#crumb');
  if (CLASS_TABS.includes(ui.tab)) {
    const cls = activeClass(), ic = SubjectIcons.get(classIconId(cls)), th = classTheme(cls);
    el.innerHTML = `<span class="crumb-sep">›</span><span class="crumb-class"><span class="mini-ico" style="background:${th.color};color:${th.ink}">${SubjectIcons.svg(ic.id)}</span><span class="crumb-name">${esc(cls.name)}</span>${cls.sample ? '<span class="sample-tag">Example</span>' : ''}</span>`;
  } else if (ui.tab === 'room') el.innerHTML = '<span class="crumb-sep">›</span><span class="crumb-name">Rooms</span>';
  else el.innerHTML = '';
}
const isNarrow = () => matchMedia('(max-width: 900px)').matches;
function renderRail() {
  $('#guideRail').hidden = !ui.guide.hidden;
  const inClass = CLASS_TABS.includes(ui.tab);
  $('#rail').classList.toggle('open', !!ui.railOpen);
  document.body.classList.toggle('rail-open', !!ui.railOpen);
  $$('#rail [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === ui.tab));
  $('#railClasses').innerHTML = data.classes.map(c => {
    const ic = SubjectIcons.get(classIconId(c)), th = classTheme(c);
    return `<button class="rail-item ${inClass && c.id === data.activeClassId ? 'active' : ''}" data-open="${c.id}" title="${esc(c.name)}"><span class="mini-ico" style="background:${th.color};color:${th.ink}">${SubjectIcons.svg(ic.id)}</span><span class="lbl">${esc(c.name)}</span></button>`;
  }).join('');
}
/* Class cards are notes pinned to a board, each with its own slight tilt (fixed per class, so it
   doesn't change between visits). */
const NOTE_TILTS = [-1.4, 1, -0.7, 1.3, -1, 0.6];
function renderClassesHome() {
  renderGuide();
  $('#classGrid').innerHTML = data.classes.map(c => {
    const ic = SubjectIcons.get(classIconId(c)), th = classTheme(c), room = classRoom(c);
    const sub = [c.teacher, `${c.students.length} student${c.students.length === 1 ? '' : 's'}`].filter(Boolean).map(esc).join(' · ');
    const tilt = NOTE_TILTS[[...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % NOTE_TILTS.length];
    const meta = [sub, room ? esc(room.name) : ''].filter(Boolean).join(' · ');
    return `<article class="class-card" data-open="${c.id}" tabindex="0" aria-label="Open ${esc(c.name)}" style="--c:${th.color};--fg:${th.fg};--tilt:${tilt}deg">
      <span class="cc-pin" aria-hidden="true"></span>
      <span class="cc-icon">${SubjectIcons.svg(ic.id)}</span>
      <button class="cc-menu" data-menu="${c.id}" aria-label="Options for ${esc(c.name)}">${UI_ICON.dots}</button>
      <div class="cc-text">${c.sample ? '<span class="sample-tag">Example · made-up names</span>' : ''}<h3 class="cc-title">${esc(c.name)}</h3><div class="cc-sub">${meta}</div></div>
    </article>`;
  }).join('');
}

/* ---------- pop-up menu (card ⋮ and the ＋ button) ---------- */
let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener('pointerdown', menuOutside, true); } }
function menuOutside(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }
function popMenu(anchor, items) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'menu';
  menuEl.setAttribute('role', 'menu');
  menuEl.innerHTML = items.map((it, i) => `<button role="menuitem" data-mi="${i}" class="${it.danger ? 'danger' : ''}">${esc(it.label)}</button>`).join('');
  document.body.appendChild(menuEl);
  const r = anchor.getBoundingClientRect();
  menuEl.style.top = Math.min(r.bottom + 4, innerHeight - menuEl.offsetHeight - 8) + 'px';
  menuEl.style.left = clamp(r.right - menuEl.offsetWidth, 8, innerWidth - menuEl.offsetWidth - 8) + 'px';
  menuEl.addEventListener('click', e => { const b = e.target.closest('[data-mi]'); if (b) { closeMenu(); items[+b.dataset.mi].fn(); } });
  menuEl.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); anchor.focus(); } });
  document.addEventListener('pointerdown', menuOutside, true);
  menuEl.querySelector('button').focus();
}
function classMenu(anchor, id) {
  const c = data.classes.find(x => x.id === id);
  if (!c) return;
  popMenu(anchor, [
    { label: 'Open', fn: () => openClass(id) },
    { label: 'Rename', fn: async () => { const n = await askText('Rename class', c.name); if (n) mutate(() => { c.name = n; }); } },
    { label: 'Colour & icon', fn: () => iconPicker(c) },
    { label: 'Duplicate', fn: () => mutate(() => {
      const d = normClass({ ...JSON.parse(JSON.stringify(c)), id: uid('class'), name: c.name + ' (copy)', plan: { assign: {} }, groups: undefined, picker: undefined, absent: [] });
      delete d.sample; d.color = pickSeatColour(); data.classes.push(d);
    }) },
    { label: 'Delete', danger: true, fn: async () => {
      if (data.classes.length < 2) return toast('You need at least one class.');
      if (!(await confirmBox(`Delete class “${c.name}”?`, 'Its students, rules, seating plan and groups will be removed. You can undo this.'))) return;
      mutate(() => { data.classes = data.classes.filter(x => x !== c); fixRefs(); });
    } },
  ]);
}

/* ---------- icon picker ---------- */
const classIconId = c => (c.icon && c.icon !== 'auto' && SubjectIcons.get(c.icon).id === c.icon) ? c.icon : SubjectIcons.guess(c.name);
function iconPicker(cls) {
  const auto = SubjectIcons.get(SubjectIcons.guess(cls.name)), th = classTheme(cls);
  const cur = cls.icon && cls.icon !== 'auto' ? cls.icon : 'auto';
  const cell = (id, ic, label) => `<button class="ico-cell ${cur === id ? 'on' : ''}" data-ico="${id}" data-label="${esc(label.toLowerCase())}"><span class="ico-chip" style="background:${th.color};color:${th.ink}">${SubjectIcons.svg(ic.id)}</span>${esc(label)}</button>`;
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal wide" role="dialog" aria-label="Choose an icon"><h3>Colour and icon for ${esc(cls.name)}</h3>
    <div class="swatch-row" role="group" aria-label="Class colour">${Object.keys(SEAT_COLOURS).map(k => `<button class="seat-sw ${classTheme(cls).color === SEAT_COLOURS[k] ? 'on' : ''}" data-col="${k}" style="background:${SEAT_COLOURS[k]}" title="${k[0].toUpperCase() + k.slice(1)}" aria-label="${k}"></button>`).join('')}</div>
    <p>Automatic picks an icon from the class name. Choose one to use it instead.</p>
    <input class="input" id="icoFilter" placeholder="Search subjects…" aria-label="Search subjects">
    <div class="ico-grid">${cell('auto', auto, `Automatic (${auto.label})`)}${SubjectIcons.list.map(ic => cell(ic.id, ic, ic.label)).join('')}</div>
    <div class="btn-row"><button class="btn" data-close>Cancel</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', e => {
    if (e.target === bg || e.target.closest('[data-close]')) return close();
    const sw = e.target.closest('[data-col]');
    if (sw) {
      mutate(() => { cls.color = sw.dataset.col; });
      const t = classTheme(cls);
      bg.querySelectorAll('.seat-sw').forEach(x => x.classList.toggle('on', x === sw));
      bg.querySelectorAll('.ico-chip').forEach(ch => { ch.style.background = t.color; ch.style.color = t.ink; });
      return;
    }
    const b = e.target.closest('[data-ico]');
    if (b) { close(); mutate(() => { cls.icon = b.dataset.ico; }); }
  });
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  const f = bg.querySelector('#icoFilter');
  f.addEventListener('input', () => {
    const q = f.value.trim().toLowerCase();
    bg.querySelectorAll('.ico-cell').forEach(c => { c.hidden = !!q && !c.dataset.label.includes(q); });
  });
  f.focus();
}

function bindHome() {
  $('#homeBtn').addEventListener('click', () => setTab('classes'));
  $('#railToggle').addEventListener('click', () => { ui.railOpen = !ui.railOpen; saveUI(); renderRail(); });
  $('#scrim').addEventListener('click', () => { ui.railOpen = false; saveUI(); renderRail(); });
  $('#rail').addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]'), open = e.target.closest('[data-open]');
    if (isNarrow()) { ui.railOpen = false; saveUI(); } // the overlay closes once you pick something
    if (nav) {
      if (nav.dataset.nav === 'room') { const r = classRoom(activeClass()); if (r) data.activeRoomId = r.id; }
      setTab(nav.dataset.nav);
    } else if (open) openClass(open.dataset.open, CLASS_TABS.includes(ui.tab) ? ui.tab : 'students');
    else renderRail();
  });
  $('#classGrid').addEventListener('click', e => {
    const m = e.target.closest('[data-menu]');
    if (m) { classMenu(m, m.dataset.menu); return; }
    const c = e.target.closest('[data-open]');
    if (c) openClass(c.dataset.open);
  });
  $('#classGrid').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.class-card[data-open]')) { e.preventDefault(); openClass(e.target.dataset.open); }
  });
  $('#createBtn').addEventListener('click', e => popMenu(e.currentTarget, [
    { label: 'Create class', fn: newClass },
    { label: 'Import backup…', fn: () => $('#importFile').click() },
    { label: 'Backup & data…', fn: dataMenu },
  ]));
  // attendance chips (Groups + Random picker share the same "here today" list)
  for (const sel of ['#grpAbsent', '#pkAbsent']) {
    $(sel).addEventListener('click', e => {
      const b = e.target.closest('[data-absent]');
      if (b) mutate(() => { const c = activeClass(); const a = new Set(c.absent); a.has(b.dataset.absent) ? a.delete(b.dataset.absent) : a.add(b.dataset.absent); c.absent = [...a]; });
      if (e.target.closest('[data-allhere]')) mutate(() => { activeClass().absent = []; });
    });
  }
}

/* ---------- attendance ---------- */
const isAbsent = (cls, id) => cls.absent.includes(id);
const presentStudents = cls => cls.students.filter(s => !isAbsent(cls, s.id));
/* Each class gets one of the six class colours, chosen at random when it is created
   (preferring colours no other class uses yet). Yellow takes navy text for contrast. */
const SEAT_COLOURS = { blue: '#016df8', green: '#04af4f', red: '#fa3e42', orange: '#fa6002', yellow: '#fab001', teal: '#01aab5' };
function pickSeatColour() {
  const used = {};
  for (const c of (data && data.classes) || []) if (c.color) used[c.color] = (used[c.color] || 0) + 1;
  const keys = Object.keys(SEAT_COLOURS), least = Math.min(...keys.map(k => used[k] || 0));
  const pool = keys.filter(k => (used[k] || 0) === least);
  return pool[Math.floor(Math.random() * pool.length)];
}
function classTheme(c) {
  const key = SEAT_COLOURS[c.color] ? c.color : 'blue', color = SEAT_COLOURS[key];
  return { color, ink: key === 'yellow' ? '#0a1c3f' : '#ffffff', fg: key === 'yellow' ? '#c98a00' : color };
}
const AV_COLORS = ['#016df8', '#04af4f', '#fa3e42', '#fa6002', '#e09a00', '#01aab5', '#7b4dff', '#0a1c3f'];
function avatar(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="av" style="background:${AV_COLORS[h % AV_COLORS.length]}">${esc((String(name).trim()[0] || '?').toUpperCase())}</span>`;
}
function attendanceHtml(cls) {
  if (!cls.students.length) return '<span class="muted small">No students yet. Add them on the Students tab.</span>';
  const away = cls.absent.length;
  return `<div class="row small"><span class="grow">${cls.students.length - away} here${away ? ` · ${away} absent` : ''}</span>${away ? '<button class="btn sm ghost" data-allhere>Mark everyone here</button>' : ''}</div>
    <div class="chips">${cls.students.map(s => `<button class="chip ${isAbsent(cls, s.id) ? 'absent' : ''}" data-absent="${s.id}" title="${isAbsent(cls, s.id) ? 'Absent: tap to mark here' : 'Tap to mark absent'}">${esc(s.name)}</button>`).join('')}</div>`;
}
