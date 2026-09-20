import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { getMission, listMissions, MissionDetail } from '../api/missions';
import { ParcelSummary, trackParcel } from '../api/parcels';
import { AppBar } from '../components/AppBar';
import { Avatar } from '../components/Avatar';
import { DotLoader } from '../components/DotLoader';
import { Icons } from '../components/Icons';
import { LiveConvoyMap } from '../components/LiveConvoyMap';
import { LiveConvoyPanel } from '../components/LiveConvoyPanel';
import { Pill } from '../components/Pill';
import { StyledRouteMap } from '../components/StyledRouteMap';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { formatEta, missionView, parcelView } from '../utils/shipment';
import { notify } from '../utils/notify';
import { Linking } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { LogisticsPartnerCard } from '../components/LogisticsPartnerCard';
import { selectPartner } from '../utils/logisticsPartners';
import { RADII, SPACING, TYPO } from '../theme/tokens';

// Étapes d'un convoyage, datées par l'historique de statut du serveur.
const CONVOY_STEPS: { status: string; label: string }[] = [
  { status: 'DRAFT', label: 'Demande enregistrée' },
  { status: 'PUBLISHED', label: 'Recherche d\'un convoyeur' },
  { status: 'ACCEPTED', label: 'Convoyeur affecté' },
  { status: 'IN_PROGRESS', label: 'Véhicule en route' },
  { status: 'DELIVERED', label: 'Véhicule livré' },
  { status: 'COMPLETED', label: 'Dossier clôturé' },
];

function convoySteps(mission: MissionDetail | null) {
  if (!mission) return [];
  const at = (status: string): string => {
    const ev = mission.statusHistory?.find((h) => h.status === status);
    const iso = ev?.createdAt
      ?? (status === 'ACCEPTED' ? mission.acceptedAt
        : status === 'IN_PROGRESS' ? mission.startedAt
        : status === 'DELIVERED' ? mission.deliveredAt
        : status === 'COMPLETED' ? mission.completedAt
        : status === 'DRAFT' ? mission.createdAt
        : null);
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ''
      : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  };
  const idx = CONVOY_STEPS.findIndex((t) => t.status === mission.status);
  return CONVOY_STEPS.map((t, i) => ({
    label: t.label,
    sub: '',
    time: at(t.status) || (i > idx ? 'À venir' : ''),
    done: idx >= 0 && i < idx,
    current: i === idx,
  }));
}

// Étapes pour un colis Europe→Afrique : 5 tronçons distincts
function buildParcelLegs(partnerName: string, port: string) {
  return [
    { label: `Enlèvement par ${partnerName}`, sub: 'Premier tronçon — chez toi',          done: true,  current: false },
    { label: `Acheminement au port`,           sub: `${port}`,                              done: true,  current: false },
    { label: 'Consolidation conteneur',        sub: 'Prise en charge Axis maritime',        done: false, current: true  },
    { label: 'Traversée maritime',             sub: 'Marseille → Dakar · 14 jours',         done: false, current: false },
    { label: 'Dédouanement Dakar',             sub: 'BSC + déclaration export',             done: false, current: false },
    { label: 'Livraison destinataire',         sub: 'Remise au destinataire final',         done: false, current: false },
  ];
}

export function TrackingScreen() {
  const { theme } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Tracking'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { kind, reference } = route.params;

  const [parcel, setParcel] = useState<ParcelSummary | null>(null);
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectionStatus, setInspectionStatus] = useState({ departureDone: false, arrivalDone: false });

  // Recharge le statut de chaque état des lieux à chaque focus de l'écran.
  useFocusEffect(useCallback(() => {
    if (kind !== 'mission') return;
    const dep = `axis.inspection.v1.${reference}.DÉPART`;
    const arr = `axis.inspection.v1.${reference}.ARRIVÉE`;
    Promise.all([AsyncStorage.getItem(dep), AsyncStorage.getItem(arr)]).then(([d, a]) => {
      setInspectionStatus({ departureDone: !!d, arrivalDone: !!a });
    });
  }, [kind, reference]));

  const load = useCallback(async () => {
    setError(null);
    try {
      if (kind === 'parcel') {
        const p = await trackParcel(reference);
        setParcel(p);
      } else {
        // L'écran peut être ouvert avec un identifiant ou seulement une
        // référence : on résout les deux cas.
        const id = route.params.id;
        const detail = id && id !== reference
          ? await getMission(id).catch(() => null)
          : await listMissions()
              .then((r) => r.data.find((m) => m.reference === reference) ?? null)
              .then((m) => (m ? getMission(m.id).catch(() => m as MissionDetail) : null))
              .catch(() => null);
        setMission(detail);
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

  const view = mission ? missionView(mission) : null;
  // Trajet du colis sur la carte : uniquement si le serveur a su résoudre
  // les deux villes.
  const parcelRoute =
    parcel?.originLatitude != null && parcel?.originLongitude != null
      && parcel?.destinationLatitude != null && parcel?.destinationLongitude != null
      ? {
          from: { latitude: parcel.originLatitude, longitude: parcel.originLongitude },
          to: { latitude: parcel.destinationLatitude, longitude: parcel.destinationLongitude },
        }
      : null;
  const parcelProgress = parcel ? parcelView(parcel).progress : 0;
  const fromLabel = parcel ? parcel.originCity : mission?.pickupCity ?? '—';
  const toLabel = parcel ? parcel.destinationCity : mission?.deliveryCity ?? '—';
  const vehicleLabel = view?.vehicleLabel ?? 'Véhicule convoyé';
  const driverLabel = view?.driverName ?? 'Convoyeur en cours d\'affectation';

  const callDriver = () => {
    const phone = view?.driverPhone;
    if (!phone) {
      notify('Coordonnées indisponibles', 'Le convoyeur n\'a pas encore communiqué son numéro.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => notify('Appel impossible', phone));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar
        title="Suivi en temps réel"
        subtitle={`${reference}${parcel ? ` · ${parcel.weightKg.toLocaleString('fr-FR')} kg` : ''}`}
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
              driverName={view?.driverName ?? undefined}
              vehicleLabel={view?.vehicleLabel ?? undefined}
              driverPhone={view?.driverPhone}
              totalKm={mission?.distanceKm ?? null}
              statusProgress={view?.progress ?? 0}
              missionId={mission?.id ?? route.params.id}
            />
          ) : parcelRoute ? (
            // Vraie carte : Apple Plans sur iPhone, Google Maps sur Android,
            // OpenStreetMap sur le web. L'illustration ne servait à rien.
            <LiveConvoyMap
              from={parcelRoute.from}
              to={parcelRoute.to}
              progress={parcelProgress}
              height={300}
              fromLabel={fromLabel}
              toLabel={toLabel}
              glyph={parcel?.transportMode === 'SEA' ? '🚢' : '✈️'}
            />
          ) : (
            // Ville inconnue de l'annuaire : on garde l'illustration plutôt
            // qu'une carte centrée n'importe où.
            <StyledRouteMap height={300} progress={parcelProgress} from={fromLabel} to={toLabel} />
          )}
        </View>

        {/* Accès état des lieux DÉPART + ARRIVÉE (mission convoyage) */}
        {kind === 'mission' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 8 }}>
            <InspectionTile
              phase="DÉPART"
              reference={reference}
              done={inspectionStatus.departureDone}
              onPress={() => nav.navigate('VehicleInspection', { phase: 'DÉPART', missionId: mission?.id ?? route.params.id, reference, vehicleLabel })}
            />
            <InspectionTile
              phase="ARRIVÉE"
              reference={reference}
              done={inspectionStatus.arrivalDone}
              locked={!inspectionStatus.departureDone}
              onPress={() => nav.navigate('VehicleInspection', { phase: 'ARRIVÉE', missionId: mission?.id ?? route.params.id, reference, vehicleLabel })}
            />
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
            ● {parcel ? labelStatus(parcel.status) : view?.step ?? '—'}
          </Pill>
          {parcel?.weightKg ? <Pill tone="default">{parcel.weightKg.toLocaleString('fr-FR')} kg</Pill> : null}
          {!parcel && mission?.distanceKm ? <Pill tone="default">{Math.round(mission.distanceKm)} km</Pill> : null}
          <View style={{ flex: 1 }} />
        </View>

        {/* Date d'arrivée : la première chose que le client cherche quand son
            colis met trois semaines à traverser. */}
        {parcel && parcel.status !== 'DELIVERED' && formatEta(parcel.estimatedDelivery) ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Surface padded style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: theme.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.pin size={18} color={theme.goldDeep} stroke={1.9} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 10.5, color: theme.muted, letterSpacing: 0.9, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                  Arrivée prévue
                </Text>
                <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }}>
                  {formatEta(parcel.estimatedDelivery)}
                </Text>
              </View>
            </Surface>
          </View>
        ) : null}

        {error ? (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <Surface padded>
              <Text style={{ color: theme.bad, fontSize: 13, fontFamily: TYPO.weights.medium }}>{error}</Text>
            </Surface>
          </View>
        ) : null}

        {/* Transporteur partenaire (tronçon 1) — uniquement colis */}
        {kind === 'parcel' ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <LogisticsPartnerCard
              partner={{
                ...selectPartner({ fromCountry: parcel?.originCountry, weightKg: parcel?.weightKg, toCountry: parcel?.destinationCountry }),
                // Le numéro de suivi vient du serveur quand Axis l'a reçu du
                // transporteur ; sinon la carte n'en affiche aucun.
                trackingNumber: parcel?.partnerTracking ?? null,
              }}
            />
          </View>
        ) : null}

        {/* Sheet with driver + timeline */}
        <View style={{ padding: 16 }}>
          <Surface padded style={{ padding: 16 }}>
            {/* Driver row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={parcel ? 'Axis Import' : driverLabel} size={48} tone="gold" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                  {parcel ? 'Transporteur Axis' : driverLabel}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={1}>
                  {parcel ? 'Axis Import SAS' : view?.driverPhone ?? vehicleLabel}
                </Text>
              </View>
              <Pressable
                onPress={callDriver}
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
                onPress={() => nav.navigate('Messaging', {
                  driverName: parcel ? 'Axis Import' : driverLabel,
                  subtitle: `${view?.step ?? 'Suivi'} · ${reference}`,
                  // Sans le dossier, l'écran ne peut pas retrouver le vrai fil.
                  missionId: kind === 'mission' ? (mission?.id ?? route.params.id) : undefined,
                  parcelId: kind === 'parcel' ? (parcel?.id ?? route.params.id) : undefined,
                })}
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
            {(kind === 'mission'
              ? convoySteps(mission)
              : parcel?.trackingEvents && parcel.trackingEvents.length > 0
              ? parcel.trackingEvents.map((e, i, arr) => ({
                  label: labelStatus(e.status),
                  sub: e.notes ?? e.location ?? '',
                  time: new Date(e.occurredAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                  done: i < arr.length - 1,
                  current: i === arr.length - 1,
                }))
              : (kind === 'parcel'
                  ? buildParcelLegs(
                      selectPartner({ fromCountry: parcel?.originCountry, weightKg: parcel?.weightKg, toCountry: parcel?.destinationCountry }).name,
                      'Hub Roissy → Port autonome de Marseille',
                    )
                  : []
                ).map((s, i, arr) => ({ ...s, time: i < (arr.length >> 1) ? '' : i === (arr.length >> 1) ? 'En cours' : 'À venir' }))
            ).map((step, i, arr) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                {/* Colonne pastille + trait : le padding vertical vit dans la
                    colonne de texte pour que le trait rejoigne la pastille
                    suivante sans coupure. */}
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
                        marginBottom: 2,
                      }}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i === arr.length - 1 ? 4 : 16 }}>
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

function InspectionTile({
  phase, reference, done, locked, onPress,
}: {
  phase: 'DÉPART' | 'ARRIVÉE';
  reference: string;
  done: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: 12,
        borderRadius: RADII.lg,
        borderWidth: 1.5,
        borderColor: done ? theme.good : locked ? theme.line : theme.gold + '60',
        backgroundColor: locked
          ? theme.surface2
          : done
            ? theme.good + '12'
            : pressed ? theme.bgSoft : theme.surface,
        opacity: locked ? 0.6 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: done ? theme.good : locked ? theme.line : theme.gold,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {done ? <Icons.check size={14} color="#fff" stroke={2.8} /> : <Icons.sig size={14} color={done || locked ? '#fff' : theme.navy} stroke={1.8} />}
        </View>
        <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
          État des lieux
        </Text>
      </View>
      <Text style={{ fontSize: 16, color: theme.ink, fontFamily: TYPO.weights.bold, marginTop: 8 }}>
        {phase === 'DÉPART' ? 'Départ' : 'Arrivée'}
      </Text>
      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
        {done ? '✓ Signé bilatéralement' : locked ? 'Disponible après le départ' : 'À réaliser'}
      </Text>
    </Pressable>
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
