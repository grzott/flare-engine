import { colors, overlayBase, spacing } from '../theme';

export const rawStyles = {
  backdrop: {
    flex: 1,
    backgroundColor: colors.ui.backdropModal,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  },
  panel: overlayBase.panelMd,
  title: { marginBottom: spacing.xl },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginVertical: 6,
  },
  rowLabel: { flex: 1, marginRight: spacing.md },
  dataHeading: { marginTop: spacing.xl, marginBottom: spacing.sm },
  dataNote: { marginBottom: spacing.md },
  closeRow: { marginTop: spacing.lg },
};
