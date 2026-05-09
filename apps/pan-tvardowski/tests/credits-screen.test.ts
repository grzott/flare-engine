import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/MenuOverlay.styles';
import { TYPOGRAPHY } from '../src/visual-spec/theme';

describe('credits screen styles — session #81 M2', () => {
  it('creditsSectionTitle fontFamily === TYPOGRAPHY.lede.fontFamily', () => {
    expect(rawStyles.creditsSectionTitle.fontFamily).toBe(TYPOGRAPHY.lede.fontFamily);
  });

  it('creditsLine fontFamily === TYPOGRAPHY.bodyL.fontFamily', () => {
    expect(rawStyles.creditsLine.fontFamily).toBe(TYPOGRAPHY.bodyL.fontFamily);
  });
});
