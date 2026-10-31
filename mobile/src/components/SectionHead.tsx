import React from 'react';
import { Pressable, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface Props {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function SectionHead({ title, action, onAction, style }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          marginBottom: 10,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 12.5,
          color: theme.muted,
          letterSpacing: 0.75,
          textTransform: 'uppercase',
          fontFamily: TYPO.weights.semibold,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.medium }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
