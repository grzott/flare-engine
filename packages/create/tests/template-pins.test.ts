import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface TemplateManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const TEMPLATE_IDS = ['blank', 'shmup', 'topdown'] as const;

const EXPO_COMPANIONS = ['expo', 'expo-status-bar', '@expo/metro-runtime'] as const;

function readManifest(id: string): TemplateManifest {
  const path = join(__dirname, '..', 'templates', id, 'package.json');
  return JSON.parse(readFileSync(path, 'utf8')) as TemplateManifest;
}

function majorOf(range: string): number {
  const match = /^[~^]?(\d+)/.exec(range);
  if (match === null) throw new Error(`cannot parse a major version from "${range}"`);
  return Number(match[1]);
}

const manifests = TEMPLATE_IDS.map((id) => ({ id, manifest: readManifest(id) }));

describe('template pins', () => {
  test('every dependency shared across templates uses one identical range', () => {
    const ranges = new Map<string, Map<string, string>>();
    for (const { id, manifest } of manifests) {
      const all = { ...manifest.dependencies, ...manifest.devDependencies };
      for (const [name, range] of Object.entries(all)) {
        let byTemplate = ranges.get(name);
        if (byTemplate === undefined) {
          byTemplate = new Map();
          ranges.set(name, byTemplate);
        }
        byTemplate.set(id, range);
      }
    }
    for (const [name, byTemplate] of ranges) {
      if (byTemplate.size < 2) continue;
      const distinct = new Set(byTemplate.values());
      expect(distinct.size, `${name}: ${JSON.stringify([...byTemplate])}`).toBe(1);
    }
  });

  test('expo companions share the SDK major in each template', () => {
    for (const { id, manifest } of manifests) {
      const majors = EXPO_COMPANIONS.map((name) => {
        const range = manifest.dependencies[name];
        if (range === undefined) throw new Error(`${id}: ${name} is missing`);
        return majorOf(range);
      });
      expect(new Set(majors).size, `${id}: ${JSON.stringify(majors)}`).toBe(1);
    }
  });
});
