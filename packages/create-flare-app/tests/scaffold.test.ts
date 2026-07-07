import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { version } from '../package.json';
import { TEMPLATES, isTemplateId } from '../src/manifest.js';
import {
  detectPackageManager,
  installSpawnSpec,
  isValidAppName,
  scaffoldApp,
} from '../src/scaffold.js';

const TEMPLATES_DIR = join(__dirname, '..', 'templates');

async function tmp(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'flare-scaffold-'));
}

describe('manifest', () => {
  test('exposes blank, topdown, and shmup templates', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(['blank', 'shmup', 'topdown']);
  });

  test('isTemplateId narrows valid ids', () => {
    expect(isTemplateId('blank')).toBe(true);
    expect(isTemplateId('topdown')).toBe(true);
    expect(isTemplateId('shmup')).toBe(true);
    expect(isTemplateId('unknown')).toBe(false);
  });
});

describe('detectPackageManager', () => {
  test('respects explicit value', () => {
    expect(detectPackageManager('npm')).toBe('npm');
    expect(detectPackageManager('pnpm')).toBe('pnpm');
    expect(detectPackageManager('bun')).toBe('bun');
  });

  test('falls back to bun when nothing is detected', () => {
    const prev = process.env.npm_config_user_agent;
    process.env.npm_config_user_agent = '';
    try {
      expect(detectPackageManager(undefined)).toBe('bun');
    } finally {
      // biome-ignore lint/performance/noDelete: env var must be unset, not set to "undefined"
      if (prev === undefined) delete process.env.npm_config_user_agent;
      else process.env.npm_config_user_agent = prev;
    }
  });

  test('reads npm_config_user_agent', () => {
    const prev = process.env.npm_config_user_agent;
    process.env.npm_config_user_agent = 'pnpm/8.0.0 node/20';
    try {
      expect(detectPackageManager(undefined)).toBe('pnpm');
    } finally {
      // biome-ignore lint/performance/noDelete: env var must be unset, not set to "undefined"
      if (prev === undefined) delete process.env.npm_config_user_agent;
      else process.env.npm_config_user_agent = prev;
    }
  });
});

describe('isValidAppName', () => {
  test('accepts valid names', () => {
    expect(isValidAppName('my-app')).toBe(true);
    expect(isValidAppName('MyApp123')).toBe(true);
    expect(isValidAppName('@scope/name')).toBe(true);
    expect(isValidAppName('a_b-c')).toBe(true);
  });

  test('rejects names with shell-injection characters', () => {
    expect(isValidAppName('bad name; rm -rf')).toBe(false);
    expect(isValidAppName('a b')).toBe(false);
    expect(isValidAppName('a&b')).toBe(false);
    expect(isValidAppName('a|b')).toBe(false);
  });
});

describe('installSpawnSpec', () => {
  test('win32 → shell:true, cmd is the pm name', () => {
    expect(installSpawnSpec('bun', 'win32')).toEqual({ cmd: 'bun', shell: true });
    expect(installSpawnSpec('npm', 'win32')).toEqual({ cmd: 'npm', shell: true });
    expect(installSpawnSpec('pnpm', 'win32')).toEqual({ cmd: 'pnpm', shell: true });
  });

  test('linux → shell:false, cmd is the pm name', () => {
    expect(installSpawnSpec('bun', 'linux')).toEqual({ cmd: 'bun', shell: false });
    expect(installSpawnSpec('npm', 'linux')).toEqual({ cmd: 'npm', shell: false });
  });
});

describe('scaffoldApp', () => {
  test('scaffolds the blank template with token replacement', async () => {
    const base = await tmp();
    const target = join(base, 'my-app');
    const r = await scaffoldApp({
      name: 'my-app',
      template: 'blank',
      targetDir: target,
      skipInstall: true,
      templatesDir: TEMPLATES_DIR,
      flareVersion: '^1.2.3',
    });

    expect(r.targetDir).toBe(target);
    expect(r.template).toBe('blank');
    expect(r.installed).toBe(false);

    const pkgRaw = await readFile(join(target, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);
    expect(pkg.name).toBe('my-app');
    expect(pkg.dependencies['@flare-engine/engine']).toBe('^1.2.3');
    expect(pkgRaw).not.toContain('{{FLARE_VERSION}}');

    const readme = await readFile(join(target, 'README.md'), 'utf8');
    expect(readme).toContain('# my-app');
    expect(readme).toContain('`blank` template');
    expect(readme).not.toContain('{{APP_NAME}}');
    expect(readme).not.toContain('{{TEMPLATE_ID}}');

    const app = await readFile(join(target, 'src', 'App.tsx'), 'utf8');
    expect(app.length).toBeGreaterThan(0);
  });

  test('uses live package version when flareVersion is omitted', async () => {
    const base = await tmp();
    const target = join(base, 'live-version');
    await scaffoldApp({
      name: 'live-version',
      template: 'blank',
      targetDir: target,
      skipInstall: true,
      templatesDir: TEMPLATES_DIR,
    });
    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@flare-engine/engine']).toBe(`^${version}`);
  });

  test('rejects an injection-y app name', async () => {
    const base = await tmp();
    await expect(
      scaffoldApp({
        name: 'bad name; rm -rf',
        template: 'blank',
        targetDir: join(base, 'x'),
        skipInstall: true,
        templatesDir: TEMPLATES_DIR,
      }),
    ).rejects.toThrow(/invalid app name/);
  });

  test('scaffolds topdown and shmup templates', async () => {
    for (const id of ['topdown', 'shmup'] as const) {
      const base = await tmp();
      const target = join(base, id);
      const r = await scaffoldApp({
        name: id,
        template: id,
        targetDir: target,
        skipInstall: true,
        templatesDir: TEMPLATES_DIR,
      });
      expect(r.template).toBe(id);
      const app = await readFile(join(target, 'src', 'App.tsx'), 'utf8');
      if (id === 'topdown') {
        expect(app).toContain('camera.follow');
        expect(app).toContain('TilemapRenderer');
      }
      if (id === 'shmup') expect(app).toContain('FIRE_INTERVAL');
    }
  });

  test('throws on unknown template', async () => {
    const base = await tmp();
    await expect(
      scaffoldApp({
        name: 'x',
        template: 'does-not-exist',
        targetDir: join(base, 'x'),
        skipInstall: true,
        templatesDir: TEMPLATES_DIR,
      }),
    ).rejects.toThrow(/unknown template/);
  });

  test('throws when target dir is non-empty', async () => {
    const base = await tmp();
    const target = join(base, 'existing');
    await scaffoldApp({
      name: 'existing',
      template: 'blank',
      targetDir: target,
      skipInstall: true,
      templatesDir: TEMPLATES_DIR,
    });
    await expect(
      scaffoldApp({
        name: 'existing',
        template: 'blank',
        targetDir: target,
        skipInstall: true,
        templatesDir: TEMPLATES_DIR,
      }),
    ).rejects.toThrow(/already exists/);
  });

  test('copies dotfiles like .gitignore', async () => {
    const base = await tmp();
    const target = join(base, 'with-dotfiles');
    await scaffoldApp({
      name: 'with-dotfiles',
      template: 'blank',
      targetDir: target,
      skipInstall: true,
      templatesDir: TEMPLATES_DIR,
    });
    const info = await stat(join(target, '.gitignore'));
    expect(info.isFile()).toBe(true);
  });
});
