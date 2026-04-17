import { describe, expect, it, mock } from 'bun:test';

// Mock React's createContext before importing game-context
mock.module('react', () => ({
  createContext: (defaultValue: unknown) => ({
    _default: defaultValue,
    Provider: 'GameContext.Provider',
    Consumer: 'GameContext.Consumer',
  }),
  useContext: (ctx: { _default: unknown }) => ctx._default,
  useEffect: (_fn: () => void) => {},
  useRef: (init: unknown) => ({ current: init }),
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useState: (init: unknown) => [init, () => {}],
}));

// Dynamic import after mocks are set up
const { GameContext } = await import('../src/game-context.js');

describe('GameContext', () => {
  it('creates context with null default', () => {
    expect(GameContext._default).toBeNull();
  });

  it('has Provider and Consumer', () => {
    expect(GameContext.Provider).toBeDefined();
    expect(GameContext.Consumer).toBeDefined();
  });
});
