/**
 * Pan Twardowski dialogue graphs (build plan §13).
 *
 * Each graph stores **localization keys** (not rendered text) as node `text`
 * and `speaker` fields. The dialogue overlay resolves them through the
 * LocalizationManager at render time, so PL/EN switch live without rebuilding
 * graphs.
 *
 * `speakerPortraitKey` maps to an entry in `portrait-manifest.ts` and is
 * forwarded verbatim by the runner to `DialogueLineEvent.speakerPortraitKey`.
 */

import { type DialogueGraph, createDialogueGraph } from '@flare-engine/dialogue';

/** Opening cutscene: King Zygmunt I briefs Twardowski. Shown once per save. */
export const OPENING_GRAPH_ID = 'opening';

export function createOpeningGraph(): DialogueGraph {
  return createDialogueGraph(OPENING_GRAPH_ID, 'king1', {
    king1: {
      kind: 'line',
      speaker: 'dialogue.speaker.king',
      speakerPortraitKey: 'portrait.king',
      text: 'dialogue.opening.king.1',
      next: 'twardowski1',
    },
    twardowski1: {
      kind: 'line',
      speaker: 'dialogue.speaker.twardowski',
      speakerPortraitKey: 'portrait.twardowski',
      text: 'dialogue.opening.twardowski.1',
      next: 'king2',
    },
    king2: {
      kind: 'line',
      speaker: 'dialogue.speaker.king',
      speakerPortraitKey: 'portrait.king',
      text: 'dialogue.opening.king.2',
      next: null,
    },
  });
}

/** Zone-4 defeated Boruta taunts Twardowski. Shown once after Boruta is defeated. */
export const ZONE4_BORUTA_GRAPH_ID = 'zone4-boruta';

export function createZone4BorutaGraph(): DialogueGraph {
  return createDialogueGraph(ZONE4_BORUTA_GRAPH_ID, 'boruta1', {
    boruta1: {
      kind: 'line',
      speaker: 'dialogue.speaker.boruta',
      speakerPortraitKey: 'portrait.boruta',
      text: 'dialogue.zone4.boruta.1',
      next: null,
    },
  });
}

/** Zone-7 entry dialogue: Innkeeper greets Twardowski at Karczma "Rzym". */
export const ZONE7_ENTRY_GRAPH_ID = 'zone7-entry';

export function createZone7EntryGraph(): DialogueGraph {
  return createDialogueGraph(ZONE7_ENTRY_GRAPH_ID, 'innkeeper1', {
    innkeeper1: {
      kind: 'line',
      speaker: 'dialogue.speaker.innkeeper',
      speakerPortraitKey: 'portrait.innkeeper',
      text: 'dialogue.zone7.innkeeper.1',
      next: 'twardowski1',
    },
    twardowski1: {
      kind: 'line',
      speaker: 'dialogue.speaker.twardowski',
      speakerPortraitKey: 'portrait.twardowski',
      text: 'dialogue.zone7.twardowski.1',
      next: 'innkeeper2',
    },
    innkeeper2: {
      kind: 'line',
      speaker: 'dialogue.speaker.innkeeper',
      speakerPortraitKey: 'portrait.innkeeper',
      text: 'dialogue.zone7.innkeeper.2',
      next: null,
    },
  });
}

/** Zone-8 intro: Lucyper taunts Twardowski from the Moon. */
export const ZONE8_INTRO_GRAPH_ID = 'zone8-intro';

export function createZone8IntroGraph(): DialogueGraph {
  return createDialogueGraph(ZONE8_INTRO_GRAPH_ID, 'lucyper1', {
    lucyper1: {
      kind: 'line',
      speaker: 'dialogue.speaker.lucyper',
      speakerPortraitKey: 'portrait.lucyper',
      text: 'dialogue.zone8.lucyper.1',
      next: null,
    },
  });
}

/** Ending cutscene: Twardowski reflects; the Spider asks for news from below. */
export const VICTORY_GRAPH_ID = 'victory';

export function createVictoryGraph(): DialogueGraph {
  return createDialogueGraph(VICTORY_GRAPH_ID, 'twardowski1', {
    twardowski1: {
      kind: 'line',
      speaker: 'dialogue.speaker.twardowski',
      speakerPortraitKey: 'portrait.twardowski',
      text: 'dialogue.victory.twardowski.1',
      next: 'spider1',
    },
    spider1: {
      kind: 'line',
      speaker: 'dialogue.speaker.spider',
      speakerPortraitKey: 'portrait.spider',
      text: 'dialogue.victory.spider.1',
      next: null,
    },
  });
}
