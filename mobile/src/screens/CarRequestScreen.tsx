import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { City, createQuote, QuoteOptionKind } from '../api/quotes';
import { Button } from '../components/Button';
import { CityPicker } from '../components/CityPicker';
import { Field } from '../components/Field';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

const OPTIONS: { kind: QuoteOptionKind; label: string; hint: string }[] = [
  { kind: 'EXPRESS',           label: 'Express 24h',           hint: '+22 %' },
  { kind: 'PREMIUM_INSURANCE', label: 'Assurance Premium',     hint: '+35 € · plafond 500 k€' },
  { kind: 'DOOR_TO_DOOR',      label: 'Porte-à-porte',         hint: '+15 %' },
  { kind: 'WEEKEND_PICKUP',    label: 'Enlèvement weekend',    hint: '+40 €' },
];

export function CarRequestScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [from, setFrom] = useState<City | null>(null);
  const [to, setTo] = useState<City | null>(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<QuoteOptionKind>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleOption = (k: QuoteOptionKind) =>
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const submit = async () => {
    if (!from || !to) {
      Alert.alert('Trajet incomplet', 'Choisis une ville de départ et d\'arrivée.');
      return;
    }
    setLoading(true);
    try {
      const quote = await createQuote({
        service: 'CONVOY_CAR',
        fromCity: from.city,
        fromCountry: from.country,
        fromLatitude: from.latitude,
        fromLongitude: from.longitude,
        toCity: to.city,
        toCountry: to.country,
        toLatitude: to.latitude,
        toLongitude: to.longitude,
        options: Array.from(selectedOptions),
      });
      nav.navigate('QuoteReview', { quote });
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data?.message ?? 'Erreur') : 'Erreur réseau.';
      Alert.alert('Devis impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
          <View>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Convoyage voiture
            </Text>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, marginTop: 4, letterSpacing: -0.3 }}>
              Détails du trajet
            </Text>
          </View>

          <Surface>
            <View style={{ gap: SPACING.md }}>
              <CityPicker label="Ville de départ" value={from} onChange={setFrom} region="EU" />
              <CityPicker label="Ville d'arrivée" value={to} onChange={setTo} region="EU" />
            </View>
          </Surface>

          <Surface>
            <View style={{ gap: SPACING.md }}>
              <Field label="Marque" value={vehicleMake} onChangeText={setVehicleMake} placeholder="BMW, Peugeot…" />
              <Field label="Modèle" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Série 3, 308…" />
            </View>
          </Surface>

          <View>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACING.md }}>
              Options
            </Text>
            <View style={{ gap: 8 }}>
              {OPTIONS.map((o) => {
                const active = selectedOptions.has(o.kind);
                return (
                  <Surface key={o.kind} padded flat style={{ borderColor: active ? theme.navy : theme.line, backgroundColor: active ? theme.bgSoft : theme.surface }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>{o.label}</Text>
                        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>{o.hint}</Text>
                      </View>
                      <Pill tone={active ? 'navy' : 'ghost'}>{active ? 'Ajoutée' : 'Ajouter'}</Pill>
                    </View>
                    <Pressable onPress={() => toggleOption(o.kind)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADII.lg }} />
                  </Surface>
                );
              })}
            </View>
          </View>

          <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
            Calculer le devis
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

