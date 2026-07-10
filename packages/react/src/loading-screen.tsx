import type React from 'react';
import type { ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

/** Props for the <LoadingScreen> component. */
export interface LoadingScreenProps {
  /** Progress in [0, 1]. Values outside this range are clamped. */
  progress: number;
  /** Style applied to the outer container (covers parent by default). */
  style?: ViewStyle;
  /** Filled portion color. */
  barColor?: string;
  /** Track color. */
  trackColor?: string;
  /** Background color behind the track. */
  backgroundColor?: string;
}

/**
 * LoadingScreen — full-screen asset-load overlay.
 *
 * Renders before `<GameView>` mounts its Skia canvas (or alongside it
 * while `AssetManager.load()` resolves). Pure RN Views so it works
 * without a live Skia context. Consumers drive `progress` from the
 * AssetManager progress callback.
 */
export function LoadingScreen({
  progress,
  style,
  barColor = '#ffffff',
  trackColor = 'rgba(255,255,255,0.2)',
  backgroundColor = '#000000',
}: LoadingScreenProps): React.ReactElement {
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const percent = `${Math.round(clamped * 100)}%` as `${number}%`;

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.bar, { width: percent, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  track: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
});
