# @flare-engine/events

Type-safe event primitives — `EventEmitter<EventMap>` for keyed events and `Signal<T>` for single-payload broadcast. Both support `once()`, deferred-remove during `emit()`, and zero-alloc `Unsubscribe` returns.

## Install

```sh
bun add @flare-engine/events
```

## Usage

```ts
import { EventEmitter, Signal } from '@flare-engine/events';

type GameEvents = { 'enemy-killed': { id: number; score: number } };
const bus = new EventEmitter<GameEvents>();
const off = bus.on('enemy-killed', (e) => console.log(e.score));

const onHit = new Signal<number>();
onHit.add((dmg) => console.log(dmg));
onHit.emit(10);
```

See [API spec](../../docs/design/api-specs.md#flare-engineevents--1kb-gzip).

## License

MIT
