import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface AxisLogoProps {
  size?: number;
  showWordmark?: boolean;
}

// Placeholder vectoriel — sera remplacé par le PNG/SVG officiel via `assets/`.
export function AxisLogo({ size = 48, showWordmark = false }: AxisLogoProps) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: theme.navy,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: theme.gold,
            fontFamily: TYPO.weights.bold,
            fontSize: size * 0.42,
            letterSpacing: -1,
          }}
        >
          A
        </Text>
      </View>
      {showWordmark ? (
        <Text
          style={{
            color: theme.ink,
            fontFamily: TYPO.weights.bold,
            fontSize: size * 0.46,
            letterSpacing: -0.5,
          }}
        >
          Axis Import
        </Text>
      ) : null}
    </View>
  );
}
