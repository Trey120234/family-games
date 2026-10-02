// =============================================================
//  Word Garden - game logic
//  WORDS (the list of secret words) comes from words.js,
//  which index.html loads before this file.
// =============================================================

// ---------- Settings you can change ----------
const WORD_LENGTH = 5;   // letters per word (words.js must match)
const MAX_GUESSES = 6;   // number of tries

// Keyboard layout. "E" = Enter key, "⌫" = Delete key.
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "⌫zxcvbnmE"];

// Encouraging messages shown after a wrong guess (picked in turn).
const KEEP_GOING_MESSAGES = ["Keep going!", "Good try!", "You're getting closer", "Nice guess!"];

// Title on the "you won" panel, based on how many tries it took.
const WIN_TITLES = ["Brilliant!", "Wonderful!", "Splendid!", "Great job!", "Phew, got it!", "Just in time!"];

// Does tapping "Give up" set the streak back to 0?
// true = yes (counts like a loss), false = no (streak is kept).
const GIVE_UP_ENDS_STREAK = true;


// ---------- Saving to the phone ----------
// The phone remembers stats and the game in progress, even after the app closes.
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


// ---------- Game state ----------
// state.answer  - the secret word
// state.rows    - guesses already entered, e.g. ["plant", "stone"]
// state.current - letters typed so far for the next guess
// state.done    - true once the game is won or lost
// state.hints   - letter positions already revealed by the Hint button
let state;
let stats = load("wg-stats", { played: 0, won: 0, streak: 0 });

function newState() {
  return {
    answer: WORDS[Math.floor(Math.random() * WORDS.length)],
    rows: [],
    current: "",
    done: false,
    hints: [],
  };
}

function saveGame() {
  save("wg-game", state);
}


// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const board = $("board");
const keyboard = $("kb");
const message = $("msg");


// ---------- Building the screen ----------
function buildBoard() {
  board.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function buildKeyboard() {
  keyboard.innerHTML = "";
  for (const line of KEYBOARD_ROWS) {
    const row = document.createElement("div");
    row.className = "krow";

    for (const ch of line) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "k";

      if (ch === "E") {
        button.textContent = "Enter";
        button.classList.add("wide");
        button.dataset.k = "enter";
      } else if (ch === "⌫") {
        button.textContent = "⌫";
        button.classList.add("wide", "del");
        button.dataset.k = "back";
        button.setAttribute("aria-label", "Delete letter");
      } else {
        button.textContent = ch;
        button.dataset.k = ch;
      }
      row.appendChild(button);
    }
    keyboard.appendChild(row);
  }
}


// ---------- Checking a guess ----------
// Returns a color for each letter: "green", "gold" or "gray".
function scoreGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("gray");
  const unmatched = {}; // letters in the answer not yet matched green

  // First pass: exact matches.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "green";
    } else {
      unmatched[answer[i]] = (unmatched[answer[i]] || 0) + 1;
    }
  }
  // Second pass: right letter, wrong spot.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] !== "green" && unmatched[guess[i]]) {
      result[i] = "gold";
      unmatched[guess[i]]--;
    }
  }
  return result;
}


// ---------- Drawing the current state ----------
function render() {
  saveGame();

  // Tiles
  for (let r = 0; r < MAX_GUESSES; r++) {
    const guess = state.rows[r];
    const word = guess || (r === state.rows.length ? state.current : "");
    const colors = guess ? scoreGuess(guess, state.answer) : null;
    const tiles = board.children[r].children;

    for (let c = 0; c < WORD_LENGTH; c++) {
      const letter = word[c] || "";
      tiles[c].textContent = letter;
      tiles[c].className = "tile" + (letter ? " filled" : "") + (colors ? " " + colors[c] : "");
    }
  }

  // Keyboard colors: each key shows the best result that letter has had.
  const rank = { green: 3, gold: 2, gray: 1 };
  const best = {};
  for (const guess of state.rows) {
    scoreGuess(guess, state.answer).forEach((color, i) => {
      const letter = guess[i];
      if (!best[letter] || rank[color] > rank[best[letter]]) best[letter] = color;
    });
  }
  keyboard.querySelectorAll(".k").forEach((button) => {
    button.classList.remove("green", "gold", "gray");
    const color = best[button.dataset.k];
    if (color) button.classList.add(color);
  });
}

function say(text) {
  message.textContent = text;
}

// Shows the current win streak in the box at the top.
function showStreak() {
  $("streakNum").textContent = stats.streak;
}

function shakeRow() {
  const row = board.children[state.rows.length];
  row.classList.remove("shake");
  void row.offsetWidth; // restarts the animation
  row.classList.add("shake");
}


// ---------- Key presses ----------
function press(key) {
  if (state.done) return;

  if (key === "enter") {
    if (state.current.length < WORD_LENGTH) {
      say(`Fill in all ${WORD_LENGTH} letters first`);
      shakeRow();
      return;
    }
    const guess = state.current;
    state.rows.push(guess);
    state.current = "";
    render();

    if (guess === state.answer) finish(true);
    else if (state.rows.length === MAX_GUESSES) finish(false);
    else say(KEEP_GOING_MESSAGES[state.rows.length % KEEP_GOING_MESSAGES.length]);

  } else if (key === "back") {
    state.current = state.current.slice(0, -1);
    render();

  } else if (state.current.length < WORD_LENGTH) {
    state.current += key;
    render();
  }
}


// ---------- Hint button ----------
// Reveals one letter she hasn't found yet.
function hint() {
  if (state.done) return;

  const known = new Set(state.hints);
  for (const guess of state.rows) {
    scoreGuess(guess, state.answer).forEach((color, i) => {
      if (color === "green") known.add(i);
    });
  }
  const open = [];
  for (let i = 0; i < WORD_LENGTH; i++) if (!known.has(i)) open.push(i);

  if (open.length === 0) {
    say("You already have every letter!");
    return;
  }
  const i = open[Math.floor(Math.random() * open.length)];
  state.hints.push(i);
  saveGame();
  say(`Letter ${i + 1} is "${state.answer[i].toUpperCase()}"`);
}


// ---------- Give up button ----------
// Step 1: ask first.
function askGiveUp() {
  if (state.done) return;
  $("giveUpText").textContent = GIVE_UP_ENDS_STREAK
    ? "We'll show you the word and start a new one. Your streak will go back to 0."
    : "We'll show you the word and start a new one. Your streak stays the same.";
  $("giveUpSheet").hidden = false;
  $("giveUpNo").focus();
}

// Step 2: she tapped "Show me the word".
function giveUp() {
  $("giveUpSheet").hidden = true;
  finish(false, true);
}


// ---------- End of game ----------
// won    - true if she found the word
// gaveUp - true if she tapped "Give up"
function finish(won, gaveUp = false) {
  state.done = true;
  saveGame();

  stats.played++;
  if (won) {
    stats.won++;
    stats.streak++;
  } else if (!gaveUp || GIVE_UP_ENDS_STREAK) {
    stats.streak = 0;
  }
  save("wg-stats", stats);
  showStreak();

  if (won) say("You got it!");
  else if (gaveUp) say("Here's the word");
  else say("So close!");

  // Short pause so she sees the colors before the panel slides up.
  // No pause when she gave up - she asked to see the word.
  setTimeout(() => {
    const tries = state.rows.length;
    $("endTitle").textContent = won ? WIN_TITLES[tries - 1] : gaveUp ? "No worries" : "Good game";
    $("endText").textContent = won
      ? `You found the word in ${tries} ${tries === 1 ? "try" : "tries"}.`
      : "The word was:";
    $("endWord").textContent = state.answer;
    $("sPlayed").textContent = stats.played;
    $("sWon").textContent = stats.won;
    $("sStreak").textContent = stats.streak;
    $("endSheet").hidden = false;
    $("againBtn").focus();
  }, gaveUp ? 0 : 900);
}

function newGame() {
  state = newState();
  $("endSheet").hidden = true;
  say(`Guess the ${WORD_LENGTH}-letter word`);
  render();
}


// ---------- Wiring up buttons ----------
keyboard.addEventListener("click", (e) => {
  const button = e.target.closest(".k");
  if (button) press(button.dataset.k);
});

// A real keyboard works too (handy when testing on a computer).
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Enter") press("enter");
  else if (e.key === "Backspace") press("back");
  else if (/^[a-z]$/i.test(e.key)) press(e.key.toLowerCase());
});

// House button: back to the list of games.
// The game is saved on every move, so she can pick it up again later.
$("homeBtn").onclick = () => {
  if (history.length > 1) history.back();          // came from the home screen
  else location.href = "../../index.html";         // game was opened directly
};

$("hintBtn").onclick = hint;
$("giveUpBtn").onclick = askGiveUp;
$("giveUpYes").onclick = giveUp;
$("giveUpNo").onclick = () => { $("giveUpSheet").hidden = true; };
$("helpBtn").onclick = () => { $("helpSheet").hidden = false; $("helpClose").focus(); };
$("helpClose").onclick = () => { $("helpSheet").hidden = true; save("wg-seen", 1); };
$("againBtn").onclick = newGame;


// ---------- Start ----------
buildBoard();
buildKeyboard();
showStreak();

const savedGame = load("wg-game", null);
state = savedGame && !savedGame.done ? savedGame : newState();
// Games saved by version 1.0 used "cur" instead of "current".
if (typeof state.current !== "string") state.current = state.cur || "";
render();

// Show "How to play" the very first time.
if (!load("wg-seen", 0)) $("helpSheet").hidden = false;
