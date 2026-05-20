import { describe, expect, test } from 'bun:test';
import { hexToArgb } from '../src/util/hex';
import { OVERLAY_CLOSE_MS, OVERLAY_OPEN_MS } from '../src/visual-spec/animations';
import { THEME_SPEC } from '../src/visual-spec/theme';

describe('vs-theme-literals — color token parity', () => {
  test('terracotta matches legacy ambience initialPrimary 0xffb05a3c', () => {
    expect(hexToArgb(THEME_SPEC.colors.terracotta)).toBe(0xffb05a3c);
  });

  test('pitchBrown matches legacy App clearColor 0xff1a0e0a', () => {
    expect(hexToArgb(THEME_SPEC.colors.pitchBrown)).toBe(0xff1a0e0a);
  });

  test('charcoal matches legacy DialogueOverlay portrait fallback 0xff333333', () => {
    expect(hexToArgb(THEME_SPEC.colors.charcoal)).toBe(0xff333333);
  });

  test('hpBarDark matches legacy HP bar gradient dark stop 0xff2a0810', () => {
    expect(hexToArgb(THEME_SPEC.colors.hpBarDark)).toBe(0xff2a0810);
  });

  test('crashBg matches legacy App crash screen bg 0xff0a0610', () => {
    expect(hexToArgb(THEME_SPEC.colors.crashBg)).toBe(0xff0a0610);
  });

  test('parchmentLight matches legacy App crash title 0xfff3d6a4', () => {
    expect(hexToArgb(THEME_SPEC.colors.parchmentLight)).toBe(0xfff3d6a4);
  });

  test('ashGrey matches legacy App crash message 0xffa89b8c', () => {
    expect(hexToArgb(THEME_SPEC.colors.ashGrey)).toBe(0xffa89b8c);
  });

  test('crashButtonBg matches legacy App crash button bg 0xff8a2f2f', () => {
    expect(hexToArgb(THEME_SPEC.colors.crashButtonBg)).toBe(0xff8a2f2f);
  });

  test('crimson string matches legacy HP bar gradient stop #D4213D', () => {
    expect(THEME_SPEC.colors.crimson).toBe('#D4213D');
  });

  test('pureBlack hexToArgb parity 0xff000000', () => {
    expect(hexToArgb(THEME_SPEC.colors.pureBlack)).toBe(0xff000000);
  });

  test('white string parity #FFFFFF', () => {
    expect(THEME_SPEC.colors.white).toBe('#FFFFFF');
  });
});

describe('vs-theme-literals — duration constants', () => {
  test('OVERLAY_OPEN_MS = 240 (derived from overlay-open 0.24s)', () => {
    expect(OVERLAY_OPEN_MS).toBe(240);
  });

  test('OVERLAY_CLOSE_MS = 180 (derived from overlay-close 0.18s)', () => {
    expect(OVERLAY_CLOSE_MS).toBe(180);
  });
});
