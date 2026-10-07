// =============================================================
//  Solitaire - game logic
//  rules.js (what can go where) and deals.js (deals that can be won)
//  load before this file.
// =============================================================

// ---------- Settings you can change ----------
// Does tapping "Give up" set the streak back to 0?
// true = yes (counts like a loss), false = no (streak is kept).
const GIVE_UP_ENDS_STREAK = true;

// Title on the "you won" panel (one is picked at random).
const WIN_TITLES = ["You won!", "Well done!", "Wonderful!", "Great job!", "Splendid!"];

// How many moves Undo can take back.
const UNDO_LIMIT = 40;

// Two taps on the same card within this many milliseconds count as a double-tap
// (which sends the card up to its pile at the top).
const DOUBLE_TAP_MS = 350;

// Where this game saves things on the phone.
const STATS_KEY = "so-stats";     // played / won / streak / best time
const GAME_KEY = "so-game";       // the deal in progress
const RECENT_KEY = "so-recent";   // deals played lately, so they don't repeat soon
const SEEN_KEY = "so-seen";       // has "How to play" been shown yet
const DRAW_KEY = "so-draw";       // Turn 1 or Turn 3: how many cards the deck turns over


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


// ---------- Card names and drawings ----------
const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_NAMES = ["", "Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];

// Simple suit shapes, drawn on a 24 x 24 grid
const SUIT_SHAPES = [
  // spade
  `<path d="M12 2 C9 7 3 10 3 14 C3 16.8 5.2 18.5 7.5 18.5 C9 18.5 10.4 17.8 11 16.8 C10.8 19 10 20.6 8.5 22 L15.5 22 C14 20.6 13.2 19 13 16.8 C13.6 17.8 15 18.5 16.5 18.5 C18.8 18.5 21 16.8 21 14 C21 10 15 7 12 2Z"/>`,
  // heart
  `<path d="M12 21 C5 15 2 11.5 2 8 C2 5 4.5 3 7 3 C9 3 11 4.5 12 6.5 C13 4.5 15 3 17 3 C19.5 3 22 5 22 8 C22 11.5 19 15 12 21Z"/>`,
  // diamond
  `<path d="M12 2 L20 12 L12 22 L4 12Z"/>`,
  // club
  `<circle cx="12" cy="7" r="4.4"/><circle cx="6.8" cy="13.2" r="4.4"/><circle cx="17.2" cy="13.2" r="4.4"/><path d="M11 12 L13 12 L14.6 22 L9.4 22Z"/>`,
];

function suitIcon(suit) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${SUIT_SHAPES[suit]}</svg>`;
}

function cardName(card) {
  return `${RANK_NAMES[rankOf(card)]} of ${SUIT_NAMES[suitOf(card)]}`;
}

// The front of a card: rank and suit in the corner, and a big suit
// (or a big letter for Jack, Queen and King) in the middle.
function cardFace(card) {
  const rank = rankOf(card), suit = suitOf(card);
  const middle = rank > 10
    ? `<div class="face-letter">${RANK_LABELS[rank]}</div>`
    : `<div class="middle">${suitIcon(suit)}</div>`;
  return `<div class="corner">${RANK_LABELS[rank]}${suitIcon(suit)}</div>${middle}`;
}


// ---------- Game state ----------
// state.seed    - which deal this is (from deals.js)
// state.stock, state.waste, state.found, state.tab - the cards (see rules.js)
// state.moves   - moves made so far
// state.elapsed - time played, in milliseconds
// state.undo    - earlier copies of the table, for the Undo button
// state.done    - true once the game is won or given up
// state.draw    - 1 or 3: how many cards the deck turns over each tap
let state;
// best = best time turning 3 cards, best1 = best time turning 1 card
let stats = load(STATS_KEY, { played: 0, won: 0, streak: 0, best: 0, best1: 0 });
let drawChoice = load(DRAW_KEY, 3) === 1 ? 1 : 3;   // what the next game uses
let selected = null;   // the card she has picked up: { pile, c, i } or null
let finishing = false; // true while Finish is playing the last cards

function pickDeal() {
  const recent = load(RECENT_KEY, []);
  const fresh = DEALS.filter((seed) => !recent.includes(seed));
  const pool = fresh.length ? fresh : DEALS;
  const seed = pool[Math.floor(Math.random() * pool.length)];
  recent.push(seed);
  save(RECENT_KEY, recent.slice(-Math.floor(DEALS.length / 2)));
  return seed;
}

function newState() {
  const seed = pickDeal();
  return { seed, draw: drawChoice, ...dealCards(seed), moves: 0, elapsed: 0, undo: [], done: false };
}

function saveGame() {
  save(GAME_KEY, state);
}

// A copy of just the cards (for Undo)
function snapshot() {
  return JSON.stringify({ stock: state.stock, waste: state.waste, found: state.found, tab: state.tab, moves: state.moves });
}

function remember() {
  state.undo.push(snapshot());
  if (state.undo.length > UNDO_LIMIT) state.undo.shift();
}


// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const table = $("table");
const message = $("msg");

const cardEls = [];     // one element for each of the 52 cards
const slots = {};       // outlines for the empty spots

function buildTable() {
  table.innerHTML = "";
  const addSlot = (name, cls, html = "") => {
    const el = document.createElement("div");
    el.className = "slot " + cls;
    el.dataset.slot = name;
    el.innerHTML = html;
    table.appendChild(el);
    slots[name] = el;
  };
  addSlot("stock", "stock");
  for (let f = 0; f < 4; f++) addSlot("found" + f, "found", "A");
  for (let c = 0; c < 7; c++) addSlot("tab" + c, "tab", "K");

  for (let card = 0; card < 52; card++) {
    const el = document.createElement("div");
    el.className = "card " + (isRed(card) ? "red" : "black");
    el.dataset.card = card;
    el.innerHTML = cardFace(card);
    table.appendChild(el);
    cardEls[card] = el;
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


// ---------- Drawing the table ----------
// Works out card size from the space available, then places every card.
let layout = { cw: 0, ch: 0, gap: 0, tabTop: 0 };   // card sizes from the last render (used for dragging)

function render() {
  const W = table.clientWidth, H = table.clientHeight;
  const gap = Math.max(3, Math.round(W * 0.012));
  let cw = Math.min((W - gap * 6) / 7, 96);
  cw = Math.min(cw, H / 4.2);                 // very short screens: smaller cards
  cw = Math.floor(cw);
  const ch = Math.round(cw * 1.4);
  table.style.setProperty("--cw", cw + "px");
  table.style.setProperty("--ch", ch + "px");

  const x = (col) => Math.round(col * (cw + gap));
  const tabTop = ch + Math.round(gap * 2.5);
  layout = { cw, ch, gap, tabTop };
  const place = (el, left, top, z) => {
    el.style.transform = "";            // put back any card that was being dragged
    el.classList.remove("dragging");
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.zIndex = z;
  };

  // Empty spots
  place(slots.stock, x(0), 0, 0);
  slots.stock.innerHTML = state.stock.length === 0 && state.waste.length
    ? `<svg viewBox="0 0 24 24" aria-label="Start the deck again" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>`
    : "";
  slots.stock.classList.toggle("empty-for-good", state.stock.length === 0 && state.waste.length === 0);
  for (let f = 0; f < 4; f++) place(slots["found" + f], x(3 + f), 0, 0);
  for (let c = 0; c < 7; c++) place(slots["tab" + c], x(c), tabTop, 0);

  const show = (card, up) => {
    const el = cardEls[card];
    el.classList.toggle("up", up);
    el.classList.toggle("down", !up);
    el.setAttribute("aria-label", up ? cardName(card) : "Face-down card");
    el.classList.remove("selected");
    return el;
  };

  // Deck (face down)
  state.stock.forEach((card, i) => place(show(card, false), x(0), 0, 10 + i));

  // Turned-over cards: the top 3 are fanned out (just the top 1 when turning 1 at a time)
  const fanFrom = Math.max(0, state.waste.length - (state.draw === 1 ? 1 : 3));
  state.waste.forEach((card, i) => {
    const shift = i < fanFrom ? 0 : Math.round((i - fanFrom) * cw * 0.32);
    place(show(card, true), x(1) + shift, 0, 100 + i);
  });

  // Foundations
  state.found.forEach((pile, f) => pile.forEach((card, i) => place(show(card, true), x(3 + f), 0, 200 + i)));

  // Columns: squeeze the spacing if a column gets too tall for the screen
  const room = H - tabTop - ch;
  state.tab.forEach((column, c) => {
    const downs = column.filter((s) => !s.up).length;
    const ups = Math.max(0, column.length - downs - 1);
    let downGap = ch * 0.16, upGap = ch * 0.45;   // roomy, so covered cards are easy to tap
    const need = downs * downGap + ups * upGap;
    if (need > room && need > 0) {
      downGap = Math.max(ch * 0.06, downGap * room / need);
      const left = room - downs * downGap;
      if (ups > 0) upGap = Math.max(ch * 0.2, Math.min(upGap, left / ups));
    }
    let y = tabTop;
    column.forEach((spot, i) => {
      place(show(spot.card, spot.up), x(c), Math.round(y), 300 + i);
      y += spot.up ? upGap : downGap;
    });
  });

  // The picked-up card, and anything on top of it
  selectedCards().forEach((card) => cardEls[card].classList.add("selected"));

  $("moves").textContent = `${state.moves} ${state.moves === 1 ? "move" : "moves"}`;
  // While Finish is playing the cards, the other buttons wait.
  $("undoBtn").disabled = state.done || finishing || state.undo.length === 0;
  // The switch shows this game's setting. If the next game will use the other
  // one, that button gets a dashed outline marked "next game".
  $("turnPick").querySelectorAll("button").forEach((x) => {
    const n = Number(x.dataset.n);
    const now = n === state.draw;
    const next = !now && n === drawChoice;
    x.setAttribute("aria-pressed", now);
    x.classList.toggle("next", next);
    x.setAttribute("aria-label", `Turn ${n} card${n === 1 ? "" : "s"}${now ? " (this game)" : next ? " (next game)" : ""}`);
  });
  $("giveUpBtn").disabled = finishing;
  const canFinish = !state.done && !finishing && canAutoFinish(state) && totalOnFoundations(state) < 52;
  $("finishBtn").disabled = !canFinish;
  $("finishBtn").classList.toggle("ready", canFinish);
  tick();
}

function say(text) {
  message.textContent = text;
}

function showStreak() {
  $("streakNum").textContent = stats.streak;
}

function flash(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // restarts the animation
  el.classList.add(cls);
}


// ---------- Where is a card? ----------
function locate(card) {
  if (state.stock.includes(card)) return { pile: "stock" };
  const w = state.waste.indexOf(card);
  if (w >= 0) return { pile: "waste", i: w };
  for (let f = 0; f < 4; f++) {
    const i = state.found[f].indexOf(card);
    if (i >= 0) return { pile: "found", c: f, i };
  }
  for (let c = 0; c < 7; c++) {
    const i = state.tab[c].findIndex((s) => s.card === card);
    if (i >= 0) return { pile: "tab", c, i };
  }
  return null;
}

// The cards that move together when this spot is picked up
function cardsAt(spot) {
  if (!spot) return [];
  if (spot.pile === "waste") return state.waste.length ? [state.waste[state.waste.length - 1]] : [];
  if (spot.pile === "found") {
    const pile = state.found[spot.c];
    return pile.length ? [pile[pile.length - 1]] : [];
  }
  if (spot.pile === "tab") return state.tab[spot.c].slice(spot.i).map((s) => s.card);
  return [];
}

function selectedCards() {
  return cardsAt(selected);
}

// Can she pick up the card at this spot?
function canPickUp(spot) {
  if (!spot) return false;
  if (spot.pile === "waste") return state.waste.length > 0;
  if (spot.pile === "found") return state.found[spot.c].length > 0;
  if (spot.pile === "tab") return state.tab[spot.c][spot.i].up;
  return false;
}

// Normalize a tapped waste or foundation card to the top card of that pile
function pickSpot(spot) {
  if (spot.pile === "waste") return { pile: "waste" };
  if (spot.pile === "found") return { pile: "found", c: spot.c };
  return spot;
}


// ---------- Moving cards ----------
// Try to move the picked-up cards to a pile. Returns true if they moved.
//   dest = { pile: "found", c } or { pile: "tab", c }
function moveTo(from, dest) {
  const cards = cardsAt(from);
  if (!cards.length) return false;
  const first = cards[0];

  if (dest.pile === "found") {
    if (cards.length !== 1) return false;
    // The tapped pile first, then any pile the card fits
    const order = [dest.c, 0, 1, 2, 3];
    const f = order.find((n) => fitsFoundation(first, state.found[n]));
    if (f === undefined || (from.pile === "found" && from.c === f)) return false;
    remember();
    takeAway(from, 1);
    state.found[f].push(first);
  } else {
    if (from.pile === "tab" && from.c === dest.c) return false;
    if (!fitsColumn(first, state.tab[dest.c])) return false;
    remember();
    takeAway(from, cards.length);
    state.tab[dest.c].push(...cards.map((card) => ({ card, up: true })));
  }
  state.moves++;
  return true;
}

function takeAway(from, count) {
  if (from.pile === "waste") state.waste.pop();
  else if (from.pile === "found") state.found[from.c].pop();
  else {
    state.tab[from.c].splice(state.tab[from.c].length - count);
    flipTop(state.tab[from.c]);
  }
}

function afterMove() {
  selected = null;
  render();
  saveGame();
  if (totalOnFoundations(state) === 52) {
    finish(true);
  } else if (canAutoFinish(state)) {
    say("All cards are showing - tap Finish!");
  }
}


// ---------- Tapping ----------
function tapDeck() {
  if (state.stock.length === 0 && state.waste.length === 0) {
    say("The deck is empty");
    return;
  }
  // Turning the deck isn't saved as its own Undo step: Undo takes back the last
  // card that was moved (and the deck goes back to how it was at that moment).
  const restarting = state.stock.length === 0;
  drawCards(state);
  state.moves++;
  selected = null;
  say(restarting ? "The deck starts again" : "");
  render();
  saveGame();
}

let lastPick = null;   // the card picked up most recently, and when: { card, time }

// Remember a picked-up card, so a quick second tap counts as a double-tap.
function notePick() {
  lastPick = { card: cardsAt(selected)[0], time: Date.now() };
}

// The card that was tapped (for the turned-over pile, always its top card)
function tappedCard(spot) {
  if (spot.pile === "waste") return state.waste[state.waste.length - 1];
  if (spot.pile === "tab" && spot.i !== undefined) return state.tab[spot.c][spot.i].card;
  if (spot.pile === "found" && spot.i !== undefined) return state.found[spot.c][spot.i];
  return undefined;
}

// Double-tap: send a card up to its pile at the top, if it fits there.
// (It never moves a card between the 7 columns.)
function sendUp(spot) {
  const from = pickSpot(spot);
  selected = null;
  if (from.pile === "found") {
    say("");
    render();
    return;
  }
  const cards = cardsAt(from);
  if (cards.length !== 1) {
    say("Only the last card in a column can go up to the piles");
    render();
    return;
  }
  const f = [0, 1, 2, 3].find((n) => fitsFoundation(cards[0], state.found[n]));
  if (f === undefined) {
    say(`The ${cardName(cards[0])} can't go up yet`);
    render();
    flash(cardEls[cards[0]], "nope");
    return;
  }
  moveTo(from, { pile: "found", c: f });
  say("");
  afterMove();
}

function tap(spot) {
  if (state.done || finishing) return;

  // The deck
  if (spot.pile === "stock") {
    lastPick = null;
    tapDeck();
    return;
  }

  // A quick second tap on the same card: send it up to the piles at the top
  const card = tappedCard(spot);
  if (lastPick && card !== undefined && card === lastPick.card && Date.now() - lastPick.time < DOUBLE_TAP_MS) {
    lastPick = null;
    sendUp(spot);
    return;
  }
  lastPick = null;

  // Nothing picked up yet: pick this card up
  if (!selected) {
    if (spot.pile === "tab" && spot.i !== undefined && !state.tab[spot.c][spot.i].up) {
      say("That card is face down - it turns over when the cards on it are moved");
      return;
    }
    const pick = spot.i === undefined && spot.pile !== "waste" ? null : pickSpot(spot);
    if (pick && canPickUp(pick) && cardsAt(pick).length) {
      selected = pick;
      notePick();
      say(`${cardName(cardsAt(pick)[0])} - now tap where it goes`);
      render();
    }
    return;
  }

  // Tapped the picked-up card again: put it back down
  const sameSpot = spot.pile === selected.pile && spot.c === selected.c &&
    (spot.pile !== "tab" || spot.i === selected.i);
  if (sameSpot || (spot.pile === "waste" && selected.pile === "waste")) {
    selected = null;
    say("");
    render();
    return;
  }

  // Try to move it there
  if ((spot.pile === "found" || spot.pile === "tab") && moveTo(selected, { pile: spot.pile, c: spot.c })) {
    say("");
    afterMove();
    return;
  }

  // Couldn't move there. If she tapped another card she could pick up, pick that one up instead.
  const pick = spot.i !== undefined || spot.pile === "waste" ? pickSpot(spot) : null;
  if (pick && canPickUp(pick) && cardsAt(pick).length && spot.pile !== "found") {
    const held = cardsAt(selected)[0];
    selected = pick;
    notePick();
    say(`${cardName(held)} can't go there. Now holding ${cardName(cardsAt(pick)[0])}`);
    render();
    return;
  }

  const held = cardsAt(selected)[0];
  say(`The ${cardName(held)} can't go there`);
  flash(cardEls[held], "nope");
}

table.addEventListener("click", (e) => {
  if (Date.now() < ignoreClicksUntil) return;   // this "click" was really the end of a drag
  const cardEl = e.target.closest(".card");
  if (cardEl) {
    tap(locate(Number(cardEl.dataset.card)));
    return;
  }
  const slotEl = e.target.closest(".slot");
  if (!slotEl) return;
  const name = slotEl.dataset.slot;
  if (name === "stock") tap({ pile: "stock" });
  else if (name.startsWith("found")) tap({ pile: "found", c: Number(name.slice(5)) });
  else tap({ pile: "tab", c: Number(name.slice(3)) });
});


// ---------- Dragging ----------
// Besides tapping, cards can be dragged with a finger (or mouse) onto
// another column or up to the piles at the top. A small movement first
// tells a drag apart from a tap, so tapping still works the same.
const DRAG_START_PX = 8;     // how far a finger moves before it counts as a drag
let drag = null;             // { from, cards, startX, startY, pointerId, moving }
let ignoreClicksUntil = 0;

table.addEventListener("pointerdown", (e) => {
  if (state.done || finishing || drag || (e.pointerType === "mouse" && e.button !== 0)) return;
  const cardEl = e.target.closest(".card");
  if (!cardEl) return;
  const spot = locate(Number(cardEl.dataset.card));
  if (!spot || spot.pile === "stock") return;
  if (spot.pile === "tab" && !state.tab[spot.c][spot.i].up) return;   // face-down cards stay put
  const from = pickSpot(spot);
  if (!canPickUp(from)) return;
  drag = { from, cards: cardsAt(from), startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, moving: false };
});

table.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
  if (!drag.moving) {
    if (Math.hypot(dx, dy) < DRAG_START_PX) return;
    // It's a drag: lift the card(s)
    drag.moving = true;
    selected = null;
    say("");
    render();
    try { table.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    drag.cards.forEach((card) => cardEls[card].classList.add("dragging"));
  }
  e.preventDefault();
  drag.cards.forEach((card, n) => {
    cardEls[card].style.transform = `translate(${dx}px, ${dy}px)`;
    cardEls[card].style.zIndex = 1000 + n;
  });
});

function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const d = drag;
  drag = null;
  if (!d.moving) return;              // it was a tap - the click handler takes care of it
  ignoreClicksUntil = Date.now() + 150;   // skip only the click that ends this drag
  const dest = cancelled ? null : dropTarget(cardEls[d.cards[0]]);
  if (dest && moveTo(d.from, dest)) {
    say("");
    afterMove();
    return;
  }
  // Didn't fit: the card slides back
  render();
  if (dest && !(dest.pile === d.from.pile && dest.c === d.from.c)) {
    say(`The ${cardName(d.cards[0])} can't go there`);
  }
}
table.addEventListener("pointerup", (e) => endDrag(e, false));
table.addEventListener("pointercancel", (e) => endDrag(e, true));

// Which pile is under the middle of the dragged card?
function dropTarget(el) {
  const t = table.getBoundingClientRect(), r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - t.left;
  const cy = r.top + r.height / 2 - t.top;
  const { cw, ch, gap, tabTop } = layout;
  const col = Math.max(0, Math.min(6, Math.floor((cx + gap / 2) / (cw + gap))));
  if (cy < tabTop - gap) {
    return col >= 3 ? { pile: "found", c: col - 3 } : null;   // the top row: piles on the right
  }
  return { pile: "tab", c: col };
}


// ---------- Undo ----------
function undo() {
  if (state.done || finishing || !state.undo.length) return;
  if (!Coins.spend(Coins.UNDO_COST, "undo")) return;   // an Undo costs a coin
  const before = JSON.parse(state.undo.pop());
  Object.assign(state, before);
  selected = null;
  say("Took back your last move");
  render();
  saveGame();
}


// ---------- Finish: play the rest automatically ----------

function autoFinish() {
  if (!canAutoFinish(state) || finishing) return;
  finishing = true;
  selected = null;
  say("Finishing...");
  const step = () => {
    // Move the lowest card that fits
    let best = null;
    for (let c = 0; c < 7; c++) {
      const column = state.tab[c];
      if (!column.length) continue;
      const card = column[column.length - 1].card;
      for (let f = 0; f < 4; f++) {
        if (fitsFoundation(card, state.found[f]) && (!best || rankOf(card) < rankOf(best.card))) best = { card, c, f };
      }
    }
    if (!best) {
      finishing = false;
      afterMove();
      return;
    }
    state.tab[best.c].pop();
    state.found[best.f].push(best.card);
    state.moves++;
    render();
    if (totalOnFoundations(state) === 52) {
      finishing = false;
      afterMove();
    } else {
      setTimeout(step, 90);
    }
  };
  remember();
  render();   // greys out the other buttons while the cards play
  step();
}


// ---------- Give up button ----------
function askGiveUp() {
  if (state.done || finishing) return;
  tick();
  $("giveUpText").textContent = GIVE_UP_ENDS_STREAK
    ? "We'll deal new cards. Your streak will go back to 0."
    : "We'll deal new cards. Your streak stays the same.";
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
  const bestKey = state.draw === 1 ? "best1" : "best";   // separate best times for Turn 1 and Turn 3
  const bestLabel = `Best (turn ${state.draw === 1 ? 1 : 3})`;
  if (won) {
    stats.won++;
    stats.streak++;
    if (!stats[bestKey] || state.elapsed < stats[bestKey]) {
      stats[bestKey] = state.elapsed;
      newBest = true;
    }
  } else if (!gaveUp || GIVE_UP_ENDS_STREAK) {
    stats.streak = 0;
  }
  save(STATS_KEY, stats);
  showStreak();
  render();
  say(won ? "Every card is home!" : "");

  setTimeout(() => {
    $("endTitle").textContent = won ? WIN_TITLES[Math.floor(Math.random() * WIN_TITLES.length)] : "No worries";
    $("endText").textContent = won
      ? `You won in ${formatTime(state.elapsed)} with ${state.moves} moves.`
      : "Here's a fresh deal whenever you're ready.";
    $("newBest").hidden = !newBest;
    $("sPlayed").textContent = stats.played;
    $("sWon").textContent = stats.won;
    $("sBest").textContent = stats[bestKey] ? formatTime(stats[bestKey]) : "-";
    $("sBestLabel").textContent = bestLabel;
    $("endSheet").hidden = false;
    $("againBtn").focus();
  }, won ? 800 : 100);
}

function newGame() {
  if (finishing) return;
  state = newState();
  selected = null;
  $("endSheet").hidden = true;
  lastTick = Date.now();
  say("Tap a card, then tap where it goes");
  render();
  saveGame();
}


// ---------- Wiring up buttons ----------
// House button: back to the list of games.
// The game is saved on every move, so she can pick it up again later.
$("homeBtn").onclick = () => {
  tick();
  saveGame();
  if (history.length > 1) history.back();          // came from the home screen
  else location.href = "../../index.html";         // game was opened directly
};

$("undoBtn").onclick = undo;
$("finishBtn").onclick = autoFinish;
$("giveUpBtn").onclick = askGiveUp;
$("giveUpYes").onclick = giveUp;
$("giveUpNo").onclick = () => { $("giveUpSheet").hidden = true; lastTick = Date.now(); };
$("helpBtn").onclick = () => { tick(); $("helpSheet").hidden = false; $("helpClose").focus(); };
$("helpClose").onclick = () => { $("helpSheet").hidden = true; lastTick = Date.now(); save(SEEN_KEY, 1); };
$("againBtn").onclick = newGame;

// Turn 1 / Turn 3. Before the first move it changes this deal right away;
// after that it's saved for the next game.
function chooseDraw(n) {
  if (n !== 1 && n !== 3) return;
  drawChoice = n;
  save(DRAW_KEY, n);
  if (state.done) {
    say(`Next game: turn ${n === 1 ? "1 card" : "3 cards"}`);
  } else if (state.moves === 0) {
    state.draw = n;
    saveGame();
    say(n === 1 ? "Turning over 1 card at a time" : "Turning over 3 cards at a time");
  } else if (state.draw !== n) {
    say(`Next game: turn ${n === 1 ? "1 card" : "3 cards"}`);
  } else {
    say("");
  }
  render();
}
$("turnPick").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) chooseDraw(Number(b.dataset.n));
});

// Keep the cards sized to the screen (e.g. when the phone is turned).
window.addEventListener("resize", () => render());


// ---------- Start ----------
buildTable();
showStreak();

const savedGame = load(GAME_KEY, null);
const savedOk = savedGame && !savedGame.done && Array.isArray(savedGame.tab) && savedGame.tab.length === 7 &&
  Array.isArray(savedGame.stock) && Array.isArray(savedGame.waste) && Array.isArray(savedGame.found);

if (savedOk) {
  state = savedGame;      // pick up where she left off
  if (!Array.isArray(state.undo)) state.undo = [];
  if (state.draw !== 1) state.draw = 3;   // games saved before Turn 1 existed turn 3
  lastTick = Date.now();
  say("Welcome back - here's your game");
  render();
} else {
  newGame();
}

// Show "How to play" the very first time.
if (!load(SEEN_KEY, 0)) $("helpSheet").hidden = false;
