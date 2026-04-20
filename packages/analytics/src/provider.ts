/** Free-form event properties — adapters serialize as needed. */
export type AnalyticsProps = Record<string, unknown>;

/** A single tracked event. */
export interface AnalyticsEvent {
  name: string;
  props?: AnalyticsProps;
  /** Unix ms when the event was produced. */
  timestamp: number;
}

/**
 * Analytics provider interface. Consumers supply a concrete adapter (PostHog,
 * Amplitude, Segment, Firebase Analytics) at the app boundary. Batching,
 * sampling, and offline queueing are adapter concerns — the interface is
 * deliberately thin so any SDK can back it.
 */
export interface AnalyticsProvider {
  track(event: string, props?: AnalyticsProps): Promise<void>;
  identify(userId: string, traits?: AnalyticsProps): Promise<void>;
  screen(name: string, props?: AnalyticsProps): Promise<void>;
  flush(): Promise<void>;
}

/** Default no-op provider. Resolves immediately; retains nothing. */
export const NoopAnalyticsProvider: AnalyticsProvider = {
  async track(): Promise<void> {
    // no-op
  },
  async identify(): Promise<void> {
    // no-op
  },
  async screen(): Promise<void> {
    // no-op
  },
  async flush(): Promise<void> {
    // no-op
  },
};
