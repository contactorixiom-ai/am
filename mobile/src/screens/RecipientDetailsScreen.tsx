import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { notify } from '../utils/notify';
import { createParcel } from '../api/parcels';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function RecipientDetailsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RecipientDetails'>>();
  const { quote } = route.params;
  const { draft: parcelDraft, reset: resetDraft } = useParcelDraft();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !address.trim()) {
      notify('Champs manquants', 'Prénom, nom, téléphone et adresse de livraison sont requis.');
      return;
    }
    setLoading(true);
    try {
      const parcel = await createParcel({
        transportMode: quote.transportMode === 'SEA' ? 'SEA' : 'AIR',
        pickupMode: parcelDraft.pickupMode ?? 'HUB_DROP_OFF',
        relayPointId: parcelDraft.relayPointId,
        pickupAddress: parcelDraft.pickupAddress,
        pickupAt: parcelDraft.pickupAt,
        weightKg: quote.weightKg ?? 1,
        originCountry: quote.fromCountry,
        originCity: quote.fromCity,
        destinationCountry: quote.toCountry,
        destinationCity: quote.toCity,
        destinationAddress: address.trim(),
        recipientFirstName: firstName.trim(),
        recipientLastName: lastName.trim(),
        recipientPhone: phone.trim(),
        recipientEmail: email.trim() || undefined,
      });
      resetDraft();
      nav.replace('BookingConfirmation', { kind: 'parcel', reference: parcel.reference, id: parcel.id });
    } catch (e) {
      const msg = isAxiosError(e) ? (e.response?.data?.message ?? 'Erreur') : 'Erreur réseau.';
      notify('Réservation impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
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
              Destinataire
            </Text>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, marginTop: 4, letterSpacing: -0.3 }}>
              À qui livrer le colis ?
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
              {quote.toCity} · {quote.toCountry}
            </Text>
          </View>

          <Surface>
            <View style={{ gap: SPACING.md }}>
              <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                <Field containerStyle={{ flex: 1 }} label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                <Field containerStyle={{ flex: 1 }} label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
              </View>
              <Field
                label="Téléphone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+221 77 123 45 67"
                hint="Indispensable pour contacter le destinataire à la livraison"
              />
              <Field
                label="Email (optionnel)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="destinataire@exemple.com"
              />
              <Field
                label="Adresse de livraison"
                value={address}
                onChangeText={setAddress}
                placeholder="Numéro, rue, quartier..."
                multiline
                numberOfLines={3}
              />
            </View>
          </Surface>

          <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
            Valider et réserver
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
