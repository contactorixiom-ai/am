import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface Props {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHead({ title, action, onAction }: Props) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Text
        style={{
          color: theme.muted,
          fontFamily: TYPO.weights.semibold,
          fontSize: TYPO.sizes.label,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={{ color: theme.navy, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
