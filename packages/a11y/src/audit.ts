import { Color } from '@flare-engine/math';
import type { Color as ColorType } from '@flare-engine/math';

/** WCAG 2.x conformance level for a contrast ratio. */
export type WcagLevel = 'fail' | 'AA' | 'AAA';

/**
 * WCAG 2.x contrast ratio between two colors. Order-independent; range [1, 21].
 * Delegates to Color.contrastRatio (relative luminance formula).
 */
export function contrastRatio(fg: ColorType, bg: ColorType): number {
  return Color.contrastRatio(fg, bg);
}

/**
 * Classify a contrast ratio against WCAG 2.x thresholds.
 *
 * Normal text (largeText = false):
 *   ratio >= 7.0 → AAA, ratio >= 4.5 → AA, else fail
 * Large text (largeText = true, >= 18pt normal / >= 14pt bold):
 *   ratio >= 4.5 → AAA, ratio >= 3.0 → AA, else fail
 */
export function wcagLevel(ratio: number, largeText = false): WcagLevel {
  if (largeText) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3.0) return 'AA';
    return 'fail';
  }
  if (ratio >= 7.0) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'fail';
}

/**
 * Perceptual distinguishability between two colors in OKLab space.
 * Returns the Euclidean ΔE distance (OKLab). Delegates to Color.deltaEOk.
 * Rule of thumb: < 0.05 ≈ imperceptibly similar; > 0.1 ≈ distinguishable.
 */
export function deltaE(a: ColorType, b: ColorType): number {
  return Color.deltaEOk(a, b);
}

/**
 * Returns true when two colors are perceptually distinguishable.
 * Uses OKLab ΔE with a caller-supplied threshold (default 0.1).
 * The threshold is a design-level constant — tune per visual layer.
 */
export function isDistinguishable(a: ColorType, b: ColorType, threshold = 0.1): boolean {
  return Color.deltaEOk(a, b) >= threshold;
}

/** Structured result from auditColors. */
export interface AuditResult {
  readonly contrastRatio: number;
  readonly wcagLevel: WcagLevel;
  readonly deltaE: number;
  readonly distinguishable: boolean;
}

export interface AuditOptions {
  /** When true, applies large-text WCAG thresholds. Default false. */
  largeText?: boolean;
  /** OKLab ΔE threshold for isDistinguishable. Default 0.1. */
  deltaEThreshold?: number;
}

/**
 * Run contrast ratio + distinguishability check in one call.
 * Returns structured results, never throws.
 */
export function auditColors(fg: ColorType, bg: ColorType, options?: AuditOptions): AuditResult {
  const largeText = options?.largeText ?? false;
  const threshold = options?.deltaEThreshold ?? 0.1;
  const ratio = Color.contrastRatio(fg, bg);
  const de = Color.deltaEOk(fg, bg);
  return {
    contrastRatio: ratio,
    wcagLevel: wcagLevel(ratio, largeText),
    deltaE: de,
    distinguishable: de >= threshold,
  };
}
