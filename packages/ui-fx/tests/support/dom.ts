import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { act, type ReactNode } from 'react';

export interface Rendered {
  container: HTMLElement;
  rerender(el: ReactNode): void;
  unmount(): void;
}

const FRAME_MS = 1000 / 60;

const pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let frameTime = 0;

/**
 * Registers happy-dom globals. Call it before `render`, at the top of a test file.
 *
 * `requestAnimationFrame` becomes a manual queue that only `flushFrames` drains. happy-dom's own
 * fires on the next macrotask, so a loop that re-requests a frame never lets an async `act` settle.
 */
export const installDom = (): void => {
  if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  pendingFrames.clear();
  frameTime = 0;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    pendingFrames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    pendingFrames.delete(id);
  };
};

// react-dom probes `window` once, while its module evaluates. A static import would run before
// `installDom()`, so the client is loaded on first use instead.
const loadClient = (): typeof import('react-dom/client') => require('react-dom/client');

export const render = (el: ReactNode): Rendered => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = loadClient().createRoot(container);
  act(() => {
    root.render(el);
  });
  return {
    container,
    rerender(next) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

/**
 * Runs `n` animation frames and flushes the React work they schedule. Each frame calls the
 * callbacks requested before it, with a timestamp on a virtual 60 Hz clock that starts at 0.
 */
export const flushFrames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) {
    frameTime += FRAME_MS;
    const due = [...pendingFrames.values()];
    pendingFrames.clear();
    await act(async () => {
      for (const callback of due) callback(frameTime);
    });
  }
};
