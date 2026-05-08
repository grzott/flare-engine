import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/CodexOverlay.styles';
import { colors } from '../src/theme/colors';

describe('CodexOverlay — folio XI alignment', () => {
  it('entryLocked.backgroundColor === colors.ui.void', () => {
    expect(rawStyles.entryLocked.backgroundColor).toBe(colors.ui.void);
  });

  it('entryUnlocked.borderLeftColor === colors.ui.gold', () => {
    expect(rawStyles.entryUnlocked.borderLeftColor).toBe(colors.ui.gold);
  });
});
