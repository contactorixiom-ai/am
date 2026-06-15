import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { notify } from '../utils/notify';
import { createQuote, PickupMode } from '../api/quotes';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { ParcelDraft, RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

const MODES: { kind: PickupMode; emoji: string; title: string; subtitle: string; perKgHint: string; badge?: string }[] = [
  { kind: 'HUB_DROP_OFF',   emoji: '🏢', title: 'Je dépose au hub Axis',           subtitle: 'Paris, Lyon, Marseille',                  perKgHint: 'Gratuit',           badge: 'GRATUIT' },
  { kind: 'RELAY_DROP_OFF', emoji: '🏪', title: 'Je dépose en point relais',        subtitle: 'Mondial Relay, La Poste, Chronopost…',    perKgHint: 'Dès 5 € + 0,25 €/kg' },
  { kind: 'HOME_PICKUP',    emoji: '🚪', title: 'On vient chercher chez moi',       subtitle: 'Enlèvement à domicile sur RDV',           perKgHint: 'Dès 20 € + 0,60 €/kg', badge: 'PREMIUM' },
];

export async function buildQuoteFromDraft(
  draft: ParcelDraft,
  pickupMode: PickupMode,
) {
  return createQuote({
    service: 'PARCEL',
    transportMode: draft.transportMode,
    pickupMode,
    fromCity: draft.from.city,
    fromCountry: draft.from.country,
    fromLatitude: draft.from.latitude,
    fromLongitude: draft.from.longitude,
    toCity: draft.to.city,
    toCountry: draft.to.country,
    toLatitude: draft.to.latitude,
    toLongitude: draft.to.longitude,
    weightKg: draft.weightKg,
  });
}

export function PickupModeScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PickupMode'>>();
  const { draft } = route.params;
  const [mode, setMode] = useState<PickupMode>('HUB_DROP_OFF');
  const [loading, setLoading] = useState(false);

  const goNext = async () => {
    if (mode === 'RELAY_DROP_OFF') {
      nav.navigate('RelayPointPicker', { draft });
      return;
    }
    if (mode === 'HOME_PICKUP') {
      nav.navigate('HomePickupAddress', { draft });
      return;
    }
    // HUB → on génère le devis directement
    setLoading(true);
    try {
      const quote = await buildQuoteFromDraft(draft, 'HUB_DROP_OFF');
      nav.navigate('QuoteReview', { quote });
    } catch (e) {
      const msg = e instanceof ApiError ? ((e instanceof ApiError ? e.message : null) ?? 'Erreur') : 'Erreur réseau.';
      notify('Devis impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Récupération du colis
          </Text>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, marginTop: 4, letterSpacing: -0.3 }}>
            Comment on récupère ton colis ?
          </Text>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
            Cette étape concerne la prise en charge de ton colis en {draft.from.country}.
          </Text>
        </View>

        <View style={{ gap: SPACING.md }}>
          {MODES.map((m) => {
            const active = mode === m.kind;
            return (
              <Pressable key={m.kind} onPress={() => setMode(m.kind)}>
                <Surface padded flat style={{ borderColor: active ? theme.navy : theme.line, backgroundColor: active ? theme.bgSoft : theme.surface }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md }}>
                    <Text style={{ fontSize: 32 }}>{m.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
                          {m.title}
                        </Text>
                        {m.badge ? <Pill tone={m.badge === 'GRATUIT' ? 'good' : 'gold'}>{m.badge}</Pill> : null}
                      </View>
                      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                        {m.subtitle}
                      </Text>
                      <Text style={{ color: active ? theme.navy : theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
                        {m.perKgHint}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: active ? theme.navy : theme.line,
                        backgroundColor: active ? theme.navy : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.surface }} /> : null}
                    </View>
                  </View>
                </Surface>
              </Pressable>
            );
          })}
        </View>

        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 18 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                Notre conseil
              </Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                Le point relais est l'option la plus économique pour les colis &lt; 15 kg. L'enlèvement à domicile est pratique mais coûte 10-15 € de plus.
              </Text>
            </View>
          </View>
        </Surface>

        <Button kind="primary" size="lg" fullWidth onPress={goNext} loading={loading}>
          Continuer
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
