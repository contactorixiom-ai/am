import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

// Écran de chargement de marque, façon ouverture d'app (YouTube-like) :
// le logo apparaît en zoom + fondu, le wordmark monte en fondu, et une barre
// de progression indéterminée glisse en bas. 100% Animated (web + natif).
export function SplashScreen() {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordShift = useRef(new Animated.Value(10)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(wordOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(wordShift, { toValue: 0, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const barLoop = Animated.loop(
      Animated.timing(bar, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    pulseLoop.start();
    barLoop.start();
    return () => { pulseLoop.stop(); barLoop.stop(); };
  }, [scale, opacity, wordOpacity, wordShift, pulse, bar]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const barTranslate = bar.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });

  return (
    <View style={{ flex: 1, backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          opacity,
          transform: [{ scale: Animated.multiply(scale, pulseScale) }],
          alignItems: 'center',
        }}
      >
        <Image source={require('../../assets/axis-mark.png')} style={{ width: 96, height: 96, resizeMode: 'contain' }} />
      </Animated.View>

      <Animated.Text
        style={{
          marginTop: 20,
          color: theme.gold,
          fontFamily: TYPO.weights.bold,
          fontSize: 22,
          letterSpacing: 5,
          opacity: wordOpacity,
          transform: [{ translateY: wordShift }],
        }}
      >
        AXIS IMPORT
      </Animated.Text>
      <Animated.Text
        style={{
          marginTop: 6,
          color: '#8FA0B8',
          fontFamily: TYPO.weights.medium,
          fontSize: 11,
          letterSpacing: 1.8,
          opacity: wordOpacity,
        }}
      >
        CONVOYAGE · IMPORT-EXPORT
      </Animated.Text>

      {/* Barre de progression indéterminée */}
      <View
        style={{
          position: 'absolute',
          bottom: 96,
          width: 160,
          height: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            width: 64,
            height: 3,
            borderRadius: 2,
            backgroundColor: theme.gold,
            transform: [{ translateX: barTranslate }],
          }}
        />
      </View>
    </View>
  );
}
