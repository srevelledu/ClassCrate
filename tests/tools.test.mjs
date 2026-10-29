// Group maker, random picker and CSV import tests. Run with: node tests/tools.test.mjs
// Loads the same scripts the page uses (js/tools.js, js/sample.js).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const Tools = require('../js/tools.js');
const Sample = require('../js/sample.js');
const { makeGroups, groupCount, groupSizesText, groupProblems, pairHistory, repeatPairs, pickNext, recordPick, parseCSV, namesFromRows, seeded } = Tools;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; }
}
const ids = n => Array.from({ length: n }, (_, i) => 's' + (i + 1));
const sizes = r => r.groups.map(g => g.length);
function assertPartition(r, all, k) {
  assert.equal(r.groups.length, k, 'group count');
  const flat = r.groups.flat();
  assert.equal(flat.length, all.length, 'everyone placed once');
  assert.deepEqual([...flat].sort(), [...all].sort(), 'exactly the given students');
  const s = sizes(r);
  assert.ok(Math.max(...s) - Math.min(...s) <= 1, `balanced sizes ${s}`);
}

console.log('Group count');
test('group size mode rounds up (26 in fours = 7 groups, 24 in fours = 6)', () => {
  assert.equal(groupCount(26, { mode: 'size', size: 4 }), 7);
  assert.equal(groupCount(24, { mode: 'size', size: 4 }), 6);
  assert.equal(groupCount(5, { mode: 'size', size: 4 }), 2);
});
test('number-of-groups mode, never more groups than students, never fewer than one', () => {
  assert.equal(groupCount(28, { mode: 'count', count: 6 }), 6);
  assert.equal(groupCount(3, { mode: 'count', count: 6 }), 3);
  assert.equal(groupCount(0, { mode: 'count', count: 6 }), 1);
  assert.equal(groupCount(10, { mode: 'size', size: 0 }), 10);
  assert.equal(groupCount(10, { mode: 'count', count: 0 }), 1);
});
test('size summary text', () => {
  assert.equal(groupSizesText(28, 7), '7 groups of 4');
  assert.equal(groupSizesText(26, 7), '7 groups of 3–4');
  assert.equal(groupSizesText(1, 1), '1 group of 1');
  assert.equal(groupSizesText(0, 1), 'Nobody here yet');
});

console.log('Group maker: placement and balance');
test('every class size 1–40 × every group count up to 12 × 3 seeds: everyone placed once, sizes within one', () => {
  let cases = 0;
  for (let n = 1; n <= 40; n++) for (let k = 1; k <= Math.min(n, 12); k++) for (const seed of [1, 2, 3]) {
    const all = ids(n);
    assertPartition(makeGroups({ ids: all, k, rng: seeded(seed * 1000 + n * 13 + k) }), all, k);
    cases++;
  }
  assert.ok(cases > 1000);
});
test('asking for more groups than students makes one group per student', () => {
  const r = makeGroups({ ids: ids(3), k: 10, rng: seeded(1) });
  assert.deepEqual(sizes(r), [1, 1, 1]);
});
test('no students gives no groups', () => {
  assert.deepEqual(makeGroups({ ids: [], k: 4, rng: seeded(1) }).groups, []);
});
test('only the students passed in are grouped (absent students are left out)', () => {
  const all = ids(20), here = all.filter((_, i) => i % 4);
  const r = makeGroups({ ids: here, k: 5, rng: seeded(9) });
  assertPartition(r, here, 5);
  for (const id of all.filter((_, i) => !(i % 4))) assert.ok(!r.groups.flat().includes(id));
});
test('groups come out in a different order on different runs', () => {
  const a = JSON.stringify(makeGroups({ ids: ids(24), k: 6, rng: seeded(1) }).groups);
  const b = JSON.stringify(makeGroups({ ids: ids(24), k: 6, rng: seeded(2) }).groups);
  assert.notEqual(a, b);
});

console.log('Group maker: rules');
test('the sample class (28 students, 7 rules) in fours: every rule kept, 200 seeds', () => {
  const cls = Sample.classes()[0], all = cls.students.map(s => s.id);
  for (let seed = 1; seed <= 200; seed++) {
    const r = makeGroups({ ids: all, rules: cls.rules, k: groupCount(all.length, { mode: 'size', size: 4 }), rng: seeded(seed) });
    assertPartition(r, all, 7);
    assert.equal(r.broken, 0, 'seed ' + seed);
    assert.deepEqual(groupProblems(r.groups, cls.rules), [], 'seed ' + seed);
  }
});
/* Exhaustive check: can these students be split into k groups (sizes within one) with no keep-apart
   pair sharing a group? Used to tell solvable random cases from impossible ones. */
function solvable(all, rules, k) {
  const adj = new Map(all.map(i => [i, new Set()]));
  for (const r of rules) for (const a of r.members) for (const b of r.members) if (a !== b) adj.get(a).add(b);
  const order = [...all].sort((a, b) => adj.get(b).size - adj.get(a).size);
  const base = Math.floor(all.length / k), extra = all.length % k;
  const cap = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)), cnt = Array(k).fill(0), col = new Map();
  const go = i => {
    if (i === order.length) return true;
    const v = order[i];
    for (let c = 0; c < k; c++) {
      if (cnt[c] >= cap[c] || [...adj.get(v)].some(u => col.get(u) === c)) continue;
      col.set(v, c); cnt[c]++;
      if (go(i + 1)) return true;
      cnt[c]--; col.delete(v);
    }
    return false;
  };
  return go(0);
}
test('300 random classes with keep-apart rules: no rule broken whenever a rule-keeping grouping exists', () => {
  const rng = seeded(777);
  let impossible = 0;
  for (let t = 0; t < 300; t++) {
    const n = 18 + Math.floor(rng() * 14), k = 4 + Math.floor(rng() * 4), all = ids(n);
    const rules = [];
    for (let r = 0; r < 6; r++) {
      const size = 2 + Math.floor(rng() * Math.min(3, k - 1));
      const m = new Set(); while (m.size < size) m.add(all[Math.floor(rng() * n)]);
      rules.push({ id: 'r' + r, type: 'apart', members: [...m] });
    }
    const res = makeGroups({ ids: all, rules, k, rng: seeded(t + 1) });
    assertPartition(res, all, k);
    if (!solvable(all, rules, k)) { impossible++; assert.ok(res.broken >= 1); continue; }
    assert.equal(groupProblems(res.groups, rules).length, 0, `trial ${t}: ${JSON.stringify(groupProblems(res.groups, rules))}`);
  }
  assert.ok(impossible < 10, `${impossible} impossible cases`);
});
test('keep-together rules put the students in the same group', () => {
  const all = ids(24);
  const rules = [{ id: 't1', type: 'together', members: ['s1', 's2'] }, { id: 't2', type: 'together', members: ['s5', 's9', 's13'] }];
  for (let seed = 1; seed <= 100; seed++) {
    const r = makeGroups({ ids: all, rules, k: 6, rng: seeded(seed) });
    assertPartition(r, all, 6);
    assert.deepEqual(groupProblems(r.groups, rules), []);
  }
});
test('keep-together and keep-apart rules together, 100 seeds', () => {
  const all = ids(28);
  const rules = [
    { id: 't', type: 'together', members: ['s1', 's2'] },
    { id: 'a1', type: 'apart', members: ['s1', 's3'] },
    { id: 'a2', type: 'apart', members: ['s2', 's4', 's5'] },
    { id: 'a3', type: 'apart', members: ['s6', 's7', 's8', 's9'] },
  ];
  for (let seed = 1; seed <= 100; seed++) assert.deepEqual(groupProblems(makeGroups({ ids: all, rules, k: 7, rng: seeded(seed) }).groups, rules), []);
});
test('an impossible keep-apart rule (5 students, 4 groups) is reported, and everyone is still placed', () => {
  const all = ids(16), rules = [{ id: 'x', type: 'apart', members: ['s1', 's2', 's3', 's4', 's5'] }];
  const r = makeGroups({ ids: all, rules, k: 4, rng: seeded(3) });
  assertPartition(r, all, 4);
  assert.equal(r.broken, 1, 'exactly one pair has to share');
  assert.equal(groupProblems(r.groups, rules).length, 1);
});
test('contradictory rules (together and apart for the same pair) are reported, not crashed on', () => {
  const all = ids(12), rules = [{ id: 't', type: 'together', members: ['s1', 's2'] }, { id: 'a', type: 'apart', members: ['s1', 's2'] }];
  const r = makeGroups({ ids: all, rules, k: 3, rng: seeded(5) });
  assert.equal(r.groups.flat().length, 12);
  assert.ok(r.broken >= 1);
});
test('rules naming absent or deleted students, or the same student twice, are handled', () => {
  const all = ids(10), rules = [{ id: 'a', type: 'apart', members: ['s1', 's1', 'gone', 's2'] }, { id: 'b', type: 'together', members: ['gone', 's3'] }];
  const r = makeGroups({ ids: all, rules, k: 2, rng: seeded(2) });
  assertPartition(r, all, 2);
  assert.deepEqual(groupProblems(r.groups, rules), []);
});
test('switching rules off ignores them', () => {
  const all = ids(8), rules = [{ id: 't', type: 'together', members: all }];
  const r = makeGroups({ ids: all, rules, k: 4, useRules: false, rng: seeded(1) });
  assert.deepEqual(sizes(r), [2, 2, 2, 2]);
});
test('groupProblems lists each broken pair and each split together-group', () => {
  const rules = [{ id: 'a', type: 'apart', members: ['x', 'y', 'z'] }, { id: 't', type: 'together', members: ['p', 'q'] }];
  const probs = groupProblems([['x', 'y', 'z'], ['p'], ['q']], rules);
  assert.equal(probs.filter(p => p.type === 'apart').length, 3);
  assert.equal(probs.filter(p => p.type === 'together').length, 1);
});

console.log('Group maker: history (avoiding repeat partners)');
test('recent groupings weigh more than older ones', () => {
  const h = pairHistory([[['a', 'b']], [['a', 'c']]]);
  assert.ok(h.get('a|b') > h.get('a|c'));
});
test('repeatPairs counts pairs who were together last time', () => {
  assert.equal(repeatPairs([['a', 'b', 'c'], ['d']], [[['a', 'b'], ['c', 'd']]]), 1);
  assert.equal(repeatPairs([['a', 'b']], []), 0);
});
test('with history, back-to-back groupings share far fewer partners (8 rounds × 30 seeds)', () => {
  const all = ids(24);
  let withH = 0, without = 0;
  for (let seed = 1; seed <= 30; seed++) {
    let hA = [], hB = [];
    for (let round = 0; round < 8; round++) {
      const a = makeGroups({ ids: all, k: 6, history: hA, rng: seeded(seed * 100 + round) });
      const b = makeGroups({ ids: all, k: 6, history: hB, avoidRepeats: false, rng: seeded(seed * 100 + round) });
      if (round) { withH += repeatPairs(a.groups, hA); without += repeatPairs(b.groups, hB); }
      hA = [a.groups, ...hA]; hB = [b.groups, ...hB];
    }
  }
  assert.ok(withH * 4 < without, `with history ${withH} vs without ${without}`);
  assert.ok(withH / (30 * 7) < 0.5, 'on average under half a repeated pair per regrouping');
});
test('avoiding repeats never breaks a rule or unbalances the groups', () => {
  const cls = Sample.classes()[0], all = cls.students.map(s => s.id);
  let hist = [];
  for (let round = 0; round < 10; round++) {
    const r = makeGroups({ ids: all, rules: cls.rules, k: 7, history: hist, rng: seeded(round + 40) });
    assertPartition(r, all, 7);
    assert.deepEqual(groupProblems(r.groups, cls.rules), []);
    hist = [r.groups, ...hist];
  }
});

console.log('Random picker');
test('nobody here: no pick', () => {
  assert.equal(pickNext({ here: [] }), null);
});
test('one student: always them, and each pick after the first starts a new round', () => {
  let st = { picked: [], last: null };
  for (let i = 0; i < 5; i++) {
    const p = pickNext({ here: ['a'], ...st, rng: seeded(i) });
    assert.equal(p.id, 'a');
    assert.equal(p.newRound, i > 0);
    st = recordPick(st, p);
  }
});
test("don't-repeat mode: each round picks everyone exactly once (class sizes 2–30, 20 rounds)", () => {
  for (let n = 2; n <= 30; n++) {
    const here = ids(n), rng = seeded(n);
    let st = { picked: [], last: null };
    for (let round = 0; round < 20; round++) {
      const seen = new Set();
      for (let i = 0; i < n; i++) {
        const p = pickNext({ here, ...st, rng });
        assert.equal(p.newRound, round > 0 && i === 0, `n=${n} round=${round} i=${i}`);
        assert.ok(!seen.has(p.id), 'no repeat within a round');
        seen.add(p.id);
        st = recordPick(st, p);
      }
      assert.equal(seen.size, n);
    }
  }
});
test('never the same student twice in a row, in either mode, including across round boundaries (20,000 picks)', () => {
  for (const noRepeat of [true, false]) for (const n of [2, 3, 5, 12]) {
    const here = ids(n), rng = seeded(n + (noRepeat ? 100 : 0));
    let st = { picked: [], last: null };
    for (let i = 0; i < 2500; i++) {
      const p = pickNext({ here, ...st, noRepeat, rng });
      assert.notEqual(p.id, st.last, `noRepeat=${noRepeat} n=${n} pick ${i}`);
      st = recordPick(st, p);
    }
  }
});
test('two students with repeats allowed simply alternate', () => {
  let st = { picked: [], last: null }, seq = '';
  for (let i = 0; i < 10; i++) { const p = pickNext({ here: ['a', 'b'], ...st, noRepeat: false, rng: seeded(i) }); seq += p.id; st = recordPick(st, p); }
  assert.ok(seq === 'ababababab' || seq === 'bababababa', seq);
});
test('absent students are never picked', () => {
  const all = ids(10), here = all.slice(0, 6), rng = seeded(4);
  let st = { picked: [], last: null };
  for (let i = 0; i < 300; i++) { const p = pickNext({ here, ...st, rng }); assert.ok(here.includes(p.id)); st = recordPick(st, p); }
});
test('picks of students who have since gone absent do not end the round early', () => {
  const p = pickNext({ here: ['a', 'b', 'c'], picked: ['a', 'x'], last: 'x', rng: seeded(1) });
  assert.ok(['b', 'c'].includes(p.id));
  assert.equal(p.newRound, false);
});
test('a student who was already picked and then marked absent is skipped this round', () => {
  for (let s = 1; s <= 50; s++) {
    const p = pickNext({ here: ['a', 'c'], picked: ['b'], last: 'b', rng: seeded(s) });
    assert.ok(['a', 'c'].includes(p.id));
  }
});
test('repeats allowed: picks are spread evenly (10 students, 50,000 picks, each within 5% of the average)', () => {
  const here = ids(10), rng = seeded(2024), count = {};
  let st = { picked: [], last: null };
  for (let i = 0; i < 50000; i++) { const p = pickNext({ here, ...st, noRepeat: false, rng }); count[p.id] = (count[p.id] || 0) + 1; st = recordPick(st, p); }
  for (const id of here) assert.ok(Math.abs(count[id] - 5000) < 250, `${id}: ${count[id]}`);
});
test("don't-repeat mode: everyone is equally likely to go first in a round (8 students, 8,000 rounds)", () => {
  const here = ids(8), rng = seeded(99), first = {};
  let st = { picked: [], last: null };
  for (let i = 0; i < 64000; i++) {
    const p = pickNext({ here, ...st, rng });
    if (p.newRound || i === 0) first[p.id] = (first[p.id] || 0) + 1;
    st = recordPick(st, p);
  }
  // The last pick of a round can't start the next one, so expect ~1000 each, give or take 15%.
  for (const id of here) assert.ok(Math.abs(first[id] - 1000) < 150, `${id}: ${first[id]}`);
});
test('the picked list is capped and a new round restarts it', () => {
  let st = { picked: [], last: null };
  for (let i = 0; i < 400; i++) st = recordPick(st, { id: 'x' + i, newRound: false }, 300);
  assert.equal(st.picked.length, 300);
  assert.equal(st.picked[0], 'x100');
  st = recordPick(st, { id: 'y', newRound: true });
  assert.deepEqual(st.picked, ['y']);
  assert.equal(st.last, 'y');
});

console.log('CSV class lists');
const names = (csv, opts) => namesFromRows(parseCSV(csv), opts).names;
test('one name per line, no header', () => {
  assert.deepEqual(names('Olivia Bennett\nJack Thompson\n'), ['Olivia Bennett', 'Jack Thompson']);
});
test('a "Name" header column, with other columns ignored', () => {
  assert.deepEqual(names('Student Name,Year,Email\nMia Patel,10,mia@x\nNoah Williams,10,noah@x'), ['Mia Patel', 'Noah Williams']);
});
test('first name and surname columns (school system export)', () => {
  assert.deepEqual(names('Student Code,Surname,Given Name,Year Level\n1001,Nguyen,Charlotte,10\n1002,Walker,Henry,10'), ['Charlotte Nguyen', 'Henry Walker']);
});
test('preferred name is used over legal first name, falling back to first name when blank', () => {
  assert.deepEqual(names('First Name,Preferred Name,Last Name\nAlexander,Alex,Ng\nKatherine,,Lee'), ['Alex Ng', 'Katherine Lee']);
});
test('a school export with code, surname, given and preferred name columns', () => {
  const csv = 'Student Code,Surname,Given Name,Preferred Name,Year Level\n20031,Nguyen,Charlotte,,10\n20044,"O\'Connor",William,Will,10';
  assert.deepEqual(names(csv), ['Charlotte Nguyen', "Will O'Connor"]);
  assert.equal(namesFromRows(parseCSV(csv)).columns, 'Preferred Name (or Given Name) + Surname');
});
test('only a preferred-name column (no separate first name) is used as the first name', () => {
  assert.deepEqual(names('Preferred Name,Surname\nAlex,Ng'), ['Alex Ng']);
});
test('quoted cells with commas and escaped quotes', () => {
  assert.deepEqual(names('Name\n"O\'Connor, Liam"\n"Jamie ""JJ"" Brown"'), ['Liam O\'Connor', 'Jamie "JJ" Brown']);
});
test('semicolon and tab separated files', () => {
  assert.deepEqual(names('First;Last\nZoe;Mitchell'), ['Zoe Mitchell']);
  assert.deepEqual(names('Given\tSurname\nKai\tNgata'), ['Kai Ngata']);
});
test('byte-order mark, Windows line endings, blank lines and duplicates', () => {
  assert.deepEqual(names('﻿Name\r\nAva Kowalski\r\n\r\nava kowalski\r\nRuby Harris\r\n'), ['Ava Kowalski', 'Ruby Harris']);
});
test('two columns without a header are first name then surname, and can be swapped', () => {
  assert.deepEqual(names('Grace,Taylor\nEthan,Clarke'), ['Grace Taylor', 'Ethan Clarke']);
  assert.deepEqual(names('Taylor,Grace\nClarke,Ethan', { swap: true }), ['Grace Taylor', 'Ethan Clarke']);
});
test('"Surname, First" in a single quoted cell is turned round', () => {
  assert.deepEqual(names('"Bennett, Olivia"\n"Thompson, Jack"'), ['Olivia Bennett', 'Jack Thompson']);
});
test('a line break inside quotes stays in one cell', () => {
  assert.deepEqual(parseCSV('Name,Note\n"Mia","line one\nline two"'), [['Name', 'Note'], ['Mia', 'line one\nline two']]);
});
test('reports which columns it used', () => {
  assert.equal(namesFromRows(parseCSV('Surname,Given Name\nA,B')).columns, 'Given Name + Surname');
  assert.equal(namesFromRows(parseCSV('Name\nA')).columns, 'Name');
  assert.equal(namesFromRows(parseCSV('Mia Patel')).columns, 'column 1');
});
test('heading spellings: first_name / last_name, FirstName / LastName, Forename / Family Name', () => {
  assert.deepEqual(names('id,first_name,last_name\n7,Ada,Lovelace'), ['Ada Lovelace']);
  assert.deepEqual(names('StudentID,LastName,FirstName\n7,Curie,Marie'), ['Marie Curie']);
  assert.deepEqual(names('Code,Family Name,Forename\n7,Franklin,Rosalind'), ['Rosalind Franklin']);
});
test('"Student" and "Pupil" headings are name columns, wherever they are', () => {
  assert.deepEqual(names('Student ID,Year,Student\n1001,10,Isaac Newton\n1002,10,Ada Lovelace'), ['Isaac Newton', 'Ada Lovelace']);
  assert.deepEqual(names('Year,Pupil Name\n10,Alan Turing'), ['Alan Turing']);
});
test('a "Last name, First name" column is turned round, and capitalised surnames are tidied', () => {
  assert.deepEqual(names('ID,"Last name, First name",Year\n1,"Curie, Marie",10\n2,"NEWTON, Isaac",10'), ['Marie Curie', 'Isaac Newton']);
  assert.deepEqual(names('Name (Last, First)\n"O\'CONNOR, Liam"\n"SMITH-JONES, Kate"'), ["Liam O'Connor", 'Kate Smith-Jones']);
});
test('parent, guardian, teacher and username columns are never used for names', () => {
  const csv = 'Parent First Name,Student First Name,Student Surname,Parent Surname,Teacher Name,Username\nJo,Ada,Lovelace,Byron,Ms Hill,alovelace';
  assert.deepEqual(names(csv), ['Ada Lovelace']);
  assert.equal(namesFromRows(parseCSV(csv)).columns, 'Student First Name + Student Surname');
});
test('no recognisable headings: finds the name column by its contents, not by position', () => {
  assert.deepEqual(names('1001,Isaac Newton,10A,inewton@school.edu\n1002,Ada Lovelace,10A,alovelace@school.edu'), ['Isaac Newton', 'Ada Lovelace']);
  assert.equal(namesFromRows(parseCSV('1001,Isaac Newton,10A')).columns, 'column 2');
  assert.deepEqual(names('1001,"Newton, Isaac",10\n1002,"Lovelace, Ada",10'), ['Isaac Newton', 'Ada Lovelace']);
  assert.deepEqual(names('1001,Isaac,Newton,10\n1002,Ada,Lovelace,10'), ['Isaac Newton', 'Ada Lovelace']);
});
test('an unrecognised heading row above a name column is skipped', () => {
  assert.deepEqual(names('Code,Who,Year\n1,Ada Lovelace,10\n2,Alan Turing,10'), ['Ada Lovelace', 'Alan Turing']);
});
test('an empty file gives no names', () => {
  assert.deepEqual(names(''), []);
  assert.deepEqual(names('\n\n'), []);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
