import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { AddressField } from '../components/AddressField';
import { Icons } from '../components/Icons';
import { ParcelWizard } from '../components/ParcelWizard';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { buildQuoteFromDraft } from './PickupModeScreen';

// 3 créneaux types — demain matin / après-midi / surlendemain matin
// `at` : début du créneau en date ISO, ce que le serveur attend. Le libellé
// était envoyé tel quel (« dimanche 25 octobre — 9h-11h ») et toute commande
// avec enlèvement était refusée au paiement (« date invalide »).
function buildSlots(): { id: string; label: string; sub: string; at: string }[] {
  const day = (offset: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const tomorrowAm = day(1, 9);
  const tomorrowPm = day(1, 14);
  const afterAm = day(2, 9);
  return [
    { id: 'tomorrow-am', label: `${fmt(tomorrowAm)} — 9h-11h`, sub: 'Demain matin', at: tomorrowAm.toISOString() },
    { id: 'tomorrow-pm', label: `${fmt(tomorrowPm)} — 14h-16h`, sub: 'Demain après-midi', at: tomorrowPm.toISOString() },
    { id: 'after-am', label: `${fmt(afterAm)} — 9h-11h`, sub: 'Surlendemain matin', at: afterAm.toISOString() },
  ];
}

export function HomePickupAddressScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HomePickupAddress'>>();
  const { draft } = route.params;
  const { set: setParcelDraft, saveForLater } = useParcelDraft();

  const [address, setAddress] = useState('');
  const [slot, setSlot] = useState<string>('tomorrow-am');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const slots = useMemo(() => buildSlots(), []);

  const handleSaveLater = async () => {
    await saveForLater();
    notify('Brouillon enregistré', 'Tu peux reprendre où tu en étais à tout moment.');
    nav.goBack();
  };

  const submit = async () => {
    if (!address.trim()) {
      notify('Champ manquant', 'Adresse de retrait requise.');
      return;
    }
    const chosenSlot = slots.find((s) => s.id === slot);
    setLoading(true);
    try {
      setParcelDraft({
        pickupMode: 'HOME_PICKUP',
        // Les consignes (digicode, étage…) voyagent avec l'adresse : c'est ce
        // que lit la personne qui vient chercher l'envoi.
        pickupAddress: notes.trim() ? `${address.trim()} — ${notes.trim()}` : address.trim(),
        pickupAt: chosenSlot?.at,
        pickupNotes: notes.trim() || undefined,
      });
      const quote = await buildQuoteFromDraft(draft, 'HOME_PICKUP');
      nav.navigate('QuoteReview', { quote });
    } catch (e) {
      const msg = e instanceof ApiError ? (e.message ?? 'Erreur') : 'Erreur réseau.';
      notify('Devis impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ParcelWizard
        step={3}
        subtitle={draft.flow === 'VEHICLE' ? 'Convoyage' : 'Domicile'}
        onBack={() => nav.goBack()}
        onSaveLater={handleSaveLater}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120, gap: SPACING.lg }}>
          <View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
              {draft.flow === 'VEHICLE' ? 'Où se trouve le véhicule ?' : 'Où venir chercher ton colis ?'}
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
              {draft.flow === 'VEHICLE' ? 'Un convoyeur Axis vient chercher le véhicule et le conduit jusqu\'au port du Havre.' : 'Notre transporteur partenaire passe sur un créneau de 2h.'}
            </Text>
          </View>

          <Surface>
            <AddressField
              label="Adresse complète"
              value={address}
              onChangeText={setAddress}
              country={draft.from?.country}
              city={draft.from?.city}
              placeholder="Commence à taper : numéro et rue"
              hint="Choisis ton adresse dans la liste. L'étage, le digicode ou le bâtiment vont dans les consignes ci-dessous."
            />
          </Surface>

          {/* Créneaux pré-calculés */}
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
              {draft.flow === 'VEHICLE' ? 'Quand le convoyeur peut-il passer ?' : 'Créneau d\'enlèvement'}
            </Text>
            <View style={{ gap: 8 }}>
              {slots.map((s) => {
                const active = slot === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSlot(s.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: SPACING.md,
                      borderRadius: RADII.md,
                      borderWidth: 1,
                      borderColor: active ? theme.navy : theme.line,
                      backgroundColor: active ? theme.bgSoft : 'transparent',
                    }}
                  >
                    <Icons.calendar size={20} color={active ? theme.navy : theme.muted} stroke={1.8} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
                        {s.label}
                      </Text>
                      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
                        {s.sub}
                      </Text>
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
                      }}
                    >
                      {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.surface }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Surface>

          <Surface>
            <Field
              label="Notes pour le transporteur (optionnel)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Code d'accès, étage, instructions…"
              multiline
              numberOfLines={3}
            />
          </Surface>

          <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 18 }}>{draft.flow === 'VEHICLE' ? '🔑' : '📦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                  {draft.flow === 'VEHICLE' ? 'Préparation du véhicule' : 'Préparation du colis'}
                </Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                  {draft.flow === 'VEHICLE'
                    ? 'Prévois la carte grise, un double des clés et un quart de réservoir. Vide l\'habitacle : rien ne doit voyager dans la voiture.'
                    : 'Emballe ton colis dans un carton solide avec ton nom et le numéro de référence visible. Le transporteur t\'apporte l\'étiquette.'}
                </Text>
              </View>
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
            kind="primary"
            size="lg"
            fullWidth
            onPress={submit}
            loading={loading}
            rightIcon={<Icons.arrow size={18} color="#fff" stroke={2} />}
          >
            Calculer mon devis
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
