import {
  type DialogueGraph,
  type DialogueRunner,
  createDialogueRunner,
} from '@flare-engine/dialogue';
import { gameEvents } from '../events';
import { gameState, notifyStateChanged } from '../state';

export {
  OPENING_GRAPH_ID,
  ZONE7_ENTRY_GRAPH_ID,
  createOpeningGraph,
  createZone7EntryGraph,
} from './graphs';

export interface DialogueController {
  readonly runner: DialogueRunner;
  /** Start a graph; sets `gameState.dialogue` to the first line. */
  play(graph: DialogueGraph, onEnd?: () => void): void;
  /** Advance to the next line / end (single-tap overlay handler). */
  advance(): void;
  /** Is a dialogue currently visible? */
  isActive(): boolean;
}

/**
 * Build a dialogue controller bound to `gameState.dialogue`. The overlay
 * React component subscribes to `gameState` via Flare's state signal and
 * renders whatever line the runner last emitted.
 */
export function createDialogueController(): DialogueController {
  const runner = createDialogueRunner();
  let endCallback: (() => void) | null = null;

  runner.onLine.add((ev) => {
    gameState.dialogue = {
      graphId: runner.graphId ?? '',
      speakerKey: ev.speaker,
      textKey: ev.text,
    };
    notifyStateChanged();
  });

  runner.onEnd.add((graphId) => {
    gameState.dialogue = null;
    notifyStateChanged();
    gameEvents.emit('dialogue-end', graphId);
    const cb = endCallback;
    endCallback = null;
    cb?.();
  });

  return {
    runner,
    play(graph, onEnd) {
      endCallback = onEnd ?? null;
      gameEvents.emit('dialogue-start', graph.id);
      runner.start(graph);
    },
    advance() {
      if (runner.state === 'running') runner.advance();
    },
    isActive() {
      return gameState.dialogue !== null;
    },
  };
}
