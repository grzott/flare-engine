import { colors, spacing, typography } from '../theme';

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
    padding: spacing.xxxl,
  },
  label: {
    color: colors.ui.primary,
    ...typography.h3,
    marginBottom: spacing.lg,
    textAlign: 'center' as const,
  },
  subLabel: {
    color: colors.ui.tint60,
    ...typography.body,
    marginBottom: spacing.xxl,
    textAlign: 'center' as const,
  },
  bar: {
    width: '80%' as const,
  },
};
