# @flare-engine/dialogue

Branching dialogue graphs — `LineNode` / `ChoiceNode` / `BranchNode` / `ActionNode` / `EndNode`. `DialogueRunner` advances the graph with caller-supplied `ConditionResolver` + `ActionHandler` + `VariableBag`. `interpolate` substitutes `{var}` tokens. `createTextReveal` is a typewriter state machine. No rendering — pair with `@flare-engine/ui` `DialoguePanel` for the view layer.

## Install

```sh
bun add @flare-engine/dialogue
```

## Usage

```ts
import { createDialogueGraph, createDialogueRunner, createTextReveal } from '@flare-engine/dialogue';

const graph = createDialogueGraph('intro', 'start', {
  start: { kind: 'line', speaker: 'mage', text: 'Hello {playerName}.', next: 'choice' },
  choice: { kind: 'choice', options: [] },
});

const runner = createDialogueRunner({
  conditions: () => true,
  actions: (key: string) => { /* fire action `key` */ },
});

runner.start(graph, { playerName: 'Twardowski' });

const reveal = createTextReveal('Hello.');
```

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-enginedialogue--5kb-gzip).

## License

MIT
