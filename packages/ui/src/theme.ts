import { type ReactNode, createContext, createElement, useContext } from 'react';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
  success: string;
  warning: string;
  focus: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeTypography {
  sizeXs: number;
  sizeSm: number;
  sizeMd: number;
  sizeLg: number;
  sizeXl: number;
  fontFamily?: string;
  fontFamilyMono?: string;
}

export interface ThemeRadii {
  none: number;
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  radii: ThemeRadii;
}

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    bg: '#0b0d10',
    surface: '#14181d',
    surfaceAlt: '#1d232b',
    border: '#2a323c',
    text: '#e7ecf1',
    textMuted: '#8c96a3',
    accent: '#4aa3ff',
    accentText: '#0b0d10',
    danger: '#ff5c5c',
    success: '#5dd39e',
    warning: '#f1c40f',
    focus: '#ffd166',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
  typography: {
    sizeXs: 10,
    sizeSm: 12,
    sizeMd: 14,
    sizeLg: 18,
    sizeXl: 24,
  },
  radii: { none: 0, sm: 4, md: 8, lg: 16, pill: 9999 },
};

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    bg: '#f6f8fa',
    surface: '#ffffff',
    surfaceAlt: '#eef1f4',
    border: '#d4dae0',
    text: '#13181d',
    textMuted: '#5b6670',
    accent: '#0a66d0',
    accentText: '#ffffff',
    danger: '#d12e2e',
    success: '#2f9d69',
    warning: '#c79600',
    focus: '#ff9500',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
  typography: {
    sizeXs: 10,
    sizeSm: 12,
    sizeMd: 14,
    sizeLg: 18,
    sizeXl: 24,
  },
  radii: { none: 0, sm: 4, md: 8, lg: 16, pill: 9999 },
};

const ThemeContext = createContext<Theme>(darkTheme);

export interface ThemeProviderProps {
  theme?: Theme;
  children: ReactNode;
}

export function ThemeProvider({ theme = darkTheme, children }: ThemeProviderProps): ReactNode {
  return createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
