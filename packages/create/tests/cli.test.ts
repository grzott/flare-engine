import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { version } from '../package.json';
import { buildProgram } from '../src/cli.js';
import { TEMPLATES } from '../src/manifest.js';

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

describe('--template parsing', () => {
  const ids = Object.keys(TEMPLATES);

  function templateOption() {
    const option = buildProgram().options.find((o) => o.long === '--template');
    if (!option?.parseArg) throw new Error('--template option has no parser');
    return { option, parseArg: option.parseArg };
  }

  test('accepts every id in TEMPLATES', () => {
    const { parseArg } = templateOption();
    for (const id of ids) {
      expect(parseArg<string | undefined>(id, undefined)).toBe(id);
    }
  });

  test('rejection message lists the ids from TEMPLATES', () => {
    const { parseArg } = templateOption();
    expect(() => parseArg<string | undefined>('nope', undefined)).toThrow(
      `invalid --template: nope (expected ${ids.join('|')})`,
    );
  });

  test('help text lists the ids from TEMPLATES', () => {
    expect(templateOption().option.description).toContain(ids.join('|'));
  });
});

describe('next-step hint', () => {
  const originalCwd = process.cwd();
  let dir: string | undefined;
  let writeSpy: ReturnType<typeof spyOn<typeof process.stdout, 'write'>> | undefined;

  afterEach(() => {
    writeSpy?.mockRestore();
    writeSpy = undefined;
    process.chdir(originalCwd);
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  /** Run the CLI in a fresh temp cwd and return everything it wrote to stdout. */
  async function runCli(args: readonly string[]): Promise<string> {
    dir = await mkdtemp(join(tmpdir(), 'flare-cli-'));
    process.chdir(dir);
    writeSpy = spyOn(process.stdout, 'write').mockImplementation(() => true);
    await buildProgram().parseAsync([...args], { from: 'user' });
    return writeSpy.mock.calls.map((c) => String(c[0])).join('');
  }

  test('npm: next step names npm run android, never bun run start', async () => {
    const out = await runCli(['my-app', '--package-manager', 'npm', '--skip-install']);
    expect(out).toContain('scaffolded Blank at');
    expect(out).toContain('npm run android');
    expect(out).toContain('npm run ios');
    expect(out).not.toContain('bun run start');
    expect(out).not.toContain('bun ');
  });

  test('bun: next step names bun run android', async () => {
    const out = await runCli(['my-app', '--package-manager', 'bun', '--skip-install']);
    expect(out).toContain('bun run android');
    expect(out).not.toContain('bun run start');
  });

  test('pnpm: next step uses pnpm', async () => {
    const out = await runCli(['my-app', '--package-manager', 'pnpm', '--skip-install']);
    expect(out).toContain('pnpm run android');
  });

  test('skip-install folds install before the next step', async () => {
    const out = await runCli(['my-app', '--package-manager', 'npm', '--skip-install']);
    expect(out).toContain('cd my-app && npm install && npm run android');
  });
});
