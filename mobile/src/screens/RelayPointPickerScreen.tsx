import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { CARRIER_LABEL, RelayPoint, searchRelayPoints } from '../api/relayPoints';
import { Button } from '../components/Button';
import { DotLoader } from '../components/DotLoader';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { ParcelWizard } from '../components/ParcelWizard';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { buildQuoteFromDraft } from './PickupModeScreen';

// Données de repli si l'API ne renvoie aucun point (mode démo).
const DEMO_POINTS = (city: string, country: string): RelayPoint[] => [
  {
    id: 'demo-mr-1',
    carrier: 'MONDIAL_RELAY',
    externalId: 'MR-DEMO-001',
    name: `Mondial Relay · ${city} Centre`,
    address: '14 rue de la République',
    postalCode: '75001',
    city,
    country,
    latitude: 0,
    longitude: 0,
    openingHours: 'Lun-Sam 9h-19h',
    distanceKm: 0.4,
  },
  {
    id: 'demo-chrono-1',
    carrier: 'CHRONOPOST',
    externalId: 'CHR-DEMO-002',
    name: `Tabac-Presse Le Central · ${city}`,
    address: '8 avenue Victor Hugo',
    postalCode: '75001',
    city,
    country,
    latitude: 0,
    longitude: 0,
    openingHours: 'Lun-Dim 7h-21h',
    distanceKm: 0.9,
  },
  {
    id: 'demo-dpd-1',
    carrier: 'DPD',
    externalId: 'DPD-DEMO-003',
    name: `Carrefour Express · ${city}`,
    address: "23 place de l'Étoile",
    postalCode: '75002',
    city,
    country,
    latitude: 0,
    longitude: 0,
    openingHours: 'Lun-Dim 8h-22h',
    distanceKm: 1.6,
  },
];

export function RelayPointPickerScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RelayPointPicker'>>();
  const { draft } = route.params;
  const { set: setParcelDraft, saveForLater } = useParcelDraft();

  const [points, setPoints] = useState<RelayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RelayPoint | null>(null);
  const [booking, setBooking] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await searchRelayPoints({
          lat: draft.from.latitude,
          lng: draft.from.longitude,
          country: draft.from.country,
          radius: 30,
          limit: 30,
        });
        if (cancelled) return;
        setPoints(r.length > 0 ? r : DEMO_POINTS(draft.from.city, draft.from.country));
      } catch {
        if (cancelled) return;
        setPoints(DEMO_POINTS(draft.from.city, draft.from.country));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.from.country, draft.from.latitude, draft.from.longitude, draft.from.city]);

  const handleSaveLater = async () => {
    await saveForLater();
    notify('Brouillon enregistré', 'Tu peux reprendre où tu en étais à tout moment.');
    nav.goBack();
  };

  const goNext = async () => {
    if (!selected) {
      notify('Sélection requise', 'Choisis un point relais.');
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
      const msg = e instanceof ApiError ? (e.message ?? 'Erreur') : 'Erreur réseau.';
      notify('Devis impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setBooking(false);
    }
  };

  const filtered = points.filter((p) =>
    !query.trim()
      ? true
      : `${p.name} ${p.address} ${p.city}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ParcelWizard
        step={3}
        subtitle="Point relais"
        onBack={() => nav.goBack()}
        onSaveLater={handleSaveLater}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
            Choisis ton point relais
          </Text>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
            Points dans un rayon de 30 km autour de {draft.from.city}.
          </Text>
        </View>

        <Surface>
          <Field
            label="Rechercher"
            value={query}
            onChangeText={setQuery}
            placeholder="Nom, rue, ville…"
          />
        </Surface>

        {/* Repli "carte" : on affiche un placeholder visuel pour la démo */}
        <Surface flat style={{ backgroundColor: theme.navy, borderColor: theme.navy, overflow: 'hidden', padding: 0 }}>
          <View style={{ height: 140, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
            <Icons.pin size={32} color={theme.gold} stroke={2} />
            <Text style={{ color: theme.goldHi, fontFamily: TYPO.weights.semibold, fontSize: 12, marginTop: 8, letterSpacing: 0.4 }}>
              Carte des {filtered.length} points autour de {draft.from.city}
            </Text>
            <Text style={{ color: 'rgba(241,236,220,0.55)', fontFamily: TYPO.weights.medium, fontSize: 11, marginTop: 4 }}>
              (vue carte interactive bientôt disponible)
            </Text>
          </View>
        </Surface>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <DotLoader size={8} />
          </View>
        ) : filtered.length === 0 ? (
          <Surface>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body }}>
              Aucun point relais trouvé. Essaie l'enlèvement à domicile ou le hub Axis.
            </Text>
          </Surface>
        ) : (
          <View style={{ gap: SPACING.md }}>
            {filtered.map((p) => {
              const active = selected?.id === p.id;
              return (
                <Pressable key={p.id} onPress={() => setSelected(p)}>
                  <Surface
                    padded
                    flat
                    style={{
                      borderColor: active ? theme.navy : theme.line,
                      backgroundColor: active ? theme.bgSoft : theme.surface,
                    }}
                  >
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
                          {p.address}{p.postalCode ? ` · ${p.postalCode}` : ''} {p.city}
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
      </ScrollView>

      <View
        style={{
          padding: SPACING.lg,
          paddingTop: 12,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.line,
        }}
      >
        <Button
          kind="primary"
          size="lg"
          fullWidth
          onPress={goNext}
          loading={booking}
          disabled={!selected}
          rightIcon={<Icons.arrow size={18} color="#fff" stroke={2} />}
        >
          Calculer mon devis
        </Button>
      </View>
    </SafeAreaView>
  );
}

