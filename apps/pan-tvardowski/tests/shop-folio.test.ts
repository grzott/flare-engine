import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/ShopOverlay.styles';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('ShopOverlay — folio XI alignment', () => {
  it('productCard.borderColor === UI_COLORS.gold', () => {
    expect(rawStyles.productCard.borderColor).toBe(UI_COLORS.gold);
  });

  it('panel.backgroundColor === UI_COLORS.parchment', () => {
    expect(rawStyles.panel.backgroundColor).toBe(UI_COLORS.parchment);
  });
});
