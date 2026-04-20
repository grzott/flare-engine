import { describe, expect, test } from 'bun:test';
import { buildProgram } from '../src/cli.js';

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
});
