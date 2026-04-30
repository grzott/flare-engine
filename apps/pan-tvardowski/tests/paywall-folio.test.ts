import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/PaywallOverlay.styles';
import { colors } from '../src/theme';

describe('PaywallOverlay — folio XI alignment', () => {
  it('wrapper.backgroundColor === colors.ui.crimsonDeep', () => {
    expect(rawStyles.wrapper.backgroundColor).toBe(colors.ui.crimsonDeep);
  });

  it('wrapper.position === "absolute"', () => {
    expect(rawStyles.wrapper.position).toBe('absolute');
  });
});
