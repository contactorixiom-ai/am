import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { listMissions, MissionSummary } from '../api/missions';
import { listParcels, ParcelSummary } from '../api/parcels';
import { AppBar } from '../components/AppBar';
import { DotLoader } from '../components/DotLoader';
import { EmptyState } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { StatusBadge } from '../components/StatusBadge';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

type FilterId = 'all' | 'convoy' | 'parcel' | 'done';

// Vue unifiée : on fusionne missions (convoyage) et colis dans une seule liste
// triée, en gardant le type d'origine pour le rendu et le routage du tracking.
type Item =
  | { kind: 'mission'; data: MissionSummary }
  | { kind: 'parcel'; data: ParcelSummary };

const DONE_STATUSES = new Set(['DELIVERED', 'COMPLETED']);

export function TripsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [parcels, setParcels] = useState<ParcelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<FilterId>('all');

  const load = useCallback(async () => {
    // Chargement en parallèle + repli gracieux : si l'un des deux appels
    // échoue (hors-ligne, droits), on garde l'autre plutôt que de tout vider.
    const [mRes, pRes] = await Promise.allSettled([listMissions(), listParcels()]);
    setMissions(mRes.status === 'fulfilled' ? mRes.value.data : []);
    setParcels(pRes.status === 'fulfilled' ? pRes.value.data : []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items: Item[] = [
    ...missions.map((m): Item => ({ kind: 'mission', data: m })),
    ...parcels.map((p): Item => ({ kind: 'parcel', data: p })),
  ];

  const visible = items.filter((it) => {
    if (tab === 'all') return true;
    if (tab === 'convoy') return it.kind === 'mission';
    if (tab === 'parcel') return it.kind === 'parcel';
    if (tab === 'done') return DONE_STATUSES.has(it.data.status);
    return false;
  });

  const emptyTitle = tab === 'done' ? 'Aucun envoi livré'
    : tab === 'convoy' ? 'Aucun convoyage'
    : tab === 'parcel' ? 'Aucun colis'
    : 'Aucun envoi en cours';
  const emptySubtitle = tab === 'done'
    ? 'Tes envois livrés apparaîtront ici, avec leur PV signé.'
    : 'Crée ta première demande de transport pour la voir apparaître ici.';

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
        ) : visible.length === 0 ? (
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey={tab === 'done' ? 'check' : tab === 'convoy' ? 'truck' : 'box'}
              title={emptyTitle}
              subtitle={emptySubtitle}
              cta={tab === 'done' ? undefined : { label: 'Nouvelle demande', onPress: () => nav.navigate('ServicePicker') }}
            />
          </Surface>
        ) : (
          visible.map((it) =>
            it.kind === 'mission'
              ? <MissionCard key={`m-${it.data.id}`} mission={it.data} onPress={() => nav.navigate('Tracking', { kind: 'mission', id: it.data.id, reference: it.data.reference })} />
              : <ParcelCard key={`p-${it.data.id}`} parcel={it.data} onPress={() => nav.navigate('Tracking', { kind: 'parcel', id: it.data.id, reference: it.data.reference })} />
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MissionCard({ mission: m, onPress }: { mission: MissionSummary; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Surface padded style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pill tone="navy">Convoyage</Pill>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, letterSpacing: 0.7, fontVariant: ['tabular-nums'], textTransform: 'uppercase' }}>
                {m.reference}
              </Text>
            </View>
            <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: 15, marginTop: 6, letterSpacing: -0.1 }}>
              {m.pickupCity} → {m.deliveryCity}
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 2 }}>
              {m.vehicle.make} {m.vehicle.model} · {m.pickupCountry} → {m.deliveryCountry}
            </Text>
          </View>
          <StatusBadge status={m.status} />
        </View>
      </Surface>
    </Pressable>
  );
}

function ParcelCard({ parcel: p, onPress }: { parcel: ParcelSummary; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Surface padded style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pill tone="gold">Colis</Pill>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, letterSpacing: 0.7, fontVariant: ['tabular-nums'], textTransform: 'uppercase' }}>
                {p.reference}
              </Text>
            </View>
            <Text numberOfLines={1} style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: 15, marginTop: 6, letterSpacing: -0.1 }}>
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
  );
}
