import type { ReactNode } from 'react';
import type { PresetRef } from '../core/registry';

/**
 * Where a new toast goes among the ones already in the store (react-native-notifier's modes).
 *
 * - `'standby'`: at the end of the queue. The default.
 * - `'next'`: at the front of the queue, right behind the current toast.
 * - `'immediate'`: in place of the current toast, which is dismissed. The queue is kept.
 * - `'reset'`: in place of everything: the current toast and the queue are dismissed.
 */
export type ToastQueueMode = 'reset' | 'standby' | 'next' | 'immediate';

export interface ToastOptions {
  /** Showing an id the store already holds updates that toast where it is; `queue` is ignored. */
  id?: string;
  /** Seconds until the toaster dismisses the toast. Left out, the toaster's own duration applies. */
  duration?: number;
  enter?: PresetRef;
  exit?: PresetRef;
  queue?: ToastQueueMode;
}

/** One toast in a store. A record is never mutated: an update replaces it. */
export interface ToastRecord {
  id: string;
  message: ReactNode;
  duration: number | undefined;
  enter: PresetRef | undefined;
  exit: PresetRef | undefined;
}

/**
 * An ordered list of toasts for a toaster to render. The first record is the current toast and
 * the rest are the queue behind it. The store holds no timers and plays nothing: the toaster
 * decides how many records are visible, times them out and runs their exits.
 */
export interface ToastStore {
  /** Adds a toast, or updates the one that already has `o.id`, and returns its id. */
  show(message: ReactNode, o?: ToastOptions): string;
  /** Removes the toast with this id, whether current or queued; with no id, removes them all. */
  dismiss(id?: string): void;
  /** Calls `cb` after every change. Returns the function that stops it. */
  subscribe(cb: () => void): () => void;
  /** The records in order. The same array is returned until the next change. */
  snapshot(): readonly ToastRecord[];
}

const EMPTY: readonly ToastRecord[] = [];

export function createToastStore(): ToastStore {
  let records = EMPTY;
  let serial = 0;
  const listeners = new Set<() => void>();

  const commit = (next: readonly ToastRecord[]): void => {
    records = next;
    for (const listener of listeners) listener();
  };

  const has = (id: string): boolean => records.some((record) => record.id === id);

  return {
    show(message, o) {
      let id = o?.id;
      if (id === undefined) {
        do id = `toast-${++serial}`;
        while (has(id));
      }
      const record: ToastRecord = {
        id,
        message,
        duration: o?.duration,
        enter: o?.enter,
        exit: o?.exit,
      };
      const at = records.findIndex((r) => r.id === id);
      if (at !== -1) {
        commit(records.map((r, i) => (i === at ? record : r)));
        return id;
      }
      switch (o?.queue ?? 'standby') {
        case 'reset':
          commit([record]);
          break;
        case 'immediate':
          commit([record, ...records.slice(1)]);
          break;
        case 'next':
          commit([...records.slice(0, 1), record, ...records.slice(1)]);
          break;
        case 'standby':
          commit([...records, record]);
          break;
      }
      return id;
    },
    dismiss(id) {
      if (records.length === 0) return;
      if (id === undefined) {
        commit(EMPTY);
        return;
      }
      if (has(id)) commit(records.filter((record) => record.id !== id));
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    snapshot: () => records,
  };
}

let defaultStore: ToastStore | null = null;

/**
 * The store behind `toast()`, made on first use so that importing this module creates no state
 * (C19). A toaster that is given no store renders this one.
 */
export function getDefaultToastStore(): ToastStore {
  defaultStore ??= createToastStore();
  return defaultStore;
}

/** `toast(message, o?)` shows a toast in the default store; `toast.dismiss(id?)` removes from it. */
export interface ToastFunction {
  (message: ReactNode, o?: ToastOptions): string;
  dismiss(id?: string): void;
}

export const toast: ToastFunction = /* @__PURE__ */ Object.assign(
  (message: ReactNode, o?: ToastOptions): string => getDefaultToastStore().show(message, o),
  {
    dismiss(id?: string): void {
      getDefaultToastStore().dismiss(id);
    },
  },
);
