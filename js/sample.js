/* Sample rooms + an example class shown on first load. */
const Sample = (() => {
  const SAMPLE_CLASS_NAME = 'Example: Year 10 Science', SAMPLE_TEACHER = 'Example teacher';
  // Grid squares are 0.5 m. Room B12 is 10 m × 9 m; Lab 3 is 13 m × 9 m with a prep-room cut-out.
  const RECT = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 18 }, { x: 0, y: 18 }];
  const PRESETS = {
    rectangle: { label: 'Rectangle', boundary: RECT },
    lab: { label: 'L-shape', boundary: [{ x: 0, y: 0 }, { x: 18, y: 0 }, { x: 18, y: 6 }, { x: 26, y: 6 }, { x: 26, y: 18 }, { x: 0, y: 18 }] },
  };

  function rooms() {
    return [
      {
        id: 'room_b12', name: 'Room B12', sample: true, scale: 0.5, showMetres: true,
        boundary: RECT.map(p => ({ ...p })),
        items: [
          { id: 'b12_board', type: 'board', x: 10, y: 0, lenM: 3.6 },
          { id: 'b12_teacher', type: 'teacher', x: 1, y: 1, rot: 0 },
          { id: 'b12_door', type: 'door', x: 0, y: 16, lenM: 0.9 },
          { id: 'b12_win1', type: 'window', x: 20, y: 5, lenM: 2.4 },
          { id: 'b12_win2', type: 'window', x: 20, y: 12, lenM: 2.4 },
          { id: 'b12_t1', type: 'group4', x: 3.5, y: 4, rot: 0 },
          { id: 'b12_t2', type: 'group4', x: 8.8, y: 4, rot: 0 },
          { id: 'b12_t3', type: 'group4', x: 14.1, y: 4, rot: 0 },
          { id: 'b12_t4', type: 'group4', x: 3.5, y: 9.5, rot: 0 },
          { id: 'b12_t5', type: 'group4', x: 8.8, y: 9.5, rot: 0 },
          { id: 'b12_t6', type: 'group4', x: 14.1, y: 9.5, rot: 0 },
          { id: 'b12_p1', type: 'pair', x: 3.5, y: 15, rot: 0 },
          { id: 'b12_p2', type: 'pair', x: 8.8, y: 15, rot: 0 },
          { id: 'b12_p3', type: 'pair', x: 14.1, y: 15, rot: 0, off: [1] },
        ],
      },
      {
        id: 'room_lab3', name: 'Lab 3', sample: true, scale: 0.5, showMetres: true,
        boundary: PRESETS.lab.boundary.map(p => ({ ...p })),
        items: [
          { id: 'l3_board', type: 'board', x: 9, y: 0, lenM: 3.6 },
          { id: 'l3_teacher', type: 'teacher', x: 14, y: 1, rot: 0 },
          { id: 'l3_door', type: 'door', x: 26, y: 15.5, lenM: 0.9 },
          { id: 'l3_win', type: 'window', x: 0, y: 9, lenM: 3 },
          // 2.4 m × 1.2 m double-sided island benches, 3 students a side (0.8 m each for practical work)
          { id: 'l3_b1', type: 'bench', x: 2, y: 4, lenM: 2.4, sides: { t: 3, b: 3 } },
          { id: 'l3_b2', type: 'bench', x: 9, y: 4, lenM: 2.4, sides: { t: 3, b: 3 } },
          { id: 'l3_b3', type: 'bench', x: 2, y: 10.5, lenM: 2.4, sides: { t: 3, b: 3 } },
          { id: 'l3_b4', type: 'bench', x: 9, y: 10.5, lenM: 2.4, sides: { t: 3, b: 3 } },
          { id: 'l3_b5', type: 'bench', x: 17, y: 10.5, lenM: 2.4, sides: { t: 3, b: 3 } },
          // 0.6 m-deep wall bench (sinks/fume cupboard side), no seats
          { id: 'l3_wall', type: 'bench', x: 2, y: 16.8, lenM: 4.8, sides: { t: 0, b: 0 } },
        ],
      },
    ];
  }

  // The example class is made of famous scientists, so nobody mistakes it for a real class list.
  // Keep-apart rules are famous rivalries (all historical figures); 'Subrahmanyan Chandrasekhar' tests long labels.
  const NAMES = ['Marie Curie', 'Isaac Newton', 'Rosalind Franklin', 'Gottfried Leibniz', 'Ada Lovelace', 'Charles Darwin',
    'Katherine Johnson', 'Nikola Tesla', 'Jane Goodall', 'Thomas Edison', 'Lise Meitner', 'Albert Einstein', 'Dorothy Hodgkin',
    'Niels Bohr', 'Rachel Carson', 'Galileo Galilei', 'Mae Jemison', 'Alan Turing', 'Grace Hopper', 'Stephen Hawking',
    'Hypatia of Alexandria', 'Michael Faraday', 'Barbara McClintock', 'Louis Pasteur', 'Subrahmanyan Chandrasekhar', 'Gregor Mendel',
    'Fiona Wood', 'Ernest Rutherford'];
  // The names the example class used before (realistic-sounding), so saved copies can be swapped over.
  const OLD_NAMES = ['Olivia Bennett', 'Jack Thompson', 'Charlotte Nguyen', 'Noah Williams', 'Mia Patel', "Liam O'Connor",
    'Amelia Brown', 'William Chen', 'Isla Robinson', 'Henry Walker', 'Ava Kowalski', 'Lucas Martin', 'Grace Taylor',
    'Thomas Wilson', 'Chloe Anderson', 'Oliver Singh', 'Zoe Mitchell', 'Ethan Clarke', 'Ruby Harris', 'Lachlan McDonald',
    'Sophie Tran', 'Cooper Jones', 'Matilda Evans', 'Archie Kelly', 'Alexandria Papadopoulos-Whitfield', 'Mason Wright', 'Evie Johnson', 'Kai Ngata'];

  function classes() {
    const students = NAMES.map((name, i) => ({ id: 'st' + (i + 1), name, front: false, lock: null }));
    const id = n => students.find(s => s.name.startsWith(n)).id;
    ['Rosalind', 'Galileo', 'Barbara', 'Dorothy'].forEach(n => { students.find(s => s.id === id(n)).front = true; });
    const apart = [['Isaac', 'Gottfried'], ['Thomas', 'Nikola'], ['Albert', 'Niels'], ['Alan', 'Michael', 'Hypatia'], ['Louis', 'Gregor'], ['Ernest', 'Lise']];
    const rules = apart.map((g, i) => ({ id: 'ra' + i, type: 'apart', members: g.map(id) }));
    rules.push({ id: 'rt0', type: 'together', members: [id('Katherine'), id('Grace')] });
    return [{
      id: 'class_10sci', name: SAMPLE_CLASS_NAME, roomId: 'room_b12', sample: true, teacher: SAMPLE_TEACHER, date: '', roomLabel: '',
      students, rules, adjacency: 'adjacent', fill: 'front', perspective: 'teacher', palette: 'pastel',
      plan: { assign: {} },
    }];
  }
  return { rooms, classes, PRESETS, NAMES, OLD_NAMES, CLASS_NAME: SAMPLE_CLASS_NAME, TEACHER: SAMPLE_TEACHER };
})();
if (typeof module !== 'undefined') module.exports = Sample;
