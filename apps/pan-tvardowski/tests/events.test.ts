import { describe, expect, test } from 'bun:test';
import { EventEmitter } from '@flare-engine/events';
import { type GameEventMap, gameEvents } from '../src/events';

describe('gameEvents bus', () => {
  test('zone-complete delivers zone + score to subscribers', () => {
    const seen: [string, number][] = [];
    const off = gameEvents.on('zone-complete', (zone, score) => {
      seen.push([zone, score]);
    });
    gameEvents.emit('zone-complete', 'z1', 1234);
    gameEvents.emit('zone-complete', 'z2', 9999);
    off();
    gameEvents.emit('zone-complete', 'z2', -1);
    expect(seen).toEqual([
      ['z1', 1234],
      ['z2', 9999],
    ]);
  });

  test('miniboss-defeated is typed to ZoneId', () => {
    const bus = new EventEmitter<GameEventMap>();
    const zones: string[] = [];
    bus.on('miniboss-defeated', (z) => zones.push(z));
    bus.emit('miniboss-defeated', 'z2');
    expect(zones).toEqual(['z2']);
  });
});
