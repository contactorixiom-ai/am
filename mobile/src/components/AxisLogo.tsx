import React from 'react';
import { Image, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface AxisLogoProps {
  size?: number;
  withWordmark?: boolean;
  wordmarkColor?: string;
}

export function AxisLogo({ size = 28, withWordmark = false, wordmarkColor }: AxisLogoProps) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image
        source={require('../../assets/axis-mark.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
      {withWordmark ? (
        <Text
          style={{
            fontFamily: TYPO.weights.semibold,
            fontSize: size * 0.95,
            letterSpacing: size * 0.16 / 10,
            color: wordmarkColor ?? theme.gold,
            paddingTop: 2,
          }}
        >
          AXIS
        </Text>
      ) : null}
    </View>
  );
}

// Re-export pour compat
export const AxisMark = AxisLogo;
