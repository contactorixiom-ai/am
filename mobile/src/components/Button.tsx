import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { tapFeedback } from '../utils/haptics';
import { DotLoader } from './DotLoader';

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
  // Enfoncement élastique au toucher, comme un vrai bouton.
  const scale = useRef(new Animated.Value(1)).current;
  const pressTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: v === 1 ? 10 : 0 }).start();
  const flat = (style ?? {}) as ViewStyle;
  // La mise en page (largeur, flex, marges) reste sur le conteneur animé.
  const outer: ViewStyle = {
    width: fullWidth ? '100%' : flat.width,
    flex: flat.flex,
    alignSelf: flat.alignSelf,
    margin: flat.margin, marginTop: flat.marginTop, marginBottom: flat.marginBottom,
    marginLeft: flat.marginLeft, marginRight: flat.marginRight,
    marginHorizontal: flat.marginHorizontal, marginVertical: flat.marginVertical,
    minWidth: flat.minWidth, maxWidth: flat.maxWidth,
  };

  return (
    <Animated.View style={[outer, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        disabled={disabled || loading}
        onPressIn={(e) => { pressTo(0.96); rest.onPressIn?.(e); }}
        onPressOut={(e) => { pressTo(1); rest.onPressOut?.(e); }}
        onPress={(e) => { tapFeedback(); rest.onPress?.(e); }}
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
            opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          },
          { ...flat, width: fullWidth || flat.width != null || flat.flex != null ? '100%' : undefined, flex: undefined, alignSelf: undefined, margin: undefined, marginTop: undefined, marginBottom: undefined, marginLeft: undefined, marginRight: undefined, marginHorizontal: undefined, marginVertical: undefined },
        ]}
      >
        {loading ? (
          <View style={{ height: sz.fontSize * 1.3, justifyContent: 'center' }}>
            <DotLoader size={6} color={fg} />
          </View>
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
    </Animated.View>
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
