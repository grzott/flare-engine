import { colors, overlayBase, spacing } from '../theme';

export const rawStyles = {
  root: overlayBase.root,
  panelContainer: overlayBase.panelContainer,
  panel: { ...overlayBase.panelLg, backgroundColor: colors.ui.parchment },
  title: { marginBottom: spacing.md },
  subheader: { marginBottom: spacing.lg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  sectionHeader: { marginTop: spacing.sm, marginBottom: 6, opacity: 0.7 },
  entryRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
  },
  entryLocked: { opacity: 0.5, backgroundColor: colors.ui.void },
  entryUnlocked: { borderLeftWidth: 2, borderLeftColor: colors.ui.gold },
  backRow: { marginTop: spacing.lg },
};
