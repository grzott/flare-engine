import { describe, expect, it } from 'bun:test';
import { stateChanged } from '../state';
import { batchStateNotify, requestStateNotify } from './state-batch';

describe('batchStateNotify', () => {
  it('emits once per batch regardless of request count', () => {
    let count = 0;
    const unsub = stateChanged.add(() => {
      count++;
    });
    batchStateNotify(() => {
      requestStateNotify();
      requestStateNotify();
      requestStateNotify();
    });
    unsub();
    expect(count).toBe(1);
  });

  it('does not emit when no request is made', () => {
    let count = 0;
    const unsub = stateChanged.add(() => {
      count++;
    });
    batchStateNotify(() => {
      // no requests
    });
    unsub();
    expect(count).toBe(0);
  });

  it('nested batches emit once at outermost exit', () => {
    let count = 0;
    const unsub = stateChanged.add(() => {
      count++;
    });
    batchStateNotify(() => {
      requestStateNotify();
      batchStateNotify(() => {
        requestStateNotify();
      });
      expect(count).toBe(0);
    });
    unsub();
    expect(count).toBe(1);
  });

  it('requestStateNotify outside a batch emits immediately', () => {
    let count = 0;
    const unsub = stateChanged.add(() => {
      count++;
    });
    requestStateNotify();
    unsub();
    expect(count).toBe(1);
  });
});
