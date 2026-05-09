import { THEME_SPEC, UI_COLORS } from '../visual-spec/theme';

export const rawStyles = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI_COLORS.bodyBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    elevation: 4,
    zIndex: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: THEME_SPEC.spacing.xl,
  },
  backRow: { marginTop: THEME_SPEC.spacing.md },
  panel: {
    alignSelf: 'stretch' as const,
    maxWidth: THEME_SPEC.spacing.panelLgWidth,
    width: '100%' as const,
    maxHeight: '90%' as const,
    backgroundColor: UI_COLORS.parchment,
  },
  productCard: {
    borderWidth: 1,
    borderColor: UI_COLORS.gold,
    borderRadius: THEME_SPEC.spacing.panelBorderRadius,
    padding: THEME_SPEC.spacing.panelPadding,
    marginBottom: THEME_SPEC.spacing.md,
  },
  productCardPrice: {
    color: UI_COLORS.parchmentDim,
  },
};
