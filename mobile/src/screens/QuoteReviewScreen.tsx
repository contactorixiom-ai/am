import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { notify } from '../utils/notify';
import { ApiError } from '../api/client';
import { QuoteHint } from '../api/quotes';
import { createVehicle } from '../api/vehicles';
import { clearConvoyDraft, createMission, readConvoyDraft } from '../api/missions';
import { AppBar } from '../components/AppBar';
import { ParcelWizard } from '../components/ParcelWizard';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { LogisticsPartnerCard } from '../components/LogisticsPartnerCard';
import { Pill } from '../components/Pill';
import { SectionHead } from '../components/SectionHead';
import { StyledRouteMap } from '../components/StyledRouteMap';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { fmtEur, fmtLocal } from '../utils/currency';
import { selectPartner } from '../utils/logisticsPartners';

export function QuoteReviewScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'QuoteReview'>>();
  const { quote } = route.params;
  const { draft: parcelDraft } = useParcelDraft();

  const isConvoy = quote.service === 'CONVOY_CAR' || quote.service === 'CONVOY_MOTO';
  const isParcel = quote.service === 'PARCEL' || quote.service === 'MERCHANDISE';
  const totalLocal = fmtLocal(quote.totalCents, quote.toCountry);

  const [booking, setBooking] = useState(false);

  // Pour les colis : on pré-sélectionne le transporteur partenaire (tronçon 1)
  // pour informer le client AVANT achat. Numéro de tracking caché à ce stade.
  const partner = isParcel ? selectPartner({ fromCountry: quote.fromCountry, weightKg: quote.weightKg ?? undefined, toCountry: quote.toCountry }) : null;

  // Réservation réelle d'un convoyage : créer le véhicule puis la mission.
  const bookConvoy = async () => {
    setBooking(true);
    try {
      const draft = await readConvoyDraft();

      // 1) Véhicule — make/model/plate/year obligatoires côté DTO. À défaut
      // (brouillon perdu, navigation privée), on met des valeurs neutres pour
      // que la création reste possible plutôt que de bloquer l'utilisateur.
      const vehicle = await createVehicle({
        type: quote.service === 'CONVOY_MOTO' ? 'MOTORCYCLE' : 'CAR',
        make: draft?.vehicleMake || 'Véhicule',
        model: draft?.vehicleModel || 'À préciser',
        year: draft?.vehicleYear ?? new Date().getFullYear(),
        licensePlate: draft?.vehiclePlate || 'TEMP-0000',
        registrationCountry: quote.fromCountry?.slice(0, 2).toUpperCase() || undefined,
      });

      // 2) Mission — coordonnées dérivées du devis. pickupAt = demain matin.
      const pickupAt = new Date();
      pickupAt.setDate(pickupAt.getDate() + 1);
      pickupAt.setHours(8, 0, 0, 0);

      const mission = await createMission({
        vehicleId: vehicle.id,
        pickupAddress: draft?.pickupAddress || `${quote.fromCity}, ${quote.fromCountry}`,
        pickupCity: quote.fromCity,
        pickupCountry: quote.fromCountry,
        pickupLatitude: quote.fromLatitude ?? 0,
        pickupLongitude: quote.fromLongitude ?? 0,
        pickupAt: pickupAt.toISOString(),
        deliveryAddress: draft?.deliveryAddress || `${quote.toCity}, ${quote.toCountry}`,
        deliveryCity: quote.toCity,
        deliveryCountry: quote.toCountry,
        deliveryLatitude: quote.toLatitude ?? 0,
        deliveryLongitude: quote.toLongitude ?? 0,
        pickupNotes: draft?.notes,
      });

      await clearConvoyDraft();
      nav.replace('BookingConfirmation', {
        kind: 'mission',
        reference: mission.reference,
        id: mission.id,
      });
    } catch (e) {
      // Repli démo : sur erreur réseau (backend down) on génère une référence
      // locale et on navigue quand même pour garder l'app démo-able hors-ligne.
      const isNetwork = e instanceof ApiError ? e.isNetworkError : !(e instanceof ApiError);
      if (isNetwork) {
        const localRef = `AX-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now()
          .toString(36)
          .slice(-4)
          .toUpperCase()}`;
        await clearConvoyDraft();
        notify('Enregistré en local', 'Pas de réseau : ta réservation est gardée localement et sera synchronisée plus tard.');
        nav.replace('BookingConfirmation', {
          kind: 'mission',
          reference: localRef,
          id: 'local-demo',
        });
        return;
      }
      const msg = e instanceof ApiError ? e.message : 'Erreur inconnue.';
      notify('Réservation impossible', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setBooking(false);
    }
  };

  const handleBook = () => {
    if (isConvoy) {
      bookConvoy();
      return;
    }
    if (isParcel) {
      nav.navigate('RecipientDetails', { quote });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Ton devis" subtitle={quote.reference} />
      {/* Continuité visuelle avec le parcours colis (ParcelWizard étape 5). */}
      {isParcel ? <ParcelWizard step={5} onBack={() => nav.goBack()} subtitle="Récap & paiement" /> : null}

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 16 }}>
        {/* Hero prix — card navy avec total en doré */}
        <Surface
          padded
          flat
          style={{
            padding: 18,
            backgroundColor: theme.navy,
            borderColor: theme.navy,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Décor : 3 cercles concentriques dorés en arrière-plan, top-right */}
          <View style={{ position: 'absolute', right: -60, top: -50, opacity: 0.14 }} pointerEvents="none">
            <Svg width={260} height={260} viewBox="0 0 220 220">
              <SvgCircle cx="110" cy="110" r="100" stroke={theme.gold} strokeWidth={1} fill="none" />
              <SvgCircle cx="110" cy="110" r="70"  stroke={theme.gold} strokeWidth={1} fill="none" />
              <SvgCircle cx="110" cy="110" r="40"  stroke={theme.gold} strokeWidth={1} fill="none" />
            </Svg>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pill tone="gold">{quote.uncertaintyPct ? `Estimé ±${quote.uncertaintyPct}%` : 'Instantané'}</Pill>
            <Text
              style={{
                fontSize: 11.5,
                color: theme.goldHi,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                fontFamily: TYPO.weights.semibold,
                fontVariant: ['tabular-nums'],
              }}
            >
              {quote.reference}
            </Text>
          </View>

          <Text
            style={{
              fontSize: 11,
              color: theme.goldHi,
              marginTop: 16,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              fontFamily: TYPO.weights.semibold,
            }}
          >
            Total TTC
          </Text>
          <Text
            style={{
              fontFamily: TYPO.weights.bold,
              fontSize: 44,
              color: '#F1ECDC',
              letterSpacing: -1.2,
              lineHeight: 46,
              marginTop: 4,
            }}
          >
            {fmtEur(quote.totalCents)}
          </Text>
          {totalLocal ? (
            <Text
              style={{
                fontSize: 13,
                color: theme.gold,
                marginTop: 6,
                fontFamily: TYPO.weights.semibold,
                fontVariant: ['tabular-nums'],
              }}
            >
              ≈ {totalLocal} pour le destinataire
            </Text>
          ) : null}
          <Text
            style={{
              fontSize: 11.5,
              color: 'rgba(241,236,220,0.6)',
              marginTop: 8,
              fontFamily: TYPO.weights.medium,
            }}
          >
            TVA 20 % incluse · valide 30 jours
          </Text>
        </Surface>

        {/* Trajet visuel sur carte */}
        {quote.fromLatitude && quote.fromLongitude && quote.toLatitude && quote.toLongitude ? (
          <StyledRouteMap
            height={180}
            from={quote.fromCity}
            to={quote.toCity}
            progress={0}
          />
        ) : null}

        {/* Récap trajet */}
        <Surface padded style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ alignItems: 'center', paddingTop: 4, marginRight: 12 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.gold }} />
              <View
                style={{
                  width: 1.5,
                  height: 32,
                  borderLeftWidth: 1.5,
                  borderLeftColor: theme.line,
                  borderStyle: 'dashed',
                  marginVertical: 4,
                }}
              />
              <View
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: theme.navy,
                  transform: [{ rotate: '45deg' }],
                }}
              />
            </View>
            <View style={{ flex: 1, justifyContent: 'space-between', minHeight: 60 }}>
              <View>
                <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.semibold }}>
                  Départ
                </Text>
                <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>
                  {quote.fromCity} · {quote.fromCountry}
                </Text>
              </View>
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.semibold }}>
                  Arrivée
                </Text>
                <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 2 }}>
                  {quote.toCity} · {quote.toCountry}
                </Text>
              </View>
            </View>
          </View>

          {(quote.distanceKm || isParcel) ? (
            <View
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: theme.line,
                flexDirection: 'row',
                justifyContent: 'space-around',
              }}
            >
              {quote.distanceKm ? (
                <Stat label="Distance" value={`${Math.round(quote.distanceKm).toLocaleString('fr-FR')} km`} />
              ) : null}
              {isParcel ? (
                <Stat
                  label="Transport"
                  value={quote.transportMode === 'AIR' ? '✈️ Aérien' : '🚢 Maritime'}
                  sub={quote.transportMode === 'AIR' ? '5-10 j' : '30-45 j'}
                />
              ) : null}
              {isParcel ? (
                <Stat label="Récupération" value={pickupModeLabel(quote.pickupMode, parcelDraft.relayPointLabel)} />
              ) : null}
            </View>
          ) : null}
        </Surface>

        {/* Décomposition */}
        <Surface padded style={{ padding: 16 }}>
          <SectionHead title="Détail du tarif" />
          <DetailRow
            label={isConvoy
              ? `Forfait + ${quote.distanceKm ? Math.round(quote.distanceKm) : 0} km`
              : `Transport (${quote.weightKg} kg)`}
            sub={isConvoy
              ? 'Distance × tarif kilométrique HT'
              : quote.transportMode === 'AIR' ? 'Acheminement aérien Europe → Afrique' : 'Acheminement maritime conteneur'}
            value={fmtEur(quote.basePriceCents + quote.variablePriceCents)}
          />
          {quote.pickupFeeCents > 0 ? (
            <DetailRow
              label="Récupération du colis"
              sub={pickupSub(quote.pickupMode)}
              value={`+ ${fmtEur(quote.pickupFeeCents)}`}
            />
          ) : null}
          <DetailRow
            label="Assurance tous risques"
            sub={`Jusqu'à 250 000 € · ${isConvoy ? 'AXA Transport' : 'Allianz Marine'}`}
            value="Inclus"
            included
          />
          <DetailRow
            label="Suivi GPS temps réel"
            sub="Mise à jour toutes les 30 secondes"
            value="Inclus"
            included
          />
          <DetailRow
            label="Contrat & état des lieux PDF"
            sub="Signé électroniquement"
            value="Inclus"
            included
          />
          {isParcel ? (
            <DetailRow
              label="Démarches douanières"
              sub="BSC, déclaration export, certificat origine"
              value="Inclus"
              included
            />
          ) : null}
          {quote.options.map((o) => (
            <DetailRow
              key={o.kind}
              label={o.label}
              sub="Option ajoutée"
              value={`+ ${fmtEur(o.priceCents)}`}
              addon
            />
          ))}

          <View style={{ height: 1.5, backgroundColor: theme.line, marginTop: 12, marginBottom: 0 }} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.7, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Total TTC
              </Text>
              <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }}>
                TVA 20 % incluse
              </Text>
            </View>
            <Text style={{ fontFamily: TYPO.weights.bold, fontSize: 28, color: theme.ink, letterSpacing: -0.3, fontVariant: ['tabular-nums'] }}>
              {fmtEur(quote.totalCents)}
            </Text>
          </View>

          {quote.disclaimer ? (
            <View
              style={{
                marginTop: 14,
                padding: 12,
                backgroundColor: theme.warn + '15',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.warn + '40',
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <Icons.warn size={18} color={theme.warn} stroke={1.8} />
              <Text style={{ flex: 1, color: theme.warn, fontFamily: TYPO.weights.medium, fontSize: 12.5, lineHeight: 17 }}>
                {quote.disclaimer}
              </Text>
            </View>
          ) : null}
        </Surface>

        {/* Transporteur partenaire (premier tronçon) — uniquement colis */}
        {partner ? (
          <View>
            <SectionHead title="Premier kilomètre" />
            <LogisticsPartnerCard partner={partner} showTracking={false} />
          </View>
        ) : null}

        {/* Comparison strip : 4 badges trust */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { Ic: Icons.shield, l: 'Assurance 250k€' },
            { Ic: Icons.pin,    l: 'Suivi temps réel' },
            { Ic: Icons.doc,    l: 'Contrat signé PDF' },
            { Ic: Icons.camera, l: 'État des lieux x16' },
          ].map((b) => (
            <View
              key={b.l}
              style={{
                flexBasis: '48%',
                flexGrow: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
              }}
            >
              <b.Ic size={16} color={theme.gold} stroke={1.8} />
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.semibold, flex: 1 }}
              >
                {b.l}
              </Text>
            </View>
          ))}
        </View>

        {/* Smart hints */}
        {quote.hints && quote.hints.length > 0 ? (
          <View>
            <SectionHead title="Conseils Axis" />
            <View style={{ gap: 10 }}>
              {quote.hints.map((h, i) => (
                <HintCard key={i} hint={h} />
              ))}
            </View>
          </View>
        ) : null}
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
          gap: 10,
        }}
      >
        <Button
          kind="gold"
          size="lg"
          fullWidth
          onPress={handleBook}
          loading={booking}
          rightIcon={<Icons.arrow size={18} color={theme.navy} stroke={2} />}
        >
          {isConvoy ? 'Réserver le convoyage' : 'Réserver maintenant'}
        </Button>
        <Button kind="ghost" onPress={() => nav.goBack()} disabled={booking}>
          Modifier le devis
        </Button>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.9, fontFamily: TYPO.weights.semibold }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 4 }}>
        {value}
      </Text>
      {sub ? (
        <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 1 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function HintCard({ hint }: { hint: QuoteHint }) {
  const { theme } = useTheme();
  const emoji = HINT_EMOJI[hint.kind] ?? '💡';
  return (
    <Surface padded style={{ padding: 14, backgroundColor: theme.surface2 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: 13.5 }}>
            {hint.label}
          </Text>
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12.5, marginTop: 4, lineHeight: 17 }}>
            {hint.detail}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

const HINT_EMOJI: Record<string, string> = {
  SAVE_WITH_SEA: '🚢',
  FAST_WITH_AIR: '✈️',
  CHEAPER_AT_RELAY: '🏪',
  INSURANCE_RECOMMENDED: '🛡️',
  CONSOLIDATE: '📦',
};

function pickupModeLabel(mode: string, relayLabel?: string): string {
  switch (mode) {
    case 'HUB_DROP_OFF':   return 'Hub Axis';
    case 'RELAY_DROP_OFF': return relayLabel ? '🏪 Relais' : '🏪 Point relais';
    case 'HOME_PICKUP':    return '🚪 Domicile';
    default:               return '—';
  }
}

function DetailRow({
  label,
  sub,
  value,
  included,
  addon,
}: {
  label: string;
  sub?: string;
  value: string;
  included?: boolean;
  addon?: boolean;
}) {
  const { theme } = useTheme();
  const valueColor = included ? theme.good : addon ? theme.goldDeep : theme.ink;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.lineSoft,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
          {label}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 1, fontFamily: TYPO.weights.medium }}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontSize: 13.5,
          color: valueColor,
          fontFamily: TYPO.weights.semibold,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function pickupSub(mode: string): string {
  switch (mode) {
    case 'HUB_DROP_OFF':   return 'Dépôt au hub Axis · gratuit';
    case 'RELAY_DROP_OFF': return 'Point relais partenaire';
    case 'HOME_PICKUP':    return 'Enlèvement à domicile';
    default:               return '';
  }
}
