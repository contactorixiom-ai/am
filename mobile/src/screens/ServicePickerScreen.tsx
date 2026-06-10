import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ServiceCard } from '../components/ServiceCard';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function ServicePickerScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.xl }}>
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Nouvelle demande
          </Text>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5, marginTop: 4 }}>
            Que veux-tu transporter ?
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <ServiceCard
            emoji="🚗"
            title="Voiture"
            subtitle="Convoyage Europe · 0,66 €/km"
            onPress={() => nav.navigate('CarRequest')}
          />
          <ServiceCard
            emoji="🏍️"
            title="Moto"
            subtitle="Convoyage Europe · 0,55 €/km"
            badge="Bientôt"
            disabled
            onPress={() => {}}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <ServiceCard
            emoji="📦"
            title="Colis"
            subtitle="Vers l'Afrique · dès 8,50 €/kg"
            onPress={() => nav.navigate('ParcelRequest')}
          />
          <ServiceCard
            emoji="🚛"
            title="Marchandise"
            subtitle="Export maritime · sur devis"
            badge="Bientôt"
            disabled
            onPress={() => {}}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
