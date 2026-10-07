// =============================================================
//  Word Garden - game logic
//  WORDS (the lists of secret words) comes from words.js,
//  which index.html loads before this file.
// =============================================================

// ---------- Settings you can change ----------
// Tries for each word length. Longer words get more tries.
const TRIES = { 4: 5, 5: 6, 6: 7 };

// Keyboard layout. "E" = Enter key, "⌫" = Delete key.
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "⌫zxcvbnmE"];

// Title on the "you won" panel, picked at random.
const WIN_TITLES = ["Your garden bloomed!", "Wonderful!", "Splendid!", "Great job!", "What a garden!"];

// Does tapping "Give up" set the streak back to 0?
// true = yes (counts like a loss), false = no (streak is kept).
const GIVE_UP_ENDS_STREAK = true;

// Where this game saves things on the phone.
const STATS_KEY = "wg-stats";   // played / won / streak
const GAME_KEY = "wg-game";     // the word in progress
const LENGTH_KEY = "wg-len";    // her choice: "4", "5", "6" or "mix"
const SEEN_KEY = "wg-seen";     // has "How to play" been shown yet


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
// state.n       - how many letters this word has (4, 5 or 6)
// state.answer  - the secret word
// state.rows    - guesses already planted, e.g. ["plant", "stone"]
// state.current - letters typed so far for the next guess
// state.done    - true once the game is won or lost
// state.hints   - letter positions already revealed by the Hint button
let state;
let stats = load(STATS_KEY, { played: 0, won: 0, streak: 0 });
let lengthChoice = String(load(LENGTH_KEY, "5"));

// The word list for one length, skipping any word that's the wrong length.
function wordsOfLength(n) {
  return (WORDS[n] || []).map((w) => String(w).toLowerCase().trim()).filter((w) => w.length === n && /^[a-z]+$/.test(w));
}

function pickLength() {
  if (lengthChoice === "mix") {
    const lengths = [4, 5, 6];
    return lengths[Math.floor(Math.random() * lengths.length)];
  }
  return Number(lengthChoice) || 5;
}

function newState() {
  const n = pickLength();
  const list = wordsOfLength(n);
  return {
    n,
    answer: list[Math.floor(Math.random() * list.length)],
    rows: [],
    current: "",
    done: false,
    hints: [],
  };
}

function saveGame() {
  save(GAME_KEY, state);
}

const maxTries = () => TRIES[state.n] || 6;


// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const bed = $("bed");
const historyBox = $("history");
const keyboard = $("kb");
const message = $("msg");


// ---------- Drawings ----------
// Each pot is drawn on a 60 x 96 grid. The plant is drawn first,
// then the pot on top, so the stem looks like it comes out of the soil.
const POT =
  `<path d="M10 80 L50 80 L45.5 95 L14.5 95Z" fill="var(--pot)"/>` +                          // pot body
  `<path d="M39 80 L50 80 L45.5 95 L37 95Z" fill="var(--pot-shade)" opacity="0.6"/>` +        // shadow side
  `<path d="M15 82.5 L18 82.5 L18.8 92.5 L16.4 92.5Z" fill="#ffffff" opacity="0.22"/>` +      // shine on the clay
  `<rect x="10" y="80" width="40" height="2.6" fill="var(--pot-shade)" opacity="0.5"/>` +      // shadow under the rim
  `<rect x="6.5" y="70" width="47" height="10.5" rx="3" fill="var(--pot-rim)"/>` +             // rim
  `<rect x="44" y="70" width="9.5" height="10.5" rx="3" fill="var(--pot-shade)" opacity="0.35"/>` +
  `<rect x="9" y="71.4" width="38" height="1.6" rx="0.8" fill="#ffffff" opacity="0.28"/>` +    // light on the rim
  `<ellipse cx="30" cy="71" rx="21" ry="3.2" fill="var(--soil-dark)"/>` +                       // soil in the pot
  `<circle cx="22" cy="70.6" r="0.9" fill="var(--soil)"/><circle cx="37" cy="71.3" r="0.8" fill="var(--soil)"/>`;

function letterText(letter, y, size, color) {
  return `<text x="30" y="${y}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Atkinson Hyperlegible, Segoe UI, Arial, sans-serif" font-weight="700" ` +
    `font-size="${size}" fill="${color}">${letter.toUpperCase()}</text>`;
}

function stem(top) {
  return `<path d="M30 78 L30 ${top}" stroke="var(--stem)" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M30 62 C20 58 15 50 16 46 C24 47 29 54 30 60Z" fill="var(--leaf)"/>` +
    `<path d="M30 56 C40 52 45 45 44 41 C36 42 31 48 30 54Z" fill="var(--leaf)"/>`;
}

// A little four-pointed sparkle
function sparkle(x, y, r, delay) {
  return `<path class="spark" style="animation-delay:${delay}s" d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} ` +
    `Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z"/>`;
}

const draw = {
  // An empty pot, waiting for a letter
  empty: () => `<svg viewBox="0 0 60 96">${POT}</svg>`,

  // A letter she has typed: a garden marker stuck in the pot
  typed: (letter) => `<svg viewBox="0 0 60 96">` +
    `<rect x="27" y="40" width="6" height="38" rx="2" fill="var(--soil)"/>` +
    `<rect x="12" y="16" width="36" height="30" rx="6" fill="var(--surface)" stroke="var(--soil)" stroke-width="3"/>` +
    `${letterText(letter, 31.5, 22, "var(--fg)")}${POT}</svg>`,

  // Right letter, right spot: a shiny orange flower
  bloom: (letter) => {
    let petals = "", rays = "";
    for (let i = 0; i < 6; i++) {
      petals += `<ellipse cx="30" cy="13" rx="9" ry="12" fill="var(--bloom)" transform="rotate(${i * 60} 30 27)"/>` +
        `<ellipse cx="27" cy="8" rx="2.6" ry="5" class="gloss" transform="rotate(${i * 60} 30 27)"/>`;
    }
    for (let i = 0; i < 12; i++) {
      rays += `<path d="M28.6 27 L30 ${i % 2 ? -4 : -10} L31.4 27Z" transform="rotate(${i * 30} 30 27)"/>`;
    }
    return `<svg viewBox="0 0 60 96"><g class="rays">${rays}</g>` +
      `<circle class="halo" cx="30" cy="27" r="29" fill="url(#bloomGlow)"/>${stem(40)}${petals}` +
      `<circle cx="30" cy="27" r="12" fill="var(--bloom-center)"/>` +
      `<ellipse cx="25.5" cy="21.5" rx="4.5" ry="2.6" class="gloss" transform="rotate(-30 25.5 21.5)"/>` +
      `${letterText(letter, 27.5, 17, "var(--bloom-dark)")}` +
      `${sparkle(6, 8, 4.5, 0)}${sparkle(55, 14, 3.5, 0.6)}${POT}${sparkle(52, 44, 3, 1.2)}</svg>`;
  },

  // In the word, wrong spot: a blue bud
  bud: (letter) => `<svg viewBox="0 0 60 96">${stem(46)}` +
    `<path d="M30 12 C44 22 44 42 30 50 C16 42 16 22 30 12Z" fill="var(--part)"/>` +
    `<path d="M22 44 C26 50 34 50 38 44 C34 47 26 47 22 44Z" fill="var(--leaf)"/>` +
    `${letterText(letter, 31, 18, "#ffffff")}${POT}</svg>`,

  // Not in the word: a gray stone
  stone: (letter) => `<svg viewBox="0 0 60 96">` +
    `<path d="M11 74 C10 55 18 44 30 44 C42 44 50 55 49 74Z" fill="var(--stone)" stroke="var(--stone-edge)" stroke-width="2"/>` +
    `${letterText(letter, 58, 18, "var(--stone-ink)")}${POT}</svg>`,
};


// ---------- Checking a guess ----------
// Returns what grows in each pot: "bloom", "bud" or "stone".
function scoreGuess(guess, answer) {
  const result = Array(guess.length).fill("stone");
  const unmatched = {}; // letters in the answer not yet matched

  // First pass: right letter, right spot.
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "bloom";
    } else {
      unmatched[answer[i]] = (unmatched[answer[i]] || 0) + 1;
    }
  }
  // Second pass: right letter, wrong spot.
  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== "bloom" && unmatched[guess[i]]) {
      result[i] = "bud";
      unmatched[guess[i]]--;
    }
  }
  return result;
}


// ---------- Building the keyboard ----------
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


// ---------- Drawing the screen ----------
// grow = true right after a guess, so the plants grow in one by one.
function render(grow = false) {
  saveGame();

  // The bed: the word being typed (or the guess that just grew)
  bed.style.setProperty("--n", state.n);
  bed.innerHTML = "";
  const justPlanted = grow && state.rows.length > 0;
  const last = state.rows[state.rows.length - 1];
  const lastScore = last ? scoreGuess(last, state.answer) : null;

  for (let i = 0; i < state.n; i++) {
    const plot = document.createElement("div");
    plot.className = "plot";
    if (justPlanted || (state.done && last && !state.current)) {
      plot.innerHTML = draw[lastScore[i]](last[i]);
      if (justPlanted) {
        plot.firstChild.classList.add("grow");
        plot.firstChild.style.animationDelay = `${i * 0.12}s`;
      }
    } else {
      const letter = state.current[i];
      plot.innerHTML = letter ? draw.typed(letter) : draw.empty();
    }
    bed.appendChild(plot);
  }

  // Earlier guesses, newest at the top
  historyBox.style.setProperty("--n", state.n);
  historyBox.innerHTML = "";
  if (state.rows.length === 0) {
    historyBox.innerHTML = `<div class="history-empty">Your earlier guesses will grow here</div>`;
  }
  [...state.rows].reverse().forEach((guess) => {
    const row = document.createElement("div");
    row.className = "row";
    scoreGuess(guess, state.answer).forEach((result, i) => {
      const plot = document.createElement("div");
      plot.className = "plot";
      plot.innerHTML = draw[result](guess[i]);
      row.appendChild(plot);
    });
    historyBox.appendChild(row);
  });

  // Keyboard colors: each key shows the best result that letter has had.
  const rank = { bloom: 3, bud: 2, stone: 1 };
  const best = {};
  for (const guess of state.rows) {
    scoreGuess(guess, state.answer).forEach((result, i) => {
      const letter = guess[i];
      if (!best[letter] || rank[result] > rank[best[letter]]) best[letter] = result;
    });
  }
  keyboard.querySelectorAll(".k").forEach((button) => {
    button.classList.remove("s-bloom", "s-part", "s-out");
    const result = best[button.dataset.k];
    if (result === "bloom") button.classList.add("s-bloom");
    if (result === "bud") button.classList.add("s-part");
    if (result === "stone") button.classList.add("s-out");
  });

  $("tries").textContent = `Try ${Math.min(state.rows.length + 1, maxTries())} of ${maxTries()}`;
  showLengthChoice();
}

function showLengthChoice() {
  $("lenPick").querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.v === lengthChoice);
  });
}

function say(text) {
  message.textContent = text;
}

// Shows the current win streak in the box at the top.
function showStreak() {
  $("streakNum").textContent = stats.streak;
}

function shakeBed() {
  bed.classList.remove("shake");
  void bed.offsetWidth; // restarts the animation
  bed.classList.add("shake");
}


// ---------- Key presses ----------
function press(key) {
  if (state.done) return;

  if (key === "enter") {
    if (state.current.length < state.n) {
      say(`Plant all ${state.n} letters first`);
      shakeBed();
      return;
    }
    const guess = state.current;
    state.rows.push(guess);
    state.current = "";
    render(true);

    if (guess === state.answer) {
      finish(true);
    } else if (state.rows.length >= maxTries()) {
      finish(false);
    } else {
      const blooms = scoreGuess(guess, state.answer).filter((r) => r === "bloom").length;
      say(blooms ? `${blooms} ${blooms === 1 ? "flower" : "flowers"} bloomed!` : "Nothing bloomed yet - keep planting");
    }

  } else if (key === "back") {
    state.current = state.current.slice(0, -1);
    render();

  } else if (state.current.length < state.n) {
    state.current += key;
    render();
  }
}


// ---------- Letters: 4 / 5 / 6 / Mix ----------
function chooseLength(value) {
  lengthChoice = value;
  save(LENGTH_KEY, value);
  showLengthChoice();

  // Nothing planted yet (or the word is finished): start a new word right away.
  if (state.done || state.rows.length === 0) {
    newGame();
    return;
  }
  // Partway through a word: keep it, and use the new choice for the next word.
  say(value === "mix" ? "Your next word will be a surprise length" : `Your next word will have ${value} letters`);
}


// ---------- Hint button ----------
// Reveals one letter she hasn't found yet.
function hint() {
  if (state.done) return;

  const known = new Set(state.hints);
  for (const guess of state.rows) {
    scoreGuess(guess, state.answer).forEach((result, i) => {
      if (result === "bloom") known.add(i);
    });
  }
  const open = [];
  for (let i = 0; i < state.n; i++) if (!known.has(i)) open.push(i);

  if (open.length === 0) {
    say("You already have every letter!");
    return;
  }
  if (!Coins.spend(Coins.HINT_COST, "hint")) return;   // a hint costs a coin
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
  save(STATS_KEY, stats);
  showStreak();

  if (won) say("Your whole garden bloomed!");
  else if (gaveUp) say("Here's the word");
  else say("Good try!");

  // Short pause so she sees the plants grow before the panel slides up.
  // No pause when she gave up - she asked to see the word.
  setTimeout(() => {
    const tries = state.rows.length;
    $("endTitle").textContent = won ? WIN_TITLES[Math.floor(Math.random() * WIN_TITLES.length)] : gaveUp ? "No worries" : "Good game";
    $("endText").textContent = won
      ? `You grew the word in ${tries} ${tries === 1 ? "try" : "tries"}.`
      : "The word was:";
    $("endWord").textContent = state.answer;
    $("sPlayed").textContent = stats.played;
    $("sWon").textContent = stats.won;
    $("sStreak").textContent = stats.streak;
    $("endSheet").hidden = false;
    $("againBtn").focus();
  }, gaveUp ? 0 : won ? 1300 : 1000);
}

function newGame() {
  state = newState();
  $("endSheet").hidden = true;
  say("Plant a word to see what grows");
  render();
}


// ---------- "How to play" pictures ----------
$("helpBloom").innerHTML = draw.bloom("p");
$("helpBud").innerHTML = draw.bud("l");
$("helpStone").innerHTML = draw.stone("a");


// ---------- Wiring up buttons ----------
keyboard.addEventListener("click", (e) => {
  const button = e.target.closest(".k");
  if (button) press(button.dataset.k);
});

$("lenPick").addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (button) chooseLength(button.dataset.v);
});

// A real keyboard works too (handy when testing on a computer).
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$("helpSheet").hidden || !$("giveUpSheet").hidden || !$("endSheet").hidden || Coins.isOpen()) return;
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
$("helpClose").onclick = () => { $("helpSheet").hidden = true; save(SEEN_KEY, 1); };
$("againBtn").onclick = newGame;


// ---------- Start ----------
buildKeyboard();
showStreak();

const savedGame = load(GAME_KEY, null);
if (savedGame && !savedGame.done && typeof savedGame.answer === "string") {
  state = savedGame;
  // Games saved before the garden update: always 5 letters, and old ones used "cur".
  state.n = state.answer.length;
  if (typeof state.current !== "string") state.current = state.cur || "";
  if (!Array.isArray(state.rows)) state.rows = [];
  if (!Array.isArray(state.hints)) state.hints = [];
} else {
  state = newState();
}
render();

// Show "How to play" the very first time.
if (!load(SEEN_KEY, 0)) $("helpSheet").hidden = false;
