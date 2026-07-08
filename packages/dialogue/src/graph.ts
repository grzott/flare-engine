/**
 * Dialogue graph data types.
 *
 * A dialogue graph is a directed graph of nodes. Each node is one of:
 * - `line`: NPC/character speaks. Optional `next` pointer.
 * - `choice`: Player picks from options. Each option points to a node.
 * - `branch`: Condition-based routing. First truthy condition wins.
 * - `action`: Fires a callback, then advances to `next`.
 * - `end`: Terminal node. Conversation stops.
 *
 * Graphs are plain JSON — no classes, no runtime coupling.
 */

// ─── Node types ──────────────────────────────────────────────────

export interface LineNode {
  readonly kind: 'line';
  /** Speaker name / id. */
  readonly speaker: string;
  /**
   * Optional portrait key resolved by the UI layer to an avatar image /
   * shape / atlas frame. The dialogue runtime is portrait-agnostic — it
   * forwards the key via `DialogueLineEvent.speakerPortraitKey`.
   */
  readonly speakerPortraitKey?: string;
  /** Text template. Supports `{var}` interpolation via the runner's variable bag. */
  readonly text: string;
  /** Next node id, or null to end. */
  readonly next: string | null;
}

export interface ChoiceOption {
  /** Display text. Supports `{var}` interpolation. */
  readonly text: string;
  /** Node id to jump to when selected. */
  readonly next: string;
  /** Optional condition key — option is hidden when condition returns false. */
  readonly condition?: string;
}

export interface ChoiceNode {
  readonly kind: 'choice';
  /** Optional prompt text before the choices. */
  readonly prompt?: string;
  /** Speaker for the prompt, if any. */
  readonly speaker?: string;
  readonly options: readonly ChoiceOption[];
}

export interface BranchArm {
  /** Condition key evaluated by the runner's condition resolver. */
  readonly condition: string;
  /** Node id to jump to when condition is true. */
  readonly next: string;
}

export interface BranchNode {
  readonly kind: 'branch';
  readonly arms: readonly BranchArm[];
  /** Fallback node id if no arm matches. Null → end. */
  readonly fallback: string | null;
}

export interface ActionNode {
  readonly kind: 'action';
  /** Callback key. Runner looks this up in the action registry. */
  readonly action: string;
  /** Next node id after the action fires. */
  readonly next: string | null;
}

export interface EndNode {
  readonly kind: 'end';
}

export type DialogueNode = LineNode | ChoiceNode | BranchNode | ActionNode | EndNode;

// ─── Graph ───────────────────────────────────────────────────────

export interface DialogueGraph {
  /** Unique graph identifier. */
  readonly id: string;
  /** Node id to start from. */
  readonly start: string;
  /** All nodes keyed by id. */
  readonly nodes: Record<string, DialogueNode>;
}

export function createDialogueGraph(
  id: string,
  start: string,
  nodes: Record<string, DialogueNode>,
): DialogueGraph {
  return { id, start, nodes };
}

export function getNode(graph: DialogueGraph, nodeId: string): DialogueNode | undefined {
  return Object.hasOwn(graph.nodes, nodeId) ? graph.nodes[nodeId] : undefined;
}
