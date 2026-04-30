import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/MenuOverlay.styles';
import { colors, typography } from '../src/theme';

describe('MenuOverlay styles — folio X menu view', () => {
  it('menuTitle fontFamily === typography.displayXl.fontFamily', () => {
    expect(rawStyles.menuTitle.fontFamily).toBe(typography.displayXl.fontFamily);
  });

  it('menuTitle color === colors.ui.gold', () => {
    expect(rawStyles.menuTitle.color).toBe(colors.ui.gold);
  });
});
