import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/InventoryOverlay.styles';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('InventoryOverlay — folio XI alignment', () => {
  it('tabs.borderBottomColor === UI_COLORS.gold', () => {
    expect(rawStyles.tabs.borderBottomColor).toBe(UI_COLORS.gold);
  });

  it('tabActive.borderBottomColor === UI_COLORS.crimson', () => {
    expect(rawStyles.tabActive.borderBottomColor).toBe(UI_COLORS.crimson);
  });
});
