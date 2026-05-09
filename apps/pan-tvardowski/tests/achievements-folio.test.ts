import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/AchievementsOverlay.styles';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('AchievementsOverlay — folio XI alignment', () => {
  it('entryUnlocked.borderLeftColor === UI_COLORS.gold', () => {
    expect(rawStyles.entryUnlocked.borderLeftColor).toBe(UI_COLORS.gold);
  });

  it('panel.backgroundColor === UI_COLORS.parchment', () => {
    expect(rawStyles.panel.backgroundColor).toBe(UI_COLORS.parchment);
  });
});
