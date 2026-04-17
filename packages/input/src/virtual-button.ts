/** Virtual button state — pure data, no UI. */
export interface VirtualButtonState {
  /** Whether the button is currently pressed. */
  isPressed: boolean;
  /** Whether the button was just pressed this frame. */
  justPressed: boolean;
  /** Whether the button was just released this frame. */
  justReleased: boolean;
}

/** Create a default button state. */
export function createButtonState(): VirtualButtonState {
  return {
    isPressed: false,
    justPressed: false,
    justReleased: false,
  };
}

/** Call at the start of each frame to reset per-frame flags. */
export function resetButtonFrame(state: VirtualButtonState): void {
  state.justPressed = false;
  state.justReleased = false;
}

/** Call when the button is pressed. */
export function pressButton(state: VirtualButtonState): void {
  if (!state.isPressed) {
    state.isPressed = true;
    state.justPressed = true;
  }
}

/** Call when the button is released. */
export function releaseButton(state: VirtualButtonState): void {
  if (state.isPressed) {
    state.isPressed = false;
    state.justReleased = true;
  }
}
