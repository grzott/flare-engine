import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { BacklogIssue, BacklogManifest } from '../github/import-issues.mjs';
import { backlogMarker, planIssueImport, validateManifest } from '../github/import-issues.mjs';

const knownLabels: string[] = JSON.parse(
  readFileSync(new URL('../../.github/labels.json', import.meta.url), 'utf8'),
).map((l: { name: string }) => l.name);

const always = () => true;
const never = () => false;

const hyg14: BacklogIssue = {
  id: 'HYG14',
  title: 'math: clamp lerp t',
  body: 'Context.\n\n**Do:** clamp.\n\n**Done when:** a test pins it.',
  labels: ['type:hygiene', 'scope:engine', 'size:s', 'priority:p3'],
  milestone: 'Hygiene',
};
const perf7: BacklogIssue = {
  id: 'PERF-7',
  title: 'perf: recapture the web lanes',
  body: 'Context.\n\n**Do:** recapture.\n\n**Done when:** baselines are fresh.',
  labels: ['type:perf', 'scope:engine', 'size:m', 'priority:p2'],
  milestone: 'Perf',
};
const desk: BacklogIssue = {
  id: 'EPIC-DESK',
  title: 'epic: desktop builds',
  body: 'Context.\n\nDesign: `docs/plans/desktop-steam-2026-09.md`\n\n- [ ] DESK-1',
  labels: ['type:feature', 'scope:engine', 'size:l', 'priority:p3'],
  milestone: null,
};

function manifest(issues: BacklogIssue[] = [hyg14, perf7, desk]): BacklogManifest {
  return {
    milestones: [
      { title: 'Hygiene', description: 'Audit findings', due_on: '2027-01-29' },
      { title: 'Perf', description: 'Perf rows', due_on: null },
    ],
    issues,
  };
}

describe('backlogMarker', () => {
  it('wraps the id in an HTML comment', () => {
    expect(backlogMarker('HYG14')).toBe('<!-- backlog-id: HYG14 -->');
  });
});

describe('planIssueImport', () => {
  it('creates everything into an empty repository', () => {
    const plan = planIssueImport(manifest(), [], []);
    expect(plan.createMilestones.map((m) => m.title)).toEqual(['Hygiene', 'Perf']);
    expect(plan.createIssues.map((i) => i.id)).toEqual(['HYG14', 'PERF-7', 'EPIC-DESK']);
    expect(plan.skipped).toEqual([]);
  });

  it('skips an issue whose marker is already in an existing body', () => {
    const existing = [{ number: 50, body: `Context.\n\n${backlogMarker('HYG14')}` }];
    const plan = planIssueImport(manifest(), existing, []);
    expect(plan.skipped).toEqual(['HYG14']);
    expect(plan.createIssues.map((i) => i.id)).toEqual(['PERF-7', 'EPIC-DESK']);
  });

  it('does not mistake one id for another that starts with it', () => {
    const hyg1 = { ...hyg14, id: 'HYG1' };
    const existing = [{ number: 50, body: backlogMarker('HYG14') }];
    const plan = planIssueImport(manifest([hyg1]), existing, []);
    expect(plan.createIssues.map((i) => i.id)).toEqual(['HYG1']);
    expect(plan.skipped).toEqual([]);
  });

  it('tolerates existing issues with no body', () => {
    const plan = planIssueImport(manifest(), [{ number: 1, body: null }], []);
    expect(plan.createIssues).toHaveLength(3);
  });

  it('creates only milestones that do not exist yet', () => {
    const plan = planIssueImport(manifest(), [], ['Hygiene']);
    expect(plan.createMilestones.map((m) => m.title)).toEqual(['Perf']);
  });
});

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    expect(validateManifest(manifest(), knownLabels, always)).toEqual([]);
  });

  it('refuses a duplicate id', () => {
    const problems = validateManifest(manifest([hyg14, perf7, hyg14]), knownLabels, always);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('duplicate id HYG14');
  });

  it('refuses an unknown label', () => {
    const bad = { ...hyg14, labels: [...hyg14.labels, 'not-a-label'] };
    const problems = validateManifest(manifest([bad]), knownLabels, always);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('not-a-label');
  });

  it('refuses a status label', () => {
    const bad = { ...hyg14, labels: [...hyg14.labels, 'status:ready'] };
    const problems = validateManifest(manifest([bad]), knownLabels, always);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('status:ready');
  });

  it('refuses a milestone the manifest does not declare', () => {
    const bad = { ...hyg14, milestone: 'Someday' };
    const problems = validateManifest(manifest([bad]), knownLabels, always);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Someday');
  });

  it('refuses a due date that is not YYYY-MM-DD', () => {
    const m = manifest();
    m.milestones[0] = { ...m.milestones[0]!, due_on: '29/01/2027' };
    const problems = validateManifest(m, knownLabels, always);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('29/01/2027');
  });

  it('refuses size:l without a Design line', () => {
    const bad = { ...desk, body: 'Context with no design.' };
    const problems = validateManifest(manifest([bad]), knownLabels, always);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('EPIC-DESK');
    expect(problems[0]).toContain('Design');
  });

  it('refuses a Design path that does not exist', () => {
    const problems = validateManifest(manifest([desk]), knownLabels, never);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('docs/plans/desktop-steam-2026-09.md');
  });

  it('checks the Design path it was given', () => {
    const seen: string[] = [];
    validateManifest(manifest([desk]), knownLabels, (p) => {
      seen.push(p);
      return true;
    });
    expect(seen).toEqual(['docs/plans/desktop-steam-2026-09.md']);
  });

  it('refuses private material', () => {
    const local = { ...hyg14, body: 'See docs/plans/_local/notes.md for why.' };
    const design = { ...perf7, id: 'PERF-8', body: 'Per roadmap-design D20.' };
    const problems = validateManifest(manifest([local, design]), knownLabels, always);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('HYG14');
    expect(problems[1]).toContain('PERF-8');
  });

  it('refuses private material in a title', () => {
    const bad = { ...hyg14, title: 'follow up roadmap-design D3' };
    expect(validateManifest(manifest([bad]), knownLabels, always)).toHaveLength(1);
  });

  it('refuses private material however it is spelled', () => {
    const variants = [
      'See docs\\plans\\_local\\notes.md.',
      'See `docs/plans/_local` for why.',
      'Per Roadmap-Design.',
      'Per roadmap_design.',
      'This lands in Horizon B.',
    ];
    const issues = variants.map((body, i) => ({ ...hyg14, id: `P-${i}`, body }));
    expect(validateManifest(manifest(issues), knownLabels, always)).toHaveLength(variants.length);
  });

  it('refuses private material in an id or a milestone', () => {
    const m = manifest([{ ...hyg14, id: 'roadmap-design-1' }]);
    m.milestones[1] = { ...m.milestones[1]!, description: 'from docs/plans/_local/x.md' };
    const problems = validateManifest(m, knownLabels, always);
    expect(problems).toHaveLength(2);
    expect(problems.some((p) => p.includes('milestone Perf'))).toBe(true);
    expect(problems.some((p) => p.includes('roadmap-design-1'))).toBe(true);
  });

  it('refuses a Design path outside the repo without asking pathExists', () => {
    const asked: string[] = [];
    const record = (p: string) => {
      asked.push(p);
      return true;
    };
    const up = { ...desk, body: 'Design: `../scan.mjs`' };
    const abs = { ...desk, id: 'EPIC-ABS', body: 'Design: `/etc/passwd`' };
    const drive = { ...desk, id: 'EPIC-DRIVE', body: 'Design: `C:/x.md`' };
    const problems = validateManifest(manifest([up, abs, drive]), knownLabels, record);
    expect(problems).toHaveLength(3);
    expect(asked).toEqual([]);
  });

  it('refuses an issue without exactly one type, scope, size and priority label', () => {
    const missingSize = { ...hyg14, labels: ['type:hygiene', 'scope:engine', 'priority:p3'] };
    const twoTypes = {
      ...perf7,
      labels: ['type:perf', 'type:defect', 'scope:engine', 'size:m', 'priority:p2'],
    };
    const problems = validateManifest(manifest([missingSize, twoTypes]), knownLabels, always);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('size:');
    expect(problems[1]).toContain('type:');
  });
});
