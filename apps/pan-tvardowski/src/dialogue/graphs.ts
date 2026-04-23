/**
 * Pan Twardowski dialogue graphs (build plan §13).
 *
 * Each graph stores **localization keys** (not rendered text) as node `text`
 * and `speaker` fields. The dialogue overlay resolves them through the
 * LocalizationManager at render time, so PL/EN switch live without rebuilding
 * graphs.
 */

import { type DialogueGraph, createDialogueGraph } from '@flare-engine/dialogue';

/** Opening cutscene: King Zygmunt I briefs Twardowski. Shown once per save. */
export const OPENING_GRAPH_ID = 'opening';

export function createOpeningGraph(): DialogueGraph {
  return createDialogueGraph(OPENING_GRAPH_ID, 'king1', {
    king1: {
      kind: 'line',
      speaker: 'dialogue.speaker.king',
      text: 'dialogue.opening.king.1',
      next: 'twardowski1',
    },
    twardowski1: {
      kind: 'line',
      speaker: 'dialogue.speaker.twardowski',
      text: 'dialogue.opening.twardowski.1',
      next: 'king2',
    },
    king2: {
      kind: 'line',
      speaker: 'dialogue.speaker.king',
      text: 'dialogue.opening.king.2',
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
      text: 'dialogue.zone7.innkeeper.1',
      next: 'twardowski1',
    },
    twardowski1: {
      kind: 'line',
      speaker: 'dialogue.speaker.twardowski',
      text: 'dialogue.zone7.twardowski.1',
      next: 'innkeeper2',
    },
    innkeeper2: {
      kind: 'line',
      speaker: 'dialogue.speaker.innkeeper',
      text: 'dialogue.zone7.innkeeper.2',
      next: null,
    },
  });
}
