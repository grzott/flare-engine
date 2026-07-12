# @flare-engine/events

Type-safe event primitives — `EventEmitter<EventMap>` for keyed events and `Signal<T>` for single-payload broadcast. Both support `once()`, deferred-remove during `emit()`, and zero-alloc `Unsubscribe` returns.

## Install

```sh
bun add @flare-engine/events
```

## Usage

```ts
import { EventEmitter, Signal } from '@flare-engine/events';

type GameEvents = { 'enemy-killed': (e: { id: number; score: number }) => void };
const bus = new EventEmitter<GameEvents>();
const off = bus.on('enemy-killed', (e) => console.log(e.score));

const onHit = new Signal<number>();
onHit.add((dmg) => console.log(dmg));
onHit.emit(10);
```

## Emit semantics

`emit()` iterates the handler set **live** (no per-emit snapshot — this is a hot path):

- A handler **added** during an emit runs in that **same** emit.
- A handler **removed** during an emit still runs for that emit (and any nested emit); the removal takes effect once the outermost emit completes.
- `emit()` is **re-entrant** (a handler may call `emit()` again) and **throw-safe**: a throwing handler propagates to the caller but never wedges deferred removal.

See [API spec](https://github.com/grzott/flare-engine/blob/main/docs/design/api-specs.md#flare-engineevents--1kb-gzip).

## License

MIT
