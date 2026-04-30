import { colors, overlayBase, spacing } from '../theme';

export const rawStyles = {
  root: {
    ...overlayBase.root,
    backgroundColor: colors.ui.bodyBg,
    justifyContent: 'center' as const,
  },
  content: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  },
  backRow: { marginTop: spacing.md },
  panel: {
    ...overlayBase.panelLg,
    backgroundColor: colors.ui.parchment,
  },
  productCard: {
    borderWidth: 1,
    borderColor: colors.ui.gold,
    borderRadius: spacing.panelBorderRadius,
    padding: spacing.panelPadding,
    marginBottom: spacing.md,
  },
  productCardPrice: {
    color: colors.ui.parchmentDim,
  },
};
