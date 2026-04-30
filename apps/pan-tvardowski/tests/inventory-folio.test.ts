import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/InventoryOverlay.styles';
import { colors } from '../src/theme';

describe('InventoryOverlay — folio XI alignment', () => {
  it('tabs.borderBottomColor === colors.ui.gold', () => {
    expect(rawStyles.tabs.borderBottomColor).toBe(colors.ui.gold);
  });

  it('tabActive.borderBottomColor === colors.ui.crimson', () => {
    expect(rawStyles.tabActive.borderBottomColor).toBe(colors.ui.crimson);
  });
});
