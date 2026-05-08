import { describe, expect, it } from 'bun:test';
import { rawStyles as achievementsStyles } from '../src/hud/AchievementsOverlay.styles';
import { rawStyles as codexStyles } from '../src/hud/CodexOverlay.styles';
import { rawStyles as dialogueStyles } from '../src/hud/DialogueOverlay.styles';
import { rawStyles as inventoryStyles } from '../src/hud/InventoryOverlay.styles';
import { rawStyles as privacyStyles } from '../src/hud/PrivacyOverlay.styles';
import { rawStyles as shopStyles } from '../src/hud/ShopOverlay.styles';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

describe('overlay root tokens — inlined from overlayBase', () => {
  it('InventoryOverlay root.backgroundColor === colors.ui.bodyBg', () => {
    expect(inventoryStyles.root.backgroundColor).toBe(colors.ui.bodyBg);
  });

  it('AchievementsOverlay panelContainer.padding === spacing.xl', () => {
    expect(achievementsStyles.panelContainer.padding).toBe(spacing.xl);
  });

  it('AchievementsOverlay panel.maxWidth === spacing.panelLgWidth', () => {
    expect(achievementsStyles.panel.maxWidth).toBe(spacing.panelLgWidth);
  });

  it('PrivacyOverlay panel.maxWidth === spacing.panelMdWidth', () => {
    expect(privacyStyles.panel.maxWidth).toBe(spacing.panelMdWidth);
  });
});

describe('overlay rawStyles — theme token assertions', () => {
  it('InventoryOverlay tabActive borderColor === colors.ui.crimson', () => {
    expect(inventoryStyles.tabActive.borderBottomColor).toBe(colors.ui.crimson);
  });

  it('CodexOverlay entryRow border === colors.ui.divider', () => {
    expect(codexStyles.entryRow.borderBottomColor).toBe(colors.ui.divider);
  });

  it('InventoryOverlay codexRow border === colors.ui.divider', () => {
    expect(inventoryStyles.codexRow.borderBottomColor).toBe(colors.ui.divider);
  });

  it('AchievementsOverlay entryRow border === colors.ui.divider', () => {
    expect(achievementsStyles.entryRow.borderBottomColor).toBe(colors.ui.divider);
  });

  it('DialogueOverlay root.backgroundColor === colors.ui.overlay', () => {
    expect(dialogueStyles.root.backgroundColor).toBe(colors.ui.overlay);
  });

  it('DialogueOverlay panel borderColor === colors.ui.border', () => {
    expect(dialogueStyles.panel.borderColor).toBe(colors.ui.border);
  });

  it('PrivacyOverlay backdrop === colors.ui.backdropModal', () => {
    expect(privacyStyles.backdrop.backgroundColor).toBe(colors.ui.backdropModal);
  });

  it('ShopOverlay root.backgroundColor === colors.ui.bodyBg', () => {
    expect(shopStyles.root.backgroundColor).toBe(colors.ui.bodyBg);
  });
});
