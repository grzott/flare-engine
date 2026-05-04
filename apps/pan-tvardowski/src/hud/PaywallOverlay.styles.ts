import { colors } from '../theme';

export const rawStyles = {
  wrapper: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ui.crimsonDeep,
    // Android: lift above the Skia <Canvas> SurfaceView.
    elevation: 4,
    zIndex: 4,
  },
};
