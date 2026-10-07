// =============================================================
//  Coins - one wallet shared by every game and the home screen.
//
//  - New players start with START_COINS.
//  - A hint costs HINT_COST coins, and Undo in Solitaire costs UNDO_COST
//    (games call Coins.spend).
//  - The coin button at the top shows the balance and opens the
//    "Add coins" panel.
//
//  Right now "Add coins" is free. Later the ADD_PACKS buttons will
//  become purchases: see addPack() below - that's the one place to
//  change.
//
//  Every page includes coins.css and this file, before its own game.js.
// =============================================================

const Coins = (function () {
  // ---------- Settings you can change ----------
  const START_COINS = 5;          // what a brand-new player gets
  const HINT_COST = 1;            // what one hint costs
  const UNDO_COST = 1;            // what one Undo costs (Solitaire)
  const ADD_PACKS = [5, 10, 25];  // the choices on the "Add coins" panel

  // What each paid button costs, and how to describe it ("You need 1 coin for a hint")
  const PRICES = {
    hint: { cost: HINT_COST, words: "for a hint" },
    undo: { cost: UNDO_COST, words: "to undo a move" },
  };
  const coinWord = (n) => (n === 1 ? "coin" : "coins");

  const KEY = "games-coins";      // where the balance is saved on the phone
  let memory = START_COINS;       // used if the phone won't let us save

  // ---------- Saving the balance ----------
  function get() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === null) {                     // first time ever: hand out the starting coins
        localStorage.setItem(KEY, String(START_COINS));
        return START_COINS;
      }
      const n = parseInt(saved, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch (e) {
      return memory;
    }
  }

  function set(n) {
    memory = Math.max(0, Math.floor(n));
    try { localStorage.setItem(KEY, String(memory)); } catch (e) { /* keeps working, just won't remember */ }
    show();
  }

  function add(n) { set(get() + n); }

  // Takes coins for something (like a hint). Returns true if paid.
  // If there aren't enough, it opens the "Add coins" panel and returns false.
  function spend(n, what) {
    const have = get();
    if (have < n) {
      open(what);
      return false;
    }
    set(have - n);
    bump();
    return true;
  }

  // ---------- The little coin picture ----------
  const COIN_SVG =
    '<svg class="coin-ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10.5" fill="#f2b705"/>' +
    '<circle cx="12" cy="12" r="7.6" fill="none" stroke="#c98f00" stroke-width="1.4"/>' +
    '<path d="M12 16.5v-5.2c0-2.2 1.6-3.6 3.6-3.6 0 2.2-1.5 3.6-3.6 3.6M12 13.2c0-1.7-1.2-2.8-2.8-2.8 0 1.7 1.2 2.8 2.8 2.8" ' +
    'fill="none" stroke="#7a5600" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  // ---------- The coin button at the top of the screen ----------
  let chip = null;

  function makeChip() {
    chip = document.createElement("button");
    chip.type = "button";
    chip.className = "coin-chip";
    chip.addEventListener("click", () => open());

    // In a game: a box next to the "in a row" box, built the same way
    // (number on top, small label underneath). On the home screen: next to the title.
    const streak = document.querySelector(".title-row .streak");
    const home = document.querySelector(".home-header");
    if (streak) {
      chip.classList.add("coin-box");
      chip.innerHTML = '<span class="coin-top">' + COIN_SVG + '<span class="coin-num"></span></span>' +
        '<span class="coin-label">Coins</span><span class="coin-plus" aria-hidden="true">+</span>';
      // the two boxes sit together on the right
      const pair = document.createElement("div");
      pair.className = "title-boxes";
      streak.replaceWith(pair);
      pair.append(chip, streak);
      document.querySelector(".title-row").classList.add("has-coins");
    } else if (home) {
      chip.innerHTML = COIN_SVG + '<span class="coin-num"></span><span class="coin-plus" aria-hidden="true">+</span>';
      home.appendChild(chip);
      home.classList.add("has-coins");
    }
  }

  // Puts a small "1 coin" price on buttons that cost coins, e.g. <button data-cost="hint"> or data-cost="undo"
  function markPrices() {
    document.querySelectorAll("[data-cost]").forEach((b) => {
      if (b.querySelector(".coin-cost")) return;
      const tag = document.createElement("span");
      tag.className = "coin-cost";
      const cost = (PRICES[b.dataset.cost] || PRICES.hint).cost;
      tag.innerHTML = COIN_SVG + cost;
      b.appendChild(tag);
      b.setAttribute("aria-label", `${b.textContent.replace(/\d+$/, "").trim()}, costs ${cost} ${coinWord(cost)}`);
    });
  }

  function show() {
    const n = get();
    if (chip) {
      chip.querySelector(".coin-num").textContent = n;
      chip.setAttribute("aria-label", `${n} coin${n === 1 ? "" : "s"}. Add coins`);
    }
    if (sheet) {
      sheet.querySelector(".coin-have").textContent = n;
      sheet.querySelector(".coin-word").textContent = n === 1 ? "coin" : "coins";
    }
  }

  // A little bounce on the coin button when coins are spent or added
  function bump() {
    if (!chip) return;
    chip.classList.remove("bump");
    void chip.offsetWidth;
    chip.classList.add("bump");
  }

  // ---------- The "Add coins" panel ----------
  let sheet = null;
  let lastFocus = null;

  function makeSheet() {
    sheet = document.createElement("div");
    sheet.className = "coin-sheet";
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="coin-panel" role="dialog" aria-modal="true" aria-labelledby="coinTitle" tabindex="-1">' +
      '  <h2 id="coinTitle">Coins</h2>' +
      '  <p class="coin-why" hidden></p>' +
      '  <p class="coin-balance">' + COIN_SVG + 'You have <b class="coin-have">0</b> <span class="coin-word">coins</span></p>' +
      '  <p>A hint costs ' + HINT_COST + ' ' + coinWord(HINT_COST) + ', and so does Undo in Solitaire. Coins work in every game.</p>' +
      '  <div class="coin-packs">' +
      ADD_PACKS.map((n) => '<button type="button" class="coin-pack" data-n="' + n + '">' + COIN_SVG + '<b>+' + n + '</b><span>coins</span></button>').join("") +
      '  </div>' +
      '  <p class="coin-status" role="status" aria-live="polite"></p>' +
      '  <button type="button" class="coin-done">Done</button>' +
      '</div>';
    document.body.appendChild(sheet);

    sheet.querySelectorAll(".coin-pack").forEach((b) => b.addEventListener("click", () => addPack(Number(b.dataset.n))));
    sheet.querySelector(".coin-done").addEventListener("click", close);
    sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });   // tap outside the panel
    document.addEventListener("keydown", (e) => {
      if (!sheet.hidden && e.key === "Escape") { e.stopImmediatePropagation(); close(); }
    }, true);
  }

  // One of the "+5 / +10 / +25" buttons.
  // LATER: this is where a purchase will happen - only add the coins once it's paid for.
  function addPack(n) {
    add(n);
    bump();
    sheet.querySelector(".coin-status").textContent = `Added ${n} coins`;
    sheet.querySelector(".coin-why").hidden = true;
    sheet.querySelector("#coinTitle").textContent = "Coins";
  }

  // why: "hint" or "undo" when that button was tapped without enough coins
  function open(why) {
    if (!sheet) return;
    lastFocus = document.activeElement;
    const price = PRICES[why];
    sheet.querySelector("#coinTitle").textContent = price ? "Out of coins" : "Coins";
    const whyLine = sheet.querySelector(".coin-why");
    whyLine.hidden = !price;
    whyLine.textContent = price ? `You need ${price.cost} ${coinWord(price.cost)} ${price.words}. Add more below.` : "";
    sheet.querySelector(".coin-status").textContent = "";
    show();
    sheet.hidden = false;
    sheet.querySelector(".coin-panel").focus();   // so a keyboard can Tab to the buttons
  }

  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    // let the game know (it may want to restart its clock)
    document.dispatchEvent(new CustomEvent("coins-closed"));
  }

  const isOpen = () => !!sheet && !sheet.hidden;

  // ---------- Start ----------
  function start() {
    makeChip();
    makeSheet();
    markPrices();
    show();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // Coins spent in another game (or another tab) show up here too
  window.addEventListener("storage", (e) => { if (e.key === KEY) show(); });
  window.addEventListener("pageshow", show);                  // coming back with the Back button
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") show(); });

  return { get, add, spend, open, isOpen, HINT_COST, UNDO_COST };
})();
