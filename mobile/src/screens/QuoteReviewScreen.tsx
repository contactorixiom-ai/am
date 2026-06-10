import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { QuoteHint } from '../api/quotes';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { RouteMap } from '../components/RouteMap';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { fmtEur, fmtLocal } from '../utils/currency';

export function QuoteReviewScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'QuoteReview'>>();
  const { quote } = route.params;
  const { draft: parcelDraft } = useParcelDraft();

  const isConvoy = quote.service === 'CONVOY_CAR' || quote.service === 'CONVOY_MOTO';
  const isParcel = quote.service === 'PARCEL' || quote.service === 'MERCHANDISE';

  const totalLocal = fmtLocal(quote.totalCents, quote.toCountry);

  const handleBook = () => {
    if (isConvoy) {
      Alert.alert(
        'Bientôt disponible',
        'La réservation de convoyage nécessite l\'enregistrement préalable d\'un véhicule. Cette étape sera ajoutée au prochain sprint.',
      );
      return;
    }
    if (isParcel) {
      nav.navigate('RecipientDetails', { quote });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Devis · {quote.reference}
          </Text>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, marginTop: 4, letterSpacing: -0.5 }}>
            {fmtEur(quote.totalCents)}
          </Text>
          {totalLocal ? (
            <Text style={{ color: theme.gold, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 4, fontVariant: ['tabular-nums'] }}>
              ≈ {totalLocal} pour le destinataire
            </Text>
          ) : null}
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
            TVA incluse · valide 30 jours
          </Text>
        </View>

        {quote.fromLatitude && quote.fromLongitude && quote.toLatitude && quote.toLongitude ? (
          <RouteMap
            from={{ latitude: quote.fromLatitude, longitude: quote.fromLongitude }}
            to={{ latitude: quote.toLatitude, longitude: quote.toLongitude }}
            fromLabel={quote.fromCity}
            toLabel={quote.toCity}
            height={220}
          />
        ) : null}

        <Surface>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
                Départ
              </Text>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.title, marginTop: 4 }}>
                {quote.fromCity}
              </Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
                {quote.fromCountry}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
                Arrivée
              </Text>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.title, marginTop: 4 }}>
                {quote.toCity}
              </Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
                {quote.toCountry}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: SPACING.md, gap: 4 }}>
            {quote.distanceKm ? (
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, textAlign: 'center' }}>
                {Math.round(quote.distanceKm).toLocaleString('fr-FR')} km · trajet estimé
              </Text>
            ) : null}
            {isParcel ? (
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, textAlign: 'center' }}>
                {quote.transportMode === 'AIR' ? '✈️ Aérien · 5-10 jours' : '🚢 Maritime · 30-45 jours'} · {pickupModeLabel(quote.pickupMode, parcelDraft.relayPointLabel)}
              </Text>
            ) : null}
          </View>
        </Surface>

        <Surface>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase', marginBottom: SPACING.md }}>
            Décomposition
          </Text>
          <Row label={isConvoy ? `Forfait + ${quote.distanceKm ? Math.round(quote.distanceKm) : 0} km` : `Transport (${quote.weightKg} kg)`} value={fmtEur(quote.basePriceCents + quote.variablePriceCents)} />
          {quote.pickupFeeCents > 0 ? (
            <Row label="Récupération du colis" value={`+ ${fmtEur(quote.pickupFeeCents)}`} />
          ) : null}
          {quote.options.map((o) => (
            <Row key={o.kind} label={o.label} value={`+ ${fmtEur(o.priceCents)}`} />
          ))}
          <Divider />
          <Row label="Sous-total HT" value={fmtEur(quote.subtotalCents)} />
          <Row label={`TVA (${Math.round(0.2 * 100)} %)`} value={fmtEur(quote.totalCents - quote.subtotalCents)} muted />
          <Divider />
          <Row label="Total TTC" value={fmtEur(quote.totalCents)} bold />
          {quote.disclaimer ? (
            <View style={{ marginTop: SPACING.md, padding: SPACING.md, backgroundColor: theme.warn + '15', borderRadius: 10, borderWidth: 1, borderColor: theme.warn + '40' }}>
              <Text style={{ color: theme.warn, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                ⚠️ {quote.disclaimer}
              </Text>
            </View>
          ) : null}
        </Surface>

        {quote.hints && quote.hints.length > 0 ? (
          <View>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACING.md }}>
              Recommandations Axis
            </Text>
            <View style={{ gap: SPACING.md }}>
              {quote.hints.map((h, i) => (
                <HintCard key={i} hint={h} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: SPACING.md }}>
          <Button kind="primary" size="lg" fullWidth onPress={handleBook}>
            Réserver
          </Button>
          <Button kind="ghost" onPress={() => nav.goBack()}>
            Modifier le devis
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HintCard({ hint }: { hint: QuoteHint }) {
  const { theme } = useTheme();
  const emoji = HINT_EMOJI[hint.kind] ?? '💡';
  return (
    <Surface padded flat>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
            {hint.label}
          </Text>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
            {hint.detail}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

const HINT_EMOJI: Record<string, string> = {
  SAVE_WITH_SEA: '🚢',
  FAST_WITH_AIR: '✈️',
  CHEAPER_AT_RELAY: '🏪',
  INSURANCE_RECOMMENDED: '🛡️',
  CONSOLIDATE: '📦',
};

function pickupModeLabel(mode: string, relayLabel?: string): string {
  switch (mode) {
    case 'HUB_DROP_OFF':   return '🏢 Dépôt hub Axis';
    case 'RELAY_DROP_OFF': return relayLabel ? `🏪 ${relayLabel}` : '🏪 Point relais';
    case 'HOME_PICKUP':    return '🚪 Enlèvement domicile';
    default:               return '';
  }
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: muted ? theme.muted : theme.ink, fontFamily: bold ? TYPO.weights.bold : TYPO.weights.medium, fontSize: bold ? TYPO.sizes.title : TYPO.sizes.body, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: muted ? theme.muted : theme.ink, fontFamily: bold ? TYPO.weights.bold : TYPO.weights.semibold, fontSize: bold ? TYPO.sizes.title : TYPO.sizes.body, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  const { theme } = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 8 }} />;
}
