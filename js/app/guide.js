'use strict';
/* =================================================================
   9. GETTING-STARTED GUIDE
   A three-step checklist on the Classes page: create a class, add students, draw your room. Each
   step's button starts a short guided tour that highlights one control at a time with a tip
   (Back / Next / Skip). Steps tick themselves off as they're done. Once all three are done (or the guide is hidden) it moves out of the way, to a
   "Getting started" link at the bottom of the side menu, which brings it back.
================================================================= */
ui.guide = Object.assign({ hidden: false, room: false, done: false }, ui.guide);

function guideSteps() {
  const mine = data.classes.filter(c => !c.sample);
  const withStudents = mine.find(c => c.students.length);
  const target = () => withStudents || mine[mine.length - 1] || activeClass();
  return [
    { done: mine.length > 0, title: 'Create your class', text: 'Give it a name and a colour. You can copy students and rules from a class you already have.', action: 'Create a class', go: () => startTour('class') },
    { done: !!withStudents, title: 'Add your students', text: 'Paste names, or import a CSV class list.', action: 'Add students', go: () => startTour('students', target()) },
    { done: !!ui.guide.room || data.rooms.some(r => !r.sample), title: 'Draw your room', text: 'Draw your classroom’s walls and drag in the desks and tables, so seating plans match the real room.', action: 'Draw your room', go: () => startTour('room') },
  ];
}
function renderGuide() {
  const el = $('#guide');
  $('#guideRail').hidden = !ui.guide.hidden;
  if (ui.guide.hidden) { el.innerHTML = ''; return; }
  const steps = guideSteps(), done = steps.filter(s => s.done).length, next = steps.findIndex(s => !s.done);
  el.innerHTML = `<section class="guide-card" aria-label="Getting started">
    <div class="guide-head"><b class="grow">Get started with ClassCrate</b><span class="hint">${done} of ${steps.length} done</span><button class="btn sm ghost" data-guide-hide>Hide</button></div>
    <div class="guide-bar"><i style="width:${(100 * done) / steps.length}%"></i></div>
    <div class="guide-privacy"><span class="gp-ico" aria-hidden="true">🔒</span><div><b>Your class lists stay private.</b> Student names and all private data are saved only in this browser, on the device you’re using now. Nothing is uploaded to ClassCrate, so nobody else can see them. (We count visits anonymously, without cookies, so we know how many teachers use ClassCrate; that count never includes your classes.) They won’t appear on another computer or browser; to move them, use <b>Backup &amp; data</b> to export a backup and import it there.</div></div>
    <ol class="guide-steps">${steps.map((s, i) => `<li class="${s.done ? 'done' : ''} ${i === next ? 'next' : ''}">
      <span class="gs-num">${s.done ? '✓' : i + 1}</span><div class="grow"><b>${s.title}</b><div class="hint">${s.text}</div></div>
      ${s.done ? `<button class="btn sm ghost" data-guide-step="${i}">Show me again</button>` : `<button class="btn sm ${i === next ? 'primary' : ''}" data-guide-step="${i}">${s.action}</button>`}</li>`).join('')}</ol>
    ${next < 0 ? '<div class="msg ok guide-done"><span class="grow"><b>You’re all set ✓</b> Try the seating plan, groups or the picker from your class’s tabs.</span><button class="btn sm" data-guide-hide>Close guide</button></div>' : ''}
  </section>`;
}

/* ---------- guided tours ----------
   A tour highlights one control at a time with a tip. Each step names the control (sel) and can open
   the right page first (before). A step with `until` waits for the person to do something (create the
   class, make a room) and moves on by itself; its Next button is hidden when `wait` is set. Steps whose
   control isn't on screen are skipped. A tour can hand over to another when it finishes (then). */
const TOURS = {
  class: () => ({
    steps: [
      { sel: '#ncName', before: () => { if (!$('#ncName')) newClass(); }, text: 'Type your class’s name, for example “9B Science” or “12CHEM”. ClassCrate picks a subject icon from the name.' },
      { sel: '#ncSwatches', text: 'Choose a colour. It’s used for the class’s note on the Classes page and its badge.' },
      { sel: '#ncRoom', text: 'Pick the room you teach this class in. You can draw your own room afterwards and switch to it.' },
      { sel: '#ncFrom', text: 'Teaching the same students in another class? Copy their names and keep-apart rules from it. Otherwise leave this as it is.' },
      { sel: '.modal button[type="submit"]', text: 'Press Create class. The tour carries on with adding your students.', wait: true, until: () => !$('#ncName') },
    ],
    then: before => (data.classes.length > before ? startTour('students', data.classes[data.classes.length - 1]) : null),
  }),
  students: cls => ({
    steps: [
      { sel: '#classTeacher', before: () => openClass((cls || activeClass()).id, 'students'), text: 'This is your class’s Students page. Add your name as the teacher if you like; it appears on printed plans.' },
      { sel: '#pasteNames', text: 'Paste your class list here, one name per line. Copying a column straight from a spreadsheet works.' },
      { sel: '#addNames', text: 'Then press Add to class. Anyone already in the class isn’t added twice.' },
      { sel: '#csvBtn', text: 'Or import a CSV file exported from your school system. ClassCrate finds the name columns itself and shows you what it found first.' },
      { sel: '#studentList .pill-toggle', text: 'Tap ★ Front for any student who needs to sit near the board. The seating plan puts them in the front rows.' },
      { sel: '#ruleChips', text: 'To keep students apart (or together), tap two or more names here…' },
      { sel: '#makeApart', text: '…then press Keep apart or Keep together. Seating plans and groups both follow these rules.' },
      { sel: '#classRoom', text: 'Choose the room this class is taught in. To draw your own, use Rooms in the side menu.' },
      { sel: '.tab[data-tab="plan"]', text: 'When you’re ready, open Seating plan and press Generate. You can drag names to swap seats and print it.' },
    ],
  }),
  room: () => { const rooms0 = data.rooms.length; return {
    steps: [
      { sel: '#roomNew', before: () => { if (ui.tab !== 'room') setTab('room'); }, text: 'Press New and give your room a name, such as “B12” or “Science lab 2”. Or press Next to look round the sample room first.', until: () => !$('.modal-bg') && data.rooms.length > rooms0 },
      { sel: '#presetRow', before: () => { ui.tool = 'shape'; renderRoomTab(); }, text: 'Start from a preset shape: a rectangle, or an L-shape for rooms with a corner cut out.' },
      { sel: '#roomSvg', before: () => { ui.tool = 'shape'; renderRoomTab(); }, text: 'With Walls selected, drag a corner to resize the room. Click a wall to add a corner. The length of each wall is shown in metres.' },
      { sel: '#toolSeg [data-tool="draw"]', text: 'For an unusual shape, choose Draw and click each corner of the room in turn. Click the first corner again, or press Enter, to finish.' },
      { sel: '#paletteGrid', before: () => { ui.tool = 'select'; renderRoomTab(); }, text: 'Now add furniture. Drag a desk or table into the room, or tap one to drop it in a free spot.' },
      { sel: '#paletteGrid [data-type="board"]', text: 'Add the board. It marks the front of the room, so seats are numbered from it and front-priority students sit near it.' },
      { sel: '#roomSvg', text: 'Tap a table to select it, then drag to move it. Press R to turn it. Duplicate adds the next table alongside, so a few presses build a row. Tables click flush against walls.' },
      { sel: '#selSection', text: 'The selected table’s options are here: its size, seats, Duplicate and Delete. Tap a seat in the room to switch it off if nobody sits there.' },
      { sel: '#roomStatus', text: 'This shows how many seats the room has, and warns you about anything outside the walls or overlapping.' },
      { sel: '#railClasses', text: 'Last step: open your class and choose this room on its Students page. Then press Generate on the Seating plan.' },
    ],
  }; },
};
let tour = null;
function startTour(name, arg) {
  endTour();
  const t = TOURS[name](arg);
  tour = { ...t, name, i: -1, el: null, tip: null, classesBefore: data.classes.length };
  window.addEventListener('resize', placeTour);
  document.addEventListener('scroll', placeTour, true);
  tourGo(1);
}
function endTour() {
  if (!tour) return;
  clearInterval(tour.poll);
  if (tour.el) tour.el.classList.remove('spot');
  if (tour.tip) tour.tip.remove();
  window.removeEventListener('resize', placeTour);
  document.removeEventListener('scroll', placeTour, true);
  tour = null;
}
const visibleEl = sel => { const el = $(sel); return el && el.getClientRects().length && !el.closest('[hidden]') ? el : null; };
function tourGo(dir) {
  const t = tour;
  clearInterval(t.poll);
  if (t.el) t.el.classList.remove('spot');
  let i = t.i + dir;
  for (; i >= 0 && i < t.steps.length; i += dir) {
    const st = t.steps[i];
    if (st.before) st.before();
    if (visibleEl(st.sel)) break;
  }
  if (i < 0) { if (t.i >= 0) showTourStep(); return; }   // nothing earlier to go back to
  if (i >= t.steps.length) {                             // finished
    const then = t.then, before = t.classesBefore;
    endTour();
    if (then) then(before);
    return;
  }
  t.i = i;
  showTourStep();
}
function showTourStep() {
  const t = tour, st = t.steps[t.i], el = visibleEl(st.sel);
  t.el = el;
  el.classList.add('spot');
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (!t.tip) { t.tip = document.createElement('div'); t.tip.className = 'tour-tip'; t.tip.setAttribute('role', 'dialog'); t.tip.setAttribute('aria-label', 'Getting started tour'); document.body.appendChild(t.tip); bindTourTip(t.tip); }
  const n = t.steps.length, last = t.i === n - 1;
  t.tip.innerHTML = `<div class="tt-head"><span class="tt-count">Step ${t.i + 1} of ${n}</span><button class="tt-x" data-tour="end" aria-label="End the tour">✕</button></div>
    <p>${esc(st.text)}</p>
    <div class="tt-btns">${t.i > 0 ? '<button class="btn sm" data-tour="back">Back</button>' : ''}<span class="grow"></span>${st.wait ? '<span class="hint">Waiting for you…</span>' : `<button class="btn sm primary" data-tour="next">${last ? 'Done' : 'Next'}</button>`}</div>`;
  placeTour(); setTimeout(placeTour, 350);
  // move on by itself once the step's task is done; end the tour if its control disappears (e.g. a dialog was cancelled)
  t.poll = setInterval(() => {
    if (!tour) return;
    if (st.until && st.until()) return tourGo(1);
    if (!t.el.isConnected) { const again = visibleEl(st.sel); if (again) { t.el = again; again.classList.add('spot'); placeTour(); } else endTour(); }
  }, 300);
}
function bindTourTip(tip) {
  tip.addEventListener('click', e => {
    const b = e.target.closest('[data-tour]');
    if (!b || !tour) return;
    if (b.dataset.tour === 'end') endTour();
    else tourGo(b.dataset.tour === 'back' ? -1 : 1);
  });
}
function placeTour() {
  if (!tour || !tour.tip || !tour.el) return;
  const r = tour.el.getBoundingClientRect(), tip = tour.tip, tw = tip.offsetWidth, th = tip.offsetHeight, gap = 12;
  let top = r.bottom + gap;
  if (top + th > innerHeight - 8) top = r.top - th - gap;                 // no room below: go above
  if (top < 8) top = clamp(r.top + r.height / 2 - th / 2, 8, innerHeight - th - 8); // tall target: beside it
  let left = clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8);
  if (top + th > r.top && top < r.bottom) left = r.right + gap + tw < innerWidth ? r.right + gap : clamp(r.left - tw - gap, 8, innerWidth - tw - 8);
  tip.style.top = top + 'px'; tip.style.left = left + 'px';
}

/* Called on every render: the first time all three steps are done, tuck the guide away. */
let guideChecked = false;
function checkGuide() {
  const first = !guideChecked; guideChecked = true;
  if (ui.guide.done || !guideSteps().every(s => s.done)) return;
  ui.guide.done = true; ui.guide.hidden = true; saveUI();
  $('#guideRail').hidden = false;
  if (!first) toast('✓ You’re all set up. The guide is now under Getting started in the side menu.');
}

function bindGuide() {
  $('#guide').addEventListener('click', e => {
    if (e.target.closest('[data-guide-hide]')) { ui.guide.hidden = true; saveUI(); renderGuide(); return; }
    const b = e.target.closest('[data-guide-step]');
    if (b) guideSteps()[+b.dataset.guideStep].go();
  });
  $('#guideRail').addEventListener('click', () => {
    ui.guide.hidden = false; saveUI(); setTab('classes');
    $('#guide').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  // step 3 is done once a room of your own exists (checked on every render, so making one ticks it off)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && tour && !$('.modal-bg')) endTour(); });
}
