import { useEffect, useRef, useState } from 'react';
import { type GameState, gameState, stateChanged } from '../state';

/** Subscribe a component to gameState changes via a selector. Folds the
 *  useState(select)+useEffect(subscribe/cleanup) boilerplate. select reads the
 *  module-global gameState; a ref keeps the empty-deps effect lint-clean. */
export function useHudState<T>(select: () => T): T {
  const selRef = useRef(select);
  selRef.current = select;
  const [snap, setSnap] = useState(select);
  useEffect(() => stateChanged.add(() => setSnap(selRef.current())), []);
  return snap;
}

/** Full GameState snapshot with the nested re-clones the overlays rely on for
 *  React reference-change detection. Shared by the 4 overlays whose cloneState
 *  was byte-identical (Achievements/Codex/Menu/Shop). */
export function cloneGameState(): GameState {
  return {
    ...gameState,
    settings: { ...gameState.settings, controls: { ...gameState.settings.controls } },
    runStats: { ...gameState.runStats, kills: { ...gameState.runStats.kills } },
    zoneBanner: { ...gameState.zoneBanner },
  };
}
