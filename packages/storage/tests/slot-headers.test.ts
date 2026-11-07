import { describe, expect, spyOn, test } from 'bun:test';
import type { StorageAdapter } from '../src/adapter.js';
import { createMemoryAdapter } from '../src/memory-adapter.js';
import type { Migration } from '../src/migrations.js';
import { san } from '../src/sanitize.js';
import { s } from '../src/schema.js';
import type { SlotHeader, Storage } from '../src/storage.js';
import { createStorage } from '../src/storage.js';

interface Player {
  name: string;
  hp: number;
}

interface MenuHeader {
  day: number;
  zone: string;
}

const hero: Player = { name: 'hero', hp: 10 };

function playerSchema() {
  return s.object({ name: s.string(), hp: s.number() });
}

const menuHeader = san.object({ day: san.number(0), zone: san.string('unknown') });

function withGet(
  base: StorageAdapter,
  get: (key: string) => Promise<string | null>,
): StorageAdapter {
  return { ...base, get };
}

describe('createStorage — slot headers', () => {
  test('header round-trips through listSlotHeaders without loading the slot', async () => {
    const schema = playerSchema();
    const parse = spyOn(schema, 'parse');
    const storage = createStorage({ adapter: createMemoryAdapter(), schema, version: 1 });
    await storage.saveSlot('auto', hero, { day: 12, zone: 'Kaszuby' });
    expect(parse).toHaveBeenCalledTimes(1);

    parse.mockClear();
    const headers = await storage.listSlotHeaders();
    expect(headers).toEqual([{ name: 'auto', version: 1, header: { day: 12, zone: 'Kaszuby' } }]);
    expect(parse).toHaveBeenCalledTimes(0);
  });

  test('slot saved without a header lists header null with its version', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 3,
    });
    await storage.saveSlot('plain', hero);
    expect(await storage.listSlotHeaders()).toEqual([{ name: 'plain', version: 3, header: null }]);
  });

  test('slot written in the pre-header envelope format lists header null', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('slot:legacy', JSON.stringify({ version: 1, data: hero }));
    const storage = createStorage({ adapter, schema: playerSchema(), version: 1 });
    expect(await storage.listSlotHeaders()).toEqual([{ name: 'legacy', version: 1, header: null }]);
  });

  test('overwriting a slot without a header drops its previous header', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
    });
    await storage.saveSlot('auto', hero, { day: 1, zone: 'a' });
    await storage.saveSlot('auto', hero);
    expect(await storage.listSlotHeaders()).toEqual([{ name: 'auto', version: 1, header: null }]);
  });

  test('malformed slots list as version null / header null while others still list', async () => {
    const memory = createMemoryAdapter();
    const adapter = withGet(memory, (key) =>
      key === 'slot:rejects' ? Promise.reject(new Error('disk')) : memory.get(key),
    );
    await memory.set('slot:not-json', '{nope');
    await memory.set('slot:not-envelope', JSON.stringify({ not: 'an envelope' }));
    await memory.set('slot:bad-version', JSON.stringify({ version: '1', data: hero }));
    await memory.set('slot:rejects', JSON.stringify({ version: 1, data: hero }));
    await memory.set('unrelated', 'ignore-me');
    const storage = createStorage({ adapter, schema: playerSchema(), version: 1 });
    await storage.saveSlot('good', hero, { day: 2, zone: 'b' });

    const headers = await storage.listSlotHeaders();
    expect(headers.map((h) => h.name).sort()).toEqual([
      'bad-version',
      'good',
      'not-envelope',
      'not-json',
      'rejects',
    ]);
    for (const h of headers) {
      if (h.name === 'good') {
        expect(h).toEqual({ name: 'good', version: 1, header: { day: 2, zone: 'b' } });
      } else {
        expect(h).toEqual({ name: h.name, version: null, header: null });
      }
    }
  });

  test('a key that vanishes between keys() and get() lists as null / null', async () => {
    const memory = createMemoryAdapter();
    const adapter: StorageAdapter = {
      ...memory,
      keys: async () => [...(await memory.keys()), 'slot:ghost'],
    };
    const storage = createStorage({ adapter, schema: playerSchema(), version: 1 });
    await storage.saveSlot('real', hero, { day: 5, zone: 'c' });
    expect(await storage.listSlotHeaders()).toEqual([
      { name: 'real', version: 1, header: { day: 5, zone: 'c' } },
      { name: 'ghost', version: null, header: null },
    ]);
  });

  test('runs neither schema nor migrations, while loadSlot still migrates', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set(
      'slot:old',
      JSON.stringify({ version: 1, data: { name: 'hero' }, header: { day: 9, zone: 'd' } }),
    );
    const schema = playerSchema();
    const parse = spyOn(schema, 'parse');
    const step: Migration = { version: 2, migrate: (d) => ({ ...(d as object), hp: 100 }) };
    const migrate = spyOn(step, 'migrate');
    const storage = createStorage({ adapter, schema, version: 2, migrations: [step] });

    expect(await storage.listSlotHeaders()).toEqual([
      { name: 'old', version: 1, header: { day: 9, zone: 'd' } },
    ]);
    expect(parse).toHaveBeenCalledTimes(0);
    expect(migrate).toHaveBeenCalledTimes(0);

    expect(await storage.loadSlot('old')).toEqual({ name: 'hero', hp: 100 });
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  test('exportJSON / importJSON round-trip headers', async () => {
    const src = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
    });
    await src.saveSlot('one', hero, { day: 1, zone: 'a' });
    await src.saveSlot('two', hero);
    const json = await src.exportJSON();

    const dst = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
    });
    await dst.importJSON(json);
    expect(await dst.listSlotHeaders()).toEqual([
      { name: 'one', version: 1, header: { day: 1, zone: 'a' } },
      { name: 'two', version: 1, header: null },
    ]);
  });

  test('header-less saveSlot writes exactly the pre-header envelope string', async () => {
    const adapter = createMemoryAdapter();
    const storage = createStorage({ adapter, schema: playerSchema(), version: 2 });
    await storage.saveSlot('auto', hero);
    expect(await adapter.get('slot:auto')).toBe(JSON.stringify({ version: 2, data: hero }));

    await storage.saveSlot('auto', hero, { day: 1, zone: 'a' });
    expect(await adapter.get('slot:auto')).toBe(
      JSON.stringify({ version: 2, data: hero, header: { day: 1, zone: 'a' } }),
    );
  });

  test('unserialisable header rejects saveSlot before anything is written', async () => {
    const adapter = createMemoryAdapter();
    const storage = createStorage({ adapter, schema: playerSchema(), version: 1 });
    await expect(storage.saveSlot('big', hero, { n: 10n })).rejects.toThrow();
    expect(await adapter.get('slot:big')).toBeNull();
    expect(await adapter.get('__flare_version')).toBeNull();

    await storage.saveSlot('keep', hero, { day: 1 });
    const before = await adapter.get('slot:keep');
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    await expect(storage.saveSlot('keep', { name: 'changed', hp: 0 }, cycle)).rejects.toThrow();
    expect(await adapter.get('slot:keep')).toBe(before);
    expect(await adapter.get('__flare_version')).toBe('1');
  });

  test('parseHeader repairs a stale-shaped header', async () => {
    const adapter = createMemoryAdapter();
    await adapter.set('slot:old', JSON.stringify({ version: 1, data: hero, header: { day: 3 } }));
    const storage = createStorage({
      adapter,
      schema: playerSchema(),
      version: 1,
      parseHeader: menuHeader,
    });
    expect(await storage.listSlotHeaders()).toEqual([
      { name: 'old', version: 1, header: { day: 3, zone: 'unknown' } },
    ]);
  });

  test('a throwing parseHeader yields header null for that slot only', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
      parseHeader: (input: unknown): MenuHeader => {
        const h = menuHeader(input);
        if (h.day === 13) throw new Error('unlucky');
        return h;
      },
    });
    await storage.saveSlot('fine', hero, { day: 1, zone: 'a' });
    await storage.saveSlot('cursed', hero, { day: 13, zone: 'b' });
    expect(await storage.listSlotHeaders()).toEqual([
      { name: 'fine', version: 1, header: { day: 1, zone: 'a' } },
      { name: 'cursed', version: 1, header: null },
    ]);
  });

  test('parseHeader is not called for a slot without a header', async () => {
    let calls = 0;
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
      parseHeader: (input: unknown) => {
        calls++;
        return menuHeader(input);
      },
    });
    await storage.saveSlot('plain', hero);
    await storage.saveSlot('headed', hero, { day: 2, zone: 'b' });
    expect(await storage.listSlotHeaders()).toEqual([
      { name: 'plain', version: 1, header: null },
      { name: 'headed', version: 1, header: { day: 2, zone: 'b' } },
    ]);
    expect(calls).toBe(1);
  });

  test('rejects when adapter.keys() rejects', async () => {
    const memory = createMemoryAdapter();
    const adapter: StorageAdapter = { ...memory, keys: () => Promise.reject(new Error('disk')) };
    const storage = createStorage({ adapter, schema: playerSchema(), version: 1 });
    await expect(storage.listSlotHeaders()).rejects.toThrow('disk');
  });

  test('listSlots still returns names only', async () => {
    const storage = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
    });
    await storage.saveSlot('one', hero, { day: 1, zone: 'a' });
    await storage.saveSlot('two', hero);
    expect((await storage.listSlots()).sort()).toEqual(['one', 'two']);
  });
});

describe('createStorage — slot header types', () => {
  test('existing Storage<T> annotation compiles and H defaults to unknown', async () => {
    const st: Storage<Player> = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
    });
    await st.saveSlot('a', hero, 'any json value');
    const first: SlotHeader<unknown> | undefined = (await st.listSlotHeaders())[0];
    expect(first?.header).toBe('any json value');
  });

  test('H infers from parseHeader without explicit generics', async () => {
    const st = createStorage({
      adapter: createMemoryAdapter(),
      schema: playerSchema(),
      version: 1,
      parseHeader: menuHeader,
    });
    const header: MenuHeader = { day: 4, zone: 'e' };
    await st.saveSlot('a', hero, header);
    const listed: MenuHeader | null | undefined = (await st.listSlotHeaders())[0]?.header;
    expect(listed?.day).toBe(4);
    const typed: SlotHeader<MenuHeader>[] = await st.listSlotHeaders();
    expect(typed[0]?.header?.zone).toBe('e');
  });
});
