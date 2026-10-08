import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII } from '../theme/tokens';

type Variant = 'line' | 'card' | 'avatar' | 'pill';

interface Props {
  variant?: Variant;
  /** Largeur (number = px, string = % par exemple). Défaut selon variant. */
  width?: number | `${number}%`;
  /** Hauteur. Défaut selon variant. */
  height?: number;
  /** Pour empiler plusieurs lignes facilement. */
  count?: number;
  style?: ViewStyle;
}

// Placeholder animé pendant le chargement.
// Pulsation douce d'opacité — pas de scintillement (movement = bruit visuel).
export function Skeleton({ variant = 'line', width, height, count = 1, style }: Props) {
  const { theme } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.8, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const dims = dimsFor(variant, width, height);
  const radius = radiusFor(variant);

  const items = Array.from({ length: count }, (_, i) => (
    <Animated.View
      key={i}
      style={[
        {
          width: dims.width,
          height: dims.height,
          borderRadius: radius,
          backgroundColor: theme.bgSoft,
          opacity: pulse,
        },
        i > 0 ? { marginTop: 8 } : null,
      ]}
    />
  ));

  if (count === 1) return <View style={style}>{items}</View>;
  return <View style={style}>{items}</View>;
}

function dimsFor(variant: Variant, w?: Props['width'], h?: number) {
  switch (variant) {
    case 'avatar': return { width: w ?? 44, height: h ?? 44 };
    case 'pill':   return { width: w ?? 80, height: h ?? 22 };
    case 'card':   return { width: w ?? '100%', height: h ?? 88 };
    case 'line':
    default:       return { width: w ?? '100%', height: h ?? 14 };
  }
}

function radiusFor(variant: Variant): number {
  switch (variant) {
    case 'avatar': return 999;
    case 'pill':   return 999;
    case 'card':   return RADII.lg;
    case 'line':
    default:       return 6;
  }
}
