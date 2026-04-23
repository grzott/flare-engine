import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  OPENING_GRAPH_ID,
  ZONE7_ENTRY_GRAPH_ID,
  createDialogueController,
  createOpeningGraph,
  createZone7EntryGraph,
} from '../src/dialogue';
import { gameEvents } from '../src/events';
import { gameState, resetGameState } from '../src/state';

describe('dialogue / controller', () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    gameEvents.removeAll();
  });

  test('opening graph advances through three lines', () => {
    const controller = createDialogueController();
    const lines: Array<{ speaker: string; text: string }> = [];
    let ended = false;

    controller.runner.onLine.add((ev) => lines.push({ speaker: ev.speaker, text: ev.text }));
    controller.play(createOpeningGraph(), () => {
      ended = true;
    });

    expect(controller.isActive()).toBe(true);
    expect(gameState.dialogue?.graphId).toBe(OPENING_GRAPH_ID);
    expect(lines.length).toBe(1);
    expect(lines[0]?.speaker).toBe('dialogue.speaker.king');

    controller.advance();
    expect(lines[1]?.speaker).toBe('dialogue.speaker.twardowski');

    controller.advance();
    expect(lines[2]?.speaker).toBe('dialogue.speaker.king');

    controller.advance();
    expect(ended).toBe(true);
    expect(controller.isActive()).toBe(false);
    expect(gameState.dialogue).toBeNull();
  });

  test('zone-7 graph uses localization keys and emits dialogue-end event', () => {
    const controller = createDialogueController();
    let endedGraphId = '';
    gameEvents.on('dialogue-end', (id: string) => {
      endedGraphId = id;
    });

    controller.play(createZone7EntryGraph());
    expect(gameState.dialogue?.speakerKey).toBe('dialogue.speaker.innkeeper');
    expect(gameState.dialogue?.textKey.startsWith('dialogue.zone7')).toBe(true);

    controller.advance();
    controller.advance();
    controller.advance();

    expect(endedGraphId).toBe(ZONE7_ENTRY_GRAPH_ID);
  });

  test('advance is a no-op when no dialogue is running', () => {
    const controller = createDialogueController();
    expect(controller.isActive()).toBe(false);
    controller.advance();
    expect(controller.isActive()).toBe(false);
  });
});
