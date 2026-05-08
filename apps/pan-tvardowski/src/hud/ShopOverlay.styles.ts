import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export const rawStyles = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ui.bodyBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    elevation: 4,
    zIndex: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  },
  backRow: { marginTop: spacing.md },
  panel: {
    alignSelf: 'stretch' as const,
    maxWidth: spacing.panelLgWidth,
    width: '100%' as const,
    maxHeight: '90%' as const,
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
