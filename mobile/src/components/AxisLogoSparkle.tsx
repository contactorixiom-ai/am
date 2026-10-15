import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  size?: number;
}

// Paillettes dorées positionnées UNIQUEMENT sur le contour circulaire du
// logo (le cercle doré). Elles scintillent en douceur, jamais à l'intérieur.
// Angles en degrés sur le périmètre, 0° = haut, sens horaire.
const SPARKLE_ANGLES = [
  { angle: 18,  delay: 0,    duration: 2400, dotSize: 1.8 },
  { angle: 75,  delay: 800,  duration: 2100, dotSize: 1.4 },
  { angle: 135, delay: 400,  duration: 2600, dotSize: 1.6 },
  { angle: 200, delay: 1200, duration: 2200, dotSize: 1.4 },
  { angle: 255, delay: 200,  duration: 2500, dotSize: 1.8 },
  { angle: 310, delay: 1500, duration: 2300, dotSize: 1.5 },
];

export function AxisLogoSparkle({ size = 56 }: Props) {
  const { theme } = useTheme();
  const anims = useRef(SPARKLE_ANGLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((v, i) => {
      const cfg = SPARKLE_ANGLES[i];
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

  // Rayon du contour du logo : le cercle doré occupe quasi toute l'image,
  // son trait est à ~94% du demi-côté.
  const radius = (size / 2) * 0.94;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Logo fixe */}
      <Image
        source={require('../../assets/axis-mark.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
      {/* Paillettes sur le contour circulaire */}
      {SPARKLE_ANGLES.map((s, i) => {
        const v = anims[i];
        const rad = ((s.angle - 90) * Math.PI) / 180; // 0° = haut
        const x = center + radius * Math.cos(rad);
        const y = center + radius * Math.sin(rad);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: x - s.dotSize,
              top: y - s.dotSize,
              width: s.dotSize * 2,
              height: s.dotSize * 2,
              borderRadius: s.dotSize,
              backgroundColor: theme.goldHi,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
              transform: [
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
              // Petit halo très léger autour de chaque paillette
              shadowColor: theme.gold,
              shadowOpacity: 0.8,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </View>
  );
}
