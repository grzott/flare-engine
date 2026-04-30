import { describe, expect, it } from 'bun:test';
import { rawStyles } from '../src/hud/MenuOverlay.styles';
import { typography } from '../src/theme';

describe('credits screen styles — session #81 M2', () => {
  it('creditsSectionTitle fontFamily === typography.lede.fontFamily', () => {
    expect(rawStyles.creditsSectionTitle.fontFamily).toBe(typography.lede.fontFamily);
  });

  it('creditsLine fontFamily === typography.bodyL.fontFamily', () => {
    expect(rawStyles.creditsLine.fontFamily).toBe(typography.bodyL.fontFamily);
  });
});
