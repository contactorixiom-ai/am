// Pastille rouge chiffrée (notifications, messages non lus, pièces à traiter).
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { TYPO } from '../theme/tokens';

export const BADGE_RED = '#E5252A';

export function CountBadge({ count, style, size = 18, border }: { count: number; style?: ViewStyle; size?: number; border?: string }) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View
      accessibilityLabel={`${count} non lu${count > 1 ? 's' : ''}`}
      style={[
        {
          minWidth: size,
          height: size,
          paddingHorizontal: label.length > 1 ? 5 : 0,
          borderRadius: size / 2,
          backgroundColor: BADGE_RED,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: border ? 2 : 0,
          borderColor: border,
        },
        style,
      ]}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.6, lineHeight: size * 0.75, fontFamily: TYPO.weights.bold }}>{label}</Text>
    </View>
  );
}
