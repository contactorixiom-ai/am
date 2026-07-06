import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { notify } from '../utils/notify';
import { City, createQuote, QuoteOptionKind } from '../api/quotes';
import { saveConvoyDraft } from '../api/missions';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { CityPicker } from '../components/CityPicker';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

const OPTIONS: { kind: QuoteOptionKind; label: string; hint: string }[] = [
  { kind: 'EXPRESS',           label: 'Express 24h',           hint: '+22 %' },
  { kind: 'PREMIUM_INSURANCE', label: 'Assurance Premium',     hint: '+35 € · plafond 500 k€' },
  { kind: 'DOOR_TO_DOOR',      label: 'Porte-à-porte',         hint: '+15 %' },
  { kind: 'WEEKEND_PICKUP',    label: 'Enlèvement weekend',    hint: '+40 €' },
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
  const [selectedOptions, setSelectedOptions] = useState<Set<QuoteOptionKind>>(new Set());
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
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

          {/* Quand */}
          <Surface padded style={{ padding: 16 }}>
            <SectionHead title="Quand" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field
                containerStyle={{ flex: 1 }}
                label="Enlèvement"
                value="22 mai"
                editable={false}
              />
              <Field
                containerStyle={{ flex: 1 }}
                label="Créneau"
                value="Matin (8h-12h)"
                editable={false}
              />
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

          {/* Photos */}
          <Surface padded style={{ padding: 16 }}>
            <SectionHead title="Photos" action="2 sur 6" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const filled = i < 2;
                return (
                  <View
                    key={i}
                    style={{
                      width: '31.5%',
                      aspectRatio: 1,
                      borderRadius: 10,
                      backgroundColor: filled ? theme.navy : theme.bgSoft,
                      borderWidth: 1,
                      borderColor: filled ? theme.navy : theme.line,
                      borderStyle: filled ? 'solid' : 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {filled ? (
                      <Icons.check size={20} color={theme.gold} stroke={2} />
                    ) : (
                      <Icons.camera size={22} color={theme.muted} stroke={1.6} />
                    )}
                  </View>
                );
              })}
            </View>
          </Surface>

          {/* Options */}
          <View>
            <SectionHead title="Options" />
            <View style={{ gap: 8 }}>
              {OPTIONS.map((o) => {
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
