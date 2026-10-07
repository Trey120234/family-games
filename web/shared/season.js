// =============================================================
//  Seasons - gives every screen a spring, summer, fall or winter look.
//
//  - "Automatic" (the default) follows the calendar:
//      Spring: March-May   Summer: June-August
//      Fall: September-November   Winter: December-February
//  - On the home screen players can pick a season, or turn seasons off
//    (the original green garden look).
//  - The colors and decorations are in seasons.css.
//
//  Every page loads this in its <head>, so the right colors show from
//  the very first moment (no flash of the wrong season).
// =============================================================

const Season = (function () {
  const KEY = "games-season";          // "auto", "spring", "summer", "fall", "winter" or "off"
  const SEASONS = ["spring", "summer", "fall", "winter"];
  const NAMES = { spring: "Spring", summer: "Summer", fall: "Fall", winter: "Winter", none: "Classic" };

  function choice() {
    try {
      const c = localStorage.getItem(KEY);
      return c === "off" || SEASONS.includes(c) ? c : "auto";
    } catch (e) {
      return "auto";
    }
  }

  // The season for a date (northern half of the world)
  function fromCalendar(date = new Date()) {
    const m = date.getMonth();   // 0 = January
    if (m === 11 || m <= 1) return "winter";
    if (m <= 4) return "spring";
    if (m <= 7) return "summer";
    return "fall";
  }

  // The season to show right now: "spring", "summer", "fall", "winter" or "none"
  function now() {
    const c = choice();
    if (c === "off") return "none";
    return c === "auto" ? fromCalendar() : c;
  }

  function apply() {
    document.documentElement.dataset.season = now();
    // the phone's top bar matches the page background
    requestAnimationFrame(() => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
    });
    if (document.body) decorate();
  }

  function set(c) {
    try { localStorage.setItem(KEY, c); } catch (e) { /* still works for this visit */ }
    apply();
  }

  // ---------- Decorations ----------
  // A few leaves / snowflakes / petals / seeds drifting down the screen.
  function decorate() {
    const old = document.querySelector(".season-fall-layer");
    if (old) old.remove();
    const home = !!document.querySelector(".home");
    document.body.classList.toggle("season-home", home);
    document.body.classList.toggle("season-game", !home);
    const s = now();
    if (s === "none") { updatePicker(); return; }
    const layer = document.createElement("div");
    layer.className = "season-fall-layer";
    layer.setAttribute("aria-hidden", "true");
    const count = home ? 16 : 8;   // fewer while playing, so they don't distract
    for (let i = 0; i < count; i++) {
      const bit = document.createElement("span");
      bit.className = "season-bit v" + (i % 3);
      bit.style.left = `${(i * (100 / count) + (i % 2) * 4) % 100}%`;
      bit.style.animationDelay = `${-i * 1.9}s`;
      bit.style.animationDuration = `${14 + (i % 5) * 3}s`;
      layer.appendChild(bit);
    }
    document.body.prepend(layer);
    updatePicker();
  }

  // ---------- Season picker (home screen) ----------
  let sheet = null;

  function updatePicker() {
    const btn = document.querySelector(".season-btn");
    if (!btn) return;
    const s = now();
    btn.querySelector(".season-name").textContent = NAMES[s] + (choice() === "auto" ? " (automatic)" : "");
    if (sheet) sheet.querySelectorAll(".season-opt").forEach((o) => o.setAttribute("aria-pressed", o.dataset.v === choice()));
  }

  function makePicker() {
    const home = document.querySelector(".home-header");
    if (!home) return;
    const row = document.createElement("div");
    row.className = "season-row";
    row.innerHTML = '<button type="button" class="season-btn"><span class="season-ico" aria-hidden="true"></span>' +
      '<span>Season: <b class="season-name"></b></span><span class="season-change">Change</span></button>';
    home.after(row);
    row.querySelector("button").addEventListener("click", open);

    sheet = document.createElement("div");
    sheet.className = "coin-sheet season-sheet";
    sheet.hidden = true;
    const opts = [["auto", "Automatic", "Changes with the calendar"], ["spring", "Spring", ""], ["summer", "Summer", ""],
      ["fall", "Fall", ""], ["winter", "Winter", ""], ["off", "Classic", "The original green garden"]];
    sheet.innerHTML = '<div class="coin-panel" role="dialog" aria-modal="true" aria-labelledby="seasonTitle" tabindex="-1">' +
      '<h2 id="seasonTitle">Season</h2><p>Give every game a seasonal look.</p><div class="season-opts">' +
      opts.map(([v, name, note]) => `<button type="button" class="season-opt" data-v="${v}" data-look="${v === "auto" ? fromCalendar() : v === "off" ? "none" : v}">` +
        `<span class="season-ico" aria-hidden="true"></span><b>${name}</b>${note ? `<span>${note}</span>` : ""}</button>`).join("") +
      '</div><button type="button" class="coin-done">Done</button></div>';
    document.body.appendChild(sheet);
    sheet.querySelectorAll(".season-opt").forEach((o) => o.addEventListener("click", () => { set(o.dataset.v); updatePicker(); }));
    sheet.querySelector(".coin-done").addEventListener("click", close);
    sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });
    document.addEventListener("keydown", (e) => { if (!sheet.hidden && e.key === "Escape") close(); });
    updatePicker();
  }

  function open() { sheet.hidden = false; updatePicker(); sheet.querySelector(".coin-panel").focus(); }
  function close() { sheet.hidden = true; const b = document.querySelector(".season-btn"); if (b) b.focus(); }

  // ---------- Start ----------
  document.documentElement.dataset.season = now();   // straight away, before anything is drawn
  function start() { apply(); makePicker(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  // Picked a season on the home screen? Other open games follow along.
  window.addEventListener("storage", (e) => { if (e.key === KEY) apply(); });
  window.addEventListener("pageshow", apply);

  return { now, set, choice, fromCalendar };
})();
