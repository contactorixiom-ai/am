import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface Props {
  size?: number;
  withWordmark?: boolean;
  wordmarkColor?: string;
  withGlow?: boolean;
}

// Logo Axis avec animation de glow doré qui pulse + reflet qui passe sur le logo.
// Inspiré du rendu lumineux du logo officiel sur fond navy.
export function AnimatedAxisLogo({
  size = 56,
  withWordmark = false,
  wordmarkColor,
  withGlow = true,
}: Props) {
  const { theme } = useTheme();
  const glow = useRef(new Animated.Value(0.35)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!withGlow) return;
    const loop = Animated.loop(
      Animated.parallel([
        // Glow pulse (opacity 0.35 → 0.85 → 0.35)
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.85,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.35,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        // Scale breathing (1 → 1.04 → 1)
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.04,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, scale, withGlow]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Halo doré sous le logo */}
        {withGlow ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size * 1.8,
              height: size * 1.8,
              borderRadius: size,
              backgroundColor: theme.gold,
              opacity: glow.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.35],
              }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            }}
          />
        ) : null}
        {/* Glow inner ring */}
        {withGlow ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size * 1.3,
              height: size * 1.3,
              borderRadius: size,
              borderWidth: 1.5,
              borderColor: theme.gold,
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            }}
          />
        ) : null}
        {/* Logo image avec léger pulse */}
        <Animated.Image
          source={require('../../assets/axis-mark.png')}
          style={{
            width: size,
            height: size,
            resizeMode: 'contain',
            transform: [{ scale }],
          }}
        />
      </View>
      {withWordmark ? (
        <Text
          style={{
            fontFamily: TYPO.weights.semibold,
            fontSize: size * 0.5,
            letterSpacing: size * 0.05,
            color: wordmarkColor ?? theme.gold,
            paddingTop: 2,
          }}
        >
          AXIS IMPORT
        </Text>
      ) : null}
    </View>
  );
}
