import {
  composeTransports,
  createConsoleTransport,
  createSentryTransport,
} from '@flare-engine/errors';
import type { CrashTransport } from '@flare-engine/errors';
import type { EntitlementStore } from '@flare-engine/iap';
import type { LocalizationManager } from '@flare-engine/localization';
import type { ShareManager } from '@flare-engine/share';
import { useMemo } from 'react';
import { Share } from 'react-native';
import type { AudioHandles } from './audio/init';
import { createDialogueController } from './dialogue';
import { ENTITLEMENT_FULL_GAME } from './iap/catalog';
import { createPTEntitlementStore } from './iap/store';
import { createLocalization } from './localization/index';
import { createSaveStore } from './save/store';
import type { PlayRenderHooks } from './scenes/play';
import { createShareManager } from './share/manager';

export interface AudioRef {
  current: AudioHandles | null;
}

export interface AppProviders {
  localization: LocalizationManager;
  audioRef: AudioRef;
  dialogueController: ReturnType<typeof createDialogueController>;
  saveStore: ReturnType<typeof createSaveStore>;
  entitlementStore: EntitlementStore;
  renderHooks: PlayRenderHooks;
  shareManager: ShareManager;
  crashTransport: CrashTransport;
}

export function useAppProviders(): AppProviders {
  const localization = useMemo(() => createLocalization(), []);
  const audioRef = useMemo<AudioRef>(() => ({ current: null }), []);
  const dialogueController = useMemo(() => createDialogueController(), []);
  const saveStore = useMemo(() => createSaveStore(), []);
  const entitlementStore = useMemo(() => {
    const store = createPTEntitlementStore();
    if (__DEV__) store.grant(ENTITLEMENT_FULL_GAME);
    return store;
  }, []);
  const renderHooks = useMemo<PlayRenderHooks>(() => ({ background: null, postfx: null }), []);
  const shareManager = useMemo<ShareManager>(() => createShareManager(Share), []);
  const crashTransport = useMemo<CrashTransport>(() => {
    const sentryBase = createSentryTransport({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? undefined,
    });
    const sentryGated: CrashTransport = {
      report(payload) {
        if (!saveStore.privacy().crashOptIn) return;
        return sentryBase.report(payload);
      },
    };
    return composeTransports(createConsoleTransport(), sentryGated);
  }, [saveStore]);

  return {
    localization,
    audioRef,
    dialogueController,
    saveStore,
    entitlementStore,
    renderHooks,
    shareManager,
    crashTransport,
  };
}
