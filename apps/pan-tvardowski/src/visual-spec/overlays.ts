/**
 * VS-S6 — Overlay layout spec (folio XI).
 *
 * Boundary discipline: imports ONLY from './types'.
 *
 * All 10 OverlayId values authored. Two are placeholders:
 * - 'boot': renders via BootOverlay.tsx as a full-screen loading view, not a
 *   modal panel. Listed as OverlaySpec for schema exhaustiveness. Flagged below.
 * - 'menu': renders via MenuOverlay.tsx as a full-screen host for sub-views
 *   (menu / save-select / settings / credits). Schema overlap with ScreenId
 *   ('boot', 'menu') is a known design gap deferred to S7/S8.
 * - 'pause': not yet implemented — placeholder sections only (★ S7/S8).
 */

import type { OverlayId, OverlaySpec } from './types';

export const OVERLAY_SPECS: Readonly<Record<OverlayId, OverlaySpec>> = Object.freeze({
  inventory: {
    id: 'inventory',
    panel: 'lg',
    backdropAlpha: 1,
    sections: [
      {
        id: 'inventory-tabs',
        order: 0,
        type: 'tabs',
        focusFirst: true,
        notes: 'Tabs: codex / shards / stats / achievements. Source: InventoryOverlay.tsx',
      },
      {
        id: 'inventory-content',
        order: 1,
        type: 'list',
        notes: 'Scrollable codex entries or achievement list depending on active tab.',
      },
      {
        id: 'inventory-back',
        order: 2,
        type: 'buttons',
        notes: 'Single back button. Navigates to menu scene.',
      },
    ],
    closeButton: 'none',
  },

  'codex-shards': {
    id: 'codex-shards',
    panel: 'lg',
    backdropAlpha: 1,
    sections: [
      {
        id: 'codex-header',
        order: 0,
        type: 'text',
        title: 'codex.title',
        focusFirst: true,
        notes: 'Shard count header + unlocked/total counter. Source: CodexOverlay.tsx',
      },
      {
        id: 'codex-entries',
        order: 1,
        type: 'list',
        notes: 'Scrollable list of codex entries. Locked entries show ??? + hint.',
      },
      {
        id: 'codex-back',
        order: 2,
        type: 'buttons',
        notes: 'Single back button.',
      },
    ],
    closeButton: 'none',
  },

  achievements: {
    id: 'achievements',
    panel: 'lg',
    backdropAlpha: 1,
    sections: [
      {
        id: 'achievements-header',
        order: 0,
        type: 'text',
        title: 'menu.achievements',
        focusFirst: true,
        notes: 'Source: AchievementsOverlay.tsx',
      },
      {
        id: 'achievements-list',
        order: 1,
        type: 'list',
        notes: '12 achievement entries from achievements-list.ts. Locked = grey.',
      },
      {
        id: 'achievements-back',
        order: 2,
        type: 'buttons',
      },
    ],
    closeButton: 'none',
  },

  shop: {
    id: 'shop',
    panel: 'lg',
    backdropAlpha: 1,
    sections: [
      {
        id: 'shop-header',
        order: 0,
        type: 'text',
        title: 'shop.heading',
        focusFirst: true,
        notes: 'Source: ShopOverlay.tsx; rendered via @flare-engine/ui-shop ShopPanel',
      },
      {
        id: 'shop-items',
        order: 1,
        type: 'grid',
        notes: 'IAP product cards: pt.full_game + pt.supporter_pack.',
      },
      {
        id: 'shop-restore',
        order: 2,
        type: 'buttons',
        notes: 'RestorePurchasesButton from @flare-engine/ui-shop.',
      },
      {
        id: 'shop-back',
        order: 3,
        type: 'buttons',
      },
    ],
    closeButton: 'none',
  },

  pause: {
    id: 'pause',
    panel: 'md',
    backdropAlpha: 0.55,
    sections: [
      {
        id: 'pause-placeholder',
        order: 0,
        type: 'buttons',
        notes: 'unimplemented — S6 placeholder (★ S7/S8)',
      },
    ],
    closeButton: 'top-right',
  },

  dialogue: {
    id: 'dialogue',
    panel: 'md',
    backdropAlpha: 0,
    sections: [
      {
        id: 'dialogue-portrait',
        order: 0,
        type: 'image',
        notes: '44×44 speaker portrait slot. Source: DialogueOverlay.tsx:portraitSlot',
      },
      {
        id: 'dialogue-speaker',
        order: 1,
        type: 'text',
        notes: 'Speaker name in label style. Source: DialoguePanel from @flare-engine/ui',
      },
      {
        id: 'dialogue-body',
        order: 2,
        type: 'text',
        focusFirst: true,
        notes: 'Line text in bodyM style. Tap anywhere to advance.',
      },
    ],
    closeButton: 'none',
  },

  paywall: {
    id: 'paywall',
    panel: 'md',
    backdropAlpha: 0.88,
    sections: [
      {
        id: 'paywall-heading',
        order: 0,
        type: 'text',
        title: 'paywall.heading',
        focusFirst: true,
        notes: 'Source: PaywallOverlay.tsx via @flare-engine/ui-shop PaywallModal',
      },
      {
        id: 'paywall-body',
        order: 1,
        type: 'text',
        notes: 'paywall.body locale key.',
      },
      {
        id: 'paywall-cta',
        order: 2,
        type: 'buttons',
        notes: 'Primary purchase CTA + dismiss link.',
      },
    ],
    closeButton: 'top-right',
  },

  privacy: {
    id: 'privacy',
    panel: 'md',
    backdropAlpha: 0.88,
    sections: [
      {
        id: 'privacy-title',
        order: 0,
        type: 'text',
        title: 'settings.privacy.title',
        focusFirst: true,
        notes: 'Source: PrivacyOverlay.tsx; rendered as RN Modal (fade animationType).',
      },
      {
        id: 'privacy-analytics',
        order: 1,
        type: 'buttons',
        notes: 'Analytics opt-in toggle row.',
      },
      {
        id: 'privacy-crash',
        order: 2,
        type: 'buttons',
        notes: 'Crash reporting opt-in toggle row.',
      },
      {
        id: 'privacy-data-note',
        order: 3,
        type: 'text',
        notes: 'settings.privacy.data_note disclosure copy.',
      },
      {
        id: 'privacy-close',
        order: 4,
        type: 'buttons',
      },
    ],
    closeButton: 'none',
  },

  boot: {
    id: 'boot',
    panel: 'lg',
    backdropAlpha: 1,
    sections: [
      {
        id: 'boot-sigil',
        order: 0,
        type: 'image',
        notes: 'Animated sigil (120×120 crimson circle). Source: BootOverlay.tsx:styles.sigil',
      },
      {
        id: 'boot-label',
        order: 1,
        type: 'text',
        notes: 'boot.loading.{save,audio} locale key in lede/italic style.',
      },
      {
        id: 'boot-progress',
        order: 2,
        type: 'progress',
        notes: 'ProgressBar from @flare-engine/ui. value 0→0.5 (save) → 1 (audio).',
      },
      {
        id: 'boot-version',
        order: 3,
        type: 'text',
        notes: 'boot.version locale key. Absolute bottom-right position.',
      },
    ],
    closeButton: 'none',
    notes:
      'PLACEHOLDER — boot is a full-screen loading view (BootOverlay.tsx), not a modal panel. Listed for OverlayId exhaustiveness. Schema overlap with ScreenId (boot) deferred to S7/S8.',
  } as OverlaySpec & { notes?: string },

  menu: {
    id: 'menu',
    panel: 'lg',
    backdropAlpha: 1,
    sections: [
      {
        id: 'menu-sigil',
        order: 0,
        type: 'image',
        notes: 'menuSigil view (decorative). Source: MenuOverlay.tsx MenuView',
      },
      {
        id: 'menu-title',
        order: 1,
        type: 'text',
        title: 'menu.title',
        notes: 'menu.subtitle also rendered below title.',
      },
      {
        id: 'menu-buttons',
        order: 2,
        type: 'buttons',
        focusFirst: true,
        notes: 'Play / Settings / Credits / Shop buttons.',
      },
      {
        id: 'menu-version',
        order: 3,
        type: 'text',
        notes: 'Version + locale string at bottom.',
      },
    ],
    closeButton: 'none',
    notes:
      'PLACEHOLDER — menu is a full-screen sub-view host (MenuOverlay.tsx), not a modal panel. Schema overlap with ScreenId (menu) deferred to S7/S8.',
  } as OverlaySpec & { notes?: string },
} satisfies Record<OverlayId, OverlaySpec>);
