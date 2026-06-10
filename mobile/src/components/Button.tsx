import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

export type ButtonKind = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: React.ReactNode;
  kind?: ButtonKind;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  children,
  kind = 'primary',
  size = 'md',
  loading,
  fullWidth,
  style,
  leftIcon,
  rightIcon,
  disabled,
  ...rest
}: ButtonProps) {
  const { theme } = useTheme();
  const sz = sizeFor(size);
  const { bg, fg, border } = kindColors(kind, theme);

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          borderWidth: border ? 1 : 0,
          borderRadius: RADII.md,
          paddingHorizontal: sz.padX,
          paddingVertical: sz.padY,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          <Text
            style={{
              color: fg,
              fontFamily: TYPO.weights.semibold,
              fontSize: sz.fontSize,
              letterSpacing: 0.2,
            }}
          >
            {children}
          </Text>
          {rightIcon ? <View>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}

function sizeFor(s: ButtonSize) {
  switch (s) {
    case 'sm': return { padX: 12, padY: 8,  fontSize: 13 };
    case 'lg': return { padX: 20, padY: 16, fontSize: 16 };
    case 'md':
    default:   return { padX: 16, padY: 12, fontSize: 14 };
  }
}

function kindColors(k: ButtonKind, t: ReturnType<typeof useTheme>['theme']) {
  switch (k) {
    case 'gold':    return { bg: t.gold,         fg: t.navy,    border: null as string | null };
    case 'outline': return { bg: 'transparent',  fg: t.ink,     border: t.line };
    case 'ghost':   return { bg: 'transparent',  fg: t.ink,     border: null };
    case 'danger':  return { bg: t.bad,          fg: '#FFFFFF', border: null };
    case 'primary':
    default:        return { bg: t.navy,         fg: '#FFFFFF', border: null };
  }
}
