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
  tabs: {
    flexDirection: 'row' as const,
    marginBottom: THEME_SPEC.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.gold,
  },
  tab: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: THEME_SPEC.spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: UI_COLORS.crimson,
  },
  tabContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: THEME_SPEC.spacing.md },
  codexRow: {
    paddingVertical: THEME_SPEC.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.divider,
  },
  achRow: {
    paddingVertical: THEME_SPEC.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.divider,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: THEME_SPEC.spacing.xl,
  },
  statRow: { marginBottom: THEME_SPEC.spacing.md },
  backRow: { marginTop: THEME_SPEC.spacing.lg },
};
