/** Named postfx chains triggered on boss phase-break events. */
export type BossPostFxKind =
  | 'bloom+chrom'
  | 'bloom+vignette'
  | 'bloom+flash'
  | 'bloom+chrom+flash'
  | 'bloom+flash+CRT';

/**
 * Per-boss postfx chain applied on phase-break (§10 visual-reference.md).
 * Key = boss pattern name; value = chain fired when that boss breaks a phase.
 */
export const BOSS_POSTFX_CHAINS: Record<string, BossPostFxKind> = {
  'smok-krzemionkowski': 'bloom+chrom',
  'borowy-krol': 'bloom+vignette',
  'wodnik-wislanny': 'bloom+chrom',
  boruta: 'bloom+flash',
  'baba-jaga': 'bloom+chrom+flash',
  'bazyliszek-warszawski': 'bloom+vignette',
  mefistofeles: 'bloom+chrom',
  'lucyper-ksiezycowy': 'bloom+flash+CRT',
} as const;
