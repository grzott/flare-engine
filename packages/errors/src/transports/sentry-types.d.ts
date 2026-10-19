declare module '@sentry/react-native' {
  export interface Integration {
    name: string;
  }
  export function captureException(
    err: unknown,
    hint?: { extra?: Record<string, unknown> },
  ): void;
  export function init(opts: {
    dsn: string;
    environment?: string;
    release?: string;
    sampleRate?: number;
    integrations?: (defaults: Integration[]) => Integration[];
    enableAutoSessionTracking?: boolean;
    enableNativeCrashHandling?: boolean;
    enableAppHangTracking?: boolean;
    enableWatchdogTerminationTracking?: boolean;
    sendClientReports?: boolean;
  }): void;
}
