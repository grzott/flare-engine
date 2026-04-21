import {
  type DialogueGraph,
  type DialogueLineEvent,
  createDialogueRunner,
} from '@flare-engine/dialogue';
import type { GameContextValue, Scene } from '@flare-engine/engine';
import { Signal } from '@flare-engine/events';
import { introGraph } from '../dialogue/intro-graph';
import { victoryGraph } from '../dialogue/victory-graph';
import { clearMenuActions, setMenuActions } from '../hud/menu-actions';
import { resetUi } from '../hud/ui-state';
import { getSaveStore } from '../save/ref';
import { gameState, notifyStateChanged } from '../state';
import { shellDefaults } from './scene-shell';

export interface DialogueLineState {
  speaker: string;
  text: string;
  nodeId: string;
}

export const dialogueState: { current: DialogueLineState | null } = {
  current: null,
};
export const dialogueChanged = new Signal<void>();

function emitLine(line: DialogueLineState | null): void {
  dialogueState.current = line;
  dialogueChanged.emit();
}

function pickGraph(): DialogueGraph | null {
  const i = gameState.activeSlot;
  if (i === null) return null;
  const slot = gameState.slots[i];
  if (!slot) return null;
  if (slot.pendingVictoryDialogue) return victoryGraph;
  if (!slot.firstRunSeen) return introGraph;
  return null;
}

export function createDialogueScene(ctx: GameContextValue): () => Scene {
  return () => {
    let armTimer = 0;
    const runner = createDialogueRunner();
    let finished = false;

    const unsubLine = runner.onLine.add((ev: DialogueLineEvent) => {
      emitLine({ speaker: ev.speaker, text: ev.text, nodeId: ev.nodeId });
    });
    const unsubEnd = runner.onEnd.add(() => {
      finished = true;
      emitLine(null);
      const store = getSaveStore();
      const i = gameState.activeSlot;
      if (i !== null && gameState.slots[i]?.pendingVictoryDialogue) {
        void store.clearPendingVictoryDialogue(i).then(() => {
          void ctx.scenes.go('play');
        });
      } else {
        void ctx.scenes.go('play');
      }
    });

    return {
      name: 'dialogue',
      ...shellDefaults(),
      onEnter() {
        armTimer = 0.2;
        finished = false;
        gameState.currentScene = 'dialogue';
        gameState.menuReady = false;
        resetUi();
        notifyStateChanged();

        const graph = pickGraph();
        if (!graph) {
          void ctx.scenes.go('play');
          return;
        }
        runner.start(graph);

        setMenuActions({
          onDialogueAdvance: () => {
            if (finished) return;
            runner.advance();
          },
        });
      },
      onUpdate(dt: number) {
        if (armTimer > 0) {
          armTimer -= dt;
          if (armTimer <= 0) {
            gameState.menuReady = true;
            notifyStateChanged();
          }
        }
      },
      onExit() {
        runner.stop();
        emitLine(null);
        clearMenuActions();
        gameState.menuReady = false;
      },
      onDestroy() {
        unsubLine();
        unsubEnd();
      },
    };
  };
}
