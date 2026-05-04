import { colors, spacing, typography } from '../theme';

export const rawStyles = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ui.void,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xxxl,
    // Android: lift above the Skia <Canvas> SurfaceView.
    elevation: 4,
    zIndex: 4,
  },
  sigil: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.ui.crimson,
    marginBottom: spacing.xxl,
  },
  label: {
    color: colors.ui.gold,
    ...typography.lede,
    marginBottom: spacing.lg,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  bar: {
    width: '70%' as const,
    marginBottom: spacing.xxl,
  },
  versionLabel: {
    position: 'absolute' as const,
    bottom: spacing.xxxl,
    alignSelf: 'center' as const,
    color: colors.ui.tint55,
    ...typography.smallcap,
  },
};
