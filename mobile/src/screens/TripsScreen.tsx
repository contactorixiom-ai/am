import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { listParcels, ParcelSummary } from '../api/parcels';
import { AppBar } from '../components/AppBar';
import { DotLoader } from '../components/DotLoader';
import { EmptyState } from '../components/EmptyState';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { StatusBadge } from '../components/StatusBadge';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

type FilterId = 'all' | 'convoy' | 'parcel' | 'done';

export function TripsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [parcels, setParcels] = useState<ParcelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<FilterId>('all');

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

  const visible = parcels.filter((p) => {
    if (tab === 'all') return true;
    if (tab === 'parcel') return true;
    if (tab === 'done') return p.status === 'DELIVERED';
    return false;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Mes envois" subtitle="Convoyages et colis · suivi temps réel" />

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {([
          { id: 'all',    label: 'Tous' },
          { id: 'convoy', label: 'Convoyage' },
          { id: 'parcel', label: 'Colis' },
          { id: 'done',   label: 'Livrés' },
        ] as { id: FilterId; label: string }[]).map((f) => {
          const on = tab === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setTab(f.id)}
              style={{
                flexShrink: 0, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                borderWidth: 1, borderColor: on ? theme.select : theme.line,
                backgroundColor: on ? theme.select : theme.surface,
              }}
            >
              <Text style={{ fontSize: 13, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.medium }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.navy} />}
      >
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <DotLoader size={8} />
          </View>
        ) : visible.length === 0 && (tab === 'parcel' || tab === 'done') ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey={tab === 'done' ? 'check' : 'box'}
              title={tab === 'done' ? 'Aucun envoi livré' : 'Aucun envoi en cours'}
              subtitle={tab === 'done'
                ? 'Tes envois livrés apparaîtront ici, avec leur PV signé.'
                : 'Crée ta première demande de transport pour la voir apparaître ici.'}
              cta={tab === 'done' ? undefined : { label: 'Nouvelle demande', onPress: () => nav.navigate('ServicePicker') }}
            />
          </Surface>
        ) : (
          visible.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => nav.navigate('Tracking', { kind: 'parcel', id: p.id, reference: p.reference })}
            >
              <Surface padded style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, letterSpacing: 0.7, fontVariant: ['tabular-nums'], textTransform: 'uppercase' }}>
                      {p.reference}
                    </Text>
                    <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: 15, marginTop: 4, letterSpacing: -0.1 }}>
                      {p.originCity} → {p.destinationCity}
                    </Text>
                    <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 2 }}>
                      {p.weightKg} kg · {p.originCountry} → {p.destinationCountry}
                    </Text>
                  </View>
                  <StatusBadge status={p.status} />
                </View>
              </Surface>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
