import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { CARRIER_LABEL, RelayPoint, searchRelayPoints } from '../api/relayPoints';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { buildQuoteFromDraft } from './PickupModeScreen';

export function RelayPointPickerScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RelayPointPicker'>>();
  const { draft } = route.params;
  const { set: setParcelDraft } = useParcelDraft();

  const [points, setPoints] = useState<RelayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RelayPoint | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await searchRelayPoints({
          lat: draft.from.latitude,
          lng: draft.from.longitude,
          country: draft.from.country,
          radius: 30,
          limit: 30,
        });
        setPoints(r);
      } catch {
        setPoints([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [draft.from.country, draft.from.latitude, draft.from.longitude]);

  const goNext = async () => {
    if (!selected) {
      Alert.alert('Sélection requise', 'Choisis un point relais.');
      return;
    }
    setBooking(true);
    try {
      setParcelDraft({
        pickupMode: 'RELAY_DROP_OFF',
        relayPointId: selected.id,
        relayPointLabel: `${selected.name} · ${selected.city}`,
      });
      const quote = await buildQuoteFromDraft(draft, 'RELAY_DROP_OFF');
      nav.navigate('QuoteReview', { quote });
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data?.message ?? 'Erreur') : 'Erreur réseau.';
      Alert.alert('Devis impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setBooking(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Point de dépôt
          </Text>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, marginTop: 4, letterSpacing: -0.3 }}>
            Choisis un point relais
          </Text>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
            Points dans un rayon de 30 km autour de {draft.from.city}.
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.navy} />
          </View>
        ) : points.length === 0 ? (
          <Surface>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body }}>
              Aucun point relais trouvé près de {draft.from.city}. Essaie l'enlèvement à domicile ou le hub Axis.
            </Text>
          </Surface>
        ) : (
          <View style={{ gap: SPACING.md }}>
            {points.map((p) => {
              const active = selected?.id === p.id;
              return (
                <Pressable key={p.id} onPress={() => setSelected(p)}>
                  <Surface padded flat style={{ borderColor: active ? theme.navy : theme.line, backgroundColor: active ? theme.bgSoft : theme.surface }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Pill tone={p.carrier === 'AXIS_HUB' ? 'gold' : 'ghost'}>
                            {CARRIER_LABEL[p.carrier]}
                          </Pill>
                          {p.distanceKm != null ? (
                            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.caption, letterSpacing: 0.4 }}>
                              {p.distanceKm.toFixed(1)} km
                            </Text>
                          ) : null}
                        </View>
                        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>
                          {p.name}
                        </Text>
                        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
                          {p.address} · {p.postalCode} {p.city}
                        </Text>
                        {p.openingHours ? (
                          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular, fontSize: TYPO.sizes.caption, marginTop: 4 }}>
                            🕐 {p.openingHours}
                          </Text>
                        ) : null}
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
                          marginLeft: SPACING.sm,
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
        )}

        <Button kind="primary" size="lg" fullWidth onPress={goNext} loading={booking} disabled={!selected}>
          Calculer le devis
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
