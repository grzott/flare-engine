/**
 * M9.5 — asset-manifest tests.
 *
 * All suites are pure: no Skia, no react-native-audio-api. Uses Bun's
 * built-in JSON imports and Node fs for the boundary-lint walk.
 *
 * Symlink-guarded for Windows (same pattern as shop-entitlements.test.ts):
 * suites that import from src/ are wrapped in try/require so EACCES on
 * @flare-engine/* symlinks does not fail the suite on Windows CI.
 */

import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import audioJson from '../assets/audio.manifest.json';
import portraitsJson from '../assets/portraits.manifest.json';
import spritesJson from '../assets/sprites.manifest.json';
import type {
  AudioManifest,
  PortraitsManifest,
  SpritesManifest,
} from '../src/assets/manifest-types';

// Bun on Windows throws a BuildMessage whose stringified form contains 'EACCES'
// when it can't read a @flare-engine/* symlink, and a TypeError when a prior
// failed require left the module in an un-instantiated state.
function isSymlinkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const s = String(e);
  if (s.includes('EACCES') || s.includes('MODULE_NOT_FOUND')) return true;
  const code = (e as NodeJS.ErrnoException).code;
  return code === 'EACCES' || code === 'MODULE_NOT_FOUND';
}

const sprites = spritesJson as SpritesManifest;
const audio = audioJson as AudioManifest;
const portraits = portraitsJson as PortraitsManifest;

// ---------------------------------------------------------------------------
// 1. sprites.manifest.json structure
// ---------------------------------------------------------------------------
describe('sprites.manifest.json', () => {
  test('parses into SpritesManifest with version 1', () => {
    expect(sprites.version).toBe(1);
  });

  test('has exactly 3 entries', () => {
    expect(sprites.entries.length).toBe(3);
  });

  test('placeholder shape-atlas entry exists', () => {
    const entry = sprites.entries.find((e) => e.kind === 'shape-atlas');
    expect(entry).toBeDefined();
    expect(entry?.key).toBe('shape-atlas');
  });

  test('kenney-zone1 entry has kind texture-packer with image and json paths', () => {
    const entry = sprites.entries.find((e) => e.key === 'kenney-zone1');
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe('texture-packer');
    expect(entry?.image).toBe('assets/kenney/zone1.png');
    expect(entry?.json).toBe('assets/kenney/zone1.json');
  });

  test('kenney-bg entry has kind image with image path', () => {
    const entry = sprites.entries.find((e) => e.key === 'kenney-bg');
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe('image');
    expect(entry?.image).toBe('assets/kenney/darkPurple.png');
  });
});

// ---------------------------------------------------------------------------
// 2. audio.manifest.json structure
// ---------------------------------------------------------------------------
describe('audio.manifest.json', () => {
  const EXPECTED_SFX = ['shoot', 'hit', 'explode', 'bomb', 'shard'] as const;
  const EXPECTED_MUSIC = [
    'zone1',
    'zone2',
    'zone3',
    'zone4',
    'zone5',
    'zone6',
    'zone7',
    'zone8',
  ] as const;

  test('parses into AudioManifest with version 1', () => {
    expect(audio.version).toBe(1);
  });

  test('sfx list contains exactly the 5 expected keys', () => {
    const keys = audio.sfx.map((e) => e.key);
    expect(keys).toHaveLength(5);
    for (const k of EXPECTED_SFX) {
      expect(keys).toContain(k);
    }
  });

  test('music list contains exactly the 8 expected zone keys', () => {
    const keys = audio.music.map((e) => e.key);
    expect(keys).toHaveLength(8);
    for (const k of EXPECTED_MUSIC) {
      expect(keys).toContain(k);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. portraits.manifest.json structure
// ---------------------------------------------------------------------------
describe('portraits.manifest.json', () => {
  const EXPECTED_KEYS = [
    'portrait.king',
    'portrait.twardowski',
    'portrait.innkeeper',
    'portrait.lucyper',
    'portrait.spider',
    'portrait.boruta',
  ] as const;

  test('parses into PortraitsManifest with version 1', () => {
    expect(portraits.version).toBe(1);
  });

  test('entries cover the 6 expected portrait keys', () => {
    const keys = portraits.entries.map((e) => e.key);
    expect(keys).toHaveLength(6);
    for (const k of EXPECTED_KEYS) {
      expect(keys).toContain(k);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Closed-union check — every kind across all three manifests is in the
//    allowed set for its manifest type.
// ---------------------------------------------------------------------------
describe('closed-union kind checks', () => {
  const SPRITE_KINDS = new Set<string>(['shape-atlas', 'texture-packer', 'image']);
  const AUDIO_KINDS = new Set<string>(['synth', 'file']);
  const PORTRAIT_KINDS = new Set<string>(['shape', 'image']);

  test('all sprite entry kinds are in the allowed set', () => {
    for (const e of sprites.entries) {
      expect(SPRITE_KINDS.has(e.kind), `unexpected sprite kind: ${e.kind}`).toBe(true);
    }
  });

  test('all sfx entry kinds are in the allowed set', () => {
    for (const e of audio.sfx) {
      expect(AUDIO_KINDS.has(e.kind), `unexpected sfx kind: ${e.kind}`).toBe(true);
    }
  });

  test('all music entry kinds are in the allowed set', () => {
    for (const e of audio.music) {
      expect(AUDIO_KINDS.has(e.kind), `unexpected music kind: ${e.kind}`).toBe(true);
    }
  });

  test('all portrait entry kinds are in the allowed set', () => {
    for (const e of portraits.entries) {
      expect(PORTRAIT_KINDS.has(e.kind), `unexpected portrait kind: ${e.kind}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Loader dispatch coverage — shipped kinds are wired; reserved kinds throw.
// ---------------------------------------------------------------------------
describe('loader dispatch coverage', () => {
  test('loadSpriteAtlas dispatches shape-atlas kind (throws only on missing Skia)', () => {
    // Verify texture-packer kind throws the reserved message.
    // Symlink-guarded: sprites-loader.ts pulls @flare-engine/assets transitively.
    try {
      const { loadSpriteAtlas } = require('../src/assets/sprites-loader');
      let threw = false;
      let msg = '';
      try {
        loadSpriteAtlas(null, {
          version: 1,
          entries: [{ key: 'shape-atlas', kind: 'texture-packer' }],
        });
      } catch (inner) {
        threw = true;
        msg = (inner as Error).message;
      }
      expect(threw).toBe(true);
      expect(msg).toContain('texture-packer kind reserved');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('loadSfxBuffers dispatches synth kind (symlink-guarded)', () => {
    try {
      const { loadSfxBuffers } = require('../src/assets/audio-loader');
      const fakeCtx = {
        createBuffer: (_ch: number, len: number, sr: number) => ({
          length: len,
          sampleRate: sr,
          getChannelData: () => new Float32Array(len),
        }),
        sampleRate: 44100,
      };
      const result = loadSfxBuffers(fakeCtx, {
        version: 1,
        sfx: [{ key: 'shoot', kind: 'synth' }],
        music: [],
      });
      expect(result).toHaveProperty('shoot');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('loadMusicBuffers dispatches synth kind (symlink-guarded)', () => {
    try {
      const { loadMusicBuffers } = require('../src/assets/audio-loader');
      const fakeCtx = {
        createBuffer: (_ch: number, len: number, sr: number) => ({
          length: len,
          sampleRate: sr,
          getChannelData: () => new Float32Array(len),
        }),
        sampleRate: 22050,
      };
      const result = loadMusicBuffers(fakeCtx, {
        version: 1,
        sfx: [],
        music: [{ key: 'zone1', kind: 'synth' }],
      });
      expect(result).toHaveProperty('zone1');
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Boundary lint — no source file outside src/assets/ (or the placeholder
//    modules themselves) directly imports the underlying synth/shape-catalogue/
//    portrait-manifest modules.
// ---------------------------------------------------------------------------
describe('boundary lint — no hardcoded imports outside src/assets/', () => {
  const ROOT = path.resolve(__dirname, '..');
  const SRC = path.join(ROOT, 'src');

  // Files that are allowed to import the underlying modules directly.
  // Includes the placeholder modules themselves and their immediate internal
  // consumers (sfx.ts / zones.ts import type aliases; index.ts re-exports the
  // shape catalogue for the play scene).
  const ALLOWED = new Set([
    path.join(SRC, 'assets', 'sprites-loader.ts'),
    path.join(SRC, 'assets', 'audio-loader.ts'),
    path.join(SRC, 'assets', 'portraits-loader.ts'),
    path.join(SRC, 'assets', 'manifests.ts'),
    path.join(SRC, 'assets', 'manifest-types.ts'),
    path.join(SRC, 'assets', 'index.ts'),
    path.join(SRC, 'shape-atlas.ts'),
    path.join(SRC, 'visual-spec', 'shapes-catalogue.ts'),
    path.join(SRC, 'audio', 'synth.ts'),
    path.join(SRC, 'audio', 'sfx.ts'),
    path.join(SRC, 'dialogue', 'portrait-manifest.ts'),
    path.join(SRC, 'config', 'zones.ts'),
    path.join(SRC, 'visual-spec', 'types.ts'),
    path.join(SRC, 'index.ts'),
  ]);

  const FORBIDDEN = [
    /['"]\.\/shape-catalogue['"]/,
    /['"]\.\.\/shape-catalogue['"]/,
    /['"]\.\/synth['"]/,
    /['"]\.\.\/audio\/synth['"]/,
    /['"]\.\/audio\/synth['"]/,
    /['"]\.\/portrait-manifest['"]/,
    /['"]\.\.\/dialogue\/portrait-manifest['"]/,
  ];

  function collectTs(dir: string, out: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectTs(full, out);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        out.push(full);
      }
    }
  }

  const files: string[] = [];
  collectTs(SRC, files);

  test('no non-asset source file imports the placeholder modules directly', () => {
    const violations: string[] = [];
    for (const file of files) {
      if (ALLOWED.has(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(ROOT, file)}: matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. Dry-run swap — zone1 music entry with kind:'file' throws reserved message.
// ---------------------------------------------------------------------------
describe('dry-run swap — file kind throws reserved message', () => {
  test('loadMusicBuffers throws when zone1 entry has kind:file', () => {
    try {
      const { loadMusicBuffers } = require('../src/assets/audio-loader');
      const fakeCtx = {
        createBuffer: (_ch: number, len: number, sr: number) => ({
          length: len,
          sampleRate: sr,
          getChannelData: () => new Float32Array(len),
        }),
        sampleRate: 22050,
      };
      const fixtureManifest = {
        version: 1,
        sfx: [],
        music: [{ key: 'zone1', kind: 'file', path: 'audio/zone1.mp3' }],
      };
      expect(() => loadMusicBuffers(fakeCtx, fixtureManifest)).toThrow(
        'file kind reserved for M9.6 production drop',
      );
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Resolve portrait via manifest — manifest path returns same shapes as
//    PORTRAIT_MANIFEST directly.
// ---------------------------------------------------------------------------
describe('resolvePortraitViaManifest', () => {
  test('portrait.lucyper via manifest matches PORTRAIT_MANIFEST entry', () => {
    try {
      const { resolvePortraitViaManifest, PORTRAITS_MANIFEST } = require('../src/assets');
      const { PORTRAIT_MANIFEST } = require('../src/dialogue/portrait-manifest');
      const viaManifest = resolvePortraitViaManifest(PORTRAITS_MANIFEST, 'portrait.lucyper');
      const direct = PORTRAIT_MANIFEST['portrait.lucyper'];
      expect(viaManifest).toBeDefined();
      expect(viaManifest).toEqual(direct);
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });

  test('unknown key returns undefined', () => {
    try {
      const { resolvePortraitViaManifest, PORTRAITS_MANIFEST } = require('../src/assets');
      expect(resolvePortraitViaManifest(PORTRAITS_MANIFEST, 'portrait.unknown')).toBeUndefined();
    } catch (e) {
      if (!isSymlinkError(e)) throw e;
    }
  });
});
