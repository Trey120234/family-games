// =============================================================
//  Mahjong - board shapes.
//
//  A board is a stack of layers. Each layer is a block of tiles:
//    z     - which layer (0 = the table, 1 = on top of that, ...)
//    x, y  - where the block starts, in HALF-tile steps
//            (so x: 1 means "half a tile to the right")
//    cols, rows - how many tiles across and down
//  The total number of tiles must be even (they're removed in pairs).
// =============================================================

const LAYOUTS = {
  pyramid: {
    name: "Pyramid",
    blocks: [
      { z: 0, x: 0, y: 0, cols: 7, rows: 6 },   // 42 tiles on the table
      { z: 1, x: 2, y: 2, cols: 5, rows: 4 },   // 20 on top of those
      { z: 2, x: 4, y: 4, cols: 3, rows: 2 },   //  6 at the top
    ],                                          // = 68 tiles, 34 pairs
  },
};

// The board used for every game (step 2 will add a way to choose).
const DEFAULT_LAYOUT = "pyramid";
