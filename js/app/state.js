'use strict';
/* App state, persistence, undo, accessors, toast + modal, top-level render.
   The app is split into plain scripts loaded in order (see index.html); they share the page's
   global scope, so names declared in one file are visible to the files after it. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
const clamp = Core.clamp;
const r2 = v => Math.round(v * 100) / 100;
// Storage keys keep their original (Seating Planner) names so existing saved data still loads.
const STORE_KEY = 'seatingPlanner.v1';
const UI_KEY = 'seatingPlanner.ui';
const FONT_STACK = "Poppins, 'Segoe UI', Arial, sans-serif";

const PALETTES = {
  pastel:  { name: 'Soft pastel', tables: ['#F8D4D0', '#FBE3C4', '#D6EDD6', '#CFE3F5', '#E2D8F3', '#F7D6E6', '#CDEBE8', '#F2EBC4'], accent: '#5B67D8', board: '#2E3648', wall: '#3A4150', floor: '#FFFFFF', page: '#FFFFFF', head: '#F3F1FB', ink: '#262B36', ink2: '#6A7080', window: '#A9CDE8', teacher: '#ECEEF3' },
  earth:   { name: 'Muted earth', tables: ['#E6D3C1', '#C8D5C0', '#D9CFC0', '#BDD0D4', '#E2C6BD', '#D5D0E0', '#CEC6AE', '#C4D8CC'], accent: '#A86B54', board: '#3C463B', wall: '#4A4540', floor: '#FFFDF9', page: '#FFFDF9', head: '#F4EEE6', ink: '#2F2A26', ink2: '#7A7066', window: '#B9CFD3', teacher: '#EEE9E1' },
  coastal: { name: 'Coastal',     tables: ['#CFE6EF', '#D6ECE2', '#BED7E8', '#E6EAF6', '#C4E2DC', '#D9E2F2', '#B9DED6', '#E0EDE8'], accent: '#2878A0', board: '#1D3A4C', wall: '#284050', floor: '#FFFFFF', page: '#FFFFFF', head: '#EAF4F8', ink: '#1C2B36', ink2: '#5D7080', window: '#9CC9E3', teacher: '#E8EEF2' },
  sorbet:  { name: 'Sorbet',      tables: ['#FFC4B5', '#FFDDB0', '#BEE5D3', '#FCD0DE', '#C9DDF7', '#E6D3F5', '#FFE9A8', '#B8E3E8'], accent: '#E0705A', board: '#33303F', wall: '#3B3846', floor: '#FFFFFF', page: '#FFFFFF', head: '#FFF1EC', ink: '#2A2733', ink2: '#6E6878', window: '#AFD4EC', teacher: '#F1EEF3' },
};

/* ================= state ================= */
let data = null;
const ui = Object.assign({
  tab: 'classes', railOpen: true, tool: 'select', showDist: true, showPrivate: true, snapAngles: true,
}, readJSON(UI_KEY) || {});
ui.selItem = null; ui.multi = []; ui.box = null; ui.selVertex = null; ui.drawPts = null; ui.drawHover = null; ui.view = null; ui.viewRoom = null;
ui.grpSel = null; ui.preview = null; ui.ruleSel = new Set(); ui.selStudent = null; ui.result = null; ui.chipFilter = '';

function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: ui.tab, railOpen: ui.railOpen, tool: ui.tool, showDist: ui.showDist, showPrivate: ui.showPrivate, snapAngles: ui.snapAngles, guide: ui.guide })); } catch { /* ignore */ } }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { toast('Could not save to this browser (storage full or blocked). Use Data → Export to back up.'); }
  }, 150);
}

function todayStr() { return new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); }

function normRoom(r) {
  const out = Object.assign({ id: uid('room'), name: 'Room', scale: 0.5, showMetres: true, boundary: Sample.PRESETS.rectangle.boundary.map(p => ({ ...p })), items: [] }, r);
  for (const it of out.items) {
    // v1 stored board/door/window/bench lengths in grid squares; v2 stores metres
    if (it.lenM == null && it.len != null) it.lenM = Math.round(it.len * out.scale * 100) / 100;
    delete it.len;
  }
  return out;
}
function normClass(c) {
  const out = Object.assign({ id: uid('class'), name: 'Class', roomId: null, teacher: '', date: '', roomLabel: '', students: [], rules: [], adjacency: 'adjacent', fill: 'front', perspective: 'teacher', palette: 'pastel', nameFormat: 'initial', planRot: 0, plan: { assign: {} } }, c);
  out.plan = out.plan && typeof out.plan === 'object' ? out.plan : { assign: {} };
  out.plan.assign = out.plan.assign || {};
  out.students = (out.students || []).map(s => Object.assign({ id: uid('st'), name: '', front: false, lock: null }, s));
  out.rules = (out.rules || []).filter(r => r && Array.isArray(r.members)).map(r => Object.assign({ id: uid('rule'), type: 'apart' }, r));
  out.icon = out.icon || 'auto';
  out.color = out.color || null;
  out.absent = Array.isArray(out.absent) ? out.absent : [];
  out.homework = (Array.isArray(out.homework) ? out.homework : []).map(t => Object.assign({ id: uid('hw'), title: 'Task', set: '', due: '', created: 0, subs: {} }, t));
  out.groups = Object.assign({ mode: 'size', size: 4, count: 6, rules: true, avoidRepeats: true, list: [], at: null, history: [], saved: [] }, out.groups);
  out.groups.history = (out.groups.history || []).filter(h => h && Array.isArray(h.list));
  out.groups.saved = (out.groups.saved || []).filter(h => h && Array.isArray(h.list));
  out.picker = Object.assign({ noRepeat: true, picked: [], last: null }, out.picker);
  return out;
}
function freshData() {
  return { version: 5, rooms: Sample.rooms().map(normRoom), classes: Sample.classes().map(normClass), activeRoomId: 'room_b12', activeClassId: 'class_10sci' };
}
function fixRefs() {
  for (const c of data.classes) if (!c.color) c.color = pickSeatColour();
  if (!data.rooms.length) data.rooms.push(blankRoom());
  if (!data.classes.length) data.classes.push(blankClass());
  if (!data.rooms.some(r => r.id === data.activeRoomId)) data.activeRoomId = data.rooms[0].id;
  if (!data.classes.some(c => c.id === data.activeClassId)) data.activeClassId = data.classes[0].id;
  for (const c of data.classes) if (!data.rooms.some(r => r.id === c.roomId)) c.roomId = data.rooms[0].id;
}
function blankRoom(name) {
  return normRoom({ id: uid('room'), name: name || 'My classroom', items: [{ id: uid('board'), type: 'board', x: 10, y: 0 }] });
}
function blankClass(name) {
  return normClass({ id: uid('class'), name: name || 'My class', roomId: data && data.rooms[0] ? data.activeRoomId : null });
}

/* ================= undo ================= */
const hist = { past: [], future: [] };
const snap = () => JSON.stringify(data);
function pushUndo(before) {
  if (before === snap()) return;
  hist.past.push(before);
  if (hist.past.length > 100) hist.past.shift();
  hist.future = [];
  syncUndoButtons();
}
function syncUndoButtons() {
  $('#undoBtn').disabled = !hist.past.length;
  $('#redoBtn').disabled = !hist.future.length;
}
function mutate(fn, opts = {}) {
  const before = snap();
  fn();
  pushUndo(before);
  save();
  if (!opts.noRender) render();
}
function undo() {
  if (!hist.past.length) return toast('Nothing to undo');
  hist.future.push(snap());
  data = JSON.parse(hist.past.pop());
  fixRefs(); save(); ui.drawPts = null; render(); toast('Undone');
}
function redo() {
  if (!hist.future.length) return toast('Nothing to redo');
  hist.past.push(snap());
  data = JSON.parse(hist.future.pop());
  fixRefs(); save(); render(); toast('Redone');
}

/* ================= accessors ================= */
const activeRoom = () => data.rooms.find(r => r.id === data.activeRoomId);
const activeClass = () => data.classes.find(c => c.id === data.activeClassId);
const classRoom = c => data.rooms.find(r => r.id === c.roomId);
const getItem = (room, id) => room.items.find(i => i.id === id);

function shortName(cls, id) {
  const st = cls.students.find(s => s.id === id);
  if (!st) return '?';
  const parts = st.name.trim().split(/\s+/);
  const first = parts[0];
  const clash = cls.students.filter(s => s.id !== id && s.name.trim().split(/\s+/)[0] === first).length;
  return clash && parts.length > 1 ? `${first} ${parts[parts.length - 1][0]}.` : first;
}
const ruleLabel = (cls, r) => r.members.map(id => shortName(cls, id)).join(r.type === 'apart' ? ' ✕ ' : ' + ');

/* drop seats/students that no longer exist from a plan (no undo entry) */
function cleanPlan(cls, room) {
  if (!room) return;
  const avail = new Set(Core.roomSeats(room).filter(s => !s.unavailable).map(s => s.key));
  const ids = new Set(cls.students.map(s => s.id));
  const seen = new Set();
  for (const [k, id] of Object.entries(cls.plan.assign)) {
    if (!avail.has(k) || !ids.has(id) || seen.has(id)) delete cls.plan.assign[k];
    else seen.add(id);
  }
}

/* ================= toast + modal ================= */
let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}
function modal({ title, body = '', input = null, buttons }) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog"><h3>${esc(title)}</h3>${body ? `<div>${body}</div>` : ''}
      ${input ? `<input class="input" id="modalInput" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}">` : ''}
      <div class="btn-row">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(bg);
    const inp = bg.querySelector('#modalInput');
    const done = v => { bg.remove(); resolve(v); };
    bg.addEventListener('click', e => {
      if (e.target === bg) return done(null);
      const b = e.target.closest('[data-i]');
      if (b) { const btn = buttons[+b.dataset.i]; done(btn.value === undefined ? null : (input ? { value: btn.value, text: inp.value.trim() } : btn.value)); }
    });
    bg.addEventListener('keydown', e => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Enter' && inp) { const btn = buttons.find(b => b.cls && b.cls.includes('primary')) || buttons[buttons.length - 1]; done({ value: btn.value, text: inp.value.trim() }); }
    });
    (inp || bg.querySelector('.btn.primary') || bg.querySelector('.btn')).focus();
    if (inp) inp.select();
  });
}
async function askText(title, value, placeholder) {
  const r = await modal({ title, input: { value, placeholder }, buttons: [{ label: 'Cancel' }, { label: 'OK', cls: 'primary', value: true }] });
  return r && r.value && r.text ? r.text : null;
}
async function confirmBox(title, body, okLabel = 'Delete', cls = 'danger') {
  return !!(await modal({ title, body, buttons: [{ label: 'Cancel' }, { label: okLabel, cls: 'primary ' + cls, value: true }] }));
}

/* ================= tabs + top-level render ================= */
function setTab(t) { ui.tab = t; saveUI(); render(); }
function render() {
  if (!['classes', 'room', ...CLASS_TABS].includes(ui.tab)) ui.tab = 'classes';
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + ui.tab));
  $('#classTabs').hidden = !CLASS_TABS.includes(ui.tab);
  const activeTab = $('#classTabs .tab.active');
  if (activeTab && !$('#classTabs').hidden) { const r = activeTab.getBoundingClientRect(), box = $('#classTabs').getBoundingClientRect(); if (r.left < box.left || r.right > box.right) $('#classTabs').scrollLeft += r.left - box.left - 16; }
  $('#presentBtn').hidden = !CLASS_TABS.includes(ui.tab);
  if (ui.present && !CLASS_TABS.includes(ui.tab)) setPresent(false);
  if (ui.present && PRIVATE_TABS.includes(ui.tab)) ui.tab = 'plan'; // rules and home learning stay off the projector
  if (ui.tab !== 'noise' && pit.on) stopNoise(); // the microphone is only ever on while the noise meter is showing
  checkGuide();
  renderCrumb();
  renderRail();
  syncUndoButtons();
  if (ui.tab === 'classes') renderClassesHome();
  else if (ui.tab === 'room') renderRoomTab();
  else if (ui.tab === 'students') renderStudentsTab();
  else if (ui.tab === 'groups') renderGroupsTab();
  else if (ui.tab === 'picker') renderPickerTab();
  else if (ui.tab === 'timer') renderTimerTab();
  else if (ui.tab === 'noise') renderNoiseTab();
  else if (ui.tab === 'homework') renderHomeLearningTab();
  else renderPlanTab();
}
