// Solver tests. Run with: node tests/solver.test.mjs
// Loads the same Core + Sample scripts the page uses (js/core.js, js/sample.js).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const Core = require('../js/core.js');
const Sample = require('../js/sample.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; }
}

const room = Sample.rooms()[0];          // Room B12: 29 available seats (one marked unavailable)
const cls = Sample.classes()[0];         // 28 students
const seats = Core.roomSeats(room);
const avail = seats.filter(s => !s.unavailable);
const nameOf = id => cls.students.find(s => s.id === id).name;
const label = r => r.members.map(nameOf).join(r.type === 'apart' ? ' ✕ ' : ' + ');
const apartRules = cls.rules.filter(r => r.type === 'apart');
const frontIds = cls.students.filter(s => s.front).map(s => s.id);

function verify(res, rules, mode, students = cls.students) {
  const keys = Object.keys(res.assignment);
  const ids = Object.values(res.assignment);
  assert.equal(new Set(ids).size, ids.length, 'a student is seated twice');
  for (const k of keys) {
    const s = seats.find(x => x.key === k);
    assert.ok(s && !s.unavailable, 'assigned to a missing or unavailable seat ' + k);
  }
  assert.equal(ids.length + res.unseated.length, students.length, 'not everybody accounted for');
  const v = Core.checkPlan({ seats, assignment: res.assignment, rules, mode });
  assert.equal(v.length, 0, 'rule violations: ' + JSON.stringify(v));
}

console.log(`\nSample: ${cls.students.length} students, ${apartRules.length} keep-apart rules, ${frontIds.length} front-priority, ${avail.length} seats`);

test('28 students / 6 keep-apart / 4 front-priority: solves in both adjacency modes, 300 runs each', () => {
  for (const mode of ['adjacent', 'table']) {
    let worstMs = 0, worstFrontRank = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const res = Core.solve({ seats, students: cls.students, rules: apartRules, mode, seed, label });
      assert.ok(res.ok, `seed ${seed} failed: ${res.problems.join(' ')}`);
      verify(res, apartRules, mode);
      worstMs = Math.max(worstMs, res.stats.ms);
      // front-priority students must be in the front-most seats (ranks are ties-aware)
      for (const [k, id] of Object.entries(res.assignment)) {
        if (frontIds.includes(id)) worstFrontRank = Math.max(worstFrontRank, seats.find(s => s.key === k).rank);
      }
    }
    // 4 front seats needed; front row of tables has 6 seats at the same distance band
    assert.ok(worstFrontRank <= 6, 'front-priority student seated at rank ' + worstFrontRank);
    console.log(`    mode=${mode}: worst solve ${worstMs} ms, worst front-priority seat rank ${worstFrontRank}`);
  }
});

test('Shuffle gives different arrangements', () => {
  const a = Core.solve({ seats, students: cls.students, rules: apartRules, seed: 11, label }).assignment;
  const b = Core.solve({ seats, students: cls.students, rules: apartRules, seed: 12, label }).assignment;
  assert.notDeepEqual(a, b);
});

test('Empty seat is left at the back when filling from the front', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const res = Core.solve({ seats, students: cls.students, rules: apartRules, seed, label, fill: 'front' });
    const empty = avail.filter(s => !res.assignment[s.key]);
    assert.equal(empty.length, 1);
    const maxDist = Math.max(...avail.map(s => s.dist));
    assert.ok(empty[0].dist >= maxDist - 2.5, 'empty seat not in back rows: dist ' + empty[0].dist);
  }
});

test('Keep-together rule is honoured (same table)', () => {
  const res = Core.solve({ seats, students: cls.students, rules: cls.rules, seed: 5, label });
  assert.ok(res.ok);
  verify(res, cls.rules, 'adjacent');
});

test('Locked seats are respected', () => {
  const students = cls.students.map(s => ({ ...s }));
  students[0].lock = avail[avail.length - 1].key;
  students[1].lock = avail[0].key; // Isaac (has a keep-apart with Gottfried)
  for (let seed = 1; seed <= 50; seed++) {
    const res = Core.solve({ seats, students, rules: apartRules, seed, label });
    assert.ok(res.ok);
    assert.equal(res.assignment[students[0].lock], students[0].id);
    assert.equal(res.assignment[students[1].lock], students[1].id);
    verify(res, apartRules, 'adjacent', students);
  }
});

test('Impossible: two keep-apart students locked to the same table → clear message', () => {
  const students = cls.students.map(s => ({ ...s }));
  const isaac = students.find(s => s.name.startsWith('Isaac')), gottfried = students.find(s => s.name.startsWith('Gottfried'));
  isaac.lock = 'b12_t1:0'; gottfried.lock = 'b12_t1:1';
  const res = Core.solve({ seats, students, rules: apartRules, seed: 1, label });
  assert.equal(res.ok, false);
  assert.match(res.problems.join(' '), /Isaac Newton and Gottfried Leibniz are both locked/);
  assert.ok(res.brokenRules.includes(apartRules[0].id));
  console.log('    → ' + res.problems[0]);
});

test('Impossible: keep-apart group larger than the number of tables → names the rule', () => {
  const big = { id: 'big', type: 'apart', members: cls.students.slice(0, 10).map(s => s.id) }; // 10 > 9 tables
  const res = Core.solve({ seats, students: cls.students, rules: [big], mode: 'table', seed: 1, label });
  assert.equal(res.ok, false);
  assert.match(res.problems[0], /needs 10 different tables, but the room only has 9/);
  console.log('    → ' + res.problems[0]);
});

test('Impossible: subtle conflict set is isolated by the diagnosis (and a best-effort plan is still produced)', () => {
  // 10 students who must all be apart with strict adjacency: 9 tables, and neighbouring
  // tables conflict too, so it's impossible (but no simple pre-check catches it). Plus a harmless rule that must NOT be blamed.
  const g = cls.students.slice(0, 10).map(s => s.id);
  const rules = [
    { id: 'harmless', type: 'apart', members: [cls.students[20].id, cls.students[21].id] },
    { id: 'tooBig', type: 'apart', members: g },
  ];
  const res = Core.solve({ seats, students: cls.students, rules, mode: 'adjacent', seed: 3, label });
  assert.equal(res.ok, false);
  assert.equal(JSON.stringify(res.conflictRules), '["tooBig"]');
  assert.ok(!res.brokenRules.includes('harmless'));
  assert.equal(Object.keys(res.assignment).length, 28, 'best-effort plan should still seat everyone');
  console.log('    → ' + res.problems[0].slice(0, 160) + '…');
});

test('Impossible: chain of rules with no single culprit → reports the minimal set', () => {
  // Pair desks only: 3 pair desks in a tiny room, 6 students, table mode.
  const tiny = { id: 'r', boundary: [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 4 }, { x: 0, y: 4 }], items: [
    { id: 'bd', type: 'board', x: 7, y: 0, len: 4 },
    { id: 'p1', type: 'pair', x: 0, y: 1 }, { id: 'p2', type: 'pair', x: 5, y: 1 }, { id: 'p3', type: 'pair', x: 10, y: 1 }] };
  const st = ['A', 'B', 'C', 'D', 'E', 'F'].map(n => ({ id: n, name: n }));
  const rules = [
    { id: 'r1', type: 'apart', members: ['A', 'B'] },
    { id: 'r2', type: 'apart', members: ['B', 'C'] },
    { id: 'r3', type: 'apart', members: ['A', 'C'] },
    { id: 'r4', type: 'apart', members: ['D', 'E'] },
    { id: 'r5', type: 'apart', members: ['D', 'F'] },
    { id: 'r6', type: 'apart', members: ['E', 'F'] },
  ];
  // A,B,C need 3 different desks and D,E,F need 3 different desks: fine (6 seats, 3 desks of 2).
  let res = Core.solve({ seats: Core.roomSeats(tiny), students: st, rules, mode: 'table', seed: 1 });
  assert.ok(res.ok, 'should be solvable');
  // Add A ✕ D: now A's desk can hold none of B,C,D... still ok? A needs a partner from {E,F}. Add A ✕ E, A ✕ F → A has no partner.
  rules.push({ id: 'r7', type: 'apart', members: ['A', 'D'] }, { id: 'r8', type: 'apart', members: ['A', 'E'] }, { id: 'r9', type: 'apart', members: ['A', 'F'] });
  res = Core.solve({ seats: Core.roomSeats(tiny), students: st, rules, mode: 'table', seed: 1 });
  assert.equal(res.ok, false);
  // Minimal culprit set: D,E,F take all three desks and A may sit with none of them.
  assert.ok(['r7', 'r8', 'r9'].every(id => res.conflictRules.includes(id)), 'A ✕ D/E/F must be blamed: ' + res.conflictRules);
  assert.ok(res.conflictRules.length < rules.length, 'set should be minimal, not every rule');
  assert.ok(!res.conflictRules.includes('r2'), 'B ✕ C is irrelevant');
  console.log('    → ' + res.problems[0]);
});

test('More students than seats → warns and leaves extras unseated', () => {
  const extra = [...cls.students, { id: 'x1', name: 'Extra One' }, { id: 'x2', name: 'Extra Two' }];
  const res = Core.solve({ seats, students: extra, rules: apartRules, seed: 2, label });
  assert.match(res.warnings[0], /30 students but only 29 available seats/);
  assert.equal(res.unseated.length, 1);
  verify(res, apartRules, 'adjacent', extra);
});

test('Lab with prep-room cut-out: all items inside, solvable', () => {
  const lab = Sample.rooms()[1];
  for (const it of lab.items) assert.equal(Core.itemProblem(lab, it), null, it.id + ' ' + Core.itemProblem(lab, it));
  const res = Core.solve({ seats: Core.roomSeats(lab), students: cls.students, rules: cls.rules, seed: 9, label });
  assert.ok(res.ok, res.problems.join(' '));
});

test('Furniture outside an L-shaped boundary is rejected', () => {
  // notch (outside the room) is x 18–26, y 0–6
  const r = { boundary: Sample.PRESETS.lab.boundary, items: [] };
  const inNotch = { id: 'a', type: 'group4', x: 20, y: 0.5 };
  const inside = { id: 'b', type: 'group4', x: 2, y: 2 };
  const straddle = { id: 'c', type: 'group6', x: 16, y: 4 };
  assert.equal(Core.itemProblem(r, inNotch), 'outside');
  assert.equal(Core.itemProblem(r, inside), null);
  assert.equal(Core.itemProblem(r, straddle), 'outside');
});

test('Sample room furniture is valid', () => {
  for (const it of room.items) assert.equal(Core.itemProblem(room, it), null, it.id);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}\n`);
