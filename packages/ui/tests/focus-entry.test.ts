import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createFocusKeyboardDriver, createFocusManager } from '@flare-engine/ui/focus';

const DIST = join(import.meta.dir, '..', 'dist');
const BANNED = ['react', 'react-native'];

/** Block comments first so a line comment inside one is not processed separately. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Specifiers from `from '…'`, `import '…'`, `import('…')` and `require('…')`. */
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

/**
 * tsdown hoists the implementation shared by `index` and `focus` into a hashed
 * chunk that the entry file re-exports from, so scanning the entry alone would
 * prove nothing. Follow every relative specifier and collect the bare ones.
 */
function collectBareSpecifiers(file: string, seen = new Set<string>()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const bare: string[] = [];
  for (const spec of extractSpecifiers(readFileSync(file, 'utf8'))) {
    if (spec.startsWith('.')) {
      bare.push(...collectBareSpecifiers(join(dirname(file), spec), seen));
    } else {
      bare.push(spec);
    }
  }
  return bare;
}

describe('extractSpecifiers self-proof', () => {
  const synthetic = `
    /* comment-only: import 'comment-only-pkg'; */
    import 'react-native';
    import { useState } from 'react';
    const z = require('react-native/Libraries/x');
  `;

  it('detects real specifiers and ignores commented ones', () => {
    const specs = extractSpecifiers(synthetic);
    expect(specs).toContain('react-native');
    expect(specs).toContain('react');
    expect(specs).toContain('react-native/Libraries/x');
    expect(specs).not.toContain('comment-only-pkg');
  });
});

describe('dist/focus module graph', () => {
  for (const entry of ['focus.mjs', 'focus.js']) {
    it(`${entry} and its chunks import neither react nor react-native`, () => {
      const specs = collectBareSpecifiers(join(DIST, entry));
      const hits = specs.filter((s) => BANNED.some((b) => s === b || s.startsWith(`${b}/`)));
      expect(hits).toEqual([]);
    });
  }

  it('the scan is not vacuous: dist/index.mjs does import react', () => {
    const specs = collectBareSpecifiers(join(DIST, 'index.mjs'));
    expect(specs).toContain('react');
  });
});

describe('@flare-engine/ui/focus drives a manager', () => {
  it('next / prev / activate through the keyboard driver', () => {
    const manager = createFocusManager();
    const activated: string[] = [];
    manager.register({ id: 'a', tabIndex: 0, onActivate: () => activated.push('a') });
    manager.register({ id: 'b', tabIndex: 1, onActivate: () => activated.push('b') });

    let pressed: string | null = null;
    const driver = createFocusKeyboardDriver(manager, {
      wasPressed: (code) => code === pressed,
    });

    expect(manager.getFocused()).toBe(null);
    pressed = 'ArrowDown';
    driver.update();
    expect(manager.getFocused()).toBe('a');
    driver.update();
    expect(manager.getFocused()).toBe('b');
    pressed = 'ArrowUp';
    driver.update();
    expect(manager.getFocused()).toBe('a');
    pressed = 'Enter';
    driver.update();
    expect(activated).toEqual(['a']);
  });
});
