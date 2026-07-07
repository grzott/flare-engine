import { spawn } from 'node:child_process';
import { Command } from 'commander';
import { version } from '../package.json';
import { packAtlas } from './pack-atlas.js';
import { convertTiled } from './tiled-to-flare.js';

function parseIntArg(value: string, _prev: number): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) throw new Error(`invalid integer: ${value}`);
  return n;
}

function parseFormatArg(value: string): 'png' | 'webp' {
  if (value !== 'png' && value !== 'webp') {
    throw new Error(`invalid --format: ${value} (expected png|webp)`);
  }
  return value;
}

function parseTemplateArg(value: string): 'blank' | 'topdown' | 'shmup' {
  if (value !== 'blank' && value !== 'topdown' && value !== 'shmup') {
    throw new Error(`invalid --template: ${value} (expected blank|topdown|shmup)`);
  }
  return value;
}

function parsePmArg(value: string): 'bun' | 'npm' | 'pnpm' {
  if (value !== 'bun' && value !== 'npm' && value !== 'pnpm') {
    throw new Error(`invalid --package-manager: ${value} (expected bun|npm|pnpm)`);
  }
  return value;
}

const VALID_APP_NAME = /^[a-z0-9@/_-]+$/i;

/** Returns true when the name is safe to use as an app name and shell argument. */
export function isValidAppName(name: string): boolean {
  return VALID_APP_NAME.test(name);
}

/** Returns the spawn configuration for `npx create-flare-app` on the given platform. */
export function createAppSpawnSpec(platform: NodeJS.Platform): { cmd: string; shell: boolean } {
  return { cmd: 'npx', shell: platform === 'win32' };
}

/** Build the `flare` CLI program. Exposed for tests. */
export function buildProgram(): Command {
  const program = new Command();
  program.name('flare').description('Flare engine CLI').version(version);

  program
    .command('pack-atlas <input>')
    .description('Pack a directory of PNG sprites into an atlas JSON + image')
    .option('-o, --out <dir>', 'output directory (defaults to <input>)')
    .option('-n, --name <name>', 'base filename for the atlas pair', 'atlas')
    .option('-p, --padding <n>', 'pixel padding between sprites', parseIntArg, 2)
    .option('-m, --max-size <n>', 'maximum atlas side length in px', parseIntArg, 2048)
    .option('-f, --format <fmt>', 'output image format (png|webp)', parseFormatArg, 'png')
    .action(async (input: string, opts) => {
      const result = await packAtlas({
        input,
        out: opts.out,
        name: opts.name,
        padding: opts.padding,
        maxSize: opts.maxSize,
        format: opts.format,
      });
      process.stdout.write(
        `[pack-atlas] wrote ${result.frames.length} frames → ${result.imagePath} (${result.width}x${result.height})\n`,
      );
    });

  program
    .command('tiled-to-flare <tmj>')
    .description('Convert a Tiled .tmj file to Flare runtime JSON')
    .option('-o, --out <file>', 'output .json path')
    .option('--no-embed-tilesets', 'keep external tileset references rather than inlining')
    .action(async (input: string, opts) => {
      const result = await convertTiled({
        input,
        out: opts.out,
        embedTilesets: opts.embedTilesets,
      });
      process.stdout.write(
        `[tiled-to-flare] wrote ${result.layers.length} layers → ${result.outPath}\n`,
      );
    });

  program
    .command('new <name>')
    .description('Scaffold a new Flare app (alias for create-flare-app)')
    .option('-t, --template <name>', 'template (blank|topdown|shmup)', parseTemplateArg, 'blank')
    .option('-p, --package-manager <pm>', 'package manager (bun|npm|pnpm)', parsePmArg)
    .action(async (name: string, opts) => {
      if (!VALID_APP_NAME.test(name)) throw new Error(`invalid app name: ${name}`);
      const args = [name, '--template', opts.template];
      if (opts.packageManager) args.push('--package-manager', opts.packageManager);
      const code = await runCreateFlareApp(args);
      if (code !== 0) process.exit(code);
    });

  return program;
}

function runCreateFlareApp(args: string[]): Promise<number> {
  return new Promise((resolvePromise) => {
    const { cmd, shell } = createAppSpawnSpec(process.platform);
    const child = spawn(cmd, ['create-flare-app', ...args], {
      stdio: 'inherit',
      shell,
    });
    child.on('exit', (code) => resolvePromise(code ?? 1));
    child.on('error', () => resolvePromise(1));
  });
}
