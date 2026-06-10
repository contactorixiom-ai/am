import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Bon retour
          </Text>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5, marginTop: 4 }}>
            {user ? `Salut ${user.firstName}` : 'Que veux-tu transporter ?'}
          </Text>
        </View>

        <Surface>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
                Nouvelle demande
              </Text>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, marginTop: 6, letterSpacing: -0.3 }}>
                Convoyer une voiture ou envoyer un colis ?
              </Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
                Devis instantané en moins de 30 secondes.
              </Text>
            </View>
            <Pill tone="gold">Instantané</Pill>
          </View>
          <View style={{ marginTop: SPACING.lg }}>
            <Button kind="primary" size="lg" fullWidth onPress={() => nav.navigate('ServicePicker')}>
              Commencer
            </Button>
          </View>
        </Surface>

        <View>
          <SectionHead title="Nos services" />
          <View style={{ gap: SPACING.md }}>
            <ServiceLine
              emoji="🚗"
              title="Convoyage de véhicule"
              subtitle="0,66 €/km HT · partout en Europe"
            />
            <ServiceLine
              emoji="📦"
              title="Envoi de colis"
              subtitle="Dès 8,50 €/kg HT · aérien ou maritime vers l'Afrique"
            />
            <ServiceLine
              emoji="🚛"
              title="Marchandise"
              subtitle="Export maritime Europe → Afrique"
              soon
            />
          </View>
        </View>

        <View>
          <SectionHead title="Pourquoi Axis Import" />
          <Surface>
            <View style={{ gap: SPACING.md }}>
              <Bullet label="État des lieux numérique avec photos avant/après" />
              <Bullet label="Suivi GPS en temps réel" />
              <Bullet label="Contrat signé électroniquement" />
              <Bullet label="Convoyeurs vérifiés et assurés" />
            </View>
          </Surface>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceLine({ emoji, title, subtitle, soon }: { emoji: string; title: string; subtitle: string; soon?: boolean }) {
  const { theme } = useTheme();
  return (
    <Surface padded>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.title }}>{title}</Text>
            {soon ? <Pill tone="ghost">Bientôt</Pill> : null}
          </View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

function Bullet({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <Text style={{ color: theme.gold, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.body }}>✓</Text>
      <Text style={{ color: theme.ink, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, flex: 1 }}>{label}</Text>
    </View>
  );
}
