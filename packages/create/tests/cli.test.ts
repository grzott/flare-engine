import { describe, expect, test } from 'bun:test';
import { version } from '../package.json';
import { buildProgram } from '../src/cli.js';

describe('buildProgram', () => {
  test('registers required options', () => {
    const program = buildProgram();
    const flags = program.options.map((o) => o.long);
    expect(flags).toContain('--template');
    expect(flags).toContain('--package-manager');
    expect(flags).toContain('--skip-install');
  });

  test('name is required positional argument', () => {
    const program = buildProgram();
    const args = program.registeredArguments ?? [];
    expect(args.length).toBeGreaterThan(0);
  });

  test('version matches package.json', () => {
    expect(buildProgram().version()).toBe(version);
  });
});
