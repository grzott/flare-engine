/**
 * Type surface for `scaffold-e2e.mjs`, hand-written because the implementation
 * is plain ESM like every sibling `scripts/**\/*.mjs` gate. Only the pure
 * helpers `scripts/tests/scaffold-e2e.test.ts` exercises.
 */

export declare const SKIA_SKIP_ENV: 'SKIP_SKIA_DOWNLOAD';

export type DependencyMap = Record<string, string>;

export interface WorkspaceManifest {
  name: string;
  version?: string;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
}

export interface ScaffoldManifest {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  overrides?: DependencyMap;
}

export declare function flareClosure(
  names: readonly string[],
  manifests: ReadonlyMap<string, WorkspaceManifest>,
): string[];

export declare function registryResolutions(lockText: string): string[];

export declare function linkToTarballs<T extends ScaffoldManifest>(
  manifest: T,
  tarballs: ReadonlyMap<string, string>,
  tarballsRel: string,
): T & { overrides: DependencyMap };
