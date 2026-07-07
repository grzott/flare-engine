import { Command } from 'commander';
import { version } from '../package.json';
import { TEMPLATES } from './manifest.js';
import { scaffoldApp } from './scaffold.js';

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

/** Build the `create-flare-app` CLI program. Exposed for tests. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name('create-flare-app')
    .description('Scaffold a new Flare engine app')
    .version(version)
    .argument('<name>', 'directory name / package name for the new app')
    .option('-t, --template <name>', 'template (blank|topdown|shmup)', parseTemplateArg, 'blank')
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
        `[create-flare-app] scaffolded ${
          manifest?.displayName ?? result.template
        } at ${result.targetDir}\n`,
      );
      if (!result.installed) {
        process.stdout.write(
          `[create-flare-app] skipped install — run \`cd ${name} && ${result.packageManager} install\` when ready\n`,
        );
      } else if (manifest?.postInstall) {
        process.stdout.write(`[create-flare-app] next: cd ${name} && ${manifest.postInstall}\n`);
      }
    });
  return program;
}
