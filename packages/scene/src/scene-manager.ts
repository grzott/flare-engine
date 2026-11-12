import { World } from '@flare-engine/ecs';
import { Camera2D } from '@flare-engine/render';
import type { Scene, SceneFactory } from './scene.js';
import type { Transition, TransitionState } from './transition.js';
import { noneTransition } from './transition.js';

declare const __DEV__: boolean | undefined;

export interface ScenePushOptions {
  /** Keep the scene below live: it is updated and drawn first, gets no `onExit` on push and no `onEnter` on the matching `pop()`. */
  overlay?: boolean;
}

export interface ScenePopOptions {
  /** Keep the popped scene initialized: it gets `onExit` only, and the next `push` of its name goes straight to `onEnter`. */
  keep?: boolean;
  /** Forwarded to the revealed scene's `onEnter` (dropped when the popped scene was an overlay). */
  data?: unknown;
}

/**
 * SceneManager — manages scene registration, navigation, and a scene stack.
 *
 * - `register(name, factory)` — register a scene factory
 * - `go(name, data?)` — switch to a scene (clears the stack)
 * - `push(name, data?, options?)` — push a scene onto the stack (pauses current unless `options.overlay`)
 * - `pop(options?)` — pop the top scene and resume the one below (destroys it unless `options.keep`)
 * - `update(dt)` — update the live scenes (bottom-up) and any active transition
 */
export class SceneManager {
  private _factories = new Map<string, SceneFactory>();
  private _scenes = new Map<string, Scene>();
  private _initialized = new Set<string>();
  private _stack: Scene[] = [];
  /** Parallel to `_stack`: whether the scene at that index was pushed as an overlay. */
  private _overlay: boolean[] = [];
  /** Scenes popped with `keep: true`: initialized and cached, but off the stack until pushed again. */
  private _kept = new Set<Scene>();
  private _transition: Transition = noneTransition();
  private _transitionState: TransitionState | null = null;
  private _pendingScene: Scene | null = null;
  private _pendingData: unknown = undefined;
  private _preloadResolved = true;
  private _preloadGen = 0;
  private _warnedPendingGo = false;

  /** The currently active scene (top of stack). */
  get current(): Scene | undefined {
    return this._stack.length > 0 ? this._stack[this._stack.length - 1] : undefined;
  }

  /** Number of scenes on the stack. */
  get stackSize(): number {
    return this._stack.length;
  }

  /** Whether a transition is currently in progress. */
  get isTransitioning(): boolean {
    return this._transitionState !== null;
  }

  /** Set the default transition for scene switches. */
  setTransition(transition: Transition): void {
    this._transition = transition;
  }

  /** Register a scene factory by name. */
  register(name: string, factory: SceneFactory): void {
    this._factories.set(name, factory);
  }

  /**
   * Navigate to a scene by name. Clears the entire stack.
   * Calls onExit on the current scene, onDestroy on all stacked scenes,
   * then onPreload → onInit → onEnter on the new scene.
   * A `go()` issued while an animated `go()` is still fading out supersedes
   * it: the superseded target gets `onDestroy` (never `onInit` / `onEnter`).
   */
  async go(name: string, data?: unknown): Promise<void> {
    if (!this._factories.has(name)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          `[SceneManager] go('${name}'): scene not registered. Registered: ${[...this._factories.keys()].join(', ')}`,
        );
      }
      return;
    }

    if (this._transition.duration > 0 && this.current) {
      this._discardPending();
      // Animated transition — evict target from cache first so restart
      // builds a fresh instance with a fresh World/Camera2D.
      this._scenes.delete(name);
      this._initialized.delete(name);
      const scene = this._getOrCreate(name)!;
      this._pendingScene = scene;
      this._pendingData = data;

      // Start preload concurrently with the fade-out.
      this._initialized.add(scene.name);
      this._preloadResolved = false;
      const gen = ++this._preloadGen;
      const preload = scene.onPreload?.();
      if (preload == null) {
        this._preloadResolved = true;
      } else {
        void preload.then(
          () => {
            if (gen !== this._preloadGen) return;
            this._preloadResolved = true;
            this._finishOutPhase();
          },
          (err) => {
            if (gen !== this._preloadGen) return;
            this._preloadResolved = true;
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.error(
                `[SceneManager] onPreload('${scene.name}') rejected; entering scene anyway`,
                err,
              );
            }
            this._finishOutPhase();
          },
        );
      }

      this._transitionState = this._transition.start('out');
    } else {
      // A pending animated go() is superseded; end any transition in progress
      // too, or _finishOutPhase would later replace the instant scene with the
      // stale target. Its late preload handler is harmless once the state is null.
      this._discardPending();
      this._transitionState = null;
      // Instant transition — destroy first so _getOrCreate builds fresh.
      this._teardownStack();
      const scene = this._getOrCreate(name)!;
      await this._activateScene(scene, data);
    }
  }

  /**
   * Push a scene onto the stack. The current scene gets onExit, unless
   * `options.overlay` is true — then it stays live and is updated and drawn
   * before the pushed scene. The new scene gets onPreload → onInit → onEnter.
   * Ignored while an animated `go()` is still fading out — that `go()` clears
   * the stack when the fade-out ends; nothing is called and nothing changes.
   */
  async push(name: string, data?: unknown, options?: ScenePushOptions): Promise<void> {
    if (this._refusedByPendingGo()) return;
    const scene = this._getOrCreate(name);
    if (!scene) return;

    const overlay = options?.overlay === true;
    if (!overlay) this.current?.onExit?.();
    await this._initIfNeeded(scene);
    this._kept.delete(scene);
    this._stack.push(scene);
    this._overlay.push(overlay);
    scene.onEnter?.(data);
  }

  /**
   * Pop the top scene. Calls onExit on it, then onDestroy unless
   * `options.keep` is true — a kept scene stays initialized so the next `push`
   * of its name goes straight to onEnter. The scene below gets
   * onEnter(options.data) unless the popped scene was pushed as an overlay.
   * Ignored while an animated `go()` is still fading out — that `go()` clears
   * the stack when the fade-out ends; nothing is called and nothing changes.
   */
  pop(options?: ScenePopOptions): void {
    if (this._refusedByPendingGo()) return;
    if (this._stack.length <= 1) return;

    const top = this._stack.pop()!;
    const wasOverlay = this._overlay.pop() === true;
    top.onExit?.();
    if (options?.keep === true) {
      this._kept.add(top);
    } else {
      top.onDestroy?.();
      this._scenes.delete(top.name);
      this._initialized.delete(top.name);
    }

    if (!wasOverlay) this.current?.onEnter?.(options?.data);
  }

  /** Update the live scenes (bottom-up, overlays last) and any active transition. */
  update(dt: number): void {
    if (this._transitionState) {
      this._updateTransition(dt);
      return;
    }

    this._updateStack(dt);
  }

  /** Destroy all scenes and clear state. */
  destroy(): void {
    this._discardPending();
    this._teardownStack();
    this._scenes.clear();
    this._initialized.clear();
    this._transitionState = null;
  }

  /** Get the transition progress (0–1) for rendering. 0 during 'out', 1 when done. */
  get transitionProgress(): number {
    if (!this._transitionState) return 0;
    return this._transitionState.progress;
  }

  /** Get the current transition phase. */
  get transitionPhase(): 'out' | 'in' | null {
    return this._transitionState?.phase ?? null;
  }

  /** True while an animated `go()` target is pending; warns once per manager in dev. */
  private _refusedByPendingGo(): boolean {
    const pending = this._pendingScene;
    if (!pending) return false;
    if (!this._warnedPendingGo && typeof __DEV__ !== 'undefined' && __DEV__) {
      this._warnedPendingGo = true;
      console.warn(
        `[SceneManager] push()/pop() ignored while go('${pending.name}') is fading out; call them after the fade-out ends`,
      );
    }
    return true;
  }

  private _getOrCreate(name: string): Scene | null {
    let scene = this._scenes.get(name);
    if (scene) return scene;

    const factory = this._factories.get(name);
    if (!factory) return null;

    scene = factory(new World(), new Camera2D());
    this._scenes.set(name, scene);
    return scene;
  }

  private async _initIfNeeded(scene: Scene): Promise<void> {
    if (this._initialized.has(scene.name)) return;
    this._initialized.add(scene.name);
    await scene.onPreload?.();
    scene.onInit?.();
  }

  private async _activateScene(scene: Scene, data?: unknown): Promise<void> {
    await this._initIfNeeded(scene);
    this._stack.push(scene);
    this._overlay.push(false);
    scene.onEnter?.(data);
  }

  /** Exit and destroy every stacked scene, top first, then empty the stack and destroy the kept scenes. */
  private _teardownStack(): void {
    for (let i = this._stack.length - 1; i >= 0; i--) {
      const s = this._stack[i]!;
      s.onExit?.();
      s.onDestroy?.();
      this._scenes.delete(s.name);
      this._initialized.delete(s.name);
    }
    this._stack.length = 0;
    this._overlay.length = 0;
    this._destroyKept();
  }

  /**
   * Destroy scenes popped with `keep: true` that were never pushed again. They
   * already got `onExit` on the pop. The cache entry is dropped only when it is
   * still this instance — an animated `go()` to the same name has already
   * replaced it with the pending scene.
   */
  private _destroyKept(): void {
    for (const s of this._kept) {
      s.onDestroy?.();
      if (this._scenes.get(s.name) === s) {
        this._scenes.delete(s.name);
        this._initialized.delete(s.name);
      }
    }
    this._kept.clear();
  }

  /**
   * Destroy the target of an animated `go()` that was superseded before its
   * out-phase finished. It got `onPreload` but never `onInit`. Fields are
   * cleared first so a re-entrant call from `onDestroy` cannot destroy twice;
   * an instance someone else still holds (stack, kept set) or has already
   * destroyed (evicted from the cache) is left alone.
   */
  private _discardPending(): void {
    const pending = this._pendingScene;
    if (!pending) return;
    this._pendingScene = null;
    this._pendingData = undefined;
    if (
      this._scenes.get(pending.name) !== pending ||
      this._stack.includes(pending) ||
      this._kept.has(pending)
    ) {
      return;
    }
    pending.onDestroy?.();
    this._scenes.delete(pending.name);
    this._initialized.delete(pending.name);
  }

  private _finishOutPhase(): void {
    if (!this._transitionState?.done || this._transitionState.phase !== 'out') return;

    const pending = this._pendingScene;
    const data = this._pendingData;
    this._pendingScene = null;
    this._pendingData = undefined;

    if (pending) {
      this._teardownStack();

      // Preload already ran in go(); call onInit then enter.
      this._scenes.set(pending.name, pending);
      this._initialized.add(pending.name);
      pending.onInit?.();
      this._stack.push(pending);
      this._overlay.push(false);
      pending.onEnter?.(data);
    }

    this._transitionState = this._transition.start('in');
  }

  /** Update then draw each live scene bottom-up: from the lowest scene not under an overlay to the top. */
  private _updateStack(dt: number): void {
    const stack = this._stack;
    let from = stack.length - 1;
    if (from < 0) return;
    while (from > 0 && this._overlay[from]) from--;
    for (let i = from; i < stack.length; i++) {
      const scene = stack[i]!;
      scene.onUpdate?.(dt);
      scene.onDraw?.();
    }
  }

  private _updateTransition(dt: number): void {
    if (!this._transitionState) return;

    this._transition.update(this._transitionState, dt);

    if (this._transitionState.done) {
      if (this._transitionState.phase === 'out') {
        // Hold until preload (started concurrently in go()) resolves.
        if (!this._preloadResolved) {
          this._updateStack(dt);
          return;
        }

        this._finishOutPhase();
      } else {
        // Phase 'in' done — transition complete
        this._transitionState = null;
      }
    }

    // Still update the live scenes during transition
    this._updateStack(dt);
  }
}
