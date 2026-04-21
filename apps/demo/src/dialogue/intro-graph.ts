import { type DialogueGraph, createDialogueGraph } from '@flare-engine/dialogue';

export const introGraph: DialogueGraph = createDialogueGraph('intro', 'l1', {
  l1: {
    kind: 'line',
    speaker: 'Control',
    text: 'Pilot, enemy fleet incoming. You are our last defense.',
    next: 'l2',
  },
  l2: {
    kind: 'line',
    speaker: 'Control',
    text: 'Use the joystick to move. Auto-fire is on. Tap the button to drop bombs.',
    next: 'l3',
  },
  l3: {
    kind: 'line',
    speaker: 'Control',
    text: 'Good luck. Pause menu is top-right if you need to regroup.',
    next: null,
  },
});
