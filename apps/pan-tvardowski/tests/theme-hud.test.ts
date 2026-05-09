import { describe, expect, it } from 'bun:test';
import { rawStyles as hudStyles } from '../src/hud/Hud.styles';
import { rawStyles as menuStyles } from '../src/hud/MenuOverlay.styles';
import { UI_COLORS } from '../src/visual-spec/theme';

describe('Hud rawStyles — theme token assertions', () => {
  it('score.color === UI_COLORS.primary', () => {
    expect(hudStyles.score.color).toBe(UI_COLORS.primary);
  });

  it('bossBarFill.backgroundColor === UI_COLORS.hazard', () => {
    expect(hudStyles.bossBarFill.backgroundColor).toBe(UI_COLORS.hazard);
  });

  it('minibossBarFill.backgroundColor === UI_COLORS.secondary', () => {
    expect(hudStyles.minibossBarFill.backgroundColor).toBe(UI_COLORS.secondary);
  });

  it('shieldActive.color === UI_COLORS.verdigris', () => {
    expect(hudStyles.shieldActive.color).toBe(UI_COLORS.verdigris);
  });

  it('centerOverlay.backgroundColor === UI_COLORS.overlay', () => {
    expect(hudStyles.centerOverlay.backgroundColor).toBe(UI_COLORS.overlay);
  });
});

describe('MenuOverlay rawStyles — theme token assertions', () => {
  it('root.backgroundColor === UI_COLORS.bodyBg', () => {
    expect(menuStyles.root.backgroundColor).toBe(UI_COLORS.bodyBg);
  });
});
