declare module '@sentry/react-native' {
  export function captureException(
    err: unknown,
    hint?: { extra?: Record<string, unknown> },
  ): void;
  export function init(opts: {
    dsn: string;
    environment?: string;
    release?: string;
    sampleRate?: number;
  }): void;
}
