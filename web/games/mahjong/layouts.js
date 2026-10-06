// =============================================================
//  Mahjong - board shapes.
//
//  A board is a stack of layers. Each layer is made of blocks of tiles:
//    z     - which layer (0 = the table, 1 = on top of that, ...)
//    x, y  - where the block starts, in HALF-tile steps
//            (so x: 1 means "half a tile to the right")
//    cols, rows - how many tiles across and down
//  The total number of tiles must be even (they're removed in pairs).
//  Every board fits in 7 tiles across and 6 down, so tiles stay big.
//
//  Each new board uses the next shape in this list, in order.
//  To add a shape, copy one, give it a new name and change the blocks.
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

  diamond: {
    name: "Diamond",
    blocks: [
      { z: 0, x: 4, y: 0,  cols: 3, rows: 1 },  // table: a diamond, widest in the middle
      { z: 0, x: 2, y: 2,  cols: 5, rows: 1 },
      { z: 0, x: 0, y: 4,  cols: 7, rows: 2 },
      { z: 0, x: 2, y: 8,  cols: 5, rows: 1 },
      { z: 0, x: 4, y: 10, cols: 3, rows: 1 },  // 3 + 5 + 14 + 5 + 3 = 30
      { z: 1, x: 4, y: 2,  cols: 3, rows: 1 },  // second layer: a smaller diamond
      { z: 1, x: 2, y: 4,  cols: 5, rows: 2 },
      { z: 1, x: 4, y: 8,  cols: 3, rows: 1 },  // 3 + 10 + 3 = 16
      { z: 2, x: 4, y: 4,  cols: 3, rows: 2 },  // 6
      { z: 3, x: 5, y: 5,  cols: 2, rows: 1 },  // 2 at the very top
    ],                                          // = 54 tiles, 27 pairs
  },

  castle: {
    name: "Castle",
    blocks: [
      { z: 0, x: 0,  y: 0, cols: 7, rows: 6 },  // 42 tiles on the table
      { z: 1, x: 0,  y: 0, cols: 2, rows: 2 },  // a tower in each corner
      { z: 1, x: 10, y: 0, cols: 2, rows: 2 },
      { z: 1, x: 0,  y: 8, cols: 2, rows: 2 },
      { z: 1, x: 10, y: 8, cols: 2, rows: 2 },  // 16
      { z: 1, x: 4,  y: 4, cols: 3, rows: 2 },  // a keep in the middle: 6
      { z: 2, x: 1,  y: 1, cols: 1, rows: 1 },  // tower tops
      { z: 2, x: 11, y: 1, cols: 1, rows: 1 },
      { z: 2, x: 1,  y: 9, cols: 1, rows: 1 },
      { z: 2, x: 11, y: 9, cols: 1, rows: 1 },  // 4
    ],                                          // = 68 tiles, 34 pairs
  },

  bridge: {
    name: "Bridge",
    blocks: [
      { z: 0, x: 0,  y: 0, cols: 2, rows: 6 },  // two pillars
      { z: 0, x: 10, y: 0, cols: 2, rows: 6 },  // 24
      { z: 0, x: 4,  y: 0, cols: 3, rows: 2 },  // the span between them: 6
      { z: 1, x: 0,  y: 0, cols: 7, rows: 1 },  // the road across the top: 7
      { z: 1, x: 0,  y: 2, cols: 2, rows: 4 },  // pillars, second layer
      { z: 1, x: 10, y: 2, cols: 2, rows: 4 },  // 16
      { z: 2, x: 2,  y: 0, cols: 5, rows: 1 },  // railing: 5
    ],                                          // = 58 tiles, 29 pairs
  },

  flower: {
    name: "Flower",
    blocks: [
      { z: 0, x: 0,  y: 4, cols: 7, rows: 2 },  // petals across: 14
      { z: 0, x: 4,  y: 0, cols: 3, rows: 2 },  // petal at the top: 6
      { z: 0, x: 4,  y: 8, cols: 3, rows: 2 },  // petal at the bottom: 6
      { z: 0, x: 0,  y: 0, cols: 2, rows: 2 },  // leaves in the corners
      { z: 0, x: 10, y: 0, cols: 2, rows: 2 },
      { z: 0, x: 0,  y: 8, cols: 2, rows: 2 },
      { z: 0, x: 10, y: 8, cols: 2, rows: 2 },  // 16
      { z: 1, x: 2,  y: 4, cols: 5, rows: 2 },  // 10
      { z: 1, x: 4,  y: 2, cols: 3, rows: 1 },  // 3
      { z: 1, x: 4,  y: 8, cols: 3, rows: 1 },  // 3
      { z: 2, x: 4,  y: 4, cols: 3, rows: 2 },  // 6
      { z: 3, x: 5,  y: 5, cols: 2, rows: 1 },  // the middle of the flower: 2
    ],                                          // = 66 tiles, 33 pairs
  },
};

// The order boards come in. Each new board uses the next shape.
const LAYOUT_ORDER = ["pyramid", "diamond", "castle", "bridge", "flower"];
