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
  /** Internal punctuation pause still to wait, in seconds. Absent reads as 0. */
  _pause?: number;
}

export interface TextRevealOptions {
  /** Characters per second. Default: 30. */
  speed?: number;
  /** Extra delay (in seconds) after punctuation (.!?:;). Default: 0.15. */
  punctuationDelay?: number;
}

const DEFAULT_SPEED = 30;
const DEFAULT_PUNCT_DELAY = 0.15;

const PUNCTUATION = new Set(['.', '!', '?', ':', ';']);

// ─── API ─────────────────────────────────────────────────────────

export function createTextReveal(text: string): TextRevealState {
  if (text.length === 0) {
    return { fullText: text, visibleText: text, complete: true, _cursor: 0, _pause: 0 };
  }
  return { fullText: text, visibleText: '', complete: false, _cursor: 0, _pause: 0 };
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

  // The pause is additive time: the cursor stops for `punctDelay` seconds each
  // time it crosses a punctuation character, then resumes at `speed`. The
  // budget is kept in cursor units (speed * dt) and spent boundary by boundary
  // so one large `dt` still honours every pause inside it.
  let cursor = state._cursor;
  let pause = state._pause ?? 0;
  let progress = speed * dt;
  while (progress > 0 && cursor < len) {
    if (pause > 0) {
      const heldTime = progress / speed;
      if (pause >= heldTime) {
        pause -= heldTime;
        progress = 0;
      } else {
        progress -= pause * speed;
        pause = 0;
      }
      continue;
    }
    const nextBoundary = Math.floor(cursor) + 1;
    const distance = nextBoundary - cursor;
    if (progress < distance) {
      cursor += progress;
      break;
    }
    cursor = nextBoundary;
    progress -= distance;
    if (
      nextBoundary < len &&
      punctDelay > 0 &&
      PUNCTUATION.has(state.fullText[nextBoundary - 1]!)
    ) {
      pause = punctDelay;
    }
  }
  state._cursor = cursor;
  state._pause = pause;

  const charCount = Math.min(Math.floor(cursor), len);
  if (charCount >= len) {
    state.visibleText = state.fullText;
    state.complete = true;
    return;
  }
  if (charCount !== state.visibleText.length) {
    state.visibleText = state.fullText.slice(0, charCount);
  }
}

export function completeTextReveal(state: TextRevealState): void {
  state.visibleText = state.fullText;
  state._cursor = state.fullText.length;
  state._pause = 0;
  state.complete = true;
}

export function resetTextReveal(state: TextRevealState, newText?: string): void {
  const text = newText ?? state.fullText;
  (state as { fullText: string }).fullText = text;
  state.visibleText = '';
  state._cursor = 0;
  state._pause = 0;
  state.complete = text.length === 0;
}
