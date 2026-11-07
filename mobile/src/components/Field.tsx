import React, { useState } from 'react';
import { Platform, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
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
  // Contour doré pendant la saisie : on voit tout de suite où l'on écrit.
  const [focused, setFocused] = useState(false);
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
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        placeholderTextColor={theme.faint}
        style={{
          borderWidth: 1,
          borderColor: error ? theme.bad : focused && input.editable !== false ? theme.gold : theme.line,
          backgroundColor: input.editable === false ? theme.bgSoft : focused ? theme.surface : theme.surface2,
          borderRadius: RADII.md,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.md,
          color: theme.ink,
          fontFamily: TYPO.weights.medium,
          fontSize: TYPO.sizes.body,
          // Sur le web, le contour du navigateur masquait le contour doré.
          ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null),
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
