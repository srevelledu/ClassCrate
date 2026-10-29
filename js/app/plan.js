'use strict';
/* =================================================================
   3. SEATING PLAN: generate, edit, render
================================================================= */
function generate(isShuffle) {
  const cls = activeClass();
  const room = classRoom(cls);
  if (!room) return toast('Link this class to a room layout first.');
  if (!cls.students.length) return toast('Add some students first.');
  const seats = Core.roomSeats(room);
  if (!seats.some(s => !s.unavailable)) return toast('That room has no available seats yet. Add tables in the Room tab.');
  const prev = JSON.stringify(cls.plan.assign);
  let res;
  for (let i = 0; i < 6; i++) {
    res = Core.solve({ seats, students: cls.students, rules: cls.rules, mode: cls.adjacency, fill: 'front', label: r => ruleLabel(cls, r) });
    if (!isShuffle || JSON.stringify(res.assignment) !== prev) break;
  }
  ui.result = { classId: cls.id, ...res };
  ui.selStudent = null;
  mutate(() => { cls.plan = { assign: res.assignment, at: Date.now() }; });
  if (res.ok) toast(isShuffle ? 'Shuffled: all rules still satisfied ✓' : 'Plan generated: all rules satisfied ✓');
}

function planMessages(cls, room, seats, viol) {
  const out = [];
  const r = ui.result && ui.result.classId === cls.id ? ui.result : null;
  const rl = id => { const x = cls.rules.find(q => q.id === id); return x ? '“' + esc(ruleLabel(cls, x)) + '”' : '(removed rule)'; };
  if (!room) return '<div class="msg error">This class isn\'t linked to a room. Choose one on the Students tab.</div>';
  const avail = seats.filter(s => !s.unavailable).length;
  if (cls.students.length > avail) out.push(`<div class="msg warn"><b>Not enough seats.</b> ${cls.students.length} students but ${avail} seats in ${esc(room.name)}. Add seats in the Room tab.</div>`);
  if (r) {
    if (r.problems.length) {
      out.push(`<div class="msg error"><b>Some rules can't be satisfied</b><ul>${r.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      ${r.brokenRules.length ? `<div>A best-effort plan is shown. It breaks: ${r.brokenRules.map(rl).join(', ')}.</div>` : ''}</div>`);
    }
    if (r.warnings.length) out.push(`<div class="msg warn"><ul>${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`);
    if (r.ok && !viol.length) {
      const front = cls.students.filter(s => s.front);
      const keyOf = id => Object.keys(cls.plan.assign).find(k => cls.plan.assign[k] === id);
      const ranks = front.map(s => { const k = keyOf(s.id); const st = seats.find(x => x.key === k); return st ? st.rank : null; }).filter(x => x);
      out.push(`<div class="msg ok"><b>✓ All ${cls.rules.length} rule${cls.rules.length === 1 ? '' : 's'} satisfied.</b>${ranks.length ? ` Front-priority students are in front-distance ranks ${ranks.sort((a, b) => a - b).join(', ')}.` : ''} <span class="small">(${r.stats.ms} ms)</span></div>`);
    }
  }
  if (viol.length) {
    const nm = id => esc(shortName(cls, id));
    out.push(`<div class="msg warn"><b>⚠ ${viol.length} rule problem${viol.length > 1 ? 's' : ''} in the current plan</b><ul>${viol.slice(0, 6).map(v => v.type === 'apart'
      ? `<li>${nm(v.students[0])} ✕ ${nm(v.students[1])} are ${v.same ? 'at the same table' : 'in adjacent seats'}</li>`
      : `<li>${v.students.map(nm).join(' + ')} aren't at the same table</li>`).join('')}${viol.length > 6 ? `<li>…and ${viol.length - 6} more (marked in red)</li>` : ''}</ul></div>`);
  }
  if (!Object.keys(cls.plan.assign).length && !r) out.push('<div class="msg ok">Press <b>Generate</b> to seat the class.</div>');
  return out.join('');
}

function renderPlanTab() {
  const cls = activeClass();
  const room = classRoom(cls);
  cleanPlan(cls, room);
  $('#planRoomName').innerHTML = room ? `Room: <b>${esc(room.name)}</b>` : 'No room chosen';
  const seats = room ? Core.roomSeats(room) : [];
  const viol = room ? Core.checkPlan({ seats, assignment: cls.plan.assign, rules: cls.rules, mode: cls.adjacency }) : [];
  $('#planMsgs').innerHTML = planMessages(cls, room, seats, viol);
  $$('#perspSeg button').forEach(b => b.classList.toggle('on', b.dataset.p === cls.perspective));
  $('#perspHint').textContent = room ? `Board at the ${planView(cls, room).boardSide} of the page.` : '';
  $('#showPrivate').checked = ui.showPrivate;
  $('#nameFormat').value = cls.nameFormat || 'initial';
  $('#paletteSwatches').innerHTML = Object.entries(PALETTES).map(([k, p]) => `<button class="swatch ${cls.palette === k ? 'on' : ''}" data-pal="${k}"><span class="dots">${p.tables.slice(0, 6).map(c => `<i style="background:${c}"></i>`).join('')}</span>${esc(p.name)}</button>`).join('');
  const setIf = (sel, v) => { if (document.activeElement !== $(sel)) $(sel).value = v; };
  setIf('#hdrTitle', cls.name);
  setIf('#hdrRoom', cls.roomLabel || (room ? room.name : ''));
  setIf('#hdrTeacher', cls.teacher || '');
  setIf('#hdrDate', cls.date || todayStr());
  // unseated tray
  const seated = new Set(Object.values(cls.plan.assign));
  const uns = cls.students.filter(s => !seated.has(s.id));
  $('#tray').innerHTML = uns.length ? uns.map(s => `<span class="chip ${s.front ? 'front' : ''}" data-tray="${s.id}">${esc(s.name)}</span>`).join('') : '<span class="muted small">Everyone is seated.</span>';
  // selected student
  const sel = ui.selStudent && cls.students.find(s => s.id === ui.selStudent);
  if (sel) {
    const key = Object.keys(cls.plan.assign).find(k => cls.plan.assign[k] === sel.id);
    const seat = seats.find(s => s.key === key);
    const locked = sel.lock && sel.lock === key;
    $('#selStudent').innerHTML = `<div class="selcard"><div class="row"><b class="grow">${esc(sel.name)}</b><button class="btn ghost sm icon" data-selact="close">✕</button></div>
      <div class="small muted">${seat ? `Seat ${(room.showMetres ? (seat.dist * (room.scale || .5)).toFixed(1) + ' m' : r2(seat.dist) + ' squares')} from the board (rank ${seat.rank})` : 'Not seated'}</div>
      <div class="btn-row">
        ${seat ? `<button class="btn sm ${locked ? 'on' : ''}" data-selact="lock">${locked ? '🔒 Locked (tap to unlock)' : '🔓 Lock to this seat'}</button>` : ''}
        <button class="btn sm ${sel.front ? 'on' : ''}" data-selact="front">★ Front priority</button>
        ${seat ? '<button class="btn sm" data-selact="unseat">Unseat</button>' : ''}
      </div></div>`;
  } else $('#selStudent').innerHTML = '';
  $('#planPage').innerHTML = room ? buildPlanSVG(cls, room, { priv: ui.showPrivate && !ui.present, interactive: true, viol }) : '';
}

/* ---------- text measuring for auto-fit ---------- */
const mctx = document.createElement('canvas').getContext('2d');
function measure(text, weight, size) { mctx.font = `${weight} ${size}px ${FONT_STACK}`; return mctx.measureText(text).width; }
function joinTokens(toks) { return toks.reduce((s, t) => s + (s && !s.endsWith('-') ? ' ' : '') + t, ''); }
function fitName(name, maxW, base, abbrev, maxLines = 3) {
  const min1 = Math.max(8.5, base * .74);
  for (let fs = base; fs >= min1; fs -= .5) if (measure(name, 500, fs) <= maxW) return { lines: [name], fs };
  // wrap at spaces and after hyphens: try 2 lines, then 3
  const toks = name.replace(/-/g, '-\u0000').split(/\s+|\u0000/).filter(Boolean);
  const minW = Math.max(7.5, base * .6);
  for (const n of [2, 3]) {
    if (toks.length < n || n > maxLines) break;
    let best = null;
    const consider = lines => { const w = Math.max(...lines.map(l => measure(l, 500, base))); if (!best || w < best.w) best = { lines, w }; };
    for (let i = 1; i < toks.length; i++) {
      if (n === 2) consider([joinTokens(toks.slice(0, i)), joinTokens(toks.slice(i))]);
      else for (let j = i + 1; j < toks.length; j++) consider([joinTokens(toks.slice(0, i)), joinTokens(toks.slice(i, j)), joinTokens(toks.slice(j))]);
    }
    for (let fs = base * (n === 2 ? .94 : .86); fs >= minW; fs -= .5) {
      if (Math.max(...best.lines.map(l => measure(l, 500, fs))) <= maxW) return { lines: best.lines, fs };
    }
  }
  // still too long: abbreviate the surname ("Alexandria P.") before truncating
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1 && !abbrev) {
    const short = fitName(`${parts[0]} ${parts[parts.length - 1][0]}.`, maxW, base, true, maxLines);
    if (!short.lines[0].endsWith('…')) return short;
  }
  let t = name;
  while (t.length > 1 && measure(t + '…', 500, minW) > maxW) t = t.slice(0, -1);
  return { lines: [t.trim() + '…'], fs: minW };
}
function displayName(cls, st) {
  const parts = st.name.trim().split(/\s+/);
  if ((cls.nameFormat || 'initial') === 'initial' && parts.length > 1) return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  if (cls.nameFormat === 'first') return shortName(cls, st.id);
  return st.name;
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function shade(hex, dl, ds = 0) { const [h, s, l] = hexToHsl(hex); return `hsl(${h.toFixed(0)} ${clamp(s + ds, 0, 100).toFixed(0)}% ${clamp(l + dl, 0, 100).toFixed(0)}%)`; }

/* ---------- the printable plan (A4 landscape, SVG) ---------- */
/* Page orientation. Furniture is always square to the room, so the plan only ever turns in
   90° steps: the step that best puts the board at the bottom (teacher's view) or top (student's
   view), plus any quarter turns chosen with the rotate buttons. */
function planView(cls, room) {
  const board = Core.boardOf(room);
  const bg = board ? Core.wallGeom(room, board) : null;
  const n = bg ? bg.n : { x: 0, y: -1 };
  const ideal = (cls.perspective === 'student' ? -Math.PI / 2 : Math.PI / 2) - Math.atan2(n.y, n.x);
  const rotQ = q => { const c = [1, 0, -1, 0][q], sn = [0, 1, 0, -1][q]; return p => ({ x: p.x * c - p.y * sn, y: p.x * sn + p.y * c }); };
  const mod4 = q => ((q % 4) + 4) % 4;
  const q0 = Math.round(ideal / (Math.PI / 2)), off = ideal / (Math.PI / 2) - q0;
  let best = q0;
  if (Math.abs(off) > .35) {
    // board on a near-diagonal wall: both neighbouring 90° steps are equally "board at the bottom",
    // so use the one that makes the room largest on the A4 landscape page
    const fit = q => { const rp = room.boundary.map(rotQ(mod4(q))); const w = Math.max(...rp.map(p => p.x)) - Math.min(...rp.map(p => p.x)), h = Math.max(...rp.map(p => p.y)) - Math.min(...rp.map(p => p.y)); return Math.min(1076 / w, 640 / h); };
    const q1 = q0 + Math.sign(off);
    if (fit(q1) > fit(q0) * 1.02) best = q1;
  }
  const quarter = mod4(best + (cls.planRot || 0));
  const rot = rotQ(quarter);
  const r = rot(n);
  const vs = r.y > 0 ? 'bottom' : 'top', hs = r.x > 0 ? 'right' : 'left';
  const boardSide = Math.abs(Math.abs(r.y) - Math.abs(r.x)) < .3 ? `${vs}-${hs} corner` : Math.abs(r.y) > Math.abs(r.x) ? vs : hs;
  return { rot, deg: quarter * 90, boardSide };
}
const PAGE_W = 1188, PAGE_H = 840;
function buildPlanSVG(cls, room, opts) {
  const pal = PALETTES[cls.palette] || PALETTES.pastel;
  const priv = !!opts.priv;
  const F = opts.interactive ? 'scr-' : 'out-'; // unique filter ids: screen and print SVGs coexist in the DOM
  const seats = Core.roomSeats(room);
  const assign = cls.plan.assign || {};
  const stById = new Map(cls.students.map(s => [s.id, s]));
  const violSeats = new Set((opts.viol || []).flatMap(v => v.seats));
  const B = room.boundary;

  const board = Core.boardOf(room);
  const bg = board ? Core.wallGeom(room, board) : null;
  const view = planView(cls, room);
  const { rot, deg } = view;

  const visible = room.items.filter(i => !i.hidden);
  const pts = B.slice();
  for (const it of visible) if (!Core.isWall(it)) { const g = Core.itemGeom(it, room.scale); pts.push({ x: g.x, y: g.y }, { x: g.x + g.w, y: g.y + g.h }, { x: g.x + g.w, y: g.y }, { x: g.x, y: g.y + g.h }); }
  const rp = pts.map(rot);
  const minx = Math.min(...rp.map(p => p.x)), maxx = Math.max(...rp.map(p => p.x));
  const miny = Math.min(...rp.map(p => p.y)), maxy = Math.max(...rp.map(p => p.y));
  const AX = 56, AY = 150, AW = PAGE_W - 112, AH = 640;
  const s = Math.min(AW / (maxx - minx || 1), AH / (maxy - miny || 1), 50);
  const ox = AX + (AW - (maxx - minx) * s) / 2, oy = AY + (AH - (maxy - miny) * s) / 2;
  const T = p => { const r = rot(p); return { x: ox + (r.x - minx) * s, y: oy + (r.y - miny) * s }; };
  const f1 = v => Math.round(v * 10) / 10;

  let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}" height="${PAGE_H}" font-family="${FONT_STACK}" preserveAspectRatio="xMidYMid meet">`;
  if (opts.fontCss) h += `<style>${opts.fontCss}</style>`;
  h += `<defs>
    <filter id="${F}sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#1B2030" flood-opacity=".13"/></filter>
    <filter id="${F}shs" x="-20%" y="-40%" width="140%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#1B2030" flood-opacity=".12"/></filter>
    <filter id="${F}shr" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#1B2030" flood-opacity=".08"/></filter>
  </defs>`;
  h += `<rect width="${PAGE_W}" height="${PAGE_H}" fill="${pal.page}"/>`;

  // header
  const title = cls.name || 'Seating plan';
  const info = [['ROOM', cls.roomLabel || room.name], ['TEACHER', cls.teacher], ['DATE', cls.date || todayStr()]].filter(x => x[1]);
  h += `<rect x="28" y="24" width="${PAGE_W - 56}" height="98" rx="20" fill="${pal.head}"/>`;
  let ix = PAGE_W - 56;
  const infoSvg = [];
  for (let i = info.length - 1; i >= 0; i--) {
    const [lab, val] = info[i];
    let vs = 17;
    while (vs > 11 && measure(val, 600, vs) > 300) vs -= .5;
    const w = Math.max(measure(lab, 600, 11) + lab.length * 1.6, Math.min(300, measure(val, 600, vs)));
    ix -= w;
    infoSvg.push(`<text x="${f1(ix)}" y="64" font-size="11" font-weight="600" letter-spacing="1.6" fill="${pal.ink2}">${esc(lab)}</text><text x="${f1(ix)}" y="89" font-size="${vs}" font-weight="600" fill="${pal.ink}">${esc(val)}</text>`);
    ix -= 34;
    if (i > 0) infoSvg.push(`<line x1="${f1(ix + 17)}" y1="54" x2="${f1(ix + 17)}" y2="96" stroke="${pal.ink2}" stroke-opacity=".2"/>`);
  }
  const titleMax = ix - 56 - 10;
  let ts = 36;
  while (ts > 18 && measure(title, 700, ts) > titleMax) ts -= 1;
  h += `<rect x="56" y="45" width="6" height="58" rx="3" fill="${pal.accent}"/>`;
  h += `<text x="76" y="62" font-size="11.5" font-weight="600" letter-spacing="2.4" fill="${pal.accent}">SEATING PLAN</text>`;
  h += `<text x="75" y="${ts > 28 ? 100 : 96}" font-size="${ts}" font-weight="700" fill="${pal.ink}">${esc(title)}</text>`;
  h += infoSvg.join('');

  // floor + walls
  const wallW = clamp(s * .3, 5, 9);
  const path = 'M' + B.map(p => { const t = T(p); return `${f1(t.x)} ${f1(t.y)}`; }).join('L') + 'Z';
  h += `<path d="${path}" fill="${pal.floor}" filter="url(#${F}shr)"/>`;
  h += `<path d="${path}" fill="none" stroke="${pal.wall}" stroke-width="${f1(wallW)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  h += `<path d="${path}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="${f1(wallW * .28)}" stroke-linejoin="round"/>`;

  // windows & doors
  for (const it of visible.filter(i => i.type === 'window' || i.type === 'door')) {
    const g = Core.wallGeom(room, it);
    const a = T(g.p1), b = T(g.p2);
    if (it.type === 'window') {
      h += `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="${pal.window}" stroke-width="${f1(wallW + 2)}"/>`;
      h += `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="#fff" stroke-width="1.4"/>`;
    } else {
      const leafW = { x: g.p1.x - g.n.x * g.len, y: g.p1.y - g.n.y * g.len };
      const L = T(leafW);
      const va = { x: b.x - a.x, y: b.y - a.y }, vb = { x: L.x - a.x, y: L.y - a.y };
      const sweep = va.x * vb.y - va.y * vb.x > 0 ? 1 : 0;
      const R = g.len * s;
      h += `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="${pal.floor}" stroke-width="${f1(wallW + 2)}"/>`;
      h += `<path d="M${f1(a.x)} ${f1(a.y)}L${f1(L.x)} ${f1(L.y)}" stroke="${pal.ink2}" stroke-width="2" stroke-linecap="round"/>`;
      h += `<path d="M${f1(b.x)} ${f1(b.y)}A${f1(R)} ${f1(R)} 0 0 ${sweep} ${f1(L.x)} ${f1(L.y)}" fill="none" stroke="${pal.ink2}" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="4 4"/>`;
      const lp = T({ x: g.mid.x - g.n.x * g.len * .55, y: g.mid.y - g.n.y * g.len * .55 });
      h += `<text x="${f1(lp.x)}" y="${f1(lp.y + 4)}" font-size="10.5" font-weight="600" letter-spacing="1" text-anchor="middle" fill="${pal.ink2}" fill-opacity=".8">DOOR</text>`;
    }
  }

  // board / front banner
  if (bg && !board.hidden) {
    const bw = clamp(s * .38, 10, 16);
    const inset = (wallW / 2 + bw / 2 + 2) / s;
    const a = T({ x: bg.p1.x - bg.n.x * inset, y: bg.p1.y - bg.n.y * inset }), b = T({ x: bg.p2.x - bg.n.x * inset, y: bg.p2.y - bg.n.y * inset });
    h += `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke="${pal.board}" stroke-width="${f1(bw)}" stroke-linecap="round"/>`;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const lbl = 'FRONT  ·  BOARD';
    const lw = measure(lbl, 600, 12) + lbl.length * 2.2 + 32;
    h += `<rect x="${f1(m.x - lw / 2)}" y="${f1(m.y - 14)}" width="${f1(lw)}" height="28" rx="14" fill="${pal.board}" filter="url(#${F}shs)"/>`;
    h += `<text x="${f1(m.x)}" y="${f1(m.y + 4.3)}" font-size="12" font-weight="600" letter-spacing="2.2" text-anchor="middle" fill="#fff">${lbl}</text>`;
  } else if (!bg) {
    const pos = { bottom: [PAGE_W / 2, AY + AH + 8], top: [PAGE_W / 2, AY - 8], left: [AX - 4, AY + AH / 2], right: [AX + AW + 4, AY + AH / 2] }[view.boardSide];
    h += `<text x="${pos[0]}" y="${pos[1]}" font-size="12" font-weight="600" letter-spacing="2.2" text-anchor="middle" fill="${pal.ink2}">FRONT</text>`;
  }

  // furniture
  const rectSvg = (r, fill, extra = '') => {
    const c = T({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const w = r.w * s, hh = r.h * s, rx = Math.min(12, Math.min(w, hh) * .28);
    return `<rect x="${f1(-w / 2)}" y="${f1(-hh / 2)}" width="${f1(w)}" height="${f1(hh)}" rx="${f1(rx)}" fill="${fill}" transform="translate(${f1(c.x)} ${f1(c.y)}) rotate(${f1(deg)})" ${extra}/>`;
  };
  for (const it of visible.filter(i => i.type === 'teacher' || (i.type === 'bench' && !Core.itemGeom(i, room.scale).seats.length))) {
    const g = Core.itemGeom(it, room.scale);
    h += rectSvg(g.table, it.type === 'teacher' ? pal.teacher : '#EEF0EC', `stroke="${pal.ink2}" stroke-opacity=".18" filter="url(#${F}sh)"`);
    const c = T({ x: g.table.x + g.table.w / 2, y: g.table.y + g.table.h / 2 });
    const lbl = it.type === 'teacher' ? "TEACHER'S DESK" : 'BENCH';
    const fs = clamp(Math.min(g.table.w, g.table.h) * s * .2, 8, 11);
    h += `<text x="${f1(c.x)}" y="${f1(c.y + fs * .35)}" font-size="${f1(fs)}" font-weight="600" letter-spacing="1.4" text-anchor="middle" fill="${pal.ink2}">${lbl}</text>`;
  }
  const tables = visible.filter(i => Core.isSeated(i) && Core.itemGeom(i, room.scale).seats.length).map(it => {
    const g = Core.itemGeom(it, room.scale);
    const c = T({ x: g.table.x + g.table.w / 2, y: g.table.y + g.table.h / 2 });
    return { it, g, c };
  });
  const frontDist = new Map();
  for (const st of seats) frontDist.set(st.itemId, Math.min(frontDist.get(st.itemId) ?? Infinity, st.dist));
  tables.sort((a, b) => (Math.round(frontDist.get(a.it.id) * 2) - Math.round(frontDist.get(b.it.id) * 2)) || (a.c.x - b.c.x)); // numbered from the front row
  const colourOf = new Map();
  tables.forEach((t, i) => {
    const col = pal.tables[i % pal.tables.length];
    colourOf.set(t.it.id, col);
    h += Core.isRound(t.it)
      ? `<circle cx="${f1(t.c.x)}" cy="${f1(t.c.y)}" r="${f1((t.g.table.w / 2 + .15) * s)}" fill="${col}" filter="url(#${F}sh)"/>`
      : rectSvg(t.g.table, col, `filter="url(#${F}sh)"`);
    const minDim = Math.min(t.g.table.w, t.g.table.h) * s;
    if (minDim >= 26) {
      const r = clamp(minDim * .2, 8, 12);
      h += `<circle cx="${f1(t.c.x)}" cy="${f1(t.c.y)}" r="${f1(r)}" fill="#fff" fill-opacity=".75"/>`;
      h += `<text x="${f1(t.c.x)}" y="${f1(t.c.y + r * .38)}" font-size="${f1(r * 1.05)}" font-weight="600" text-anchor="middle" fill="${shade(col, -45, 10)}">${i + 1}</text>`;
    }
  });

  // ---- name labels ----
  // Each label sits just outside its table edge. Labels along a horizontal edge spread out to
  // use up to half the aisle beside the table; labels on a vertical edge stack and grow outwards
  // into half the free space. Sizes come from real distances so nothing overlaps.
  const pxPerM = s / (room.scale || .5);
  const ph = clamp(pxPerM * .42, 26, 38);
  const base = clamp(ph * .5, 12.5, 17);
  const maxW = Math.min(pxPerM * 1.7, 190);
  const pageRect = g => { const a = T({ x: g.x, y: g.y }), b = T({ x: g.x + g.w, y: g.y + g.h }); return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) }; };
  const rects = new Map();
  for (const it of visible) if (!Core.isWall(it)) rects.set(it.id, pageRect(Core.itemGeom(it, room.scale).table));
  const roomBox = { x0: ox, x1: ox + (maxx - minx) * s, y0: oy, y1: oy + (maxy - miny) * s };
  // free space beyond an edge: the full distance to the wall or to furniture with no seats facing
  // back, otherwise half the gap (the labels opposite need the other half)
  const facing = new Map();
  function freeBeyond(id, dir, edge, lo, hi) {
    const opp = { U: 'D', D: 'U', L: 'R', R: 'L' }[dir];
    let free = { U: edge - roomBox.y0, D: roomBox.y1 - edge, L: edge - roomBox.x0, R: roomBox.x1 - edge }[dir];
    for (const [oid, r] of rects) {
      if (oid === id) continue;
      const vertical = dir === 'U' || dir === 'D';
      if (vertical ? (r.x1 <= lo || r.x0 >= hi) : (r.y1 <= lo || r.y0 >= hi)) continue;
      const d = { U: edge - r.y1, D: r.y0 - edge, L: edge - r.x1, R: r.x0 - edge }[dir];
      if (d > -1) free = Math.min(free, facing.get(oid)?.has(opp) ? Math.max(0, d) / 2 : Math.max(0, d - 4));
    }
    return free;
  }
  // Turned labels may run across neighbouring furniture (they're drawn on top in white), so only
  // the wall and labels coming the other way limit them.
  function freeForTurned(id, dir, edge, lo, hi) {
    const opp = { U: 'D', D: 'U', L: 'R', R: 'L' }[dir];
    let free = { U: edge - roomBox.y0, D: roomBox.y1 - edge, L: edge - roomBox.x0, R: roomBox.x1 - edge }[dir];
    for (const [oid, r] of rects) {
      if (oid === id || !facing.get(oid)?.has(opp)) continue;
      const vertical = dir === 'U' || dir === 'D';
      if (vertical ? (r.x1 <= lo || r.x0 >= hi) : (r.y1 <= lo || r.y0 >= hi)) continue;
      const d = { U: edge - r.y1, D: r.y0 - edge, L: edge - r.x1, R: r.x0 - edge }[dir];
      if (d > -1) free = Math.min(free, Math.max(0, d) / 2);
    }
    return free;
  }
  const P = seats.map(st => {
    const p = T(st), r = rects.get(st.itemId);
    const cxr = (r.x0 + r.x1) / 2, cyr = (r.y0 + r.y1) / 2;
    const ddx = Math.abs(p.x - cxr) - (r.x1 - r.x0) / 2, ddy = Math.abs(p.y - cyr) - (r.y1 - r.y0) / 2;
    const dir = ddx > ddy ? (p.x > cxr ? 'R' : 'L') : (p.y > cyr ? 'D' : 'U');
    return { st, p, r, dir };
  });
  for (const o of P) { if (!assign[o.st.key]) continue; if (!facing.has(o.st.itemId)) facing.set(o.st.itemId, new Set()); facing.get(o.st.itemId).add(o.dir); }
  const nameAt = o => { const sid = assign[o.st.key], st = sid && stById.get(sid); return st ? displayName(cls, st) : ''; };
  // largest single-line font for a name in a box of the given length × thickness
  const oneLineFs = (txt, len, thick) => { let fs = Math.min(base * 1.15, (thick - 6) / 1.15); while (fs > 7 && measure(txt, 500, fs) > len) fs -= .25; return measure(txt, 500, fs) > len ? fs * .6 : fs; };
  const groups = new Map();
  for (const o of P) { const k = o.st.itemId + o.dir; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
  for (const m of groups.values()) {
    const horiz = m[0].dir === 'U' || m[0].dir === 'D';
    const along = o => horiz ? o.p.x : o.p.y, across = o => horiz ? o.p.y : o.p.x;
    m.sort((a, b) => along(a) - along(b));
    const n = m.length, lo = along(m[0]), hi = along(m[n - 1]);
    // room along the edge: up to half the gap to the nearest seat of other furniture in the same band
    const band = horiz ? ph * 1.05 : maxW;
    let nbL = -Infinity, nbR = Infinity;
    for (const o of P) {
      if (o.st.unavailable || o.st.itemId === m[0].st.itemId || Math.abs(across(o) - across(m[0])) >= band) continue;
      if (!horiz && o.dir !== m[0].dir) continue; // only labels pointing the same way stack in a column
      if (along(o) <= lo) nbL = Math.max(nbL, along(o)); else if (along(o) >= hi) nbR = Math.min(nbR, along(o));
    }
    const cap = horiz ? (n > 1 ? pxPerM * .9 : maxW / 2) : (n > 1 ? pxPerM * .3 : ph / 2 + 2);
    const ext = Math.max(0, Math.min(cap, (lo - nbL) / 2 - 2, (nbR - hi) / 2 - 2));
    const slot = n > 1 ? (hi - lo + 2 * ext) / n : 2 * ext;
    // Along a horizontal edge, either write names along the edge, or turn them 90° so they run
    // outwards from the table (the seat spacing becomes the label's thickness). Turn them only when
    // names along the edge would be too small and turning gives clearly larger text.
    let turn = false, tB = 0, lenB = 0, fsB = 0;
    if (horiz) {
      const id = m[0].st.itemId, dir = m[0].dir, edge = dir === 'U' ? m[0].r.y0 : m[0].r.y1;
      const names = m.map(nameAt).filter(Boolean);
      if (names.length) {
        const cs = m.map((o, k) => n > 1 ? lo - ext + (k + .5) * slot : along(o));
        const wA = clamp(Math.min(slot - 4, maxW), 30, maxW);
        const hA = clamp(Math.min(ph, Math.min(...cs.map(c => freeBeyond(id, dir, edge, c - wA / 2, c + wA / 2))) - 3), 18, ph);
        const fsA = Math.min(...names.map(t => oneLineFs(t, wA - 10, hA)));
        const sp = n > 1 ? (hi - lo) / (n - 1) : Math.max(slot, ph);
        tB = clamp(Math.min(sp - 3, ph), 14, ph);
        const freeB = Math.min(...m.map(o => freeForTurned(id, dir, edge, along(o) - tB / 2, along(o) + tB / 2)));
        const room4 = Math.min(freeB - 3, maxW);
        fsB = Math.min(...names.map(t => oneLineFs(t, room4 - 12, tB)));
        lenB = clamp(Math.max(...names.map(t => measure(t, 500, fsB))) + 18, 30, Math.max(30, room4));
        turn = fsA < 11 && fsB > fsA + 1; // only turn when names along the edge would be too small
      }
    }
    const hCol = clamp(Math.min(ph, slot - 3), 18, ph);
    const colNeed = horiz ? 0 : Math.max(44, ...m.map(nameAt).filter(Boolean).map(t => measure(t, 500, Math.min(base, (hCol - 7) / 1.1)) + 20));
    m.forEach((o, k) => {
      const c = n > 1 ? lo - ext + (k + .5) * slot : along(o);
      const r = o.r, dir = o.dir;
      if (horiz && turn) {
        const edge = dir === 'U' ? r.y0 : r.y1;
        o.turned = true; o.t = tB; o.len = lenB; o.fs = fsB;
        o.cx = along(o); o.cy = edge + (dir === 'U' ? -1 : 1) * (2 + lenB / 2);
        o.w = tB; o.h = lenB;
      } else if (horiz) {
        o.w = clamp(Math.min(slot - 4, maxW), 30, maxW);
        const edge = dir === 'U' ? r.y0 : r.y1;
        const free = freeBeyond(o.st.itemId, dir, edge, c - o.w / 2, c + o.w / 2);
        o.h = clamp(Math.min(ph, free - 3), 18, ph);
        o.maxH = Math.max(o.h, Math.min(free - 3, ph * 1.6));
        o.cx = c; o.edge = edge;
      } else {
        o.h = clamp(Math.min(ph, slot - 3), 18, ph);
        o.maxH = o.h;
        const edge = dir === 'L' ? r.x0 : r.x1;
        // like turned labels, side labels may run across neighbouring furniture; only the wall
        // and labels coming the other way limit them
        // labels facing each other across an aisle share it in proportion to their names (below)
        const wall = dir === 'L' ? edge - roomBox.x0 : roomBox.x1 - edge;
        o.w = clamp(Math.min(wall - 4, colNeed), 34, 260);
        o.edge = edge;
        o.cx = edge + (dir === 'L' ? -1 : 1) * (2 + o.w / 2);
        o.cy = c;
      }
    });
  }
  // turned and side labels never overlap another label: shorten each to stop just before one in its path
  const boxOf = o => o.turned ? { x0: o.cx - o.t / 2, x1: o.cx + o.t / 2, y0: o.cy - o.len / 2, y1: o.cy + o.len / 2 }
    : o.cy != null ? { x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, y0: o.cy - o.h / 2, y1: o.cy + o.h / 2 }
    : o.dir === 'U' ? { x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, y0: o.edge - 2 - o.maxH, y1: o.edge - 2 }
    : { x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, y0: o.edge + 2, y1: o.edge + 2 + o.maxH };
  const shown = P.filter(o => o.cx != null && !o.st.unavailable && (assign[o.st.key] || opts.interactive));
  const solid = shown.filter(o => assign[o.st.key]);
  // side labels facing each other across an aisle: split the gap in proportion to what each needs
  for (const a of solid) {
    if (a.dir !== 'R') continue;
    for (const b of solid) {
      if (b.dir !== 'L' || b.edge <= a.edge || Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2) <= 6) continue;
      const room = b.edge - a.edge - 7;
      if (a.w + b.w <= room) continue;
      const k = Math.max(0, room) / (a.w + b.w);
      a.w = Math.max(34, a.w * k); b.w = Math.max(34, b.w * k);
      a.cx = a.edge + 2 + a.w / 2; b.cx = b.edge - 2 - b.w / 2;
    }
  }
  for (const o of shown) {
    if (o.dir === 'L' || o.dir === 'R') {
      const right = o.dir === 'R', start = right ? o.cx - o.w / 2 : o.cx + o.w / 2;
      let end = right ? o.cx + o.w / 2 : o.cx - o.w / 2;
      const me = boxOf(o);
      for (const q of solid) {
        if (q === o) continue;
        const b = boxOf(q);
        if (b.y1 <= me.y0 + 6 || b.y0 >= me.y1 - 6) continue; // rounded ends can pass a few px of overlap
        if (right && b.x0 > start && b.x0 - 3 < end) end = b.x0 - 3;
        if (!right && b.x1 < start && b.x1 + 3 > end) end = b.x1 + 3;
      }
      o.w = Math.max(34, Math.abs(end - start));
      o.cx = (start + end) / 2;
      continue;
    }
    if (!o.turned) continue;
    const down = o.dir === 'D', start = down ? o.cy - o.len / 2 : o.cy + o.len / 2;
    let end = down ? o.cy + o.len / 2 : o.cy - o.len / 2;
    const me = boxOf(o);
    for (const q of solid) {
      if (q === o) continue;
      const b = boxOf(q);
      if (b.x1 <= me.x0 + 6 || b.x0 >= me.x1 - 6) continue;
      if (down && b.y0 > start && b.y0 - 3 < end) end = b.y0 - 3;
      if (!down && b.y1 < start && b.y1 + 3 > end) end = b.y1 + 3;
    }
    o.len = Math.max(30, Math.abs(end - start));
    o.cy = (start + (down ? start + o.len : start - o.len)) / 2;
  }
  // every side or turned label on the same table side uses the same text size
  const groupFs = new Map();
  for (const o of solid) {
    if (!o.turned && o.dir !== 'L' && o.dir !== 'R') continue;
    const nm = nameAt(o), k = o.st.itemId + o.dir;
    const fs = o.turned ? oneLineFs(nm, o.len - 12, o.t) : oneLineFs(nm, o.w - 10, o.h);
    groupFs.set(k, Math.min(groupFs.get(k) ?? Infinity, Math.min(fs, o.turned ? base * 1.15 : base)));
  }
  // turned labels read towards the board (top-to-bottom when the board is at the bottom of the page)
  const turnDeg = view.boardSide.startsWith('top') ? -90 : 90;
  const tray = [];
  for (const o of P) {
    const { st, p, w } = o;
    const col = colourOf.get(st.itemId) || pal.tables[0];
    const sid = assign[st.key];
    const stu = sid && stById.get(sid);
    if (st.unavailable) {
      if (!priv) continue; // unavailable seats are an editing aid only
      tray.push(`<g><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="8" fill="#F1F0EC" stroke="#CFCBC2" stroke-dasharray="3 2"/><text x="${f1(p.x)}" y="${f1(p.y + 3.8)}" font-size="10" text-anchor="middle" fill="#A9A49A">×</text></g>`);
      continue;
    }
    if (!stu) {
      // empty seat: a faint chair on paper; a dashed drop target while editing
      if (!opts.interactive) { tray.push(`<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="5" fill="none" stroke="${shade(col, -18, 5)}" stroke-opacity=".55" stroke-width="1.2"/>`); continue; }
      const hh = o.h, cy = o.cy ?? (o.dir === 'U' ? o.edge - 2 - hh / 2 : o.edge + 2 + hh / 2);
      const bw = o.turned ? Math.max(o.len, 30) : w, bh = o.turned ? o.t : hh;
      tray.push(`<g data-seat="${st.key}"${o.turned ? ` transform="rotate(${turnDeg} ${f1(o.cx)} ${f1(cy)})"` : ''}><rect x="${f1(o.cx - bw / 2)}" y="${f1(cy - bh / 2)}" width="${f1(bw)}" height="${f1(bh)}" rx="${f1(bh / 2)}" fill="#fff" fill-opacity=".55" stroke="${shade(col, -22, 5)}" stroke-width="1.2" stroke-dasharray="4 4"/></g>`);
      continue;
    }
    if (o.turned) {
      const L = o.len, t = o.t, cx = o.cx, cy = o.cy, x = cx - L / 2, top = cy - t / 2;
      // shrink to fit the space first (down to 7px); only abbreviate/truncate if it still won't fit
      const nm = displayName(cls, stu), fsT = Math.min(oneLineFs(nm, L - 12, t), groupFs.get(st.itemId + o.dir) ?? Infinity);
      const fit = measure(nm, 500, fsT) <= L - 12 ? { lines: [nm], fs: fsT } : fitName(nm, L - 12, 9, false, 1);
      const isSel = opts.interactive && ui.selStudent === stu.id;
      const bad = priv && violSeats.has(st.key);
      const stroke = isSel ? pal.accent : bad ? '#D1495B' : shade(col, -22, 8);
      let g = `<g data-seat="${st.key}" data-student="${stu.id}" transform="rotate(${turnDeg} ${f1(cx)} ${f1(cy)})">`;
      g += `<rect x="${f1(x)}" y="${f1(top)}" width="${f1(L)}" height="${f1(t)}" rx="${f1(t / 2)}" fill="#fff" stroke="${stroke}" stroke-width="${isSel || bad ? 2.6 : 1.5}" filter="url(#${F}shs)"/>`;
      g += `<text x="${f1(cx)}" y="${f1(cy + fit.fs * .35)}" font-size="${f1(fit.fs)}" font-weight="500" text-anchor="middle" fill="${pal.ink}">${esc(fit.lines[0])}</text>`;
      if (priv) {
        if (stu.front) g += `<circle cx="${f1(x + 5)}" cy="${f1(top + 3)}" r="7.5" fill="#F6C343" stroke="#fff" stroke-width="1.5"/><path d="${starPath(x + 5, top + 3, 4.6)}" fill="#fff"/>`;
        if (stu.lock && stu.lock === st.key) g += `<circle cx="${f1(x + L - 5)}" cy="${f1(top + 3)}" r="7.5" fill="${pal.accent}" stroke="#fff" stroke-width="1.5"/>${lockGlyph(x + L - 5, top + 3)}`;
        if (bad) g += `<circle cx="${f1(x + L - (stu.lock === st.key ? 21 : 5))}" cy="${f1(top + 3)}" r="7.5" fill="#D1495B" stroke="#fff" stroke-width="1.5"/><text x="${f1(x + L - (stu.lock === st.key ? 21 : 5))}" y="${f1(top + 6.6)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">!</text>`;
      }
      tray.push(g + '</g>');
      continue;
    }
    const fsMax = Math.min(base, (o.h - 7) / 1.1);
    const maxLines = Math.max(1, Math.min(3, Math.floor((o.maxH - 7) / (fsMax * .8 * 1.12))));
    const gfs = groupFs.get(st.itemId + o.dir);
    let fit = gfs && measure(displayName(cls, stu), 500, gfs) <= w - 10 ? { lines: [displayName(cls, stu)], fs: gfs } : fitName(displayName(cls, stu), w - 10, fsMax, false, maxLines);
    if (fit.lines[fit.lines.length - 1].endsWith('…') || fit.lines[0] !== displayName(cls, stu) && fit.lines.length === 1) {
      // shrink to fit (down to 7px) before abbreviating
      const nm = displayName(cls, stu), fs1 = oneLineFs(nm, w - 10, o.h);
      if (measure(nm, 500, fs1) <= w - 10) fit = { lines: [nm], fs: fs1 };
    }
    const lh = fit.fs * 1.12;
    const hh = clamp(fit.lines.length * lh + 8, o.h, o.maxH);
    const cy = o.cy ?? (o.dir === 'U' ? o.edge - 2 - hh / 2 : o.edge + 2 + hh / 2);
    const x = o.cx - w / 2, cx = o.cx;
    const isSel = opts.interactive && ui.selStudent === stu.id;
    const bad = priv && violSeats.has(st.key);
    const stroke = isSel ? pal.accent : bad ? '#D1495B' : shade(col, -22, 8);
    let g = `<g data-seat="${st.key}" data-student="${stu.id}">`;
    g += `<rect x="${f1(x)}" y="${f1(cy - hh / 2)}" width="${f1(w)}" height="${f1(hh)}" rx="${f1(Math.min(hh, ph) / 2)}" fill="#fff" stroke="${stroke}" stroke-width="${isSel || bad ? 2.6 : 1.5}" filter="url(#${F}shs)"/>`;
    const y0 = cy - (fit.lines.length - 1) * lh / 2 + fit.fs * .35;
    fit.lines.forEach((ln, i) => { g += `<text x="${f1(cx)}" y="${f1(y0 + i * lh)}" font-size="${f1(fit.fs)}" font-weight="500" text-anchor="middle" fill="${pal.ink}">${esc(ln)}</text>`; });
    if (priv) {
      const top = cy - hh / 2;
      if (stu.front) g += `<circle cx="${f1(x + 5)}" cy="${f1(top + 3)}" r="7.5" fill="#F6C343" stroke="#fff" stroke-width="1.5"/><path d="${starPath(x + 5, top + 3, 4.6)}" fill="#fff"/>`;
      if (stu.lock && stu.lock === st.key) g += `<circle cx="${f1(x + w - 5)}" cy="${f1(top + 3)}" r="7.5" fill="${pal.accent}" stroke="#fff" stroke-width="1.5"/>${lockGlyph(x + w - 5, top + 3)}`;
      if (bad) g += `<circle cx="${f1(x + w - (stu.lock === st.key ? 21 : 5))}" cy="${f1(top + 3)}" r="7.5" fill="#D1495B" stroke="#fff" stroke-width="1.5"/><text x="${f1(x + w - (stu.lock === st.key ? 21 : 5))}" y="${f1(top + 6.6)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">!</text>`;
    }
    g += '</g>';
    tray.push(g);
  }
  h += tray.join('');

  // footer
  const nSeated = Object.keys(assign).length;
  const nAvail = seats.filter(x => !x.unavailable).length;
  const foot = `${cls.perspective === 'teacher' ? "Teacher's view" : "Student's view"} · board at the ${view.boardSide}`;
  h += `<text x="56" y="${PAGE_H - 22}" font-size="11.5" fill="${pal.ink2}">${foot}</text>`;
  if (priv) {
    const lx = 56 + measure(foot, 400, 11.5) + 40;
    h += `<g transform="translate(${lx} ${PAGE_H - 26})"><circle cx="0" cy="0" r="6.5" fill="#F6C343"/><path d="${starPath(0, 0, 4)}" fill="#fff"/><text x="11" y="4" font-size="11" fill="${pal.ink2}">Front priority</text>
      <circle cx="108" cy="0" r="6.5" fill="${pal.accent}"/>${lockGlyph(108, 0)}<text x="119" y="4" font-size="11" fill="${pal.ink2}">Locked seat</text>
      <circle cx="210" cy="0" r="6.5" fill="#D1495B"/><text x="210" y="3.6" font-size="9" font-weight="700" text-anchor="middle" fill="#fff">!</text><text x="221" y="4" font-size="11" fill="${pal.ink2}">Breaks a rule</text></g>`;
  }
  h += `<text x="${PAGE_W - 56}" y="${PAGE_H - 22}" font-size="11.5" text-anchor="end" fill="${pal.ink2}">${cls.students.length} students · ${nSeated} seated · ${nAvail} seats</text>`;
  return h + '</svg>';
}
function starPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
  }
  return d + 'Z';
}
function lockGlyph(cx, cy) {
  return `<rect x="${(cx - 3).toFixed(1)}" y="${(cy - .6).toFixed(1)}" width="6" height="4.6" rx="1" fill="#fff"/><path d="M${(cx - 1.9).toFixed(1)} ${(cy - .4).toFixed(1)}v-1.3a1.9 1.9 0 0 1 3.8 0v1.3" fill="none" stroke="#fff" stroke-width="1.2"/>`;
}

/* ---------- plan interactions: drag to swap, tap to select ---------- */
let pdrag = null;
function studentSeat(cls, id) { return Object.keys(cls.plan.assign).find(k => cls.plan.assign[k] === id) || null; }
function moveStudent(id, to) {
  const cls = activeClass();
  const room = classRoom(cls);
  const st = cls.students.find(s => s.id === id);
  const from = studentSeat(cls, id);
  if (to === from) return;
  if (to === null) {
    mutate(() => { delete cls.plan.assign[from]; if (st.lock) st.lock = null; });
    return;
  }
  const seat = Core.roomSeats(room).find(s => s.key === to);
  if (!seat || seat.unavailable) return toast('That seat is unavailable.');
  const occ = cls.plan.assign[to];
  const occSt = occ && cls.students.find(s => s.id === occ);
  if (occSt && occSt.lock === to) return toast(`${occSt.name} is locked to that seat. Unlock them first.`);
  mutate(() => {
    if (occ) { if (from) cls.plan.assign[from] = occ; else delete cls.plan.assign[to]; }
    else if (from) delete cls.plan.assign[from];
    cls.plan.assign[to] = id;
    if (st.lock) st.lock = to;
    ui.result = ui.result && ui.result.classId === cls.id ? { ...ui.result, problems: [], warnings: [], ok: true } : ui.result;
  });
  const viol = Core.checkPlan({ seats: Core.roomSeats(room), assignment: cls.plan.assign, rules: cls.rules, mode: cls.adjacency });
  if (viol.some(v => v.students.includes(id) || (occ && v.students.includes(occ)))) toast('⚠ That swap breaks a rule (marked in red).');
}
function startPlanDrag(e, id, el) {
  e.preventDefault();
  pdrag = { id, sx: e.clientX, sy: e.clientY, moved: false, ghost: null, el };
}
$('#planPage').addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-student]');
  if (!g) { if (ui.selStudent) { ui.selStudent = null; renderPlanTab(); } return; }
  startPlanDrag(e, g.dataset.student, g);
});
$('#tray').addEventListener('pointerdown', e => { const c = e.target.closest('[data-tray]'); if (c) startPlanDrag(e, c.dataset.tray, c); });
document.addEventListener('pointermove', e => {
  if (!pdrag) return;
  if (!pdrag.moved && Math.hypot(e.clientX - pdrag.sx, e.clientY - pdrag.sy) < 6) return;
  if (!pdrag.moved) {
    pdrag.moved = true;
    const st = activeClass().students.find(s => s.id === pdrag.id);
    pdrag.ghost = document.createElement('div');
    pdrag.ghost.className = 'drag-ghost';
    pdrag.ghost.textContent = st ? st.name : '';
    document.body.appendChild(pdrag.ghost);
    if (pdrag.el) pdrag.el.style.opacity = '.35';
  }
  pdrag.ghost.style.left = e.clientX + 'px'; pdrag.ghost.style.top = e.clientY + 'px';
  const over = document.elementFromPoint(e.clientX, e.clientY);
  $('#tray').classList.toggle('drop', !!(over && over.closest('#tray')));
});
document.addEventListener('pointerup', e => {
  if (!pdrag) return;
  const d = pdrag; pdrag = null;
  if (d.ghost) d.ghost.remove();
  $('#tray').classList.remove('drop');
  if (d.el) d.el.style.opacity = '';
  if (!d.moved) { ui.selStudent = ui.selStudent === d.id ? null : d.id; renderPlanTab(); return; }
  const over = document.elementFromPoint(e.clientX, e.clientY);
  if (!over) return;
  if (over.closest('#tray')) return moveStudent(d.id, null);
  const seatEl = over.closest('#planPage [data-seat]');
  if (seatEl) moveStudent(d.id, seatEl.dataset.seat);
});
document.addEventListener('pointercancel', () => { if (pdrag) { if (pdrag.ghost) pdrag.ghost.remove(); if (pdrag.el) pdrag.el.style.opacity = ''; pdrag = null; } });

function bindPlan() {
  $('#genBtn').addEventListener('click', () => generate(false));
  $('#editRoomBtn').addEventListener('click', () => { const r = classRoom(activeClass()); if (r) data.activeRoomId = r.id; setTab('room'); });
  $('#shuffleBtn').addEventListener('click', () => generate(true));
  $('#clearPlanBtn').addEventListener('click', () => mutate(() => { activeClass().plan = { assign: {} }; ui.result = null; }));
  $('#perspSeg').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) mutate(() => { const c = activeClass(); c.perspective = b.dataset.p; c.planRot = 0; }); });
  $('#rotL').addEventListener('click', () => mutate(() => { const c = activeClass(); c.planRot = ((c.planRot || 0) + 3) % 4; }));
  $('#rotR').addEventListener('click', () => mutate(() => { const c = activeClass(); c.planRot = ((c.planRot || 0) + 1) % 4; }));
  $('#showPrivate').addEventListener('change', e => { ui.showPrivate = e.target.checked; saveUI(); renderPlanTab(); });
  $('#nameFormat').addEventListener('change', e => mutate(() => { activeClass().nameFormat = e.target.value; }));
  $('#paletteSwatches').addEventListener('click', e => { const b = e.target.closest('[data-pal]'); if (b) mutate(() => { activeClass().palette = b.dataset.pal; }); });
  const hdr = (sel, fn) => $(sel).addEventListener('change', e => mutate(() => fn(activeClass(), e.target.value.trim())));
  hdr('#hdrTitle', (c, v) => { if (v) c.name = v; });
  hdr('#hdrRoom', (c, v) => { const r = classRoom(c); c.roomLabel = r && v === r.name ? '' : v; });
  hdr('#hdrTeacher', (c, v) => { c.teacher = v; });
  hdr('#hdrDate', (c, v) => { c.date = v === todayStr() ? '' : v; });
  $('#selStudent').addEventListener('click', e => {
    const b = e.target.closest('[data-selact]');
    if (!b) return;
    const cls = activeClass();
    const st = cls.students.find(s => s.id === ui.selStudent);
    if (!st) return;
    const key = studentSeat(cls, st.id);
    if (b.dataset.selact === 'close') { ui.selStudent = null; renderPlanTab(); }
    if (b.dataset.selact === 'lock') mutate(() => { st.lock = st.lock === key ? null : key; });
    if (b.dataset.selact === 'front') mutate(() => { st.front = !st.front; });
    if (b.dataset.selact === 'unseat') moveStudent(st.id, null);
  });
  $('#printBtn').addEventListener('click', doPrint);
  $('#printBtn').hidden = !!window.claude; // artifact previews can't open the print dialog
  $('#pngBtn').addEventListener('click', () => doExport('png'));
  $('#pdfBtn').addEventListener('click', () => doExport('pdf'));
}

/* ---------- exports ---------- */
function exportSvgString(fontCss) {
  const cls = activeClass();
  const room = classRoom(cls);
  const viol = Core.checkPlan({ seats: Core.roomSeats(room), assignment: cls.plan.assign, rules: cls.rules, mode: cls.adjacency });
  return buildPlanSVG(cls, room, { priv: false, interactive: false, viol, fontCss });
}
function fileBase() { return (activeClass().name || 'seating-plan').replace(/[^\w-]+/g, '_') + '_seating_plan'; }
function doPrint() {
  const cls = activeClass();
  if (!classRoom(cls)) return toast('Link this class to a room first.');
  $('#printArea').innerHTML = exportSvgString();
  setTimeout(() => { window.print(); }, 50);
}
window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });

let fontCssCache = null;
async function embeddedFontCss() {
  // Fetches the Poppins font files from Google Fonts (no user data is sent) and inlines them,
  // so the PNG/PDF render with the same typography. Falls back to system fonts if offline.
  if (fontCssCache !== null) return fontCssCache;
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap')).text();
    const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*{[^}]*})/g)].filter(m => m[1] === 'latin' || m[1] === 'latin-ext');
    const out = [];
    for (const [, , block] of blocks) {
      const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];
      if (!url) continue;
      const buf = await (await fetch(url)).arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      out.push(block.replace(url, 'data:font/woff2;base64,' + btoa(bin)));
    }
    fontCssCache = out.join('\n');
  } catch (e) { fontCssCache = ''; }
  return fontCssCache;
}
async function renderCanvas(scale) {
  const svgStr = exportSvgString(await embeddedFontCss());
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  await new Promise(r => setTimeout(r, 80)); // let embedded fonts settle (Safari)
  const c = document.createElement('canvas');
  c.width = Math.round(PAGE_W * scale); c.height = Math.round(PAGE_H * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
/* Saves a file. On a normal website this is a plain download; inside a claude.ai artifact preview
   (which blocks downloads) it goes through the viewer's save prompt instead. Resolves true if saved. */
async function download(blob, name) {
  if (!window.claude) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }
  const dl = await window.claude.use('downloads');
  if (!dl) { toast('Saving files isn’t available in this view.'); return false; }
  try { await dl.save({ filename: name, data: blob }); return true; }
  catch (e) {
    if (e && e.code === 'declined') return false;
    toast(e && e.code === 'rate_limited' ? 'A save prompt is already open.' : 'Could not save the file here.');
    return false;
  }
}
async function doExport(kind) {
  if (!classRoom(activeClass())) return toast('Link this class to a room first.');
  toast(kind === 'png' ? 'Preparing PNG…' : 'Preparing PDF…');
  try {
    const c = await renderCanvas(kind === 'png' ? 2.5 : 2.2);
    if (kind === 'png') {
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      if (await download(blob, fileBase() + '.png')) toast('Saved ✓');
    } else {
      const b64 = c.toDataURL('image/jpeg', .93).split(',')[1];
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      if (await download(makePdf(bytes, c.width, c.height), fileBase() + '.pdf')) toast('Saved ✓');
    }
  } catch (e) {
    console.error(e);
    toast('Export failed in this browser. Try Print → Save as PDF instead.');
  }
}
/* Minimal one-page PDF (A4 landscape) wrapping a JPEG. */
function makePdf(jpeg, w, h) {
  const enc = new TextEncoder();
  const parts = []; let len = 0; const off = [];
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { off[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  off[4] = len;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push('\nendstream\nendobj\n');
  const content = 'q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map(n => String(off[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
