import { THEME_SPEC, fontFamily } from '../visual-spec/theme';

export { fontFamily } from '../visual-spec/theme';

const spec = THEME_SPEC.typography;

// Strip spec-only `italic` metadata field from lede before forwarding to RN StyleSheet
const { italic: _ledeMeta, ...ledeForRn } = spec.lede;

export const typography = {
  displayXl: spec.displayXl,
  displayL: spec.displayL,
  displayM: spec.displayM,
  lede: ledeForRn,
  bodyL: spec.bodyL,
  bodyM: spec.bodyM,
  bodyS: spec.bodyS,
  label: spec.label,
  monoHud: spec.monoHud,
  monoDebug: spec.monoDebug,
  smallcap: spec.smallcap,
  // @deprecated use displayM
  h1: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    fontWeight: '800' as const,
  },
  // @deprecated use displayM
  h2: {
    fontFamily: fontFamily.serif,
    fontSize: 26,
    fontWeight: '800' as const,
  },
  // @deprecated use bodyL
  h3: {
    fontFamily: fontFamily.serif,
    fontSize: 20,
    fontWeight: '700' as const,
  },
  // @deprecated use bodyM
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    fontWeight: '400' as const,
  },
  // @deprecated use smallcap
  caption: {
    fontFamily: fontFamily.sansBold,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  // @deprecated use monoDebug
  xs: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: '400' as const,
  },
} as const;
