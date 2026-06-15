import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { notify } from '../utils/notify';
import { City, createQuote, QuoteOptionKind } from '../api/quotes';
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

export function CarRequestScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [from, setFrom] = useState<City | null>(null);
  const [to, setTo] = useState<City | null>(null);
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
        service: 'CONVOY_CAR',
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
      <AppBar title="Convoyage voiture" subtitle="Étape 2 sur 2 · détails" />
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
              <Field label="Marque" value={vehicleMake} onChangeText={setVehicleMake} placeholder="BMW, Peugeot…" />
              <Field label="Modèle" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Série 3, 308…" />
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
