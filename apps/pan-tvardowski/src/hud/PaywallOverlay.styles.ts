import { UI_COLORS } from '../visual-spec/theme';

export const rawStyles = {
  wrapper: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI_COLORS.crimsonDeep,
    // Android: lift above the Skia <Canvas> SurfaceView.
    elevation: 4,
    zIndex: 4,
  },
};
