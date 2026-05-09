import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/BootOverlay.styles';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('BootOverlay styles — folio X', () => {
  it('root backgroundColor === UI_COLORS.void', () => {
    expect(rawStyles.root.backgroundColor).toBe(UI_COLORS.void);
  });

  it('sigil backgroundColor === UI_COLORS.crimson', () => {
    expect(rawStyles.sigil.backgroundColor).toBe(UI_COLORS.crimson);
  });
});
