import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/AchievementsOverlay.styles';
import { colors } from '../src/theme/colors';

describe('AchievementsOverlay — folio XI alignment', () => {
  it('entryUnlocked.borderLeftColor === colors.ui.gold', () => {
    expect(rawStyles.entryUnlocked.borderLeftColor).toBe(colors.ui.gold);
  });

  it('panel.backgroundColor === colors.ui.parchment', () => {
    expect(rawStyles.panel.backgroundColor).toBe(colors.ui.parchment);
  });
});
