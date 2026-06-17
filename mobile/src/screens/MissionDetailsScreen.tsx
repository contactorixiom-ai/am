import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

// Données démo d'un dossier mission. Réutilisé par l'écran de suivi.
const MISSION = {
  reference: 'AX-2847',
  status: { tone: 'navy' as PillTone, label: 'En route' },
  vehicle: { brand: 'BMW Série 3 — 320d', plate: 'AX-2847-AI', year: '2022', category: 'Berline' },
  driver: { firstName: 'Karim', lastName: 'Diallo', rating: 4.9, missions: 142, phone: '+33 6 12 34 56 78' },
  route: {
    fromCity: 'Paris 15ᵉ', fromAddress: '14 rue de Vaugirard, 75015 Paris',
    toCity: 'Bruxelles', toAddress: 'Avenue Louise 250, 1050 Bruxelles',
    pickupAt: '22 mai · 08h30', deliveryAt: '22 mai · 14h32 (estimé)',
    distanceKm: 312, durationHr: '4h 02',
  },
  pricing: { base: 49, perKm: 0.66, options: 35, ttc: 645 },
  documents: [
    { id: 1, label: 'Contrat de convoyage',  status: 'signed' as const },
    { id: 2, label: 'État des lieux départ', status: 'signed' as const },
    { id: 3, label: 'État des lieux arrivée', status: 'pending' as const },
    { id: 4, label: 'Facture FA-2026-0184',  status: 'paid' as const },
  ],
  timeline: [
    { label: 'Demande validée',                  date: '21 mai · 17:42', done: true,  current: false },
    { label: 'Chauffeur assigné · Karim Diallo', date: '21 mai · 18:08', done: true,  current: false },
    { label: 'Véhicule récupéré',                date: '22 mai · 08:32', done: true,  current: false },
    { label: 'État des lieux départ signé',      date: '22 mai · 08:42', done: true,  current: false },
    { label: 'En route',                         date: '22 mai · 08:45 · pause repas 25 min', done: false, current: true },
    { label: 'État des lieux arrivée',           date: 'prévu 14:32',     done: false, current: false },
    { label: 'Livré au client',                  date: 'prévu 14:35',     done: false, current: false },
  ],
};

export function MissionDetailsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MissionDetails'>>();
  const reference = route.params?.reference ?? MISSION.reference;
  const driverFullName = `${MISSION.driver.firstName} ${MISSION.driver.lastName}`;

  const goTracking = () => nav.navigate('Tracking', { kind: 'mission', id: reference, reference });
  const goChat = () => nav.navigate('Messaging', { driverName: driverFullName, subtitle: `${MISSION.status.label} · ${reference}` });
  const goInspection = () => nav.navigate('VehicleInspection', { phase: 'ARRIVÉE', reference, vehicleLabel: `${MISSION.vehicle.brand} · ${MISSION.vehicle.plate}` });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title={`Dossier ${reference}`} subtitle={MISSION.vehicle.brand} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}>
        {/* Hero statut */}
        <Surface padded flat style={{ padding: 16, backgroundColor: theme.navy, borderColor: theme.navy }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pill tone="gold">● {MISSION.status.label}</Pill>
            <Text style={{ fontSize: 11.5, color: theme.goldHi, letterSpacing: 0.7, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
              {reference}
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: '#F5F1E8', fontFamily: TYPO.weights.bold, letterSpacing: -0.3, marginTop: 12 }}>
            {MISSION.route.fromCity}
            {'\n'}
            <Text style={{ color: 'rgba(245,241,232,0.55)', fontFamily: TYPO.weights.regular }}>vers</Text>{' '}
            {MISSION.route.toCity}
          </Text>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 14 }}>
            <Stat label="Distance" value={`${MISSION.route.distanceKm} km`} />
            <Stat label="Durée" value={MISSION.route.durationHr} />
            <Stat label="Arrivée" value="14h32" />
          </View>
          <View style={{ height: 4, backgroundColor: 'rgba(245,241,232,0.15)', borderRadius: 2, marginTop: 14 }}>
            <View style={{ width: '62%', height: '100%', backgroundColor: theme.gold, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(245,241,232,0.62)', fontFamily: TYPO.weights.medium, marginTop: 6 }}>
            194 km parcourus · 118 km restants
          </Text>
        </Surface>

        {/* Actions rapides */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuickAction onPress={goTracking} icon={<Icons.pin size={18} color={theme.gold} stroke={1.8} />} label="Suivi live" />
          <QuickAction onPress={goChat} icon={<Icons.chat size={18} color={theme.gold} stroke={1.8} />} label="Chat" />
          <QuickAction onPress={() => notify('Appel chauffeur', `Mise en relation avec ${driverFullName} dans la version finale.`)} icon={<Icons.phone size={18} color={theme.gold} stroke={1.8} />} label="Appeler" />
          <QuickAction onPress={goInspection} icon={<Icons.sig size={18} color={theme.gold} stroke={1.8} />} label="État lieux" />
        </View>

        {/* Chauffeur */}
        <SectionCard title="Chauffeur">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={driverFullName} size={48} tone="gold" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{driverFullName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Icons.star size={12} color={theme.gold} stroke={2} />
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                  {MISSION.driver.rating} · {MISSION.driver.missions} convoyages · Permis B vérifié
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Véhicule */}
        <SectionCard title="Véhicule convoyé">
          <KvRow label="Marque · modèle" value={MISSION.vehicle.brand} />
          <KvRow label="Immatriculation" value={MISSION.vehicle.plate} />
          <KvRow label="Année" value={MISSION.vehicle.year} />
          <KvRow label="Catégorie" value={MISSION.vehicle.category} />
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
                <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>{MISSION.route.fromAddress}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>{MISSION.route.pickupAt}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.semibold }}>Livraison</Text>
                <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>{MISSION.route.toAddress}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>{MISSION.route.deliveryAt}</Text>
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Tarif */}
        <SectionCard title="Tarif">
          <KvRow label={`Forfait + ${MISSION.route.distanceKm} km`} value={`${(MISSION.pricing.base + MISSION.pricing.perKm * MISSION.route.distanceKm).toFixed(2)} €`} />
          <KvRow label="Options" value={`+ ${MISSION.pricing.options.toFixed(2)} €`} />
          <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.semibold, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total TTC</Text>
            <Text style={{ fontSize: 22, color: theme.ink, fontFamily: TYPO.weights.bold, fontVariant: ['tabular-nums'] }}>
              {MISSION.pricing.ttc.toLocaleString('fr-FR')} €
            </Text>
          </View>
        </SectionCard>

        {/* Documents */}
        <SectionCard title="Documents du dossier">
          {MISSION.documents.map((d, i) => (
            <Pressable key={d.id} onPress={() => nav.navigate('AppTabs')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.lineSoft }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.doc size={16} color={theme.navy} stroke={1.8} />
                </View>
                <Text style={{ flex: 1, fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{d.label}</Text>
                <Pill tone={docTone(d.status)}>{docLabel(d.status)}</Pill>
                <Icons.chev size={16} color={theme.muted} stroke={1.8} />
              </View>
            </Pressable>
          ))}
        </SectionCard>

        {/* Timeline */}
        <SectionCard title="Historique">
          {MISSION.timeline.map((t, i, arr) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, paddingBottom: i === arr.length - 1 ? 0 : 12 }}>
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
                  <View style={{ flex: 1, width: 1.5, backgroundColor: t.done ? theme.good : theme.line, marginTop: 2 }} />
                ) : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 2 }}>
                <Text style={{ fontSize: 13, color: t.done || t.current ? theme.ink : theme.muted, fontFamily: t.current ? TYPO.weights.semibold : TYPO.weights.medium }}>
                  {t.label}
                </Text>
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1, fontFamily: TYPO.weights.medium }}>{t.date}</Text>
              </View>
            </View>
          ))}
        </SectionCard>

        {/* CTA bas */}
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

function docTone(s: 'signed' | 'pending' | 'paid'): PillTone {
  if (s === 'signed') return 'good';
  if (s === 'paid') return 'good';
  return 'warn';
}
function docLabel(s: 'signed' | 'pending' | 'paid'): string {
  if (s === 'signed') return 'Signé';
  if (s === 'paid') return 'Payé';
  return 'En attente';
}
