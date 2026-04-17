/** A state in the FSM. */
export interface State<C = undefined> {
  readonly name: string;
  onEnter?(context: C): void;
  onExit?(context: C): void;
  onUpdate?(dt: number, context: C): void;
}

/**
 * Lightweight finite state machine. ~100 LOC.
 *
 * Manages named states with onEnter/onExit/onUpdate hooks
 * and string-keyed transitions.
 */
export class FSM<C = undefined> {
  private _current: State<C> | undefined;
  private _states = new Map<string, State<C>>();
  private _transitions = new Map<string, Map<string, string>>();
  private _context: C;

  constructor(...args: C extends undefined ? [] : [context: C]) {
    this._context = args[0] as C;
  }

  /** The currently active state, or undefined if none. */
  get current(): State<C> | undefined {
    return this._current;
  }

  /** Register a state. */
  addState(state: State<C>): this {
    this._states.set(state.name, state);
    return this;
  }

  /**
   * Register a transition.
   * When `trigger` fires in `fromState`, transition to `toState`.
   */
  addTransition(fromState: string, trigger: string, toState: string): this {
    let map = this._transitions.get(fromState);
    if (!map) {
      map = new Map();
      this._transitions.set(fromState, map);
    }
    map.set(trigger, toState);
    return this;
  }

  /** Set the initial state (calls onEnter). */
  start(stateName: string): void {
    const state = this._states.get(stateName);
    if (!state) return;
    this._current = state;
    state.onEnter?.(this._context);
  }

  /** Fire a trigger. If a matching transition exists, switch states. */
  trigger(name: string): void {
    if (!this._current) return;
    const transitions = this._transitions.get(this._current.name);
    if (!transitions) return;
    const target = transitions.get(name);
    if (target === undefined) return;
    const next = this._states.get(target);
    if (!next) return;
    this._current.onExit?.(this._context);
    this._current = next;
    next.onEnter?.(this._context);
  }

  /** Update the current state. */
  update(dt: number): void {
    this._current?.onUpdate?.(dt, this._context);
  }
}
