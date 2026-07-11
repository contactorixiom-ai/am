import { CommonActions, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import QRCode from 'qrcode';
import { fetchKycOverview, GlobalKycStatus } from '../api/kyc';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { LogisticsPartnerCard } from '../components/LogisticsPartnerCard';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useParcelDraft } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { generateShippingLabelPdf } from '../utils/pdf';
import { selectPartner } from '../utils/logisticsPartners';

// Instructions personnalisées selon le mode de récupération.
// Inspiré de FedEx / UPS qui montrent un guide pas-à-pas après réservation.
const PICKUP_INSTRUCTIONS: Record<string, { title: string; steps: string[]; cta: string }> = {
  HUB_DROP_OFF: {
    title: 'Dépôt au hub Axis',
    steps: [
      'Imprime ou présente cette confirmation à l\'accueil du hub.',
      'Dépose ton colis fermé et étiqueté sous 14 jours.',
      'Réceptionne ton récépissé tamponné — preuve de prise en charge.',
    ],
    cta: 'Voir les hubs',
  },
  RELAY_DROP_OFF: {
    title: 'Dépôt en point relais',
    steps: [
      'Montre le QR code ci-dessus au relais que tu as choisi.',
      'Le commerçant scanne, prend ton colis et te remet un reçu.',
      'Suivi disponible 4h après le dépôt.',
    ],
    cta: 'Trouver mon relais',
  },
  HOME_PICKUP: {
    title: 'Enlèvement à domicile',
    steps: [
      'Notre transporteur partenaire passe sur le créneau réservé.',
      'Tu reçois un SMS 30 min avant le passage du coursier.',
      'Garde ton colis emballé prêt — le coursier apporte l\'étiquette.',
    ],
    cta: 'Modifier l\'adresse',
  },
};

export function BookingConfirmationScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingConfirmation'>>();
  const { kind, reference, id } = route.params;
  // Snapshot du dernier draft (capturé au reset) pour personnaliser les
  // instructions selon le mode de récupération choisi.
  const { lastBooking } = useParcelDraft();
  const pickupMode = lastBooking?.pickupMode ?? 'HUB_DROP_OFF';
  const partner = kind === 'parcel'
    ? selectPartner({
        fromCountry: lastBooking?.from?.country ?? 'FR',
        weightKg: lastBooking?.weightKg ?? 12,
        toCountry: lastBooking?.to?.country ?? 'SN',
      })
    : null;

  // Génération du QR code
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  useEffect(() => {
    const payload = JSON.stringify({ ref: reference, kind });
    QRCode.toString(payload, { type: 'svg', width: 200, margin: 1, color: { dark: '#0B2545', light: '#FFFFFF00' } })
      .then(setQrSvg)
      .catch(() => setQrSvg(null));
  }, [reference, kind]);

  // KYC nudge
  const [kyc, setKyc] = useState<GlobalKycStatus>('NONE');
  useEffect(() => {
    fetchKycOverview()
      .then((o) => setKyc(o.status))
      .catch(() => setKyc('NONE'));
  }, []);

  const copyReference = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(reference).catch(() => {});
    }
    notify('Copié', `Référence ${reference} copiée dans le presse-papier.`);
  };

  const instructions = PICKUP_INSTRUCTIONS[pickupMode];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 24, gap: SPACING.lg }}>
        {/* Hero confirmation */}
        <View style={{ alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.lg }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: theme.good + '22',
              borderWidth: 2,
              borderColor: theme.good,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 44 }}>✓</Text>
          </View>
          <Text
            style={{
              color: theme.ink,
              fontFamily: TYPO.weights.bold,
              fontSize: TYPO.sizes.displayM,
              letterSpacing: -0.5,
              textAlign: 'center',
            }}
          >
            Réservation confirmée
          </Text>
          <Text
            style={{
              color: theme.muted,
              fontFamily: TYPO.weights.medium,
              fontSize: TYPO.sizes.body,
              textAlign: 'center',
              paddingHorizontal: SPACING.lg,
            }}
          >
            {kind === 'mission'
              ? "Ta mission est publiée. Un convoyeur va l'accepter sous peu."
              : 'Ton colis est enregistré. Tu reçois un SMS dès qu\'un transporteur le prend en charge.'}
          </Text>
        </View>

        {/* Référence avec bouton copier */}
        <Surface>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.muted,
                  fontFamily: TYPO.weights.semibold,
                  fontSize: TYPO.sizes.label,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Référence
              </Text>
              <Text
                selectable
                style={{
                  color: theme.ink,
                  fontFamily: TYPO.weights.bold,
                  fontSize: 26,
                  letterSpacing: -0.3,
                  marginTop: 6,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {reference}
              </Text>
            </View>
            <Pressable
              onPress={copyReference}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.line,
                backgroundColor: pressed ? theme.bgSoft : 'transparent',
                flexDirection: 'row',
                gap: 6,
                alignItems: 'center',
              })}
            >
              <Icons.doc size={14} color={theme.navy} stroke={1.8} />
              <Text style={{ color: theme.navy, fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
                Copier
              </Text>
            </Pressable>
          </View>
        </Surface>

        {/* QR code de dépôt — uniquement pour les colis */}
        {kind === 'parcel' && qrSvg ? (
          <Surface>
            <View style={{ alignItems: 'center', gap: SPACING.md }}>
              <Text
                style={{
                  color: theme.muted,
                  fontFamily: TYPO.weights.semibold,
                  fontSize: TYPO.sizes.label,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                QR code de dépôt
              </Text>
              <View
                style={{
                  width: 200,
                  height: 200,
                  backgroundColor: '#fff',
                  borderRadius: RADII.lg,
                  padding: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SvgXml xml={qrSvg} width={176} height={176} />
              </View>
              <Text
                style={{
                  color: theme.muted,
                  fontFamily: TYPO.weights.medium,
                  fontSize: 12.5,
                  textAlign: 'center',
                  lineHeight: 17,
                }}
              >
                Présente ce code au point relais ou au hub Axis.
                {'\n'}Valide 14 jours.
              </Text>
            </View>
          </Surface>
        ) : null}

        {/* Instructions pas-à-pas */}
        {kind === 'parcel' ? (
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
              Prochaines étapes
            </Text>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body, marginBottom: SPACING.md }}>
              {instructions.title}
            </Text>
            <View style={{ gap: 12 }}>
              {instructions.steps.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: theme.navy,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: theme.surface, fontFamily: TYPO.weights.bold, fontSize: 12 }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 13, lineHeight: 18 }}>
                    {s}
                  </Text>
                </View>
              ))}
            </View>
          </Surface>
        ) : null}

        {/* KYC nudge — colis uniquement (formalité douane pièce d'identité) */}
        {kind === 'parcel' && (kyc === 'NONE' || kyc === 'PENDING' || kyc === 'REJECTED') ? (
          <Surface flat style={{ backgroundColor: theme.warn + '12', borderColor: theme.warn + '40' }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icons.shield size={20} color={theme.warn} stroke={1.8} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.warn, fontFamily: TYPO.weights.semibold, fontSize: 13.5 }}>
                  {kyc === 'PENDING'
                    ? 'Vérification d\'identité en cours'
                    : 'Vérifie ton identité pour finaliser l\'envoi'}
                </Text>
                <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                  La douane exige une pièce d'identité pour les colis &gt; 1 000 €. Sans KYC validé, ton colis reste bloqué au hub.
                </Text>
                <Pressable
                  onPress={() => nav.navigate('KycVerification')}
                  style={({ pressed }) => ({
                    marginTop: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: pressed ? theme.warn : theme.warn,
                    borderRadius: 10,
                    alignSelf: 'flex-start',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: '#fff', fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
                    {kyc === 'PENDING' ? 'Voir mon dossier' : 'Vérifier mon identité'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Surface>
        ) : null}

        {/* Partenaire premier kilomètre */}
        {partner ? (
          <View style={{ gap: SPACING.sm }}>
            <Text
              style={{
                color: theme.muted,
                fontFamily: TYPO.weights.semibold,
                fontSize: TYPO.sizes.label,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Transporteur partenaire
            </Text>
            <LogisticsPartnerCard partner={partner} />
          </View>
        ) : null}

        {/* Garanties */}
        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pill tone="ghost">Assurance 250 000 €</Pill>
            <Pill tone="ghost">Suivi temps réel</Pill>
            <Pill tone="ghost">Signature à la livraison</Pill>
          </View>
        </Surface>

        {/* Liens utiles */}
        <View style={{ gap: SPACING.md, marginTop: SPACING.md }}>
          <Button
            kind="primary"
            size="lg"
            fullWidth
            onPress={() => nav.navigate('Tracking', { kind, id, reference })}
            rightIcon={<Icons.arrow size={18} color="#fff" stroke={2} />}
          >
            Voir le suivi en direct
          </Button>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            {kind === 'parcel' ? (
              <Button
                kind="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={async () => {
                  await generateShippingLabelPdf({
                    reference,
                    toCity: lastBooking?.to?.city,
                    toCountry: lastBooking?.to?.country,
                    fromCity: lastBooking?.from?.city,
                    weightKg: lastBooking?.weightKg,
                    transportMode: lastBooking?.transportMode,
                    pickupMode: pickupMode === 'HUB_DROP_OFF' ? 'Dépôt hub' : pickupMode === 'RELAY_DROP_OFF' ? 'Point relais' : 'Enlèvement domicile',
                  });
                  notify('Étiquette générée', 'Colle-la sur ton colis, QR visible.');
                }}
                leftIcon={<Icons.doc size={16} color={theme.ink} stroke={1.8} />}
              >
                Étiquette PDF
              </Button>
            ) : null}
            <Button
              kind="outline"
              size="md"
              style={{ flex: 1 }}
              onPress={() => nav.navigate('Conversations')}
              leftIcon={<Icons.chat size={16} color={theme.ink} stroke={1.8} />}
            >
              Support
            </Button>
          </View>
          <Button
            kind="ghost"
            onPress={() =>
              nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'AppTabs' }] }))
            }
          >
            Retour à l'accueil
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
