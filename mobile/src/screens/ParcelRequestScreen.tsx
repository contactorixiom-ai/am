import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { CountryRequirements, getDemoRequirements, getRequirements } from '../api/customs';
import { City } from '../api/quotes';
import { Button } from '../components/Button';
import { CityPicker } from '../components/CityPicker';
import { Icons } from '../components/Icons';
import { ParcelWizard } from '../components/ParcelWizard';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { ParcelSizeScreen } from './ParcelSizeScreen';
import { ParcelContentScreen } from './ParcelContentScreen';

// ─────────────────────────────────────────────────────────────────────────────
// ParcelRequestScreen
// Orchestrateur des étapes 1 → 3 du parcours d'envoi de colis.
// 1. Trajet (depuis / vers) avec bandeau d'éligibilité et réglementation
// 2. Quel colis  → délégué à <ParcelSizeScreen>
// 3. Contenu     → délégué à <ParcelContentScreen>
// → puis on navigue vers la route existante `PickupMode` (étape 4).
//
// Les étapes 4 (PickupMode), 5 (RecipientDetails) et 6 (BookingConfirmation)
// restent gérées par leurs écrans existants (refondus dans ce même PR).
// ─────────────────────────────────────────────────────────────────────────────
export function ParcelRequestScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ParcelRequest'>>();
  // PARCEL (colis) ou MERCHANDISE (volumineux) selon le service choisi.
  const service = route.params?.service ?? 'PARCEL';
  const { draft, set, reset, saveForLater, restored } = useParcelDraft();

  // Index interne 0 (Trajet) / 1 (Colis) / 2 (Contenu)
  const [step, setStep] = useState(() => Math.min(draft.step ?? 0, 2));

  useEffect(() => {
    // Garde l'étape en draft (utile pour "Reprendre plus tard")
    set({ step });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveLater = async () => {
    await saveForLater();
    notify('Brouillon enregistré', 'Tu peux reprendre où tu en étais à tout moment.');
    nav.goBack();
  };

  const handleBack = () => {
    if (step === 0) nav.goBack();
    else setStep((s) => s - 1);
  };

  const goNext = () => {
    if (step === 0) {
      if (!draft.from || !draft.to) {
        notify('Trajet incomplet', "Choisis une ville de départ et d'arrivée.");
        return;
      }
      if (!draft.transportMode) {
        notify('Mode manquant', 'Choisis aérien ou maritime.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!draft.kind) {
        notify('Type manquant', 'Sélectionne un type de colis.');
        return;
      }
      if (!draft.weightKg || draft.weightKg <= 0) {
        notify('Poids manquant', 'Indique un poids estimé.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!draft.description || draft.description.trim().length < 2) {
        notify('Description requise', 'Une courte description suffit (3 mots).');
        return;
      }
      // Étape suivante : récupération (route existante)
      const fromCity = draft.from!;
      const toCity = draft.to!;
      nav.navigate('PickupMode', {
        draft: {
          from: { ...fromCity },
          to: { ...toCity },
          weightKg: draft.weightKg!,
          category: draft.customsCategory ?? 'PERSONAL_EFFECTS',
          transportMode: draft.transportMode ?? 'AIR',
          service,
        },
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ParcelWizard step={step} onBack={handleBack} onSaveLater={handleSaveLater} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120, gap: SPACING.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {restored && step === 0 ? (
            <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.gold }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Icons.bell size={18} color={theme.gold} stroke={1.8} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>
                    Brouillon repris
                  </Text>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12.5, marginTop: 4 }}>
                    On a restauré ton envoi en cours.
                  </Text>
                </View>
                <Pressable onPress={() => reset()}>
                  <Text style={{ fontSize: 12, color: theme.navy, fontFamily: TYPO.weights.semibold }}>
                    Recommencer
                  </Text>
                </Pressable>
              </View>
            </Surface>
          ) : null}

          {step === 0 ? <StepTrajet /> : null}
          {step === 1 ? <ParcelSizeScreen draft={draft} onChange={set} /> : null}
          {step === 2 ? <ParcelContentScreen draft={draft} onChange={set} /> : null}
        </ScrollView>

        {/* CTA sticky en bas */}
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
            rightIcon={<Icons.arrow size={18} color="#fff" stroke={2} />}
          >
            {step === 2 ? 'Étape suivante : récupération' : 'Continuer'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 1 — Depuis / Vers + bandeau éligibilité + réglementation
// ─────────────────────────────────────────────────────────────────────────────
function StepTrajet() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, set } = useParcelDraft();
  const [reqs, setReqs] = useState<CountryRequirements | null>(null);
  const [loadingReqs, setLoadingReqs] = useState(false);

  // Charge la fiche douanière dès qu'on a un pays de destination
  useEffect(() => {
    if (!draft.to?.country) {
      setReqs(null);
      return;
    }
    setLoadingReqs(true);
    let cancelled = false;
    getRequirements(draft.to.country)
      .then((r) => !cancelled && setReqs(r))
      .catch(() => {
        const fb = getDemoRequirements(draft.to!.country);
        if (!cancelled) setReqs(fb);
      })
      .finally(() => !cancelled && setLoadingReqs(false));
    return () => {
      cancelled = true;
    };
  }, [draft.to?.country]);

  const eligibility = useMemo(() => computeEligibility(draft.to?.country), [draft.to?.country]);

  const setFrom = (c: City) => set({ from: { ...c } });
  const setTo = (c: City) => set({ to: { ...c } });
  const setMode = (m: 'AIR' | 'SEA') => set({ transportMode: m });

  return (
    <View style={{ gap: SPACING.lg }}>
      <View>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
          D'où part ton colis et où va-t-il ?
        </Text>
        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
          On organise la collecte, le transport multimodal et la livraison à domicile.
        </Text>
      </View>

      <Surface>
        <View style={{ gap: SPACING.md }}>
          <CityPicker label="Ville de départ (Europe)" value={draft.from ?? null} onChange={setFrom} region="EU" />
          <CityPicker label="Ville d'arrivée (Afrique)" value={draft.to ?? null} onChange={setTo} region="AFRICA" />
        </View>
      </Surface>

      {/* Bandeau éligibilité */}
      {draft.to ? (
        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icons.globe size={20} color={theme.navy} stroke={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' }}>
                Éligibilité
              </Text>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 4 }}>
                {eligibility.headline}
              </Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12.5, marginTop: 4, lineHeight: 17 }}>
                {eligibility.detail}
              </Text>
            </View>
          </View>
        </Surface>
      ) : null}

      {/* Réglementation douanière — cliquable pour ouvrir la checklist complète */}
      {draft.to && !loadingReqs && reqs && reqs.cargoMandatory && reqs.cargoTrackingType ? (
        <Pressable onPress={() => nav.navigate('CustomsRequirements', { countryCode: draft.to!.country, kind: 'parcel' })}>
          <Surface flat style={{ backgroundColor: theme.warn + '12', borderColor: theme.warn + '40' }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icons.warn size={18} color={theme.warn} stroke={1.8} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.warn, fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
                  {reqs.cargoTrackingType} obligatoire — émis par {reqs.authority ?? 'l\'autorité locale'}
                </Text>
                {reqs.customsNotes ? (
                  <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    {reqs.customsNotes}
                  </Text>
                ) : null}
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, marginTop: 6 }}>
                  Pas d'inquiétude — Axis s'en occupe pour toi (inclus dans le prix).
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Text style={{ color: theme.navy, fontFamily: TYPO.weights.semibold, fontSize: 12 }}>
                    Voir les documents requis
                  </Text>
                  <Icons.arrow size={13} color={theme.navy} stroke={2} />
                </View>
              </View>
            </View>
          </Surface>
        </Pressable>
      ) : draft.to && !loadingReqs ? (
        <Pressable onPress={() => nav.navigate('CustomsRequirements', { countryCode: draft.to!.country, kind: 'parcel' })}>
          <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icons.doc size={18} color={theme.navy} stroke={1.8} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
                  Documents requis à l'import
                </Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, marginTop: 2 }}>
                  Checklist douanière pour {draft.to.city}, {draft.to.country}
                </Text>
              </View>
              <Icons.arrow size={15} color={theme.navy} stroke={2} />
            </View>
          </Surface>
        </Pressable>
      ) : null}

      {/* Mode de transport */}
      <Surface>
        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.label, letterSpacing: 1, textTransform: 'uppercase', marginBottom: SPACING.md }}>
          Mode de transport
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <Pressable
            onPress={() => setMode('AIR')}
            style={{
              flex: 1,
              padding: SPACING.md,
              borderRadius: RADII.md,
              borderWidth: 1,
              borderColor: draft.transportMode === 'AIR' ? theme.navy : theme.line,
              backgroundColor: draft.transportMode === 'AIR' ? theme.bgSoft : 'transparent',
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 22 }}>✈️</Text>
              {draft.transportMode === 'AIR' ? <Pill tone="navy">Choisi</Pill> : null}
            </View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>Aérien</Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
              Rapide · 5-10 jours · dès 8,50 €/kg
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('SEA')}
            style={{
              flex: 1,
              padding: SPACING.md,
              borderRadius: RADII.md,
              borderWidth: 1,
              borderColor: draft.transportMode === 'SEA' ? theme.navy : theme.line,
              backgroundColor: draft.transportMode === 'SEA' ? theme.bgSoft : 'transparent',
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 22 }}>🚢</Text>
              {draft.transportMode === 'SEA' ? <Pill tone="navy">Choisi</Pill> : null}
            </View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>Maritime</Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
              Économique · 28-45 jours · dès 4,50 €/kg
            </Text>
          </Pressable>
        </View>
      </Surface>
    </View>
  );
}

// ─── Heuristique d'éligibilité par pays ────────────────────────────────────
function computeEligibility(countryCode?: string): { headline: string; detail: string } {
  const c = (countryCode ?? '').toUpperCase();
  const map: Record<string, { headline: string; detail: string }> = {
    SN: { headline: 'Sénégal — aérien 5-7 j, maritime 28 j', detail: 'Hub Dakar (DSS + port autonome). Livraison à domicile dans 14 villes.' },
    CI: { headline: "Côte d'Ivoire — aérien 5-7 j, maritime 30 j", detail: 'Hub Abidjan (port autonome). Livraison Abidjan, Bouaké, San Pédro.' },
    CM: { headline: 'Cameroun — aérien 6-8 j, maritime 32 j', detail: 'Hub Douala. Livraison Douala et Yaoundé.' },
    BJ: { headline: 'Bénin — aérien 6-8 j, maritime 30 j', detail: 'Hub Cotonou.' },
    TG: { headline: 'Togo — aérien 6-8 j, maritime 28 j', detail: 'Hub Lomé.' },
    GA: { headline: 'Gabon — aérien 7-9 j, maritime 35 j', detail: "Hub Libreville / port d'Owendo." },
    CD: { headline: 'RDC — aérien 7-10 j, maritime 38 j', detail: 'Hub Kinshasa, livraison Matadi/Lubumbashi.' },
    BF: { headline: 'Burkina Faso — aérien 6-8 j', detail: 'Pas de mer — uniquement aérien via Ouagadougou.' },
    ML: { headline: 'Mali — aérien 6-8 j', detail: 'Pas de mer — uniquement aérien via Bamako.' },
  };
  return (
    map[c] ?? {
      headline: 'Couverture standard',
      detail: 'Aérien 5-10 j ou maritime 28-45 j selon le port.',
    }
  );
}
