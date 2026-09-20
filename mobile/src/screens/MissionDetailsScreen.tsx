import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { getMission, listMissions, MissionDetail } from '../api/missions';
import { AppBar } from '../components/AppBar';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { Skeleton } from '../components/Skeleton';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { missionView } from '../utils/shipment';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

// Étapes du dossier, dans l'ordre où le client les vit. Chacune est datée
// par l'historique de statut renvoyé par le serveur — rien n'est simulé.
const TIMELINE_STEPS: { status: string; label: string }[] = [
  { status: 'DRAFT', label: 'Demande enregistrée' },
  { status: 'PUBLISHED', label: 'Recherche d\'un convoyeur' },
  { status: 'ACCEPTED', label: 'Convoyeur affecté' },
  { status: 'IN_PROGRESS', label: 'Véhicule récupéré — en route' },
  { status: 'DELIVERED', label: 'Véhicule livré' },
  { status: 'COMPLETED', label: 'Dossier clôturé' },
];

const fmtDateTime = (iso?: string | null): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'default', PUBLISHED: 'default', ACCEPTED: 'gold', IN_PROGRESS: 'gold',
  DELIVERED: 'good', COMPLETED: 'good', CANCELLED: 'bad', DISPUTED: 'bad',
};

export function MissionDetailsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MissionDetails'>>();
  const reference = route.params?.reference ?? '';

  // Le dossier est ouvert par référence : on la résout en identifiant via la
  // liste, puis on charge le détail (historique de statut compris).
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listMissions();
        const found = res.data.find((m) => m.reference === reference) ?? res.data[0];
        if (!found) { if (!cancelled) setLoading(false); return; }
        const detail = await getMission(found.id).catch(() => found as MissionDetail);
        if (!cancelled) { setMission(detail); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reference]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <AppBar title={reference ? `Dossier ${reference}` : 'Dossier'} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Skeleton variant="card" count={4} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!mission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <AppBar title="Dossier" />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Surface padded style={{ padding: 4 }}>
            <EmptyState
              iconKey="truck"
              title="Dossier introuvable"
              subtitle="Ce convoyage n'existe plus ou ne t'est pas rattaché."
              cta={{ label: 'Voir mes envois', onPress: () => nav.navigate('AppTabs') }}
            />
          </Surface>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const view = missionView(mission);
  const vehicleLabel = `${mission.vehicle.make} ${mission.vehicle.model}`.trim();
  const driverFullName = view.driverName;
  const priceEur = mission.priceCents != null ? mission.priceCents / 100 : null;

  // Dates réelles par statut : l'historique du serveur d'abord, les champs
  // horodatés de la mission en secours.
  const historyDate = (status: string): string | undefined => {
    const ev = mission.statusHistory?.find((h) => h.status === status);
    if (ev) return fmtDateTime(ev.createdAt);
    if (status === 'ACCEPTED') return fmtDateTime(mission.acceptedAt);
    if (status === 'IN_PROGRESS') return fmtDateTime(mission.startedAt);
    if (status === 'DELIVERED') return fmtDateTime(mission.deliveredAt);
    if (status === 'COMPLETED') return fmtDateTime(mission.completedAt);
    if (status === 'DRAFT') return fmtDateTime(mission.createdAt);
    return undefined;
  };

  const currentIndex = TIMELINE_STEPS.findIndex((t) => t.status === mission.status);
  const timeline = TIMELINE_STEPS.map((t, i) => ({
    label: t.label,
    date: historyDate(t.status) ?? (i > currentIndex ? 'à venir' : ''),
    done: currentIndex >= 0 && i < currentIndex,
    current: i === currentIndex,
  }));

  const goTracking = () => nav.navigate('Tracking', { kind: 'mission', id: mission.id, reference: mission.reference });
  const goChat = () => nav.navigate('Messaging', { driverName: driverFullName ?? 'Axis Import', subtitle: `${view.step} · ${mission.reference}` });
  const goInspection = () => nav.navigate('VehicleInspection', {
    phase: 'ARRIVÉE',
    missionId: mission.id,
    reference: mission.reference,
    vehicleLabel: view.vehicleLabel ?? vehicleLabel,
  });
  const callDriver = () => {
    if (!view.driverPhone) {
      notify('Coordonnées indisponibles', 'Le convoyeur n\'a pas encore communiqué son numéro.');
      return;
    }
    Linking.openURL(`tel:${view.driverPhone.replace(/\s/g, '')}`).catch(() => notify('Appel impossible', view.driverPhone ?? ''));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title={`Dossier ${mission.reference}`} subtitle={vehicleLabel} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}>
        {/* Hero statut */}
        <Surface padded flat style={{ padding: 16, backgroundColor: theme.navy, borderColor: theme.navy }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Pill tone={STATUS_TONE[mission.status] ?? 'gold'}>● {view.step}</Pill>
            <Text style={{ fontSize: 11.5, color: theme.goldHi, letterSpacing: 0.7, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
              {mission.reference}
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: '#F5F1E8', fontFamily: TYPO.weights.bold, letterSpacing: -0.3, marginTop: 12 }}>
            {mission.pickupCity}
            {'\n'}
            <Text style={{ color: 'rgba(245,241,232,0.55)', fontFamily: TYPO.weights.regular }}>vers</Text>{' '}
            {mission.deliveryCity}
          </Text>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
            {mission.distanceKm ? <Stat label="Distance" value={`${Math.round(mission.distanceKm)} km`} /> : null}
            <Stat label="Enlèvement" value={fmtDateTime(mission.pickupAt) ?? '—'} />
            <Stat label="Arrivée" value={view.eta ?? 'À confirmer'} />
          </View>
          <View style={{ height: 4, backgroundColor: 'rgba(245,241,232,0.15)', borderRadius: 2, marginTop: 14 }}>
            <View style={{ width: `${Math.round(view.progress * 100)}%`, height: '100%', backgroundColor: theme.gold, borderRadius: 2 }} />
          </View>
        </Surface>

        {/* Actions rapides */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuickAction onPress={goTracking} icon={<Icons.pin size={18} color={theme.gold} stroke={1.8} />} label="Suivi live" />
          <QuickAction onPress={goChat} icon={<Icons.chat size={18} color={theme.gold} stroke={1.8} />} label="Chat" />
          <QuickAction onPress={callDriver} icon={<Icons.phone size={18} color={theme.gold} stroke={1.8} />} label="Appeler" />
          <QuickAction onPress={goInspection} icon={<Icons.sig size={18} color={theme.gold} stroke={1.8} />} label="État lieux" />
        </View>

        {/* Convoyeur — la carte n'apparaît que s'il y en a un */}
        {driverFullName ? (
          <SectionCard title="Convoyeur">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={driverFullName} size={48} tone="gold" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{driverFullName}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={1}>
                  {view.driverPhone ?? 'Convoyeur Axis Import'}
                </Text>
              </View>
            </View>
          </SectionCard>
        ) : (
          <SectionCard title="Convoyeur">
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              Axis affecte ton convoyeur. Tu recevras son nom et son numéro dès validation.
            </Text>
          </SectionCard>
        )}

        {/* Véhicule */}
        <SectionCard title="Véhicule convoyé">
          <KvRow label="Marque · modèle" value={vehicleLabel} />
          {mission.vehicle.licensePlate ? <KvRow label="Immatriculation" value={mission.vehicle.licensePlate} /> : null}
          {mission.vehicle.year ? <KvRow label="Année" value={String(mission.vehicle.year)} /> : null}
        </SectionCard>

        {/* Itinéraire */}
        <SectionCard title="Itinéraire">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ alignItems: 'center', paddingTop: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.gold }} />
              <View style={{ width: 1.5, height: 36, borderLeftWidth: 1.5, borderLeftColor: theme.line, borderStyle: 'dashed', marginVertical: 4 }} />
              <View style={{ width: 10, height: 10, backgroundColor: theme.navy, transform: [{ rotate: '45deg' }] }} />
            </View>
            <View style={{ flex: 1, gap: 14 }}>
              <View>
                <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.semibold }}>Enlèvement</Text>
                <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>
                  {mission.pickupAddress ? `${mission.pickupAddress}, ${mission.pickupCity}` : mission.pickupCity}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                  {fmtDateTime(mission.pickupAt) ?? 'Date à confirmer'}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.semibold }}>Livraison</Text>
                <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>
                  {mission.deliveryAddress ? `${mission.deliveryAddress}, ${mission.deliveryCity}` : mission.deliveryCity}
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
                  {fmtDateTime(mission.deliveryAt) ?? 'Date à confirmer'}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Tarif — masqué tant qu'aucun prix n'est convenu */}
        {priceEur != null && priceEur > 0 ? (
          <SectionCard title="Tarif">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.semibold, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total TTC</Text>
              <Text style={{ fontSize: 22, color: theme.ink, fontFamily: TYPO.weights.bold, fontVariant: ['tabular-nums'] }}>
                {priceEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </Text>
            </View>
          </SectionCard>
        ) : null}

        {/* Historique réel */}
        <SectionCard title="Historique">
          {timeline.map((t, i, arr) => (
            <View key={t.label} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 16, height: 16, borderRadius: 8,
                    backgroundColor: t.done ? theme.good : t.current ? theme.gold : theme.bgSoft,
                    borderWidth: 2,
                    borderColor: t.done ? theme.good : t.current ? theme.gold : theme.line,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {t.done ? <Icons.check size={9} color="#fff" stroke={3} /> : null}
                </View>
                {i < arr.length - 1 ? (
                  <View style={{ flex: 1, width: 1.5, backgroundColor: t.done ? theme.good : theme.line, marginTop: 2, marginBottom: 2 }} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingBottom: i === arr.length - 1 ? 2 : 14 }}>
                <Text style={{ fontSize: 13, color: t.done || t.current ? theme.ink : theme.muted, fontFamily: t.current ? TYPO.weights.semibold : TYPO.weights.medium }}>
                  {t.label}
                </Text>
                {t.date ? (
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1, fontFamily: TYPO.weights.medium }}>{t.date}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </SectionCard>

        <Button kind="gold" size="lg" fullWidth onPress={goTracking} rightIcon={<Icons.arrow size={18} color={theme.navy} stroke={2} />}>
          Voir le suivi en temps réel
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 10.5, color: 'rgba(245,241,232,0.55)', textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.semibold }}>
        {label}
      </Text>
      <Text style={{ fontSize: 18, color: '#F5F1E8', fontFamily: TYPO.weights.bold, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: theme.line,
        backgroundColor: pressed ? theme.bgSoft : theme.surface,
        alignItems: 'center',
        gap: 6,
      })}
    >
      {icon}
      <Text style={{ fontSize: 11.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{label}</Text>
    </Pressable>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Surface padded style={{ padding: 14 }}>
      <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold, marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </Surface>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>{label}</Text>
      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
