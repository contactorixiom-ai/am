import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  size?: number;
}

// 6 minuscules paillettes dorées qui scintillent autour du logo.
// Effet très discret : juste un peu de profondeur, pas de halo, pas de zoom.
const SPARKLES = [
  { x: -8,  y: -10, delay: 0,    duration: 2200, dotSize: 2 },
  { x: 12,  y: -16, delay: 600,  duration: 2400, dotSize: 1.5 },
  { x: -16, y: 18,  delay: 1100, duration: 2000, dotSize: 2 },
  { x: 18,  y: 14,  delay: 300,  duration: 2600, dotSize: 1.5 },
  { x: -2,  y: -20, delay: 1500, duration: 2300, dotSize: 1.5 },
  { x: 6,   y: 22,  delay: 900,  duration: 2500, dotSize: 1.5 },
];

export function AxisLogoSparkle({ size = 56 }: Props) {
  const { theme } = useTheme();
  const anims = useRef(SPARKLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((v, i) => {
      const cfg = SPARKLES[i];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(cfg.delay),
          Animated.timing(v, {
            toValue: 1,
            duration: cfg.duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: cfg.duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Paillettes positionnées autour du logo */}
      {SPARKLES.map((s, i) => {
        const v = anims[i];
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: size / 2 + s.x - s.dotSize,
              top: size / 2 + s.y - s.dotSize,
              width: s.dotSize * 2,
              height: s.dotSize * 2,
              borderRadius: s.dotSize,
              backgroundColor: theme.gold,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }),
              transform: [
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
              ],
            }}
          />
        );
      })}
      {/* Logo fixe, pas d'animation */}
      <Image
        source={require('../../assets/axis-mark.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    </View>
  );
}
