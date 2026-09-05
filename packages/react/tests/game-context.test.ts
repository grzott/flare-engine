import { describe, expect, it, mock } from 'bun:test';

// Mock React's createContext before importing game-context. The calls are
// recorded so the test can assert what the SOURCE passed, rather than what this
// mock hard-codes — see the Provider/Consumer note below (HYG10).
const createContextCalls: unknown[] = [];

mock.module('react', () => ({
  createContext: (defaultValue: unknown) => {
    createContextCalls.push(defaultValue);
    return {
      _default: defaultValue,
      Provider: 'GameContext.Provider',
      Consumer: 'GameContext.Consumer',
    };
  },
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
    const ctx = GameContext as unknown as { _default: unknown };
    expect(ctx._default).toBeNull();
  });

  // The previous test here asserted `GameContext.Provider`/`.Consumer` were
  // defined — but this file's own mock hard-codes both as string literals, so it
  // could not fail for any change to game-context.ts. Provider/Consumer are
  // React's shape, not ours. What IS ours is the call: exactly one context,
  // defaulted to null. That is what this asserts instead (HYG10).
  it('creates exactly one context, and defaults it to null', () => {
    expect(createContextCalls).toEqual([null]);
  });
});
