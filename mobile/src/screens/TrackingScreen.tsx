import { RouteProp, useRoute } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ParcelSummary, trackParcel } from '../api/parcels';
import { Pill } from '../components/Pill';
import { RouteMap } from '../components/RouteMap';
import { StatusBadge } from '../components/StatusBadge';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function TrackingScreen() {
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Tracking'>>();
  const { kind, reference } = route.params;

  const [parcel, setParcel] = useState<ParcelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (kind === 'parcel') {
        const p = await trackParcel(reference);
        setParcel(p);
      }
    } catch (e) {
      setError(isAxiosError(e) ? 'Impossible de charger le suivi.' : 'Erreur réseau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind, reference]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.navy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.navy} />}
      >
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Suivi · {reference}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
              {kind === 'mission' ? 'Mission convoyage' : 'Envoi colis'}
            </Text>
            {parcel ? <StatusBadge status={parcel.status} /> : null}
          </View>
        </View>

        {error ? (
          <Surface>
            <Text style={{ color: theme.bad, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body }}>
              {error}
            </Text>
          </Surface>
        ) : null}

        {parcel ? (
          <>
            <Surface>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Départ
                  </Text>
                  <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.title, marginTop: 4 }}>
                    {parcel.originCity} · {parcel.originCountry}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Arrivée
                  </Text>
                  <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.title, marginTop: 4 }}>
                    {parcel.destinationCity} · {parcel.destinationCountry}
                  </Text>
                </View>
              </View>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: SPACING.md }}>
                Poids : {parcel.weightKg} kg
              </Text>
            </Surface>

            <View>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACING.md }}>
                Étapes
              </Text>
              {parcel.trackingEvents && parcel.trackingEvents.length > 0 ? (
                <View style={{ gap: SPACING.md }}>
                  {parcel.trackingEvents.map((e, i) => (
                    <Surface key={i} padded flat>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <StatusBadge status={e.status} />
                          {e.location ? (
                            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 6 }}>
                              📍 {e.location}
                            </Text>
                          ) : null}
                          {e.notes ? (
                            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                              {e.notes}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, fontVariant: ['tabular-nums'] }}>
                          {new Date(e.occurredAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        </Text>
                      </View>
                    </Surface>
                  ))}
                </View>
              ) : (
                <Surface>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, textAlign: 'center' }}>
                    Aucune étape pour le moment.
                  </Text>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular, fontSize: TYPO.sizes.bodySm, textAlign: 'center', marginTop: 4 }}>
                    Tu seras notifié à chaque mise à jour.
                  </Text>
                </Surface>
              )}
            </View>
          </>
        ) : null}

        {kind === 'mission' ? (
          <Surface>
            <Pill tone="ghost">Convoyage</Pill>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>
              Suivi GPS temps réel disponible après l'acceptation par un convoyeur.
            </Text>
          </Surface>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
