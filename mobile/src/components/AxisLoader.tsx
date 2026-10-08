import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  size?: number;
  /** Pictogramme au centre (bouclier, camion…). */
  children?: React.ReactNode;
}

/**
 * Chargement aux couleurs d'Axis : arc doré qui tourne autour d'un disque
 * bleu nuit, halo qui respire. Pour les attentes qui comptent (paiement,
 * transmission du PV), là où un simple « spinner » ferait générique.
 */
export function AxisLoader({ size = 72, children }: Props) {
  const { theme } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [spin, breathe]);

  const r = 30;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.gold,
          opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] }),
          transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }],
        }}
      />
      <View style={{ position: 'absolute', width: size * 0.66, height: size * 0.66, borderRadius: size, backgroundColor: theme.navy }} />
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 72 72">
          <Circle cx={36} cy={36} r={r} stroke={theme.line} strokeWidth={3} fill="none" />
          <Circle
            cx={36}
            cy={36}
            r={r}
            stroke={theme.gold}
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ * 0.28} ${circ}`}
          />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}
