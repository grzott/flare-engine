import { describe, expect, it } from 'bun:test';
import { rawStyles as achievementsStyles } from '../src/hud/AchievementsOverlay.styles';
import { rawStyles as codexStyles } from '../src/hud/CodexOverlay.styles';
import { rawStyles as dialogueStyles } from '../src/hud/DialogueOverlay.styles';
import { rawStyles as inventoryStyles } from '../src/hud/InventoryOverlay.styles';
import { rawStyles as privacyStyles } from '../src/hud/PrivacyOverlay.styles';
import { rawStyles as shopStyles } from '../src/hud/ShopOverlay.styles';
import { THEME_SPEC, UI_COLORS } from '../src/visual-spec/theme';

describe('overlay root tokens — inlined from overlayBase', () => {
  it('InventoryOverlay root.backgroundColor === UI_COLORS.bodyBg', () => {
    expect(inventoryStyles.root.backgroundColor).toBe(UI_COLORS.bodyBg);
  });

  it('AchievementsOverlay panelContainer.padding === THEME_SPEC.spacing.xl', () => {
    expect(achievementsStyles.panelContainer.padding).toBe(THEME_SPEC.spacing.xl);
  });

  it('AchievementsOverlay panel.maxWidth === THEME_SPEC.spacing.panelLgWidth', () => {
    expect(achievementsStyles.panel.maxWidth).toBe(THEME_SPEC.spacing.panelLgWidth);
  });

  it('PrivacyOverlay panel.maxWidth === THEME_SPEC.spacing.panelMdWidth', () => {
    expect(privacyStyles.panel.maxWidth).toBe(THEME_SPEC.spacing.panelMdWidth);
  });
});

describe('overlay rawStyles — theme token assertions', () => {
  it('InventoryOverlay tabActive borderColor === UI_COLORS.crimson', () => {
    expect(inventoryStyles.tabActive.borderBottomColor).toBe(UI_COLORS.crimson);
  });

  it('CodexOverlay entryRow border === UI_COLORS.divider', () => {
    expect(codexStyles.entryRow.borderBottomColor).toBe(UI_COLORS.divider);
  });

  it('InventoryOverlay codexRow border === UI_COLORS.divider', () => {
    expect(inventoryStyles.codexRow.borderBottomColor).toBe(UI_COLORS.divider);
  });

  it('AchievementsOverlay entryRow border === UI_COLORS.divider', () => {
    expect(achievementsStyles.entryRow.borderBottomColor).toBe(UI_COLORS.divider);
  });

  it('DialogueOverlay root.backgroundColor === UI_COLORS.overlay', () => {
    expect(dialogueStyles.root.backgroundColor).toBe(UI_COLORS.overlay);
  });

  it('DialogueOverlay panel borderColor === UI_COLORS.border', () => {
    expect(dialogueStyles.panel.borderColor).toBe(UI_COLORS.border);
  });

  it('PrivacyOverlay backdrop === UI_COLORS.backdropModal', () => {
    expect(privacyStyles.backdrop.backgroundColor).toBe(UI_COLORS.backdropModal);
  });

  it('ShopOverlay root.backgroundColor === UI_COLORS.bodyBg', () => {
    expect(shopStyles.root.backgroundColor).toBe(UI_COLORS.bodyBg);
  });
});
