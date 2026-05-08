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
  tabs: {
    flexDirection: 'row' as const,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.gold,
  },
  tab: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.ui.crimson,
  },
  tabContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  codexRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
  },
  achRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: spacing.xl,
  },
  statRow: { marginBottom: spacing.md },
  backRow: { marginTop: spacing.lg },
};
