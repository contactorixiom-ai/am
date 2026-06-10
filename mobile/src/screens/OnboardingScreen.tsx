import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { AxisLogo } from '../components/AxisLogo';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

interface Props {
  onClient: () => void;
  onDriver: () => void;
}

export function OnboardingScreen({ onClient, onDriver }: Props) {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, padding: SPACING.xxl, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.xxl }}>
          <AxisLogo size={88} />
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
              Convoyage de véhicules en Europe et envoi de marchandises vers l'Afrique subsaharienne.
            </Text>
          </View>
        </View>

        <View style={{ gap: SPACING.md }}>
          <Button kind="primary" size="lg" fullWidth onPress={onClient}>
            Je veux transporter
          </Button>
          <Button kind="gold" size="lg" fullWidth onPress={onDriver}>
            Je suis convoyeur
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
