// =============================================================
//  Word Builder - game logic
//  PUZZLES (the list of puzzles) comes from puzzles.js,
//  which index.html loads before this file.
// =============================================================

// ---------- Settings you can change ----------
// How many letters each hidden word has, in the order the rows are shown.
const ROW_LENGTHS = [4, 4, 4, 5, 5, 6, 7];

// Does tapping "Give up" set the streak back to 0?
// true = yes (counts like a loss), false = no (streak is kept).
const GIVE_UP_ENDS_STREAK = true;

// Title on the "puzzle solved" panel (one is picked at random).
const WIN_TITLES = ["Puzzle solved!", "Well done!", "Wonderful!", "Great job!", "Splendid!"];

// Where this game saves things on the phone.
// (Different names from Word Garden, so the games don't mix up their stats.)
const STATS_KEY = "wb-stats";   // played / solved / streak
const GAME_KEY = "wb-game";     // the puzzle in progress
const NEXT_KEY = "wb-next";     // which puzzle comes next
const SEEN_KEY = "wb-seen";     // has "How to play" been shown yet


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


// ---------- Checking the puzzle list ----------
// Turns one line of puzzles.js into the rows shown on screen,
// or returns null if the line has a mistake (so it gets skipped).
function readPuzzle(line) {
  if (!Array.isArray(line) || line.length !== 7) return null;
  const words = line.map((w) => String(w).toLowerCase().trim());
  const [seven, six, fiveA, fiveB, fourA, fourB, fourC] = words;

  // Rows go shortest first, matching ROW_LENGTHS.
  const rows = [fourA, fourB, fourC, fiveA, fiveB, six, seven];

  // Every word must be the right length, all different,
  // and spelled only from the 7-letter word's letters.
  const available = countLetters(seven);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== ROW_LENGTHS[i]) return null;
    const needed = countLetters(rows[i]);
    for (const letter in needed) {
      if ((available[letter] || 0) < needed[letter]) return null;
    }
  }
  if (new Set(rows).size !== rows.length) return null;

  return { letters: seven, rows };
}

function countLetters(word) {
  const counts = {};
  for (const letter of word) counts[letter] = (counts[letter] || 0) + 1;
  return counts;
}

const GOOD_PUZZLES = PUZZLES.map(readPuzzle).filter(Boolean);


// ---------- Game state ----------
// state.number  - which puzzle this is (0 = the first line in puzzles.js)
// state.tiles   - the 7 letters, in the order they're shown (Mix changes it)
// state.picked  - which of those letters are in the word being spelled
// state.found   - true/false for each row
// state.hints   - how many letters the Hint button has shown in each row
// state.done    - true once the puzzle is solved or given up
// state.gaveUp  - true if she tapped "Give up"
let state;
let stats = load(STATS_KEY, { played: 0, won: 0, streak: 0 });

function shuffled(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function newState(number) {
  const puzzle = GOOD_PUZZLES[number];
  return {
    number,
    tiles: shuffled(puzzle.letters.split("")),
    picked: [],
    found: ROW_LENGTHS.map(() => false),
    hints: ROW_LENGTHS.map(() => 0),
    done: false,
    gaveUp: false,
  };
}

function puzzle() {
  return GOOD_PUZZLES[state.number];
}

function saveGame() {
  save(GAME_KEY, state);
}


// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const board = $("board");
const entry = $("entry");
const lettersBox = $("letters");
const message = $("msg");


// ---------- Drawing the screen ----------
function render() {
  saveGame();
  drawBoard();
  drawEntry();
  drawLetters();
}

// The rows of boxes for the hidden words.
function drawBoard() {
  board.innerHTML = "";
  puzzle().rows.forEach((word, r) => {
    const row = document.createElement("div");
    row.className = "word-row";
    row.dataset.row = r;

    for (let i = 0; i < word.length; i++) {
      const box = document.createElement("div");
      box.className = "box";

      if (state.found[r]) {
        box.textContent = word[i];
        box.classList.add("found");
      } else if (state.gaveUp) {
        box.textContent = word[i];
        box.classList.add("missed");
      } else if (i < state.hints[r]) {
        box.textContent = word[i];
        box.classList.add("hinted");
      }
      row.appendChild(box);
    }
    board.appendChild(row);
  });
}

// The word she is spelling right now.
function drawEntry() {
  entry.innerHTML = "";
  if (state.picked.length === 0) {
    const hint = document.createElement("span");
    hint.className = "entry-hint";
    hint.textContent = state.done ? "" : "Tap letters below to spell a word";
    entry.appendChild(hint);
    return;
  }
  for (const i of state.picked) {
    const letter = document.createElement("span");
    letter.className = "entry-letter";
    letter.textContent = state.tiles[i];
    entry.appendChild(letter);
  }
}

// The 7 letter buttons.
function drawLetters() {
  lettersBox.innerHTML = "";
  state.tiles.forEach((letter, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "letter";
    button.textContent = letter;
    button.dataset.i = i;
    if (state.picked.includes(i)) button.classList.add("used");
    lettersBox.appendChild(button);
  });
}

function say(text) {
  message.textContent = text;
}

function showStreak() {
  $("streakNum").textContent = stats.streak;
}

function shakeEntry() {
  entry.classList.remove("shake");
  void entry.offsetWidth; // restarts the animation
  entry.classList.add("shake");
}

function bounceRow(r) {
  const row = board.querySelector(`[data-row="${r}"]`);
  if (row) row.classList.add("just");
}

function upper(word) {
  return word.toUpperCase();
}


// ---------- Tapping letters and buttons ----------
function tapLetter(i) {
  if (state.done || state.picked.includes(i)) return;
  state.picked.push(i);
  render();
}

function deleteLetter() {
  if (state.done) return;
  state.picked.pop();
  render();
}

function mixLetters() {
  if (state.done) return;
  state.picked = [];
  state.tiles = shuffled(state.tiles);
  render();
}

function enterWord() {
  if (state.done) return;
  const word = state.picked.map((i) => state.tiles[i]).join("");

  if (word.length < 4) {
    say("Words have at least 4 letters");
    shakeEntry();
    return;
  }

  const r = puzzle().rows.indexOf(word);

  if (r === -1) {
    say(`${upper(word)} isn't one of the hidden words`);
    shakeEntry();
    // Clear it after the shake so she can try again.
    setTimeout(() => { state.picked = []; render(); }, 600);
    return;
  }

  state.picked = [];
  if (state.found[r]) {
    say(`You already found ${upper(word)}`);
    render();
    return;
  }

  state.found[r] = true;
  render();
  bounceRow(r);

  if (state.found.every(Boolean)) {
    finish(true);
  } else {
    const left = state.found.filter((f) => !f).length;
    say(`Nice! ${upper(word)} - ${left} to go`);
  }
}


// ---------- Hint button ----------
// Shows the next letter of the shortest word she hasn't found yet.
function hint() {
  if (state.done) return;
  const r = state.found.findIndex((f) => !f);
  if (r === -1) return;

  state.hints[r]++;
  const word = puzzle().rows[r];

  // If the hints spelled the whole word, count it as found.
  if (state.hints[r] >= word.length) {
    state.found[r] = true;
    render();
    bounceRow(r);
    if (state.found.every(Boolean)) finish(true);
    else say(`That was ${upper(word)}`);
    return;
  }

  render();
  say(`A ${word.length}-letter word starts with ${upper(word.slice(0, state.hints[r]))}`);
}


// ---------- Give up button ----------
// Step 1: ask first.
function askGiveUp() {
  if (state.done) return;
  $("giveUpText").textContent = GIVE_UP_ENDS_STREAK
    ? "We'll show you the words you haven't found. Your streak will go back to 0."
    : "We'll show you the words you haven't found. Your streak stays the same.";
  $("giveUpSheet").hidden = false;
  $("giveUpNo").focus();
}

// Step 2: she tapped "Show me the words".
function giveUp() {
  $("giveUpSheet").hidden = true;
  finish(false, true);
}


// ---------- End of puzzle ----------
function finish(won, gaveUp = false) {
  const missed = puzzle().rows.filter((w, r) => !state.found[r]);

  state.done = true;
  state.gaveUp = gaveUp;
  state.picked = [];
  render();

  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
  } else if (!gaveUp || GIVE_UP_ENDS_STREAK) {
    stats.streak = 0;
  }
  save(STATS_KEY, stats);
  showStreak();

  say(won ? "You found them all!" : "Here are the words");

  // Short pause so she sees the board before the panel slides up.
  setTimeout(() => {
    const total = puzzle().rows.length;
    $("endTitle").textContent = won
      ? WIN_TITLES[Math.floor(Math.random() * WIN_TITLES.length)]
      : "No worries";
    $("endText").textContent = won
      ? `You found all ${total} words.`
      : `You found ${total - missed.length} of ${total}. The ones you missed:`;
    $("endWords").textContent = won ? "" : missed.map(upper).join(", ");
    $("endWords").hidden = won;
    $("sPlayed").textContent = stats.played;
    $("sWon").textContent = stats.won;
    $("sStreak").textContent = stats.streak;
    $("endSheet").hidden = false;
    $("nextBtn").focus();
  }, gaveUp ? 300 : 1000);
}

// Start the next puzzle in the list (back to the first after the last one).
function nextPuzzle() {
  const number = load(NEXT_KEY, 0) % GOOD_PUZZLES.length;
  save(NEXT_KEY, (number + 1) % GOOD_PUZZLES.length);
  state = newState(number);
  $("endSheet").hidden = true;
  showStart();
  render();
}

function showStart() {
  say(`Puzzle ${state.number + 1} of ${GOOD_PUZZLES.length}. Find all 7 words.`);
}


// ---------- Wiring up buttons ----------
lettersBox.addEventListener("click", (e) => {
  const button = e.target.closest(".letter");
  if (button) tapLetter(Number(button.dataset.i));
});

$("mixBtn").onclick = mixLetters;
$("deleteBtn").onclick = deleteLetter;
$("enterBtn").onclick = enterWord;

// A real keyboard works too (handy when testing on a computer).
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Enter") enterWord();
  else if (e.key === "Backspace") deleteLetter();
  else if (/^[a-z]$/i.test(e.key)) {
    // Use the first matching letter that isn't already used.
    const letter = e.key.toLowerCase();
    const i = state.tiles.findIndex((t, n) => t === letter && !state.picked.includes(n));
    if (i !== -1) tapLetter(i);
  }
});

// House button: back to the list of games.
// The puzzle is saved on every move, so she can pick it up again later.
$("homeBtn").onclick = () => {
  if (history.length > 1) history.back();          // came from the home screen
  else location.href = "../../index.html";         // game was opened directly
};

$("hintBtn").onclick = hint;
$("giveUpBtn").onclick = askGiveUp;
$("giveUpYes").onclick = giveUp;
$("giveUpNo").onclick = () => { $("giveUpSheet").hidden = true; };
$("helpBtn").onclick = () => { $("helpSheet").hidden = false; $("helpClose").focus(); };
$("helpClose").onclick = () => { $("helpSheet").hidden = true; save(SEEN_KEY, 1); };
$("nextBtn").onclick = nextPuzzle;


// ---------- Start ----------
showStreak();

const savedGame = load(GAME_KEY, null);
// Only resume if that puzzle still exists with the same letters
// (puzzles.js might have been edited since).
const stillSame = savedGame && GOOD_PUZZLES[savedGame.number] &&
  savedGame.tiles.slice().sort().join("") === GOOD_PUZZLES[savedGame.number].letters.split("").sort().join("");
if (stillSame && !savedGame.done) {
  state = savedGame;      // pick up where she left off
  state.picked = [];
  showStart();
  render();
} else {
  nextPuzzle();
}

// Show "How to play" the very first time.
if (!load(SEEN_KEY, 0)) $("helpSheet").hidden = false;
