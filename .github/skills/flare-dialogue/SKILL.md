---
name: flare-dialogue
description: Deep knowledge of the @flare-engine/dialogue package — dialogue graph, nodes, choices, conditional branches, runtime evaluator. Use when implementing NPC conversations, branching cutscenes, or choice-driven narrative in a Flare game.
---

# `@flare-engine/dialogue`

Layer 3. Pure TS. Graph-based dialogue with conditional branches and variable interpolation.

## Exports

```ts
import {
  type DialogueGraph,
  type DialogueNode,
  type Choice,
  createDialogueRunner,
  type DialogueRunner,
  evaluateCondition,
} from "@flare-engine/dialogue";
```

## Usage sketch

```ts
const graph: DialogueGraph = {
  start: "greet",
  nodes: {
    greet: { text: "Hello, {playerName}!", next: "ask" },
    ask: {
      text: "Will you help?",
      choices: [
        { label: "Yes", next: "accept" },
        {
          label: "No",
          next: "refuse",
          condition: { lhs: "hp", op: ">", rhs: 0 },
        },
      ],
    },
    accept: { text: "Thank you.", end: true },
    refuse: { text: "Fine.", end: true },
  },
};

const runner = createDialogueRunner(graph, { playerName: "Ana", hp: 80 });
runner.advance(); // or runner.choose(choiceIndex)
runner.current; // current node + substituted text
```

## Rules

- The runner is pure-state — serialize `runner.state` into a save file via `@flare-engine/storage`.
- Conditional expressions are a minimal `{lhs, op, rhs}` shape — deliberately not a DSL. Compose in code for complex logic.
- Text interpolation uses `{name}` tokens resolved from the variable bag.

Spec: [docs/design/api-specs.md § @flare-engine/dialogue](../../../docs/design/api-specs.md).
