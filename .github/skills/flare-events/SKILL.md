---
name: flare-events
description: Deep knowledge of the @flare-engine/events package — EventEmitter and Signal. Use when wiring type-safe events, pub/sub patterns, game-event dispatch, signal-based communication, or one-shot listener registration in Flare.
---

# `@flare-engine/events`

Layer 0. Zero dependencies. `<1KB` gzip. Two tiny primitives — use `EventEmitter` for many event types, `Signal` for a single event stream.

## Exports

```ts
import { EventEmitter, Signal } from "@flare-engine/events";
import type { EventMap, Unsubscribe } from "@flare-engine/events";
```

## EventEmitter

```ts
type Events = {
  hit: [entityId: number, damage: number];
  died: [entityId: number];
};
const bus = new EventEmitter<Events>();
const off = bus.on("hit", (id, dmg) => {
  /* ... */
});
bus.emit("hit", 42, 10);
off();
```

Methods: `on`, `once`, `off`, `emit`, `removeAll(event?)`. `on` and `once` return an `Unsubscribe` function — prefer it over `off` for scoped cleanup.

## Signal

Zero-alloc `emit()` via deferred-remove. Use for hot per-frame signals (collision start, tick, etc.):

```ts
const onTick = new Signal<number>();
onTick.add((dt) => {
  /* ... */
});
onTick.emit(0.016);
```

Methods: `add`, `remove`, `once`, `emit`, `clear`.

## Pitfall

- Adding/removing a listener _during_ `emit()` is safe (deferred), but listeners added during the same `emit` won't fire until the next call.

Spec: [docs/design/api-specs.md § @flare-engine/events](../../../docs/design/api-specs.md).
