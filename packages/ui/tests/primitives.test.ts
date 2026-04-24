import { describe, expect, it, mock } from 'bun:test';

mock.module('react', () => ({
  createElement: () => null,
  createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
  useContext: () => null,
  useId: () => 'id',
  useState: <T>(init: T) => [init, () => {}],
  useEffect: () => {},
  useRef: <T>(init: T) => ({ current: init }),
  useMemo: <T>(fn: () => T) => fn(),
  useCallback: <T>(fn: T) => fn,
  Fragment: 'Fragment',
}));

const jsxMock = {
  jsx: () => null,
  jsxs: () => null,
  jsxDEV: () => null,
  Fragment: 'Fragment',
};
mock.module('react/jsx-runtime', () => jsxMock);
mock.module('react/jsx-dev-runtime', () => jsxMock);

mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));

const { Panel } = await import('../src/panel.js');
const { Label } = await import('../src/label.js');
const { Button } = await import('../src/button.js');
const { ProgressBar } = await import('../src/progress-bar.js');
const { HUDBar } = await import('../src/hud-bar.js');
const { List } = await import('../src/list.js');
const { Modal } = await import('../src/modal.js');
const { FocusProvider } = await import('../src/focus-provider.js');
const { ThemeProvider } = await import('../src/theme.js');
const { DialoguePanel } = await import('../src/dialogue-panel.js');
const { ShopPanel } = await import('../src/shop-panel.js');
const { MainMenuKit } = await import('../src/main-menu-kit.js');

describe('UI primitives', () => {
  it('exports Panel as a function', () => {
    expect(typeof Panel).toBe('function');
  });
  it('exports Label as a function', () => {
    expect(typeof Label).toBe('function');
  });
  it('exports Button as a function', () => {
    expect(typeof Button).toBe('function');
  });
  it('exports ProgressBar as a function', () => {
    expect(typeof ProgressBar).toBe('function');
  });
  it('exports HUDBar as a function', () => {
    expect(typeof HUDBar).toBe('function');
  });
  it('exports List as a function', () => {
    expect(typeof List).toBe('function');
  });
  it('exports Modal as a function', () => {
    expect(typeof Modal).toBe('function');
  });
  it('exports FocusProvider as a function', () => {
    expect(typeof FocusProvider).toBe('function');
  });
  it('exports ThemeProvider as a function', () => {
    expect(typeof ThemeProvider).toBe('function');
  });
  it('exports DialoguePanel as a function', () => {
    expect(typeof DialoguePanel).toBe('function');
  });
  it('exports ShopPanel as a function', () => {
    expect(typeof ShopPanel).toBe('function');
  });
  it('exports MainMenuKit as a function', () => {
    expect(typeof MainMenuKit).toBe('function');
  });
});
