import { colors } from '../theme/colors';
import { overlayBase } from '../theme/overlays';
import { spacing } from '../theme/spacing';

export const rawStyles = {
  root: overlayBase.root,
  panelContainer: overlayBase.panelContainer,
  panel: { ...overlayBase.panelLg, backgroundColor: colors.ui.parchment },
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
