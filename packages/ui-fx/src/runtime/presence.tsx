import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useInsertionEffect,
  useReducer,
  useRef,
} from 'react';

interface PresenceValue {
  isPresent: boolean;
  release(): void;
}

interface Entry {
  /** The child's key, or `null` for a child that is not an element and so cannot be retained. */
  key: string | null;
  /** The React key it renders under. A key that returns after its release gets a new one. */
  id: string;
  node: ReactNode;
  value: PresenceValue;
  /** The mounted instance the entry belongs to; `null` for a child that is not retained. */
  instance: object | null;
}

const PresenceContext = createContext<PresenceValue | null>(null);

const noop = (): void => {};

/**
 * Whether the nearest `FlarePresence` still has this child among its children, and the function
 * that lets it unmount once it does not. Outside a `FlarePresence` the child is always present
 * and `release` does nothing.
 */
export function usePresence(): [isPresent: boolean, release: () => void] {
  const value = useContext(PresenceContext);
  return value === null ? [true, noop] : [value.isPresent, value.release];
}

/**
 * Keeps a removed keyed child mounted, with `usePresence()[0]` false, until its `release` runs.
 * A key that comes back before then keeps its instance; one that comes back after mounts anew.
 *
 * A render derives its entries from the last committed ones and changes nothing; they are recorded
 * when the render commits, in an insertion effect. A render React discards (an interrupted or
 * suspended transition) therefore leaves no trace: no child it saw arrive or leave outlives it.
 */
export function FlarePresence({ children }: { children?: ReactNode }): ReactNode {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const committed = useRef<readonly Entry[]>([]);
  const releasedRef = useRef<WeakSet<object> | null>(null);
  releasedRef.current ??= new WeakSet();
  const released = releasedRef.current;
  // Only ever increases, so an id a discarded render took is simply never used.
  const serial = useRef(0);

  const previous = committed.current.filter(
    (entry) => entry.instance === null || !released.has(entry.instance),
  );
  const merged: Entry[] = [];
  const present = new Set<string>();

  for (const node of Children.toArray(children)) {
    if (!isValidElement(node) || node.key === null) {
      merged.push({
        key: null,
        id: `text:${merged.length}`,
        node,
        value: { isPresent: true, release: noop },
        instance: null,
      });
      continue;
    }
    const key = node.key;
    present.add(key);
    const kept = previous.find((entry) => entry.key === key);
    if (kept !== undefined) {
      const value = kept.value.isPresent
        ? kept.value
        : { isPresent: true, release: kept.value.release };
      merged.push({ ...kept, node, value });
      continue;
    }
    const instance = {};
    merged.push({
      key,
      id: `${key}:${serial.current++}`,
      node,
      value: {
        isPresent: true,
        release() {
          // Only a committed removed child can be released; a present one stays whatever it asks.
          const entry = committed.current.find((e) => e.instance === instance);
          if (entry === undefined || entry.value.isPresent || released.has(instance)) return;
          released.add(instance);
          rerender();
        },
      },
      instance,
    });
  }

  // A removed child stays right after the nearest earlier child that is still rendered.
  let after = -1;
  for (const entry of previous) {
    if (entry.key === null) continue;
    if (!present.has(entry.key)) {
      const value = entry.value.isPresent
        ? { isPresent: false, release: entry.value.release }
        : entry.value;
      merged.splice(after + 1, 0, { ...entry, value });
    }
    after = merged.findIndex((e) => e.instance === entry.instance);
  }

  // An insertion effect runs before every layout effect of the commit, so a child that asks for
  // its release from its own layout effect in this commit (a press exit whose key the caller just
  // dropped) already sees this render's entries.
  useInsertionEffect(() => {
    committed.current = merged;
  });

  return merged.map((entry) => (
    <PresenceContext.Provider key={entry.id} value={entry.value}>
      {entry.node}
    </PresenceContext.Provider>
  ));
}
