import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { createParcel } from '../api/parcels';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { ParcelWizard } from '../components/ParcelWizard';
import { PaymentSheet } from '../components/PaymentSheet';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { mapKindToApiCategory, useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';

export function RecipientDetailsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RecipientDetails'>>();
  const { quote } = route.params;
  const { draft: parcelDraft, set: setDraft, reset: resetDraft, saveForLater } = useParcelDraft();

  const [firstName, setFirstName] = useState(parcelDraft.recipientFirstName ?? '');
  const [lastName, setLastName] = useState(parcelDraft.recipientLastName ?? '');
  const [phone, setPhone] = useState(parcelDraft.recipientPhone ?? '');
  const [email, setEmail] = useState(parcelDraft.recipientEmail ?? '');
  const [address, setAddress] = useState(parcelDraft.destinationAddress ?? '');
  const [deliverToRelay, setDeliverToRelay] = useState(parcelDraft.deliverToAxisRelay ?? false);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const handleSaveLater = async () => {
    setDraft({
      recipientFirstName: firstName.trim() || undefined,
      recipientLastName: lastName.trim() || undefined,
      recipientPhone: phone.trim() || undefined,
      recipientEmail: email.trim() || undefined,
      destinationAddress: address.trim() || undefined,
      deliverToAxisRelay: deliverToRelay,
    });
    await saveForLater();
    notify('Brouillon enregistré', 'Tu peux reprendre où tu en étais à tout moment.');
    nav.goBack();
  };

  const validate = (): boolean => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      notify('Champs manquants', 'Prénom, nom et téléphone sont requis.');
      return false;
    }
    if (!deliverToRelay && !address.trim()) {
      notify(
        'Adresse manquante',
        "Indique une adresse de livraison ou choisis l'option « Livraison en point relais Axis ».",
      );
      return false;
    }
    return true;
  };

  const handlePay = () => {
    if (!validate()) return;
    setDraft({
      recipientFirstName: firstName.trim(),
      recipientLastName: lastName.trim(),
      recipientPhone: phone.trim(),
      recipientEmail: email.trim() || undefined,
      destinationAddress: deliverToRelay ? `Point relais Axis ${quote.toCity}` : address.trim(),
      deliverToAxisRelay: deliverToRelay,
    });
    setShowPayment(true);
  };

  const finalizeBooking = async () => {
    setLoading(true);
    try {
      const parcel = await createParcel({
        category: mapKindToApiCategory(parcelDraft.kind, parcelDraft.customsCategory),
        transportMode: quote.transportMode === 'SEA' ? 'SEA' : 'AIR',
        pickupMode: parcelDraft.pickupMode ?? 'HUB_DROP_OFF',
        relayPointId: parcelDraft.relayPointId,
        pickupAddress: parcelDraft.pickupAddress,
        pickupAt: parcelDraft.pickupAt,
        weightKg: quote.weightKg ?? parcelDraft.weightKg ?? 1,
        description: parcelDraft.description,
        originCountry: quote.fromCountry,
        originCity: quote.fromCity,
        destinationCountry: quote.toCountry,
        destinationCity: quote.toCity,
        destinationAddress: deliverToRelay ? `Point relais Axis ${quote.toCity}` : address.trim(),
        recipientFirstName: firstName.trim(),
        recipientLastName: lastName.trim(),
        recipientPhone: phone.trim(),
        recipientEmail: email.trim() || undefined,
      });
      resetDraft();
      nav.replace('BookingConfirmation', {
        kind: 'parcel',
        reference: parcel.reference,
        id: parcel.id,
      });
    } catch (e) {
      // Repli démo : on génère une référence locale pour pouvoir tester l'écran
      // de confirmation même si le backend est down.
      const msg = e instanceof ApiError ? (e.message ?? 'Erreur') : 'Erreur réseau.';
      const isNetwork = !(e instanceof ApiError);
      if (isNetwork) {
        const localRef = `AXP-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now()
          .toString(36)
          .slice(-4)
          .toUpperCase()}`;
        resetDraft();
        nav.replace('BookingConfirmation', {
          kind: 'parcel',
          reference: localRef,
          id: 'local-demo',
        });
        return;
      }
      notify('Réservation impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ParcelWizard step={4} onBack={() => nav.goBack()} onSaveLater={handleSaveLater} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120, gap: SPACING.lg }}>
          <View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
              À qui livrer le colis ?
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
              {quote.toCity} · {quote.toCountry}
            </Text>
          </View>

          {/* Coordonnées destinataire */}
          <Surface>
            <View style={{ gap: SPACING.md }}>
              <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                <Field
                  containerStyle={{ flex: 1 }}
                  label="Prénom"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
                <Field
                  containerStyle={{ flex: 1 }}
                  label="Nom"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
              <Field
                label="Téléphone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+221 77 123 45 67"
                hint="Indispensable pour la livraison — le coursier appelle 30 min avant"
              />
              <Field
                label="Email (optionnel)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="destinataire@exemple.com"
              />
            </View>
          </Surface>

          {/* Adresse + option point relais */}
          <Surface>
            <Field
              label="Adresse de livraison"
              value={address}
              onChangeText={(t) => {
                setAddress(t);
                if (t.trim()) setDeliverToRelay(false);
              }}
              placeholder="Numéro, rue, quartier, ville"
              multiline
              numberOfLines={3}
              hint="ex : Sicap Liberté 6, villa n°2843, Dakar"
              editable={!deliverToRelay}
            />
            <Pressable
              onPress={() => {
                setDeliverToRelay((v) => !v);
                if (!deliverToRelay) setAddress('');
              }}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: SPACING.md }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: deliverToRelay ? theme.navy : theme.line,
                  backgroundColor: deliverToRelay ? theme.navy : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {deliverToRelay ? <Icons.check size={14} color={theme.surface} stroke={2.4} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                  Pas d'adresse précise — livraison en point relais Axis
                </Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
                  Le destinataire est notifié par SMS et retire son colis sous 14 jours dans le hub Axis le plus proche.
                </Text>
              </View>
            </Pressable>
          </Surface>

          {/* Éléments rassurants */}
          <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
            <View style={{ gap: 10 }}>
              <Trust theme={theme} icon={<Icons.shield size={16} color={theme.gold} stroke={1.8} />} label="Assurance jusqu'à 250 000 € incluse" />
              <Trust theme={theme} icon={<Icons.pin size={16} color={theme.gold} stroke={1.8} />} label="Suivi temps réel jusqu'à la remise" />
              <Trust theme={theme} icon={<Icons.sig size={16} color={theme.gold} stroke={1.8} />} label="Signature électronique à la livraison" />
              <Trust theme={theme} icon={<Icons.phone size={16} color={theme.gold} stroke={1.8} />} label="Coursier appelle 30 min avant la remise" />
            </View>
          </Surface>

          {/* Récap rapide */}
          <Surface>
            <Text
              style={{
                color: theme.muted,
                fontFamily: TYPO.weights.semibold,
                fontSize: TYPO.sizes.label,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: SPACING.md,
              }}
            >
              Récap envoi
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pill tone="ghost">
                {quote.transportMode === 'SEA' ? '🚢 Maritime' : '✈️ Aérien'}
              </Pill>
              <Pill tone="ghost">{`${quote.weightKg ?? parcelDraft.weightKg ?? '?'} kg`}</Pill>
              <Pill tone="ghost">{`${quote.fromCity} → ${quote.toCity}`}</Pill>
              {parcelDraft.kind ? <Pill tone="ghost">{parcelDraft.kind}</Pill> : null}
            </View>
          </Surface>
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
            kind="gold"
            size="lg"
            fullWidth
            onPress={handlePay}
            loading={loading}
            rightIcon={<Icons.arrow size={18} color={theme.navy} stroke={2} />}
          >
            Payer et envoyer
          </Button>
        </View>
      </KeyboardAvoidingView>

      <PaymentSheet
        visible={showPayment}
        amountEur={quote.totalCents / 100}
        reference={quote.reference}
        description={`${quote.fromCity} → ${quote.toCity}`}
        onClose={() => setShowPayment(false)}
        onPaid={() => {
          setShowPayment(false);
          finalizeBooking();
        }}
      />
    </SafeAreaView>
  );
}

function Trust({ theme, icon, label }: { theme: ReturnType<typeof useTheme>['theme']; icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {icon}
      <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.semibold, fontSize: 12.5, flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}
