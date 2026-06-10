import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';
import { createQuote, QuoteResponse } from '../api/quotes';

const fmtEur = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

export function QuoteScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const [fromCity, setFromCity] = useState('Paris');
  const [toCity, setToCity] = useState('Bruxelles');
  const [distance, setDistance] = useState('312');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);

  const handleCalc = async () => {
    setLoading(true);
    try {
      const r = await createQuote({
        service: 'CONVOY_CAR',
        fromCity,
        fromCountry: 'FR',
        toCity,
        toCountry: 'BE',
        distanceKm: parseFloat(distance) || 0,
      });
      setQuote(r);
    } catch (e: unknown) {
      Alert.alert('Erreur', 'Impossible de calculer le devis. Vérifie que le backend tourne.');
    } finally {
      setLoading(false);
    }
  };

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
            Devis instantané
          </Text>
          <Text
            style={{
              color: theme.ink,
              fontFamily: TYPO.weights.bold,
              fontSize: TYPO.sizes.displayS,
              letterSpacing: -0.4,
              marginTop: 4,
            }}
          >
            Convoyage voiture
          </Text>
        </View>

        <Surface>
          <View style={{ gap: SPACING.md }}>
            <LabeledInput label="Ville de départ" value={fromCity} onChangeText={setFromCity} />
            <LabeledInput label="Ville d'arrivée" value={toCity} onChangeText={setToCity} />
            <LabeledInput
              label="Distance estimée (km)"
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
            />
          </View>
        </Surface>

        <Button kind="primary" size="lg" fullWidth onPress={handleCalc} loading={loading}>
          Calculer le devis
        </Button>

        {quote ? (
          <Surface>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
                  Total estimé
                </Text>
                <Text
                  style={{
                    color: theme.ink,
                    fontFamily: TYPO.weights.bold,
                    fontSize: TYPO.sizes.displayHero,
                    letterSpacing: -1.2,
                    marginTop: 4,
                  }}
                >
                  {fmtEur(quote.totalCents)}
                </Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                  TVA incluse · Réf {quote.reference}
                </Text>
              </View>
              <Pill tone="gold">Instantané</Pill>
            </View>
            {quote.disclaimer ? (
              <Text style={{ color: theme.warn, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: SPACING.md }}>
                {quote.disclaimer}
              </Text>
            ) : null}
          </Surface>
        ) : null}

        <Button kind="ghost" onPress={onBack}>
          Retour
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Text
        style={{
          color: theme.muted,
          fontFamily: TYPO.weights.medium,
          fontSize: TYPO.sizes.label,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
        style={{
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: RADII.md,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
          color: theme.ink,
          fontFamily: TYPO.weights.medium,
          fontSize: TYPO.sizes.body,
        }}
        placeholderTextColor={theme.faint}
      />
    </View>
  );
}
