import { describe, expect, it } from 'bun:test';
import { rawStyles as achievementsStyles } from '../src/hud/AchievementsOverlay.styles';
import { rawStyles as codexStyles } from '../src/hud/CodexOverlay.styles';
import { rawStyles as dialogueStyles } from '../src/hud/DialogueOverlay.styles';
import { rawStyles as inventoryStyles } from '../src/hud/InventoryOverlay.styles';
import { rawStyles as privacyStyles } from '../src/hud/PrivacyOverlay.styles';
import { rawStyles as shopStyles } from '../src/hud/ShopOverlay.styles';
import { overlayBase } from '../src/theme';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

describe('overlayBase — shared StyleSheet partials', () => {
  it('root.backgroundColor === colors.ui.bodyBg', () => {
    expect(overlayBase.root.backgroundColor).toBe(colors.ui.bodyBg);
  });

  it('panelContainer.padding === spacing.xl', () => {
    expect(overlayBase.panelContainer.padding).toBe(spacing.xl);
  });

  it('panelLg.maxWidth === spacing.panelLgWidth', () => {
    expect(overlayBase.panelLg.maxWidth).toBe(spacing.panelLgWidth);
  });

  it('panelMd.maxWidth === spacing.panelMdWidth', () => {
    expect(overlayBase.panelMd.maxWidth).toBe(spacing.panelMdWidth);
  });
});

describe('overlay rawStyles — theme token assertions', () => {
  it('InventoryOverlay root references overlayBase.root', () => {
    expect(inventoryStyles.root).toBe(overlayBase.root);
  });

  it('InventoryOverlay tabActive borderColor === colors.ui.crimson', () => {
    expect(inventoryStyles.tabActive.borderBottomColor).toBe(colors.ui.crimson);
  });

  it('CodexOverlay root references overlayBase.root', () => {
    expect(codexStyles.root).toBe(overlayBase.root);
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

  it('PrivacyOverlay panel references overlayBase.panelMd', () => {
    expect(privacyStyles.panel).toBe(overlayBase.panelMd);
  });

  it('ShopOverlay root.backgroundColor === colors.ui.bodyBg', () => {
    expect(shopStyles.root.backgroundColor).toBe(colors.ui.bodyBg);
  });
});
