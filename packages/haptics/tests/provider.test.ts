import { describe, expect, test } from 'bun:test';
import { createNoopHapticsProvider, NoopHapticsProvider } from '../src/provider.js';

describe('NoopHapticsProvider', () => {
  test('impact resolves silently, with or without a style argument', async () => {
    expect(await NoopHapticsProvider.impact()).toBeUndefined();
    expect(await NoopHapticsProvider.impact('heavy')).toBeUndefined();
  });

  test('notification resolves silently', async () => {
    expect(await NoopHapticsProvider.notification('success')).toBeUndefined();
  });

  test('selection resolves silently', async () => {
    expect(await NoopHapticsProvider.selection()).toBeUndefined();
  });

  test('reports disabled with no backend, and setEnabled stays inert', () => {
    expect(NoopHapticsProvider.isEnabled()).toBe(false);
    NoopHapticsProvider.setEnabled(true);
    expect(NoopHapticsProvider.isEnabled()).toBe(false);
  });
});

describe('createNoopHapticsProvider', () => {
  test('cues resolve silently and fire nothing', async () => {
    const h = createNoopHapticsProvider();
    expect(await h.impact('heavy')).toBeUndefined();
    expect(await h.notification('error')).toBeUndefined();
    expect(await h.selection()).toBeUndefined();
  });

  test('defaults to disabled (matching the const)', () => {
    expect(createNoopHapticsProvider().isEnabled()).toBe(false);
  });

  test('honours an initial-enabled argument', () => {
    expect(createNoopHapticsProvider(true).isEnabled()).toBe(true);
  });

  test('setEnabled tracks real state, unlike the inert const', () => {
    const h = createNoopHapticsProvider();
    h.setEnabled(true);
    expect(h.isEnabled()).toBe(true);
    h.setEnabled(false);
    expect(h.isEnabled()).toBe(false);
  });

  test('instances are independent — no shared mutable state', () => {
    const a = createNoopHapticsProvider();
    const b = createNoopHapticsProvider();
    a.setEnabled(true);
    expect(a.isEnabled()).toBe(true);
    expect(b.isEnabled()).toBe(false);
  });
});
