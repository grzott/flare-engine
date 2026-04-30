import { createContext, useContext } from 'react';

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const SafeAreaContext = createContext<SafeArea | null>(null);

export function useSafeArea(): SafeArea {
  const value = useContext(SafeAreaContext);
  if (value === null) {
    throw new Error('useSafeArea must be used inside a <GameView>');
  }
  return value;
}
