// =============================================================
//  Solitaire - the card rules.
//  Kept separate from game.js so they're easy to read, and so the
//  same rules can check that every deal can be won.
//
//  A card is a number from 0 to 51:
//    suit = Math.floor(card / 13)   0 spades, 1 hearts, 2 diamonds, 3 clubs
//    rank = card % 13 + 1           1 = Ace ... 11 = Jack, 12 = Queen, 13 = King
//
//  The table (one "state"):
//    stock - face-down draw pile (last item is the top card)
//    waste - cards turned over from the stock (last item is on top)
//    found - 4 foundation piles, built Ace to King in one suit
//    tab   - 7 columns, each a list of { card, up } from bottom to top
// =============================================================

const DRAW_COUNT = 3;   // cards turned over each time the deck is tapped (unless the game says 1)

const suitOf = (card) => Math.floor(card / 13);
const rankOf = (card) => (card % 13) + 1;
const isRed = (card) => suitOf(card) === 1 || suitOf(card) === 2;

// Same deal every time for the same number, so a deal can be checked once
// and then trusted.
function randomFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shuffle and lay out a fresh game: 1 to 7 cards per column, top card face up.
function dealCards(seed) {
  const random = randomFrom(seed);
  const deck = [];
  for (let c = 0; c < 52; c++) deck.push(c);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tab = [];
  for (let col = 0; col < 7; col++) {
    tab.push([]);
    for (let n = 0; n <= col; n++) tab[col].push({ card: deck.pop(), up: n === col });
  }
  return { stock: deck, waste: [], found: [[], [], [], []], tab };
}

// ---------- What can go where ----------

// Can this card go on top of this foundation pile?
function fitsFoundation(card, pile) {
  if (pile.length === 0) return rankOf(card) === 1;
  const top = pile[pile.length - 1];
  return suitOf(top) === suitOf(card) && rankOf(card) === rankOf(top) + 1;
}

// Can this card (with any cards on top of it) go on this column?
// Empty column: Kings only. Otherwise one lower and the other color.
function fitsColumn(card, column) {
  if (column.length === 0) return rankOf(card) === 13;
  const top = column[column.length - 1];
  return top.up && isRed(top.card) !== isRed(card) && rankOf(card) === rankOf(top.card) - 1;
}

// After a card leaves a column, turn the new top card face up.
function flipTop(column) {
  const top = column[column.length - 1];
  if (top && !top.up) {
    top.up = true;
    return true;
  }
  return false;
}

// Tap the deck: turn over up to 3 cards (or 1, if the player picked "Turn 1"),
// or put the used cards back when it's empty.
function drawCards(state) {
  if (state.stock.length === 0) {
    state.stock = state.waste.reverse();
    state.waste = [];
    return;
  }
  const count = state.draw === 1 ? 1 : DRAW_COUNT;
  for (let n = 0; n < count && state.stock.length; n++) state.waste.push(state.stock.pop());
}

const totalOnFoundations = (state) => state.found.reduce((sum, pile) => sum + pile.length, 0);

// Everything face up and the deck used up: the rest can finish by itself.
function canAutoFinish(state) {
  return state.stock.length === 0 && state.waste.length === 0 &&
    state.tab.every((column) => column.every((spot) => spot.up));
}

// For checking deals (Node.js only)
if (typeof module !== "undefined") {
  module.exports = { DRAW_COUNT, suitOf, rankOf, isRed, randomFrom, dealCards, fitsFoundation, fitsColumn, flipTop, drawCards, totalOnFoundations, canAutoFinish };
}
