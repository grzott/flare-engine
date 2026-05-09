import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/MenuOverlay.styles';
import { TYPOGRAPHY, UI_COLORS } from '../src/visual-spec/theme';

describe('MenuOverlay styles — folio X menu view', () => {
  it('menuTitle fontFamily === TYPOGRAPHY.displayXl.fontFamily', () => {
    expect(rawStyles.menuTitle.fontFamily).toBe(TYPOGRAPHY.displayXl.fontFamily);
  });

  it('menuTitle color === UI_COLORS.gold', () => {
    expect(rawStyles.menuTitle.color).toBe(UI_COLORS.gold);
  });
});
