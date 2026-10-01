import React from 'react';
import { Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Field({ label, hint, error, containerStyle, ...input }: FieldProps) {
  const { theme } = useTheme();
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text
          style={{
            color: theme.muted,
            fontFamily: TYPO.weights.semibold,
            fontSize: TYPO.sizes.label,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        {...input}
        placeholderTextColor={theme.faint}
        style={{
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: error ? theme.bad : theme.line,
          borderRadius: RADII.md,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.md,
          color: theme.ink,
          fontFamily: TYPO.weights.medium,
          fontSize: TYPO.sizes.body,
        }}
      />
      {error ? (
        <Text style={{ color: theme.bad, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular, fontSize: TYPO.sizes.bodySm }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
