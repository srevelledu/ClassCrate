'use strict';
/* =================================================================
   9. GETTING-STARTED GUIDE
   A three-step checklist on the Classes page: create a class, add students, draw your room. Each
   step's button takes you to the right place and points at what to use. Steps tick themselves off
   as they're done. Once all three are done (or the guide is hidden) it moves out of the way, to a
   "Getting started" link at the bottom of the side menu, which brings it back.
================================================================= */
ui.guide = Object.assign({ hidden: false, room: false, done: false }, ui.guide);

function guideSteps() {
  const mine = data.classes.filter(c => !c.sample);
  const withStudents = mine.find(c => c.students.length);
  const target = () => withStudents || mine[mine.length - 1] || activeClass();
  return [
    { done: mine.length > 0, title: 'Create your class', text: 'Give it a name and a colour. You can copy students and rules from a class you already have.', action: 'Create a class', go: () => newClass() },
    { done: !!withStudents, title: 'Add your students', text: 'Paste names, or import a CSV class list.', action: 'Add students',
      go: () => { openClass(target().id, 'students'); spotlight('#csvBtn', 'Import a CSV class list here, or paste names into the box above and press Add to class.'); } },
    { done: !!ui.guide.room || data.rooms.some(r => !r.sample), title: 'Draw your room', text: 'Draw your classroom’s walls and drag in the desks and tables, so seating plans match the real room.', action: 'Draw your room',
      go: () => { setTab('room'); spotlight('#roomNew', 'Start a new room here, then draw the walls and drag furniture in from the palette. Choose it for your class on the Students tab.'); } },
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
    <div class="guide-privacy"><span class="gp-ico" aria-hidden="true">🔒</span><div><b>Your class lists stay private.</b> Student names and all private data are saved only in this browser, on the device you’re using now. Nothing is uploaded to ClassCrate, so nobody else can see them. They won’t appear on another computer or browser; to move them, use <b>Backup &amp; data</b> to export a backup and import it there.</div></div>
    <ol class="guide-steps">${steps.map((s, i) => `<li class="${s.done ? 'done' : ''} ${i === next ? 'next' : ''}">
      <span class="gs-num">${s.done ? '✓' : i + 1}</span><div class="grow"><b>${s.title}</b><div class="hint">${s.text}</div></div>
      ${s.done ? '' : `<button class="btn sm ${i === next ? 'primary' : ''}" data-guide-step="${i}">${s.action}</button>`}</li>`).join('')}</ol>
    ${next < 0 ? '<div class="msg ok guide-done"><span class="grow"><b>You’re all set ✓</b> Try the seating plan, groups or the picker from your class’s tabs.</span><button class="btn sm" data-guide-hide>Close guide</button></div>' : ''}
  </section>`;
}

/* Point at an element with a pulsing outline and a short tip. */
let spotEl = null, spotTip = null, spotTimer = null;
function clearSpot() {
  if (spotEl) spotEl.classList.remove('spot');
  if (spotTip) spotTip.remove();
  clearTimeout(spotTimer);
  spotEl = spotTip = null;
}
function spotlight(sel, text) {
  clearSpot();
  setTimeout(() => {
    const el = $(sel);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.add('spot');
    spotEl = el;
    spotTip = document.createElement('div');
    spotTip.className = 'spot-tip';
    spotTip.setAttribute('role', 'status');
    spotTip.innerHTML = `<span>${esc(text)}</span><button class="btn sm">Got it</button>`;
    document.body.appendChild(spotTip);
    const place = () => {
      if (!spotTip) return;
      const r = el.getBoundingClientRect(), tw = spotTip.offsetWidth;
      spotTip.style.top = Math.min(innerHeight - spotTip.offsetHeight - 8, r.bottom + 12) + 'px';
      spotTip.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8) + 'px';
    };
    place(); setTimeout(place, 350);
    spotTip.querySelector('button').addEventListener('click', clearSpot);
    spotTimer = setTimeout(clearSpot, 15000);
  }, 80);
}

/* Called on every render: the first time all three steps are done, tuck the guide away. */
let guideChecked = false;
function checkGuide() {
  const first = !guideChecked; guideChecked = true;
  if (ui.guide.done || !guideSteps().every(s => s.done)) return;
  ui.guide.done = true; ui.guide.hidden = true; saveUI(); clearSpot();
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
  document.addEventListener('pointerdown', e => { if (spotEl && !spotTip.contains(e.target) && !spotEl.contains(e.target)) clearSpot(); });
}
