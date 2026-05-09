import { THEME_SPEC, UI_COLORS } from '../visual-spec/theme';

export const rawStyles = {
  root: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: UI_COLORS.bodyBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    elevation: 4,
    zIndex: 4,
  },
  panelContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: THEME_SPEC.spacing.xl,
  },
  panel: {
    alignSelf: 'stretch' as const,
    maxWidth: THEME_SPEC.spacing.panelLgWidth,
    width: '100%' as const,
    maxHeight: '90%' as const,
    backgroundColor: UI_COLORS.parchment,
  },
  title: { marginBottom: THEME_SPEC.spacing.md },
  shardHeader: { marginBottom: THEME_SPEC.spacing.xs },
  subheader: { marginBottom: THEME_SPEC.spacing.lg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: THEME_SPEC.spacing.md },
  entryRow: {
    paddingVertical: THEME_SPEC.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.divider,
  },
  entryLocked: { opacity: 0.45, backgroundColor: UI_COLORS.void },
  entryUnlocked: { borderLeftWidth: 2, borderLeftColor: UI_COLORS.gold },
  phaseBlock: { marginTop: THEME_SPEC.spacing.sm, gap: THEME_SPEC.spacing.xs },
  phaseLine: { opacity: 0.75 },
  backRow: { marginTop: THEME_SPEC.spacing.lg },
};
