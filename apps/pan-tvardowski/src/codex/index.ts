/**
 * Codex barrel — re-exports the data model + helpers consumed by the
 * (forthcoming) `CodexOverlay` scene + save-state plumbing.
 */
export {
  CODEX_ENTRIES,
  createCodexUnlockState,
  findCodexEntry,
  getCodexEntriesByCategory,
  isCodexEntryUnlocked,
  unlockCodexEntry,
} from './entries';
export type {
  CodexCategory,
  CodexEntry,
  CodexEntryId,
  CodexUnlockState,
} from './entries';
