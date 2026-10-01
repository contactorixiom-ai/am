import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { notify } from '../utils/notify';
import { City, createQuote, CreateQuoteInput, QuoteOptionKind } from '../api/quotes';
import { saveConvoyDraft } from '../api/missions';
import { updateProfile } from '../api/auth';
import { useSession } from '../state/SessionContext';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { CityPicker } from '../components/CityPicker';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { LivePriceBar } from '../components/LivePriceBar';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Surface } from '../components/Surface';
import { hasInsurance } from '../config/company';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

// « Assurance Premium » n'est proposée qu'avec une police réellement
// souscrite (app.json → extra.insurance) : vendre une garantie qui n'existe
// pas engagerait Axis, et la distribution d'assurance est réglementée.
const OPTIONS: { kind: QuoteOptionKind; label: string; hint: string }[] = [
  { kind: 'EXPRESS',           label: 'Express 24h',           hint: '+15 %' },
  ...(hasInsurance()
    ? [{ kind: 'PREMIUM_INSURANCE' as QuoteOptionKind, label: 'Garantie étendue', hint: '+29,61 € · plafond 350 k€' }]
    : []),
  { kind: 'DOOR_TO_DOOR',      label: 'Porte-à-porte',         hint: 'Gratuit' },
  { kind: 'WEEKEND_PICKUP',    label: 'Enlèvement weekend',    hint: '+60 €' },
];

// Catégories de la grille tarifaire Convoyage 2026 (tarif €/km HT).
const VEHICLE_CATEGORIES: { key: string; label: string; rate: string }[] = [
  { key: 'citadine', label: 'Citadine', rate: '0,65 €' },
  { key: 'berline', label: 'Berline', rate: '0,70 €' },
  { key: 'break', label: 'Break', rate: '0,75 €' },
  { key: 'coupe', label: 'Coupé', rate: '0,75 €' },
  { key: 'electrique', label: 'Électrique', rate: '0,80 €' },
  { key: 'hybride', label: 'Hybride', rate: '0,80 €' },
  { key: 'monospace', label: 'Monospace', rate: '0,85 €' },
  { key: 'suv', label: 'SUV', rate: '0,85 €' },
  { key: '4x4', label: '4×4', rate: '0,85 €' },
  { key: 'camping_car', label: 'Camping-car', rate: '0,85 €' },
  { key: 'poids_lourd', label: 'Poids lourd', rate: '0,90 €' },
  { key: 'utilitaire', label: 'Utilitaire', rate: '1,00 €' },
  { key: 'luxe', label: 'Luxe', rate: '1,10 €' },
  { key: 'collection', label: 'Collection', rate: '1,30 €' },
];

export function CarRequestScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CarRequest'>>();
  const service = route.params?.service ?? 'CONVOY_CAR';
  const isMoto = service === 'CONVOY_MOTO';

  const [from, setFrom] = useState<City | null>(null);
  const [to, setTo] = useState<City | null>(null);
  const [category, setCategory] = useState(isMoto ? 'moto' : 'berline');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [notes, setNotes] = useState('');
  // Date et créneau d'enlèvement choisis par le client (ils étaient figés sur
  // « 22 mai · Matin »), et adresses exactes : sans elles, le convoyeur ne
  // savait pas où aller.
  const dates = useMemo(() => nextDays(21), []);
  const [pickupDay, setPickupDay] = useState<Date>(dates[1]);
  const [slot, setSlot] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  // Le convoyeur doit pouvoir joindre le client le jour de l'enlèvement.
  const { user, refresh } = useSession();
  const needsPhone = !user?.phone;
  const [contactPhone, setContactPhone] = useState('');
  // Un enlèvement le samedi ou le dimanche est facturé comme tel.
  const isWeekend = pickupDay.getDay() === 0 || pickupDay.getDay() === 6;
  const [selectedOptions, setSelectedOptions] = useState<Set<QuoteOptionKind>>(new Set());
  const [loading, setLoading] = useState(false);

  // Tarif en direct : dès que le trajet est choisi, le client voit le prix
  // bouger quand il change de catégorie ou coche une option.
  const estimateInput: CreateQuoteInput | null = useMemo(() => {
    if (!from || !to) return null;
    return {
      service,
      transportMode: 'ROAD',
      fromCity: from.city,
      fromCountry: from.country,
      fromLatitude: from.latitude,
      fromLongitude: from.longitude,
      toCity: to.city,
      toCountry: to.country,
      toLatitude: to.latitude,
      toLongitude: to.longitude,
      vehicleCategory: category,
      options: [...selectedOptions],
    };
  }, [service, from, to, category, selectedOptions]);

  useEffect(() => {
    setSelectedOptions((prev) => {
      if (prev.has('WEEKEND_PICKUP') === isWeekend) return prev;
      const next = new Set(prev);
      if (isWeekend) next.add('WEEKEND_PICKUP');
      else next.delete('WEEKEND_PICKUP');
      return next;
    });
  }, [isWeekend]);

  const toggleOption = (k: QuoteOptionKind) =>
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const submit = async () => {
    if (!from || !to) {
      notify('Trajet incomplet', "Choisis une ville de départ et d'arrivée.");
      return;
    }
    if (pickupAddress.trim().length < 5 || deliveryAddress.trim().length < 5) {
      notify('Adresses manquantes', 'Indique l\'adresse exacte de départ et d\'arrivée du véhicule.');
      return;
    }
    if (needsPhone && !/^\+?[0-9\s-]{8,20}$/.test(contactPhone.trim())) {
      notify('Téléphone manquant', 'Indique un numéro où le convoyeur peut te joindre le jour de l\'enlèvement.');
      return;
    }
    if (!vehicleMake.trim() || !vehicleModel.trim() || !vehiclePlate.trim()) {
      notify('Véhicule incomplet', 'Indique la marque, le modèle et l\'immatriculation.');
      return;
    }
    setLoading(true);
    try {
      if (needsPhone) {
        await updateProfile({ phone: contactPhone.trim() });
        void refresh();
      }
      const quote = await createQuote({
        service,
        vehicleCategory: category,
        fromCity: from.city,
        fromCountry: from.country,
        fromLatitude: from.latitude,
        fromLongitude: from.longitude,
        toCity: to.city,
        toCountry: to.country,
        toLatitude: to.latitude,
        toLongitude: to.longitude,
        options: Array.from(selectedOptions),
      });
      // navigation/types.ts est gelé : on persiste les infos véhicule + notes
      // via AsyncStorage pour que QuoteReviewScreen puisse créer la mission.
      const parsedYear = parseInt(vehicleYear, 10);
      await saveConvoyDraft({
        vehicleCategory: category,
        vehicleMake: vehicleMake.trim() || undefined,
        vehicleModel: vehicleModel.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        vehicleYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
        notes: notes.trim() || undefined,
        pickupAddress: pickupAddress.trim(),
        deliveryAddress: deliveryAddress.trim(),
        pickupPostalCode: from.postalCode,
        deliveryPostalCode: to.postalCode,
        pickupAt: slotStart(pickupDay, slot).toISOString(),
        pickupSlotLabel: `${formatDay(pickupDay)} · ${slot === 'MORNING' ? 'matin (8h-12h)' : 'après-midi (14h-18h)'}`,
        quoteReference: quote.reference,
      });
      nav.navigate('QuoteReview', { quote });
    } catch (e) {
      const msg = e instanceof ApiError ? (e instanceof ApiError ? e.message : null) ?? 'Erreur' : 'Erreur réseau.';
      notify('Devis impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title={isMoto ? 'Convoyage moto' : 'Convoyage voiture'} subtitle="Étape 2 sur 2 · détails" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 16 }}>
          {/* Trajet */}
          <Surface padded style={{ padding: 16 }}>
            <SectionHead title="Trajet" />
            <View style={{ gap: 12 }}>
              <CityPickerRow icon="●" iconColor={theme.gold} label="Départ" value={from} onChange={setFrom} region="EU" />
              {/* Pointillé vertical */}
              <View style={{ marginLeft: 10, height: 12, justifyContent: 'center' }}>
                <View style={{ width: 1.5, height: '100%', borderLeftWidth: 1.5, borderLeftColor: theme.line, borderStyle: 'dashed' }} />
              </View>
              <CityPickerRow icon="◆" iconColor={theme.navy} label="Arrivée" value={to} onChange={setTo} region="EU" />
            </View>
          </Surface>

          {/* Adresses exactes */}
          <Surface padded style={{ padding: 16 }}>
            <SectionHead title="Adresses" />
            <View style={{ gap: 10 }}>
              <Field
                label={`Adresse de départ${from ? ` (${from.city})` : ''}`}
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="Numéro et rue"
                autoComplete="street-address"
              />
              <Field
                label={`Adresse d'arrivée${to ? ` (${to.city})` : ''}`}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Numéro et rue"
              />
              {needsPhone ? (
                <Field
                  label="Téléphone de contact"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                  placeholder="+33 6 12 34 56 78"
                  hint="Pour que le convoyeur te joigne le jour J. Enregistré dans ton profil."
                />
              ) : null}
            </View>
          </Surface>

          {/* Quand */}
          <Surface padded style={{ padding: 16 }}>
            <SectionHead title="Quand" />
            <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginBottom: 8 }}>
              Jour d'enlèvement souhaité — Axis te confirme le créneau.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {dates.map((d) => {
                const on = d.getTime() === pickupDay.getTime();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => setPickupDay(d)}
                    style={{
                      width: 62, paddingVertical: 8, borderRadius: RADII.md, alignItems: 'center',
                      borderWidth: 1.5, borderColor: on ? theme.navy : theme.line,
                      backgroundColor: on ? theme.navy : theme.surface,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: on ? theme.goldHi : theme.muted, fontFamily: TYPO.weights.semibold, textTransform: 'uppercase' }}>
                      {d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}
                    </Text>
                    <Text style={{ fontSize: 17, color: on ? '#F5F1E8' : theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }}>
                      {d.getDate()}
                    </Text>
                    <Text style={{ fontSize: 10.5, color: on ? 'rgba(245,241,232,0.7)' : theme.muted, fontFamily: TYPO.weights.medium }}>
                      {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {(['MORNING', 'AFTERNOON'] as const).map((k) => {
                const on = slot === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setSlot(k)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: RADII.md, alignItems: 'center',
                      borderWidth: 1.5, borderColor: on ? theme.navy : theme.line,
                      backgroundColor: on ? theme.bgSoft : theme.surface,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                      {k === 'MORNING' ? 'Matin · 8h-12h' : 'Après-midi · 14h-18h'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Surface>

          {/* Véhicule */}
          <Surface padded style={{ padding: 16 }}>
            <SectionHead title="Véhicule" />
            <View style={{ gap: 10 }}>
              {/* Catégorie → détermine le tarif au km (grille Convoyage 2026).
                  Masquée pour la moto (tarif unique 0,60 €/km). */}
              {isMoto ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                  <Icons.bike size={18} color={theme.gold} stroke={1.8} />
                  <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Tarif moto : 0,60 €/km HT</Text>
                </View>
              ) : (
                <>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Catégorie · tarif au km
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                    {VEHICLE_CATEGORIES.map((c) => {
                      const on = category === c.key;
                      return (
                        <Pressable
                          key={c.key}
                          onPress={() => setCategory(c.key)}
                          style={{
                            paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
                            borderWidth: 1.5, borderColor: on ? theme.select : theme.line,
                            backgroundColor: on ? theme.select : theme.surface, alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 13, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.semibold }}>{c.label}</Text>
                          <Text style={{ fontSize: 11, color: on ? theme.selectInk : theme.gold, fontFamily: TYPO.weights.semibold, marginTop: 1 }}>{c.rate}/km</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}
              <Field label={isMoto ? 'Marque' : 'Marque'} value={vehicleMake} onChangeText={setVehicleMake} placeholder={isMoto ? 'Yamaha, Honda…' : 'BMW, Peugeot…'} />
              <Field label="Modèle" value={vehicleModel} onChangeText={setVehicleModel} placeholder={isMoto ? 'MT-07, CB500…' : 'Série 3, 308…'} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Field
                  containerStyle={{ flex: 1.2 }}
                  label="Immatriculation"
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                  autoCapitalize="characters"
                  placeholder="GA-372-LM"
                />
                <Field
                  containerStyle={{ flex: 1 }}
                  label="Année"
                  value={vehicleYear}
                  onChangeText={setVehicleYear}
                  keyboardType="numeric"
                  placeholder="2022"
                />
              </View>
              <Field
                label="Notes (optionnel)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Particularités, accès, codes…"
                multiline
                numberOfLines={2}
              />
            </View>
          </Surface>


          {/* Options */}
          <View>
            <SectionHead title="Options" />
            <View style={{ gap: 8 }}>
              {/* Le supplément week-end suit le jour choisi, il ne se coche pas. */}
              {isWeekend ? (
                <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
                  Enlèvement le week-end : supplément de 60 € inclus.
                </Text>
              ) : null}
              {OPTIONS.filter((o) => o.kind !== 'WEEKEND_PICKUP').map((o) => {
                const active = selectedOptions.has(o.kind);
                return (
                  <Pressable key={o.kind} onPress={() => toggleOption(o.kind)}>
                    <Surface
                      padded
                      flat
                      style={{
                        padding: 14,
                        borderColor: active ? theme.navy : theme.line,
                        backgroundColor: active ? theme.bgSoft : theme.surface,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
                            {o.label}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }}>
                            {o.hint}
                          </Text>
                        </View>
                        <Pill tone={active ? 'navy' : 'ghost'}>{active ? 'Ajoutée' : 'Ajouter'}</Pill>
                      </View>
                    </Surface>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <LivePriceBar
          input={estimateInput}
          placeholder="Choisis le départ et l'arrivée : le tarif s'affiche aussitôt."
        />

        {/* Sticky CTA */}
        <View
          style={{
            padding: 20,
            paddingTop: 12,
            paddingBottom: 24,
            backgroundColor: theme.surface,
            borderTopWidth: 1,
            borderTopColor: theme.line,
          }}
        >
          <Button
            kind="gold"
            size="lg"
            fullWidth
            onPress={submit}
            loading={loading}
            rightIcon={<Icons.arrow size={18} color={theme.navy} stroke={2} />}
          >
            Calculer le devis
          </Button>
          <Text
            style={{
              textAlign: 'center',
              fontSize: 11.5,
              color: theme.muted,
              marginTop: 8,
              fontFamily: TYPO.weights.medium,
            }}
          >
            Estimation instantanée · tarif TTC · sans engagement
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Helper qui combine icône + CityPicker
function CityPickerRow({
  icon,
  iconColor,
  label,
  value,
  onChange,
  region,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: City | null;
  onChange: (c: City) => void;
  region: 'EU' | 'AFRICA';
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
      <View
        style={{
          width: 22,
          alignItems: 'center',
          paddingBottom: 14,
        }}
      >
        <Text style={{ color: iconColor, fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <CityPicker label={label} value={value} onChange={onChange} region={region} />
      </View>
    </View>
  );
}

/** Les N prochains jours, à partir de demain, à minuit. */
function nextDays(n: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 1; i <= n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

function slotStart(day: Date, slot: 'MORNING' | 'AFTERNOON'): Date {
  const d = new Date(day);
  d.setHours(slot === 'MORNING' ? 8 : 14, 0, 0, 0);
  return d;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
