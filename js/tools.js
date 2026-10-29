/* ------------------------------------------------------------------
   Tools: pure logic for the group maker, the random picker and CSV
   class-list import. No DOM access, so it is unit tested in Node
   (see tests/tools.test.mjs). Randomness comes from an injectable
   rng() so tests can use a seeded generator.
------------------------------------------------------------------- */
const Tools = (() => {
  const shuffle = (arr, rng) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

  /* ================= groups ================= */

  /* How many groups to make from n students: by group size (round up, so a class of 26 in fours
     makes 7 groups) or a fixed number of groups. Never more groups than students. */
  function groupCount(n, { mode = 'size', size = 4, count = 6 } = {}) {
    if (!n) return 1;
    const k = mode === 'size' ? Math.ceil(n / Math.max(1, size)) : count;
    return Math.max(1, Math.min(n, Math.round(k) || 1));
  }
  function groupSizesText(n, k) {
    if (!n) return 'Nobody here yet';
    const lo = Math.floor(n / k), hi = Math.ceil(n / k);
    return `${k} group${k === 1 ? '' : 's'} of ${lo === hi ? lo : `${lo}–${hi}`}`;
  }

  /* How often each pair of students has shared a group in past groupings (most recent first).
     More recent groupings count more, so the effect fades over time. */
  function pairHistory(history = [], depth = 8) {
    const counts = new Map();
    history.slice(0, depth).forEach((list, age) => {
      const w = depth - age;
      for (const grp of list) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) {
        const k = pairKey(grp[i], grp[j]);
        counts.set(k, (counts.get(k) || 0) + w);
      }
    });
    return counts;
  }
  /* Number of pairs in `list` who were together in the most recent past grouping. */
  function repeatPairs(list, history = []) {
    if (!history.length) return 0;
    const prev = new Set();
    for (const grp of history[0]) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) prev.add(pairKey(grp[i], grp[j]));
    let n = 0;
    for (const grp of list) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) if (prev.has(pairKey(grp[i], grp[j]))) n++;
    return n;
  }

  /* Balanced random groups.
     - Group sizes differ by at most one (n % k groups get one extra).
     - Keep-together rules are merged into units first; keep-apart rules are avoided.
     - With history, students who were recently together are kept apart where possible.
     Units are placed largest first into the group with room, then fewest keep-apart clashes,
     fewest repeat partners, fewest members. Many random restarts keep the best result:
     fewest broken rules, then sizes closest to target, then fewest repeats.
     Returns { groups, broken, repeats }. */
  function makeGroups({ ids, rules = [], k, useRules = true, history = [], avoidRepeats = true, rng = Math.random, tries = 300 }) {
    const n = ids.length;
    if (!n) return { groups: [], broken: 0, repeats: 0 };
    k = Math.max(1, Math.min(n, k || 1));
    const here = new Set(ids);
    const active = useRules ? rules.map(r => ({ ...r, members: [...new Set(r.members)].filter(m => here.has(m)) })).filter(r => r.members.length >= 2) : [];
    const parent = new Map(ids.map(id => [id, id]));
    const find = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
    for (const r of active) if (r.type === 'together') for (const m of r.members.slice(1)) parent.set(find(m), find(r.members[0]));
    const unitMap = new Map();
    for (const id of ids) { const root = find(id); if (!unitMap.has(root)) unitMap.set(root, []); unitMap.get(root).push(id); }
    const units = [...unitMap.values()];
    const apart = new Set();
    for (const r of active) if (r.type === 'apart') for (const a of r.members) for (const b of r.members) if (a !== b) apart.add(a + '|' + b);
    const past = avoidRepeats ? pairHistory(history) : new Map();
    const clash = (unit, grp) => { let c = 0; for (const a of unit) for (const b of grp) if (apart.has(a + '|' + b)) c++; return c; };
    const rep = (unit, grp) => { let c = 0; if (!past.size) return 0; for (const a of unit) for (const b of grp) c += past.get(pairKey(a, b)) || 0; return c; };
    const base = Math.floor(n / k), extra = n % k;
    let best = null;
    for (let t = 0; t < tries; t++) {
      const target = shuffle(Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)), rng);
      const order = shuffle(units.slice(), rng).sort((a, b) => b.length - a.length);
      const groups = Array.from({ length: k }, () => []);
      let broken = 0, repeats = 0;
      for (const u of order) {
        let pick = null;
        for (let i = 0; i < k; i++) {
          const o = { i, fits: groups[i].length + u.length <= target[i], c: clash(u, groups[i]), r: rep(u, groups[i]), len: groups[i].length, z: rng() };
          if (!pick || (o.fits !== pick.fits ? o.fits : o.c !== pick.c ? o.c < pick.c : o.r !== pick.r ? o.r < pick.r : o.len !== pick.len ? o.len < pick.len : o.z < pick.z)) pick = o;
        }
        groups[pick.i].push(...u);
        broken += pick.c; repeats += pick.r;
      }
      for (const u of units) for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) if (apart.has(u[i] + '|' + u[j])) broken++; // together and apart for the same pair
      const off = groups.reduce((s, g, i) => s + Math.abs(g.length - target[i]), 0);
      const score = broken * 1e9 + off * 1e6 + repeats;
      if (!best || score < best.score) best = { groups, broken, repeats, score };
      if (score === 0) break;
    }
    let groups = best.groups;
    if (best.broken || best.repeats) groups = repair(groups, units, apart, past);
    const broken = countBroken(groups, units, apart);
    return { groups: groups.map(g => shuffle(g, rng)), broken, repeats: repeatPairs(groups, history) };
  }

  /* Keep-apart clashes in a grouping, plus any pair that is both kept together and kept apart. */
  function countBroken(groups, units, apart) {
    let n = 0;
    for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (apart.has(g[i] + '|' + g[j])) n++;
    return n;
  }
  /* Local repair: swap two students (who aren't tied to others by a keep-together rule) between
     groups while that lowers the number of keep-apart clashes, then of repeat partners. Swaps keep
     every group the same size. */
  function repair(groups, units, apart, past) {
    groups = groups.map(g => g.slice());
    const solo = new Set(units.filter(u => u.length === 1).map(u => u[0]));
    const cost = (id, g, skip) => {
      let c = 0;
      for (const o of g) if (o !== id && o !== skip) c += (apart.has(id + '|' + o) ? 1e6 : 0) + (past.get(pairKey(id, o)) || 0);
      return c;
    };
    for (let pass = 0; pass < 50; pass++) {
      let improved = false;
      for (let gi = 0; gi < groups.length; gi++) for (let ai = 0; ai < groups[gi].length; ai++) {
        const a = groups[gi][ai];
        if (!solo.has(a)) continue;
        const ca = cost(a, groups[gi]);
        if (!ca) continue;
        let bestSwap = null;
        for (let gj = 0; gj < groups.length; gj++) if (gj !== gi) for (let bi = 0; bi < groups[gj].length; bi++) {
          const b = groups[gj][bi];
          if (!solo.has(b)) continue;
          const before = ca + cost(b, groups[gj]);
          const after = cost(a, groups[gj], b) + cost(b, groups[gi], a);
          if (after < before && (!bestSwap || before - after > bestSwap.gain)) bestSwap = { gj, bi, gain: before - after };
        }
        if (bestSwap) {
          const b = groups[bestSwap.gj][bestSwap.bi];
          groups[gi][ai] = b; groups[bestSwap.gj][bestSwap.bi] = a;
          improved = true;
        }
      }
      if (!improved) break;
    }
    return groups;
  }

  /* Rules broken by a grouping (only students who are in it count). */
  function groupProblems(list, rules) {
    const gi = new Map();
    list.forEach((grp, i) => grp.forEach(id => gi.set(id, i)));
    const out = [];
    for (const r of rules) {
      const m = [...new Set(r.members)].filter(id => gi.has(id));
      if (r.type === 'apart') {
        for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (gi.get(m[i]) === gi.get(m[j])) out.push({ rule: r.id, type: 'apart', students: [m[i], m[j]] });
      } else if (new Set(m.map(id => gi.get(id))).size > 1) out.push({ rule: r.id, type: 'together', students: m });
    }
    return out;
  }

  /* ================= random picker ================= */

  /* Choose the next student.
     here: ids of students present. picked: ids already picked this round. last: the previous pick.
     With noRepeat, nobody is picked twice until everyone present has had a turn; then a new round
     starts. The same student is never picked twice in a row unless they are the only one here.
     Returns { id, newRound } or null when nobody is here. */
  function pickNext({ here, picked = [], last = null, noRepeat = true, rng = Math.random }) {
    if (!here.length) return null;
    const done = new Set(picked);
    let pool = noRepeat ? here.filter(id => !done.has(id)) : here.slice();
    let newRound = false;
    if (!pool.length) { newRound = true; pool = here.slice(); }
    if (pool.length > 1) pool = pool.filter(id => id !== last);
    return { id: pool[Math.floor(rng() * pool.length)], newRound };
  }
  /* The picker state after a pick (picked list capped so it can't grow forever). */
  function recordPick(state, { id, newRound }, cap = 300) {
    const picked = newRound ? [id] : [...state.picked, id];
    return { ...state, picked: picked.slice(-cap), last: id };
  }

  /* ================= CSV class lists ================= */

  /* Parse CSV text into rows. Handles quotes (with "" escapes and line breaks inside quotes),
     CRLF line endings, a byte-order mark, and comma, semicolon or tab separators. */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/).find(l => l.trim()) || '';
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let q = false;
    for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
    const sep = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c));
  }

  /* Column headings, matched after lower-casing and turning _ - . into spaces ("first_name", "FirstName"
     and "First Name" all read as "first name"). Columns about other people (parents, teachers...) or
     other details are never used for names, even if their heading contains "name". */
  const HEAD = {
    skip: /\b(parent|guardian|carer|caregiver|mother|father|teacher|staff|contact|emergency|doctor|user\s*name|login|e ?mail|school|house|form|subject|course|tutor|mentor|sibling|class\s*name|street|suburb|address)\b/,
    preferred: /\bpreferred\b|\bknown as\b|\bnick\s*name\b/,
    first: /\b(first|given|fore)\s*names?\b|^(first|given|forename)$/,
    last: /\b(last|family|sur)\s*names?\b|^(last|family|surname)$/,
    full: /^((student|pupil|learner|child|full|legal|display)\s*)?(full\s*)?names?\b|^(students?|pupils?|learners?|kids?|child|children)$|\b(student|pupil|full)\s*names?\b|\b(list|roll|register)$/,
    word: /\b(names?|students?|pupils?|learners?|kids?|child|children|list|roll|register|first|last|surname|given|family)\b/,
    other: /\b(id|code|number|no|year|level|grade|class|email|dob|date|birth|gender|sex|phone|mobile|house|form|group|homeroom)\b/,
  };
  const normHead = h => String(h || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  function headRole(h) {
    const t = normHead(h);
    if (!t || HEAD.skip.test(t)) return null;
    const first = HEAD.first.test(t), last = HEAD.last.test(t);
    if (first && last) return 'full';                       // "Last name, First name" in one column
    if (HEAD.preferred.test(t)) return last ? 'last' : 'preferred';
    if (first) return 'first';
    if (last) return 'last';
    if (HEAD.full.test(t)) return 'full';
    return null;
  }
  /* What a cell holding a name looks like: letters, spaces, hyphens, apostrophes and full stops only. */
  const NAME_RE = /^[\p{L}][\p{L}\p{M}'’\-. ]*$/u;
  const isNameLike = v => v.length >= 2 && v.length <= 60 && NAME_RE.test(v);
  const isCommaName = v => { const m = v.match(/^([^,]+),\s*([^,]+)$/); return !!m && isNameLike(m[1].trim()) && isNameLike(m[2].trim()); };
  /* SMITH → Smith (school systems often export surnames in capitals); mixed-case words are left alone. */
  const tidyWord = w => (/^[\p{L}'’-]{2,}$/u.test(w) && w === w.toUpperCase() ? w.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : w);
  const tidy = nm => nm.split(' ').map(tidyWord).join(' ');

  /* Look at a column's contents to judge whether it holds names. */
  function columnStats(rows, c) {
    let n = 0, name = 0, comma = 0, multi = 0;
    for (const r of rows) {
      const v = (r[c] || '').trim();
      if (!v) continue;
      n++;
      if (isCommaName(v)) { comma++; name++; continue; }
      if (isNameLike(v)) { name++; if (/\s/.test(v)) multi++; }
    }
    return { n, name: n ? name / n : 0, comma: n ? comma / n : 0, multi: n ? multi / n : 0 };
  }

  /* Work out student names from CSV rows, as exported by school systems (SEQTA, Compass, Sentral,
     OneSchool) or typed into a spreadsheet. Uses column headings where present: preferred name over
     first name, then surname, or a single name column. Without recognisable headings it reads the
     contents: a column of "Surname, First" or full names, else two columns of single names (first
     name then surname, which the import screen can swap). "Surname, First" cells are turned round.
     Title rows above the headings are dropped. `header` (true/false) overrides whether the first row
     is headings, for headings it can't recognise. */
  function namesFromRows(rows, { swap = false, header } = {}) {
    if (!rows.length) return { names: [], hasHeader: false, columns: '' };
    // the heading row is the one (of the first few) with the most recognisable headings; anything
    // above it is a title ("Year 7 Maths", "Class list – 7B") and is dropped
    let h = -1, most = 0;
    rows.slice(0, 5).forEach((r, i) => { const k = r.filter(headRole).length; if (k > most) { most = k; h = i; } });
    if (header === false) h = -1;
    if (h > 0) rows = rows.slice(h);
    const width = Math.max(...rows.map(r => r.length));
    const roles = h >= 0 ? rows[0].map(headRole) : [];
    let hasHeader = h >= 0;
    let firstI = -1, prefI = -1, lastI = -1, fullI = -1;
    if (hasHeader) {
      const body = rows.slice(1);
      // where a role appears twice ("Name" and "Student Name"), use the column that holds more names
      const pick = role => roles.map((r, i) => (r === role ? i : -1)).filter(i => i >= 0).sort((a, b) => columnStats(body, b).name - columnStats(body, a).name)[0] ?? -1;
      prefI = pick('preferred'); firstI = pick('first'); lastI = pick('last'); fullI = pick('full');
      if (firstI < 0 && prefI >= 0) { firstI = prefI; prefI = -1; }
      if (firstI >= 0 || lastI >= 0) fullI = -1;
    } else {
      // no recognisable headings: judge each column by its contents
      hasHeader = header ?? (rows.length > 1 && rows[0].some(c => HEAD.other.test(normHead(c)) || HEAD.word.test(normHead(c))));
      const body = hasHeader ? rows.slice(1) : rows;
      const stats = Array.from({ length: width }, (_, c) => ({ c, ...columnStats(body, c) })).filter(s => s.n);
      const best = (list, key) => list.sort((a, b) => b[key] - a[key] || b.name - a.name)[0];
      const commaCol = best(stats.filter(s => s.comma >= 0.6), 'comma');
      const fullCol = best(stats.filter(s => s.name >= 0.8 && s.multi >= 0.6), 'multi');
      const singles = stats.filter(s => s.name >= 0.8 && s.multi < 0.6);
      if (commaCol) fullI = commaCol.c;
      else if (fullCol) fullI = fullCol.c;
      else if (singles.length >= 2) { firstI = singles[0].c; lastI = singles[1].c; }
      else fullI = (best(stats.slice(), 'name') || { c: 0 }).c;
    }
    if (swap && firstI >= 0 && lastI >= 0) [firstI, lastI] = [lastI, firstI];
    const body = hasHeader ? rows.slice(1) : rows;
    const seen = new Set(), names = [];
    const headKey = hasHeader ? rows[0].join('|').toLowerCase() : null;
    for (const r of body) {
      // headings repeated further down (one block per class), or a second heading row ("Class list" over "Names")
      if (hasHeader && (r.join('|').toLowerCase() === headKey || r.filter(c => c).every(headRole))) continue;
      let nm;
      if (firstI >= 0 || lastI >= 0) nm = [(prefI >= 0 && (r[prefI] || '').trim()) || r[firstI] || '', r[lastI] || ''].join(' ');
      else nm = r[fullI] || '';
      nm = nm.replace(/\s+/g, ' ').trim();
      const m = nm.match(/^([^,]+),\s*([^,]+)$/);
      if (m) nm = `${m[2].trim()} ${m[1].trim()}`;
      nm = tidy(nm);
      if (!nm || seen.has(nm.toLowerCase())) continue;
      seen.add(nm.toLowerCase()); names.push(nm);
    }
    const label = i => (hasHeader && rows[0][i] ? rows[0][i] : `column ${i + 1}`);
    let used;
    if (firstI >= 0 || lastI >= 0) used = [prefI >= 0 ? `${label(prefI)} (or ${label(firstI)})` : firstI >= 0 ? label(firstI) : '', lastI >= 0 ? label(lastI) : ''].filter(Boolean).join(' + ');
    else used = label(fullI);
    return { names, hasHeader, columns: used };
  }

  /* Seeded random numbers for tests (mulberry32). */
  function seeded(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { groupCount, groupSizesText, makeGroups, groupProblems, pairHistory, repeatPairs, pickNext, recordPick, parseCSV, namesFromRows, seeded, shuffle };
})();
if (typeof module !== 'undefined') module.exports = Tools;
