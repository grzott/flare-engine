import { colors, overlayBase, spacing } from '../theme';

export const rawStyles = {
  root: overlayBase.root,
  panelContainer: overlayBase.panelContainer,
  panel: { ...overlayBase.panelLg, backgroundColor: colors.ui.parchment },
  title: { marginBottom: spacing.md },
  shardHeader: { marginBottom: spacing.xs },
  subheader: { marginBottom: spacing.lg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  entryRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
  },
  entryLocked: { opacity: 0.45, backgroundColor: colors.ui.void },
  entryUnlocked: { borderLeftWidth: 2, borderLeftColor: colors.ui.gold },
  phaseBlock: { marginTop: spacing.sm, gap: spacing.xs },
  phaseLine: { opacity: 0.75 },
  backRow: { marginTop: spacing.lg },
};
