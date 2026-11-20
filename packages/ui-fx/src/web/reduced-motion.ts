import type { A11yManager } from '@flare-engine/a11y';
import type { ReducedMotionSource } from '../runtime/contracts';
import { createReducedMotionBox } from '../runtime/reduced-motion';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The `prefers-reduced-motion` media query, kept live. Nothing touches `matchMedia` until the
 * first `get` or `subscribe`, so a source can be made during server rendering; there it reports
 * `false`. Every value the query reports is also pushed into `manager`, when one is given.
 */
export function webReducedMotionSource(manager?: A11yManager): ReducedMotionSource {
  const box = createReducedMotionBox(manager);
  let listening = false;
  const listen = (): void => {
    if (listening || typeof globalThis.matchMedia !== 'function') return;
    listening = true;
    const media = globalThis.matchMedia(QUERY);
    box.set(media.matches);
    media.addEventListener('change', (e) => box.set(e.matches));
  };
  return {
    get() {
      listen();
      return box.value;
    },
    subscribe(cb) {
      listen();
      return box.subscribe(cb);
    },
  };
}

export interface ExitA11yProps {
  readonly 'aria-hidden'?: true;
}

const HIDDEN: ExitA11yProps = { 'aria-hidden': true };
const SHOWN: ExitA11yProps = {};

/** Props that take an exiting element out of the accessibility tree. */
export function exitA11yProps(exiting: boolean): ExitA11yProps {
  return exiting ? HIDDEN : SHOWN;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Move keyboard focus off `el` when it, or something inside it, is focused: to the next sibling
 * that can take focus, else to `document.body`. Call it before `el` is hidden.
 */
export function moveFocusOff(el: Element): void {
  const active = el.ownerDocument.activeElement;
  if (!(active instanceof HTMLElement) || !el.contains(active)) return;
  for (let next = el.nextElementSibling; next !== null; next = next.nextElementSibling) {
    // A sibling that is exiting too is about to be hidden itself.
    if (next.getAttribute('aria-hidden') === 'true') continue;
    const to = next.matches(FOCUSABLE) ? next : next.querySelector(FOCUSABLE);
    if (to instanceof HTMLElement) {
      to.focus();
      return;
    }
  }
  active.blur();
}
