/**
 * Bridge between the React HUD and scene logic. Scenes register callbacks on
 * enter; the HUD invokes them from button / modal presses.
 *
 * Not every scene uses every action — unset callbacks no-op.
 */
const noop = (): void => {};
const noopN = (_: number): void => {};
const noopTile = (_: 'shop' | 'inventory' | 'ships' | 'leaderboard'): void => {};

export interface MenuActions {
  // menu scene
  onNewGame: () => void;
  onContinue: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onTitleTap: () => void;
  onPickSlot: (index: number) => void;
  onResetSlot: (index: number) => void;
  // base scene
  onLaunchRun: () => void;
  onBaseBack: () => void;
  onOpenBaseTile: (tile: 'shop' | 'inventory' | 'ships' | 'leaderboard') => void;
  onCloseBaseTile: () => void;
  // dialogue scene
  onDialogueAdvance: () => void;
  // play scene (pause)
  onPauseOpen: () => void;
  onPauseResume: () => void;
  onPauseToMenu: () => void;
  // game-over / victory
  onEndContinue: () => void;
  onEndRetry: () => void;
}

export const menuActions: MenuActions = {
  onNewGame: noop,
  onContinue: noop,
  onOpenSettings: noop,
  onCloseSettings: noop,
  onTitleTap: noop,
  onPickSlot: noopN,
  onResetSlot: noopN,
  onLaunchRun: noop,
  onBaseBack: noop,
  onOpenBaseTile: noopTile,
  onCloseBaseTile: noop,
  onDialogueAdvance: noop,
  onPauseOpen: noop,
  onPauseResume: noop,
  onPauseToMenu: noop,
  onEndContinue: noop,
  onEndRetry: noop,
};

export function setMenuActions(patch: Partial<MenuActions>): void {
  const target = menuActions as unknown as Record<string, unknown>;
  for (const key of Object.keys(patch) as (keyof MenuActions)[]) {
    const value = patch[key];
    if (value !== undefined) target[key] = value;
  }
}

export function clearMenuActions(): void {
  menuActions.onNewGame = noop;
  menuActions.onContinue = noop;
  menuActions.onOpenSettings = noop;
  menuActions.onCloseSettings = noop;
  menuActions.onTitleTap = noop;
  menuActions.onPickSlot = noopN;
  menuActions.onResetSlot = noopN;
  menuActions.onLaunchRun = noop;
  menuActions.onBaseBack = noop;
  menuActions.onOpenBaseTile = noopTile;
  menuActions.onCloseBaseTile = noop;
  menuActions.onDialogueAdvance = noop;
  menuActions.onPauseOpen = noop;
  menuActions.onPauseResume = noop;
  menuActions.onPauseToMenu = noop;
  menuActions.onEndContinue = noop;
  menuActions.onEndRetry = noop;
}
