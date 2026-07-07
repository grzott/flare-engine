import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { version } from '../package.json';
import { TEMPLATES, type TemplateId, isTemplateId } from './manifest.js';

/** Options for `scaffoldApp`. */
export interface ScaffoldOptions {
  /** App name — also used as the target directory and `name` in package.json. */
  name: string;
  /** Template id (default: `blank`). */
  template?: string;
  /** Destination directory (default: `<cwd>/<name>`). */
  targetDir?: string;
  /** Package manager used for `engines` + post-install command. */
  packageManager?: 'bun' | 'npm' | 'pnpm';
  /** Skip `install` after copying (default: false). */
  skipInstall?: boolean;
  /** Pinned Flare version for template {{FLARE_VERSION}} token (default: current package version prefixed with ^). */
  flareVersion?: string;
  /** Override templates root — used by tests. */
  templatesDir?: string;
}

/** Result returned by `scaffoldApp`. */
export interface ScaffoldResult {
  /** Absolute path of the scaffolded app. */
  targetDir: string;
  /** Resolved template id. */
  template: TemplateId;
  /** Package manager used. */
  packageManager: 'bun' | 'npm' | 'pnpm';
  /** Whether install was run. */
  installed: boolean;
}

const FILENAME = fileURLToPath(import.meta.url);
const DEFAULT_TEMPLATES_DIR = resolve(dirname(FILENAME), '..', 'templates');

const VALID_APP_NAME = /^[a-z0-9@/_-]+$/i;

/** Returns true when the name is safe to use as an app name and shell argument. */
export function isValidAppName(name: string): boolean {
  return VALID_APP_NAME.test(name);
}

/** Detect the package manager from `--package-manager` > `npm_config_user_agent` > `bun`. */
export function detectPackageManager(explicit: string | undefined): 'bun' | 'npm' | 'pnpm' {
  if (explicit === 'bun' || explicit === 'npm' || explicit === 'pnpm') return explicit;
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('bun')) return 'bun';
  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('npm') || agent.startsWith('yarn')) return 'npm';
  return 'bun';
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const TOKEN_FILE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.txt',
  '.html',
  '.css',
]);

function shouldApplyTokens(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return TOKEN_FILE_EXTS.has(path.slice(dot).toLowerCase());
}

function replaceTokens(content: string, tokens: Record<string, string>): string {
  let out = content;
  for (const [k, v] of Object.entries(tokens)) out = out.split(k).join(v);
  return out;
}

async function walkFiles(dir: string, base: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = full.slice(base.length + 1);
    if (e.isDirectory()) {
      await walkFiles(full, base, out);
    } else if (e.isFile()) {
      out.push(rel);
    }
  }
}

/** Returns the spawn configuration for the given package manager on the given platform. */
export function installSpawnSpec(
  pm: 'bun' | 'npm' | 'pnpm',
  platform: NodeJS.Platform,
): { cmd: string; shell: boolean } {
  return { cmd: pm, shell: platform === 'win32' };
}

function runInstall(pm: 'bun' | 'npm' | 'pnpm', cwd: string): Promise<number> {
  return new Promise((resolvePromise) => {
    const { cmd, shell } = installSpawnSpec(pm, process.platform);
    const child = spawn(cmd, ['install'], {
      cwd,
      stdio: 'inherit',
      shell,
    });
    child.on('exit', (code) => resolvePromise(code ?? 1));
    child.on('error', () => resolvePromise(1));
  });
}

/**
 * Copy the chosen template into `targetDir`, apply token replacements, and
 * optionally run the package manager's install. Fails if the target exists
 * and is non-empty.
 */
export async function scaffoldApp(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  if (!isValidAppName(opts.name)) {
    throw new Error(`[create-flare-app] invalid app name: ${opts.name}`);
  }
  const templateId = opts.template ?? 'blank';
  if (!isTemplateId(templateId)) {
    throw new Error(`[create-flare-app] unknown template: ${templateId}`);
  }
  const manifest = TEMPLATES[templateId];
  if (!manifest) throw new Error(`[create-flare-app] missing manifest for ${templateId}`);

  const cwd = process.cwd();
  const target = opts.targetDir
    ? isAbsolute(opts.targetDir)
      ? opts.targetDir
      : resolve(cwd, opts.targetDir)
    : resolve(cwd, opts.name);

  if (await pathExists(target)) {
    const entries = await readdir(target);
    if (entries.length > 0) {
      throw new Error(`[create-flare-app] target ${target} already exists and is not empty`);
    }
  } else {
    await mkdir(target, { recursive: true });
  }

  const templatesRoot = opts.templatesDir ?? DEFAULT_TEMPLATES_DIR;
  const src = join(templatesRoot, templateId);
  if (!(await pathExists(src))) {
    throw new Error(`[create-flare-app] template directory not found: ${src}`);
  }

  await cp(src, target, { recursive: true });

  const gi = join(target, 'gitignore');
  if (await pathExists(gi)) {
    await rename(gi, join(target, '.gitignore'));
  }

  const tokens: Record<string, string> = {
    '{{APP_NAME}}': opts.name,
    '{{FLARE_VERSION}}': opts.flareVersion ?? `^${version}`,
    '{{TEMPLATE_ID}}': templateId,
  };

  const files: string[] = [];
  await walkFiles(target, target, files);
  for (const rel of files) {
    if (!shouldApplyTokens(rel)) continue;
    const p = join(target, rel);
    const content = await readFile(p, 'utf8');
    const next = replaceTokens(content, tokens);
    if (next !== content) await writeFile(p, next, 'utf8');
  }

  const pm = detectPackageManager(opts.packageManager);
  let installed = false;
  if (!opts.skipInstall) {
    const code = await runInstall(pm, target);
    if (code !== 0) {
      throw new Error(`[create-flare-app] ${pm} install exited with code ${code}`);
    }
    installed = true;
  }

  return {
    targetDir: target,
    template: templateId,
    packageManager: pm,
    installed,
  };
}
