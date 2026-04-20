import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TEMPLATES, isTemplateId } from '../src/manifest.js';
import { detectPackageManager, scaffoldApp } from '../src/scaffold.js';

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

    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-app');
    expect(pkg.dependencies['@flare-engine/engine']).toBe('^1.2.3');

    const readme = await readFile(join(target, 'README.md'), 'utf8');
    expect(readme).toContain('# my-app');
    expect(readme).toContain('`blank` template');
    expect(readme).not.toContain('__APP_NAME__');
    expect(readme).not.toContain('__TEMPLATE_ID__');

    const app = await readFile(join(target, 'src', 'App.tsx'), 'utf8');
    expect(app.length).toBeGreaterThan(0);
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
      if (id === 'topdown') expect(app).toContain('camera.follow');
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
    // first scaffold populates the dir
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
