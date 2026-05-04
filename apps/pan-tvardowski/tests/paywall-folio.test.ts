import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rawStyles } from '../src/hud/PaywallOverlay.styles';
import { colors } from '../src/theme';

describe('PaywallOverlay — folio XI alignment', () => {
  it('wrapper.backgroundColor === colors.ui.crimsonDeep', () => {
    expect(rawStyles.wrapper.backgroundColor).toBe(colors.ui.crimsonDeep);
  });

  it('wrapper.position === "absolute"', () => {
    expect(rawStyles.wrapper.position).toBe('absolute');
  });
});

describe('PaywallOverlay — visibility gate (regression guard)', () => {
  // Regression: PaywallOverlay's wrapper has crimsonDeep bg + position:absolute
  // top:0/right:0/bottom:0/left:0 + elevation:4, so when mounted it covered
  // the entire screen and obscured the main menu (#7A1322 is similar enough
  // to the GameView clearColor 0xff1a0e0a to mask the bug visually). The
  // component must return null when `!visible`. We pin via source-file
  // content to avoid pulling react-native into the unit test runtime.
  const source = fs.readFileSync(path.resolve(__dirname, '../src/hud/PaywallOverlay.tsx'), 'utf8');

  it('source contains an early null-return when !visible', () => {
    expect(source).toMatch(/if\s*\(\s*!\s*visible\s*\)\s*return\s+null/);
  });
});
