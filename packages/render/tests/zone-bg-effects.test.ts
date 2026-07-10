import { describe, expect, it } from 'bun:test';
import {
  type AnySpriteEffect,
  CAVE_INTERIOR_SKSL,
  type CaveInteriorEffect,
  caveInterior,
  FOREST_CANOPY_SKSL,
  type ForestCanopyEffect,
  forestCanopy,
  MOON_CRATER_SKSL,
  MOUNTAIN_HILLS_SKSL,
  type MoonCraterEffect,
  type MountainHillsEffect,
  moonCrater,
  mountainHills,
  RIVER_WAVE_SKSL,
  type RiverWaveEffect,
  ROOFS_CITY_SKSL,
  type RoofsCityEffect,
  riverWave,
  roofsCity,
  type SpriteColor,
  updateEffect,
} from '../src/index.js';

const dark: SpriteColor = { r: 0.05, g: 0.05, b: 0.1, a: 1 };
const light: SpriteColor = { r: 0.8, g: 0.8, b: 0.9, a: 1 };
const green: SpriteColor = { r: 0.1, g: 0.5, b: 0.1, a: 1 };
const blue: SpriteColor = { r: 0.1, g: 0.3, b: 0.7, a: 1 };
const foam: SpriteColor = { r: 0.9, g: 0.9, b: 1.0, a: 1 };
const gray: SpriteColor = { r: 0.6, g: 0.6, b: 0.6, a: 1 };
const rust: SpriteColor = { r: 0.3, g: 0.2, b: 0.1, a: 1 };
const cave: SpriteColor = { r: 0.05, g: 0.03, b: 0.02, a: 1 };
const amber: SpriteColor = { r: 0.9, g: 0.6, b: 0.1, a: 1 };
const sky: SpriteColor = { r: 0.4, g: 0.6, b: 0.9, a: 1 };
const hill: SpriteColor = { r: 0.2, g: 0.4, b: 0.2, a: 1 };

describe('roofsCity', () => {
  it('factory returns correct type', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light });
    expect(e.type).toBe('roofs-city');
  });

  it('factory applies defaults for scrollOffsetY and density', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.density).toBe(6);
  });

  it('factory passes explicit overrides', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light, scrollOffsetY: 120, density: 10 });
    expect(e.scrollOffsetY).toBe(120);
    expect(e.density).toBe(10);
  });

  it('factory preserves color references', () => {
    const e = roofsCity({ skyColor: dark, roofColor: light });
    expect(e.skyColor).toBe(dark);
    expect(e.roofColor).toBe(light);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: RoofsCityEffect = roofsCity({ skyColor: dark, roofColor: light, scrollOffsetY: 50 });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('ROOFS_CITY_SKSL contains required uniforms and entry point', () => {
    expect(ROOFS_CITY_SKSL).toContain('scrollOffsetY');
    expect(ROOFS_CITY_SKSL).toContain('resolution');
    expect(ROOFS_CITY_SKSL).toContain('density');
    expect(ROOFS_CITY_SKSL).toContain('half4 main');
  });
});

describe('forestCanopy', () => {
  it('factory returns correct type', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green });
    expect(e.type).toBe('forest-canopy');
  });

  it('factory applies defaults for scrollOffsetY and density', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.density).toBe(5);
  });

  it('factory passes explicit overrides', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green, scrollOffsetY: 80, density: 8 });
    expect(e.scrollOffsetY).toBe(80);
    expect(e.density).toBe(8);
  });

  it('factory preserves color references', () => {
    const e = forestCanopy({ skyColor: sky, leafColor: green });
    expect(e.skyColor).toBe(sky);
    expect(e.leafColor).toBe(green);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: ForestCanopyEffect = forestCanopy({
      skyColor: sky,
      leafColor: green,
      scrollOffsetY: 30,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('FOREST_CANOPY_SKSL contains required uniforms and entry point', () => {
    expect(FOREST_CANOPY_SKSL).toContain('scrollOffsetY');
    expect(FOREST_CANOPY_SKSL).toContain('resolution');
    expect(FOREST_CANOPY_SKSL).toContain('density');
    expect(FOREST_CANOPY_SKSL).toContain('half4 main');
  });
});

describe('riverWave', () => {
  it('factory returns correct type', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam });
    expect(e.type).toBe('river-wave');
  });

  it('factory applies defaults for scrollOffsetY and waveScale', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.waveScale).toBe(2);
  });

  it('factory passes explicit overrides', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam, scrollOffsetY: 60, waveScale: 3 });
    expect(e.scrollOffsetY).toBe(60);
    expect(e.waveScale).toBe(3);
  });

  it('factory preserves color references', () => {
    const e = riverWave({ waterColor: blue, foamColor: foam });
    expect(e.waterColor).toBe(blue);
    expect(e.foamColor).toBe(foam);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: RiverWaveEffect = riverWave({ waterColor: blue, foamColor: foam, scrollOffsetY: 20 });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('RIVER_WAVE_SKSL contains required uniforms and entry point', () => {
    expect(RIVER_WAVE_SKSL).toContain('scrollOffsetY');
    expect(RIVER_WAVE_SKSL).toContain('resolution');
    expect(RIVER_WAVE_SKSL).toContain('waveScale');
    expect(RIVER_WAVE_SKSL).toContain('half4 main');
  });
});

describe('moonCrater', () => {
  it('factory returns correct type', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust });
    expect(e.type).toBe('moon-crater');
  });

  it('factory applies defaults for scrollOffsetY and craterCount', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.craterCount).toBe(4);
  });

  it('factory passes explicit overrides', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust, scrollOffsetY: 40, craterCount: 6 });
    expect(e.scrollOffsetY).toBe(40);
    expect(e.craterCount).toBe(6);
  });

  it('factory preserves color references', () => {
    const e = moonCrater({ moonColor: gray, craterColor: rust });
    expect(e.moonColor).toBe(gray);
    expect(e.craterColor).toBe(rust);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: MoonCraterEffect = moonCrater({
      moonColor: gray,
      craterColor: rust,
      scrollOffsetY: 10,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('MOON_CRATER_SKSL contains required uniforms and entry point', () => {
    expect(MOON_CRATER_SKSL).toContain('scrollOffsetY');
    expect(MOON_CRATER_SKSL).toContain('resolution');
    expect(MOON_CRATER_SKSL).toContain('craterCount');
    expect(MOON_CRATER_SKSL).toContain('half4 main');
  });
});

describe('caveInterior', () => {
  it('factory returns correct type', () => {
    const e = caveInterior({ caveColor: cave, glowColor: amber });
    expect(e.type).toBe('cave-interior');
  });

  it('factory applies defaults for scrollOffsetY and stalactiteCount', () => {
    const e = caveInterior({ caveColor: cave, glowColor: amber });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.stalactiteCount).toBe(8);
  });

  it('factory passes explicit overrides', () => {
    const e = caveInterior({
      caveColor: cave,
      glowColor: amber,
      scrollOffsetY: 90,
      stalactiteCount: 12,
    });
    expect(e.scrollOffsetY).toBe(90);
    expect(e.stalactiteCount).toBe(12);
  });

  it('factory preserves color references', () => {
    const e = caveInterior({ caveColor: cave, glowColor: amber });
    expect(e.caveColor).toBe(cave);
    expect(e.glowColor).toBe(amber);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: CaveInteriorEffect = caveInterior({
      caveColor: cave,
      glowColor: amber,
      scrollOffsetY: 55,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('CAVE_INTERIOR_SKSL contains required uniforms and entry point', () => {
    expect(CAVE_INTERIOR_SKSL).toContain('scrollOffsetY');
    expect(CAVE_INTERIOR_SKSL).toContain('resolution');
    expect(CAVE_INTERIOR_SKSL).toContain('stalactiteCount');
    expect(CAVE_INTERIOR_SKSL).toContain('half4 main');
  });
});

describe('mountainHills', () => {
  it('factory returns correct type', () => {
    const e = mountainHills({ skyColor: sky, hillColor: hill });
    expect(e.type).toBe('mountain-hills');
  });

  it('factory applies defaults for scrollOffsetY and ridgeScale', () => {
    const e = mountainHills({ skyColor: sky, hillColor: hill });
    expect(e.scrollOffsetY).toBe(0);
    expect(e.ridgeScale).toBe(1.5);
  });

  it('factory passes explicit overrides', () => {
    const e = mountainHills({
      skyColor: sky,
      hillColor: hill,
      scrollOffsetY: 100,
      ridgeScale: 2.5,
    });
    expect(e.scrollOffsetY).toBe(100);
    expect(e.ridgeScale).toBe(2.5);
  });

  it('factory preserves color references', () => {
    const e = mountainHills({ skyColor: sky, hillColor: hill });
    expect(e.skyColor).toBe(sky);
    expect(e.hillColor).toBe(hill);
  });

  it('updateEffect is time-invariant — returns same reference', () => {
    const e: MountainHillsEffect = mountainHills({
      skyColor: sky,
      hillColor: hill,
      scrollOffsetY: 75,
    });
    expect(updateEffect(e, 0.016)).toBe(e);
    expect(updateEffect(e, 99)).toBe(e);
  });

  it('MOUNTAIN_HILLS_SKSL contains required uniforms and entry point', () => {
    expect(MOUNTAIN_HILLS_SKSL).toContain('scrollOffsetY');
    expect(MOUNTAIN_HILLS_SKSL).toContain('resolution');
    expect(MOUNTAIN_HILLS_SKSL).toContain('ridgeScale');
    expect(MOUNTAIN_HILLS_SKSL).toContain('half4 main');
  });
});

describe('AnySpriteEffect — zone bg arms in exhaustive switch', () => {
  it('discriminates all 6 zone-bg effect types', () => {
    const effects: AnySpriteEffect[] = [
      roofsCity({ skyColor: dark, roofColor: light }),
      forestCanopy({ skyColor: sky, leafColor: green }),
      riverWave({ waterColor: blue, foamColor: foam }),
      moonCrater({ moonColor: gray, craterColor: rust }),
      caveInterior({ caveColor: cave, glowColor: amber }),
      mountainHills({ skyColor: sky, hillColor: hill }),
    ];
    const matched: string[] = [];
    for (const e of effects) {
      switch (e.type) {
        case 'roofs-city':
          matched.push(`roofs-city:${e.density}`);
          break;
        case 'forest-canopy':
          matched.push(`forest-canopy:${e.density}`);
          break;
        case 'river-wave':
          matched.push(`river-wave:${e.waveScale}`);
          break;
        case 'moon-crater':
          matched.push(`moon-crater:${e.craterCount}`);
          break;
        case 'cave-interior':
          matched.push(`cave-interior:${e.stalactiteCount}`);
          break;
        case 'mountain-hills':
          matched.push(`mountain-hills:${e.ridgeScale}`);
          break;
        default:
          matched.push('other');
      }
    }
    expect(matched).toEqual([
      'roofs-city:6',
      'forest-canopy:5',
      'river-wave:2',
      'moon-crater:4',
      'cave-interior:8',
      'mountain-hills:1.5',
    ]);
  });
});
