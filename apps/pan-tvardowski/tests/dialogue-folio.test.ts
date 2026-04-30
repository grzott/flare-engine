import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/DialogueOverlay.styles';
import { colors } from '../src/theme';

describe('DialogueOverlay — folio XI alignment', () => {
  it('portraitBox dimensions are 44×44', () => {
    expect(rawStyles.portraitBox.width === 44 && rawStyles.portraitBox.height === 44).toBe(true);
  });

  it('portraitBox.borderColor === colors.ui.gold', () => {
    expect(rawStyles.portraitBox.borderColor).toBe(colors.ui.gold);
  });
});
