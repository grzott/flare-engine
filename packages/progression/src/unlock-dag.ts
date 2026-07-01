/**
 * Prerequisite DAG for unlock/progression graphs.
 *
 * The graph is directed and acyclic by construction (caller contract — no runtime cycle
 * detection). Nodes are string ids; edges are "requires" lists.
 */

export interface DagNode {
  /** Unique string id for this node. */
  readonly id: string;
  /** Ids of nodes that must be in the cleared set before this node unlocks. */
  readonly requires: readonly string[];
}

export interface UnlockDag {
  readonly nodes: ReadonlyMap<string, DagNode>;
  /**
   * Whether `id` is unlocked given the set of cleared (previously unlocked) ids.
   * A node with no requirements is always unlocked.
   * An unknown id returns false.
   */
  isUnlocked(cleared: ReadonlySet<string>, id: string): boolean;
  /**
   * The frontier: all nodes whose requirements are fully satisfied by `cleared`,
   * but which are NOT yet in `cleared`. Returned as a sorted array (stable
   * insertion order from `nodes`).
   */
  frontier(cleared: ReadonlySet<string>): readonly string[];
  /**
   * All nodes currently unlocked by `cleared` (including those already in
   * `cleared`). Returned as a sorted array (stable insertion order).
   */
  allUnlocked(cleared: ReadonlySet<string>): readonly string[];
}

/**
 * Creates an `UnlockDag` from `nodes`.
 * Duplicate ids throw. Unknown `requires` ids are silently tolerated — a node
 * whose prerequisite id doesn't exist in the graph is simply never satisfiable.
 */
export function createUnlockDag(nodes: readonly DagNode[]): UnlockDag {
  const map = new Map<string, DagNode>();
  for (const node of nodes) {
    if (map.has(node.id)) {
      throw new Error(`createUnlockDag: duplicate node id "${node.id}"`);
    }
    map.set(node.id, node);
  }

  function isUnlocked(cleared: ReadonlySet<string>, id: string): boolean {
    const node = map.get(id);
    if (!node) return false;
    for (const req of node.requires) {
      if (!cleared.has(req)) return false;
    }
    return true;
  }

  function frontier(cleared: ReadonlySet<string>): readonly string[] {
    const out: string[] = [];
    for (const [id] of map) {
      if (!cleared.has(id) && isUnlocked(cleared, id)) {
        out.push(id);
      }
    }
    return out;
  }

  function allUnlocked(cleared: ReadonlySet<string>): readonly string[] {
    const out: string[] = [];
    for (const [id] of map) {
      if (isUnlocked(cleared, id)) {
        out.push(id);
      }
    }
    return out;
  }

  return { nodes: map, isUnlocked, frontier, allUnlocked };
}
