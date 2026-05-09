import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/DialogueOverlay.styles';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('DialogueOverlay — folio XI alignment', () => {
  it('portraitBox dimensions are 44×44', () => {
    expect(rawStyles.portraitBox.width === 44 && rawStyles.portraitBox.height === 44).toBe(true);
  });

  it('portraitBox.borderColor === UI_COLORS.gold', () => {
    expect(rawStyles.portraitBox.borderColor).toBe(UI_COLORS.gold);
  });
});
