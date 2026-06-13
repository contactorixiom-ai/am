import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { notify } from '../utils/notify';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { buildQuoteFromDraft } from './PickupModeScreen';

export function HomePickupAddressScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HomePickupAddress'>>();
  const { draft } = route.params;
  const { set: setParcelDraft } = useParcelDraft();

  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!address.trim()) {
      notify('Champ manquant', 'Adresse de retrait requise.');
      return;
    }
    setLoading(true);
    try {
      setParcelDraft({
        pickupMode: 'HOME_PICKUP',
        pickupAddress: address.trim(),
        pickupAt: date.trim() || undefined,
      });
      const quote = await buildQuoteFromDraft(draft, 'HOME_PICKUP');
      nav.navigate('QuoteReview', { quote });
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data?.message ?? 'Erreur') : 'Erreur réseau.';
      notify('Devis impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg }}>
          <View>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Enlèvement à domicile
            </Text>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, marginTop: 4, letterSpacing: -0.3 }}>
              Où venir chercher ton colis ?
            </Text>
          </View>

          <Surface>
            <View style={{ gap: SPACING.md }}>
              <Field
                label="Adresse complète"
                value={address}
                onChangeText={setAddress}
                placeholder="Numéro, rue, code postal, ville"
                multiline
                numberOfLines={3}
              />
              <Field
                label="Date souhaitée (optionnel)"
                value={date}
                onChangeText={setDate}
                placeholder="ex: 25/06/2026"
                hint="On te confirmera le créneau par SMS"
              />
              <Field
                label="Notes pour le transporteur (optionnel)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Code d'accès, étage, instructions…"
                multiline
                numberOfLines={3}
              />
            </View>
          </Surface>

          <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 18 }}>📦</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                  Préparation du colis
                </Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                  Emballe ton colis dans un carton solide avec ton nom et le numéro de référence visible. Nos transporteurs partenaires (Mondial Relay, DPD) passent du lundi au samedi.
                </Text>
              </View>
            </View>
          </Surface>

          <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
            Calculer le devis
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
