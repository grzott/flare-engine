// Two-tileset Tiled .tmj fixture with flip-bit GIDs in the tile layer.
//
// Tilesets:
//   terrain  firstgid=1   tilecount=16  4 columns  (no solid tiles)
//   props    firstgid=17  tilecount=16  4 columns  (local id 2 → solid, type:'solid')
//
// Props global GID 19 = 17 + 2 (solid tile).
// The data array includes all four flip-bit combinations added into GID 19,
// mirroring the real unsigned values Tiled exports into JSON.
//
// Flip-bit constants (Tiled spec), used via arithmetic addition (+) so values
// remain positive float64 as Tiled writes them — NOT bitwise OR (which would
// produce JS int32 negatives that don't match the real on-disk representation).
//   FLIP_H = 0x80000000  (2147483648)
//   FLIP_V = 0x40000000  (1073741824)
//   FLIP_D = 0x20000000   (536870912)

const GID_19 = 19;
const FLIP_H = 0x80000000; // 2147483648
const FLIP_V = 0x40000000; // 1073741824
const FLIP_D = 0x20000000; //  536870912

export const twoTilesetFlippedTmj: unknown = {
  width: 4,
  height: 2,
  tilewidth: 16,
  tileheight: 16,
  orientation: 'orthogonal',
  properties: [],
  tilesets: [
    {
      firstgid: 1,
      name: 'terrain',
      tilewidth: 16,
      tileheight: 16,
      columns: 4,
      tilecount: 16,
      image: 'terrain.png',
      imagewidth: 64,
      imageheight: 64,
    },
    {
      firstgid: 17,
      name: 'props',
      tilewidth: 16,
      tileheight: 16,
      columns: 4,
      tilecount: 16,
      image: 'props.png',
      imagewidth: 64,
      imageheight: 64,
      tiles: [{ id: 2, type: 'solid' }],
    },
  ],
  layers: [
    {
      type: 'tilelayer',
      name: 'ground',
      width: 4,
      height: 2,
      visible: true,
      opacity: 1,
      data: [
        GID_19, // (0,0) unflipped: 19
        GID_19 + FLIP_H, // (1,0) H-flipped: 2147483667 (real unsigned)
        GID_19 + FLIP_V, // (2,0) V-flipped: 1073741843
        GID_19 + FLIP_D, // (3,0) D-flipped:  536870931
        GID_19 + FLIP_H + FLIP_V + FLIP_D, // (0,1) all-flipped: 3758096403
        1, // (1,1) terrain tile — not solid
        0, // (2,1) empty
        0, // (3,1) empty
      ],
    },
  ],
};
