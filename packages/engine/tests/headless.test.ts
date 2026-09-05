import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGame, createTier2Wiring, EventEmitter, GameLoop, World } from '../src/headless.js';

// ---------------------------------------------------------------------------
// 1. Export existence
// ---------------------------------------------------------------------------

describe('headless exports', () => {
  // These were five separate `typeof X === 'function'` tests. None could fail
  // independently: a missing export aborts this file at the import above, so the
  // import statement was already the existence check and the assertions only
  // inflated the apparent coverage of the barrel's most consumer-visible surface
  // (HYG10). Replaced by one test that USES each export, which catches what the
  // import cannot — a re-export bound to the wrong thing, or an export whose
  // kind changed from a constructor to something merely callable.
  it('re-exports usable implementations, not just callable bindings', () => {
    const world = new World();
    const id = world.spawn();
    expect(typeof id).toBe('number');

    const loop = new GameLoop();
    expect(typeof loop.start).toBe('function');
    expect(typeof loop.stop).toBe('function');

    const emitter = new EventEmitter<{ ping: (v: number) => void }>();
    let seen = 0;
    emitter.on('ping', (v) => {
      seen = v;
    });
    emitter.emit('ping', 7);
    expect(seen).toBe(7);

    // createTier2Wiring returns its unsubscribe; with no rules it is a no-op
    // that must still be callable rather than undefined.
    const unwire = createTier2Wiring({
      events: emitter as never,
      providers: {} as never,
      rules: [],
    });
    expect(typeof unwire).toBe('function');
    unwire();
  });

  it('createGame returns a working instance', () => {
    const game = createGame();
    expect(game.world).toBeInstanceOf(World);
    expect(game.loop).toBeInstanceOf(GameLoop);
    expect(typeof game.start).toBe('function');
    expect(typeof game.stop).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 2. Module-graph guard — flat source scan
//
// Enumerates every *.ts / *.tsx under src/ of each of the 14 headless packages
// and engine's own wiring files. Strips block+line comments before matching so
// that mentions of react-native etc. in JSDoc / inline comments don't produce
// false positives. Extracts specifiers from ALL static and dynamic import
// positions. A self-proving sub-test confirms the scanner is non-tautological.
// ---------------------------------------------------------------------------

const PACKAGES_DIR = join(import.meta.dir, '../../..');

const HEADLESS_PKGS = [
  'animation',
  'assets',
  'audio',
  'core',
  'debug',
  'ecs',
  'events',
  'input',
  'math',
  'particles',
  'physics',
  'render',
  'scene',
  'tilemap',
];

const ENGINE_SRC = join(PACKAGES_DIR, 'packages', 'engine', 'src');

const BANNED = [
  '@flare-engine/react',
  '@flare-engine/postfx',
  'react-native',
  '@shopify/react-native-skia',
];

/** Recursively collect .ts/.tsx source files (excluding .d.ts and .test.*). */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (entry.isFile()) {
      const n = entry.name;
      if (
        (n.endsWith('.ts') || n.endsWith('.tsx')) &&
        !n.endsWith('.d.ts') &&
        !n.includes('.test.')
      ) {
        files.push(full);
      }
    }
  }
  return files;
}

/**
 * Strip block comments (including JSDoc) then line comments from source text.
 * Must strip block comments first — a line comment inside a block comment
 * must not be processed by the line-comment stripper.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Extract import specifiers from all static and dynamic import positions:
 *   from '...'          — ESM named/default import
 *   import '...'        — ESM side-effect import
 *   import('...')       — dynamic import
 *   require('...')      — CJS require
 */
function extractSpecifiers(src: string): string[] {
  const clean = stripComments(src);
  const found = new Set<string>();
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m = re.exec(clean);
    while (m !== null) {
      found.add(m[1] as string);
      m = re.exec(clean);
    }
  }
  return [...found];
}

describe('extractSpecifiers self-proof', () => {
  const synthetic = `
    /* block-comment-only pkg: import 'comment-only-pkg'; */
    import 'react-native';
    import x from '@shopify/react-native-skia';
    const y = await import('@flare-engine/react');
    const z = require('@flare-engine/postfx');
  `;

  it('detects all 4 real banned specifiers', () => {
    const specs = extractSpecifiers(synthetic);
    expect(specs).toContain('react-native');
    expect(specs).toContain('@shopify/react-native-skia');
    expect(specs).toContain('@flare-engine/react');
    expect(specs).toContain('@flare-engine/postfx');
  });

  it('does NOT detect the block-comment-only specifier', () => {
    const specs = extractSpecifiers(synthetic);
    expect(specs).not.toContain('comment-only-pkg');
  });
});

describe('headless module-graph flat scan', () => {
  // Build the full file list once at describe-scope.
  const allFiles: string[] = [
    join(ENGINE_SRC, 'engine.ts'),
    join(ENGINE_SRC, 'tier2-wiring.ts'),
    join(ENGINE_SRC, 'headless.ts'),
  ];
  for (const pkg of HEADLESS_PKGS) {
    allFiles.push(...collectSourceFiles(join(PACKAGES_DIR, 'packages', pkg, 'src')));
  }

  it('scanned at least 14 source files (one per headless package)', () => {
    expect(allFiles.length).toBeGreaterThanOrEqual(14);
  });

  // Collect all specifiers from the entire corpus once.
  const allSpecifiers: string[] = [];
  for (const file of allFiles) {
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    allSpecifiers.push(...extractSpecifiers(src));
  }

  for (const banned of BANNED) {
    it(`no real "${banned}" import in any headless source file`, () => {
      const hits = allSpecifiers.filter((s) => s === banned || s.startsWith(`${banned}/`));
      expect(hits).toEqual([]);
    });
  }

  it('headless.ts does not directly import @flare-engine/react', () => {
    const src = readFileSync(join(ENGINE_SRC, 'headless.ts'), 'utf8');
    expect(extractSpecifiers(src)).not.toContain('@flare-engine/react');
  });

  it('headless.ts does not directly import @flare-engine/postfx', () => {
    const src = readFileSync(join(ENGINE_SRC, 'headless.ts'), 'utf8');
    expect(extractSpecifiers(src)).not.toContain('@flare-engine/postfx');
  });
});
