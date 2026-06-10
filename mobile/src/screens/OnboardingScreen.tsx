import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function OnboardingScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, padding: SPACING.xxl, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.xxl }}>
          <AxisLogo size={92} />
          <View style={{ alignItems: 'center', gap: SPACING.md }}>
            <Text
              style={{
                color: theme.ink,
                fontFamily: TYPO.weights.bold,
                fontSize: TYPO.sizes.displayHero,
                letterSpacing: -1.2,
                textAlign: 'center',
              }}
            >
              Axis Import
            </Text>
            <Text
              style={{
                color: theme.muted,
                fontFamily: TYPO.weights.medium,
                fontSize: TYPO.sizes.body,
                textAlign: 'center',
                paddingHorizontal: SPACING.lg,
              }}
            >
              Convoyage de véhicules en Europe et envoi de colis vers l'Afrique subsaharienne francophone.
            </Text>
          </View>
        </View>

        <View style={{ gap: SPACING.md }}>
          <Button kind="primary" size="lg" fullWidth onPress={() => nav.navigate('Register')}>
            Créer un compte
          </Button>
          <Button kind="outline" size="lg" fullWidth onPress={() => nav.navigate('Login')}>
            J'ai déjà un compte
          </Button>
          <Button kind="ghost" onPress={() => nav.navigate('TrackByReference')}>
            Suivre un colis sans compte
          </Button>
          <Text
            style={{
              color: theme.muted,
              fontFamily: TYPO.weights.regular,
              fontSize: TYPO.sizes.bodySm,
              textAlign: 'center',
              marginTop: SPACING.sm,
            }}
          >
            En continuant, tu acceptes nos CGU et notre politique de confidentialité.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
