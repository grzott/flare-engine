/**
 * M9.4 — dialogue portrait tests.
 *
 * Split into two suites:
 *
 * 1. `portrait manifest` — pure data, no engine-package imports. Runs in Bun
 *    on Windows without EACCES.
 *
 * 2. `graphs + controller (portrait)` — imports `../src/dialogue` which pulls
 *    `@flare-engine/dialogue` transitively. On Windows (Bun + symlinks) this
 *    causes EACCES at module-load time; the suite passes on Linux CI and on
 *    device. Matches the pre-existing behaviour of `dialogue.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  ZONE4_BORUTA_GRAPH_ID,
  ZONE8_INTRO_GRAPH_ID,
  createDialogueController,
  createOpeningGraph,
  createVictoryGraph,
  createZone4BorutaGraph,
  createZone7EntryGraph,
  createZone8IntroGraph,
} from '../src/dialogue';
import { PORTRAIT_MANIFEST, resolvePortraitShape } from '../src/dialogue/portrait-manifest';
import type { PortraitKey } from '../src/dialogue/portrait-manifest';
import { gameEvents } from '../src/events';
import { gameState, resetGameState } from '../src/state';

// ─── 1. Portrait manifest (pure data, no engine dep) ─────────────────────────

describe('portrait manifest', () => {
  const EXPECTED_KEYS: PortraitKey[] = [
    'portrait.king',
    'portrait.twardowski',
    'portrait.innkeeper',
    'portrait.lucyper',
    'portrait.spider',
    'portrait.boruta',
  ];

  test('manifest covers exactly 6 portrait keys', () => {
    const keys = Object.keys(PORTRAIT_MANIFEST);
    expect(keys).toHaveLength(6);
  });

  test('each expected key is present in the manifest', () => {
    for (const key of EXPECTED_KEYS) {
      expect(PORTRAIT_MANIFEST[key], `${key} missing from manifest`).toBeDefined();
    }
  });

  test('every manifest entry is a non-empty ShapeSpec array', () => {
    for (const key of EXPECTED_KEYS) {
      const shapes = PORTRAIT_MANIFEST[key];
      expect(shapes.length, `${key} has no shapes`).toBeGreaterThan(0);
    }
  });

  test('resolvePortraitShape returns shapes for a known key', () => {
    const shapes = resolvePortraitShape('portrait.king');
    expect(shapes).toBeDefined();
    expect((shapes ?? []).length).toBeGreaterThan(0);
  });

  test('resolvePortraitShape returns undefined for an unknown key', () => {
    expect(resolvePortraitShape('portrait.unknown')).toBeUndefined();
  });

  test('resolvePortraitShape returns undefined for undefined input', () => {
    expect(resolvePortraitShape(undefined)).toBeUndefined();
  });
});

// ─── 2. Graph nodes + controller (requires @flare-engine/dialogue) ────────────

describe('graphs + controller (portrait)', () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    gameEvents.removeAll();
  });

  test('zone4 Boruta graph has correct id, speaker, text, portraitKey', () => {
    const g = createZone4BorutaGraph();
    expect(g.id).toBe(ZONE4_BORUTA_GRAPH_ID);
    const nodeIds = Object.keys(g.nodes);
    expect(nodeIds).toHaveLength(1);
    const node = g.nodes[nodeIds[0] as string] as {
      kind: string;
      speaker: string;
      speakerPortraitKey?: string;
      text: string;
    };
    expect(node.kind).toBe('line');
    expect(node.speakerPortraitKey).toBe('portrait.boruta');
    expect(node.speaker).toBe('dialogue.speaker.boruta');
    expect(node.text).toBe('dialogue.zone4.boruta.1');
  });

  test('zone8 graph line has speakerPortraitKey = portrait.lucyper', () => {
    const g = createZone8IntroGraph();
    expect(g.id).toBe(ZONE8_INTRO_GRAPH_ID);
    const nodeIds = Object.keys(g.nodes);
    const node = g.nodes[nodeIds[0] as string] as {
      kind: string;
      speakerPortraitKey?: string;
    };
    expect(node.kind).toBe('line');
    expect(node.speakerPortraitKey).toBe('portrait.lucyper');
  });

  test('opening, zone7, victory graphs: all line nodes carry speakerPortraitKey', () => {
    for (const g of [createOpeningGraph(), createZone7EntryGraph(), createVictoryGraph()]) {
      let lineCount = 0;
      for (const [, node] of Object.entries(g.nodes)) {
        const n = node as { kind: string; speakerPortraitKey?: string };
        if (n.kind === 'line') {
          expect(n.speakerPortraitKey, `${g.id}: node missing portraitKey`).toBeDefined();
          lineCount++;
        }
      }
      expect(lineCount, `${g.id}: no line nodes found`).toBeGreaterThan(0);
    }
  });

  test('controller sets portraitKey on first line (opening = king)', () => {
    const controller = createDialogueController();
    controller.play(createOpeningGraph());
    expect(gameState.dialogue).not.toBeNull();
    expect(gameState.dialogue?.portraitKey).toBe('portrait.king');
  });

  test('controller updates portraitKey on advance (king → twardowski)', () => {
    const controller = createDialogueController();
    controller.play(createOpeningGraph());
    controller.advance();
    expect(gameState.dialogue?.speakerKey).toBe('dialogue.speaker.twardowski');
    expect(gameState.dialogue?.portraitKey).toBe('portrait.twardowski');
  });

  test('zone4 Boruta graph sets portraitKey = portrait.boruta in gameState', () => {
    const controller = createDialogueController();
    controller.play(createZone4BorutaGraph());
    expect(gameState.dialogue?.portraitKey).toBe('portrait.boruta');
    expect(gameState.dialogue?.graphId).toBe(ZONE4_BORUTA_GRAPH_ID);
  });

  test('dialogue is null (no portraitKey) after graph ends', () => {
    const controller = createDialogueController();
    controller.play(createOpeningGraph());
    controller.advance();
    controller.advance();
    controller.advance();
    expect(gameState.dialogue).toBeNull();
  });
});
