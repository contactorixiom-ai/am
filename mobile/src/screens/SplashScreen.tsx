import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface Props {
  onFinish?: () => void;
}

// Splash écran avec logo complet et glow doré animé.
// Affiché au démarrage de l'app pendant le chargement de session.
export function SplashScreen({ onFinish }: Props) {
  const { theme } = useTheme();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();

    if (onFinish) {
      const t = setTimeout(onFinish, 2200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [fadeIn, glow, onFinish]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0B1A2F',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={{ opacity: fadeIn, alignItems: 'center' }}>
        {/* Halo doré pulsant */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -40,
            width: 260,
            height: 260,
            borderRadius: 130,
            backgroundColor: theme.gold,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.18] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) }],
          }}
        />
        {/* Glow inner ring */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 20,
            width: 180,
            height: 180,
            borderRadius: 90,
            borderWidth: 1,
            borderColor: theme.gold,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.45] }),
          }}
        />
        {/* Logo image */}
        <Animated.View
          style={{
            transform: [
              {
                scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }),
              },
            ],
          }}
        >
          <Image
            source={require('../../assets/axis-mark.png')}
            style={{ width: 130, height: 130, resizeMode: 'contain' }}
          />
        </Animated.View>

        {/* Wordmark */}
        <Text
          style={{
            marginTop: 24,
            fontFamily: TYPO.weights.bold,
            fontSize: 32,
            letterSpacing: 4,
            color: '#F1ECDC',
          }}
        >
          AXIS IMPORT
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontFamily: TYPO.weights.semibold,
            fontSize: 11,
            letterSpacing: 3,
            color: theme.gold,
            textTransform: 'uppercase',
          }}
        >
          Votre logistique, notre mission
        </Text>
      </Animated.View>
    </View>
  );
}
