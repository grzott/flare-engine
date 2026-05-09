import { THEME_SPEC } from '../visual-spec/theme';

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
} as const;
