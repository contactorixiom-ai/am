import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { CountryRequirements, getDemoRequirements, getRequirements } from '../api/customs';
import { City, CreateQuoteInput, ShipmentFlow } from '../api/quotes';
import { Button } from '../components/Button';
import { CityPicker } from '../components/CityPicker';
import { Icons } from '../components/Icons';
import { LivePriceBar } from '../components/LivePriceBar';
import { ParcelWizard } from '../components/ParcelWizard';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { OPERATIONS } from '../config/company';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { eurShort, itemsFromCounts, orderableItems, useTariffs } from '../utils/tariffs';
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
  // Voiture vers l'Afrique ou import Afrique → Europe : parcours propres, qui
  // ne doivent pas reprendre un brouillon de colis (ni l'inverse).
  const flow = route.params?.flow;
  useEffect(() => {
    if ((draft.flow ?? undefined) !== flow) {
      reset();
      set({ flow, transportMode: flow === 'VEHICLE' ? 'SEA' : undefined });
    }
  }, [flow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Index interne 0 (Trajet) / 1 (Colis) / 2 (Contenu)
  const [step, setStep] = useState(() => Math.min(draft.step ?? 0, 2));

  useEffect(() => {
    // Garde l'étape en draft (utile pour "Reprendre plus tard")
    set({ step });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Estimation en direct : dès que le trajet et le poids sont connus, le
  // client voit son tarif, sans attendre l'étape 4.
  // Maritime : articles de la grille (fûts, cartons, m³…) ; aérien : poids.
  const isSea = draft.transportMode === 'SEA';
  // Articles de la grille : maritime, voiture et import (même en aérien).
  const usesItems = isSea || !!flow;
  const seaItems = useMemo(() => itemsFromCounts(draft.items), [draft.items]);
  const estimateInput: CreateQuoteInput | null = useMemo(() => {
    if (!draft.from || !draft.to) return null;
    const route = {
      service,
      flow,
      pickupMode: flow === 'IMPORT' ? 'HUB_DROP_OFF' : draft.pickupMode ?? 'HUB_DROP_OFF',
      fromCity: draft.from.city,
      fromCountry: draft.from.country,
      toCity: draft.to.city,
      toCountry: draft.to.country,
    } as const;
    if (usesItems) {
      if (seaItems.length === 0) return null;
      return { ...route, transportMode: flow === 'IMPORT' ? draft.transportMode : 'SEA', items: seaItems, weightKg: draft.weightKg };
    }
    if (!draft.weightKg || draft.weightKg <= 0) return null;
    return { ...route, transportMode: draft.transportMode ?? 'AIR', weightKg: draft.weightKg };
  }, [service, flow, draft.from, draft.to, draft.weightKg, draft.transportMode, draft.pickupMode, usesItems, seaItems]);

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
        if (flow === 'VEHICLE') set({ transportMode: 'SEA' });
        else {
          notify('Mode manquant', flow === 'IMPORT' ? 'Choisis aérien (épicerie, échantillons) ou maritime (artisanat).' : 'Choisis aérien ou maritime.');
          return;
        }
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (usesItems) {
        if (seaItems.length === 0) {
          notify(
            'Contenu manquant',
            flow === 'VEHICLE'
              ? 'Choisis le type de véhicule à expédier.'
              : flow === 'IMPORT'
              ? 'Indique ce que tu fais venir : kilos d\'épicerie, m³ d\'artisanat ou forfait échantillons.'
              : service === 'PARCEL'
              ? 'Ajoute au moins un article : fût, carton, valise ou appareil.'
              : 'Indique un volume en m³ ou un nombre de palettes.',
          );
          return;
        }
        if (flow === 'VEHICLE') {
          if (!draft.vehicleModel?.trim()) {
            notify('Véhicule', 'Indique la marque et le modèle du véhicule.');
            return;
          }
          // Description douanière déduite du véhicule, modifiable à l'étape suivante.
          if (!draft.description?.trim()) {
            set({
              description: [draft.vehicleModel.trim(), draft.vehiclePlate?.trim(), draft.vehicleYear?.trim()].filter(Boolean).join(' · '),
              customsCategory: draft.customsCategory ?? 'PERSONAL_EFFECTS',
            });
          }
        }
        setStep(2);
        return;
      }
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
          weightKg: draft.weightKg,
          category: draft.customsCategory ?? 'PERSONAL_EFFECTS',
          transportMode: flow === 'VEHICLE' ? 'SEA' : draft.transportMode ?? 'AIR',
          service,
          items: usesItems ? seaItems : undefined,
          flow,
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
                  <Text style={{ fontSize: 12, color: theme.link, fontFamily: TYPO.weights.semibold }}>
                    Recommencer
                  </Text>
                </Pressable>
              </View>
            </Surface>
          ) : null}

          {step === 0 ? <StepTrajet service={service} flow={flow} /> : null}
          {step === 1 ? (
            <ParcelSizeScreen draft={draft} onChange={set} service={service} flow={flow} onOpenTariffs={() => nav.navigate('Tariffs')} />
          ) : null}
          {step === 2 ? <ParcelContentScreen draft={draft} onChange={set} flow={flow} /> : null}
        </ScrollView>

        <LivePriceBar
          input={estimateInput}
          placeholder={
            flow === 'VEHICLE'
              ? 'Choisis le type de véhicule : le tarif s\'affiche aussitôt.'
              : flow === 'IMPORT'
              ? 'Indique ce que tu fais venir : le tarif s\'affiche aussitôt.'
              : step === 0
              ? (isSea ? 'Choisis ton trajet, puis ce que tu envoies : le tarif s\'affiche aussitôt.' : 'Choisis ton trajet, puis le poids : le tarif s\'affiche aussitôt.')
              : isSea
                ? (service === 'PARCEL' ? 'Ajoute tes fûts, cartons ou valises pour voir le tarif.' : 'Indique le volume ou les palettes pour voir le tarif.')
                : 'Indique le poids du colis pour voir le tarif.'
          }
        />

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
            {step === 2 ? (flow === 'VEHICLE' ? 'Étape suivante : remise du véhicule' : flow === 'IMPORT' ? 'Étape suivante : dépôt au pays' : 'Étape suivante : récupération') : 'Continuer'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 1 — Depuis / Vers + bandeau éligibilité + réglementation
// ─────────────────────────────────────────────────────────────────────────────
function StepTrajet({ service, flow }: { service: 'PARCEL' | 'MERCHANDISE'; flow?: ShipmentFlow }) {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { draft, set } = useParcelDraft();
  const { sheet } = useTariffs();
  // Prix d'appel tirés de la grille : 8,50 €/kg en aérien ; en maritime,
  // le moins cher des articles du parcours (carton, ou m³).
  const importAir = sheet && flow === 'IMPORT' ? orderableItems(sheet, 'IMPORT', 'AIR').find((i) => i.unit === 'kg') : undefined;
  const airFrom = importAir ? `dès\u00a0${eurShort(importAir.minCents)}/kg` : sheet ? `${eurShort(sheet.airPerKgCents)}/kg` : null;
  const seaCheapest = sheet
    ? orderableItems(sheet, flow ?? service, flow === 'IMPORT' ? 'SEA' : undefined).reduce<null | { cents: number; unit: string }>((best, i) => {
        const unit = i.unit === 'm3' ? '/m³' : '';
        return !best || i.minCents < best.cents ? { cents: i.minCents, unit } : best;
      }, null)
    : null;
  const seaFrom = seaCheapest ? `dès\u00a0${eurShort(seaCheapest.cents)}${seaCheapest.unit}` : null;
  const [reqs, setReqs] = useState<CountryRequirements | null>(null);
  const [loadingReqs, setLoadingReqs] = useState(false);

  // Charge la fiche douanière dès qu'on a un pays de destination (Afrique).
  useEffect(() => {
    if (!draft.to?.country || flow === 'IMPORT') {
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
  }, [draft.to?.country, flow]);

  const eligibility = useMemo(() => computeEligibility(draft.to?.country), [draft.to?.country]);

  const setFrom = (c: City) => set({ from: { ...c } });
  const setTo = (c: City) => set({ to: { ...c } });
  const setMode = (m: 'AIR' | 'SEA') => set({ transportMode: m });

  return (
    <View style={{ gap: SPACING.lg }}>
      <View>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
          {flow === 'VEHICLE'
            ? 'Où est le véhicule, et où l\'envoyer ?'
            : flow === 'IMPORT'
            ? 'Que fais-tu venir d\'Afrique ?'
            : 'D\'où part ton colis et où va-t-il ?'}
        </Text>
        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
          {flow === 'VEHICLE'
            ? 'Axis embarque ton véhicule au port du Havre (bateau RORO) et prépare les documents d\'export et de douane.'
            : flow === 'IMPORT'
            ? 'L\'expéditeur dépose l\'envoi chez le correspondant Axis au pays ; Axis l\'achemine jusqu\'à toi.'
            : 'On organise le transport jusqu\'au destinataire et les documents de douane.'}
        </Text>
      </View>

      <Surface>
        <View style={{ gap: SPACING.md }}>
          {flow === 'IMPORT' ? (
            <>
              <CityPicker label="Ville de départ (Afrique)" value={draft.from ?? null} onChange={setFrom} region="AFRICA" />
              <CityPicker label="Ville d'arrivée (France / Europe)" value={draft.to ?? null} onChange={setTo} region="EU" />
            </>
          ) : (
            <>
              <CityPicker label={flow === 'VEHICLE' ? 'Où se trouve le véhicule (Europe)' : 'Ville de départ (Europe)'} value={draft.from ?? null} onChange={setFrom} region="EU" />
              <CityPicker label={flow === 'VEHICLE' ? 'Port / ville d\'arrivée (Afrique)' : 'Ville d\'arrivée (Afrique)'} value={draft.to ?? null} onChange={setTo} region="AFRICA" />
            </>
          )}
        </View>
      </Surface>

      {flow === 'IMPORT' ? (
        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icons.shield size={18} color={theme.gold} stroke={1.8} />
            <Text style={{ flex: 1, color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12.5, lineHeight: 17 }}>
              Axis prépare les documents d'export et d'import. Produits alimentaires : secs et bien emballés uniquement (pas de viande, poisson, produits laitiers ni plantes). Les droits et la TVA d'importation éventuels sont à la charge du destinataire.
            </Text>
          </View>
        </Surface>
      ) : null}

      {/* Bandeau éligibilité */}
      {draft.to && flow !== 'IMPORT' ? (
        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icons.globe size={20} color={theme.link} stroke={1.8} />
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

      {/* Formalités douanières — incluses et gérées par Axis. Côté client on
          reste simple : la déclaration suffit, les documents sont traités en
          interne (espace admin). */}
      {draft.to && !loadingReqs && reqs && reqs.cargoMandatory ? (
        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icons.shield size={18} color={theme.gold} stroke={1.8} />
            <Text style={{ flex: 1, color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12.5, lineHeight: 17 }}>
              Documents de douane préparés par Axis (bordereaux, déclarations). Tu n'as qu'à décrire ton envoi. Les droits et taxes à l'arrivée restent à la charge du destinataire.
            </Text>
          </View>
        </Surface>
      ) : null}

      {/* Mode de transport (voiture : toujours en bateau) */}
      {flow === 'VEHICLE' ? (
        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.ship size={20} color="#F5F1E8" stroke={1.9} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>Maritime RORO</Text>
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
                Le véhicule roule à bord du navire{seaFrom ? ` · ${seaFrom}` : ''}
              </Text>
            </View>
          </View>
        </Surface>
      ) : (
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
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: draft.transportMode === 'AIR' ? theme.navy : theme.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.plane size={20} color={draft.transportMode === 'AIR' ? '#F5F1E8' : theme.goldDeep} stroke={1.9} />
              </View>
              {draft.transportMode === 'AIR' ? <Pill tone="navy">Choisi</Pill> : null}
            </View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>Aérien</Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
              Rapide{OPERATIONS.delays?.air ? ` · ${OPERATIONS.delays.air}` : ''}{airFrom ? ` · ${airFrom}` : ''}
            </Text>
            {flow === 'IMPORT' ? (
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, marginTop: 2 }}>
                Épicerie, épices, échantillons pro
              </Text>
            ) : null}
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
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: draft.transportMode === 'SEA' ? theme.navy : theme.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.ship size={20} color={draft.transportMode === 'SEA' ? '#F5F1E8' : theme.goldDeep} stroke={1.9} />
              </View>
              {draft.transportMode === 'SEA' ? <Pill tone="navy">Choisi</Pill> : null}
            </View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginTop: 8 }}>Maritime</Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
              Économique{OPERATIONS.delays?.sea ? ` · ${OPERATIONS.delays.sea}` : ''}{seaFrom ? ` · ${seaFrom}` : ''}
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, marginTop: 2 }}>
              {flow === 'IMPORT' ? 'Artisanat, sculptures · au m³' : service === 'PARCEL' ? 'Fûts, cartons, valises, électroménager' : 'Au m³ ou à la palette'}
            </Text>
          </Pressable>
        </View>
      </Surface>
      )}

      <Pressable
        onPress={() => nav.navigate('Tariffs')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 4 }}
      >
        <Icons.euro size={15} color={theme.link} stroke={1.9} />
        <Text style={{ color: theme.link, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>Voir la grille tarifaire complète</Text>
        <Icons.chev size={14} color={theme.link} stroke={2} />
      </Pressable>
    </View>
  );
}

// ─── Délais et remarques par destination ────────────────────────────────────
// Les délais par pays affichés auparavant (« Sénégal — aérien 5-7 j,
// maritime 28 j »…) n'avaient été validés par personne : on n'affiche que
// ceux renseignés dans app.json (extra.operations.delays.air / .sea).
function computeEligibility(countryCode?: string): { headline: string; detail: string } {
  const c = (countryCode ?? '').toUpperCase();
  const air = OPERATIONS.delays?.air;
  const sea = OPERATIONS.delays?.sea;
  const landlocked = c === 'BF' || c === 'ML' || c === 'NE' || c === 'TD' || c === 'CF';
  const parts = [air ? `aérien ${air}` : null, sea && !landlocked ? `maritime ${sea}` : null].filter(Boolean);
  const headline = parts.length > 0
    ? `Délais indicatifs : ${parts.join(', ')}`
    : 'Délai confirmé par Axis à la prise en charge';
  const base = 'Livraison à l\'adresse indiquée ou remise convenue avec le destinataire.';
  return {
    headline,
    detail: landlocked ? `Pays sans façade maritime : l'aérien est le plus simple. ${base}` : base,
  };
}
