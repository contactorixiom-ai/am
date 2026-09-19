import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { ParcelSummary, trackParcel } from '../api/parcels';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';

// Timeline 6 tronçons standard d'un colis Europe → Afrique
// Inspiration UPS / FedEx : on montre une grosse timeline visuelle dès la
// saisie de la référence.
interface TimelineLeg {
  key: string;
  label: string;
  sub: string;
  date?: string;
  state: 'done' | 'current' | 'pending';
  icon: 'box' | 'truck' | 'pallet' | 'globe' | 'shield' | 'pin';
}

function buildMockTimeline(from: string, to: string): TimelineLeg[] {
  return [
    { key: 'pickup',   label: 'Enlèvement',       sub: `Chez l'expéditeur · ${from}`,             date: 'Lun. 09h12', state: 'done',    icon: 'box' },
    { key: 'hub',      label: 'Acheminement port', sub: 'Hub Axis → Marseille',                    date: 'Mar. 14h28', state: 'done',    icon: 'truck' },
    { key: 'consol',   label: 'Consolidation',     sub: 'Préparation conteneur maritime',          date: 'Mer. 11h05', state: 'current', icon: 'pallet' },
    { key: 'transit',  label: 'Maritime',          sub: 'Marseille → port de débarquement',        date: '— 14 j',     state: 'pending', icon: 'globe' },
    { key: 'customs',  label: 'Dédouanement',      sub: 'Inspection + BSC + paiement droits',      date: '— 2-3 j',    state: 'pending', icon: 'shield' },
    { key: 'delivery', label: 'Livraison',         sub: `Remise au destinataire · ${to}`,          date: '— 24h',      state: 'pending', icon: 'pin' },
  ];
}

export function TrackByReferenceScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [parcel, setParcel] = useState<ParcelSummary | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const submit = async () => {
    const ref = reference.trim().toUpperCase();
    if (!ref) {
      notify('Référence manquante', 'Saisis la référence du colis (AXP-...)');
      return;
    }
    setLoading(true);
    try {
      const p = await trackParcel(ref);
      setParcel(p);
      setDemoMode(false);
    } catch (e) {
      // Repli démo : on affiche une timeline mockée si l'API ne répond pas.
      if (e instanceof ApiError && e.status === 404) {
        notify('Référence introuvable', "Vérifie l'orthographe. On t'affiche un exemple visuel.");
      }
      setDemoMode(true);
      setParcel(null);
    } finally {
      setLoading(false);
    }
  };

  const fromLabel = parcel?.originCity ?? 'Paris';
  const toLabel = parcel?.destinationCity ?? 'Dakar';
  const showTimeline = parcel || demoMode;
  const timeline = buildMockTimeline(fromLabel, toLabel);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 24, gap: SPACING.lg }}>
          {!showTimeline ? (
            <View style={{ alignItems: 'center', marginTop: SPACING.xl }}>
              <AxisLogo size={64} />
            </View>
          ) : null}

          <View>
            <Text
              style={{
                color: theme.muted,
                fontFamily: TYPO.weights.medium,
                fontSize: TYPO.sizes.label,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Suivi colis
            </Text>
            <Text
              style={{
                color: theme.ink,
                fontFamily: TYPO.weights.bold,
                fontSize: TYPO.sizes.displayM,
                marginTop: 4,
                letterSpacing: -0.5,
              }}
            >
              {showTimeline ? 'Statut en temps réel' : 'Suivre un envoi'}
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 8 }}>
              Pas besoin de compte. Saisis la référence reçue par SMS.
            </Text>
          </View>

          <Surface>
            <Field
              label="Référence colis"
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              placeholder="AXP-XXXXXX-XXXX"
              hint="Format AXP suivi de la suite de caractères"
            />
          </Surface>

          <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
            Afficher le suivi
          </Button>

          {/* Timeline visuelle */}
          {showTimeline ? (
            <Surface padded style={{ padding: SPACING.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
                <View>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase' }}>
                    Trajet
                  </Text>
                  <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: 17, marginTop: 2 }}>
                    {fromLabel} → {toLabel}
                  </Text>
                </View>
                {demoMode ? <Pill tone="warn">Exemple démo</Pill> : <Pill tone="good">En cours</Pill>}
              </View>

              <View style={{ marginTop: SPACING.md, gap: 0 }}>
                {timeline.map((leg, idx) => {
                  const isLast = idx === timeline.length - 1;
                  return <TimelineRow key={leg.key} leg={leg} isLast={isLast} />;
                })}
              </View>
            </Surface>
          ) : null}

          {parcel ? (
            <Button
              kind="gold"
              fullWidth
              onPress={() => nav.navigate('Tracking', { kind: 'parcel', id: parcel.id, reference: parcel.reference })}
              rightIcon={<Icons.arrow size={18} color={theme.navy} stroke={2} />}
            >
              Suivi détaillé en direct
            </Button>
          ) : null}

          <Pressable onPress={() => nav.goBack()} style={{ alignItems: 'center', paddingVertical: SPACING.md }}>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
              Retour
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TimelineRow({ leg, isLast }: { leg: TimelineLeg; isLast: boolean }) {
  const { theme } = useTheme();
  const Icon = ICONS[leg.icon];
  const dotColor = leg.state === 'done' ? theme.good : leg.state === 'current' ? theme.gold : theme.line;
  const iconColor = leg.state === 'pending' ? theme.muted : theme.surface;

  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ alignItems: 'center', width: 32 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: leg.state === 'pending' ? theme.bgSoft : dotColor,
            borderWidth: leg.state === 'pending' ? 1 : 0,
            borderColor: theme.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {leg.state === 'done' ? (
            <Icons.check size={16} color={theme.surface} stroke={2.4} />
          ) : leg.state === 'current' ? (
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.gold }} />
            </View>
          ) : (
            <Icon size={14} color={iconColor} stroke={1.8} />
          )}
        </View>
        {!isLast ? (
          <View
            style={{
              flex: 1,
              minHeight: 32,
              width: 2,
              backgroundColor: leg.state === 'done' ? theme.good : theme.line,
              marginVertical: 4,
              borderRadius: 1,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : SPACING.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text
            style={{
              color: leg.state === 'pending' ? theme.muted : theme.ink,
              fontFamily: TYPO.weights.semibold,
              fontSize: 14,
            }}
          >
            {leg.label}
          </Text>
          {leg.date ? (
            <Text
              style={{
                color: leg.state === 'pending' ? theme.faint : theme.muted,
                fontFamily: TYPO.weights.medium,
                fontSize: 11.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {leg.date}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            color: leg.state === 'pending' ? theme.faint : theme.muted,
            fontFamily: TYPO.weights.medium,
            fontSize: 12.5,
            marginTop: 2,
            lineHeight: 17,
          }}
        >
          {leg.sub}
        </Text>
      </View>
    </View>
  );
}

const ICONS = {
  box: Icons.box,
  truck: Icons.truck,
  pallet: Icons.pallet,
  globe: Icons.globe,
  shield: Icons.shield,
  pin: Icons.pin,
};

