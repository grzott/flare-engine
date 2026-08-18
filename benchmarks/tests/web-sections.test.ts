import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resultsDir, srcDir } from '../src/results.js';
import { renderWebSections } from '../src/web-sections.js';

/**
 * Regression cover for the defect that made these sections generated in the first place: the web
 * numbers used to be hand-appended into `benchmarks.md`, a file the generator rewrites wholesale,
 * so the first routine `bun run bench:md` after they landed deleted every one of them silently.
 *
 * **The load-bearing assertions run against the produced document, not against
 * `renderWebSections` in isolation.** Testing the helper alone passes even when nothing calls it —
 * verified by mutation: deleting the `renderWebSections(lines)` call from `renderMarkdown` left a
 * helper-only suite fully green while the published doc lost all three lanes, which is precisely
 * the bug. `index.ts` is a CLI that runs the whole bench on import and so cannot be imported here,
 * making the committed artifact the honest target.
 */
const DOC = resolve(srcDir(), '..', '..', 'docs', 'references', 'benchmarks.md');

function doc(): string {
  return readFileSync(DOC, 'utf8');
}

function capture(file: string): { render: { kind: string; name: string; p50Ms: number }[] } | null {
  try {
    return JSON.parse(readFileSync(resolve(resultsDir(), file), 'utf8'));
  } catch {
    return null;
  }
}

const LANES = [
  { file: 'web.json', heading: '### Render suite — CPU-raster' },
  { file: 'web-gpu.json', heading: '### Render suite — desktop GPU' },
  { file: 'web-android.json', heading: '### Render suite — Android device (on-device GPU)' },
] as const;

const present = LANES.filter((l) => capture(l.file) !== null);

describe('published doc carries every web lane', () => {
  it('has the top-level Web heading', () => {
    expect(doc()).toContain('## Web (CanvasKit)');
  });

  for (const lane of present) {
    it(`publishes every row of ${lane.file}, with its values`, () => {
      const md = doc();
      expect(md).toContain(lane.heading);

      const rows = capture(lane.file)?.render.filter((r) => r.kind === 'render') ?? [];
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        // The exact rendered cell, so a formatting change that drops precision fails too.
        expect(md).toContain(`| ${r.name} | ${r.p50Ms.toFixed(3)} ms |`);
      }
    });
  }

  it('carries one Ops/batch table per captured lane', () => {
    // Filtered to the web tables specifically: the node suites also open with `| Scenario |` but
    // carry a different column set, so counting every such header would pass for the wrong reason.
    const webHeaders = doc()
      .split('\n')
      .filter((l) => l.startsWith('| Scenario |') && l.includes('Ops/batch'));
    expect(webHeaders.length).toBe(present.length);
  });

  it('does not claim the web backend is unbenchmarked', () => {
    // The generator template carried this line from before the web lanes existed and reinstated it
    // on every regeneration, directly above the tables it had just deleted.
    expect(doc()).not.toContain('never been benchmarked');
  });
});

describe('renderWebSections emits what the doc publishes', () => {
  it('produces the same lane headings the doc carries', () => {
    const lines: string[] = [];
    renderWebSections(lines);
    const generated = lines.join('\n');
    for (const lane of present) expect(generated).toContain(lane.heading);
  });
});
