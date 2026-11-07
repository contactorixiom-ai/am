import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SHADOWS, SPACING } from '../theme/tokens';

interface SurfaceProps extends ViewProps {
  variant?: 'default' | 'alt';
  padded?: boolean;
  flat?: boolean;
}

export function Surface({ variant = 'default', padded = true, flat = false, style, children, ...rest }: SurfaceProps) {
  const { theme } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: variant === 'alt' ? theme.surface2 : theme.surface,
          borderRadius: RADII.lg,
          borderWidth: 1,
          borderColor: theme.line,
          padding: padded ? SPACING.lg : 0,
        },
        !flat && SHADOWS.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}
