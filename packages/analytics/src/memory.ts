import type { AnalyticsEvent, AnalyticsProps, AnalyticsProvider } from './provider.js';

/** Options for `createMemoryAnalytics`. */
export interface MemoryAnalyticsOptions {
  /** Ring-buffer capacity; clamped to >= 1. Defaults to 256. */
  capacity?: number;
  /** Timestamp source in unix ms. Defaults to `() => Date.now()`. */
  now?: () => number;
}

/** In-memory `AnalyticsProvider` that records events into a bounded ring buffer. */
export interface MemoryAnalytics extends AnalyticsProvider {
  /** Recorded events, oldest -> newest, as a defensive copy. */
  getEvents(): readonly AnalyticsEvent[];
  /** Drop all recorded events. */
  clear(): void;
}

/** Options for `createConsoleAnalytics`. */
export interface ConsoleAnalyticsOptions {
  /** Sink for captured events. Defaults to `console.log`. */
  log?: (...args: unknown[]) => void;
  /** Timestamp source in unix ms. Defaults to `() => Date.now()`. */
  now?: () => number;
}

function trackEvent(name: string, timestamp: number, props?: AnalyticsProps): AnalyticsEvent {
  return props === undefined
    ? { type: 'track', name, timestamp }
    : { type: 'track', name, props, timestamp };
}

function identifyEvent(userId: string, timestamp: number, traits?: AnalyticsProps): AnalyticsEvent {
  return traits === undefined
    ? { type: 'identify', userId, timestamp }
    : { type: 'identify', userId, traits, timestamp };
}

function screenEvent(name: string, timestamp: number, props?: AnalyticsProps): AnalyticsEvent {
  return props === undefined
    ? { type: 'screen', name, timestamp }
    : { type: 'screen', name, props, timestamp };
}

/**
 * Create an in-memory analytics provider backed by a bounded ring buffer.
 * Useful for tests and dev overlays. When the buffer is full the oldest
 * event is dropped. `flush` is a no-op.
 */
export function createMemoryAnalytics(opts?: MemoryAnalyticsOptions): MemoryAnalytics {
  const capacity = Math.max(1, opts?.capacity ?? 256);
  const now = opts?.now ?? ((): number => Date.now());
  let events: AnalyticsEvent[] = [];

  function push(event: AnalyticsEvent): void {
    events.push(event);
    if (events.length > capacity) events.shift();
  }

  return {
    async track(event: string, props?: AnalyticsProps): Promise<void> {
      push(trackEvent(event, now(), props));
    },
    async identify(userId: string, traits?: AnalyticsProps): Promise<void> {
      push(identifyEvent(userId, now(), traits));
    },
    async screen(name: string, props?: AnalyticsProps): Promise<void> {
      push(screenEvent(name, now(), props));
    },
    async flush(): Promise<void> {
      // no-op
    },
    getEvents(): readonly AnalyticsEvent[] {
      return events.slice();
    },
    clear(): void {
      events = [];
    },
  };
}

/**
 * Create an analytics provider that logs each captured event to an injected
 * sink (default `console.log`) as `log('[analytics]', event)`. `flush` is a
 * no-op.
 */
export function createConsoleAnalytics(opts?: ConsoleAnalyticsOptions): AnalyticsProvider {
  const log = opts?.log ?? console.log;
  const now = opts?.now ?? ((): number => Date.now());

  return {
    async track(event: string, props?: AnalyticsProps): Promise<void> {
      log('[analytics]', trackEvent(event, now(), props));
    },
    async identify(userId: string, traits?: AnalyticsProps): Promise<void> {
      log('[analytics]', identifyEvent(userId, now(), traits));
    },
    async screen(name: string, props?: AnalyticsProps): Promise<void> {
      log('[analytics]', screenEvent(name, now(), props));
    },
    async flush(): Promise<void> {
      // no-op
    },
  };
}
