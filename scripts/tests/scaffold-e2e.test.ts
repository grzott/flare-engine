import { describe, expect, it } from 'bun:test';
import type { WorkspaceManifest } from '../scaffold-e2e.mjs';
import {
  flareClosure,
  linkToTarballs,
  registryResolutions,
  SKIA_SKIP_ENV,
} from '../scaffold-e2e.mjs';

// The pure halves of scaffold-e2e.mjs. The install / tsc / test runs need the
// registry and a built workspace, so CI is where they are exercised; what is
// pinned here is the manifest surgery that decides which artifact a scaffold
// actually installs.

const manifests = new Map<string, WorkspaceManifest>([
  [
    '@flare-engine/engine',
    {
      name: '@flare-engine/engine',
      version: '0.4.8',
      dependencies: { '@flare-engine/math': '^0.4.8', '@flare-engine/react': '^0.4.8' },
      peerDependencies: { react: '>=19.0.0' },
    },
  ],
  [
    '@flare-engine/react',
    {
      name: '@flare-engine/react',
      version: '0.4.8',
      dependencies: { '@flare-engine/math': '^0.4.8' },
      peerDependencies: { '@flare-engine/render': '^0.4.8', react: '>=19.0.0' },
    },
  ],
  ['@flare-engine/render', { name: '@flare-engine/render', version: '0.4.8' }],
  ['@flare-engine/math', { name: '@flare-engine/math', version: '0.4.8' }],
  ['@flare-engine/unused', { name: '@flare-engine/unused', version: '0.4.8' }],
]);

describe('flareClosure', () => {
  it('follows dependencies and peerDependencies transitively, sorted, without unrelated packages', () => {
    expect(flareClosure(['@flare-engine/engine'], manifests)).toEqual([
      '@flare-engine/engine',
      '@flare-engine/math',
      '@flare-engine/react',
      '@flare-engine/render',
    ]);
  });

  it('ignores names outside the scope', () => {
    expect(flareClosure(['react', '@flare-engine/math'], manifests)).toEqual([
      '@flare-engine/math',
    ]);
  });

  it('names a scoped dependency that is not a workspace package', () => {
    expect(() => flareClosure(['@flare-engine/missing'], manifests)).toThrow(
      /@flare-engine\/missing/,
    );
  });
});

describe('linkToTarballs', () => {
  const tarballs = new Map([
    ['@flare-engine/engine', 'flare-engine-engine-0.4.8.tgz'],
    ['@flare-engine/react', 'flare-engine-react-0.4.8.tgz'],
    ['@flare-engine/math', 'flare-engine-math-0.4.8.tgz'],
  ]);

  it('points every scoped dependency at its tarball and overrides the transitive ones', () => {
    const scaffolded = {
      name: 'my-app',
      dependencies: { '@flare-engine/engine': '^0.4.8', expo: '~57.0.0' },
      devDependencies: { '@flare-engine/react': '^0.4.8', typescript: '^5.5.0' },
    };
    const linked = linkToTarballs(scaffolded, tarballs, '../tarballs');
    expect(linked.dependencies).toEqual({
      '@flare-engine/engine': 'file:../tarballs/flare-engine-engine-0.4.8.tgz',
      expo: '~57.0.0',
    });
    expect(linked.devDependencies).toEqual({
      '@flare-engine/react': 'file:../tarballs/flare-engine-react-0.4.8.tgz',
      typescript: '^5.5.0',
    });
    // Every packed package is overridden, including the ones the scaffold does
    // not list: a registry copy of `math` under `engine` would defeat the gate.
    expect(linked.overrides).toEqual({
      '@flare-engine/engine': 'file:../tarballs/flare-engine-engine-0.4.8.tgz',
      '@flare-engine/react': 'file:../tarballs/flare-engine-react-0.4.8.tgz',
      '@flare-engine/math': 'file:../tarballs/flare-engine-math-0.4.8.tgz',
    });
  });

  it('does not mutate the input and keeps unrelated fields', () => {
    const scaffolded = {
      name: 'my-app',
      scripts: { test: 'bun test' },
      dependencies: { '@flare-engine/engine': '^0.4.8' },
    };
    const linked = linkToTarballs(scaffolded, tarballs, '../tarballs');
    expect(scaffolded.dependencies['@flare-engine/engine']).toBe('^0.4.8');
    expect(linked.scripts).toEqual({ test: 'bun test' });
    expect(linked.name).toBe('my-app');
  });

  it('refuses a scoped dependency with no tarball instead of leaving the registry range', () => {
    const scaffolded = { dependencies: { '@flare-engine/physics': '^0.4.8' } };
    expect(() => linkToTarballs(scaffolded, tarballs, '../tarballs')).toThrow(
      /@flare-engine\/physics/,
    );
  });
});

describe('registryResolutions', () => {
  // Shapes copied from a real scaffold bun.lock (bun 1.3.11).
  const tarball =
    '"@flare-engine/math": ["@flare-engine/math@../tarballs/flare-engine-math-0.4.8.tgz", {}, "sha512-x"],';
  const registry =
    '"@flare-engine/math": ["@flare-engine/math@0.4.8", "", { "dependencies": {} }, "sha512-y"],';
  const dependant =
    '"@flare-engine/ecs": ["@flare-engine/ecs@../tarballs/flare-engine-ecs-0.4.8.tgz", { "dependencies": { "@flare-engine/math": "^0.4.8" } }, "sha512-z"],';
  const thirdParty = '"react": ["react@19.2.3", "", {}, "sha512-r"],';

  it('is empty when every scoped package resolved to a tarball', () => {
    expect(registryResolutions([tarball, dependant, thirdParty].join('\n'))).toEqual([]);
  });

  it('names a scoped package that resolved to a registry version', () => {
    expect(registryResolutions([registry, dependant, thirdParty].join('\n'))).toEqual([
      '@flare-engine/math',
    ]);
  });

  it('does not mistake a dependency range for a resolution', () => {
    // `"@flare-engine/math": "^0.4.8"` inside ecs's dependencies is a range, not
    // a resolution: only `name@<version>` inside a quoted string counts.
    expect(registryResolutions(dependant)).toEqual([]);
  });

  it('ignores third-party registry packages', () => {
    expect(registryResolutions(thirdParty)).toEqual([]);
  });
});

describe('SKIA_SKIP_ENV', () => {
  it('is the variable react-native-skia reads to skip its binary download', () => {
    expect(SKIA_SKIP_ENV).toBe('SKIP_SKIA_DOWNLOAD');
  });
});
