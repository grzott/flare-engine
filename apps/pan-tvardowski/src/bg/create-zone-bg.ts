import type { ZoneBgShaderDef } from '../visual-spec/types';
import { ZONE_BG_DEFS } from '../visual-spec/zone-bg';
import { createZoneImageBg } from './image-bg';
import { createZoneSpriteBg } from './sprite-bg';
import type { ZoneBgCamera, ZoneBgController, ZoneBgDeps } from './types';

export type { ZoneBgCamera, ZoneBgController, ZoneBgDeps };

type ZoneBgId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function createZoneBg(zoneId: string, deps: ZoneBgDeps): ZoneBgController {
  const numId = Number(zoneId.slice(1)) as ZoneBgId;
  const def: (typeof ZONE_BG_DEFS)[ZoneBgId] = ZONE_BG_DEFS[numId];
  if (!def) throw new Error(`createZoneBg: unknown zoneId ${zoneId}`);

  if (def.kind === 'image') {
    return createZoneImageBg(deps, def.scrollSpeed);
  }

  return createZoneSpriteBg(deps, def as ZoneBgShaderDef);
}
