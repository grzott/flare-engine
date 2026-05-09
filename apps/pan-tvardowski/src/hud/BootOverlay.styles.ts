import { THEME_SPEC, TYPOGRAPHY, UI_COLORS } from '../visual-spec/theme';

export const rawStyles = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI_COLORS.void,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: THEME_SPEC.spacing.xxxl,
    // Android: lift above the Skia <Canvas> SurfaceView.
    elevation: 4,
    zIndex: 4,
  },
  sigil: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: UI_COLORS.crimson,
    marginBottom: THEME_SPEC.spacing.xxl,
  },
  label: {
    color: UI_COLORS.gold,
    ...TYPOGRAPHY.lede,
    marginBottom: THEME_SPEC.spacing.lg,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  bar: {
    width: '70%' as const,
    marginBottom: THEME_SPEC.spacing.xxl,
  },
  versionLabel: {
    position: 'absolute' as const,
    bottom: THEME_SPEC.spacing.xxxl,
    alignSelf: 'center' as const,
    color: UI_COLORS.tint55,
    ...TYPOGRAPHY.smallcap,
  },
};
