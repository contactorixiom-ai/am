import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { createQuote, PickupMode } from '../api/quotes';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { ParcelWizard } from '../components/ParcelWizard';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { ParcelDraft, RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { OPERATIONS } from '../config/company';
import { notify } from '../utils/notify';

interface ModeMeta {
  kind: PickupMode;
  emoji: string;
  title: string;
  subtitle: string;
  perKgHint: string;
  badge?: 'GRATUIT' | 'PREMIUM' | 'POPULAIRE';
  details: string[];
}

// Chaque ligne doit décrire ce qu'Axis fait réellement. Les versions
// précédentes promettaient des hubs à Paris, Lyon et Marseille, 20 000 points
// relais, un créneau de 2 h et un SMS 30 min avant : rien de cela n'existait.
function buildModes(): ModeMeta[] {
  const modes: ModeMeta[] = [
    {
      kind: 'HUB_DROP_OFF',
      emoji: '🏢',
      title: 'Je dépose chez Axis',
      subtitle: OPERATIONS.dropOffAddress || 'Adresse de dépôt communiquée à la confirmation',
      perKgHint: 'Gratuit',
      badge: 'GRATUIT',
      details: [
        'Aucun frais de prise en charge',
        'Reçu de dépôt remis sur place',
        OPERATIONS.dropOffHours || 'Horaires convenus avec Axis',
      ],
    },
  ];
  if (OPERATIONS.relayPoints) {
    modes.push({
      kind: 'RELAY_DROP_OFF',
      emoji: '🏪',
      title: 'Je dépose en point relais',
      subtitle: 'Point relais proche de chez toi',
      perKgHint: 'Forfait 5 €',
      details: ['Étiquette fournie par Axis', 'Dépôt sous 7 jours'],
    });
  }
  if (OPERATIONS.homePickup) {
    modes.push({
      kind: 'HOME_PICKUP',
      emoji: '🚪',
      title: 'On vient chercher chez moi',
      subtitle: 'Enlèvement à ton adresse',
      perKgHint: 'Forfait 25 €',
      details: ['Créneau convenu avec toi par Axis', 'Forfait inclus dans le devis'],
    });
  }
  return modes;
}

const MODES = buildModes();

// Réutilisé par RelayPointPicker et HomePickupAddress
export async function buildQuoteFromDraft(
  draft: ParcelDraft,
  pickupMode: PickupMode,
) {
  return createQuote({
    service: draft.service ?? 'PARCEL',
    transportMode: draft.transportMode,
    pickupMode,
    fromCity: draft.from.city,
    fromCountry: draft.from.country,
    fromLatitude: draft.from.latitude,
    fromLongitude: draft.from.longitude,
    toCity: draft.to.city,
    toCountry: draft.to.country,
    toLatitude: draft.to.latitude,
    toLongitude: draft.to.longitude,
    weightKg: draft.weightKg,
  });
}

export function PickupModeScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PickupMode'>>();
  const { draft } = route.params;
  const { set: setParcelDraft, saveForLater } = useParcelDraft();
  const [mode, setMode] = useState<PickupMode>('HUB_DROP_OFF');
  const [loading, setLoading] = useState(false);

  const handleSaveLater = async () => {
    await saveForLater();
    notify('Brouillon enregistré', 'Tu peux reprendre où tu en étais à tout moment.');
    nav.goBack();
  };

  const goNext = async () => {
    setParcelDraft({ pickupMode: mode });
    if (mode === 'RELAY_DROP_OFF') {
      nav.navigate('RelayPointPicker', { draft });
      return;
    }
    if (mode === 'HOME_PICKUP') {
      nav.navigate('HomePickupAddress', { draft });
      return;
    }
    // HUB → on génère le devis directement
    setLoading(true);
    try {
      const quote = await buildQuoteFromDraft(draft, 'HUB_DROP_OFF');
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
      <ParcelWizard step={3} onBack={() => nav.goBack()} onSaveLater={handleSaveLater} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120, gap: SPACING.lg }}>
        <View>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
            Comment on récupère ton colis ?
          </Text>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
            {MODES.length > 1 ? `${MODES.length} options. ` : ''}Tu peux changer d'avis jusqu'au paiement.
          </Text>
        </View>


        <View style={{ gap: SPACING.md }}>
          {MODES.map((m) => {
            const active = mode === m.kind;
            return (
              <Pressable key={m.kind} onPress={() => setMode(m.kind)}>
                <Surface
                  padded
                  flat
                  style={{
                    borderColor: active ? theme.navy : theme.line,
                    backgroundColor: active ? theme.bgSoft : theme.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md }}>
                    <Text style={{ fontSize: 32 }}>{m.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
                          {m.title}
                        </Text>
                        {m.badge ? (
                          <Pill tone={m.badge === 'GRATUIT' ? 'good' : m.badge === 'POPULAIRE' ? 'navy' : 'gold'}>
                            {m.badge}
                          </Pill>
                        ) : null}
                      </View>
                      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                        {m.subtitle}
                      </Text>
                      <Text
                        style={{
                          color: active ? theme.navy : theme.muted,
                          fontFamily: TYPO.weights.semibold,
                          fontSize: TYPO.sizes.bodySm,
                          marginTop: 6,
                        }}
                      >
                        {m.perKgHint}
                      </Text>

                      {active ? (
                        <View style={{ marginTop: SPACING.md, gap: 6 }}>
                          {m.details.map((d) => (
                            <View key={d} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                              <Icons.check size={14} color={theme.good} stroke={2.4} />
                              <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12.5 }}>
                                {d}
                              </Text>
                            </View>
                          ))}
                        </View>
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

        <Surface flat style={{ backgroundColor: theme.surface2, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 18 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                Notre conseil
              </Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 4 }}>
                Le point relais est l'option la plus économique pour les colis &lt; 15 kg. L'enlèvement à domicile (25 €) est pratique ; le point relais (5 €) est plus économique.
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
          onPress={goNext}
          loading={loading}
          rightIcon={<Icons.arrow size={18} color="#fff" stroke={2} />}
        >
          {mode === 'HUB_DROP_OFF' ? 'Calculer mon devis' : 'Continuer'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

