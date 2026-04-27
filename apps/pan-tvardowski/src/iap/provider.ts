import { type IAPProvider, NoopIAPProvider } from '@flare-engine/iap';

/**
 * Env-var-gated fallback: CI/unit tests run with NoopIAPProvider (no env
 * vars set); release builds pick up the real RevenueCat SDK via the keys
 * injected by EAS Build / the .env file.
 *
 * The import of @flare-engine/iap-revenuecat is lazy so that environments
 * without the package built (CI, unit tests) do not fail at module-load time.
 */
export function createGameIapProvider(): IAPProvider {
  const apiKeyIos = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
  const apiKeyAndroid = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';
  if (!apiKeyIos && !apiKeyAndroid) return NoopIAPProvider;

  // Lazily construct the provider so the dynamic import only happens on
  // the first method call, not at startup. Each call re-creates the provider
  // but the RevenueCat SDK is idempotent (configure is guarded by `configured`).
  let resolved: IAPProvider | null = null;

  const lazyLoad = async (): Promise<IAPProvider> => {
    if (resolved) return resolved;
    const { createRevenueCatProvider } = await import('@flare-engine/iap-revenuecat');
    resolved = createRevenueCatProvider({ apiKeyIos, apiKeyAndroid });
    return resolved;
  };

  return {
    async getProducts(ids) {
      return (await lazyLoad()).getProducts(ids);
    },
    async purchase(id) {
      return (await lazyLoad()).purchase(id);
    },
    async restore() {
      return (await lazyLoad()).restore();
    },
    onTransaction(cb) {
      let unsub: (() => void) | null = null;
      let stopped = false;
      lazyLoad()
        .then((p) => {
          if (!stopped) unsub = p.onTransaction(cb);
        })
        .catch(() => {});
      return () => {
        stopped = true;
        unsub?.();
      };
    },
  };
}
