import { describe, expect, test } from 'bun:test';
import { createMemoryAdapter } from '../src/memory-adapter.js';
import type { Migration } from '../src/migrations.js';
import { s } from '../src/schema.js';
import { createStorage } from '../src/storage.js';

const playerSchema = s.object({
  name: s.string(),
  hp: s.number(),
});

describe('createStorage — options validation', () => {
  test('rejects non-integer / non-positive version', () => {
    const adapter = createMemoryAdapter();
    expect(() => createStorage({ adapter, schema: playerSchema, version: 0 })).toThrow();
    expect(() => createStorage({ adapter, schema: playerSchema, version: 1.5 })).toThrow();
  });
});

describe('createStorage — slots', () => {
  test('saveSlot + loadSlot roundtrip', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema,
      version: 1,
    });
    await storage.saveSlot('auto', { name: 'hero', hp: 10 });
    expect(await storage.loadSlot('auto')).toEqual({ name: 'hero', hp: 10 });
  });

  test('saveSlot rejects invalid data via schema', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema,
      version: 1,
    });
    await expect(
      storage.saveSlot('bad', { name: 'hero', hp: 'ten' } as unknown as {
        name: string;
        hp: number;
      }),
    ).rejects.toThrow();
  });

  test('loadSlot returns null for missing slot', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema,
      version: 1,
    });
    expect(await storage.loadSlot('none')).toBeNull();
  });

  test('loadSlot rejects corrupted envelope', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('slot:bad', JSON.stringify({ not: 'an envelope' }));
    const storage = createStorage({ adapter, schema: playerSchema, version: 1 });
    await expect(storage.loadSlot('bad')).rejects.toThrow();
  });

  test('deleteSlot removes only that slot', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema,
      version: 1,
    });
    await storage.saveSlot('a', { name: 'A', hp: 1 });
    await storage.saveSlot('b', { name: 'B', hp: 2 });
    await storage.deleteSlot('a');
    expect(await storage.loadSlot('a')).toBeNull();
    expect(await storage.loadSlot('b')).toEqual({ name: 'B', hp: 2 });
  });

  test('listSlots returns slot names without prefix', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('unrelated', 'ignore-me');
    const storage = createStorage({ adapter, schema: playerSchema, version: 1 });
    await storage.saveSlot('one', { name: '1', hp: 1 });
    await storage.saveSlot('two', { name: '2', hp: 2 });
    const slots = await storage.listSlots();
    expect(slots.sort()).toEqual(['one', 'two']);
  });
});

describe('createStorage — migrations', () => {
  test('lifts stored data forward and validates after', async () => {
    const adapter = createMemoryAdapter();
    // Pretend we saved legacy v1 data without `hp`
    await adapter.set('slot:save', JSON.stringify({ version: 1, data: { name: 'hero' } }));
    const migrations: Migration[] = [
      { version: 2, migrate: (d) => ({ ...(d as object), hp: 100 }) },
    ];
    const storage = createStorage({ adapter, schema: playerSchema, version: 2, migrations });
    expect(await storage.loadSlot('save')).toEqual({ name: 'hero', hp: 100 });
  });

  test('no migrations applied when stored version matches current', async () => {
    const adapter = createMemoryAdapter();
    const storage = createStorage({
      adapter,
      schema: playerSchema,
      version: 1,
      migrations: [{ version: 1, migrate: () => ({ name: 'BUG', hp: -1 }) }],
    });
    await storage.saveSlot('auto', { name: 'hero', hp: 10 });
    expect(await storage.loadSlot('auto')).toEqual({ name: 'hero', hp: 10 });
  });
});

describe('createStorage — JSON import/export', () => {
  test('export then import restores every key', async () => {
    const src = createMemoryAdapter();
    const storage = createStorage({ adapter: src, schema: playerSchema, version: 1 });
    await storage.saveSlot('one', { name: 'A', hp: 1 });
    await storage.saveSlot('two', { name: 'B', hp: 2 });
    await storage.set('meta', 'some-metadata');

    const json = await storage.exportJSON();

    const dst = createMemoryAdapter();
    const restored = createStorage({ adapter: dst, schema: playerSchema, version: 1 });
    await restored.importJSON(json);

    expect(await restored.loadSlot('one')).toEqual({ name: 'A', hp: 1 });
    expect(await restored.loadSlot('two')).toEqual({ name: 'B', hp: 2 });
    expect(await restored.get('meta')).toBe('some-metadata');
  });

  test('importJSON with invalid entry leaves prior data untouched', async () => {
    const adapter = createMemoryAdapter();
    const storage = createStorage({ adapter, schema: playerSchema, version: 1 });
    await storage.saveSlot('keep', { name: 'survivor', hp: 42 });

    const corrupt = JSON.stringify({ version: 1, entries: { good: '"val"', bad: 99 } });
    await expect(storage.importJSON(corrupt)).rejects.toThrow();
    expect(await storage.loadSlot('keep')).toEqual({ name: 'survivor', hp: 42 });
  });

  test('importJSON clears existing data first', async () => {
    const adapter = createMemoryAdapter();
    const storage = createStorage({ adapter, schema: playerSchema, version: 1 });
    await storage.saveSlot('old', { name: 'old', hp: 1 });

    const fresh = JSON.stringify({ version: 1, entries: {} });
    await storage.importJSON(fresh);
    expect(await storage.listSlots()).toEqual([]);
  });

  test('importJSON rejects malformed payload', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema,
      version: 1,
    });
    await expect(storage.importJSON('not json')).rejects.toThrow();
    await expect(storage.importJSON(JSON.stringify({ no: 'schema' }))).rejects.toThrow();
    await expect(
      storage.importJSON(JSON.stringify({ version: 1, entries: { k: 42 } })),
    ).rejects.toThrow();
  });
});

describe('createStorage — low-level get/set/delete', () => {
  test('bypasses schema and migrations', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema,
      version: 1,
    });
    await storage.set('raw', 'anything');
    expect(await storage.get('raw')).toBe('anything');
    await storage.delete('raw');
    expect(await storage.get('raw')).toBeNull();
  });
});
