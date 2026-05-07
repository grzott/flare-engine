/**
 * VS-S6 — HUD slot spec (folio IX).
 *
 * Boundary discipline: imports ONLY from './types'.
 *
 * Slot count: 8. Anchors and insets extracted from Hud.tsx + Hud.styles.ts.
 *
 * DEFERRED (★ for S7/S8):
 * - game-over overlay slots (bannerTitle, bannerSub, tapHint, overlayBtnRow)
 * - victory overlay slots
 * - stale-banner slots
 * - pause-overlay slots
 * Schema overlap between HudSlot and OverlaySpec for these cases is flagged in
 * S6 close footnote.
 *
 * NOTES:
 * - zone-banner: anchor 'mid-center' with top: 38% in Hud.styles.ts:64. The
 *   Inset schema can only express pixel dy offsets — percentage top is
 *   unrepresentable. Consumers must read Hud.styles.ts:64 for the literal style.
 * - miniboss-bar: literal top = 56 (Hud.tsx:104 topInset + 56). This is 4 px
 *   above hudCornerY(32) + xxl(20) = 52. The 4 px discrepancy is a deliberate
 *   visual tightening in Hud.tsx; spacing.hudCornerY + spacing.xxl is the
 *   formula in Hud.styles.ts:44 but the rendered literal is 56. See Hud.tsx:104.
 */

import type { HudSlot, HudSpec } from './types';

export const HUD_SPEC: HudSpec = {
  slots: [
    {
      id: 'score',
      anchor: 'top-left',
      inset: { dx: 16, dy: 32 },
      type: 'bodyL',
      fg: '#C9A24A',
      notes: 'Source: Hud.styles.ts topLeft + score; inset from spacing.hudCornerX/Y',
    },
    {
      id: 'combo',
      anchor: 'top-left',
      inset: { dx: 16, dy: 32 },
      type: 'monoHud',
      fg: '#D4213D',
      notes: 'Rendered below score in topLeft stack. Visible only when comboCount > 1.',
    },
    {
      id: 'hp-bar',
      anchor: 'top-left',
      inset: { dx: 16, dy: 32 },
      size: { w: 0, h: 10 },
      fg: '#D4213D',
      bg: '#7A1322',
      notes: 'Rendered in topLeft stack below combo. Width = fill %. h=10 from Hud.styles.ts:205.',
    },
    {
      id: 'weapon-meter',
      anchor: 'top-left',
      inset: { dx: 16, dy: 32 },
      size: { w: 16, h: 6 },
      fg: '#D4213D',
      notes: '5 segments × w:16 h:6 (spacing.weaponMeterHeight). Gap 2 px between segments.',
    },
    {
      id: 'bombs',
      anchor: 'top-left',
      inset: { dx: 16, dy: 32 },
      type: 'bodyS',
      fg: '#FFFFFF',
      notes:
        'Rendered in topLeft stack below weapon-meter. Uses deprecated body style (bodyS at use site).',
    },
    {
      id: 'boss-bar',
      anchor: 'top-center',
      inset: { dx: 0, dy: 32 },
      size: { w: 0, h: 8 },
      fg: '#E84B2A',
      bg: '#C9A24A',
      type: 'label',
      notes:
        'Visible only when bossActive && bossHpMax > 0. Width = fill %. dy = spacing.hudCornerY.',
    },
    {
      id: 'miniboss-bar',
      anchor: 'top-center',
      inset: { dx: 0, dy: 56 },
      size: { w: 0, h: 6 },
      fg: '#D4213D',
      type: 'smallcap',
      notes:
        'dy literal = 56 from Hud.tsx:104 (topInset + 56). Discrepancy: spacing.hudCornerY(32) + spacing.xxl(20) = 52, not 56. 4 px tightened in code. Width 70% of container.',
    },
    {
      id: 'zone-banner',
      anchor: 'mid-center',
      notes:
        'top: 38% in Hud.styles.ts:64 — schema cannot express percentage; see Hud.styles.ts:64. Opacity driven by ZoneBannerState tween.',
    },
  ] satisfies readonly HudSlot[],
};
