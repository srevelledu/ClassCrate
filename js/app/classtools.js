'use strict';
/* =================================================================
   7. CLASSROOM TOOLS: lesson timer and ball-pit noise meter, each on its own tab.
   The timer keeps running on other tabs (a chip in the top bar shows the time left). The noise meter
   uses the microphone only while its tab is open and the page is visible: leaving the tab, switching
   browser tabs or minimising the window switches the microphone off, and it stays off until Start
   listening is pressed again.
================================================================= */

/* ---------- shared sound (created on a click, so browsers allow it) ---------- */
let toolAudio = null;
function audioCtx() {
  if (!toolAudio) { try { toolAudio = new (window.AudioContext || window.webkitAudioContext)(); } catch { toolAudio = null; } }
  if (toolAudio && toolAudio.state === 'suspended') toolAudio.resume().catch(() => {});
  return toolAudio;
}
function chime() {
  const ac = audioCtx();
  if (!ac) return;
  [0, 0.28, 0.56].forEach((t, i) => {
    const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + t;
    o.type = 'sine'; o.frequency.value = [880, 1175, 1568][i];
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    o.connect(g).connect(ac.destination); o.start(at); o.stop(at + 0.65);
  });
}

/* ================= lesson timer ================= */
const lessonTimer = { total: 300, left: 300, endAt: null, done: false, tick: null };
const fmtClock = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
function timerLeft() { return lessonTimer.endAt ? Math.max(0, (lessonTimer.endAt - Date.now()) / 1000) : lessonTimer.left; }
function drawTimer() {
  const left = timerLeft(), t = lessonTimer, running = !!t.endAt;
  $('#tmDigits').textContent = fmtClock(left);
  const C = 2 * Math.PI * 52, frac = t.total ? left / t.total : 0;
  const ring = $('#tmRing');
  ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C * (1 - frac);
  ring.style.stroke = t.done ? 'var(--danger)' : classTheme(activeClass()).color;
  $('#tmStart').textContent = running ? 'Pause' : t.done ? 'Start again' : left < t.total ? 'Resume' : 'Start';
  $('#tmState').textContent = t.done ? "Time's up" : running ? 'Running' : left < t.total ? 'Paused' : '';
  $('#timerCard').classList.toggle('done', t.done);
  const chip = $('#timerChip');
  chip.hidden = !(running || t.done);
  chip.textContent = t.done ? "⏰ Time's up" : `⏱ ${fmtClock(left)}`;
  chip.classList.toggle('done', t.done);
}
function timerTick() {
  if (lessonTimer.endAt && timerLeft() <= 0) {
    lessonTimer.endAt = null; lessonTimer.left = 0; lessonTimer.done = true;
    clearInterval(lessonTimer.tick); lessonTimer.tick = null;
    if ($('#tmSound').checked) chime();
    toast("⏰ Time's up!");
  }
  drawTimer();
}
function setTimer(sec) {
  const t = lessonTimer;
  t.total = clamp(Math.round(sec), 10, 99 * 60); t.left = t.total; t.done = false;
  if (t.endAt) t.endAt = Date.now() + t.total * 1000;
  drawTimer();
}
function toggleTimer() {
  const t = lessonTimer;
  audioCtx(); // unlock sound while we have a click
  if (t.endAt) { t.left = timerLeft(); t.endAt = null; clearInterval(t.tick); t.tick = null; }
  else {
    if (t.done || t.left <= 0) { t.left = t.total; t.done = false; }
    t.endAt = Date.now() + t.left * 1000;
    t.tick = setInterval(timerTick, 250);
  }
  drawTimer();
}

/* ================= ball-pit noise meter ================= */
const pit = { on: false, stream: null, analyser: null, buf: null, level: 0, loudFor: 0, quietSince: Date.now(), balls: [], raf: 0, last: 0, w: 0, h: 0 };
const PIT_COLOURS = ['#016df8', '#04af4f', '#fa3e42', '#fa6002', '#fab001', '#01aab5'];
function pitSize() {
  const cv = $('#ballPit'), dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return false;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  if (pit.w !== w || pit.h !== h || !pit.balls.length) {
    pit.w = w; pit.h = h;
    const r = Math.max(7, Math.min(14, w / 26)), n = Math.round((w * h) / (r * r * 14));
    pit.balls = Array.from({ length: clamp(n, 24, 70) }, (_, i) => ({ x: r + Math.random() * (w - 2 * r), y: h - r - Math.random() * h * 0.4, vx: 0, vy: 0, r: r * (0.85 + Math.random() * 0.3), c: PIT_COLOURS[i % PIT_COLOURS.length] }));
  }
  return true;
}
/* Microphone level 0–100 from the RMS of the waveform, mapped from about −60 dB (silence) to −10 dB
   (very loud), shifted by the sensitivity slider. Smoothed so single bangs don't spike it. */
function readLevel() {
  if (!pit.analyser) return 0;
  pit.analyser.getFloatTimeDomainData(pit.buf);
  let sum = 0;
  for (const v of pit.buf) sum += v * v;
  const db = 20 * Math.log10(Math.sqrt(sum / pit.buf.length) || 1e-8);
  const sens = +$('#nmSens').value;
  const raw = clamp((db + 62 + (sens - 5) * 4) / 50 * 100, 0, 100);
  pit.level += (raw - pit.level) * (raw > pit.level ? 0.35 : 0.08);
  return pit.level;
}
function stepPit(dt) {
  const { w, h } = pit, level = pit.on ? readLevel() : 0, limit = +$('#nmLimit').value;
  const kick = pit.on ? Math.pow(level / 100, 1.6) : 0;
  for (const b of pit.balls) {
    if (kick > 0.03 && Math.random() < kick * 0.5) b.vy -= (0.6 + Math.random()) * kick * h * 2.2; // the louder, the higher
    b.vx += (Math.random() - 0.5) * kick * 120 * dt;
    b.vy += 900 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > h - b.r) { b.y = h - b.r; b.vy *= -0.35; b.vx *= 0.92; }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.3; }
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
    if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
  }
  // keep balls from sitting inside each other
  const B = pit.balls;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], c = B[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), m = a.r + c.r;
    if (d > 0 && d < m) { const push = (m - d) / 2, ux = dx / d, uy = dy / d; a.x -= ux * push; a.y -= uy * push; c.x += ux * push; c.y += uy * push; }
  }
  // too loud for a second or more?
  if (pit.on && level >= limit) pit.loudFor += dt; else pit.loudFor = Math.max(0, pit.loudFor - dt * 2);
  const tooLoud = pit.loudFor >= 1;
  if (tooLoud) pit.quietSince = Date.now();
  return { level, limit, tooLoud };
}
function drawPit(state) {
  const cv = $('#ballPit'), ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, { w, h } = pit;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const lineY = h - (state.limit / 100) * h;
  ctx.fillStyle = state.tooLoud ? 'rgba(250,62,66,.08)' : 'rgba(4,175,79,.06)';
  ctx.fillRect(0, lineY, w, h - lineY);
  ctx.setLineDash([6, 6]); ctx.strokeStyle = state.tooLoud ? '#fa3e42' : '#9aa3ad'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(w, lineY); ctx.stroke(); ctx.setLineDash([]);
  for (const b of pit.balls) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = state.tooLoud ? '#fa3e42' : b.c; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill();
  }
  // level meter down the right edge
  const lh = (state.level / 100) * h;
  ctx.fillStyle = state.level >= state.limit ? '#fa3e42' : '#04af4f';
  ctx.fillRect(w - 6, h - lh, 6, lh);
}
function pitFrame(ts) {
  const dt = Math.min(0.05, (ts - (pit.last || ts)) / 1000 || 0.016);
  pit.last = ts;
  const visible = ui.tab === 'noise' && pitSize();
  const state = visible || pit.on ? stepPit(dt) : null;
  if (visible && state) drawPit(state);
  if (state) {
    $('#nmBanner').hidden = !state.tooLoud;
    $('#noiseCard').classList.toggle('loud', state.tooLoud);
    if (pit.on) {
      const q = Math.floor((Date.now() - pit.quietSince) / 1000);
      $('#nmState').textContent = state.tooLoud ? 'Too loud' : `Calm for ${fmtClock(q)}`;
    }
  }
  pit.raf = (pit.on || pit.balls.some(b => Math.abs(b.vy) > 5)) ? requestAnimationFrame(pitFrame) : 0;
  if (!pit.raf && visible) drawPit({ level: 0, limit: +$('#nmLimit').value, tooLoud: false });
}
function wakePit() { if (!pit.raf) { pit.last = 0; pit.raf = requestAnimationFrame(pitFrame); } }
async function startNoise() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // browsers only offer the microphone to secure (https://) pages
    if (location.protocol === 'http:' && !window.isSecureContext) {
      const secure = 'https://' + location.host + location.pathname;
      $('#nmHint').innerHTML = `The microphone only works on a secure page. Open <a href="${esc(secure)}">${esc(secure.replace(/\/$/, ''))}</a> (with https) and try again.`;
      return;
    }
    return noiseMessage("This browser can't use a microphone here. Try opening ClassCrate in Chrome, Edge, Safari or Firefox.");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const ac = audioCtx();
    const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
    an.fftSize = 2048; src.connect(an);
    Object.assign(pit, { on: true, stream, analyser: an, buf: new Float32Array(an.fftSize), quietSince: Date.now(), loudFor: 0, level: 0 });
    $('#nmToggle').textContent = 'Stop listening';
    noiseMessage('Listening. Nothing is recorded or sent anywhere.');
    wakePit();
  } catch (e) {
    noiseMessage(e && e.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it in your browser’s site settings, then try again.' : 'No microphone was found.');
  }
}
function stopNoise() {
  if (pit.stream) pit.stream.getTracks().forEach(t => t.stop());
  Object.assign(pit, { on: false, stream: null, analyser: null, loudFor: 0 });
  $('#nmToggle').textContent = 'Start listening';
  $('#nmState').textContent = 'Off';
  $('#nmBanner').hidden = true; $('#noiseCard').classList.remove('loud');
  noiseMessage('Uses the microphone only while this page is open and you’ve pressed Start. It switches off when you leave the page. Nothing is recorded or sent anywhere.');
  wakePit();
}
function noiseMessage(t) { $('#nmHint').textContent = t; }
function renderTimerTab() { drawTimer(); }
function renderNoiseTab() {
  $('#nmLimitText').textContent = `${$('#nmLimit').value}%`;
  requestAnimationFrame(() => { pitSize(); wakePit(); });
}

function bindClassTools() {
  $('#tmPresets').addEventListener('click', e => { const b = e.target.closest('[data-min]'); if (b) setTimer(+b.dataset.min * 60); });
  $('#tmStart').addEventListener('click', toggleTimer);
  $('#tmReset').addEventListener('click', () => { const t = lessonTimer; clearInterval(t.tick); Object.assign(t, { endAt: null, tick: null, left: t.total, done: false }); drawTimer(); });
  $('#tmPlus').addEventListener('click', () => { const t = lessonTimer; if (t.endAt) t.endAt += 60000; else t.left = Math.min(99 * 60, t.left + 60); t.total = Math.max(t.total, Math.ceil(timerLeft())); t.done = false; drawTimer(); });
  $('#tmMinus').addEventListener('click', () => { const t = lessonTimer; if (t.endAt) t.endAt = Math.max(Date.now() + 1000, t.endAt - 60000); else { t.left = Math.max(10, t.left - 60); t.total = Math.max(t.left, t.total - 60); } drawTimer(); });
  $('#timerChip').addEventListener('click', () => { if (CLASS_TABS.includes(ui.tab) || ui.tab === 'classes') setTab('timer'); });
  $('#nmToggle').addEventListener('click', () => (pit.on ? stopNoise() : startNoise()));
  $('#nmLimit').addEventListener('input', () => { $('#nmLimitText').textContent = `${$('#nmLimit').value}%`; wakePit(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && pit.on) stopNoise(); });
  window.addEventListener('resize', () => { pit.balls = []; if (ui.tab === 'noise') wakePit(); });
  drawTimer();
}
