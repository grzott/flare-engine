import { colors, spacing, typography } from '../theme';

export const rawStyles = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ui.bodyBg,
    justifyContent: 'center' as const,
  },
  panelContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  },
  panel: { alignSelf: 'stretch' as const, maxWidth: spacing.panelMdWidth, width: '100%' as const },
  slotRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  lockedBadge: {
    marginLeft: spacing.md,
    color: colors.ui.lockedBadge,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginVertical: spacing.lg,
  },
  rowLabel: { flex: 1 },
  rowControls: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.lg },
  rowValue: { minWidth: 48, textAlign: 'center' as const },
  creditsRoot: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xxxl,
  },
  creditsTitle: { marginBottom: spacing.lg },
  creditsScroll: { alignSelf: 'stretch' as const, maxHeight: '70%' as const },
  creditsContent: { paddingHorizontal: 12, paddingVertical: 16, alignItems: 'center' as const },
  creditsSection: { marginBottom: 20, alignItems: 'center' as const },
  creditsSectionTitle: {
    color: colors.ui.neutralLight,
    ...typography.label,
    marginBottom: spacing.lg,
    textAlign: 'center' as const,
  },
  creditsLine: {
    color: colors.ui.neutralMid,
    ...typography.xs,
    lineHeight: 18,
    textAlign: 'center' as const,
  },
  creditsSkip: {
    color: colors.ui.tint55,
    marginTop: spacing.lg,
    letterSpacing: 1,
  },
  zoneSelectItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.divider,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  zoneSelectBack: {
    marginTop: spacing.lg,
  },
};
