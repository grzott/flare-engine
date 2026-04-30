import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/BootOverlay.styles';
import { colors } from '../src/theme';

describe('BootOverlay styles — folio X', () => {
  it('root backgroundColor === colors.ui.void', () => {
    expect(rawStyles.root.backgroundColor).toBe(colors.ui.void);
  });

  it('sigil backgroundColor === colors.ui.crimson', () => {
    expect(rawStyles.sigil.backgroundColor).toBe(colors.ui.crimson);
  });
});
