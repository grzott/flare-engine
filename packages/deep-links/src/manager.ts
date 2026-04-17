import { Signal } from '@flare-engine/events';
import type { DeepLinkRouter } from './router.js';
import type { DeepLinkMatch } from './types.js';

/**
 * Platform adapter that surfaces incoming URLs to the router. Web ships a
 * history-based adapter; RN consumers pass one that wires `Linking`.
 */
export interface DeepLinkSource {
  /** Current URL if the platform exposes one (e.g., `window.location.href`). */
  getInitialUrl(): Promise<string | null> | string | null;
  /** Register a handler for future URL updates; returns an unsubscribe. */
  subscribe(handler: (url: string) => void): () => void;
}

export interface DeepLinkManagerOptions {
  router: DeepLinkRouter;
  source: DeepLinkSource;
}

export class DeepLinkManager {
  readonly onMatch = new Signal<DeepLinkMatch>();
  readonly onUnmatched = new Signal<string>();
  private readonly router: DeepLinkRouter;
  private readonly source: DeepLinkSource;
  private unsubscribe: (() => void) | null = null;
  private _current: DeepLinkMatch | null = null;

  constructor(options: DeepLinkManagerOptions) {
    this.router = options.router;
    this.source = options.source;
  }

  get current(): DeepLinkMatch | null {
    return this._current;
  }

  async start(): Promise<void> {
    if (this.unsubscribe) return;
    this.unsubscribe = this.source.subscribe((url) => this.handle(url));
    const initial = await Promise.resolve(this.source.getInitialUrl());
    if (initial) this.handle(initial);
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  handle(url: string): DeepLinkMatch | null {
    const match = this.router.match(url);
    if (!match) {
      this.onUnmatched.emit(url);
      return null;
    }
    this._current = match;
    this.onMatch.emit(match);
    return match;
  }
}
