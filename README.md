<img src="brand/classcrate-logo.png" alt="ClassCrate" width="360">

# ClassCrate

Classroom tools for teachers, organised by class: pick a class, then use its
**seating plan**, **groups**, **random picker**, **lesson timer**, **noise
meter** or **home learning** tracker. Everything runs in the browser with no build step and no server.
It's live at **https://classcrate.au**, published from this repository's
`main` branch with GitHub Pages (the `CNAME` file holds the domain). You can
also serve it from any static host, or open `index.html` straight from disk.

**Example class:** a first visit opens with "Example: Year 10 Science", whose
students are famous scientists (Marie Curie, Isaac Newton, Ada Lovelace…), so
it can't be mistaken for a real class list. It is labelled **Example** on its
card and in the class, and can be deleted from its ⋮ menu or with
**Backup & data → Clear sample data**.

**Privacy:** class lists, rules, plans and groups are stored only in this
browser's `localStorage`. The only network requests are to Google Fonts (Figtree
and Poppins), which carry no student data. Use **☰ Data → Export backup** to
save a JSON file and **Import…** to load it on another computer. Import can
merge with what's already there or replace it. The noise meter listens to the
microphone only while its tab is open and switched on, and the sound never leaves the
browser.

## How it's organised

- **Your classes** (home): one card per class; click a card to open it, or
  use its **⋮** menu to rename, change the icon, duplicate or delete it. The
  **＋** button (top right) creates a class: name, colour, room, and
  optionally the students and rules copied from another class. It can also
  import a backup. The left rail
  lists every class and collapses to icons with the **☰** button.
- **Class icons**: 50 subject icons. Each class gets one automatically from
  its name ("12CHEM", "Year 9 Maths", "Physical Education", "Japanese"…), and
  you can pick a different one, and the class colour, under **Students → Colour & icon** or the card's ⋮ menu.
- **Getting started**: the Classes page shows a three-step guide (create a
  class, add students, draw your room). Each step points at the control to use
  and ticks itself off. Once all three are done, or if you press **Hide**, it
  moves out of the way to **Getting started** at the bottom of the side menu,
  which brings it back.
- **Students & rules**: the class list, front-priority students and the
  **keep apart** / **keep together** rules. Seating plans and groups both use
  these rules. **Import CSV…** reads a class list exported from a school system
  (it finds the preferred/first name, surname or full-name columns, and can
  swap "Surname, First"); you can add the names or replace the class.
- **Seating plan**: **Generate** or **Shuffle**. Drag names to swap seats or
  to unseat someone. Tap a name to lock it to its seat. Then **Print A4**,
  **PNG** or **PDF**. **Edit room** opens the class's room layout.
- **Groups**: choose a group size or a number of groups, then
  **Make groups**. Groups come out as even as possible and follow the
  keep-apart/together rules (you can switch this off). Tap a name, then
  another name to swap them, or tap a group to move them there. **Copy** puts
  the groups on the clipboard as text. **Mix up partners** steers new groups
  away from pairs who worked together recently. Each new set goes into
  **Recent groupings** (last 12), and **Save** keeps a set under a name such as
  "Prac groups" to bring back later.
- **Random picker** (cold calling): **Pick someone** or press `Space`; a reel
  of names spins and lands on someone. By
  default nobody is picked twice until everyone has had a turn, and the same
  person is never picked twice in a row.
- **Timer** (its own tab): a large lesson timer with presets from 1 to 15
  minutes, ± a minute, and an optional chime. `Space` starts and pauses it.
  It keeps running on other tabs, where a chip in the top bar shows the time
  left; click the chip to go back to it.
- **Noise meter** (its own tab): a large ball pit that bounces with the room's
  noise level. Set the limit and the sensitivity; if it stays over the limit
  for a second the page turns red and says so. It shows how long the room has
  been calm. It uses the microphone only while you're on its tab: leaving
  the tab, switching browser tabs or minimising the window switches the
  microphone off until you press **Start listening** again.
- **Home learning**: add a task with a due date, then tap each student's cell
  to cycle *handed in → late → excused → not in*. After the due date, anyone
  not in shows as missing. Each student's hand-in rate is shown, and a task's
  ⋮ menu copies who hasn't handed it in, or marks everyone else as in.
- **Display mode** (screen icon, top right, inside a class): for the
  projector. It hides the menus and editing controls, makes names, the picker,
  timer and groups much larger, and goes full screen. `Esc` or **Exit display
  mode** leaves it.
- **Here today**: on Groups and Random picker, tap a name to mark them absent.
  Absent students are left out of new groups and never picked.
- **Rooms** (side menu): room layouts are shared by all classes. Draw the walls
  (rectangle, L-shape or your own polygon), then drag furniture on from the
  palette. Tap a seat to mark it unavailable. Each seat shows its distance
  from the board.

Shortcuts (Rooms): `R` rotates, `Del` deletes, `Ctrl/⌘+D` duplicates, and the
arrow keys nudge. `Shift` while drawing walls turns off snapping. Undo and
redo (`Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z`) work everywhere.

Data saved by the earlier Seating Planner, Class Toolkit, Classbeat or ClassPost (same browser, same
site) loads as-is, so existing classes, rooms and plans carry over. Backups
made by either load with **Import…**.

## Files

```
  index.html          markup only; loads the CSS and scripts below in order
  css/app.css         all styles
  js/core.js          seating solver and room geometry (no DOM)
  js/tools.js         group maker, picker and CSV parsing (no DOM)
  js/sample.js        the example class (famous scientists) and sample rooms
  js/icons.js         the 50 subject icons
  js/app/state.js     data, saving, undo/redo, dialogs, top-level render
  js/app/home.js      Classes page, side menu, new-class dialog, menus
  js/app/rooms.js     room editor
  js/app/students.js  students, rules, CSV import
  js/app/plan.js      seating plan, printing, PNG/PDF
  js/app/groups.js    groups, history, saved sets
  js/app/picker.js    random picker
  js/app/classtools.js  lesson timer and noise meter
  js/app/homelearning.js  home learning tracker
  js/app/present.js   display mode
  js/app/guide.js     getting-started guide
  js/app/data.js      backup export/import
  js/app/main.js      keyboard shortcuts and start-up
  tests/              Node tests for core.js and tools.js
  brand/              logo, favicon, home-screen icon
```

The scripts are plain `<script>` files (no modules) so the page also works when
opened from disk; they share one global scope and must load in the order in
`index.html`. `core.js` and `tools.js` have no DOM code and also export
themselves for Node, which is what the tests use.

## How the seating solver works

- **Seat conflicts.** Two seats conflict if they are at the same table. In
  "adjacent" mode they also conflict if they are within 3 grid squares
  (≈1.5 m) at a neighbouring table.
- **Placement order.** Locked students are placed first. A backtracking search
  with forward checking then seats front-priority students, trying the seats
  closest to the board first. Everyone else is seated "fewest remaining options
  first", in random order.
- **Filling from the front.** Only the N front-most seats are used at first.
  The search widens to seats further back only if the rules need more space.
  If it doesn't find an arrangement within a node limit, it restarts with a new
  random order.
- **Impossible rule sets.** Pre-checks catch the clear-cut cases, such as
  locked students who break a rule, or a group bigger than the number of
  tables. Otherwise the solver finds the smallest set of rules that can't all
  be satisfied, names those rules, and still shows a best-effort plan with the
  broken rules marked.

## Tests

```
node tests/solver.test.mjs
node tests/tools.test.mjs
```

`solver.test.mjs` checks the seating solver in `js/core.js`:

- a 28-student class with 6 keep-apart rules and 4 front-priority students
  (300 random seeds in each adjacency mode);
- locked seats and keep-together rules;
- empty seats being left at the back;
- several impossible rule sets;
- more students than seats;
- furniture placement inside L-shaped and lab rooms.

`tools.test.mjs` checks the group maker, picker and CSV import in
`js/tools.js` (using a seeded random number generator so failures repeat):

- groups always use every student exactly once with sizes at most one apart,
  for every class size 1–40 and group count up to 12;
- the sample class follows every rule over 200 seeds, and 300 random rule sets
  are followed whenever an exhaustive search shows that's possible; impossible
  and contradictory rules are reported, not hidden;
- **Mix up partners** cuts repeat pairings to under a quarter;
- the picker never repeats within a round, never picks the same person twice
  in a row (20,000 picks), never picks an absent student, and picks everyone
  equally often;
- CSV files with commas, tabs or semicolons, quoted fields, header rows, a
  byte-order mark, and blank preferred names.

## Branding

The logo is an open teal crate with a notebook, ruler and pencil inside, next to
the wordmark "Class" in navy `#0a1c3f` and "Crate" in teal `#1f9488`. `brand/`
holds:

- `classcrate-logo.svg`: the open crate on its own (used in the top bar, where
  it is drawn inline in `index.html`);
- `classcrate-icon.svg`: the matching closed crate, for small sizes where the
  open one would be too busy;
- `classcrate-logo.png`: the crate with the wordmark, for this README;
- `favicon.png` and `apple-touch-icon.png`: the closed crate for the browser tab
  and the home-screen icon.

The crate's colours: box `#2fa89c` (sides and lid are the same teal, shaded
darker), notebook navy `#1d3a6e`, ruler `#f8c33c`, pencil `#ff6b57`. Buttons,
links and the selected tab use a slightly deeper teal, `#178276`, so they read
clearly as text.

Each class gets one of six class colours at random when it's created (blue
`#016df8`, green `#04af4f`, red `#fa3e42`, orange `#fa6002`, yellow `#fab001`,
teal `#01aab5`; no repeats until all six are used) and can be changed under
**Colour & icon**.
