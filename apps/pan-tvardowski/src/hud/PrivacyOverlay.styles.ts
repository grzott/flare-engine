import { THEME_SPEC, UI_COLORS } from '../visual-spec/theme';

export const rawStyles = {
  backdrop: {
    flex: 1,
    backgroundColor: UI_COLORS.backdropModal,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: THEME_SPEC.spacing.xl,
  },
  panel: {
    alignSelf: 'stretch' as const,
    maxWidth: THEME_SPEC.spacing.panelMdWidth,
    width: '100%' as const,
  },
  title: { marginBottom: THEME_SPEC.spacing.xl },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginVertical: 6,
  },
  rowLabel: { flex: 1, marginRight: THEME_SPEC.spacing.md },
  dataHeading: { marginTop: THEME_SPEC.spacing.xl, marginBottom: THEME_SPEC.spacing.sm },
  dataNote: { marginBottom: THEME_SPEC.spacing.md },
  closeRow: { marginTop: THEME_SPEC.spacing.lg },
};
