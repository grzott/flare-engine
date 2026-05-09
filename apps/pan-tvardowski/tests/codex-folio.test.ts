import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/CodexOverlay.styles';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('CodexOverlay — folio XI alignment', () => {
  it('entryLocked.backgroundColor === UI_COLORS.void', () => {
    expect(rawStyles.entryLocked.backgroundColor).toBe(UI_COLORS.void);
  });

  it('entryUnlocked.borderLeftColor === UI_COLORS.gold', () => {
    expect(rawStyles.entryUnlocked.borderLeftColor).toBe(UI_COLORS.gold);
  });
});
