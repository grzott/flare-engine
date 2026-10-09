import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The template `tsconfig.json` files are copied verbatim into every scaffolded
 * project, and nothing in this repo compiles them (HYG11).
 *
 * `tsconfig.templates.json` compiles the template *sources*, but under its own
 * options — it extends `tsconfig.base.json` and sets `jsx: "react-jsx"`, where
 * the shipped templates set `jsx: "react-native"` and extend nothing. So the
 * config a new developer actually builds against is never exercised, and the
 * repo's green check says nothing about it.
 *
 * Compiling them properly here is not possible: they resolve `expo`,
 * `react-native` and published `@flare-engine/*` versions that are not
 * installed in this workspace. These assertions cover what can be checked
 * without that toolchain — the config parses, keeps the options the templates
 * depend on, and does not silently omit a source file that ships beside it.
 */
const TEMPLATES_DIR = join(import.meta.dir, '..', 'templates');
const TEMPLATES = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

type TsConfig = {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
};

const readConfig = (template: string): TsConfig =>
  JSON.parse(readFileSync(join(TEMPLATES_DIR, template, 'tsconfig.json'), 'utf8')) as TsConfig;

describe('shipped template tsconfigs', () => {
  it('finds every template (guards against an empty sweep passing vacuously)', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(TEMPLATES).toContain('blank');
  });

  for (const template of TEMPLATES) {
    describe(template, () => {
      it('is parseable JSON', () => {
        expect(() => readConfig(template)).not.toThrow();
      });

      it('keeps the options a scaffolded React Native project needs', () => {
        const opts = readConfig(template).compilerOptions ?? {};
        // `jsx` deliberately differs from tsconfig.templates.json's react-jsx:
        // a scaffolded Expo/RN app builds with react-native. Pinned so the
        // divergence is a recorded fact rather than an accident.
        expect(opts.jsx).toBe('react-native');
        expect(opts.strict).toBe(true);
        expect(opts.moduleResolution).toBe('bundler');
        expect(opts.isolatedModules).toBe(true);
      });

      it('includes every entry file that ships beside it', () => {
        // The bug this pins: all three templates shipped an `index.web.ts` that
        // their own tsconfig did not include, so a scaffolded project's
        // typecheck skipped its web entry point entirely. The repo never saw it
        // because tsconfig.templates.json compiles that file under its own
        // include list.
        const dir = join(TEMPLATES_DIR, template);
        const entries = readdirSync(dir).filter((f) => /^index.*\.tsx?$/.test(f));
        const include = readConfig(template).include ?? [];
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
          expect(include).toContain(entry);
        }
      });
    });
  }
});
