import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
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
 */
export function FlarePresence({ children }: { children?: ReactNode }): ReactNode {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const entries = useRef<Entry[]>([]);
  const serial = useRef(0);

  const previous = entries.current;
  const merged: Entry[] = [];
  const present = new Set<string>();

  for (const node of Children.toArray(children)) {
    if (!isValidElement(node) || node.key === null) {
      merged.push({
        key: null,
        id: `text:${merged.length}`,
        node,
        value: { isPresent: true, release: noop },
      });
      continue;
    }
    const key = node.key;
    present.add(key);
    const kept = previous.find((entry) => entry.key === key);
    if (kept !== undefined) {
      kept.node = node;
      if (!kept.value.isPresent) kept.value = { isPresent: true, release: kept.value.release };
      merged.push(kept);
      continue;
    }
    const entry: Entry = {
      key,
      id: `${key}:${serial.current++}`,
      node,
      value: {
        isPresent: true,
        release() {
          // Only a removed child can be released; a present one stays whatever it asks.
          if (entry.value.isPresent) return;
          const at = entries.current.indexOf(entry);
          if (at === -1) return;
          entries.current.splice(at, 1);
          rerender();
        },
      },
    };
    merged.push(entry);
  }

  // A removed child stays right after the nearest earlier child that is still rendered.
  let after = -1;
  for (const entry of previous) {
    if (entry.key === null) continue;
    if (!present.has(entry.key)) {
      if (entry.value.isPresent) entry.value = { isPresent: false, release: entry.value.release };
      merged.splice(after + 1, 0, entry);
    }
    after = merged.indexOf(entry);
  }
  entries.current = merged;

  return merged.map((entry) => (
    <PresenceContext.Provider key={entry.id} value={entry.value}>
      {entry.node}
    </PresenceContext.Provider>
  ));
}
