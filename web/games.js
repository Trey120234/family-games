// =============================================================
//  The list of games on the home screen.
//
//  To add a new game:
//    1. Make a folder for it inside "games" (copy word-garden to start).
//    2. Add an entry below, in the same shape as Word Garden's.
//  Games show on the home screen in the order they're listed here.
// =============================================================

// Name shown at the top of the home screen.
const COLLECTION_TITLE = "Games";

const GAMES = [
  {
    name: "Word Garden",
    description: "Guess the hidden 5-letter word in 6 tries.",
    folder: "games/word-garden",   // where the game's files live
    icon: "icon.png",              // picture inside that folder
    statsKey: "wg-stats",          // where the game saves its stats (optional)
  },

  {
    name: "Word Builder",
    description: "Spell 7 hidden words from the same 7 letters.",
    folder: "games/word-builder",
    icon: "icon.png",
    statsKey: "wb-stats",
  },

  {
    name: "Mahjong",
    description: "Match pairs of tiles to clear the board.",
    folder: "games/mahjong",
    icon: "icon.png",
    statsKey: "mj-stats",
  },

  // Next game goes here, for example:
  // {
  //   name: "Number Puzzle",
  //   description: "Slide the tiles into order.",
  //   folder: "games/number-puzzle",
  //   icon: "icon.png",
  // },
];
