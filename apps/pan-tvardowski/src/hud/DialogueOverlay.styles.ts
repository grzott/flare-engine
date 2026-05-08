import { colors } from '../theme/colors';

export const rawStyles = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ui.overlay,
    justifyContent: 'flex-end' as const,
    padding: 24,
    // Android: lift above the Skia <Canvas> SurfaceView.
    elevation: 4,
    zIndex: 4,
  },
  panel: {
    borderWidth: 2,
    borderColor: colors.ui.border,
    backgroundColor: colors.ui.parchment,
  },
  portraitSlot: {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  portraitBox: {
    width: 44,
    height: 44,
    borderRadius: 4,
    opacity: 0.9,
    borderWidth: 1,
    borderColor: colors.ui.gold,
  },
};
