/**
 * VS-S6 — Screen spec (folio X): boot, menu, save-select, settings, credits.
 *
 * Boundary discipline: imports ONLY from './types'.
 *
 * Background sky colors: all frontmatter screens use bodyBg = rgba(14,26,18,0.92)
 * drawn opaque over void (#050A07). The closest solid equivalent per palette is
 * inkBlack (#0E1A12). Sky token reflects the dominant solid base; overlayBase
 * handles the composited surface at runtime.
 */

import type { ScreenId, ScreenSpec } from './types';

export const SCREEN_SPECS: Readonly<Record<ScreenId, ScreenSpec>> = Object.freeze({
  boot: {
    id: 'boot',
    background: {
      sky: '#050A07',
    },
    sections: [
      {
        id: 'boot-sigil',
        order: 0,
        type: 'image',
        notes:
          '120×120 crimson circle (styles.sigil). Opacity animated by sigilOpacity(reducedMotion).',
      },
      {
        id: 'boot-label',
        order: 1,
        type: 'text',
        notes:
          'boot.loading.{save,audio} — lede italic style, gold color. Source: BootOverlay.styles.ts:label',
      },
      {
        id: 'boot-progress',
        order: 2,
        type: 'progress',
        notes: 'ProgressBar 70% width; value 0 → 0.5 (save loaded) → 1 (audio ready).',
      },
      {
        id: 'boot-version',
        order: 3,
        type: 'text',
        notes:
          'boot.version — smallcap style; absolute bottom center. Conditional on appVersion prop.',
      },
    ],
    navigation: 'none',
  },

  menu: {
    id: 'menu',
    background: {
      sky: '#0E1A12',
    },
    sections: [
      {
        id: 'menu-sigil',
        order: 0,
        type: 'image',
        notes: 'menuSigil decorative view. Source: MenuOverlay.tsx MenuView',
      },
      {
        id: 'menu-title',
        order: 1,
        type: 'text',
        title: 'menu.title',
        notes: 'displayL in gold + menu.subtitle in parchment beneath.',
      },
      {
        id: 'menu-buttons',
        order: 2,
        type: 'buttons',
        notes: 'Play (primary) / Settings (secondary) / Credits (ghost) / Shop (ghost).',
      },
      {
        id: 'menu-version',
        order: 3,
        type: 'text',
        notes: 'v{appVersion} · {locale} — smallcap style.',
      },
    ],
    navigation: 'choices',
  },

  'save-select': {
    id: 'save-select',
    background: {
      sky: '#0E1A12',
    },
    sections: [
      {
        id: 'save-select-header',
        order: 0,
        type: 'text',
        title: 'menu.save_select.title',
        notes: 'Label xl accent. Source: MenuOverlay.tsx SaveSelectView',
      },
      {
        id: 'save-select-slots',
        order: 1,
        type: 'list',
        notes:
          '3 save slots (I/II/III). Each shows zone + best score + runs + last played, or empty state.',
      },
      {
        id: 'save-select-zone-picker',
        order: 2,
        type: 'list',
        notes:
          'Conditional zone-select submenu when canChooseZone. Lists zones up to slot.zoneReached.',
      },
      {
        id: 'save-select-back',
        order: 3,
        type: 'buttons',
        notes: 'Ghost back button to menu.',
      },
    ],
    navigation: 'back',
  },

  settings: {
    id: 'settings',
    background: {
      sky: '#0E1A12',
    },
    sections: [
      {
        id: 'settings-header',
        order: 0,
        type: 'text',
        title: 'menu.settings.title',
        notes: 'Label xl accent. Source: MenuOverlay.tsx SettingsView',
      },
      {
        id: 'settings-audio',
        order: 1,
        type: 'list',
        notes: 'Group: settings.group.audio — master / music / sfx volume ±0.1 rows.',
      },
      {
        id: 'settings-accessibility',
        order: 2,
        type: 'list',
        notes:
          'Group: settings.group.accessibility — reducedMotion toggle + colorBlindMode toggle.',
      },
      {
        id: 'settings-gameplay',
        order: 3,
        type: 'list',
        notes:
          'Group: settings.group.gameplay — joystick side (left/right) + fire side (left/right) + language (EN/PL).',
      },
      {
        id: 'settings-telemetry',
        order: 4,
        type: 'list',
        notes: 'Group: settings.group.telemetry — analyticsOptIn + crashOptIn toggles.',
      },
      {
        id: 'settings-privacy',
        order: 5,
        type: 'buttons',
        notes: 'Secondary button opening PrivacyOverlay modal.',
      },
      {
        id: 'settings-restore',
        order: 6,
        type: 'buttons',
        notes: 'RestorePurchasesButton (conditional on entitlementStore presence).',
      },
      {
        id: 'settings-back',
        order: 7,
        type: 'buttons',
        notes: 'Ghost back button; triggers persistSettings() + save.persist() before navigating.',
      },
    ],
    navigation: 'back',
  },

  credits: {
    id: 'credits',
    background: {
      sky: '#0E1A12',
    },
    sections: [
      {
        id: 'credits-title',
        order: 0,
        type: 'text',
        title: 'menu.credits.title',
        notes: 'Label xl accent. Source: MenuOverlay.tsx CreditsView',
      },
      {
        id: 'credits-legend',
        order: 1,
        type: 'text',
        notes: 'credits.legend.title + 5 lines. One of 6 sections from CREDITS_SECTIONS.',
      },
      {
        id: 'credits-bestiary',
        order: 2,
        type: 'text',
        notes: 'credits.bestiary.title + 6 lines.',
      },
      {
        id: 'credits-artifacts',
        order: 3,
        type: 'text',
        notes: 'credits.artifacts.title + 4 lines.',
      },
      {
        id: 'credits-engine',
        order: 4,
        type: 'text',
        notes: 'credits.engine.title + 3 lines.',
      },
      {
        id: 'credits-license',
        order: 5,
        type: 'text',
        notes: 'credits.license.title + 2 lines.',
      },
      {
        id: 'credits-thanks',
        order: 6,
        type: 'text',
        notes: 'credits.thanks.title + 1 line.',
      },
      {
        id: 'credits-skip',
        order: 7,
        type: 'text',
        notes: 'menu.credits.skip hint. Tap whole view to goMenu().',
      },
    ],
    navigation: 'back',
  },
} satisfies Record<ScreenId, ScreenSpec>);
