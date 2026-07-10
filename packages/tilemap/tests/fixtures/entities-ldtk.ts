// LDtk project fixture with one Entities layer (two entities: Player + Enemy)
// and one Tiles layer, so tests can assert that tile layers are skipped.
//
// parseLDtkEntities(map) should return exactly 2 entities:
//   { id: 'Player', x: 40, y: 56, width: 16, height: 16, fields: { health: 100 } }
//   { id: 'Enemy',  x: 96, y: 32, width: 24, height: 24, fields: { patrol: true, speed: 40 } }
//
// LDtk stores layers top-first; the parser reverses them.
// layerInstances order in JSON: [Entities (top), Ground (bottom)].

export const entitiesLdtk: unknown = {
  defaultGridSize: 16,
  defs: {
    tilesets: [],
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
        // Top layer (processed last → pushed last)
        {
          __identifier: 'Entities',
          __type: 'Entities',
          __cWid: 10,
          __cHei: 8,
          __gridSize: 16,
          visible: true,
          __opacity: 1,
          entityInstances: [
            {
              __identifier: 'Player',
              __grid: [2, 3],
              __pivot: [0, 0],
              iid: 'aaa',
              width: 16,
              height: 16,
              px: [40, 56],
              fieldInstances: [{ __identifier: 'health', __value: 100, __type: 'Int' }],
            },
            {
              __identifier: 'Enemy',
              __grid: [6, 2],
              __pivot: [0, 0],
              iid: 'bbb',
              width: 24,
              height: 24,
              px: [96, 32],
              fieldInstances: [
                { __identifier: 'patrol', __value: true, __type: 'Bool' },
                { __identifier: 'speed', __value: 40, __type: 'Int' },
              ],
            },
          ],
        },
        // Bottom layer — should be skipped by parseLDtkEntities
        {
          __identifier: 'Ground',
          __type: 'Tiles',
          __cWid: 10,
          __cHei: 8,
          __gridSize: 16,
          visible: true,
          __opacity: 1,
          gridTiles: [{ px: [0, 0], src: [0, 0], f: 0, t: 0 }],
        },
      ],
    },
  ],
};
