/**
 * Keyboard + (future) gamepad focus navigation.
 *
 * Primitives register themselves with the focus manager by id + tab order.
 * The manager owns which id is currently focused and exposes `next` / `prev`
 * / `activate` actions for a driver (keyboard key handler, gamepad dpad)
 * to call. Components read `focusedId` to render a focus ring.
 */

export interface FocusNode {
  id: string;
  /** Lower tabIndex is focused first. Nodes with equal tabIndex fall back to registration order. */
  tabIndex: number;
  /** Called when this node is activated (Enter / A button). */
  onActivate?: () => void;
  /** Called when this node receives focus. */
  onFocus?: () => void;
  /** Called when this node loses focus. */
  onBlur?: () => void;
  /** If true, the node is skipped during navigation. */
  disabled?: boolean;
}

export interface FocusManager {
  /**
   * Registering an already-registered id updates that node in place: it keeps
   * its position among equal `tabIndex` and focus is unchanged.
   */
  register(node: FocusNode): () => void;
  unregister(id: string): void;
  focus(id: string): void;
  /** Explicit opt-in initial focus: focuses the first node in tab order (or clears if empty). */
  focusFirst(): void;
  blur(): void;
  next(): void;
  prev(): void;
  activate(): void;
  getFocused(): string | null;
  getOrder(): readonly string[];
  subscribe(listener: (focusedId: string | null) => void): () => void;
}

export interface FocusManagerOptions {
  /**
   * When the focused node unregisters, move focus to the first node in tab
   * order (`true`, the default — keyboard users keep a focus target) or clear
   * it to `null` (`false`). Subscribers are notified either way, and a later
   * `next()` / `prev()` starts from the first / last node as it does from `null`.
   */
  refocusOnUnregister?: boolean;
}

interface Entry extends FocusNode {
  seq: number;
}

export function createFocusManager(opts?: FocusManagerOptions): FocusManager {
  const refocusOnUnregister = opts?.refocusOnUnregister ?? true;
  const nodes = new Map<string, Entry>();
  let seqCounter = 0;
  let focusedId: string | null = null;
  const listeners = new Set<(id: string | null) => void>();

  function notify(): void {
    for (const l of listeners) l(focusedId);
  }

  function orderedIds(): string[] {
    const entries = Array.from(nodes.values()).filter((e) => !e.disabled);
    entries.sort((a, b) => {
      if (a.tabIndex !== b.tabIndex) return a.tabIndex - b.tabIndex;
      return a.seq - b.seq;
    });
    return entries.map((e) => e.id);
  }

  function setFocused(next: string | null): void {
    if (next === focusedId) return;
    const prev = focusedId;
    focusedId = next;
    if (prev !== null) nodes.get(prev)?.onBlur?.();
    if (next !== null) nodes.get(next)?.onFocus?.();
    notify();
  }

  function move(delta: 1 | -1): void {
    const order = orderedIds();
    if (order.length === 0) {
      setFocused(null);
      return;
    }
    if (focusedId === null) {
      setFocused(delta === 1 ? (order[0] ?? null) : (order[order.length - 1] ?? null));
      return;
    }
    const idx = order.indexOf(focusedId);
    if (idx === -1) {
      setFocused(order[0] ?? null);
      return;
    }
    const nextIdx = (idx + delta + order.length) % order.length;
    setFocused(order[nextIdx] ?? null);
  }

  function unregister(id: string): void {
    if (!nodes.has(id)) return;
    nodes.delete(id);
    if (focusedId === id) {
      setFocused(refocusOnUnregister ? (orderedIds()[0] ?? null) : null);
    }
  }

  return {
    register(node) {
      // No focus side-effect: on a touch-first engine an auto-focused first
      // registrant paints a permanent focus ring with no input. Focus stays null
      // until a driver (keyboard/gamepad) or an explicit focusFirst() acts.
      const existing = nodes.get(node.id);
      const entry: Entry = { ...node, seq: existing?.seq ?? seqCounter++ };
      nodes.set(node.id, entry);
      return () => unregister(node.id);
    },
    unregister,
    focus(id) {
      const entry = nodes.get(id);
      if (!entry || entry.disabled) return;
      setFocused(id);
    },
    focusFirst() {
      const order = orderedIds();
      setFocused(order[0] ?? null);
    },
    blur() {
      setFocused(null);
    },
    next() {
      move(1);
    },
    prev() {
      move(-1);
    },
    activate() {
      if (focusedId === null) return;
      const entry = nodes.get(focusedId);
      if (!entry || entry.disabled) return;
      entry.onActivate?.();
    },
    getFocused() {
      return focusedId;
    },
    getOrder() {
      return orderedIds();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
