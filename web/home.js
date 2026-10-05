// =============================================================
//  Home screen - builds one card per game from GAMES in games.js.
//  You shouldn't need to change this file to add a game.
// =============================================================

const $ = (id) => document.getElementById(id);

// Reads a game's saved stats from the phone, if it has any.
function loadStats(key) {
  if (!key) return null;
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}

// The small line under each game's description, e.g. "3 in a row".
function statusLine(game) {
  const stats = loadStats(game.statsKey);
  if (!stats || !stats.played) return "New - tap to play";
  if (stats.streak > 0) return `${stats.streak} in a row`;
  return `Played ${stats.played} ${stats.played === 1 ? "time" : "times"}`;
}

// One big tappable card for a game.
function makeCard(game) {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = `${game.folder}/index.html`;

  const icon = document.createElement("img");
  icon.className = "game-icon";
  icon.src = `${game.folder}/${game.icon}`;
  icon.alt = "";

  const text = document.createElement("div");
  text.className = "game-text";

  const name = document.createElement("span");
  name.className = "game-name";
  name.textContent = game.name;

  const description = document.createElement("span");
  description.className = "game-description";
  description.textContent = game.description;

  const status = document.createElement("span");
  status.className = "game-status";
  status.textContent = statusLine(game);

  text.append(name, description, status);

  const arrow = document.createElement("span");
  arrow.className = "game-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "›";

  card.append(icon, text, arrow);
  return card;
}

// A quiet placeholder so the list doesn't look empty with only one game.
function makeComingSoon() {
  const note = document.createElement("div");
  note.className = "coming-soon";
  note.textContent = "More games coming soon";
  return note;
}

function showHome() {
  document.title = COLLECTION_TITLE;
  $("collectionTitle").textContent = COLLECTION_TITLE;

  const list = $("gameList");
  list.innerHTML = "";
  for (const game of GAMES) list.appendChild(makeCard(game));
  list.appendChild(makeComingSoon());
}

// Shows the "Get the app" box only where the download makes sense:
// not inside the app itself (Android marks it with "; wv)"), and not on
// iPhones or iPads, which can't install Android apps.
function showDownload() {
  const agent = navigator.userAgent;
  const insideApp = /; wv\)/.test(agent);
  const isApple = /iPhone|iPad|iPod/.test(agent) ||
    (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);   // newer iPads
  $("getApp").hidden = insideApp || isApple;
}

showHome();
showDownload();

// Coming back from a game: refresh the stats line (e.g. a new streak).
window.addEventListener("pageshow", showHome);
