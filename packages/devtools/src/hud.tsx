import type { ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useDevtools, useTimeScrub } from './hooks.js';

/**
 * DevtoolsHUD — compact native overlay. Shows buffer depth + pause/step/resume
 * buttons. No-op on web (renders `null`).
 */
export function DevtoolsHUD(): ReactNode {
  if (Platform.OS === 'web') return null;
  return <HUDBody />;
}

function HUDBody(): ReactNode {
  const { buffer } = useDevtools();
  const scrub = useTimeScrub();

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderRadius: 4,
      }}
    >
      <Text style={{ color: '#fff', marginRight: 8 }}>
        {buffer.length}/{buffer.size}
      </Text>
      <HudButton label="||" onPress={scrub.pause} />
      <HudButton label=">|" onPress={scrub.step} />
      <HudButton label=">" onPress={scrub.resume} />
    </View>
  );
}

function HudButton({ label, onPress }: { label: string; onPress: () => void }): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 4,
        backgroundColor: '#444',
        borderRadius: 2,
      }}
    >
      <Text style={{ color: '#fff' }}>{label}</Text>
    </Pressable>
  );
}
