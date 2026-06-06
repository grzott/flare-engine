import { FocusProvider, type Theme, ThemeProvider, darkTheme } from '@flare-engine/ui';
import type { ReactNode } from 'react';
import type React from 'react';

interface HudPanelScaffoldProps {
  children: ReactNode;
  focus?: boolean;
  theme?: Theme;
}

export function HudPanelScaffold({
  children,
  focus = true,
  theme = darkTheme,
}: HudPanelScaffoldProps): React.ReactElement {
  const inner = focus ? <FocusProvider>{children}</FocusProvider> : children;
  return <ThemeProvider theme={theme}>{inner}</ThemeProvider>;
}
