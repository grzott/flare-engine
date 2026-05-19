/**
 * Per-boss rim-light definitions.
 *
 * Each entry maps a boss EntityId to the SkSL shadow-rim pass parameters.
 * Colors are derived from the zone palette (sky / primary / accent tokens)
 * so the light hue reads as native to each zone.
 *
 * bossDiscRadius matches the boss hull r from visual-spec/shapes-catalogue.ts.
 * falloffRadius is tuned so the light reaches roughly 3× the hull edge.
 */

import type { RimLightDef } from './types';

export const RIM_LIGHT_DEFS: Readonly<Record<string, RimLightDef>> = Object.freeze({
  // Z1 — Dachy Krakowa — terracotta sky, ember ambience
  // Warm amber — parity-exact with prior hardcoded constants.
  'smok-krzemionkowski': {
    colorR: 1.0,
    colorG: 0.72,
    colorB: 0.25,
    intensity: 1.8,
    falloffRadius: 160,
    bossDiscRadius: 48,
  },

  // Z2 — Puszcza Mazowiecka — moss sky, pollen ambience
  // Cool forest-green with a pale-bone highlight, boss hull r=52.
  'borowy-krol': {
    colorR: 0.45,
    colorG: 0.72,
    colorB: 0.35,
    intensity: 1.6,
    falloffRadius: 172,
    bossDiscRadius: 52,
  },

  // Z3 — Wisła — verdigris sky, spray ambience
  // Teal-blue water, boss hull r=44.
  'wodnik-wislanny': {
    colorR: 0.2,
    colorG: 0.65,
    colorB: 0.65,
    intensity: 1.6,
    falloffRadius: 156,
    bossDiscRadius: 44,
  },

  // Z4 — Łęczyckie Błota — moss sky, hazard accent, ember ambience
  // Hot amber-orange swamp fire, boss hull r=50.
  boruta: {
    colorR: 1.0,
    colorG: 0.45,
    colorB: 0.1,
    intensity: 1.9,
    falloffRadius: 165,
    bossDiscRadius: 50,
  },

  // Z5 — Łysa Góra — crimson-deep sky, ash ambience
  // Deep volcanic crimson, boss hull r=48 (ngon-3).
  'baba-jaga': {
    colorR: 0.85,
    colorG: 0.1,
    colorB: 0.15,
    intensity: 2.0,
    falloffRadius: 160,
    bossDiscRadius: 48,
  },

  // Z6 — Katakumby — bone accent, dust ambience
  // Pale bone torch-light, boss hull r=52.
  'bazyliszek-warszawski': {
    colorR: 0.82,
    colorG: 0.75,
    colorB: 0.62,
    intensity: 1.5,
    falloffRadius: 172,
    bossDiscRadius: 52,
  },

  // Z7 — Karczma "Rzym" — rust sky, gold ground, smoke ambience
  // Warm hearth-gold, boss hull r=50 (star-6).
  mefistofeles: {
    colorR: 0.9,
    colorG: 0.65,
    colorB: 0.15,
    intensity: 1.7,
    falloffRadius: 165,
    bossDiscRadius: 50,
  },

  // Z8 — Księżyc — bone/silver sky, lunar ink accent
  // Cool silver-blue moonlight, boss hull r=54 (star-8).
  'lucyper-ksiezycowy': {
    colorR: 0.7,
    colorG: 0.72,
    colorB: 0.95,
    intensity: 1.6,
    falloffRadius: 178,
    bossDiscRadius: 54,
  },
});
