import { describe, expect, it } from 'bun:test';
import { rawStyles as hudStyles } from '../src/hud/Hud.styles';
import { rawStyles as menuStyles } from '../src/hud/MenuOverlay.styles';
import { colors } from '../src/theme/colors';

describe('Hud rawStyles — theme token assertions', () => {
  it('score.color === colors.ui.primary', () => {
    expect(hudStyles.score.color).toBe(colors.ui.primary);
  });

  it('bossBarFill.backgroundColor === colors.ui.hazard', () => {
    expect(hudStyles.bossBarFill.backgroundColor).toBe(colors.ui.hazard);
  });

  it('minibossBarFill.backgroundColor === colors.ui.secondary', () => {
    expect(hudStyles.minibossBarFill.backgroundColor).toBe(colors.ui.secondary);
  });

  it('shieldActive.color === colors.ui.verdigris', () => {
    expect(hudStyles.shieldActive.color).toBe(colors.ui.verdigris);
  });

  it('centerOverlay.backgroundColor === colors.ui.overlay', () => {
    expect(hudStyles.centerOverlay.backgroundColor).toBe(colors.ui.overlay);
  });
});

describe('MenuOverlay rawStyles — theme token assertions', () => {
  it('root.backgroundColor === colors.ui.bodyBg', () => {
    expect(menuStyles.root.backgroundColor).toBe(colors.ui.bodyBg);
  });
});
