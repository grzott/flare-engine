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
  panelContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  },
  panel: {
    alignSelf: 'stretch' as const,
    maxWidth: spacing.panelLgWidth,
    width: '100%' as const,
    maxHeight: '90%' as const,
    backgroundColor: colors.ui.parchment,
  },
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
