import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AnimatedAxisLogo } from '../components/AnimatedAxisLogo';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function OnboardingScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Decorative gold arc (3 concentric circles top-right) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -80,
            right: -160,
            width: 480,
            height: 480,
            opacity: 0.18,
          }}
        >
          <Svg width={480} height={480} viewBox="0 0 400 400">
            <Circle cx="200" cy="200" r="190" stroke={theme.gold} strokeWidth={1.2} fill="none" />
            <Circle cx="200" cy="200" r="140" stroke={theme.gold} strokeWidth={1} fill="none" />
            <Circle cx="200" cy="200" r="90" stroke={theme.gold} strokeWidth={1} fill="none" />
          </Svg>
        </View>

        {/* Content */}
        <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 100 }}>
          <AnimatedAxisLogo size={64} />
          <Text
            style={{
              fontFamily: TYPO.weights.bold,
              fontSize: 46,
              lineHeight: 46 * 1.02,
              color: theme.ink,
              marginTop: 56,
              letterSpacing: -1,
            }}
          >
            Le transport,
            {'\n'}
            <Text style={{ color: theme.goldDeep, fontFamily: TYPO.weights.bold }}>au cordeau.</Text>
          </Text>
          <Text
            style={{
              fontSize: 15.5,
              color: theme.inkSoft,
              lineHeight: 22,
              marginTop: 18,
              maxWidth: 320,
              fontFamily: TYPO.weights.regular,
            }}
          >
            Convoyage de véhicules en Europe, import-export de marchandises vers l'Afrique. Devis sur mesure, suivi en temps réel, documents officiels signés depuis ton téléphone.
          </Text>
        </View>

        {/* Bottom buttons */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 36, gap: 12 }}>
          <Button
            kind="gold"
            size="lg"
            fullWidth
            onPress={() => nav.navigate('Register')}
            rightIcon={<Icons.arrow size={18} color={theme.navyDeep} stroke={2} />}
          >
            Continuer en tant que client
          </Button>
          <Button kind="outline" size="lg" fullWidth onPress={() => nav.navigate('Register')}>
            Je suis chauffeur
          </Button>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Pressable onPress={() => nav.navigate('Login')}>
              <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                Déjà un compte ? <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold }}>Connexion</Text>
              </Text>
            </Pressable>
          </View>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <Pressable onPress={() => nav.navigate('TrackByReference')}>
              <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.regular }}>
                Suivre un colis sans compte →
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
