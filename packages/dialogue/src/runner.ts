/**
 * Dialogue runner — walks a DialogueGraph, evaluating conditions,
 * interpolating variables, and emitting signals for each step.
 */

import { Signal } from '@flare-engine/events';
import type { ChoiceNode, DialogueGraph, LineNode } from './graph.js';
import { getNode } from './graph.js';

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
    const val = vars[key];
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
}

export function createDialogueRunner(options?: DialogueRunnerOptions): DialogueRunner {
  const onLine = new Signal<DialogueLineEvent>();
  const onChoice = new Signal<DialogueChoiceEvent>();
  const onAction = new Signal<string>();
  const onEnd = new Signal<string>();

  const conditions = options?.conditions ?? (() => true);
  const actions = options?.actions;

  let _state: DialogueRunnerState = 'idle';
  let _graph: DialogueGraph | null = null;
  let _currentNodeId: string | null = null;
  let _vars: VariableBag = {};
  let _activeOptions: ActiveOption[] = [];

  function setState(s: DialogueRunnerState): void {
    _state = s;
  }

  function processNode(nodeId: string): void {
    if (!_graph) return;
    const node = getNode(_graph, nodeId);
    if (!node) {
      end();
      return;
    }
    _currentNodeId = nodeId;

    switch (node.kind) {
      case 'line':
        processLine(node, nodeId);
        break;
      case 'choice':
        processChoice(node, nodeId);
        break;
      case 'branch':
        processBranch(node);
        break;
      case 'action':
        processAction(node);
        break;
      case 'end':
        end();
        break;
    }
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
    // Filter options by condition
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
      // No valid options — treat as end
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

  function processBranch(node: {
    arms: readonly { condition: string; next: string }[];
    fallback: string | null;
  }): void {
    for (let i = 0; i < node.arms.length; i++) {
      const arm = node.arms[i]!;
      if (conditions(arm.condition)) {
        processNode(arm.next);
        return;
      }
    }
    if (node.fallback) {
      processNode(node.fallback);
    } else {
      end();
    }
  }

  function processAction(node: { action: string; next: string | null }): void {
    onAction.emit(node.action);
    actions?.(node.action);
    if (node.next) {
      processNode(node.next);
    } else {
      end();
    }
  }

  function end(): void {
    setState('ended');
    const graphId = _graph?.id ?? '';
    _currentNodeId = null;
    onEnd.emit(graphId);
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
      processNode(graph.start);
    },

    advance(): void {
      if (_state !== 'running' || !_graph || !_currentNodeId) return;
      const node = getNode(_graph, _currentNodeId);
      if (!node || node.kind !== 'line') return;
      if (node.next) {
        processNode(node.next);
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
      processNode(opt.next);
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
