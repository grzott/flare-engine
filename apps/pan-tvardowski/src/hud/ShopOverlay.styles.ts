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
};
