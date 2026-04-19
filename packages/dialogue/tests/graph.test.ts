import { describe, expect, test } from 'bun:test';
import { type DialogueNode, createDialogueGraph, getNode } from '../src/graph.js';

describe('createDialogueGraph', () => {
  test('creates a graph with id, start, and nodes', () => {
    const nodes: Record<string, DialogueNode> = {
      intro: { kind: 'line', speaker: 'NPC', text: 'Hello!', next: null },
    };
    const g = createDialogueGraph('test', 'intro', nodes);
    expect(g.id).toBe('test');
    expect(g.start).toBe('intro');
    expect(g.nodes).toBe(nodes);
  });
});

describe('getNode', () => {
  const nodes: Record<string, DialogueNode> = {
    a: { kind: 'line', speaker: 'Alice', text: 'Hi', next: 'b' },
    b: { kind: 'end' },
  };
  const graph = createDialogueGraph('g1', 'a', nodes);

  test('returns existing node', () => {
    const node = getNode(graph, 'a');
    expect(node).toBeDefined();
    expect(node!.kind).toBe('line');
  });

  test('returns undefined for missing node', () => {
    expect(getNode(graph, 'missing')).toBeUndefined();
  });
});

describe('node type discriminants', () => {
  test('line node', () => {
    const n: DialogueNode = {
      kind: 'line',
      speaker: 'Bob',
      text: 'Hey',
      next: null,
    };
    expect(n.kind).toBe('line');
  });

  test('choice node', () => {
    const n: DialogueNode = {
      kind: 'choice',
      prompt: 'What now?',
      options: [
        { text: 'Go left', next: 'left' },
        { text: 'Go right', next: 'right' },
      ],
    };
    expect(n.kind).toBe('choice');
    if (n.kind === 'choice') {
      expect(n.options.length).toBe(2);
    }
  });

  test('branch node', () => {
    const n: DialogueNode = {
      kind: 'branch',
      arms: [{ condition: 'hasKey', next: 'unlock' }],
      fallback: 'locked',
    };
    expect(n.kind).toBe('branch');
  });

  test('action node', () => {
    const n: DialogueNode = {
      kind: 'action',
      action: 'giveItem',
      next: 'thanks',
    };
    expect(n.kind).toBe('action');
  });

  test('end node', () => {
    const n: DialogueNode = { kind: 'end' };
    expect(n.kind).toBe('end');
  });
});
