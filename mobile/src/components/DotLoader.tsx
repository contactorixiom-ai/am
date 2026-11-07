import React, { useContext, useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { ThemeContext } from '../theme/ThemeProvider';

interface Props {
  size?: number;
  color?: string;
}

// 3 points dorés qui pulsent en cascade.
// Tolère l'absence de ThemeProvider (utilisé au boot avant les contexts).
export function DotLoader({ size = 7, color }: Props) {
  const themeCtx = useContext(ThemeContext);
  const dotColor = color ?? themeCtx?.theme.gold ?? '#C9A55C';
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(v, {
            toValue: 1,
            duration: 540,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 540,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dots]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.7 }}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: dotColor,
            opacity: v,
            transform: [{ scale: v.interpolate({ inputRange: [0.3, 1], outputRange: [0.85, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}
