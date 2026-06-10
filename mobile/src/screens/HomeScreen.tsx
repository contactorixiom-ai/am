import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

interface Props {
  onNewRequest: () => void;
}

export function HomeScreen({ onNewRequest }: Props) {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <View>
          <Text
            style={{
              color: theme.muted,
              fontFamily: TYPO.weights.medium,
              fontSize: TYPO.sizes.label,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Bon retour
          </Text>
          <Text
            style={{
              color: theme.ink,
              fontFamily: TYPO.weights.bold,
              fontSize: TYPO.sizes.displayM,
              letterSpacing: -0.5,
              marginTop: 4,
            }}
          >
            Que veux-tu transporter aujourd'hui ?
          </Text>
        </View>

        <Surface>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.title }}>
              Mission en cours
            </Text>
            <Pill tone="good">En route</Pill>
          </View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular, fontSize: TYPO.sizes.bodySm }}>
            Paris → Bruxelles · BMW Série 3 · arrivée prévue 14h32
          </Text>
        </Surface>

        <Button kind="primary" size="lg" fullWidth onPress={onNewRequest}>
          Nouvelle demande
        </Button>

        <View>
          <Text
            style={{
              color: theme.muted,
              fontFamily: TYPO.weights.semibold,
              fontSize: TYPO.sizes.label,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: SPACING.md,
            }}
          >
            Actualités transport
          </Text>
          <Surface>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.title }}>
              Bienvenue sur Axis Import
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
              La plateforme dédiée au convoyage et à l'import-export Europe ↔ Afrique.
            </Text>
          </Surface>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
