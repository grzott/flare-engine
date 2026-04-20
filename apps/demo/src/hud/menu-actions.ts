/**
 * Bridge between the React HUD (Modal buttons) and scene logic.
 * Scenes register handlers on enter; the HUD invokes them on button press.
 * Replaces the old "tap-to-continue" pointer-polling in menu/game-over/victory scenes.
 */
const noop = (): void => {};

export const menuActions: {
  onStart: () => void;
  onContinue: () => void;
  onTitleTap: () => void;
} = {
  onStart: noop,
  onContinue: noop,
  onTitleTap: noop,
};

export function setMenuActions(partial: Partial<typeof menuActions>): void {
  if (partial.onStart) menuActions.onStart = partial.onStart;
  if (partial.onContinue) menuActions.onContinue = partial.onContinue;
  if (partial.onTitleTap) menuActions.onTitleTap = partial.onTitleTap;
}

export function clearMenuActions(): void {
  menuActions.onStart = noop;
  menuActions.onContinue = noop;
  menuActions.onTitleTap = noop;
}
