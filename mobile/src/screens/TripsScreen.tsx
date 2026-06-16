import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { listParcels, ParcelSummary } from '../api/parcels';
import { AppBar } from '../components/AppBar';
import { DotLoader } from '../components/DotLoader';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { StatusBadge } from '../components/StatusBadge';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

// Démo : une mission convoyage active si on n'a aucune donnée backend.
const DEMO_MISSION = {
  ref: 'AX-2847',
  from: 'Paris 15ᵉ',
  to: 'Bruxelles, Schaerbeek',
  eta: '14h32',
  remaining: '47 km',
  progress: 0.78,
};

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
        {/* Carte mission active (démo) */}
        {(tab === 'all' || tab === 'convoy') ? (
          <Pressable
            onPress={() => nav.navigate('Tracking', { kind: 'mission', id: DEMO_MISSION.ref, reference: DEMO_MISSION.ref })}
          >
            <Surface padded style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Pill tone="navy">● En route</Pill>
                <Text style={{ fontSize: 11.5, color: theme.muted, letterSpacing: 0.7, textTransform: 'uppercase', fontFamily: TYPO.weights.medium, fontVariant: ['tabular-nums'] }}>
                  {DEMO_MISSION.ref}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: theme.ink, fontFamily: TYPO.weights.bold, letterSpacing: -0.2, lineHeight: 22 }}>
                {DEMO_MISSION.from} <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular }}>vers</Text> {DEMO_MISSION.to}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 18 }}>
                <View>
                  <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.medium }}>
                    Arrivée
                  </Text>
                  <Text style={{ fontSize: 18, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }}>
                    {DEMO_MISSION.eta}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.medium }}>
                    Restant
                  </Text>
                  <Text style={{ fontSize: 18, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }}>
                    {DEMO_MISSION.remaining}
                  </Text>
                </View>
              </View>
              <View style={{ height: 4, backgroundColor: theme.bgSoft, borderRadius: 2, marginTop: 12 }}>
                <View style={{ width: `${DEMO_MISSION.progress * 100}%`, height: '100%', backgroundColor: theme.gold, borderRadius: 2 }} />
              </View>
            </Surface>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <DotLoader size={8} />
          </View>
        ) : visible.length === 0 && (tab === 'parcel' || tab === 'done') ? (
          <Surface padded style={{ padding: 18, alignItems: 'center', gap: 6 }}>
            <Icons.box size={26} color={theme.muted} stroke={1.5} />
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.title, marginTop: 8 }}>
              Aucun envoi
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
              {tab === 'done'
                ? 'Tes envois livrés apparaîtront ici.'
                : 'Crée ta première demande depuis l\'accueil pour voir tes envois ici.'}
            </Text>
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
