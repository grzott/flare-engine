import { describe, expect, test } from 'bun:test';
import {
  BLOOM_SKSL,
  CHROMATIC_ABERRATION_SKSL,
  COLOR_GRADING_LUT_SKSL,
  COMPOSITE_SKSL,
  CRT_SKSL,
  GOD_RAYS_SKSL,
  GRAYSCALE_FLASH_SKSL,
  VIGNETTE_SKSL,
  WEATHER_CLOUDS_SKSL,
  WEATHER_DARK_VIGNETTE_SKSL,
  WEATHER_RAIN_SKSL,
  WEATHER_SUN_SHAFT_SKSL,
} from '../src/shaders.js';
import {
  BLOOM_SKSL_SNAPSHOT,
  CHROMATIC_ABERRATION_SKSL_SNAPSHOT,
  COLOR_GRADING_LUT_SKSL_SNAPSHOT,
  CRT_SKSL_SNAPSHOT,
  GOD_RAYS_SKSL_SNAPSHOT,
  GRAYSCALE_FLASH_SKSL_SNAPSHOT,
  VIGNETTE_SKSL_SNAPSHOT,
  WEATHER_CLOUDS_SKSL_SNAPSHOT,
  WEATHER_DARK_VIGNETTE_SKSL_SNAPSHOT,
  WEATHER_RAIN_SKSL_SNAPSHOT,
  WEATHER_SUN_SHAFT_SKSL_SNAPSHOT,
} from './fixtures/standalone-sksl.js';

// ── 1. Standalone shader strings are byte-identical to their pinned copies ───

describe('standalone SkSL strings are byte-identical to the pinned copies', () => {
  const pinned: ReadonlyArray<readonly [name: string, actual: string, snapshot: string]> = [
    ['WEATHER_RAIN_SKSL', WEATHER_RAIN_SKSL, WEATHER_RAIN_SKSL_SNAPSHOT],
    ['WEATHER_SUN_SHAFT_SKSL', WEATHER_SUN_SHAFT_SKSL, WEATHER_SUN_SHAFT_SKSL_SNAPSHOT],
    ['WEATHER_DARK_VIGNETTE_SKSL', WEATHER_DARK_VIGNETTE_SKSL, WEATHER_DARK_VIGNETTE_SKSL_SNAPSHOT],
    ['WEATHER_CLOUDS_SKSL', WEATHER_CLOUDS_SKSL, WEATHER_CLOUDS_SKSL_SNAPSHOT],
    ['VIGNETTE_SKSL', VIGNETTE_SKSL, VIGNETTE_SKSL_SNAPSHOT],
    ['GRAYSCALE_FLASH_SKSL', GRAYSCALE_FLASH_SKSL, GRAYSCALE_FLASH_SKSL_SNAPSHOT],
    ['CHROMATIC_ABERRATION_SKSL', CHROMATIC_ABERRATION_SKSL, CHROMATIC_ABERRATION_SKSL_SNAPSHOT],
    ['CRT_SKSL', CRT_SKSL, CRT_SKSL_SNAPSHOT],
    ['BLOOM_SKSL', BLOOM_SKSL, BLOOM_SKSL_SNAPSHOT],
    ['COLOR_GRADING_LUT_SKSL', COLOR_GRADING_LUT_SKSL, COLOR_GRADING_LUT_SKSL_SNAPSHOT],
    ['GOD_RAYS_SKSL', GOD_RAYS_SKSL, GOD_RAYS_SKSL_SNAPSHOT],
  ];

  for (const [name, actual, snapshot] of pinned) {
    test(name, () => {
      expect(snapshot.length).toBeGreaterThan(100);
      expect(actual).toBe(snapshot);
    });
  }
});

// ── 2. Composite weather branches are the standalone bodies, renamed ─────────

/** Lines of `source` strictly between the line equal to `after` and the line starting with `before`. */
function linesBetween(source: string, after: string, before: string): string[] {
  const lines = source.split('\n');
  const from = lines.indexOf(after);
  const to = lines.findIndex((line, i) => i > from && line.startsWith(before));
  if (from < 0 || to <= from + 1)
    throw new Error(`body not found between "${after}" and "${before}"`);
  return lines.slice(from + 1, to);
}

/** Renames whole identifiers; a rename target is never itself a rename source, so one pass is exact. */
function rename(text: string, names: Readonly<Record<string, string>>): string {
  return text.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (id) => names[id] ?? id);
}

/** Re-indents a standalone body (2 spaces) to the depth of a composite weather branch (6 spaces). */
const nest = (lines: readonly string[]): string =>
  lines.map((line) => (line === '' ? line : `    ${line}`)).join('\n');

/** The expression inside `half4(<expr>, scene.a)` on the standalone's return line. */
function returnedRgb(source: string): string {
  const match = /^ {2}return half4\((.*), scene\.a\);$/m.exec(source);
  if (!match?.[1]) throw new Error('standalone return line not found');
  return match[1];
}

/** One composite weather branch: from its guard line up to the next guard or the closing brace. */
function compositeBranch(guard: string): string {
  const lines = COMPOSITE_SKSL.split('\n');
  const from = lines.findIndex((line) => line.includes(guard));
  const to = lines.findIndex((line, i) => i > from && line.startsWith('    }'));
  if (from < 0 || to <= from) throw new Error(`composite branch "${guard}" not found`);
  return lines.slice(from + 1, to).join('\n');
}

const UV_LINE = '  float2 uv = coord / resolution;';
const SCENE_LINE = '  half4 scene = src.eval(coord);';

describe('COMPOSITE_SKSL weather branches are built from the standalone bodies', () => {
  test('rain: branch is the standalone body with the composite uniform names', () => {
    const names = {
      direction: 'weatherDirection',
      scrollOffsetY: 'weatherScrollY',
      density: 'weatherDensity',
      streakLen: 'weatherStreakLen',
      intensity: 'weatherIntensity',
      color: 'weatherColor',
      scene: 'c',
    };
    const body = linesBetween(WEATHER_RAIN_SKSL, UV_LINE, '  half3 mixed = ');
    expect(body.length).toBe(48);
    const blend = /^ {2}half3 mixed = (.*);$/m.exec(WEATHER_RAIN_SKSL)?.[1];
    if (!blend) throw new Error('rain blend line not found');
    const expected = `${nest(rename(body.join('\n'), names).split('\n'))}\n      c = ${rename(blend, names).replace('c.rgb', 'c')};`;
    expect(compositeBranch('wk >= 0.5 && wk < 1.5')).toEndWith(expected);
    expect(expected).toContain('mix(c, half3(weatherColor), half(coverage * weatherIntensity))');
  });

  test('sun-shaft: branch is the standalone body with the composite uniform names', () => {
    const names = { direction: 'weatherDirection', intensity: 'weatherIntensity', scene: 'c' };
    const body = linesBetween(WEATHER_SUN_SHAFT_SKSL, UV_LINE, '  return ');
    expect(body.length).toBe(8);
    const blend = rename(returnedRgb(WEATHER_SUN_SHAFT_SKSL), names).replace('c.rgb', 'c');
    const expected = `${nest(rename(body.join('\n'), names).split('\n'))}\n      c = ${blend};`;
    expect(compositeBranch('wk >= 1.5 && wk < 2.5')).toEndWith(expected);
  });

  test('dark-vignette: branch is the standalone body, centred UV renamed to uvShift', () => {
    // The standalone centres its only UV local (`uv`); the composite keeps `uv` as the 0..1 UV
    // it computed up front, so the centred copy takes another name and reads that `uv`.
    const names = { uv: 'uvShift', intensity: 'weatherIntensity', scene: 'c' };
    const body = linesBetween(WEATHER_DARK_VIGNETTE_SKSL, SCENE_LINE, '  return ');
    expect(body.length).toBe(4);
    const ported = rename(body.join('\n'), names).replace('coord / resolution - 0.5', 'uv - 0.5');
    const blend = rename(returnedRgb(WEATHER_DARK_VIGNETTE_SKSL), names).replace('c.rgb', 'c');
    const expected = `${nest(ported.split('\n'))}\n      c = ${blend};`;
    expect(expected).toContain('float2 uvShift = uv - 0.5;');
    expect(compositeBranch('wk >= 2.5 && wk < 3.5')).toEndWith(expected);
  });

  test('clouds: branch is the standalone body with the composite uniform names', () => {
    const names = {
      direction: 'weatherDirection',
      scrollOffsetX: 'weatherScrollX',
      intensity: 'weatherIntensity',
      scene: 'c',
    };
    const body = linesBetween(WEATHER_CLOUDS_SKSL, UV_LINE, '  return ');
    expect(body.length).toBe(11);
    const blend = rename(returnedRgb(WEATHER_CLOUDS_SKSL), names).replace('c.rgb', 'c');
    const expected = `${nest(rename(body.join('\n'), names).split('\n'))}\n      c = ${blend};`;
    expect(compositeBranch('wk >= 3.5')).toEndWith(expected);
  });

  test('the composite shares the standalone helper functions verbatim', () => {
    const helpers = linesBetween(
      WEATHER_CLOUDS_SKSL,
      'uniform float direction;',
      'half4 main(',
    ).join('\n');
    expect(helpers).toContain('float hash(');
    expect(helpers).toContain('float vnoise(');
    expect(helpers).toContain('float fbm(');
    expect(COMPOSITE_SKSL).toContain(helpers);
  });
});

// ── 3. Composite uniform declarations — the slot order packUniforms relies on ─

describe('COMPOSITE_SKSL uniform declarations', () => {
  test('are declared in packed-slot order, with nothing added or removed', () => {
    const declared = COMPOSITE_SKSL.split('\n').filter((line) => line.startsWith('uniform '));
    expect(declared).toEqual([
      'uniform shader src;',
      'uniform float2 resolution;',
      'uniform float vignetteIntensity;',
      'uniform float vignetteRadius;',
      'uniform float3 vignetteColor;',
      'uniform float bloomThreshold;',
      'uniform float bloomIntensity;',
      'uniform float flashIntensity;',
      'uniform float chromaAmount;',
      'uniform float crtScanlineIntensity;',
      'uniform float crtCurvature;',
      'uniform float crtEnabled;',
      'uniform float weatherKind;',
      'uniform float weatherIntensity;',
      'uniform float weatherDirection;',
      'uniform float weatherScrollX;',
      'uniform float weatherScrollY;',
      'uniform float3 weatherColor;',
      'uniform float weatherDensity;',
      'uniform float weatherStreakLen;',
    ]);
    expect(COMPOSITE_SKSL.match(/\buniform\b/g)?.length).toBe(20);
  });
});
