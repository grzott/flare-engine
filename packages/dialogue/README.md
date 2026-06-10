# @flare-engine/dialogue

Branching dialogue graphs — `LineNode` / `ChoiceNode` / `BranchNode` / `ActionNode` / `EndNode`. `DialogueRunner` advances the graph with caller-supplied `ConditionResolver` + `ActionHandler` + `VariableBag`. `interpolate` substitutes `{var}` tokens. `createTextReveal` is a typewriter state machine. No rendering — pair with `@flare-engine/ui` `DialoguePanel` for the view layer.

## Install

```sh
bun add @flare-engine/dialogue
```

## Usage

```ts
import { createDialogueGraph, createDialogueRunner, createTextReveal } from '@flare-engine/dialogue';

const graph = createDialogueGraph('start', new Map([
  ['start', { kind: 'line', speaker: 'mage', text: 'Hello {playerName}.', next: 'choice' }],
  ['choice', { kind: 'choice', options: [/* ... */] }],
]));

const runner = createDialogueRunner(graph, {
  variables: { playerName: 'Twardowski' },
  conditions: () => true,
  actions: (id, args) => { /* ... */ },
});

const reveal = createTextReveal('Hello.', { cps: 30 });
```

See [API spec](../../docs/design/api-specs.md#flare-enginedialogue--5kb-gzip).

## License

MIT
