'use strict';
/* =================================================================
   1. ROOM BUILDER
================================================================= */
const svg = $('#roomSvg');
const PALETTE_ITEMS = ['single', 'pair', 'group4', 'group6', 'round4', 'custom', 'bench4', 'bench', 'teacher', 'board', 'door', 'window',
  '|Storage and fittings', 'bookcase', 'cupboard', 'filing', 'lockers', 'trolley', 'sink', 'fume', 'rug'];  // '|' starts a sub-heading
/* Palette entries that are a preset of another furniture type (a lab bench sized for 4). */
const PALETTE_PRESETS = { bench4: { type: 'bench', label: 'Lab bench (4)', lenM: 1.6, sides: { t: 2, b: 2 } } };
const PALETTE_LABELS = { bench: 'Lab bench (6)' };
const palLabel = t => PALETTE_PRESETS[t] ? PALETTE_PRESETS[t].label : PALETTE_LABELS[t] || Core.TYPES[t].label;
const ICONS = {
  single: '<rect x="15" y="5" width="14" height="9" rx="2" fill="#EDE6DA" stroke="#B9AE9C"/><circle cx="22" cy="21" r="4" fill="#fff" stroke="#8D93A0"/>',
  pair: '<rect x="6" y="5" width="32" height="9" rx="2" fill="#EDE6DA" stroke="#B9AE9C"/><circle cx="14" cy="21" r="4" fill="#fff" stroke="#8D93A0"/><circle cx="30" cy="21" r="4" fill="#fff" stroke="#8D93A0"/>',
  group4: '<rect x="8" y="9" width="28" height="12" rx="2" fill="#EDE6DA" stroke="#B9AE9C"/><g fill="#fff" stroke="#8D93A0"><circle cx="15" cy="5" r="3.5"/><circle cx="29" cy="5" r="3.5"/><circle cx="15" cy="25" r="3.5"/><circle cx="29" cy="25" r="3.5"/></g>',
  group6: '<rect x="4" y="9" width="36" height="12" rx="2" fill="#EDE6DA" stroke="#B9AE9C"/><g fill="#fff" stroke="#8D93A0"><circle cx="10" cy="5" r="3.5"/><circle cx="22" cy="5" r="3.5"/><circle cx="34" cy="5" r="3.5"/><circle cx="10" cy="25" r="3.5"/><circle cx="22" cy="25" r="3.5"/><circle cx="34" cy="25" r="3.5"/></g>',
  round4: '<circle cx="22" cy="15" r="8" fill="#EDE6DA" stroke="#B9AE9C"/><g fill="#fff" stroke="#8D93A0"><circle cx="22" cy="3.5" r="3"/><circle cx="22" cy="26.5" r="3"/><circle cx="8" cy="15" r="3"/><circle cx="36" cy="15" r="3"/></g>',
  custom: '<rect x="11" y="8" width="22" height="14" rx="2" fill="#EDE6DA" stroke="#B9AE9C"/><g fill="#fff" stroke="#8D93A0"><circle cx="22" cy="4" r="3"/><circle cx="22" cy="26" r="3"/><circle cx="6" cy="15" r="3"/><circle cx="38" cy="15" r="3"/></g>',
  bench4: '<rect x="10" y="9" width="24" height="11" rx="2" fill="#DDE7E3" stroke="#93ADA3"/><g fill="#fff" stroke="#8D93A0"><circle cx="16" cy="4.5" r="3"/><circle cx="28" cy="4.5" r="3"/><circle cx="16" cy="25" r="3"/><circle cx="28" cy="25" r="3"/></g>',
  bookcase: '<rect x="7" y="9" width="30" height="11" rx="1.5" fill="#E9DCC8" stroke="#A8916F"/><path d="M13 9v11M19 9v11M25 9v11M31 9v11" stroke="#A8916F"/>',
  cupboard: '<rect x="7" y="8" width="30" height="14" rx="1.5" fill="#E4E0D6" stroke="#9C9584"/><path d="M22 8v14" stroke="#9C9584"/><circle cx="19.5" cy="15" r="1" fill="#9C9584"/><circle cx="24.5" cy="15" r="1" fill="#9C9584"/>',
  filing: '<rect x="14" y="5" width="16" height="20" rx="1.5" fill="#DCE1E6" stroke="#8C96A1"/><path d="M14 11.7h16M14 18.3h16" stroke="#8C96A1"/><path d="M20 8.5h4M20 15h4M20 21.5h4" stroke="#8C96A1" stroke-linecap="round"/>',
  lockers: '<rect x="5" y="8" width="34" height="14" rx="1.5" fill="#D9E3EC" stroke="#8496A8"/><path d="M13.5 8v14M22 8v14M30.5 8v14" stroke="#8496A8"/><path d="M8 12h3M16.5 12h3M25 12h3M33.5 12h3" stroke="#8496A8" stroke-linecap="round"/>',
  trolley: '<rect x="9" y="8" width="26" height="14" rx="2" fill="#E2DDEE" stroke="#8F86A8"/><path d="M13 11v8M17 11v8M21 11v8M25 11v8M29 11v8" stroke="#8F86A8" stroke-linecap="round"/>',
  sink: '<rect x="9" y="7" width="26" height="16" rx="2" fill="#E3ECEF" stroke="#8AA2AA"/><rect x="13" y="10" width="18" height="10" rx="3" fill="#fff" stroke="#8AA2AA"/><circle cx="22" cy="15" r="1.3" fill="#8AA2AA"/>',
  fume: '<rect x="8" y="5" width="28" height="18" rx="1.5" fill="#E7E3D9" stroke="#9A927E"/><rect x="11" y="13" width="22" height="8" rx="1" fill="#D7EAF2" stroke="#9A927E"/><path d="M15 9h14" stroke="#9A927E" stroke-linecap="round"/>',
  rug: '<rect x="5" y="6" width="34" height="18" rx="4" fill="#F1E2D3" stroke="#C9A98A" stroke-dasharray="2 1.5"/><rect x="9" y="10" width="26" height="10" rx="2.5" fill="none" stroke="#C9A98A"/>',
  bench: '<rect x="3" y="9" width="38" height="11" rx="2" fill="#DDE7E3" stroke="#93ADA3"/><circle cx="12" cy="25" r="3" fill="#fff" stroke="#8D93A0"/><circle cx="32" cy="25" r="3" fill="#fff" stroke="#8D93A0"/>',
  teacher: '<rect x="8" y="5" width="28" height="13" rx="2" fill="#DCE3EE" stroke="#8E9BB2"/><circle cx="22" cy="24" r="4" fill="#8E9BB2"/>',
  board: '<line x1="4" y1="8" x2="40" y2="8" stroke="#2F3A4F" stroke-width="5" stroke-linecap="round"/><text x="22" y="24" font-size="8" text-anchor="middle" fill="#2F3A4F" font-family="Figtree" font-weight="700">FRONT</text>',
  door: '<line x1="4" y1="6" x2="40" y2="6" stroke="#39404E" stroke-width="3"/><line x1="12" y1="6" x2="28" y2="6" stroke="#fff" stroke-width="4"/><path d="M12 6 L12 22 M12 22 A16 16 0 0 0 28 6" fill="none" stroke="#A0764F" stroke-width="1.5"/>',
  window: '<line x1="4" y1="12" x2="40" y2="12" stroke="#39404E" stroke-width="3"/><line x1="10" y1="12" x2="34" y2="12" stroke="#A9CDE8" stroke-width="5"/><line x1="10" y1="12" x2="34" y2="12" stroke="#fff" stroke-width="1.2"/>',
};

function buildPalette() {
  $('#paletteGrid').innerHTML = PALETTE_ITEMS.map(t => t[0] === '|' ? `<div class="pal-sub">${esc(t.slice(1))}</div>` : `<button class="pal-item" data-type="${t}"><svg viewBox="0 0 44 30">${ICONS[t]}</svg>${esc(palLabel(t))}</button>`).join('');
  $('#presetRow').innerHTML = Object.entries(Sample.PRESETS).map(([k, p]) => `<button class="btn sm" data-preset="${k}">${esc(p.label)}</button>`).join('');
}

const isAxisRect = b => b.length === 4 && b.every((p, i) => { const q = b[(i + 1) % 4]; return Math.abs(p.x - q.x) < 1e-9 || Math.abs(p.y - q.y) < 1e-9; });
function fmtLen(room, L) {
  const u = Math.round(L * 10) / 10;
  return room.showMetres ? `${u} (${(L * (room.scale || .5)).toFixed(1)} m)` : `${u}`;
}

function roomBBox(room) {
  const xs = room.boundary.map(p => p.x), ys = room.boundary.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
function fitView(room) {
  const b = roomBBox(room);
  const m = 3, mx = room.showMetres ? 5.5 : 3.5;
  ui.view = { x: b.x - mx, y: b.y - m, w: b.w + 2 * mx, h: b.h + 2 * m };
  ui.viewRoom = room.id;
}
function zoomAt(f, cx, cy) {
  const v = ui.view;
  if (cx === undefined) { cx = v.x + v.w / 2; cy = v.y + v.h / 2; }
  const nw = clamp(v.w * f, 6, 300), k = nw / v.w;
  ui.view = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: nw, h: v.h * k };
  renderRoomSvg();
}
function toUnits(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const m = svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

function renderRoomTab() {
  const room = activeRoom();
  $('#roomSelect').innerHTML = data.rooms.map(r => `<option value="${r.id}" ${r.id === room.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  if (document.activeElement !== $('#roomName')) $('#roomName').value = room.name;
  $('#roomDel').disabled = data.rooms.length < 2;
  $('#showMetres').checked = !!room.showMetres;
  if (document.activeElement !== $('#scaleInput')) $('#scaleInput').value = room.scale || .5;
  $('#snapAngles').checked = ui.snapAngles;
  $('#showDist').checked = ui.showDist;
  $$('#toolSeg button').forEach(b => b.classList.toggle('on', b.dataset.tool === ui.tool));
  $('#toolHint').innerHTML = {
    select: 'Drag to move. Tap a seat to turn it off. <kbd>R</kbd> rotates, <kbd>Del</kbd> removes.',
    shape: isAxisRect(room.boundary)
      ? 'Drag a corner to resize. Click a wall to add a corner.'
      : 'Drag a corner to move it. Click a wall to add one; <kbd>Del</kbd> removes the selected corner.',
    draw: 'Click to place corners; click the first one or press <kbd>Enter</kbd> to finish. Hold <kbd>Shift</kbd> to draw freely.',
  }[ui.tool];
  // presets and snapping only matter while editing the walls
  $('#presetRow').hidden = ui.tool === 'select';
  $('#snapRow').hidden = ui.tool !== 'draw';
  const teacher = room.items.find(i => i.type === 'teacher'), board = Core.boardOf(room);
  $('#toggleTeacher').checked = !!teacher && !teacher.hidden;
  $('#toggleBoard').checked = !!board && !board.hidden;
  $('#roomTitle').textContent = room.name;
  renderSelSection(room);
  renderRoomSvg();
  renderRoomStatus(room);
}

function renderRoomStatus(room) {
  const seats = Core.roomSeats(room);
  const avail = seats.filter(s => !s.unavailable).length;
  const bad = room.items.filter(i => Core.itemProblem(room, i)).length;
  const L = room.boundary.reduce((a, p, i) => a + Math.hypot(room.boundary[(i + 1) % room.boundary.length].x - p.x, room.boundary[(i + 1) % room.boundary.length].y - p.y), 0);
  const area = Math.abs(Core.polyArea(room.boundary)) * (room.scale || .5) ** 2;
  const classes = data.classes.filter(c => c.roomId === room.id);
  $('#roomStatus').innerHTML = `<span><b>${avail}</b> seats available${seats.length - avail ? ` (${seats.length - avail} unavailable)` : ''}</span>
    <span>Floor ≈ ${area.toFixed(1)} m² · walls ${fmtLen(room, L)}</span>
    ${!Core.boardOf(room) ? '<span class="bad">No board: add one to define the front</span>' : ''}
    ${bad ? `<span class="bad">${bad} item${bad > 1 ? 's' : ''} outside the walls or overlapping</span>` : ''}
    <span class="muted">Used by: ${classes.length ? classes.map(c => esc(c.name)).join(', ') : 'no classes yet'}</span>`;
}

function renderSelSection(room) {
  const el = $('#selSection');
  if (ui.tool === 'shape' && ui.selVertex !== null && room.boundary[ui.selVertex]) {
    el.innerHTML = `<h2>Corner ${ui.selVertex + 1}</h2><div class="btn-row"><button class="btn sm danger" id="delVertex" ${room.boundary.length <= 3 ? 'disabled' : ''}>Delete corner</button></div>`;
    return;
  }
  const it = ui.selItem && getItem(room, ui.selItem);
  if (!it || ui.tool !== 'select') { el.innerHTML = ''; return; }
  const T = Core.TYPES[it.type];
  const g = !Core.isWall(it) ? Core.itemGeom(it, room.scale) : null;
  let h = `<h2>Selected: ${esc(T.label)}</h2><div class="btn-row">
    ${!Core.isWall(it) ? '<button class="btn sm" data-act="rotate">⟳ Rotate 90°</button>' : ''}
    <button class="btn sm" data-act="dup">⧉ Duplicate</button>
    <button class="btn sm danger" data-act="del">Delete</button></div>`;
  if (it.type === 'custom' || it.type === 'bench') {
    const s = it.sides || {};
    const sideIn = (k, lbl) => `<label class="field" style="flex:1"><span>${lbl}</span><input class="input" type="number" min="0" max="12" data-side="${k}" value="${s[k] || 0}"></label>`;
    if (it.type === 'bench') h += `<label class="field"><span>Bench length (m)</span><input class="input" type="number" min="0.6" max="20" step="0.1" data-prop="lenM" value="${Core.benchLenM(it)}"></label>
      <div class="hint">Allow 0.6 m per student (0.8 m for practical work). Seats on both sides make a 1.2 m-deep island bench; one side or none makes a 0.6 m wall bench.</div>`;
    h += `<div class="hint">Seats per side</div><div class="row">${sideIn('t', 'Top')}${sideIn('b', 'Bottom')}${it.type === 'custom' ? sideIn('l', 'Left') + sideIn('r', 'Right') : ''}</div>`;
  }
  if (Core.isWall(it)) h += `<label class="field"><span>Length (m)</span><input class="input" type="number" min="0.3" max="20" step="0.1" data-prop="lenM" value="${Core.wallLenM(it)}"></label>`;
  if (g) { const m = Core.tableSizeM(it); h += `<div class="hint">${Core.isRound(it) ? `${m.w} m diameter` : `${r2(m.w)} m × ${r2(m.d)} m`}${g.seats.length ? ` · ${Core.CHAIR_M} m chair space on seated sides` : ''}</div>`; }
  if (g && g.seats.length) {
    const off = (it.off || []).length;
    h += `<div class="hint">${g.seats.length} seats${off ? `, ${off} unavailable` : ''}. Tap a seat to toggle it.</div>`;
    if (off) h += '<button class="btn sm" data-act="allon">Make all seats available</button>';
  }
  el.innerHTML = h;
}

function renderRoomSvg() {
  const room = activeRoom();
  if (!ui.view || ui.viewRoom !== room.id) fitView(room);
  const v = ui.view;
  svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  const B = room.boundary;
  const seatInfo = new Map(Core.roomSeats(room).map(s => [s.key, s]));
  let h = `<defs>
    <pattern id="g1" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#ECE9E3" stroke-width=".03"/></pattern>
    <pattern id="g2" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="url(#g1)"/><path d="M2 0H0V2" fill="none" stroke="#DEDAD2" stroke-width=".045"/></pattern></defs>
    <rect x="${Math.floor(v.x) - 4}" y="${Math.floor(v.y) - 4}" width="${v.w + 8}" height="${v.h + 8}" fill="url(#g2)"/>`;
  const path = 'M' + B.map(p => `${p.x} ${p.y}`).join('L') + 'Z';
  h += `<path d="${path}" class="b-floor" fill-opacity=".55"/>`;
  const items = room.items.slice();
  if (ui.preview) items.push(ui.preview);
  // rugs first, so furniture standing on them is drawn on top
  for (const it of items.filter(i => !Core.isWall(i)).sort((a, b) => Core.isFloor(b) - Core.isFloor(a))) h += builderItem(room, it, seatInfo);
  h += `<path d="${path}" class="b-wall"/>`;
  for (const it of items.filter(i => Core.isWall(i))) h += builderItem(room, it, seatInfo);
  // wall lengths
  if (ui.tool !== 'draw') {
    B.forEach((a, i) => {
      const b = B[(i + 1) % B.length];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L < .5) return;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let n = { x: (b.y - a.y) / L, y: -(b.x - a.x) / L };
      if (Core.pointInPoly({ x: mid.x + n.x * .1, y: mid.y + n.y * .1 }, B)) n = { x: -n.x, y: -n.y };
      const off = .8 + Math.abs(n.x) * (room.showMetres ? 2.1 : .6);
      h += `<text class="b-walllen" x="${mid.x + n.x * off}" y="${mid.y + n.y * off}">${esc(fmtLen(room, L))}</text>`;
    });
  }
  if (ui.tool === 'shape') {
    B.forEach((a, i) => { const b = B[(i + 1) % B.length]; h += `<line class="b-wallhit" data-wall="${i}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; });
    B.forEach((p, i) => { h += `<circle class="b-vertex ${ui.selVertex === i ? 'sel' : ''}" data-vertex="${i}" cx="${p.x}" cy="${p.y}" r=".45"/>`; });
  }
  if (ui.tool === 'draw' && ui.drawPts) {
    const pts = ui.drawPts.slice();
    if (ui.drawHover) pts.push(ui.drawHover);
    if (pts.length) {
      h += `<polyline class="b-draw" points="${pts.map(p => `${p.x},${p.y}`).join(' ')}"/>`;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
        if (L > .3) h += `<text class="b-walllen" style="fill:var(--accent)" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - .6}">${esc(fmtLen(room, L))}</text>`;
      }
      ui.drawPts.forEach((p, i) => { h += `<circle class="b-drawpt" cx="${p.x}" cy="${p.y}" r="${i === 0 ? .4 : .22}" ${i === 0 ? 'fill-opacity=".5"' : ''}/>`; });
    }
  }
  svg.innerHTML = h;
}

function builderItem(room, it, seatInfo) {
  const sel = it.id === ui.selItem && ui.tool === 'select';
  const preview = it === ui.preview;
  const bad = preview ? Core.itemProblem(room, it) : (Core.isWall(it) ? null : Core.itemProblem(room, it));
  const cls = `b-item ${it.hidden ? 'hidden-item' : ''}`;
  if (Core.isWall(it)) {
    if (room.boundary.length < 3) return '';
    const g = Core.wallGeom(room, it);
    const { p1, p2, mid, n } = g;
    let h = `<g class="${cls}" data-item="${it.id}">`;
    h += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="transparent" stroke-width="1.2"/>`;
    if (it.type === 'board') {
      h += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#2F3A4F" stroke-width=".5" stroke-linecap="round"/>`;
      h += `<text class="b-label" style="fill:#2F3A4F" x="${mid.x - n.x * .9}" y="${mid.y - n.y * .9}">BOARD · FRONT</text>`;
    } else if (it.type === 'door') {
      const leaf = { x: p1.x - n.x * g.len, y: p1.y - n.y * g.len };
      const a = { x: p2.x - p1.x, y: p2.y - p1.y }, b = { x: leaf.x - p1.x, y: leaf.y - p1.y };
      const sweep = a.x * b.y - a.y * b.x > 0 ? 1 : 0;
      h += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#FBFAF8" stroke-width=".4"/>`;
      h += `<path d="M${p1.x} ${p1.y}L${leaf.x} ${leaf.y}M${p2.x} ${p2.y}A${g.len} ${g.len} 0 0 ${sweep} ${leaf.x} ${leaf.y}" fill="none" stroke="#A0764F" stroke-width=".07" stroke-dasharray="${''}"/>`;
    } else {
      h += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#A9CDE8" stroke-width=".42"/>`;
      h += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#fff" stroke-width=".08"/>`;
    }
    if (it.id === ui.selItem) h += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="var(--accent)" stroke-width=".9" stroke-opacity=".25" stroke-linecap="round"/>`;
    return h + '</g>';
  }
  const g = Core.itemGeom(it, room.scale);
  const tcls = Core.isFixture(it) ? `b-fix b-fix-${it.type}` : it.type === 'teacher' ? 'b-teacher' : it.type === 'bench' ? 'b-bench' : 'b-table';
  let h = `<g class="${cls}" data-item="${it.id}" ${preview ? 'opacity=".7"' : ''}>`;
  h += `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="transparent"/>`;
  h += Core.isRound(it)
    ? `<circle class="${tcls}" cx="${g.table.x + g.table.w / 2}" cy="${g.table.y + g.table.h / 2}" r="${g.table.w / 2 + .15}"/>`
    : `<rect class="${tcls}" x="${g.table.x}" y="${g.table.y}" width="${g.table.w}" height="${g.table.h}" rx=".18"/>`;
  const cx = g.table.x + g.table.w / 2, cy = g.table.y + g.table.h / 2;
  if (it.type === 'teacher') h += `<text class="b-label" x="${cx}" y="${cy}">Teacher</text>`;
  else if (Core.isFixture(it)) {
    // label along the long side, shrunk to fit; the short name ("Files", "Laptops") if the full one won't
    const T = Core.TYPES[it.type], long = Math.max(g.table.w, g.table.h) - .3, short = Math.min(g.table.w, g.table.h);
    const fit = t => Math.min(.48, short * .55, long / (t.length * .56));
    let lbl = T.label;
    if (fit(lbl) < .3 && T.short) lbl = T.short;
    const fs = fit(lbl);
    const ly = Core.isFloor(it) ? g.table.y + fs * .9 : cy;   // a rug's label sits at its top edge, clear of furniture on it
    if (fs >= .22) h += `<text class="b-label" x="${cx}" y="${ly}" style="font-size:${r2(fs)}px" ${!Core.isFloor(it) && g.table.h > g.table.w ? `transform="rotate(-90 ${cx} ${cy})"` : ''}>${esc(lbl)}</text>`;
  }
  else if (it.type === 'bench' && !g.seats.length) h += `<text class="b-label" x="${cx}" y="${cy}">Bench</text>`;
  const sr = .21 / (room.scale || .5);
  for (const s of g.seats) {
    const info = seatInfo.get(s.key);
    h += `<circle class="b-seat ${s.unavailable ? 'off' : ''}" data-seat="${s.key}" cx="${s.x}" cy="${s.y}" r="${sr}"/>`;
    if (s.unavailable) h += `<path d="M${s.x - .18} ${s.y - .18}l.36 .36m0 -.36l-.36 .36" stroke="#9A968D" stroke-width=".07" pointer-events="none"/>`;
    else if (ui.showDist && info) {
      const d = room.showMetres ? (info.dist * (room.scale || .5)).toFixed(1) : Math.round(info.dist * 10) / 10;
      h += `<text class="b-seatnum" x="${s.x}" y="${s.y}" style="font-size:${r2(sr * .72)}px">${d}</text>`;
    }
  }
  if (bad) h += `<rect class="b-bad" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx=".2"/>`;
  else if (sel) h += `<rect class="b-sel" x="${g.x - .1}" y="${g.y - .1}" width="${g.w + .2}" height="${g.h + .2}" rx=".25"/>`;
  return h + '</g>';
}

/* ----- creating items ----- */
const fstep = room => .25 / (room.scale || .5); // furniture snaps to 0.25 m
const snapF = (room, v) => r2(Math.round(v / fstep(room)) * fstep(room));
function makeItem(type, at) {
  const room = activeRoom();
  const pre = PALETTE_PRESETS[type];
  if (pre) type = pre.type;
  const it = { id: uid(type), type, x: 0, y: 0, rot: 0 };
  if (type === 'custom') it.sides = { t: 2, b: 2, l: 1, r: 1 };
  if (type === 'bench') { it.lenM = 2.4; it.sides = { t: 3, b: 3 }; }
  if (pre) { it.lenM = pre.lenM; it.sides = { ...pre.sides }; }
  if (Core.TYPES[type].wall) { it.lenM = Core.TYPES[type].lenM; it.x = at.x; it.y = at.y; snapWallItem(room, it, at); return it; }
  const g = Core.itemGeom(it, room.scale);
  it.x = snapF(room, at.x - g.w / 2); it.y = snapF(room, at.y - g.h / 2);
  wallSnap(room, it);
  return it;
}
/* Furniture snaps to a 0.25 m grid, which can leave a table just short of a wall that isn't on that grid
   (a wall drawn with snapping off, or a table whose size isn't a multiple of 0.25 m). So when an edge
   ends up within one grid step of a straight wall it runs alongside, pull it flush against that wall. */
function wallSnap(room, it) {
  if (Core.isWall(it)) return;
  const g = Core.itemGeom(it, room.scale), tol = fstep(room) + 1e-6, B = room.boundary;
  let bx = 0, by = 0;
  const nearer = (cur, d) => (Math.abs(d) > 1e-6 && Math.abs(d) <= tol && (!cur || Math.abs(d) < Math.abs(cur)) ? d : cur);
  B.forEach((a, i) => {
    const b = B[(i + 1) % B.length];
    if (Math.abs(a.y - b.y) < 1e-6) {           // horizontal wall alongside the item
      if (g.x + g.w <= Math.min(a.x, b.x) + 1e-6 || g.x >= Math.max(a.x, b.x) - 1e-6) return;
      by = nearer(nearer(by, a.y - g.y), a.y - (g.y + g.h));
    } else if (Math.abs(a.x - b.x) < 1e-6) {    // vertical wall alongside the item
      if (g.y + g.h <= Math.min(a.y, b.y) + 1e-6 || g.y >= Math.max(a.y, b.y) - 1e-6) return;
      bx = nearer(nearer(bx, a.x - g.x), a.x - (g.x + g.w));
    }
  });
  for (const [dx, dy] of [[bx, by], [bx, 0], [0, by]]) {
    if (!dx && !dy) continue;
    const t = { ...it, x: r2(it.x + dx), y: r2(it.y + dy) };
    if (!Core.itemProblem(room, t)) { it.x = t.x; it.y = t.y; return; }
  }
}
function snapWallItem(room, it, p) {
  const B = room.boundary;
  let best = null;
  B.forEach((a, i) => { const pr = Core.projectToSeg(p, a, B[(i + 1) % B.length]); if (!best || pr.d < best.d) best = { ...pr, a, b: B[(i + 1) % B.length] }; });
  const L = Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y);
  const t = clamp(Math.round(best.t * L * 2) / 2 / (L || 1), 0, 1);
  it.x = best.a.x + (best.b.x - best.a.x) * t;
  it.y = best.a.y + (best.b.y - best.a.y) * t;
}
function findFreeSpot(room, it, near) {
  const b = roomBBox(room);
  const g = Core.itemGeom(it, room.scale);
  const c = near || { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const cands = [];
  const st = fstep(room);
  for (let x = Math.floor(b.x); x <= b.x + b.w - g.w; x += st) for (let y = Math.floor(b.y); y <= b.y + b.h - g.h; y += st) cands.push({ x, y, d: Math.hypot(x + g.w / 2 - c.x, y + g.h / 2 - c.y) });
  cands.sort((p, q) => p.d - q.d);
  for (const p of cands) {
    const t = { ...it, x: p.x, y: p.y };
    if (!Core.itemProblem(room, t)) return p;
  }
  return null;
}
function addItemAuto(type) {
  const room = activeRoom();
  const b = roomBBox(room);
  if (Core.TYPES[(PALETTE_PRESETS[type] || {}).type || type].wall) {
    const at = type === 'board' ? { x: b.x + b.w / 2, y: b.y - 5 } : type === 'door' ? { x: b.x - 5, y: b.y + b.h * .8 } : { x: b.x + b.w + 5, y: b.y + b.h / 2 };
    const it = makeItem(type, at);
    mutate(() => { room.items.push(it); ui.selItem = it.id; ui.tool = 'select'; });
    return it;
  }
  const it = makeItem(type, { x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const spot = findFreeSpot(room, it, ui.view ? { x: ui.view.x + ui.view.w / 2, y: ui.view.y + ui.view.h / 2 } : null);
  if (!spot) { toast('No free space for that. Move or remove something first.'); return null; }
  it.x = spot.x; it.y = spot.y; wallSnap(room, it);
  mutate(() => { room.items.push(it); ui.selItem = it.id; ui.tool = 'select'; });
  return it;
}
function itemAction(act) {
  const room = activeRoom();
  const it = getItem(room, ui.selItem);
  if (!it) return;
  if (act === 'del') { mutate(() => { room.items = room.items.filter(i => i !== it); ui.selItem = null; }); return; }
  if (act === 'allon') { mutate(() => { it.off = []; }); return; }
  if (act === 'rotate') {
    if (Core.isWall(it)) return;
    const g0 = Core.itemGeom(it, room.scale);
    const cx = g0.x + g0.w / 2, cy = g0.y + g0.h / 2;
    const t = { ...it, rot: ((it.rot || 0) + 1) % 4 };
    const g1 = Core.itemGeom(t, room.scale);
    t.x = snapF(room, cx - g1.w / 2); t.y = snapF(room, cy - g1.h / 2);
    wallSnap(room, t);
    let ok = !Core.itemProblem(room, t);
    if (!ok) { const s = findFreeSpot(room, t, { x: cx, y: cy }); if (s && Math.hypot(s.x - t.x, s.y - t.y) < 4) { t.x = s.x; t.y = s.y; ok = true; } }
    if (!ok) return toast("Not enough room to rotate it here. Move it first.");
    mutate(() => Object.assign(it, { rot: t.rot, x: t.x, y: t.y }));
    return;
  }
  if (act === 'dup') {
    const copy = JSON.parse(JSON.stringify(it));
    copy.id = uid(it.type);
    if (Core.isWall(it)) { copy.x += 0; mutate(() => { room.items.push(copy); ui.selItem = copy.id; }); return; }
    const spot = dupSpot(room, it, copy);
    if (!spot) return toast('No free space to duplicate into.');
    copy.x = spot.x; copy.y = spot.y;
    mutate(() => { room.items.push(copy); ui.selItem = copy.id; });
  }
}

/* Where a duplicate goes: directly alongside the original in the same orientation, continuing the row
   along the table's length (sideways for a table facing the board, up/down for a turned one). Copies made
   earlier in the same row are skipped, so pressing Duplicate again keeps extending it. If a wall or other
   furniture ends the row both ways, the copy starts a parallel row with a walking gap; failing that, it goes
   in the nearest free space. */
function dupSpot(room, it, copy) {
  const g = Core.itemGeom(it, room.scale);
  const lengthwise = (it.rot || 0) % 2 === 0;
  const at = (dx, dy) => ({ ...copy, x: r2(it.x + dx), y: r2(it.y + dy) });
  const sameRowItem = t => room.items.some(o => o.type === it.type && (o.rot || 0) === (it.rot || 0) && Math.abs(o.x - t.x) < .01 && Math.abs(o.y - t.y) < .01);
  const along = lengthwise ? [[g.w, 0], [-g.w, 0]] : [[0, g.h], [0, -g.h]];
  for (const [dx, dy] of along) {
    for (let k = 1; k <= 60; k++) {
      const t = at(dx * k, dy * k), prob = Core.itemProblem(room, t);
      if (!prob) return t;
      if (prob !== 'overlap' || !sameRowItem(t)) break;      // a wall or other furniture ends the row this way
    }
  }
  const gap = fstep(room) * 2;                              // a 0.5 m walkway between rows
  const across = lengthwise ? [[0, g.h + gap], [0, -(g.h + gap)]] : [[g.w + gap, 0], [-(g.w + gap), 0]];
  for (const [dx, dy] of across) { const t = at(dx, dy); if (!Core.itemProblem(room, t)) return t; }
  return findFreeSpot(room, copy, { x: it.x, y: it.y });
}

/* ----- drawing helpers ----- */
function snapPt(p, free) { return free ? { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 } : { x: Math.round(p.x), y: Math.round(p.y) }; }
function snapDraw(p, last, free) {
  if (free || !last) return snapPt(p, free);
  if (!ui.snapAngles) return snapPt(p, false);
  const dx = p.x - last.x, dy = p.y - last.y;
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const dist = Math.hypot(dx, dy);
  const cx = Math.cos(ang), cy = Math.sin(ang);
  if (Math.abs(cx) > .9 || Math.abs(cy) > .9) return { x: last.x + Math.round(cx * dist), y: last.y + Math.round(cy * dist) };
  const k = Math.round(dist * Math.SQRT1_2);
  return { x: last.x + Math.sign(cx) * k, y: last.y + Math.sign(cy) * k };
}
function finishPolygon() {
  const pts = ui.drawPts || [];
  const clean = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  if (clean.length > 1 && clean[0].x === clean[clean.length - 1].x && clean[0].y === clean[clean.length - 1].y) clean.pop();
  if (clean.length < 3) return toast('A room needs at least 3 corners.');
  if (Core.selfIntersects(clean)) return toast("Walls can't cross each other. Keep drawing or press Esc.");
  if (Math.abs(Core.polyArea(clean)) < 4) return toast('That room is too small.');
  const room = activeRoom();
  mutate(() => { room.boundary = clean; ui.drawPts = null; ui.drawHover = null; ui.tool = 'shape'; fitView(room); });
  saveUI();
  const bad = room.items.filter(i => Core.itemProblem(room, i)).length;
  if (bad) toast(`${bad} item${bad > 1 ? 's are' : ' is'} now outside the walls (shown in red).`);
}

/* ----- pointer handling on the room canvas ----- */
let rdrag = null;
const pointers = new Map();
let pinch = null;
svg.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  if (pointers.size === 2) {
    if (rdrag && rdrag.before && rdrag.moved) { data = JSON.parse(rdrag.before); }
    rdrag = null;
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), view: { ...ui.view } };
    return;
  }
  const room = activeRoom();
  const p = toUnits(e);
  const t = e.target;
  if (ui.tool === 'draw') {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const free = e.shiftKey || !ui.snapAngles && false;
    ui.drawPts = ui.drawPts || [];
    const last = ui.drawPts[ui.drawPts.length - 1];
    const q = snapDraw(p, last, e.shiftKey);
    if (ui.drawPts.length >= 3 && Math.hypot(q.x - ui.drawPts[0].x, q.y - ui.drawPts[0].y) < .7) return finishPolygon();
    if (last && last.x === q.x && last.y === q.y) { if (ui.drawPts.length >= 3) finishPolygon(); return; }
    ui.drawPts.push(q);
    renderRoomSvg();
    void free;
    return;
  }
  if (ui.tool === 'shape') {
    const vEl = t.closest('[data-vertex]');
    const wEl = t.closest('[data-wall]');
    if (vEl || wEl) {
      const before = snap();
      let i;
      if (vEl) i = +vEl.dataset.vertex;
      else {
        const wi = +wEl.dataset.wall;
        const a = room.boundary[wi], b = room.boundary[(wi + 1) % room.boundary.length];
        const pr = Core.projectToSeg(p, a, b);
        let q = pr.q;
        if (Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9) q = snapPt(q, e.shiftKey);
        else q = { x: r2(q.x), y: r2(q.y) };
        room.boundary.splice(wi + 1, 0, q);
        i = wi + 1;
      }
      ui.selVertex = i;
      rdrag = { kind: 'vertex', i, before, moved: !vEl, orig: room.boundary.map(q => ({ ...q })), pins: pinWallItems(room) };
      renderRoomTab();
      return;
    }
    ui.selVertex = null;
    rdrag = { kind: 'pan', sx: e.clientX, sy: e.clientY, view: { ...ui.view } };
    renderRoomTab();
    return;
  }
  const iEl = t.closest('[data-item]');
  if (iEl && !iEl.closest('[opacity]')) {
    const it = getItem(room, iEl.dataset.item);
    if (!it) return;
    ui.selItem = it.id;
    rdrag = { kind: 'item', id: it.id, before: snap(), start: p, ox: it.x, oy: it.y, moved: false, seat: t.closest('[data-seat]')?.dataset.seat };
    renderRoomTab();
    return;
  }
  ui.selItem = null;
  rdrag = { kind: 'pan', sx: e.clientX, sy: e.clientY, view: { ...ui.view } };
  renderRoomTab();
});
svg.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const f = pinch.d / (d || 1);
    const v = pinch.view;
    const nw = clamp(v.w * f, 6, 300), k = nw / v.w;
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    ui.view = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: nw, h: v.h * k };
    renderRoomSvg();
    return;
  }
  const room = activeRoom();
  const p = toUnits(e);
  if (ui.tool === 'draw') {
    const last = ui.drawPts && ui.drawPts[ui.drawPts.length - 1];
    ui.drawHover = snapDraw(p, last, e.shiftKey);
    renderRoomSvg();
    return;
  }
  if (!rdrag) return;
  if (rdrag.kind === 'pan') {
    const m = svg.getScreenCTM();
    if (!m) return;
    ui.view = { ...rdrag.view, x: rdrag.view.x - (e.clientX - rdrag.sx) / m.a, y: rdrag.view.y - (e.clientY - rdrag.sy) / m.d };
    renderRoomSvg();
  } else if (rdrag.kind === 'item') {
    const it = getItem(room, rdrag.id);
    const dx = p.x - rdrag.start.x, dy = p.y - rdrag.start.y;
    if (!rdrag.moved && Math.hypot(dx, dy) < .35) return;
    rdrag.moved = true;
    if (Core.isWall(it)) snapWallItem(room, it, p);
    else { it.x = snapF(room, rdrag.ox + dx); it.y = snapF(room, rdrag.oy + dy); wallSnap(room, it); }
    renderRoomSvg();
  } else if (rdrag.kind === 'vertex') {
    const q = snapPt(p, e.shiftKey);
    const B = room.boundary, i = rdrag.i, o = rdrag.orig;
    if (isAxisRect(o) && o.length === B.length) {
      const old = o[i];
      for (const j of [(i + 3) % 4, (i + 1) % 4]) {
        B[j] = { ...o[j] };
        if (Math.abs(o[j].x - old.x) < 1e-9) B[j].x = q.x;
        if (Math.abs(o[j].y - old.y) < 1e-9) B[j].y = q.y;
      }
    }
    B[i] = q;
    rdrag.moved = true;
    applyPins(room, rdrag.pins);
    renderRoomSvg();
  }
});
function endRoomPointer(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (!rdrag) return;
  const room = activeRoom();
  const d = rdrag; rdrag = null;
  if (d.kind === 'item') {
    const it = getItem(room, d.id);
    if (!d.moved) {
      if (d.seat) {
        const idx = +d.seat.split(':').pop();
        mutate(() => { const off = new Set(it.off || []); off.has(idx) ? off.delete(idx) : off.add(idx); it.off = [...off]; });
      }
      return;
    }
    const prob = Core.itemProblem(room, it);
    if (prob) {
      it.x = d.ox; it.y = d.oy;
      toast(prob === 'outside' ? "Furniture can't go outside the walls." : 'That spot overlaps other furniture.');
      renderRoomTab();
      return;
    }
    pushUndo(d.before); save(); renderRoomTab();
  } else if (d.kind === 'vertex') {
    const B = room.boundary;
    // drop duplicate neighbouring points
    const clean = B.filter((p, i) => { const q = B[(i + 1) % B.length]; return !(Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9); });
    if (clean.length < 3 || Core.selfIntersects(clean) || Math.abs(Core.polyArea(clean)) < 4) {
      data = JSON.parse(d.before);
      toast("Walls can't cross each other.");
    } else {
      room.boundary = clean;
      if (ui.selVertex >= clean.length) ui.selVertex = null;
      pushUndo(d.before); save();
    }
    render();
  }
}
svg.addEventListener('pointerup', endRoomPointer);
svg.addEventListener('pointercancel', endRoomPointer);
svg.addEventListener('dblclick', () => { if (ui.tool === 'draw' && ui.drawPts && ui.drawPts.length >= 3) finishPolygon(); });
svg.addEventListener('wheel', e => { e.preventDefault(); const p = toUnits(e); zoomAt(e.deltaY > 0 ? 1.1 : 1 / 1.1, p.x, p.y); }, { passive: false });
svg.addEventListener('pointerleave', () => { if (ui.tool === 'draw') { ui.drawHover = null; renderRoomSvg(); } });

function pinWallItems(room) {
  return room.items.filter(Core.isWall).map(it => {
    const g = Core.wallGeom(room, it);
    const a = room.boundary[g.seg], b = room.boundary[(g.seg + 1) % room.boundary.length];
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { it, seg: g.seg, f: Math.hypot(g.mid.x - a.x, g.mid.y - a.y) / L };
  });
}
function applyPins(room, pins) {
  const B = room.boundary;
  for (const p of pins || []) {
    const a = B[p.seg], b = B[(p.seg + 1) % B.length];
    if (!a || !b) continue;
    p.it.x = a.x + (b.x - a.x) * p.f; p.it.y = a.y + (b.y - a.y) * p.f;
  }
}

/* ----- palette drag (pointer events so it works on iPad) ----- */
let palDrag = null;
function overSvg(e) { const el = document.elementFromPoint(e.clientX, e.clientY); return el && (el === svg || svg.contains(el)); }
$('#paletteGrid').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-type]');
  if (!b) return;
  e.preventDefault();
  palDrag = { type: b.dataset.type, sx: e.clientX, sy: e.clientY, moved: false, ghost: null };
});
document.addEventListener('pointermove', e => {
  if (!palDrag) return;
  if (!palDrag.moved && Math.hypot(e.clientX - palDrag.sx, e.clientY - palDrag.sy) < 6) return;
  palDrag.moved = true;
  if (!palDrag.ghost) { palDrag.ghost = document.createElement('div'); palDrag.ghost.className = 'drag-ghost'; palDrag.ghost.textContent = palLabel(palDrag.type); document.body.appendChild(palDrag.ghost); }
  palDrag.ghost.style.left = e.clientX + 'px'; palDrag.ghost.style.top = e.clientY - 28 + 'px';
  if (ui.tool !== 'select') { ui.tool = 'select'; ui.drawPts = null; renderRoomTab(); }
  if (overSvg(e)) { ui.preview = makeItem(palDrag.type, toUnits(e)); ui.preview.id = '__preview'; }
  else ui.preview = null;
  renderRoomSvg();
});
document.addEventListener('pointerup', e => {
  if (!palDrag) return;
  const d = palDrag; palDrag = null;
  if (d.ghost) d.ghost.remove();
  const pv = ui.preview; ui.preview = null;
  if (!d.moved) { addItemAuto(d.type); return; }
  if (!overSvg(e) || !pv) { renderRoomSvg(); return; }
  const room = activeRoom();
  pv.id = uid(pv.type);
  const prob = Core.itemProblem(room, pv);
  if (prob) { renderRoomSvg(); return toast(prob === 'outside' ? "Furniture can't go outside the walls." : 'That spot overlaps other furniture.'); }
  mutate(() => { room.items.push(pv); ui.selItem = pv.id; });
});

/* ----- room sidebar events ----- */
function bindRoom() {
  buildPalette();
  $('#roomSelect').addEventListener('change', e => { data.activeRoomId = e.target.value; ui.selItem = null; ui.selVertex = null; ui.drawPts = null; save(); render(); });
  $('#roomName').addEventListener('change', e => { const v = e.target.value.trim(); if (v) mutate(() => { activeRoom().name = v; }); });
  $('#roomNew').addEventListener('click', async () => {
    const name = await askText('New room layout', '', 'e.g. Lab 3');
    if (!name) return;
    mutate(() => { const r = blankRoom(name); data.rooms.push(r); data.activeRoomId = r.id; ui.tool = 'shape'; });
  });
  $('#roomDup').addEventListener('click', () => {
    const src = activeRoom();
    mutate(() => { const r = JSON.parse(JSON.stringify(src)); r.id = uid('room'); r.name = src.name + ' (copy)'; delete r.sample; data.rooms.push(r); data.activeRoomId = r.id; });
  });
  $('#roomDel').addEventListener('click', async () => {
    const r = activeRoom();
    const users = data.classes.filter(c => c.roomId === r.id);
    if (!(await confirmBox(`Delete “${r.name}”?`, users.length ? `${users.map(c => esc(c.name)).join(', ')} will be moved to another layout. You can undo this.` : 'You can undo this.'))) return;
    mutate(() => { data.rooms = data.rooms.filter(x => x !== r); fixRefs(); data.activeRoomId = data.rooms[0].id; });
  });
  $('#toolSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    ui.tool = b.dataset.tool; ui.selVertex = null; ui.drawPts = ui.tool === 'draw' ? [] : null; ui.drawHover = null;
    saveUI(); renderRoomTab();
  });
  $('#presetRow').addEventListener('click', async e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const room = activeRoom();
    if (!(await confirmBox(`Replace the walls with the ${Sample.PRESETS[b.dataset.preset].label} preset?`, 'Furniture stays where it is; anything left outside the new walls is shown in red. You can undo this.', 'Replace walls', ''))) return;
    mutate(() => { room.boundary = Sample.PRESETS[b.dataset.preset].boundary.map(p => ({ ...p })); ui.tool = 'shape'; fitView(room); });
  });
  $('#showMetres').addEventListener('change', e => mutate(() => { activeRoom().showMetres = e.target.checked; }));
  $('#scaleInput').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) mutate(() => { activeRoom().scale = v; }); });
  $('#snapAngles').addEventListener('change', e => { ui.snapAngles = e.target.checked; saveUI(); });
  $('#showDist').addEventListener('change', e => { ui.showDist = e.target.checked; saveUI(); renderRoomSvg(); });
  const toggle = (type, on) => {
    const room = activeRoom();
    const it = room.items.find(i => i.type === type);
    if (!it) { if (on) addItemAuto(type); return; }
    mutate(() => { it.hidden = !on; });
  };
  $('#toggleTeacher').addEventListener('change', e => toggle('teacher', e.target.checked));
  $('#toggleBoard').addEventListener('change', e => toggle('board', e.target.checked));
  $('#selSection').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) itemAction(b.dataset.act);
    if (e.target.id === 'delVertex') deleteVertex();
  });
  $('#selSection').addEventListener('change', e => {
    const room = activeRoom();
    const it = getItem(room, ui.selItem);
    if (!it) return;
    const before = snap();
    if (e.target.dataset.side) { it.sides = { ...(it.sides || {}) }; it.sides[e.target.dataset.side] = clamp(parseInt(e.target.value, 10) || 0, 0, 12); }
    if (e.target.dataset.prop === 'lenM') it.lenM = clamp(r2(parseFloat(e.target.value) || 1), Core.isWall(it) ? .3 : .6, 20);
    if (!Core.isWall(it) && Core.itemProblem(room, it)) {
      const s = findFreeSpot(room, it, { x: it.x, y: it.y });
      if (s) { it.x = s.x; it.y = s.y; } else { data = JSON.parse(before); toast('No room for a table that size.'); render(); return; }
    }
    pushUndo(before); save(); render();
  });
  $('#zoomIn').addEventListener('click', () => zoomAt(1 / 1.25));
  $('#zoomOut').addEventListener('click', () => zoomAt(1.25));
  $('#zoomFit').addEventListener('click', () => { fitView(activeRoom()); renderRoomSvg(); });
}
function deleteVertex() {
  const room = activeRoom();
  if (ui.selVertex === null || room.boundary.length <= 3) return;
  const nb = room.boundary.filter((_, i) => i !== ui.selVertex);
  if (Core.selfIntersects(nb)) return toast("Removing that corner would make walls cross.");
  mutate(() => { room.boundary = nb; ui.selVertex = null; });
}
