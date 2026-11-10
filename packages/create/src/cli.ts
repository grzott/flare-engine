import { Command } from 'commander';
import { version } from '../package.json';
import type { TemplateId } from './manifest.js';
import { isTemplateId, TEMPLATES } from './manifest.js';
import { scaffoldApp } from './scaffold.js';

const TEMPLATE_IDS = Object.keys(TEMPLATES).join('|');

function parseTemplateArg(value: string): TemplateId {
  if (!isTemplateId(value)) {
    throw new Error(`invalid --template: ${value} (expected ${TEMPLATE_IDS})`);
  }
  return value;
}

function parsePmArg(value: string): 'bun' | 'npm' | 'pnpm' {
  if (value !== 'bun' && value !== 'npm' && value !== 'pnpm') {
    throw new Error(`invalid --package-manager: ${value} (expected bun|npm|pnpm)`);
  }
  return value;
}

/** Build the `flare-create` CLI program. Exposed for tests. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('flare-create')
    .description('Scaffold a new Flare engine app')
    .version(version)
    .argument('<name>', 'directory name / package name for the new app')
    .option('-t, --template <name>', `template (${TEMPLATE_IDS})`, parseTemplateArg, 'blank')
    .option('-p, --package-manager <pm>', 'package manager (bun|npm|pnpm)', parsePmArg)
    .option('--skip-install', 'skip running install after scaffolding', false)
    .action(async (name: string, opts) => {
      const result = await scaffoldApp({
        name,
        template: opts.template,
        packageManager: opts.packageManager,
        skipInstall: opts.skipInstall === true,
      });
      const manifest = TEMPLATES[result.template];
      process.stdout.write(
        `[flare-create] scaffolded ${
          manifest?.displayName ?? result.template
        } at ${result.targetDir}\n`,
      );
      const pm = result.packageManager;
      const next = manifest?.postInstall ? `${pm} ${manifest.postInstall} (or: ${pm} run ios)` : '';
      if (!result.installed) {
        process.stdout.write(
          next
            ? `[flare-create] skipped install — next: cd ${name} && ${pm} install && ${next}\n`
            : `[flare-create] skipped install — run \`cd ${name} && ${pm} install\` when ready\n`,
        );
      } else if (next) {
        process.stdout.write(`[flare-create] next: cd ${name} && ${next}\n`);
      }
    });
  return program;
}
