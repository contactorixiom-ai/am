import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function DocumentsScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Documents
          </Text>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3, marginTop: 4 }}>
            Contrats, factures, douane
          </Text>
        </View>

        <Surface>
          <View style={{ gap: SPACING.md }}>
            <Pill tone="ghost">Bientôt disponible</Pill>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
              Cette section regroupera :
            </Text>
            <Bullet label="Contrats de convoyage signés" />
            <Bullet label="Factures TTC" />
            <Bullet label="Lettres de transport (CMR)" />
            <Bullet label="Documents douaniers (export Afrique)" />
            <Bullet label="États des lieux véhicules" />
          </View>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: theme.gold, fontFamily: TYPO.weights.bold }}>•</Text>
      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, flex: 1 }}>{label}</Text>
    </View>
  );
}
