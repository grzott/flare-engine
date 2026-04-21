import { type DialogueGraph, createDialogueGraph } from '@flare-engine/dialogue';

export const victoryGraph: DialogueGraph = createDialogueGraph('victory', 'l1', {
  l1: {
    kind: 'line',
    speaker: 'Control',
    text: 'Unbelievable, pilot. The boss is down. The sector is safe.',
    next: 'l2',
  },
  l2: {
    kind: 'line',
    speaker: 'Control',
    text: 'Everything you just flew was built with Flare engine.',
    next: 'l3',
  },
  l3: {
    kind: 'line',
    speaker: 'Control',
    text: 'Grab the source, open the docs, and build your own game. See you out there.',
    next: null,
  },
});
