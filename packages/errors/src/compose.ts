import type { CrashTransport } from './transport.js';

export function composeTransports(...transports: CrashTransport[]): CrashTransport {
  return {
    async report(payload) {
      for (const t of transports) {
        try {
          await t.report(payload);
        } catch (err) {
          console.error('[@flare-engine/errors] composeTransports: child transport threw', err);
        }
      }
    },
    async close() {
      for (const t of transports) {
        try {
          await t.close?.();
        } catch (err) {
          console.error(
            '[@flare-engine/errors] composeTransports: child transport close threw',
            err,
          );
        }
      }
    },
  };
}
