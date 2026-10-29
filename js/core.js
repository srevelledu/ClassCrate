/* ------------------------------------------------------------------
   Core: pure geometry + solver. No DOM access, so it can be unit
   tested in Node (see tests/solver.test.mjs).
   Units: 1 grid square ("unit"). Furniture is sized for ~0.5 m squares.
------------------------------------------------------------------- */
const Core = (() => {
  const ADJ_M = 1.5;      // seats on different tables within this many metres are "adjacent"
  const CHAIR_M = 0.5;    // depth of the chair/stool zone beside a seated edge
  const SEAT_M = 0.6;     // table edge allowed per student
  const EPS = 1e-6;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* Real-world sizes in metres (typical Australian secondary school furniture). */
  const TYPES = {
    single:  { label: 'Single desk',     w: 0.7, d: 0.5,  sides: { t: 0, b: 1, l: 0, r: 0 }, seated: true },
    pair:    { label: 'Pair desk',       w: 1.2, d: 0.6,  sides: { t: 0, b: 2, l: 0, r: 0 }, seated: true },
    group4:  { label: 'Table of 4',      w: 1.2, d: 1.2,  sides: { t: 2, b: 2, l: 0, r: 0 }, seated: true },
    group6:  { label: 'Table of 6',      w: 1.8, d: 1.2,  sides: { t: 3, b: 3, l: 0, r: 0 }, seated: true },
    round4:  { label: 'Round table (4)', w: 1.2, d: 1.2,  sides: { t: 1, b: 1, l: 1, r: 1 }, seated: true, round: true },
    custom:  { label: 'Custom table',    seated: true },
    bench:   { label: 'Lab bench',       seated: true },
    teacher: { label: "Teacher's desk",  w: 1.5, d: 0.75, sides: { t: 0, b: 0, l: 0, r: 0 } },
    // storage and fittings: no seats, just so the plan matches the real room (typical sizes)
    bookcase: { label: 'Bookcase',       w: 0.9, d: 0.35, sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true },
    cupboard: { label: 'Cupboard',       w: 1.0, d: 0.5,  sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true },
    filing:   { label: 'Filing cabinet', w: 0.5, d: 0.6,  sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true, short: 'Files' },
    lockers:  { label: 'Lockers',        w: 1.2, d: 0.45, sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true },
    trolley:  { label: 'Laptop trolley', w: 0.9, d: 0.6,  sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true, short: 'Laptops' },
    sink:     { label: 'Sink',           w: 0.9, d: 0.6,  sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true },
    fume:     { label: 'Fume cupboard',  w: 1.2, d: 0.8,  sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true, short: 'Fume' },
    rug:      { label: 'Reading rug',    w: 2.0, d: 1.5,  sides: { t: 0, b: 0, l: 0, r: 0 }, fixture: true, floor: true, short: 'Rug' },
    board:   { label: 'Board',  wall: true, lenM: 3.6 },
    door:    { label: 'Door',   wall: true, lenM: 0.9 },
    window:  { label: 'Window', wall: true, lenM: 2.0 },
  };
  const isWall = it => !!(TYPES[it.type] && TYPES[it.type].wall);
  const isSeated = it => !!(TYPES[it.type] && TYPES[it.type].seated);
  const isRound = it => !!(TYPES[it.type] && TYPES[it.type].round);
  const isFixture = it => !!(TYPES[it.type] && TYPES[it.type].fixture);
  const isFloor = it => !!(TYPES[it.type] && TYPES[it.type].floor);   // lies on the floor: furniture can stand on it
  const wallLenM = it => it.lenM || TYPES[it.type].lenM;
  const benchLenM = it => clamp(+it.lenM || 2.4, 0.6, 20);

  function normSides(s) {
    s = s || {};
    const f = v => clamp(Math.round(+v || 0), 0, 12);
    return { t: f(s.t), b: f(s.b), l: f(s.l), r: f(s.r) };
  }

  /* Table-top size in metres and seats per side. */
  function tableSizeM(item) {
    if (item.type === 'custom') {
      const s = normSides(item.sides);
      return { w: Math.max(1.2, SEAT_M * Math.max(s.t, s.b)), d: Math.max(s.t && s.b ? 1.2 : 0.6, SEAT_M * Math.max(s.l, s.r)), sides: s };
    }
    if (item.type === 'bench') {
      // single-sided (wall) benches are 0.6 m deep, double-sided island benches 1.2 m
      const s = normSides(item.sides), len = benchLenM(item), max = Math.floor(len / 0.45);
      const sides = { t: Math.min(s.t, max), b: Math.min(s.b, max), l: 0, r: 0 };
      return { w: len, d: sides.t && sides.b ? 1.2 : 0.6, sides };
    }
    const T = TYPES[item.type];
    return { w: T.w, d: T.d, sides: { ...T.sides } };
  }
  function tableDims(item, scale = 0.5) {
    const m = tableSizeM(item);
    return { tw: m.w / scale, th: m.d / scale, sides: m.sides };
  }

  /* Footprint (table + seat zone), table rect and seat centres in room coords. */
  function itemGeom(item, scale = 0.5) {
    const { tw, th, sides } = tableDims(item, scale);
    const cz = CHAIR_M / scale, c2 = cz / 2;
    const ox = sides.l ? cz : 0, oy = sides.t ? cz : 0;
    const fw = tw + ox + (sides.r ? cz : 0), fh = th + oy + (sides.b ? cz : 0);
    const local = [];
    for (let i = 0; i < sides.t; i++) local.push({ x: ox + tw * (i + .5) / sides.t, y: oy - c2, side: 't', spacing: tw / sides.t });
    for (let i = 0; i < sides.r; i++) local.push({ x: ox + tw + c2, y: oy + th * (i + .5) / sides.r, side: 'r', spacing: th / sides.r });
    for (let i = 0; i < sides.b; i++) local.push({ x: ox + tw * (i + .5) / sides.b, y: oy + th + c2, side: 'b', spacing: tw / sides.b });
    for (let i = 0; i < sides.l; i++) local.push({ x: ox - c2, y: oy + th * (i + .5) / sides.l, side: 'l', spacing: th / sides.l });
    const rot = (((item.rot || 0) % 4) + 4) % 4;
    const W = rot % 2 ? fh : fw, H = rot % 2 ? fw : fh;
    const tf = (px, py) => {
      let p;
      switch (rot) {
        case 0: p = [px, py]; break;
        case 1: p = [fh - py, px]; break;
        case 2: p = [fw - px, fh - py]; break;
        default: p = [py, fw - px];
      }
      return { x: item.x + p[0], y: item.y + p[1] };
    };
    const a = tf(ox, oy), b = tf(ox + tw, oy + th);
    const table = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
    const off = new Set(item.off || []);
    const seats = local.map((s, i) => ({ ...tf(s.x, s.y), idx: i, key: item.id + ':' + i, side: s.side, spacing: s.spacing, unavailable: off.has(i) }));
    return { x: item.x, y: item.y, w: W, h: H, table, seats, rot };
  }

  /* ---------- polygon helpers ---------- */
  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function projectToSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy || 1;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L2, 0, 1);
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    return { t, q, d: Math.hypot(p.x - q.x, p.y - q.y) };
  }
  function distToPolyEdge(p, poly) {
    let d = Infinity;
    for (let i = 0; i < poly.length; i++) d = Math.min(d, projectToSeg(p, poly[i], poly[(i + 1) % poly.length]).d);
    return d;
  }
  /* inside or on the edge */
  function insideOrOn(p, poly) { return pointInPoly(p, poly) || distToPolyEdge(p, poly) < 0.02; }
  function polyArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; }
    return a / 2;
  }
  function segIntersect(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < EPS) return false;
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS;
  }
  function selfIntersects(poly) {
    const n = poly.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
    }
    return false;
  }

  /* A footprint rect is inside the room if sample points are inside and no wall crosses it. */
  function rectInside(r, poly) {
    const pts = [];
    const nx = Math.max(1, Math.ceil(r.w / .5)), ny = Math.max(1, Math.ceil(r.h / .5));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      pts.push({ x: r.x + r.w * i / nx, y: r.y + r.h * j / ny });
    }
    if (!pts.every(p => insideOrOn(p, poly))) return false;
    // reject walls passing through the interior (e.g. a thin notch)
    const inner = { x: r.x + .05, y: r.y + .05, w: r.w - .1, h: r.h - .1 };
    const c = [{ x: inner.x, y: inner.y }, { x: inner.x + inner.w, y: inner.y }, { x: inner.x + inner.w, y: inner.y + inner.h }, { x: inner.x, y: inner.y + inner.h }];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      for (let k = 0; k < 4; k++) if (segIntersect(a, b, c[k], c[(k + 1) % 4])) return false;
    }
    return true;
  }
  const rectsOverlap = (a, b) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;

  function itemProblem(room, item) {
    if (isWall(item)) return null;
    const g = itemGeom(item, room.scale);
    const r = { x: g.x, y: g.y, w: g.w, h: g.h };
    if (!rectInside(r, room.boundary)) return 'outside';
    for (const o of room.items) {
      if (o.id === item.id || isWall(o) || isFloor(o) || isFloor(item)) continue;
      const og = itemGeom(o, room.scale);
      if (rectsOverlap(r, { x: og.x, y: og.y, w: og.w, h: og.h })) return 'overlap';
    }
    return null;
  }

  /* Wall-mounted items store a point; they snap to the nearest wall each time. */
  function wallGeom(room, item) {
    const poly = room.boundary;
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const pr = projectToSeg(item, a, b);
      if (!best || pr.d < best.d - 1e-9) best = { ...pr, i, a, b };
    }
    const { a, b } = best;
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const len = Math.min(wallLenM(item) / (room.scale || 0.5), L);
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const c = clamp(best.t * L, len / 2, L - len / 2);
    const p1 = { x: a.x + ux * (c - len / 2), y: a.y + uy * (c - len / 2) };
    const p2 = { x: a.x + ux * (c + len / 2), y: a.y + uy * (c + len / 2) };
    const mid = { x: a.x + ux * c, y: a.y + uy * c };
    let n = { x: uy, y: -ux };
    if (pointInPoly({ x: mid.x + n.x * .05, y: mid.y + n.y * .05 }, poly)) n = { x: -n.x, y: -n.y };
    return { p1, p2, mid, n, seg: best.i, len, angle: Math.atan2(uy, ux) };
  }

  function boardOf(room) { return room.items.find(i => i.type === 'board') || null; }

  /* All seats in the room with distance from the front (board). */
  function roomSeats(room) {
    const board = boardOf(room);
    const bg = board && room.boundary.length >= 3 ? wallGeom(room, board) : null;
    const minY = Math.min(...room.boundary.map(p => p.y));
    const seats = [];
    let tableNo = 0;
    const tables = room.items.filter(isSeated);
    for (const it of tables) {
      const g = itemGeom(it, room.scale);
      for (const s of g.seats) {
        // rows run parallel to the board: measure straight back from the board's wall line
        const dist = bg ? Math.max(0, (bg.mid.x - s.x) * bg.n.x + (bg.mid.y - s.y) * bg.n.y) : s.y - minY;
        seats.push({ key: s.key, itemId: it.id, x: s.x, y: s.y, dist, unavailable: s.unavailable, spacing: s.spacing, side: s.side, scale: room.scale || 0.5 });
      }
    }
    const avail = seats.filter(s => !s.unavailable).sort((a, b) => a.dist - b.dist);
    let rank = 0, prev = -1;
    avail.forEach((s, i) => { if (Math.abs(s.dist - prev) > .05) { rank = i + 1; prev = s.dist; } s.rank = rank; });
    return seats;
  }

  function seatsConflict(a, b, mode) {
    if (a.itemId === b.itemId) return true;
    return mode === 'adjacent' && Math.hypot(a.x - b.x, a.y - b.y) * (a.scale || 0.5) <= ADJ_M + EPS;
  }

  /* ------------------------------------------------------------------
     Solver
     opts: { seats, students:[{id,name,front,lock}], rules:[{id,type:'apart'|'together',members:[id]}],
             mode:'table'|'adjacent', fill:'front'|'random', seed, label(rule)->string }
  ------------------------------------------------------------------- */
  function solve(opts) {
    const t0 = Date.now();
    const rng = mulberry32((opts.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0);
    const mode = opts.mode || 'adjacent';
    const fill = opts.fill || 'front';
    const label = opts.label || (r => r.members.join(r.type === 'apart' ? ' ✕ ' : ' + '));
    const students = opts.students.slice();
    const byId = new Map(students.map(s => [s.id, s]));
    const nameOf = id => (byId.get(id) || { name: '?' }).name;
    const seats = opts.seats.filter(s => !s.unavailable);
    const S = seats.length;
    const seatIdx = new Map(seats.map((s, i) => [s.key, i]));
    const warnings = [], problems = [];

    const rules = (opts.rules || [])
      .map(r => ({ ...r, members: [...new Set(r.members)].filter(id => byId.has(id)) }))
      .filter(r => r.members.length >= 2);

    // conflict matrix
    const conf = Array.from({ length: S }, () => new Uint8Array(S));
    for (let i = 0; i < S; i++) for (let j = i + 1; j < S; j++) {
      if (seatsConflict(seats[i], seats[j], mode)) conf[i][j] = conf[j][i] = 1;
    }

    // locks
    const locked = new Map(), lockTaken = new Map();
    for (const st of students) {
      if (!st.lock) continue;
      const i = seatIdx.get(st.lock);
      if (i === undefined) { warnings.push(`${st.name}'s locked seat no longer exists or is unavailable, so the lock was ignored.`); continue; }
      if (lockTaken.has(i)) { warnings.push(`${st.name} and ${nameOf(lockTaken.get(i))} are locked to the same seat; ${st.name}'s lock was ignored.`); continue; }
      locked.set(st.id, i); lockTaken.set(i, st.id);
    }

    // capacity
    let toSeat = students;
    let unseated = [];
    if (students.length > S) {
      const inRule = new Set(rules.flatMap(r => r.members));
      const prio = s => locked.has(s.id) ? 0 : s.front ? 1 : inRule.has(s.id) ? 2 : 3;
      const order = shuffle(students.slice(), rng).sort((a, b) => prio(a) - prio(b));
      toSeat = order.slice(0, S);
      unseated = order.slice(S).map(s => s.id);
      warnings.push(`There are ${students.length} students but only ${S} available seats. ${unseated.length} student${unseated.length > 1 ? 's were' : ' was'} left unseated: ${unseated.map(nameOf).join(', ')}. Add seats in the Room tab.`);
    }
    const seatedSet = new Set(toSeat.map(s => s.id));
    const activeRules = rules.map(r => ({ ...r, members: r.members.filter(id => seatedSet.has(id)) })).filter(r => r.members.length >= 2);

    // ---- pre-checks that explain impossibility clearly ----
    const tablesWithSeats = new Set(seats.map(s => s.itemId));
    const seatsPerTable = {};
    seats.forEach(s => { seatsPerTable[s.itemId] = (seatsPerTable[s.itemId] || 0) + 1; });
    const maxTable = Math.max(0, ...Object.values(seatsPerTable));
    const preBad = new Set();
    for (const r of activeRules) {
      const L = label(r);
      if (r.type === 'apart') {
        const lk = r.members.filter(id => locked.has(id));
        for (let i = 0; i < lk.length; i++) for (let j = i + 1; j < lk.length; j++) {
          if (conf[locked.get(lk[i])][locked.get(lk[j])]) {
            problems.push(`${nameOf(lk[i])} and ${nameOf(lk[j])} are both locked to seats that are ${seats[locked.get(lk[i])].itemId === seats[locked.get(lk[j])].itemId ? 'at the same table' : 'next to each other'}, but the rule “${L}” says keep them apart. Unlock one of them or move a lock.`);
            preBad.add(r.id);
          }
        }
        if (r.members.length > tablesWithSeats.size) {
          problems.push(`“${L}” needs ${r.members.length} different tables, but the room only has ${tablesWithSeats.size}.`);
          preBad.add(r.id);
        }
      } else {
        if (r.members.length > maxTable) {
          problems.push(`“${L}” needs ${r.members.length} seats at one table, but the largest table has ${maxTable} available seats.`);
          preBad.add(r.id);
        }
        const tbl = new Set(r.members.filter(id => locked.has(id)).map(id => seats[locked.get(id)].itemId));
        if (tbl.size > 1) { problems.push(`Members of “${L}” are locked to different tables.`); preBad.add(r.id); }
      }
    }
    for (const a of activeRules.filter(r => r.type === 'apart')) for (const t of activeRules.filter(r => r.type === 'together')) {
      const both = a.members.filter(id => t.members.includes(id));
      if (both.length >= 2) {
        problems.push(`${both.map(nameOf).join(' and ')} are in both a keep-apart rule (“${label(a)}”) and a keep-together rule (“${label(t)}”).`);
        preBad.add(a.id); preBad.add(t.id);
      }
    }

    // ---- search ----
    // seat order for "fill from front": by distance, random among ties
    const jitter = seats.map(() => rng());
    const seatOrder = seats.map((_, i) => i).sort((a, b) => (Math.round(seats[a].dist * 4) - Math.round(seats[b].dist * 4)) || (jitter[a] - jitter[b]));
    const orderPos = new Int32Array(S); seatOrder.forEach((s, p) => { orderPos[s] = p; });
    const free = toSeat.filter(s => !locked.has(s.id));
    const nFree = free.length;
    let totalNodes = 0;

    function attempt(ruleSet, poolSize, budget) {
      const fIdx = new Map(free.map((s, i) => [s.id, i]));
      const apartP = free.map(() => []), togetherP = free.map(() => []);
      const lockedApart = free.map(() => []), lockedTogether = free.map(() => []);
      for (const r of ruleSet) {
        for (const a of r.members) for (const b of r.members) {
          if (a === b || !fIdx.has(a)) continue;
          const ia = fIdx.get(a);
          if (fIdx.has(b)) (r.type === 'apart' ? apartP : togetherP)[ia].push(fIdx.get(b));
          else if (locked.has(b)) (r.type === 'apart' ? lockedApart : lockedTogether)[ia].push(locked.get(b));
        }
      }
      const inPool = new Uint8Array(S);
      seatOrder.slice(0, poolSize).forEach(i => { inPool[i] = 1; });
      // domains
      const dom = free.map(() => new Uint8Array(S));
      const size = new Int32Array(nFree);
      for (let v = 0; v < nFree; v++) {
        for (let s = 0; s < S; s++) {
          if (!inPool[s] || lockTaken.has(s)) continue;
          if (lockedApart[v].some(ls => conf[s][ls])) continue;
          if (lockedTogether[v].some(ls => seats[ls].itemId !== seats[s].itemId)) continue;
          dom[v][s] = 1; size[v]++;
        }
        if (size[v] === 0) return null;
      }
      const assign = new Int32Array(nFree).fill(-1);
      const tie = free.map(() => rng());
      let nodes = 0;
      const ABORT = {};
      function pick() {
        let best = -1;
        for (let v = 0; v < nFree; v++) {
          if (assign[v] !== -1) continue;
          if (best === -1) { best = v; continue; }
          const fv = free[v].front ? 0 : 1, fb = free[best].front ? 0 : 1;
          if (fv !== fb) { if (fv < fb) best = v; continue; }
          if (size[v] !== size[best] ? size[v] < size[best] : tie[v] < tie[best]) best = v;
        }
        return best;
      }
      function dfs(depth) {
        if (depth === nFree) return true;
        if (++nodes > budget) throw ABORT;
        const v = pick();
        let vals = [];
        for (let s = 0; s < S; s++) if (dom[v][s]) vals.push(s);
        if (free[v].front) {
          const j = vals.map(() => rng());
          const idx = vals.map((_, k) => k).sort((a, b) => (Math.round(seats[vals[a]].dist * 4) - Math.round(seats[vals[b]].dist * 4)) || (j[a] - j[b]));
          vals = idx.map(k => vals[k]);
        } else shuffle(vals, rng);
        for (const s of vals) {
          assign[v] = s;
          const removed = [];
          let ok = true;
          for (let u = 0; u < nFree && ok; u++) {
            if (assign[u] !== -1) continue;
            const rm = x => { if (dom[u][x]) { dom[u][x] = 0; size[u]--; removed.push(u, x); } };
            rm(s);
            if (apartP[v].includes(u)) for (let x = 0; x < S; x++) if (dom[u][x] && conf[s][x]) rm(x);
            if (togetherP[v].includes(u)) for (let x = 0; x < S; x++) if (dom[u][x] && seats[x].itemId !== seats[s].itemId) rm(x);
            if (size[u] === 0) ok = false;
          }
          if (ok && dfs(depth + 1)) return true;
          for (let k = removed.length - 2; k >= 0; k -= 2) { dom[removed[k]][removed[k + 1]] = 1; size[removed[k]]++; }
          assign[v] = -1;
        }
        return false;
      }
      try {
        const ok = dfs(0);
        totalNodes += nodes;
        if (!ok) return false; // proven impossible for this pool
        const out = {};
        for (const [id, s] of locked) if (seatedSet.has(id)) out[seats[s].key] = id;
        free.forEach((st, v) => { out[seats[assign[v]].key] = st.id; });
        return out;
      } catch (e) {
        totalNodes += nodes;
        if (e === ABORT) return undefined; // gave up (budget)
        throw e;
      }
    }

    function poolSizes() {
      const need = Math.min(S, toSeat.length);
      if (fill !== 'front') return [S];
      const sizes = [];
      for (let p = need; p < S; p += Math.max(2, Math.ceil((S - need) / 4))) sizes.push(p);
      sizes.push(S);
      return [...new Set(sizes)];
    }

    function trySolve(ruleSet, effort) {
      if (lockTaken.size + nFree > S) return null;
      for (const p of poolSizes()) {
        if (p - [...lockTaken.keys()].filter(s => orderPos[s] < p).length < nFree) continue;
        for (let r = 0; r < effort.restarts; r++) {
          const res = attempt(ruleSet, p, effort.budget);
          if (res) return res;
          if (res === false || res === null) break; // exhaustive fail at this pool size
        }
      }
      return null;
    }

    const FULL = { restarts: 25, budget: 4000 };
    const QUICK = { restarts: 6, budget: 2500 };
    const ruleOk = activeRules.filter(r => !preBad.has(r.id));
    let assignment = preBad.size ? null : trySolve(activeRules, FULL);
    let conflictRules = [], brokenRules = [];
    let finalRules = activeRules;

    if (!assignment) {
      // find a minimal set of rules that can't be satisfied together (deletion filter)
      if (!preBad.size) {
        let core = activeRules.slice();
        if (!trySolve([], QUICK)) {
          problems.push('Even with no rules, the locked seats leave no valid arrangement. Check the locked students.');
          core = [];
        } else {
          for (const r of activeRules.slice()) {
            const without = core.filter(x => x !== r);
            if (!trySolve(without, QUICK)) core = without;
          }
          conflictRules = core;
          if (core.length === 1) problems.push(`The rule “${label(core[0])}” can't be satisfied in this room${mode === 'adjacent' ? ' when students on neighbouring tables also count as “together”' : ''}. There aren't enough well-separated seats for everyone in it.`);
          else if (core.length > 1) problems.push(`These rules can't all be satisfied at the same time: ${core.map(r => '“' + label(r) + '”').join(', ')}.${mode === 'adjacent' ? ' Try switching keep-apart strictness to “Different tables”,' : ' Try'} removing one of them, or adding seats/tables.`);
        }
      } else conflictRules = activeRules.filter(r => preBad.has(r.id));
      // best-effort plan: greedily keep as many rules as possible
      const kept = [];
      const order = [...ruleOk.filter(r => r.type === 'apart'), ...ruleOk.filter(r => r.type === 'together')];
      for (const r of order) {
        if (trySolve([...kept, r], QUICK)) kept.push(r); else brokenRules.push(r);
      }
      brokenRules.push(...activeRules.filter(r => preBad.has(r.id)));
      assignment = trySolve(kept, FULL);
      finalRules = kept;
      if (!assignment) { assignment = trySolve([], FULL) || {}; finalRules = []; }
    }
    if (fill === 'front') compactForward(assignment, finalRules);

    /* Fill from the front: while an empty seat sits in a row nearer the board than an occupied one,
       move a student forward into it (front-priority students first, then whoever is furthest back),
       as long as every rule the plan honours still holds. Locked students never move. */
    function compactForward(asg, ruleSet) {
      const occ = new Map(), at = new Map();
      for (const [k, id] of Object.entries(asg)) { const i = seatIdx.get(k); occ.set(i, id); at.set(id, i); }
      const apartP = new Map(), togP = new Map();
      for (const r of ruleSet) for (const a of r.members) for (const b of r.members) {
        if (a === b) continue;
        const m = r.type === 'apart' ? apartP : togP;
        if (!m.has(a)) m.set(a, []);
        m.get(a).push(b);
      }
      const row = i => Math.round(seats[i].dist * 4);
      const canMove = (id, to) => (apartP.get(id) || []).every(q => !at.has(q) || !conf[to][at.get(q)])
        && (togP.get(id) || []).every(q => !at.has(q) || seats[at.get(q)].itemId === seats[to].itemId);
      for (let guard = 0; guard < S * S; guard++) {
        let moved = false;
        for (const e of seatOrder) {
          if (occ.has(e)) continue;
          const cands = [...occ.entries()].filter(([i, id]) => row(i) > row(e) && !locked.has(id))
            .sort((a, b) => (+!!byId.get(b[1]).front - +!!byId.get(a[1]).front) || (seats[b[0]].dist - seats[a[0]].dist));
          for (const [i, id] of cands) {
            if (!canMove(id, e)) continue;
            occ.delete(i); occ.set(e, id); at.set(id, e); moved = true;
            break;
          }
          if (moved) break;
        }
        if (!moved) break;
      }
      for (const k of Object.keys(asg)) delete asg[k];
      for (const [i, id] of occ) asg[seats[i].key] = id;
    }

    return {
      ok: !problems.length && !brokenRules.length && !conflictRules.length,
      assignment, unseated, warnings, problems,
      conflictRules: conflictRules.map(r => r.id), brokenRules: brokenRules.map(r => r.id),
      stats: { ms: Date.now() - t0, nodes: totalNodes, seats: S, students: students.length },
    };
  }

  /* Check an assignment against the rules (used after manual swaps). */
  function checkPlan({ seats, assignment, rules, mode }) {
    const seatOf = new Map();
    const byKey = new Map(seats.map(s => [s.key, s]));
    for (const [k, id] of Object.entries(assignment || {})) if (byKey.has(k)) seatOf.set(id, byKey.get(k));
    const out = [];
    for (const r of rules) {
      const m = r.members.filter(id => seatOf.has(id));
      if (r.type === 'apart') {
        for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
          const a = seatOf.get(m[i]), b = seatOf.get(m[j]);
          if (seatsConflict(a, b, mode)) out.push({ rule: r.id, type: 'apart', students: [m[i], m[j]], seats: [a.key, b.key], same: a.itemId === b.itemId });
        }
      } else {
        const items = new Set(m.map(id => seatOf.get(id).itemId));
        if (items.size > 1) out.push({ rule: r.id, type: 'together', students: m, seats: m.map(id => seatOf.get(id).key) });
      }
    }
    return out;
  }

  return {
    TYPES, ADJ_M, CHAIR_M, isWall, isSeated, isRound, isFixture, isFloor, wallLenM, benchLenM, tableSizeM, tableDims, itemGeom, wallGeom, roomSeats, itemProblem, rectInside,
    pointInPoly, projectToSeg, polyArea, selfIntersects, seatsConflict, solve, checkPlan, mulberry32, shuffle, boardOf, clamp,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
