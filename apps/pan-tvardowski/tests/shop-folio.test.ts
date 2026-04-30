import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/ShopOverlay.styles';
import { colors } from '../src/theme';

describe('ShopOverlay — folio XI alignment', () => {
  it('productCard.borderColor === colors.ui.gold', () => {
    expect(rawStyles.productCard.borderColor).toBe(colors.ui.gold);
  });

  it('panel.backgroundColor === colors.ui.parchment', () => {
    expect(rawStyles.panel.backgroundColor).toBe(colors.ui.parchment);
  });
});
