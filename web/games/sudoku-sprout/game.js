// =============================================================
//  Sudoku Sprout - game logic
//  PUZZLES (the puzzles for each level) comes from puzzles.js,
//  which index.html loads before this file.
// =============================================================

// ---------- Settings you can change ----------
// Does tapping "Give up" set the streak back to 0?
// true = yes (counts like a loss), false = no (streak is kept).
const GIVE_UP_ENDS_STREAK = true;

// Title on the "solved" panel (one is picked at random).
const WIN_TITLES = ["Puzzle solved!", "Well done!", "Wonderful!", "Great job!", "Your sprout grew!"];

// How many changes Undo can take back.
const UNDO_LIMIT = 100;

const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard", veryhard: "Very hard" };

// Where this game saves things on the phone.
const STATS_KEY = "ss-stats";     // played / solved / streak / best time for each level
const GAME_KEY = "ss-game";       // the puzzle in progress
const LEVEL_KEY = "ss-level";     // the level picked: "easy", "medium" or "hard"
const RECENT_KEY = "ss-recent";   // puzzles played lately, so they don't repeat soon
const SEEN_KEY = "ss-seen";       // has "How to play" been shown yet


// ---------- Saving to the phone ----------
function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Saving isn't available - the game still works, it just won't remember.
  }
}


// ---------- The grid: rows, columns and boxes ----------
// The grid size depends on the level:
//   4 x 4 (numbers 1-4, boxes 2 x 2), 6 x 6 (numbers 1-6, boxes 2 tall x 3 wide),
//   9 x 9 (numbers 1-9, boxes 3 x 3).
let N = 9;            // squares across (and the biggest number)
let BOX_ROWS = 3;     // how tall each box is
let BOX_COLS = 3;     // how wide each box is
let DIGITS = [];      // 1 to N
let PEERS = [];       // for each square, the squares in its row, column or box
const rowOf = (i) => Math.floor(i / N);
const colOf = (i) => i % N;
const boxOf = (i) => Math.floor(rowOf(i) / BOX_ROWS) * (N / BOX_COLS) + Math.floor(colOf(i) / BOX_COLS);
const sizeOf = (puzzle) => Math.round(Math.sqrt(puzzle.length));

function setSize(n) {
  N = n;
  BOX_ROWS = n === 9 ? 3 : 2;
  BOX_COLS = n === 4 ? 2 : 3;
  DIGITS = Array.from({ length: n }, (_, k) => k + 1);
  PEERS = [];
  for (let i = 0; i < n * n; i++) {
    PEERS[i] = [];
    for (let j = 0; j < n * n; j++) {
      if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) PEERS[i].push(j);
    }
  }
}

// Works out the answer to a puzzle (each puzzle has exactly one).
function solve(puzzle) {
  if (sizeOf(puzzle) !== N || PEERS.length !== N * N) setSize(sizeOf(puzzle));   // make sure the grid is set up for this size
  const g = puzzle.split("").map(Number);
  function options(i) {
    const used = new Set(PEERS[i].map((p) => g[p]));
    return DIGITS.filter((d) => !used.has(d));
  }
  function go() {
    let best = -1, bestOptions = null;
    for (let i = 0; i < N * N; i++) {
      if (g[i]) continue;
      const o = options(i);
      if (!bestOptions || o.length < bestOptions.length) { best = i; bestOptions = o; if (o.length <= 1) break; }
    }
    if (best < 0) return true;
    for (const d of bestOptions) { g[best] = d; if (go()) return true; }
    g[best] = 0;
    return false;
  }
  go();
  return g;
}


// ---------- Game state ----------
// state.level    - "easy", "medium" or "hard"
// state.puzzle   - the starting puzzle (16, 36 or 81 digits, 0 = empty)
// state.solution - the answer
// state.grid     - the numbers in each square now
// state.notes    - small reminder numbers in each square (a list of numbers per square)
// state.history  - earlier copies of grid + notes, for Undo
// state.elapsed  - time played, in milliseconds
// state.hints    - hints used
// state.done     - true once solved or given up
let state;
let stats = load(STATS_KEY, { played: 0, won: 0, streak: 0, best: {} });
if (!stats.best) stats.best = {};
let levelChoice = LEVEL_NAMES[load(LEVEL_KEY, "easy")] ? load(LEVEL_KEY, "easy") : "easy";
let selected = null;     // the square picked, 0-80
let notesMode = false;

function pickPuzzle(level) {
  const list = PUZZLES[level];
  const recent = load(RECENT_KEY, {});
  const seen = recent[level] || [];
  const fresh = list.map((p, n) => n).filter((n) => !seen.includes(n));
  const pool = fresh.length ? fresh : list.map((p, n) => n);
  const n = pool[Math.floor(Math.random() * pool.length)];
  recent[level] = seen.concat(n).slice(-Math.floor(list.length / 2));
  save(RECENT_KEY, recent);
  return list[n];
}

function newState(level) {
  const puzzle = pickPuzzle(level);
  setSize(sizeOf(puzzle));
  return {
    level,
    puzzle,
    solution: solve(puzzle),
    grid: puzzle.split("").map(Number),
    notes: Array.from({ length: puzzle.length }, () => []),
    history: [],
    elapsed: 0,
    hints: 0,
    done: false,
  };
}

function saveGame() {
  save(GAME_KEY, state);
}

const isGiven = (i) => state.puzzle[i] !== "0";
const isWrong = (i) => state.grid[i] !== 0 && state.grid[i] !== state.solution[i];
const touched = () => state.history.length > 0 || state.hints > 0;

function remember() {
  state.history.push({ grid: state.grid.slice(), notes: state.notes.map((n) => n.slice()) });
  if (state.history.length > UNDO_LIMIT) state.history.shift();
}


// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const board = $("board");
const boardWrap = $("boardWrap");
const pad = $("pad");
const message = $("msg");
const cells = [];
const numButtons = [];

let builtFor = 0;   // the grid size the squares and number buttons were made for

// Makes the squares and the number buttons for the current grid size.
function buildBoard() {
  if (builtFor === N) return;
  builtFor = N;
  board.innerHTML = "";
  cells.length = 0;
  board.style.setProperty("--n", N);
  board.className = `board n${N}`;
  for (let i = 0; i < N * N; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.i = i;
    board.appendChild(cell);
    cells.push(cell);
  }
  pad.innerHTML = "";
  numButtons.length = 0;
  pad.style.setProperty("--n", N);
  pad.className = `pad n${N}`;
  for (let d = 1; d <= N; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "num";
    b.textContent = d;
    b.dataset.d = d;
    pad.appendChild(b);
    numButtons.push(b);
  }
}


// ---------- Timer ----------
let lastTick = Date.now();

function timerRunning() {
  const panelOpen = !$("helpSheet").hidden || !$("giveUpSheet").hidden || !$("endSheet").hidden || Coins.isOpen();
  return state && !state.done && document.visibilityState === "visible" && !panelOpen;
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function tick() {
  const now = Date.now();
  // The clock ticks every second. A bigger gap means the phone paused the
  // game (another app, screen off), so that time doesn't count.
  const gap = now - lastTick;
  if (timerRunning() && gap > 0 && gap < 5000) state.elapsed += gap;
  lastTick = now;
  $("timer").textContent = formatTime(state.elapsed);
}

let ticks = 0;
setInterval(() => {
  tick();
  if (timerRunning() && ++ticks % 10 === 0) saveGame();   // moves save right away; the clock every 10 seconds
}, 1000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") lastTick = Date.now();   // back again: start counting from now
  tick();
  saveGame();
});


// ---------- Drawing the screen ----------
const sideways = matchMedia("(orientation: landscape) and (max-height: 540px)");

function fitBoard() {
  // Phone turned sideways: the board sits on the left, so it can use the
  // full height under the top bar. Otherwise it fills the space it's given.
  const space = sideways.matches
    ? document.querySelector(".app").clientHeight - document.querySelector("header").offsetHeight - 16
    : Math.min(boardWrap.clientWidth, boardWrap.clientHeight) - 4;
  const size = Math.max(180, Math.floor((space - 6) / N) * N + 6);   // whole-pixel squares, plus 6 for the border
  board.style.setProperty("--size", `${Math.min(size, 540)}px`);
}

function render() {
  buildBoard();
  fitBoard();
  const selValue = selected !== null ? state.grid[selected] : 0;
  for (let i = 0; i < N * N; i++) {
    const cell = cells[i];
    const v = state.grid[i];
    cell.className = "cell" +
      (colOf(i) === N - 1 ? " last-col" : colOf(i) % BOX_COLS === BOX_COLS - 1 ? " box-right" : "") +
      (rowOf(i) === N - 1 ? " last-row" : rowOf(i) % BOX_ROWS === BOX_ROWS - 1 ? " box-bottom" : "") +
      (isGiven(i) ? " given" : "") +
      (isWrong(i) ? " wrong" : "");
    if (selected !== null && !state.done) {
      if (i === selected) cell.classList.add("selected");
      else if (selValue && v === selValue) cell.classList.add("same");
      else if (PEERS[selected].includes(i)) cell.classList.add("peer");
    }
    if (v) {
      cell.textContent = v;
    } else if (state.notes[i].length) {
      cell.innerHTML = `<span class="notes" aria-hidden="true">${DIGITS
        .map((d) => `<span>${state.notes[i].includes(d) ? d : ""}</span>`).join("")}</span>`;
    } else {
      cell.textContent = "";
    }
    cell.setAttribute("aria-label", `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}: ` +
      (v ? `${v}${isGiven(i) ? "" : isWrong(i) ? ", not right" : ""}` :
        state.notes[i].length ? `empty, notes ${state.notes[i].join(" ")}` : "empty"));
  }

  // Numbers that are all placed correctly fade out
  for (let d = 1; d <= N; d++) {
    const placed = state.grid.filter((v, i) => v === d && !isWrong(i)).length;
    numButtons[d - 1].classList.toggle("done", placed >= N);
    numButtons[d - 1].setAttribute("aria-label", `${d}${placed >= N ? ", all placed" : ""}`);
  }

  pad.classList.toggle("notes-mode", notesMode);
  $("notesBtn").setAttribute("aria-pressed", notesMode);
  $("notesState").textContent = notesMode ? "On" : "Off";
  $("undoBtn").disabled = state.done || state.history.length === 0;
  $("eraseBtn").disabled = state.done;
  $("giveUpBtn").textContent = state.done ? "New puzzle" : "Give up";
  $("levelPick").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === levelChoice));
  tick();
}

function say(text) {
  message.textContent = text;
}

function showStreak() {
  $("streakNum").textContent = stats.streak;
}


// ---------- Playing ----------
function selectCell(i) {
  if (state.done) return;
  selected = i;
  if (isGiven(i)) say(`This ${state.grid[i]} came with the puzzle`);
  else say(notesMode ? "Notes are on: tap numbers to jot them down" : "Now tap a number below");
  render();
}

// Tapped a number on the pad
function enter(d) {
  if (state.done) return;
  if (selected === null) {
    say("Tap a square first, then a number");
    return;
  }
  if (isGiven(selected)) {
    say("That number came with the puzzle - pick an empty square");
    return;
  }
  const i = selected;

  if (notesMode) {
    if (state.grid[i]) {
      say("Erase the number first to add notes here");
      return;
    }
    remember();
    const notes = state.notes[i];
    state.notes[i] = notes.includes(d) ? notes.filter((n) => n !== d) : notes.concat(d).sort();
    say("");
    afterChange();
    return;
  }

  if (state.grid[i] === d) return;   // already there (a double tap shouldn't remove it - Erase does that)
  remember();
  {
    state.grid[i] = d;
    state.notes[i] = [];
    if (d === state.solution[i]) {
      // A right number: clear that number from the notes around it
      for (const p of PEERS[i]) state.notes[p] = state.notes[p].filter((n) => n !== d);
      say("");
    } else {
      say(`That ${d} can't be right here`);
    }
  }
  afterChange();
}

function erase() {
  if (state.done || selected === null) {
    if (!state.done) say("Tap a square first");
    return;
  }
  if (isGiven(selected)) {
    say("That number came with the puzzle");
    return;
  }
  if (!state.grid[selected] && !state.notes[selected].length) return;
  remember();
  state.grid[selected] = 0;
  state.notes[selected] = [];
  say("");
  afterChange();
}

function undo() {
  if (state.done || !state.history.length) return;
  const before = state.history.pop();
  state.grid = before.grid;
  state.notes = before.notes;
  say("Took back the last change");
  afterChange();
}

function afterChange() {
  saveGame();
  render();
  if (state.grid.every((v, i) => v === state.solution[i])) finish(true);
}

function toggleNotes() {
  if (state.done) return;
  notesMode = !notesMode;
  say(notesMode ? "Notes are on: tap numbers to jot small reminders" : "Notes are off");
  render();
}


// ---------- Hint button ----------
// Fills in the picked square if it's empty or wrong; otherwise the
// easiest empty square on the board.
function hint() {
  if (state.done) return;
  let i = selected;
  if (i === null || isGiven(i) || (state.grid[i] && !isWrong(i))) {
    const open = [];
    for (let k = 0; k < N * N; k++) if (state.grid[k] === 0 || isWrong(k)) open.push(k);
    if (!open.length) return;
    // the square with the fewest possible numbers is the easiest to see
    const choices = (k) => N - new Set(PEERS[k].map((p) => state.grid[p]).filter(Boolean)).size;
    open.sort((a, b) => choices(a) - choices(b));
    i = open[0];
  }
  if (!Coins.spend(Coins.HINT_COST, "hint")) return;   // a hint costs a coin
  remember();
  const d = state.solution[i];
  state.grid[i] = d;
  state.notes[i] = [];
  for (const p of PEERS[i]) state.notes[p] = state.notes[p].filter((n) => n !== d);
  state.hints++;
  selected = i;
  say(`Here's one: a ${d} goes here`);
  afterChange();
  if (!state.done) {
    cells[i].classList.remove("hinted");
    void cells[i].offsetWidth;   // restarts the animation
    cells[i].classList.add("hinted");
  }
}


// ---------- Level: Easy / Medium / Hard ----------
function chooseLevel(level) {
  if (!LEVEL_NAMES[level]) return;
  levelChoice = level;
  save(LEVEL_KEY, level);
  if (state.done || !touched()) {
    newGame();          // nothing done yet: switch right away
    return;
  }
  render();
  say(`Your next puzzle will be ${LEVEL_NAMES[level]}`);
}


// ---------- Give up button ----------
function askGiveUp() {
  if (state.done) {       // after a finished puzzle this button says "New puzzle"
    newGame();
    return;
  }
  tick();
  $("giveUpText").textContent = GIVE_UP_ENDS_STREAK
    ? "We'll fill in the answer. Your streak will go back to 0."
    : "We'll fill in the answer. Your streak stays the same.";
  $("giveUpSheet").hidden = false;
  $("giveUpNo").focus();
}

function giveUp() {
  $("giveUpSheet").hidden = true;
  remember();
  state.grid = state.solution.slice();
  finish(false, true);
}


// ---------- End of game ----------
function finish(won, gaveUp = false) {
  tick();
  state.done = true;
  selected = null;
  saveGame();

  stats.played++;
  let newBest = false;
  if (won) {
    stats.won++;
    stats.streak++;
    const best = stats.best[state.level];
    if (!state.hints && (!best || state.elapsed < best)) {   // best times only count without hints
      stats.best[state.level] = state.elapsed;
      newBest = true;
    }
  } else if (!gaveUp || GIVE_UP_ENDS_STREAK) {
    stats.streak = 0;
  }
  save(STATS_KEY, stats);
  showStreak();
  render();

  if (won) {
    say("Every square is filled - well done!");
    // a green wave across the board
    cells.forEach((cell, i) => {
      cell.style.animationDelay = `${(rowOf(i) + colOf(i)) * 0.05}s`;
      cell.classList.add("bloom");
    });
  } else {
    say("Here's the answer");
  }

  const finished = state;
  setTimeout(() => {
    if (state !== finished) return;   // a new puzzle was already started
    cells.forEach((cell) => { cell.classList.remove("bloom"); cell.style.animationDelay = ""; });
    const level = LEVEL_NAMES[state.level];
    $("endTitle").textContent = won ? WIN_TITLES[Math.floor(Math.random() * WIN_TITLES.length)] : "No worries";
    $("endText").textContent = won
      ? `You solved a${state.level === "easy" ? "n" : ""} ${level} puzzle in ${formatTime(state.elapsed)}` +
        (state.hints ? ` with ${state.hints} ${state.hints === 1 ? "hint" : "hints"}. Best times count puzzles solved without hints.` : ".")
      : "Here's a fresh puzzle whenever you're ready.";
    $("newBest").hidden = !newBest;
    $("sPlayed").textContent = stats.played;
    $("sWon").textContent = stats.won;
    $("sBest").textContent = stats.best[state.level] ? formatTime(stats.best[state.level]) : "-";
    $("sBestLabel").textContent = `Best ${level}`;
    $("endSheet").hidden = false;
    $("againBtn").focus();
  }, won ? 1600 : 300);
}

function newGame() {
  state = newState(levelChoice);
  selected = null;
  notesMode = false;
  $("endSheet").hidden = true;
  lastTick = Date.now();
  say(`New ${LEVEL_NAMES[state.level]} puzzle (${N}×${N}). Tap a square to start`);
  render();
  saveGame();
}


// ---------- Wiring up buttons ----------
board.addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (cell) selectCell(Number(cell.dataset.i));
});
pad.addEventListener("click", (e) => {
  const b = e.target.closest(".num");
  if (b) enter(Number(b.dataset.d));
});
$("levelPick").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) chooseLevel(b.dataset.v);
});

// A real keyboard works too: numbers, Backspace, arrow keys, and N for notes.
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") {
    if (!$("helpSheet").hidden) $("helpClose").click();
    else if (!$("giveUpSheet").hidden) $("giveUpNo").click();
    return;
  }
  if (!$("helpSheet").hidden || !$("giveUpSheet").hidden || !$("endSheet").hidden || Coins.isOpen()) return;
  if (/^[1-9]$/.test(e.key)) { if (Number(e.key) <= N) enter(Number(e.key)); }
  else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
  else if (e.key === "n" || e.key === "N") toggleNotes();
  else if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    if (selected === null) { selectCell(Math.floor(N / 2) * N + Math.floor(N / 2)); return; }   // start in the middle
    let r = rowOf(selected), c = colOf(selected);
    if (e.key === "ArrowUp") r = (r + N - 1) % N;
    if (e.key === "ArrowDown") r = (r + 1) % N;
    if (e.key === "ArrowLeft") c = (c + N - 1) % N;
    if (e.key === "ArrowRight") c = (c + 1) % N;
    selectCell(r * N + c);
  }
});

// House button: back to the list of games.
// The puzzle is saved on every move, so it can be picked up again later.
$("homeBtn").onclick = () => {
  tick();
  saveGame();
  if (history.length > 1) history.back();          // came from the home screen
  else location.href = "../../index.html";         // game was opened directly
};

$("hintBtn").onclick = hint;
$("undoBtn").onclick = undo;
$("eraseBtn").onclick = erase;
$("notesBtn").onclick = toggleNotes;
$("giveUpBtn").onclick = askGiveUp;
$("giveUpYes").onclick = giveUp;
$("giveUpNo").onclick = () => { $("giveUpSheet").hidden = true; lastTick = Date.now(); };
$("helpBtn").onclick = () => { tick(); $("helpSheet").hidden = false; $("helpClose").focus(); };
$("helpClose").onclick = () => { $("helpSheet").hidden = true; lastTick = Date.now(); save(SEEN_KEY, 1); };
$("againBtn").onclick = newGame;
$("viewBtn").onclick = () => { $("endSheet").hidden = true; say("Tap New puzzle at the top when you're ready"); };

// Keep the grid sized to the screen (e.g. when the phone is turned, or
// when the lettering finishes loading and the lines above the grid change height).
window.addEventListener("resize", () => render());
if ("ResizeObserver" in window) new ResizeObserver(() => { if (state) fitBoard(); }).observe(boardWrap);


// ---------- Start ----------
showStreak();

const savedGame = load(GAME_KEY, null);
const savedOk = savedGame && !savedGame.done && typeof savedGame.puzzle === "string" &&
  [16, 36, 81].includes(savedGame.puzzle.length) && /^[0-9]+$/.test(savedGame.puzzle) &&
  Array.isArray(savedGame.grid) && savedGame.grid.length === savedGame.puzzle.length && LEVEL_NAMES[savedGame.level];

if (savedOk) {
  state = savedGame;      // pick up where you left off
  // tidy up anything missing or odd in an older save
  state.solution = solve(state.puzzle);
  state.grid = state.grid.map((v, i) => (isGiven(i) ? Number(state.puzzle[i]) : Number(v) >= 1 && Number(v) <= N ? Number(v) : 0));
  if (!Array.isArray(state.notes) || state.notes.length !== N * N) state.notes = [];
  state.notes = Array.from({ length: N * N }, (_, i) => (Array.isArray(state.notes[i]) ? state.notes[i].map(Number).filter((d) => d >= 1 && d <= N) : []));
  if (!Array.isArray(state.history)) state.history = [];
  state.history = state.history.filter((h) => h && Array.isArray(h.grid) && h.grid.length === N * N && Array.isArray(h.notes) && h.notes.length === N * N);
  state.elapsed = Number.isFinite(state.elapsed) && state.elapsed >= 0 ? state.elapsed : 0;
  state.hints = Number.isFinite(state.hints) && state.hints >= 0 ? state.hints : 0;
  lastTick = Date.now();
  say("Welcome back - your puzzle is just as you left it");
  render();
} else {
  newGame();
}

// Show "How to play" the very first time.
if (!load(SEEN_KEY, 0)) $("helpSheet").hidden = false;
