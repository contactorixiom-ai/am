import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { successFeedback } from '../utils/haptics';

const ACircle = Animated.createAnimatedComponent(Circle);
const APath = Animated.createAnimatedComponent(Path);

interface Props {
  size?: number;
  color?: string;
}

/**
 * Validation animée : l'anneau se dessine, la coche se trace, puis un léger
 * rebond et une onde dorée. Réservée aux moments qui comptent (paiement
 * confirmé, commande enregistrée, PV signé) pour garder de la valeur.
 */
export function SuccessCheck({ size = 88, color }: Props) {
  const { theme } = useTheme();
  const c = color ?? theme.good;
  const ring = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.6)).current;
  const wave = useRef(new Animated.Value(0)).current;

  const R = 36;
  const CIRC = 2 * Math.PI * R;
  const TICK = 60;

  useEffect(() => {
    successFeedback();
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(tick, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]),
      Animated.sequence([
        Animated.delay(520),
        Animated.timing(wave, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [pop, ring, tick, wave]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: theme.gold,
          opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.6] }) }],
        }}
      />
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Svg width={size} height={size} viewBox="0 0 88 88">
          <Circle cx={44} cy={44} r={R} fill={c + '18'} />
          <ACircle
            cx={44}
            cy={44}
            r={R}
            stroke={c}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC}`}
            strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] })}
            transform="rotate(-90 44 44)"
          />
          <APath
            d="M28 45 L39 56 L61 33"
            stroke={c}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${TICK}`}
            strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [TICK, 0] })}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
