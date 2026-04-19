/**
 * Text-over-time reveal hook for dialogue lines.
 *
 * Drives a typewriter effect: call `updateTextReveal(state, dt)` each frame
 * and read `state.visibleText` for the currently revealed substring.
 * Supports per-character speed, instant-complete, and pause-on-punctuation.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface TextRevealState {
  /** Full text being revealed. */
  readonly fullText: string;
  /** Characters revealed so far. */
  visibleText: string;
  /** Whether the full text has been revealed. */
  complete: boolean;
  /** Internal fractional character cursor. */
  _cursor: number;
}

export interface TextRevealOptions {
  /** Characters per second. Default: 30. */
  speed?: number;
  /** Extra delay (in seconds) after punctuation (.!?). Default: 0.15. */
  punctuationDelay?: number;
}

const DEFAULT_SPEED = 30;
const DEFAULT_PUNCT_DELAY = 0.15;

const PUNCTUATION = new Set(['.', '!', '?', ':', ';']);

// ─── API ─────────────────────────────────────────────────────────

export function createTextReveal(text: string): TextRevealState {
  if (text.length === 0) {
    return { fullText: text, visibleText: text, complete: true, _cursor: 0 };
  }
  return { fullText: text, visibleText: '', complete: false, _cursor: 0 };
}

export function updateTextReveal(
  state: TextRevealState,
  dt: number,
  options?: TextRevealOptions,
): void {
  if (state.complete) return;

  const speed = options?.speed ?? DEFAULT_SPEED;
  const punctDelay = options?.punctuationDelay ?? DEFAULT_PUNCT_DELAY;
  const len = state.fullText.length;

  // Determine effective speed — slow down after punctuation
  const prevCharIdx = Math.floor(state._cursor) - 1;
  let effectiveSpeed = speed;
  if (prevCharIdx >= 0 && prevCharIdx < len) {
    const prevChar = state.fullText[prevCharIdx]!;
    if (PUNCTUATION.has(prevChar)) {
      // Slow down: treat the punctuation gap as taking `punctDelay` seconds
      // Effective speed = 1 / punctDelay so cursor advances ~1 char in punctDelay time
      effectiveSpeed = punctDelay > 0 ? 1 / punctDelay : speed;
    }
  }

  state._cursor += effectiveSpeed * dt;
  const charCount = Math.min(Math.floor(state._cursor), len);
  state.visibleText = state.fullText.slice(0, charCount);

  if (charCount >= len) {
    state.visibleText = state.fullText;
    state.complete = true;
  }
}

export function completeTextReveal(state: TextRevealState): void {
  state.visibleText = state.fullText;
  state._cursor = state.fullText.length;
  state.complete = true;
}

export function resetTextReveal(state: TextRevealState, newText?: string): void {
  const text = newText ?? state.fullText;
  (state as { fullText: string }).fullText = text;
  state.visibleText = '';
  state._cursor = 0;
  state.complete = text.length === 0;
}
