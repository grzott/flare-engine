import { describe, expect, test } from 'bun:test';
import { version } from '../package.json';
import {
  buildProgram,
  createAppSpawnArgs,
  createAppSpawnSpec,
  isValidAppName,
} from '../src/cli.js';

describe('buildProgram', () => {
  test('registers pack-atlas, tiled-to-flare, and new commands', () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name()).sort();
    expect(names).toEqual(['new', 'pack-atlas', 'tiled-to-flare']);
  });

  test('pack-atlas has expected options', () => {
    const program = buildProgram();
    const cmd = program.commands.find((c) => c.name() === 'pack-atlas');
    expect(cmd).toBeDefined();
    const flags = cmd?.options.map((o) => o.long).sort();
    expect(flags).toEqual(['--format', '--max-size', '--name', '--out', '--padding']);
  });

  test('new command accepts template option', () => {
    const program = buildProgram();
    const cmd = program.commands.find((c) => c.name() === 'new');
    const flags = cmd?.options.map((o) => o.long).sort();
    expect(flags).toEqual(['--package-manager', '--template']);
  });

  test('version matches package.json', () => {
    expect(buildProgram().version()).toBe(version);
  });
});

describe('createAppSpawnSpec', () => {
  test('win32 → shell:true, cmd is npx', () => {
    expect(createAppSpawnSpec('win32')).toEqual({ cmd: 'npx', shell: true });
  });

  test('linux → shell:false, cmd is npx', () => {
    expect(createAppSpawnSpec('linux')).toEqual({ cmd: 'npx', shell: false });
  });
});

describe('createAppSpawnArgs', () => {
  test('pins the scoped scaffolder to the CLI version, then forwards the args', () => {
    expect(createAppSpawnArgs('0.4.0', ['my-game', '--template', 'shmup'])).toEqual([
      '@flare-engine/create@0.4.0',
      'my-game',
      '--template',
      'shmup',
    ]);
  });

  test('never spawns an unscoped package name', () => {
    const [spec] = createAppSpawnArgs(version, ['my-game']);
    expect(spec).toBe(`@flare-engine/create@${version}`);
    expect(spec?.startsWith('create-')).toBe(false);
  });
});

describe('isValidAppName', () => {
  test('accepts valid names', () => {
    expect(isValidAppName('my-app')).toBe(true);
    expect(isValidAppName('MyApp')).toBe(true);
    expect(isValidAppName('@scope/pkg')).toBe(true);
  });

  test('rejects injection characters', () => {
    expect(isValidAppName('a; rm -rf /')).toBe(false);
    expect(isValidAppName('a b')).toBe(false);
    expect(isValidAppName('a&b')).toBe(false);
  });
});
