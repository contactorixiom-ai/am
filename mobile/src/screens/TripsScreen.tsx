import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { listParcels, ParcelSummary } from '../api/parcels';
import { DotLoader } from '../components/DotLoader';
import { StatusBadge } from '../components/StatusBadge';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function TripsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [parcels, setParcels] = useState<ParcelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await listParcels();
      setParcels(r.data);
    } catch {
      setParcels([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.navy} />}
      >
        <View>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Mes envois
          </Text>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3, marginTop: 4 }}>
            Suivi en temps réel
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <DotLoader size={8} />
          </View>
        ) : parcels.length === 0 ? (
          <Surface>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.title }}>
              Aucun envoi pour l'instant
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
              Crée ta première demande depuis l'accueil pour voir tes envois apparaître ici.
            </Text>
          </Surface>
        ) : (
          <View style={{ gap: SPACING.md }}>
            {parcels.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => nav.navigate('Tracking', { kind: 'parcel', id: p.id, reference: p.reference })}
              >
                <Surface padded>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, fontVariant: ['tabular-nums'] }}>
                        {p.reference}
                      </Text>
                      <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.title, marginTop: 4 }}>
                        {p.originCity} → {p.destinationCity}
                      </Text>
                      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                        {p.weightKg} kg · {p.originCountry} → {p.destinationCountry}
                      </Text>
                    </View>
                    <StatusBadge status={p.status} />
                  </View>
                </Surface>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
