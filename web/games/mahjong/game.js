// =============================================================
//  Mahjong (tile-matching solitaire) - game logic
//  LAYOUTS (the board shapes) comes from layouts.js,
//  which index.html loads before this file.
// =============================================================

// ---------- Settings you can change ----------
// Does tapping "Give up" set the streak back to 0?
const GIVE_UP_ENDS_STREAK = true;

// Title on the "board cleared" panel (one is picked at random).
const WIN_TITLES = ["Board cleared!", "Well done!", "Wonderful!", "Great job!", "Splendid!"];

// How a tile is shaped: height compared to width.
const TILE_RATIO = 1.3;

// Where this game saves things on the phone.
const STATS_KEY = "mj-stats";   // played / cleared / streak / best time
const GAME_KEY = "mj-game";     // the board in progress
const SEEN_KEY = "mj-seen";     // has "How to play" been shown yet


// ---------- The tiles ----------
// Tiles are drawn in the traditional style: dots and bamboo sticks in their
// usual patterns, Chinese numbers over 萬 for the "characters" suit, and
// Chinese characters for the winds and dragons. No printed numbers.
// Each picture is drawn on a 40 x 52 grid (the shape of a tile).
// There are 34 kinds; each board uses a random selection of them.

// Where the dots / sticks go for 1 to 9, as [x, y, color] (color: b, g or r).
const DOT_PATTERNS = {
  1: [[20, 26, "r"]],
  2: [[20, 14, "g"], [20, 38, "b"]],
  3: [[10, 11, "b"], [20, 26, "r"], [30, 41, "g"]],
  4: [[12, 14, "b"], [28, 14, "g"], [12, 38, "g"], [28, 38, "b"]],
  5: [[11, 12, "b"], [29, 12, "g"], [20, 26, "r"], [11, 40, "g"], [29, 40, "b"]],
  6: [[13, 10, "g"], [27, 10, "g"], [13, 26, "r"], [27, 26, "r"], [13, 42, "r"], [27, 42, "r"]],
  7: [[9, 7, "g"], [20, 12, "g"], [31, 17, "g"], [13, 30, "r"], [27, 30, "r"], [13, 43, "r"], [27, 43, "r"]],
  8: [[13, 8, "b"], [27, 8, "b"], [13, 20, "b"], [27, 20, "b"], [13, 32, "b"], [27, 32, "b"], [13, 44, "b"], [27, 44, "b"]],
  9: [[9, 10, "b"], [20, 10, "b"], [31, 10, "b"], [9, 26, "r"], [20, 26, "r"], [31, 26, "r"], [9, 42, "g"], [20, 42, "g"], [31, 42, "g"]],
};
const DOT_SIZE = { 1: 13, 2: 8, 3: 6.5, 4: 7, 5: 6.5, 6: 6, 7: 5.2, 8: 5, 9: 5 };

const STICK_PATTERNS = {
  1: [[20, 26, "r"]],
  2: [[20, 15, "g"], [20, 37, "b"]],
  3: [[20, 15, "b"], [13, 37, "g"], [27, 37, "g"]],
  4: [[13, 15, "b"], [27, 15, "g"], [13, 37, "g"], [27, 37, "b"]],
  5: [[11, 15, "g"], [29, 15, "b"], [20, 26, "r"], [11, 37, "b"], [29, 37, "g"]],
  6: [[9, 15, "g"], [20, 15, "g"], [31, 15, "g"], [9, 37, "b"], [20, 37, "b"], [31, 37, "b"]],
  7: [[20, 9, "r"], [9, 26, "g"], [20, 26, "b"], [31, 26, "g"], [9, 42, "g"], [20, 42, "b"], [31, 42, "g"]],
  8: [[7, 15, "g"], [16, 15, "b"], [24, 15, "b"], [33, 15, "g"], [7, 37, "g"], [16, 37, "b"], [24, 37, "b"], [33, 37, "g"]],
  9: [[9, 10, "g"], [20, 10, "r"], [31, 10, "b"], [9, 26, "g"], [20, 26, "r"], [31, 26, "b"], [9, 42, "g"], [20, 42, "r"], [31, 42, "b"]],
};

function svg(inner) {
  return `<svg class="face" viewBox="0 0 40 52" aria-hidden="true">${inner}</svg>`;
}

// A dot: a colored ring with a center, like a coin.
function drawDots(n) {
  const r = DOT_SIZE[n];
  return svg(DOT_PATTERNS[n].map(([x, y, c]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" class="ink-${c}" />` +
    `<circle cx="${x}" cy="${y}" r="${r * 0.55}" class="paper" />` +
    `<circle cx="${x}" cy="${y}" r="${r * 0.25}" class="ink-${c}" />`
  ).join(""));
}

// A bamboo stick: a rounded rod with a joint in the middle.
function drawSticks(n) {
  // One big stick for 1; shorter sticks when there are three rows (7 and 9).
  const tall = n === 1 ? 34 : (n === 7 || n === 9) ? 13 : 18;
  const w = n === 1 ? 8 : n === 8 ? 5 : 6;
  return svg(STICK_PATTERNS[n].map(([x, y, c]) =>
    `<rect x="${x - w / 2}" y="${y - tall / 2}" width="${w}" height="${tall}" rx="${w / 2}" class="ink-${c}" />` +
    `<rect x="${x - w / 2 - 0.5}" y="${y - 0.9}" width="${w + 1}" height="1.8" class="paper" />`
  ).join(""));
}

// Characters suit: a Chinese number on top, 萬 underneath in red.
const CHINESE_NUMBERS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
function drawCharacter(n) {
  return svg(
    `<text x="20" y="22" class="cjk-text ink-k" font-size="20">${CHINESE_NUMBERS[n]}</text>` +
    `<text x="20" y="45" class="cjk-text ink-r" font-size="20">萬</text>`
  );
}

// Winds and the red and green dragons: one large Chinese character.
function drawBigCharacter(char, inkClass) {
  return svg(`<text x="20" y="35" class="cjk-text ${inkClass}" font-size="28">${char}</text>`);
}

// White dragon: a blue frame.
function drawWhiteDragon() {
  return svg(`<rect x="7" y="8" width="26" height="36" rx="2" class="frame" />` +
             `<rect x="11" y="12" width="18" height="28" rx="1" class="frame thin" />`);
}

const KINDS = [];
for (let n = 1; n <= 9; n++) KINDS.push({ id: `dots-${n}`, label: `${n} of dots`, draw: () => drawDots(n) });
for (let n = 1; n <= 9; n++) KINDS.push({ id: `bamboo-${n}`, label: `${n} of bamboo`, draw: () => drawSticks(n) });
for (let n = 1; n <= 9; n++) KINDS.push({ id: `chars-${n}`, label: `${n} of characters`, draw: () => drawCharacter(n) });
[["E", "東", "East"], ["S", "南", "South"], ["W", "西", "West"], ["N", "北", "North"]].forEach(([letter, cjk, name]) => {
  KINDS.push({ id: `wind-${letter}`, label: `${name} wind`, draw: () => drawBigCharacter(cjk, "ink-k") });
});
KINDS.push({ id: "dragon-red", label: "Red dragon", draw: () => drawBigCharacter("中", "ink-r") });
KINDS.push({ id: "dragon-green", label: "Green dragon", draw: () => drawBigCharacter("發", "ink-g") });
KINDS.push({ id: "dragon-white", label: "White dragon", draw: drawWhiteDragon });
const KIND_BY_ID = Object.fromEntries(KINDS.map((k) => [k.id, k]));


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


// ---------- Board shape ----------
// Turns the blocks in layouts.js into a list of tile spots {x, y, z}.
function spotsFor(layoutName) {
  const spots = [];
  for (const b of LAYOUTS[layoutName].blocks) {
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        spots.push({ x: b.x + c * 2, y: b.y + r * 2, z: b.z });
      }
    }
  }
  return spots;
}

// Is tile i free, among the tiles still on the board ("present")?
// Free = nothing on top of it, and its left OR right side is open.
function isFree(tiles, i, present) {
  const t = tiles[i];
  let leftBlocked = false;
  let rightBlocked = false;
  for (const j of present) {
    if (j === i) continue;
    const o = tiles[j];
    const overlapsDown = Math.abs(o.y - t.y) < 2;
    if (o.z === t.z + 1 && Math.abs(o.x - t.x) < 2 && overlapsDown) return false;  // something on top
    if (o.z === t.z && overlapsDown) {
      if (o.x === t.x - 2) leftBlocked = true;
      if (o.x === t.x + 2) rightBlocked = true;
    }
  }
  return !(leftBlocked && rightBlocked);
}

function shuffled(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Plans an order to clear the given tiles two at a time, always picking two
// tiles that are free at that moment. Matching kinds are then given to each
// planned pair, so playing the pairs in this order always clears the board -
// which is how every board is guaranteed to be winnable.
// Returns a list of pairs [[i, j], ...] or null if it got stuck (then try again).
function planPairs(tiles, indexes) {
  const present = new Set(indexes);
  const pairs = [];
  while (present.size > 0) {
    const free = [...present].filter((i) => isFree(tiles, i, present));
    if (free.length < 2) return null;
    const [a, b] = shuffled(free);
    pairs.push([a, b]);
    present.delete(a);
    present.delete(b);
  }
  return pairs;
}

// Gives each planned pair a kind of tile, using the kinds in "kindPairs".
function assignKinds(tiles, pairs, kindPairs) {
  const kinds = shuffled(kindPairs);
  pairs.forEach(([a, b], n) => {
    tiles[a].kind = kinds[n];
    tiles[b].kind = kinds[n];
  });
}

// A brand-new, winnable board.
function newBoard(layoutName) {
  const tiles = spotsFor(layoutName).map((s) => ({ ...s, kind: null, gone: false }));
  const all = tiles.map((t, i) => i);

  let pairs = null;
  while (!pairs) pairs = planPairs(tiles, all);

  // Pick random kinds: each kind appears 4 times (2 pairs), like a real set.
  const kindCount = Math.ceil(pairs.length / 2);
  const chosen = shuffled(KINDS).slice(0, kindCount).map((k) => k.id);
  const kindPairs = [];
  for (const id of chosen) kindPairs.push(id, id);
  assignKinds(tiles, pairs, kindPairs.slice(0, pairs.length));

  return tiles;
}


// ---------- Game state ----------
// state.layout  - which board shape
// state.tiles   - every tile: {x, y, z, kind, gone}
// state.history - pairs removed so far, newest last (for Undo)
// state.elapsed - time played so far, in milliseconds
// state.done    - true once cleared or given up
let state;
let stats = load(STATS_KEY, { played: 0, won: 0, streak: 0, best: null });
let selected = null;   // the tile she tapped first, if any

function newState() {
  return {
    layout: DEFAULT_LAYOUT,
    tiles: newBoard(DEFAULT_LAYOUT),
    history: [],
    elapsed: 0,
    done: false,
  };
}

function saveGame() {
  save(GAME_KEY, state);
}

function present() {
  return state.tiles.map((t, i) => i).filter((i) => !state.tiles[i].gone);
}

function freeTiles() {
  const here = present();
  const hereSet = new Set(here);
  return here.filter((i) => isFree(state.tiles, i, hereSet));
}

// Two free tiles that match, or null if there are none.
function findMatch() {
  const seen = {};
  for (const i of freeTiles()) {
    const k = state.tiles[i].kind;
    if (seen[k] !== undefined) return [seen[k], i];
    seen[k] = i;
  }
  return null;
}


// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const board = $("board");
const boardWrap = $("boardWrap");
const message = $("msg");


// ---------- Timer ----------
let lastTick = Date.now();

function timerRunning() {
  const panelOpen = !$("helpSheet").hidden || !$("giveUpSheet").hidden || !$("endSheet").hidden;
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
  if (timerRunning()) state.elapsed += now - lastTick;
  lastTick = now;
  $("timer").textContent = formatTime(state.elapsed);
}

setInterval(() => {
  tick();
  if (timerRunning()) saveGame();
}, 1000);

document.addEventListener("visibilitychange", () => {
  tick();
  saveGame();
});


// ---------- Drawing the board ----------
function render() {
  saveGame();

  const tiles = state.tiles;
  const maxX = Math.max(...tiles.map((t) => t.x)) + 2;   // in half-tiles
  const maxY = Math.max(...tiles.map((t) => t.y)) + 2;
  const maxZ = Math.max(...tiles.map((t) => t.z));
  const cols = maxX / 2;
  const rows = maxY / 2;

  // Make the tiles as big as the space allows (each layer shifts a little).
  const lift = 0.16;   // how far each layer shifts up-left, as a share of tile width
  const availW = boardWrap.clientWidth - 8;
  const availH = boardWrap.clientHeight - 8;
  const w = Math.max(24, Math.min(
    availW / (cols + lift * maxZ + 0.1),
    availH / (rows * TILE_RATIO + lift * maxZ + 0.15),
    70
  ));
  const h = w * TILE_RATIO;
  const shift = w * lift;

  board.style.setProperty("--tw", `${w}px`);
  board.style.setProperty("--th", `${h}px`);
  board.style.width = `${cols * w + shift * maxZ + w * 0.1}px`;
  board.style.height = `${rows * h + shift * maxZ + w * 0.15}px`;

  const free = new Set(freeTiles());
  board.innerHTML = "";

  tiles.forEach((t, i) => {
    if (t.gone) return;
    const kind = KIND_BY_ID[t.kind];
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.i = i;
    tile.style.left = `${(t.x / 2) * w + (maxZ - t.z) * shift}px`;
    tile.style.top = `${(t.y / 2) * h + (maxZ - t.z) * shift}px`;
    tile.style.zIndex = t.z * 1000 + t.y * 20 + t.x;
    tile.innerHTML = kind.draw();
    tile.setAttribute("aria-label", kind.label + (free.has(i) ? "" : " (not free yet)"));
    if (!free.has(i)) tile.classList.add("blocked");
    if (i === selected) tile.classList.add("selected");
    board.appendChild(tile);
  });

  const left = present().length / 2;
  $("pairsLeft").textContent = `${left} ${left === 1 ? "pair" : "pairs"} left`;
  $("undoBtn").disabled = state.done || state.history.length === 0;
  tick();
}

function tileEl(i) {
  return board.querySelector(`[data-i="${i}"]`);
}

function say(text) {
  message.textContent = text;
}

function showStreak() {
  $("streakNum").textContent = stats.streak;
}

// After each move: if no pairs are left to make, point her to Shuffle.
function checkStuck() {
  const stuck = !state.done && present().length > 0 && !findMatch();
  $("shuffleBtn").classList.toggle("needed", stuck);
  if (stuck) say("No matching pairs left - tap Shuffle");
  return stuck;
}


// ---------- Tapping tiles ----------
function tapTile(i) {
  if (state.done) return;
  const free = new Set(freeTiles());

  if (!free.has(i)) {
    const el = tileEl(i);
    el.classList.remove("nope");
    void el.offsetWidth;
    el.classList.add("nope");
    say("That tile isn't free yet - pick a lighter one");
    return;
  }

  if (selected === null) {
    selected = i;
    say("Now tap its match");
    render();
    return;
  }

  if (selected === i) {          // tapped the same tile again: let go of it
    selected = null;
    say("");
    render();
    return;
  }

  if (state.tiles[selected].kind === state.tiles[i].kind) {
    removePair(selected, i);
  } else {
    selected = i;                // not a match: switch to the new tile
    say("Those don't match - now tap this one's match");
    render();
  }
}

function removePair(a, b) {
  selected = null;
  tileEl(a).classList.add("leaving");
  tileEl(b).classList.add("leaving");
  state.tiles[a].gone = true;
  state.tiles[b].gone = true;
  state.history.push([a, b]);
  saveGame();

  setTimeout(() => {
    render();
    if (present().length === 0) {
      finish(true);
    } else if (!checkStuck()) {
      say("");
    }
  }, 180);
}


// ---------- Buttons ----------
function hint() {
  if (state.done) return;
  const match = findMatch();
  if (!match) {
    checkStuck();
    return;
  }
  selected = null;
  render();
  for (const i of match) tileEl(i).classList.add("hint");
  say("These two match");
}

function undo() {
  if (state.done || state.history.length === 0) return;
  const [a, b] = state.history.pop();
  state.tiles[a].gone = false;
  state.tiles[b].gone = false;
  selected = null;
  render();
  checkStuck() || say("Took back the last pair");
}

// Mixes up the tiles still on the board, keeping them winnable.
function shuffleTiles() {
  if (state.done) return;
  const here = present();

  // The kinds still on the board, paired up.
  const kinds = here.map((i) => state.tiles[i].kind).sort();
  const kindPairs = [];
  for (let n = 0; n < kinds.length; n += 2) kindPairs.push(kinds[n]);

  let pairs = null;
  while (!pairs) pairs = planPairs(state.tiles, here);
  assignKinds(state.tiles, pairs, kindPairs);

  // Undo can't go back past a shuffle.
  state.history = [];
  selected = null;
  render();
  checkStuck();
  say("Tiles shuffled");
}


// ---------- Give up ----------
function askGiveUp() {
  if (state.done) return;
  tick();
  $("giveUpText").textContent = GIVE_UP_ENDS_STREAK
    ? "You'll start a new board. Your streak will go back to 0."
    : "You'll start a new board. Your streak stays the same.";
  $("giveUpSheet").hidden = false;
  $("giveUpNo").focus();
}

function giveUp() {
  $("giveUpSheet").hidden = true;
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
    if (!stats.best || state.elapsed < stats.best) {
      stats.best = state.elapsed;
      newBest = true;
    }
  } else if (!gaveUp || GIVE_UP_ENDS_STREAK) {
    stats.streak = 0;
  }
  save(STATS_KEY, stats);
  showStreak();
  $("shuffleBtn").classList.remove("needed");
  render();
  say(won ? "You cleared the board!" : "");

  setTimeout(() => {
    $("endTitle").textContent = won
      ? WIN_TITLES[Math.floor(Math.random() * WIN_TITLES.length)]
      : "No worries";
    $("endText").textContent = won
      ? `You cleared the board in ${formatTime(state.elapsed)}.`
      : "Here's a fresh board whenever you're ready.";
    $("newBest").hidden = !newBest;
    $("sPlayed").textContent = stats.played;
    $("sWon").textContent = stats.won;
    $("sBest").textContent = stats.best ? formatTime(stats.best) : "-";
    $("endSheet").hidden = false;
    $("againBtn").focus();
  }, won ? 700 : 100);
}

function newGame() {
  state = newState();
  selected = null;
  $("endSheet").hidden = true;
  $("shuffleBtn").classList.remove("needed");
  lastTick = Date.now();
  say("Tap two matching tiles to remove them");
  render();
}


// ---------- Wiring up buttons ----------
board.addEventListener("click", (e) => {
  const tile = e.target.closest(".tile");
  if (tile) tapTile(Number(tile.dataset.i));
});

// House button: back to the list of games.
// The board is saved on every move, so she can pick it up again later.
$("homeBtn").onclick = () => {
  tick();
  saveGame();
  if (history.length > 1) history.back();          // came from the home screen
  else location.href = "../../index.html";         // game was opened directly
};

$("hintBtn").onclick = hint;
$("undoBtn").onclick = undo;
$("shuffleBtn").onclick = shuffleTiles;
$("giveUpBtn").onclick = askGiveUp;
$("giveUpYes").onclick = giveUp;
$("giveUpNo").onclick = () => { $("giveUpSheet").hidden = true; lastTick = Date.now(); };
$("helpBtn").onclick = () => { tick(); $("helpSheet").hidden = false; $("helpClose").focus(); };
$("helpClose").onclick = () => { $("helpSheet").hidden = true; lastTick = Date.now(); save(SEEN_KEY, 1); };
$("againBtn").onclick = newGame;

// Keep the tiles sized to the screen (e.g. when the phone is turned).
window.addEventListener("resize", () => render());


// ---------- Start ----------
// Draw the example tiles in the "How to play" panel.
document.querySelectorAll("[data-demo]").forEach((el) => {
  el.innerHTML = KIND_BY_ID[el.dataset.demo].draw();
});

showStreak();

const savedGame = load(GAME_KEY, null);
const savedOk = savedGame && !savedGame.done && Array.isArray(savedGame.tiles) &&
  LAYOUTS[savedGame.layout] && savedGame.tiles.every((t) => KIND_BY_ID[t.kind]);

if (savedOk) {
  state = savedGame;      // pick up where she left off
  lastTick = Date.now();
  say("Welcome back - your board is just as you left it");
  render();
  checkStuck();
} else {
  newGame();
}

// Show "How to play" the very first time.
if (!load(SEEN_KEY, 0)) $("helpSheet").hidden = false;
