import { expect, test } from 'bun:test';
import { join } from 'node:path';

const CREDITS_PATH = join(import.meta.dir, '..', 'CREDITS.md');

test('CREDITS.md exists', async () => {
  const file = Bun.file(CREDITS_PATH);
  expect(await file.exists()).toBe(true);
});

test('CREDITS.md contains all 5 required section headers', async () => {
  const file = Bun.file(CREDITS_PATH);
  const text = await file.text();
  expect(text).toContain('## Engine packages');
  expect(text).toContain('## Runtime libraries');
  expect(text).toContain('## Assets');
  expect(text).toContain('## Font');
  expect(text).toContain('## Contributors');
});

test('CREDITS.md length is greater than 100 characters', async () => {
  const file = Bun.file(CREDITS_PATH);
  const text = await file.text();
  expect(text.length).toBeGreaterThan(100);
});
