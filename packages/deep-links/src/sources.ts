import type { DeepLinkSource } from './manager.js';

/**
 * In-memory source useful for tests and for host apps that want to push URLs
 * manually (e.g., from a notification handler).
 */
export function createMemorySource(initialUrl: string | null = null): DeepLinkSource & {
  push(url: string): void;
} {
  let initial = initialUrl;
  const listeners = new Set<(url: string) => void>();
  return {
    getInitialUrl() {
      const v = initial;
      initial = null;
      return v;
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    push(url: string) {
      for (const l of listeners) l(url);
    },
  };
}

/**
 * Minimal shape of the globals a web browser exposes. Defined locally so
 * we don't pull in DOM lib types across the monorepo.
 */
interface WebWindowLike {
  location: { href: string };
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/**
 * Web `popstate` + `location.href` adapter. Call `notify(url)` after any
 * programmatic `history.pushState` if you want the manager to react.
 */
export function createWebSource(win: WebWindowLike): DeepLinkSource & {
  notify(url: string): void;
} {
  const listeners = new Set<(url: string) => void>();
  const onPop = (): void => {
    const href = win.location.href;
    // Snapshot: a handler that (un)subscribes during dispatch must not change
    // who receives this dispatch.
    for (const l of [...listeners]) l(href);
  };
  return {
    getInitialUrl() {
      return win.location.href;
    },
    subscribe(handler) {
      listeners.add(handler);
      // `onPop` is one shared closure, so the DOM dedupes identical
      // (type, listener, capture) registrations — ref-count the DOM listener
      // (add on first subscriber, remove on last) so one unsubscribe can't
      // kill navigation for the remaining subscribers.
      if (listeners.size === 1) win.addEventListener('popstate', onPop);
      return () => {
        listeners.delete(handler);
        if (listeners.size === 0) win.removeEventListener('popstate', onPop);
      };
    },
    notify(url: string) {
      for (const l of [...listeners]) l(url);
    },
  };
}

/**
 * Minimal shape of the React Native `Linking` module. Passing this lets the
 * host wire deep links on iOS/Android without this package depending on RN.
 */
export interface LinkingLike {
  getInitialURL(): Promise<string | null>;
  addEventListener(type: 'url', handler: (event: { url: string }) => void): { remove: () => void };
}

export function createNativeSource(linking: LinkingLike): DeepLinkSource {
  return {
    getInitialUrl() {
      return linking.getInitialURL();
    },
    subscribe(handler) {
      const sub = linking.addEventListener('url', (e) => handler(e.url));
      return () => sub.remove();
    },
  };
}
