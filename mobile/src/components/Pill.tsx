import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

export type PillTone = 'default' | 'navy' | 'gold' | 'good' | 'warn' | 'bad' | 'ghost';

interface PillProps {
  children: React.ReactNode;
  tone?: PillTone;
  style?: ViewStyle;
}

export function Pill({ children, tone = 'default', style }: PillProps) {
  const { theme } = useTheme();
  const { bg, fg, border } = colorsFor(tone, theme);
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border ? 1 : 0,
          borderRadius: RADII.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: fg,
          fontFamily: TYPO.weights.semibold,
          fontSize: TYPO.sizes.label,
          letterSpacing: 0.4,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function colorsFor(tone: PillTone, t: ReturnType<typeof useTheme>['theme']) {
  switch (tone) {
    case 'navy':  return { bg: t.navy,          fg: t.surface,    border: null as string | null };
    case 'gold':  return { bg: t.gold,          fg: t.navy,       border: null };
    case 'good':  return { bg: t.good + '22',   fg: t.good,       border: t.good + '55' };
    case 'warn':  return { bg: t.warn + '22',   fg: t.warn,       border: t.warn + '55' };
    case 'bad':   return { bg: t.bad + '22',    fg: t.bad,        border: t.bad + '55' };
    case 'ghost': return { bg: 'transparent',   fg: t.muted,      border: t.line };
    case 'default':
    default:      return { bg: t.bgSoft,        fg: t.inkSoft,    border: t.line };
  }
}
