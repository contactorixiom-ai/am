import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { ParcelSummary, trackParcel } from '../api/parcels';
import { AppBar } from '../components/AppBar';
import { Avatar } from '../components/Avatar';
import { DotLoader } from '../components/DotLoader';
import { Icons } from '../components/Icons';
import { LiveConvoyPanel } from '../components/LiveConvoyPanel';
import { Pill } from '../components/Pill';
import { StyledRouteMap } from '../components/StyledRouteMap';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

// Étapes par défaut si pas de tracking events (mission convoyage)
const DEFAULT_STEPS = [
  { label: 'Demande validée',            sub: 'Confirmation des informations',         done: true,  current: false },
  { label: 'État des lieux signé',       sub: 'Par le chauffeur — état impeccable',     done: true,  current: false },
  { label: 'En route',                    sub: '47 km restants · arrivée 14h32',         done: false, current: true  },
  { label: "État des lieux d'arrivée",    sub: 'Prévu 14h32',                            done: false, current: false },
  { label: 'Livré',                       sub: '—',                                       done: false, current: false },
];

export function TrackingScreen() {
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Tracking'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      setError(e instanceof ApiError ? 'Impossible de charger le suivi.' : 'Erreur réseau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind, reference]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <DotLoader size={8} />
      </SafeAreaView>
    );
  }

  const fromLabel = parcel ? parcel.originCity : 'Paris';
  const toLabel = parcel ? parcel.destinationCity : 'Bruxelles';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title="Suivi en temps réel"
        subtitle={`${reference}${parcel ? ` · ${parcel.weightKg} kg` : ''}`}
        trailing={
          <Pressable
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: pressed ? theme.line : theme.bgSoft,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Icons.more size={18} color={theme.ink} stroke={1.8} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={theme.navy}
          />
        }
      >
        {/* Map + suivi temps réel chauffeur (mission convoyage) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {kind === 'mission' ? (
            <LiveConvoyPanel
              from={{ latitude: 48.8566, longitude: 2.3522 }}
              to={{ latitude: 50.8503, longitude: 4.3517 }}
              fromLabel={fromLabel}
              toLabel={toLabel}
              driverName="Karim Diallo"
              vehicleLabel="BMW Série 3 · AX-2847"
            />
          ) : (
            <StyledRouteMap height={300} progress={parcel ? 0.4 : 0.78} from={fromLabel} to={toLabel} />
          )}
        </View>

        {/* Accès état des lieux (mission convoyage) */}
        {kind === 'mission' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Pressable
              onPress={() => nav.navigate('VehicleInspection', { phase: 'DÉPART', reference, vehicleLabel: 'BMW Série 3 · AX-2847' })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: RADII.lg,
                borderWidth: 1,
                borderColor: theme.line,
                backgroundColor: pressed ? theme.bgSoft : theme.surface,
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.sig size={20} color={theme.goldHi} stroke={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                  État des lieux électronique
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                  Marquage des dommages, photos et signatures
                </Text>
              </View>
              <Icons.chev size={18} color={theme.muted} stroke={1.8} />
            </Pressable>
          </View>
        ) : null}

        {/* Status strip */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Pill tone={parcel?.status === 'IN_TRANSIT' ? 'navy' : 'gold'}>
            ● {parcel ? labelStatus(parcel.status) : 'En route'}
          </Pill>
          {parcel?.weightKg ? <Pill tone="default">{parcel.weightKg} kg</Pill> : <Pill tone="default">312 km</Pill>}
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
            MAJ il y a 12 s
          </Text>
        </View>

        {error ? (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <Surface padded>
              <Text style={{ color: theme.bad, fontSize: 13, fontFamily: TYPO.weights.medium }}>{error}</Text>
            </Surface>
          </View>
        ) : null}

        {/* Sheet with driver + timeline */}
        <View style={{ padding: 16 }}>
          <Surface padded style={{ padding: 16 }}>
            {/* Driver row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={parcel ? 'A B' : 'Karim Diallo'} size={48} tone="gold" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                  {parcel ? 'Transporteur Axis' : 'Karim Diallo'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  <Icons.star size={12} color={theme.gold} stroke={2} />
                  <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                    4.9 · 142 convoyages · Chauffeur Axis
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.line,
                  backgroundColor: pressed ? theme.bgSoft : theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <Icons.phone size={18} color={theme.ink} stroke={1.8} />
              </Pressable>
              <Pressable
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: pressed ? theme.navyDeep : theme.navy,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <Icons.chat size={18} color="#F5F1E8" stroke={1.8} />
              </Pressable>
            </View>

            <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 14 }} />

            {/* Timeline verticale */}
            {(parcel?.trackingEvents && parcel.trackingEvents.length > 0
              ? parcel.trackingEvents.map((e, i, arr) => ({
                  label: labelStatus(e.status),
                  sub: e.notes ?? e.location ?? '',
                  time: new Date(e.occurredAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                  done: i < arr.length - 1,
                  current: i === arr.length - 1,
                }))
              : DEFAULT_STEPS.map((s, i) => ({ ...s, time: i < 2 ? '22 mai · 11:08' : i === 2 ? 'Maintenant' : 'Prévu' }))
            ).map((step, i, arr) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, paddingBottom: i === arr.length - 1 ? 0 : 14 }}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: step.done ? theme.good : step.current ? theme.gold : theme.bgSoft,
                      borderWidth: 2,
                      borderColor: step.done ? theme.good : step.current ? theme.gold : theme.line,
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...(step.current && {
                        shadowColor: theme.gold,
                        shadowOpacity: 0.18,
                        shadowRadius: 4,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 4,
                      }),
                    }}
                  >
                    {step.done ? <Icons.check size={10} color="#fff" stroke={3} /> : null}
                  </View>
                  {i < arr.length - 1 ? (
                    <View
                      style={{
                        flex: 1,
                        width: 1.5,
                        backgroundColor: step.done ? theme.good : theme.line,
                        marginTop: 2,
                      }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 4 }}>
                  <Text
                    style={{
                      fontSize: 13.5,
                      color: step.done || step.current ? theme.ink : theme.muted,
                      fontFamily: step.current ? TYPO.weights.semibold : TYPO.weights.medium,
                    }}
                  >
                    {step.label}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 1, fontFamily: TYPO.weights.medium }}>
                    {step.time}
                  </Text>
                  {step.sub ? (
                    <Text style={{ fontSize: 12, color: theme.inkSoft, marginTop: 4, fontFamily: TYPO.weights.regular }}>
                      {step.sub}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Surface>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function labelStatus(s: string): string {
  switch (s) {
    case 'DRAFT': return 'Brouillon';
    case 'AWAITING_DROP_OFF': return 'À déposer';
    case 'AWAITING_PICKUP': return 'À récupérer';
    case 'RECEIVED': return 'Reçu au hub';
    case 'IN_TRANSIT': return 'En transit';
    case 'CUSTOMS': return 'Douane';
    case 'OUT_FOR_DELIVERY': return 'En livraison';
    case 'DELIVERED': return 'Livré';
    case 'CANCELLED': return 'Annulé';
    case 'LOST': return 'Perdu';
    default: return s;
  }
}
