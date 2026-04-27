import { getCodexEntriesByCategory } from './entries';
import type { CodexEntryId } from './entries';

export interface BossCodexExtra {
  readonly id: CodexEntryId;
  readonly phases: 1 | 2 | 3;
  readonly phaseStatsKeys: readonly string[];
}

export const BOSS_CODEX_EXTRAS: readonly BossCodexExtra[] = [
  {
    id: 'smok-krzemionkowski',
    phases: 2,
    phaseStatsKeys: [
      'codex.smok-krzemionkowski.phase1_stats',
      'codex.smok-krzemionkowski.phase2_stats',
    ],
  },
  {
    id: 'borowy-krol',
    phases: 2,
    phaseStatsKeys: ['codex.borowy-krol.phase1_stats', 'codex.borowy-krol.phase2_stats'],
  },
  {
    id: 'wodnik-wislanny',
    phases: 2,
    phaseStatsKeys: ['codex.wodnik-wislanny.phase1_stats', 'codex.wodnik-wislanny.phase2_stats'],
  },
  {
    id: 'boruta',
    phases: 2,
    phaseStatsKeys: ['codex.boruta.phase1_stats', 'codex.boruta.phase2_stats'],
  },
  {
    id: 'baba-jaga',
    phases: 3,
    phaseStatsKeys: [
      'codex.baba-jaga.phase1_stats',
      'codex.baba-jaga.phase2_stats',
      'codex.baba-jaga.phase3_stats',
    ],
  },
  {
    id: 'bazyliszek-warszawski',
    phases: 3,
    phaseStatsKeys: [
      'codex.bazyliszek-warszawski.phase1_stats',
      'codex.bazyliszek-warszawski.phase2_stats',
      'codex.bazyliszek-warszawski.phase3_stats',
    ],
  },
  {
    id: 'mefistofeles',
    phases: 3,
    phaseStatsKeys: [
      'codex.mefistofeles.phase1_stats',
      'codex.mefistofeles.phase2_stats',
      'codex.mefistofeles.phase3_stats',
    ],
  },
  {
    id: 'lucyper-ksiezycowy',
    phases: 3,
    phaseStatsKeys: [
      'codex.lucyper-ksiezycowy.phase1_stats',
      'codex.lucyper-ksiezycowy.phase2_stats',
      'codex.lucyper-ksiezycowy.phase3_stats',
    ],
  },
];

const BOSS_EXTRA_BY_ID: ReadonlyMap<CodexEntryId, BossCodexExtra> = new Map(
  BOSS_CODEX_EXTRAS.map((e) => [e.id, e] as const),
);

export function findBossExtra(id: string): BossCodexExtra | undefined {
  return BOSS_EXTRA_BY_ID.get(id as CodexEntryId);
}

export function getBossIds(): readonly CodexEntryId[] {
  return getCodexEntriesByCategory('boss').map((e) => e.id);
}
