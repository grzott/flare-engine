import { describe, expect, test } from 'bun:test';
import type { StorageAdapter } from '../src/adapter.js';
import { createDocumentStore } from '../src/document-store.js';
import { createMemoryAdapter } from '../src/memory-adapter.js';

interface TestDoc {
  name: string;
  count: number;
  active: boolean;
}

function defaultDoc(): TestDoc {
  return { name: 'default', count: 0, active: false };
}

function parseDoc(raw: unknown): TestDoc {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return defaultDoc();
  const o = raw as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name : 'default',
    count: typeof o.count === 'number' && Number.isFinite(o.count) ? o.count : 0,
    active: typeof o.active === 'boolean' ? o.active : false,
  };
}

function makeStore(adapter: StorageAdapter = createMemoryAdapter()) {
  return createDocumentStore<TestDoc>({
    adapter,
    key: 'test:doc',
    version: 1,
    parse: parseDoc,
  });
}

describe('createDocumentStore — validation', () => {
  test('throws on non-positive version', () => {
    expect(() =>
      createDocumentStore({
        adapter: createMemoryAdapter(),
        key: 'k',
        version: 0,
        parse: parseDoc,
      }),
    ).toThrow('version must be a positive integer');
  });

  test('throws on non-integer version', () => {
    expect(() =>
      createDocumentStore({
        adapter: createMemoryAdapter(),
        key: 'k',
        version: 1.5,
        parse: parseDoc,
      }),
    ).toThrow('version must be a positive integer');
  });
});

describe('createDocumentStore — first-run path', () => {
  test('absent key → parse(undefined) result returned and persisted', async () => {
    const store = makeStore();
    const doc = await store.load();
    expect(doc).toEqual(defaultDoc());
    expect(store.get()).toEqual(defaultDoc());
  });

  test('onFirstRun is called with the initial parsed doc', async () => {
    const adapter = createMemoryAdapter();
    const store = createDocumentStore<TestDoc>({
      adapter,
      key: 'doc',
      version: 1,
      parse: parseDoc,
      onFirstRun: (d) => ({ ...d, name: 'seeded', active: true }),
    });
    const doc = await store.load();
    expect(doc.name).toBe('seeded');
    expect(doc.active).toBe(true);
  });

  test('onFirstRun result is persisted so a second load() returns it', async () => {
    const adapter = createMemoryAdapter();
    const store1 = createDocumentStore<TestDoc>({
      adapter,
      key: 'doc',
      version: 1,
      parse: parseDoc,
      onFirstRun: (d) => ({ ...d, count: 42 }),
    });
    await store1.load();

    const store2 = createDocumentStore<TestDoc>({
      adapter,
      key: 'doc',
      version: 1,
      parse: parseDoc,
    });
    const doc = await store2.load();
    expect(doc.count).toBe(42);
  });
});

describe('createDocumentStore — get, save, round-trip', () => {
  test('get() before load() throws', () => {
    expect(() => makeStore().get()).toThrow('called before load()');
  });

  test('save → reload returns same value', async () => {
    const adapter = createMemoryAdapter();

    const store1 = makeStore(adapter);
    await store1.load();
    await store1.save({ name: 'saved', count: 7, active: true });

    const store2 = makeStore(adapter);
    const doc = await store2.load();
    expect(doc).toEqual({ name: 'saved', count: 7, active: true });
  });
});

describe('createDocumentStore — migrations', () => {
  test('migration runs when stored version is older', async () => {
    const adapter = createMemoryAdapter();

    const storeV1 = makeStore(adapter);
    await storeV1.load();
    await storeV1.save({ name: 'v1', count: 0, active: false });

    const storeV2 = createDocumentStore<TestDoc>({
      adapter,
      key: 'test:doc',
      version: 2,
      migrations: [
        {
          version: 2,
          migrate: (old) => {
            const o = old as Record<string, unknown>;
            return { ...o, count: 99 };
          },
        },
      ],
      parse: parseDoc,
    });
    const doc = await storeV2.load();
    expect(doc.count).toBe(99);
    expect(doc.name).toBe('v1');
  });
});

describe('createDocumentStore — corrupt-data fallback', () => {
  test('unparseable JSON falls back silently to parse(undefined)', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('test:doc', 'not-valid-json{{{');

    const store = makeStore(adapter);
    const doc = await store.load();
    expect(doc).toEqual(defaultDoc());
  });

  test('valid JSON that is not an envelope falls back silently', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('test:doc', JSON.stringify({ wrong: 'shape' }));

    const store = makeStore(adapter);
    const doc = await store.load();
    expect(doc).toEqual(defaultDoc());
  });
});

describe('createDocumentStore — exportJSON / importJSON', () => {
  test('exportJSON before load() throws', () => {
    expect(() => makeStore().exportJSON()).toThrow('called before load()');
  });

  test('export → import round-trip restores value on a fresh store', async () => {
    const store = makeStore();
    await store.load();
    await store.save({ name: 'exported', count: 3, active: true });

    const json = store.exportJSON();

    const adapter2 = createMemoryAdapter();
    const store2 = createDocumentStore<TestDoc>({
      adapter: adapter2,
      key: 'test:doc',
      version: 1,
      parse: parseDoc,
    });
    const imported = await store2.importJSON(json);
    expect(imported).toEqual({ name: 'exported', count: 3, active: true });
    expect(store2.get()).toEqual(imported);
  });

  test('importJSON persists so a subsequent load() sees the value', async () => {
    const store = makeStore();
    await store.load();
    await store.save({ name: 'orig', count: 5, active: false });
    const json = store.exportJSON();

    const adapter2 = createMemoryAdapter();
    const storeA = createDocumentStore<TestDoc>({
      adapter: adapter2,
      key: 'test:doc',
      version: 1,
      parse: parseDoc,
    });
    await storeA.importJSON(json);

    const storeB = createDocumentStore<TestDoc>({
      adapter: adapter2,
      key: 'test:doc',
      version: 1,
      parse: parseDoc,
    });
    const loaded = await storeB.load();
    expect(loaded).toEqual({ name: 'orig', count: 5, active: false });
  });

  test('importJSON with corrupt JSON falls back to parse(undefined) and persists', async () => {
    const adapter = createMemoryAdapter();
    const store = makeStore(adapter);
    const imported = await store.importJSON('not-valid-json{{{');
    expect(imported).toEqual(defaultDoc());
    expect(store.get()).toEqual(defaultDoc());

    const store2 = makeStore(adapter);
    expect(await store2.load()).toEqual(defaultDoc());
  });
});
