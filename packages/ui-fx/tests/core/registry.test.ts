import { describe, expect, test } from 'bun:test';
import { fade, shatter } from '../../src/core/presets';
import { createPresetRegistry } from '../../src/core/registry';

describe('createPresetRegistry', () => {
  test('register then resolve by name returns the same object', () => {
    const registry = createPresetRegistry();
    const preset = shatter();
    registry.register('delete', preset);
    expect(registry.resolve('delete')).toBe(preset);
  });

  test('a preset passed directly resolves to itself', () => {
    const registry = createPresetRegistry();
    const preset = fade();
    expect(registry.resolve(preset)).toBe(preset);
  });

  test('an unknown name throws', () => {
    const registry = createPresetRegistry();
    let thrown: unknown;
    try {
      registry.resolve('nope');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RangeError);
    expect((thrown as Error).message).toBe('ui-fx: unknown preset "nope"');
  });

  test('two registries are independent', () => {
    const a = createPresetRegistry();
    const b = createPresetRegistry();
    a.register('gone', fade());
    expect(() => b.resolve('gone')).toThrow(RangeError);
  });

  test('registering a name again replaces the preset', () => {
    const registry = createPresetRegistry();
    const second = fade({ opacity: 0.5 });
    registry.register('x', fade());
    registry.register('x', second);
    expect(registry.resolve('x')).toBe(second);
  });

  test('names that shadow Object.prototype members are still unknown', () => {
    expect(() => createPresetRegistry().resolve('toString')).toThrow(RangeError);
  });
});
