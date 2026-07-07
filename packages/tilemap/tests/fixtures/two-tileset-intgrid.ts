// LDtk project fixture with two tile tilesets (uid=1 and uid=7, non-contiguous
// to prove uid-sorted firstGid assignment) and one IntGrid collision layer.
//
// Tileset assignment after uid sort [1, 7]:
//   TileA (uid=1): firstGid=1,  tileCount=16
//   TileB (uid=7): firstGid=17, tileCount=16
//   Walls (IntGrid, synthetic): firstGid=33, tileCount=2 (values 1 and 2)
//
// TilesA layer: one tile at (0,0) with t=5  → stored GID = 1+5  = 6
// TilesB layer: one tile at (0,0) with t=3  → stored GID = 17+3 = 20
//
// Walls intGridCsv = [1, 2, 0, 1, 0, 2] (3×2 grid):
//   v=1 → localId=0 → GID=33 (solid by default predicate v>0)
//   v=2 → localId=1 → GID=34 (solid by default predicate v>0, or by v===2 predicate)
//   v=0 → GID=0 (empty)
//
// LDtk stores layers top-first; the parser reverses them.
// layerInstances order in JSON: [TilesB (top), TilesA, Walls (bottom)].

export const twoTilesetIntGridLdtk: unknown = {
  defaultGridSize: 16,
  defs: {
    tilesets: [
      {
        uid: 1,
        identifier: 'TileA',
        relPath: 'tile-a.png',
        pxWid: 64,
        pxHei: 64,
        tileGridSize: 16,
        __cWid: 4,
        __cHei: 4,
      },
      {
        uid: 7,
        identifier: 'TileB',
        relPath: 'tile-b.png',
        pxWid: 64,
        pxHei: 64,
        tileGridSize: 16,
        __cWid: 4,
        __cHei: 4,
      },
    ],
  },
  levels: [
    {
      identifier: 'Level_0',
      uid: 0,
      pxWid: 160,
      pxHei: 128,
      worldX: 0,
      worldY: 0,
      layerInstances: [
        // Top layer (processed last → pushed last → map.layers[2])
        {
          __identifier: 'TilesB',
          __type: 'Tiles',
          __cWid: 10,
          __cHei: 8,
          __gridSize: 16,
          __tilesetDefUid: 7,
          __tilesetRelPath: 'tile-b.png',
          visible: true,
          __opacity: 1,
          gridTiles: [{ px: [0, 0], src: [48, 0], f: 0, t: 3 }],
        },
        // Middle layer (processed second → map.layers[1])
        {
          __identifier: 'TilesA',
          __type: 'Tiles',
          __cWid: 10,
          __cHei: 8,
          __gridSize: 16,
          __tilesetDefUid: 1,
          __tilesetRelPath: 'tile-a.png',
          visible: true,
          __opacity: 1,
          gridTiles: [{ px: [0, 0], src: [80, 0], f: 0, t: 5 }],
        },
        // Bottom layer (processed first → map.layers[0])
        {
          __identifier: 'Walls',
          __type: 'IntGrid',
          __cWid: 3,
          __cHei: 2,
          __gridSize: 16,
          visible: true,
          __opacity: 1,
          intGridCsv: [1, 2, 0, 1, 0, 2],
        },
      ],
    },
  ],
};
