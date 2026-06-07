import { clamp } from '@flare-engine/math';
import { useState } from 'react';
import type { PrivacySettings } from '../save/schema';
import type { SaveStore } from '../save/store';
import {
  type FireButtonSide,
  type GameState,
  type JoystickSide,
  gameState,
  stateChanged,
} from '../state';
import type { MenuOverlayActions } from './MenuOverlay.types';

export interface SettingsHandlers {
  privacyVisible: boolean;
  setPrivacyVisible: (v: boolean) => void;
  privacy: PrivacySettings;
  setPrivacy: (v: PrivacySettings) => void;
  setLocale: (loc: 'en' | 'pl') => void;
  bumpVolume: (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', delta: number) => void;
  toggleReducedMotion: () => void;
  toggleColorBlindMode: () => void;
  setJoystickSide: (side: JoystickSide) => void;
  setFireSide: (side: FireButtonSide) => void;
  togglePrivacyField: (field: 'analyticsOptIn' | 'crashOptIn') => void;
  back: () => void;
}

export function useSettingsHandlers(
  settings: GameState['settings'],
  save: SaveStore,
  actions: MenuOverlayActions,
  onLocaleChange: (locale: 'en' | 'pl') => void,
  onVolumesChange: (volumes: { master: number; music: number; sfx: number }) => void,
): SettingsHandlers {
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>(() => save.privacy());

  const setLocale = (loc: 'en' | 'pl'): void => {
    gameState.settings.locale = loc;
    onLocaleChange(loc);
    stateChanged.emit();
  };

  const bumpVolume = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', delta: number): void => {
    const next = clamp(Math.round((settings[key] + delta) * 10) / 10, 0, 1);
    gameState.settings[key] = next;
    onVolumesChange({
      master: gameState.settings.masterVolume,
      music: gameState.settings.musicVolume,
      sfx: gameState.settings.sfxVolume,
    });
    stateChanged.emit();
  };

  const toggleReducedMotion = (): void => {
    gameState.settings.reducedMotion = !gameState.settings.reducedMotion;
    stateChanged.emit();
  };

  const toggleColorBlindMode = (): void => {
    gameState.settings.colorBlindMode = !gameState.settings.colorBlindMode;
    stateChanged.emit();
  };

  const setJoystickSide = (side: JoystickSide): void => {
    gameState.settings.controls.joystickSide = side;
    stateChanged.emit();
  };

  const setFireSide = (side: FireButtonSide): void => {
    gameState.settings.controls.fireButtonSide = side;
    stateChanged.emit();
  };

  const togglePrivacyField = (field: 'analyticsOptIn' | 'crashOptIn'): void => {
    const next = { ...privacy, [field]: !privacy[field] };
    setPrivacy(next);
    void save.setPrivacy(next);
  };

  const back = (): void => {
    actions.persistSettings();
    void save.persist();
    if (gameState.settingsOrigin === 'pause') {
      actions.goPlay();
    } else {
      actions.goMenu();
    }
  };

  return {
    privacyVisible,
    setPrivacyVisible,
    privacy,
    setPrivacy,
    setLocale,
    bumpVolume,
    toggleReducedMotion,
    toggleColorBlindMode,
    setJoystickSide,
    setFireSide,
    togglePrivacyField,
    back,
  };
}
