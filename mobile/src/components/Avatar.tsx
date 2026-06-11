import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface AvatarProps {
  name: string;
  size?: number;
  tone?: 'navy' | 'gold';
  style?: ViewStyle;
}

export function Avatar({ name, size = 36, tone = 'navy', style }: AvatarProps) {
  const { theme } = useTheme();
  const initials = name.split(' ').slice(0, 2).map((s) => s[0] ?? '').join('').toUpperCase();

  const bg = tone === 'gold' ? theme.gold + '2E' : theme.navy;
  const fg = tone === 'gold' ? theme.goldDeep : '#F5F1E8';

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: fg,
          fontFamily: TYPO.weights.semibold,
          fontSize: size * 0.36,
          letterSpacing: 0.4,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
