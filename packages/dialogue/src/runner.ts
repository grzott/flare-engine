/**
 * Dialogue runner — walks a DialogueGraph, evaluating conditions,
 * interpolating variables, and emitting signals for each step.
 */

import { Signal } from '@flare-engine/events';
import type { ChoiceNode, DialogueGraph, LineNode } from './graph.js';
import { getNode } from './graph.js';

// ─── Error ───────────────────────────────────────────────────────

export type DialogueErrorCode = 'missing-node' | 'cycle';

export class DialogueError extends Error {
  readonly code: DialogueErrorCode;
  /** Source node whose transition triggered the error (or the entry id when there is no source). */
  readonly nodeId: string;
  /** 'missing-node': the target id that could not be resolved. */
  readonly missingId?: string;
  /** 'cycle': the node-id chain walked before the step budget was exceeded. */
  readonly chain?: readonly string[];

  constructor(
    code: DialogueErrorCode,
    message: string,
    detail: { nodeId: string; missingId?: string; chain?: readonly string[] },
  ) {
    super(message);
    this.name = 'DialogueError';
    this.code = code;
    this.nodeId = detail.nodeId;
    this.missingId = detail.missingId;
    this.chain = detail.chain;
  }
}

// ─── Types ───────────────────────────────────────────────────────

export type ConditionResolver = (key: string) => boolean;
export type ActionHandler = (key: string) => void | Promise<void>;
export type VariableBag = Record<string, string | number>;

export interface DialogueLineEvent {
  readonly speaker: string;
  /** Optional portrait key forwarded verbatim from the source LineNode. */
  readonly speakerPortraitKey?: string;
  readonly text: string;
  readonly nodeId: string;
}

export interface DialogueChoiceEvent {
  readonly prompt: string | undefined;
  readonly speaker: string | undefined;
  readonly options: readonly ActiveOption[];
  readonly nodeId: string;
}

export interface ActiveOption {
  readonly index: number;
  readonly text: string;
  readonly next: string;
}

export type DialogueRunnerState = 'idle' | 'running' | 'waiting-choice' | 'ended';

// ─── Interpolation ───────────────────────────────────────────────

export function interpolate(template: string, vars: VariableBag): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const val = Object.hasOwn(vars, key) ? vars[key] : undefined;
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

// ─── Runner ──────────────────────────────────────────────────────

export interface DialogueRunner {
  readonly onLine: Signal<DialogueLineEvent>;
  readonly onChoice: Signal<DialogueChoiceEvent>;
  readonly onAction: Signal<string>;
  readonly onEnd: Signal<string>;

  readonly state: DialogueRunnerState;
  readonly currentNodeId: string | null;
  readonly graphId: string | null;

  start(graph: DialogueGraph, variables?: VariableBag): void;
  advance(): void;
  selectChoice(index: number): void;
  stop(): void;
}

export interface DialogueRunnerOptions {
  conditions?: ConditionResolver;
  actions?: ActionHandler;
  /**
   * Invoked on a recoverable dialogue error — currently a transition to a
   * missing node. Default (no hook): logs a console.warn, then ends.
   */
  onError?: (err: DialogueError) => void;
}

const STEP_BUDGET = 1000;

export function createDialogueRunner(options?: DialogueRunnerOptions): DialogueRunner {
  const onLine = new Signal<DialogueLineEvent>();
  const onChoice = new Signal<DialogueChoiceEvent>();
  const onAction = new Signal<string>();
  const onEnd = new Signal<string>();

  const conditions = options?.conditions ?? (() => true);
  const actions = options?.actions;
  const onError = options?.onError;

  let _state: DialogueRunnerState = 'idle';
  let _graph: DialogueGraph | null = null;
  let _currentNodeId: string | null = null;
  let _vars: VariableBag = {};
  let _activeOptions: ActiveOption[] = [];

  function setState(s: DialogueRunnerState): void {
    _state = s;
  }

  function end(): void {
    setState('ended');
    const graphId = _graph?.id ?? '';
    _currentNodeId = null;
    onEnd.emit(graphId);
  }

  function reportMissing(fromNodeId: string | null, missingId: string): void {
    const graphId = _graph?.id ?? '';
    const from = fromNodeId ? ` from node '${fromNodeId}'` : ' as its start node';
    const err = new DialogueError(
      'missing-node',
      `Dialogue '${graphId}' references missing node '${missingId}'${from} — ending conversation.`,
      { nodeId: fromNodeId ?? missingId, missingId },
    );
    if (onError) onError(err);
    else console.warn(err.message);
  }

  function processLine(node: LineNode, nodeId: string): void {
    setState('running');
    const text = interpolate(node.text, _vars);
    onLine.emit({
      speaker: node.speaker,
      speakerPortraitKey: node.speakerPortraitKey,
      text,
      nodeId,
    });
  }

  function processChoice(node: ChoiceNode, nodeId: string): void {
    _activeOptions = [];
    for (let i = 0; i < node.options.length; i++) {
      const opt = node.options[i]!;
      if (opt.condition && !conditions(opt.condition)) continue;
      _activeOptions.push({
        index: _activeOptions.length,
        text: interpolate(opt.text, _vars),
        next: opt.next,
      });
    }

    if (_activeOptions.length === 0) {
      end();
      return;
    }

    setState('waiting-choice');
    onChoice.emit({
      prompt: node.prompt ? interpolate(node.prompt, _vars) : undefined,
      speaker: node.speaker,
      options: _activeOptions,
      nodeId,
    });
  }

  function run(entryId: string, fromNodeId: string | null): void {
    if (!_graph) return;

    let currentId: string | null = entryId;
    let from: string | null = fromNodeId;
    const chain: string[] = [];
    let steps = 0;

    while (currentId !== null) {
      const nodeId = currentId;
      const node = getNode(_graph, nodeId);

      if (!node) {
        reportMissing(from, nodeId);
        end();
        return;
      }

      chain.push(nodeId);
      if (++steps > STEP_BUDGET) {
        throw new DialogueError(
          'cycle',
          `Dialogue '${_graph.id}' cycle detected — step budget exceeded (chain: …${chain.slice(-12).join('→')})`,
          { nodeId, chain: chain.slice() },
        );
      }

      _currentNodeId = nodeId;
      from = nodeId;

      switch (node.kind) {
        case 'line':
          processLine(node, nodeId);
          return;
        case 'choice':
          processChoice(node, nodeId);
          return;
        case 'branch': {
          let next: string | null = node.fallback;
          for (const arm of node.arms) {
            if (conditions(arm.condition)) {
              next = arm.next;
              break;
            }
          }
          currentId = next;
          break;
        }
        case 'action':
          onAction.emit(node.action);
          actions?.(node.action);
          currentId = node.next;
          break;
        case 'end':
          end();
          return;
      }
    }

    end();
  }

  const runner: DialogueRunner = {
    onLine,
    onChoice,
    onAction,
    onEnd,

    get state() {
      return _state;
    },
    get currentNodeId() {
      return _currentNodeId;
    },
    get graphId() {
      return _graph?.id ?? null;
    },

    start(graph: DialogueGraph, variables?: VariableBag): void {
      _graph = graph;
      _vars = variables ?? {};
      _activeOptions = [];
      setState('running');
      run(graph.start, null);
    },

    advance(): void {
      if (_state !== 'running' || !_graph || !_currentNodeId) return;
      const node = getNode(_graph, _currentNodeId);
      if (!node || node.kind !== 'line') return;
      if (node.next) {
        run(node.next, _currentNodeId);
      } else {
        end();
      }
    },

    selectChoice(index: number): void {
      if (_state !== 'waiting-choice') return;
      const opt = _activeOptions[index];
      if (!opt) return;
      _activeOptions = [];
      setState('running');
      run(opt.next, _currentNodeId);
    },

    stop(): void {
      setState('idle');
      _graph = null;
      _currentNodeId = null;
      _vars = {};
      _activeOptions = [];
    },
  };

  return runner;
}
