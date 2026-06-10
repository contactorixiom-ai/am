import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { City } from '../api/quotes';
import { Button } from '../components/Button';
import { CityPicker } from '../components/CityPicker';
import { Field } from '../components/Field';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

type Mode = 'AIR' | 'SEA';

const CATEGORIES = [
  { value: 'PERSONAL_EFFECTS', label: 'Effets personnels', emoji: '🎁' },
  { value: 'ELECTRONICS',      label: 'Électronique',      emoji: '📱' },
  { value: 'CLOTHING',         label: 'Vêtements',         emoji: '👕' },
  { value: 'FOOD',             label: 'Alimentaire',       emoji: '🥫' },
  { value: 'DOCUMENTS',        label: 'Documents',         emoji: '📄' },
  { value: 'COMMERCIAL_GOODS', label: 'Marchandise',       emoji: '📦' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

export function ParcelRequestScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [from, setFrom] = useState<City | null>(null);
  const [to, setTo] = useState<City | null>(null);
  const [weight, setWeight] = useState('');
  const [category, setCategory] = useState<Category>('PERSONAL_EFFECTS');
  const [mode, setMode] = useState<Mode>('AIR');

  const submit = () => {
    if (!from || !to) {
      Alert.alert('Trajet incomplet', 'Choisis une ville de départ et d\'arrivée.');
      return;
    }
    const kg = parseFloat(weight.replace(',', '.'));
    if (!kg || kg <= 0) {
      Alert.alert('Poids invalide', 'Indique un poids supérieur à 0.');
      return;
    }
    nav.navigate('PickupMode', {
      draft: {
        from,
        to,
        weightKg: kg,
        category,
        transportMode: mode,
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
          <View>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Envoi colis
            </Text>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, marginTop: 4, letterSpacing: -0.3 }}>
              Vers l'Afrique subsaharienne
            </Text>
          </View>

          <Surface>
            <View style={{ gap: SPACING.md }}>
              <CityPicker label="Ville de départ (Europe)" value={from} onChange={setFrom} region="EU" />
              <CityPicker label="Ville d'arrivée (Afrique)" value={to} onChange={setTo} region="AFRICA" />
            </View>
          </Surface>

          <Surface>
            <View style={{ gap: SPACING.md }}>
              <Field
                label="Poids (kg)"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder="ex: 5"
                hint="Aérien : minimum 1 kg · Maritime : à partir de 20 kg"
              />
              <View>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  Catégorie
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map((c) => {
                    const active = category === c.value;
                    return (
                      <Pressable
                        key={c.value}
                        onPress={() => setCategory(c.value)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: RADII.pill,
                          borderWidth: 1,
                          borderColor: active ? theme.navy : theme.line,
                          backgroundColor: active ? theme.navy : 'transparent',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                        <Text style={{ color: active ? theme.surface : theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Surface>

          <Surface>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase', marginBottom: SPACING.md }}>
              Mode de transport
            </Text>
            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <Pressable
                onPress={() => setMode('AIR')}
                style={{
                  flex: 1,
                  padding: SPACING.md,
                  borderRadius: RADII.md,
                  borderWidth: 1,
                  borderColor: mode === 'AIR' ? theme.navy : theme.line,
                  backgroundColor: mode === 'AIR' ? theme.bgSoft : 'transparent',
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 20 }}>✈️</Text>
                  {mode === 'AIR' ? <Pill tone="navy">Choisi</Pill> : null}
                </View>
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>Aérien</Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
                  Rapide · 5-10 jours · dès 8,50 €/kg
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('SEA')}
                style={{
                  flex: 1,
                  padding: SPACING.md,
                  borderRadius: RADII.md,
                  borderWidth: 1,
                  borderColor: mode === 'SEA' ? theme.navy : theme.line,
                  backgroundColor: mode === 'SEA' ? theme.bgSoft : 'transparent',
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 20 }}>🚢</Text>
                  {mode === 'SEA' ? <Pill tone="navy">Choisi</Pill> : null}
                </View>
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>Maritime</Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
                  Économique · 30-45 jours · dès 4,50 €/kg
                </Text>
              </Pressable>
            </View>
          </Surface>

          <Button kind="primary" size="lg" fullWidth onPress={submit}>
            Étape suivante : récupération
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
