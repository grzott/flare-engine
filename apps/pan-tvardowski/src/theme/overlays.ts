import { colors } from './colors';
import { spacing } from './spacing';

export const overlayBase = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ui.bodyBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    // Android: lift above the Skia <Canvas> SurfaceView so full-screen
    // RN overlays paint above it.
    elevation: 4,
    zIndex: 4,
  },
  panelContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  },
  panelLg: {
    alignSelf: 'stretch' as const,
    maxWidth: spacing.panelLgWidth,
    width: '100%' as const,
    maxHeight: '90%' as const,
  },
  panelMd: {
    alignSelf: 'stretch' as const,
    maxWidth: spacing.panelMdWidth,
    width: '100%' as const,
  },
} as const;
