import { describe, expect, spyOn, test } from 'bun:test';
import { createDialogueGraph, type DialogueNode } from '../src/graph.js';
import { createDialogueRunner, DialogueError, interpolate } from '../src/runner.js';

// ─── Helpers ─────────────────────────────────────────────────────

function simpleGraph(): ReturnType<typeof createDialogueGraph> {
  const nodes: Record<string, DialogueNode> = {
    line1: {
      kind: 'line',
      speaker: 'NPC',
      text: 'Hello, {name}!',
      next: 'line2',
    },
    line2: { kind: 'line', speaker: 'NPC', text: 'How are you?', next: null },
  };
  return createDialogueGraph('simple', 'line1', nodes);
}

function choiceGraph(): ReturnType<typeof createDialogueGraph> {
  const nodes: Record<string, DialogueNode> = {
    greet: {
      kind: 'line',
      speaker: 'NPC',
      text: 'Choose wisely.',
      next: 'ask',
    },
    ask: {
      kind: 'choice',
      prompt: 'What do you do?',
      speaker: 'NPC',
      options: [
        { text: 'Fight', next: 'fight' },
        { text: 'Run', next: 'run' },
        { text: 'Secret', next: 'secret', condition: 'hasSecretKey' },
      ],
    },
    fight: { kind: 'line', speaker: 'NPC', text: 'You fight!', next: 'end' },
    run: { kind: 'line', speaker: 'NPC', text: 'You run!', next: 'end' },
    secret: { kind: 'line', speaker: 'NPC', text: 'Secret path!', next: 'end' },
    end: { kind: 'end' },
  };
  return createDialogueGraph('choice', 'greet', nodes);
}

function branchGraph(): ReturnType<typeof createDialogueGraph> {
  const nodes: Record<string, DialogueNode> = {
    check: {
      kind: 'branch',
      arms: [
        { condition: 'rich', next: 'rich_line' },
        { condition: 'poor', next: 'poor_line' },
      ],
      fallback: 'default_line',
    },
    rich_line: {
      kind: 'line',
      speaker: 'NPC',
      text: 'Welcome, noble one!',
      next: null,
    },
    poor_line: {
      kind: 'line',
      speaker: 'NPC',
      text: 'Spare some coins?',
      next: null,
    },
    default_line: { kind: 'line', speaker: 'NPC', text: 'Hello.', next: null },
  };
  return createDialogueGraph('branch', 'check', nodes);
}

function actionGraph(): ReturnType<typeof createDialogueGraph> {
  const nodes: Record<string, DialogueNode> = {
    start: { kind: 'action', action: 'giveItem', next: 'thanks' },
    thanks: { kind: 'line', speaker: 'NPC', text: 'Here you go!', next: null },
  };
  return createDialogueGraph('action', 'start', nodes);
}

// ─── interpolate ─────────────────────────────────────────────────

describe('interpolate', () => {
  test('replaces {var} placeholders', () => {
    expect(interpolate('Hello, {name}!', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  test('handles multiple variables', () => {
    expect(interpolate('{a} and {b}', { a: '1', b: '2' })).toBe('1 and 2');
  });

  test('handles numeric values', () => {
    expect(interpolate('HP: {hp}', { hp: 42 })).toBe('HP: 42');
  });

  test('leaves unknown vars as-is', () => {
    expect(interpolate('Hello, {name}!', {})).toBe('Hello, {name}!');
  });

  test('no placeholders returns same string', () => {
    expect(interpolate('No vars here', {})).toBe('No vars here');
  });
});

// ─── createDialogueRunner ────────────────────────────────────────

describe('createDialogueRunner', () => {
  test('starts idle', () => {
    const runner = createDialogueRunner();
    expect(runner.state).toBe('idle');
    expect(runner.currentNodeId).toBeNull();
    expect(runner.graphId).toBeNull();
  });

  test('walks a simple line sequence', () => {
    const runner = createDialogueRunner();
    const lines: string[] = [];
    runner.onLine.add((e) => lines.push(e.text));

    let ended = false;
    runner.onEnd.add(() => {
      ended = true;
    });

    runner.start(simpleGraph(), { name: 'Hero' });

    expect(runner.state).toBe('running');
    expect(runner.graphId).toBe('simple');
    expect(lines).toEqual(['Hello, Hero!']);

    runner.advance();
    expect(lines).toEqual(['Hello, Hero!', 'How are you?']);

    runner.advance(); // line2.next is null → end
    expect(runner.state).toBe('ended');
    expect(ended).toBe(true);
  });

  test('handles choice nodes', () => {
    const runner = createDialogueRunner({ conditions: () => false }); // hide secret option
    const lines: string[] = [];
    let lastChoice: { options: readonly { text: string }[] } | null = null;

    runner.onLine.add((e) => lines.push(e.text));
    runner.onChoice.add((e) => {
      lastChoice = e;
    });

    runner.start(choiceGraph());
    expect(lines).toEqual(['Choose wisely.']);

    runner.advance(); // → choice node
    expect(runner.state).toBe('waiting-choice');
    expect(lastChoice).not.toBeNull();
    // Secret option should be hidden (condition returns false)
    expect(lastChoice!.options.length).toBe(2);
    expect(lastChoice!.options[0]!.text).toBe('Fight');

    runner.selectChoice(0); // → fight
    expect(lines).toEqual(['Choose wisely.', 'You fight!']);
  });

  test('choice with conditions showing conditional option', () => {
    const runner = createDialogueRunner({
      conditions: (key) => key === 'hasSecretKey',
    });
    let lastChoice: { options: readonly { text: string }[] } | null = null;
    runner.onChoice.add((e) => {
      lastChoice = e;
    });

    runner.start(choiceGraph());
    runner.advance(); // → choice

    expect(lastChoice!.options.length).toBe(3);
    expect(lastChoice!.options[2]!.text).toBe('Secret');
  });

  test('handles branch nodes', () => {
    const runner = createDialogueRunner({
      conditions: (key) => key === 'poor',
    });
    const lines: string[] = [];
    runner.onLine.add((e) => lines.push(e.text));

    runner.start(branchGraph());
    expect(lines).toEqual(['Spare some coins?']);
  });

  test('branch fallback when no arm matches', () => {
    const runner = createDialogueRunner({ conditions: () => false });
    const lines: string[] = [];
    runner.onLine.add((e) => lines.push(e.text));

    runner.start(branchGraph());
    expect(lines).toEqual(['Hello.']);
  });

  test('handles action nodes', () => {
    const actions: string[] = [];
    const runner = createDialogueRunner({
      actions: (key) => {
        actions.push(key);
      },
    });
    const lines: string[] = [];
    runner.onLine.add((e) => lines.push(e.text));

    runner.start(actionGraph());
    expect(actions).toEqual(['giveItem']);
    expect(lines).toEqual(['Here you go!']);
  });

  test('action signal fires', () => {
    const signalActions: string[] = [];
    const runner = createDialogueRunner();
    runner.onAction.add((key) => {
      signalActions.push(key);
    });

    runner.start(actionGraph());
    expect(signalActions).toEqual(['giveItem']);
  });

  test('stop resets state', () => {
    const runner = createDialogueRunner();
    runner.start(simpleGraph());
    expect(runner.state).toBe('running');

    runner.stop();
    expect(runner.state).toBe('idle');
    expect(runner.currentNodeId).toBeNull();
    expect(runner.graphId).toBeNull();
  });

  test('advance is no-op when not running', () => {
    const runner = createDialogueRunner();
    runner.advance(); // no crash when idle
    expect(runner.state).toBe('idle');
  });

  test('selectChoice is no-op when not waiting', () => {
    const runner = createDialogueRunner();
    runner.start(simpleGraph());
    runner.selectChoice(0); // no crash, we're on a line node
    expect(runner.state).toBe('running');
  });

  test('missing next node ends conversation', () => {
    const nodes: Record<string, DialogueNode> = {
      start: { kind: 'line', speaker: 'A', text: 'Hi', next: 'missing' },
    };
    const graph = createDialogueGraph('broken', 'start', nodes);
    const runner = createDialogueRunner();
    runner.start(graph);
    runner.advance(); // next → 'missing' → not found → end
    expect(runner.state).toBe('ended');
  });

  test('end node emits graph id', () => {
    const nodes: Record<string, DialogueNode> = {
      start: { kind: 'end' },
    };
    const graph = createDialogueGraph('myGraph', 'start', nodes);
    const runner = createDialogueRunner();
    let endedWith = '';
    runner.onEnd.add((id) => {
      endedWith = id;
    });
    runner.start(graph);
    expect(endedWith).toBe('myGraph');
  });

  test('choice with all options hidden ends', () => {
    const nodes: Record<string, DialogueNode> = {
      start: {
        kind: 'choice',
        options: [
          { text: 'A', next: 'a', condition: 'nope' },
          { text: 'B', next: 'b', condition: 'nope' },
        ],
      },
    };
    const graph = createDialogueGraph('empty_choice', 'start', nodes);
    const runner = createDialogueRunner({ conditions: () => false });
    runner.start(graph);
    expect(runner.state).toBe('ended');
  });

  test('branch with null fallback ends', () => {
    const nodes: Record<string, DialogueNode> = {
      start: {
        kind: 'branch',
        arms: [{ condition: 'x', next: 'y' }],
        fallback: null,
      },
    };
    const graph = createDialogueGraph('br_null', 'start', nodes);
    const runner = createDialogueRunner({ conditions: () => false });
    runner.start(graph);
    expect(runner.state).toBe('ended');
  });

  test('action with null next ends', () => {
    const nodes: Record<string, DialogueNode> = {
      start: { kind: 'action', action: 'doStuff', next: null },
    };
    const graph = createDialogueGraph('act_end', 'start', nodes);
    const runner = createDialogueRunner();
    runner.start(graph);
    expect(runner.state).toBe('ended');
  });

  test('forwards speakerPortraitKey from LineNode to DialogueLineEvent', () => {
    const nodes: Record<string, DialogueNode> = {
      l1: {
        kind: 'line',
        speaker: 'NPC',
        speakerPortraitKey: 'portrait:rokita',
        text: 'Greetings.',
        next: 'l2',
      },
      l2: { kind: 'line', speaker: 'Hero', text: 'Hello.', next: null },
    };
    const graph = createDialogueGraph('portraits', 'l1', nodes);
    const runner = createDialogueRunner();
    const keys: Array<string | undefined> = [];
    runner.onLine.add((e) => keys.push(e.speakerPortraitKey));

    runner.start(graph);
    runner.advance();
    expect(keys).toEqual(['portrait:rokita', undefined]);
  });
});

describe('DialogueError diagnostics', () => {
  function danglingGraph(graphId: string): ReturnType<typeof createDialogueGraph> {
    const nodes: Record<string, DialogueNode> = {
      start: { kind: 'line', speaker: 'A', text: 'Hi', next: 'ghost' },
    };
    return createDialogueGraph(graphId, 'start', nodes);
  }

  test('onError observes dangling id', () => {
    const graph = danglingGraph('dangle');
    let received: DialogueError | null = null;
    const runner = createDialogueRunner({
      onError: (err) => {
        received = err;
      },
    });

    runner.start(graph);
    runner.advance(); // next → 'ghost' → not found

    expect(received).toBeInstanceOf(DialogueError);
    expect(received!.code).toBe('missing-node');
    expect(received!.missingId).toBe('ghost');
    expect(received!.nodeId).toBe('start');
    expect(runner.state).toBe('ended');
  });

  test('default logs console.warn on dangling id', () => {
    const graph = danglingGraph('dangle2');
    const runner = createDialogueRunner(); // no onError

    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    runner.start(graph);
    runner.advance();

    expect(warn.mock.calls.length).toBeGreaterThan(0);
    const firstArg = warn.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain('ghost');
    warn.mockRestore();

    expect(runner.state).toBe('ended');
  });

  test('cycle throws typed DialogueError not RangeError', () => {
    const nodes: Record<string, DialogueNode> = {
      a: { kind: 'branch', arms: [{ condition: 'always', next: 'b' }], fallback: null },
      b: { kind: 'branch', arms: [{ condition: 'always', next: 'a' }], fallback: null },
    };
    const graph = createDialogueGraph('cycle_test', 'a', nodes);

    expect(() => {
      createDialogueRunner({ conditions: () => true }).start(graph);
    }).toThrow(DialogueError);

    let thrown: unknown;
    try {
      createDialogueRunner({ conditions: () => true }).start(graph);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(DialogueError);
    expect((thrown as DialogueError).code).toBe('cycle');
    expect(thrown instanceof RangeError).toBe(false);
  });
});

describe('interpolate prototype safety', () => {
  test('does not leak constructor from prototype', () => {
    expect(interpolate('{constructor}', {})).toBe('{constructor}');
  });

  test('does not leak toString from prototype', () => {
    expect(interpolate('{toString}', {})).toBe('{toString}');
  });

  test('supports explicit own property named constructor', () => {
    expect(interpolate('{constructor}', { constructor: 'Aeron' })).toBe('Aeron');
  });
});

describe('runner prototype safety', () => {
  test('runner ends cleanly when a node id resolves to a prototype key', () => {
    const nodes: Record<string, DialogueNode> = {
      start: { kind: 'line', speaker: 'A', text: 'Hi', next: '__proto__' },
    };
    const graph = createDialogueGraph('proto_test', 'start', nodes);
    // Container rather than a bare `let`: control-flow analysis cannot see the callback assignment
    // and narrows a `let` back to `null` at the assertions below, which is what forced the cast
    // this replaces. A property read is not narrowed that way.
    const captured: { error: DialogueError | null } = { error: null };
    const runner = createDialogueRunner({
      onError: (err) => {
        captured.error = err;
      },
    });
    runner.start(graph);
    runner.advance();
    expect(runner.state).toBe('ended');
    expect(captured.error).toBeInstanceOf(DialogueError);
    expect(captured.error?.code).toBe('missing-node');
  });
});
