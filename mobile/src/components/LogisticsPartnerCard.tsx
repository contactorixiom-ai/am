import React from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { Pill } from './Pill';
import { Surface } from './Surface';
import { LogisticsPartner, trackingUrlFor } from '../utils/logisticsPartners';
import { notify } from '../utils/notify';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface Props {
  partner: LogisticsPartner;
  /** Pour le devis on cache le n° de tracking pas encore généré. */
  showTracking?: boolean;
}

// Carte d'affichage d'un transporteur partenaire (premier tronçon).
// Le client voit qui vient récupérer son colis + comment le tracker chez
// eux. La facture finale reste celle d'Axis (refacturation interne).
export function LogisticsPartnerCard({ partner, showTracking = true }: Props) {
  const { theme } = useTheme();

  const copyTracking = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(partner.trackingNumber).catch(() => {});
    }
    notify('Copié', `Numéro ${partner.trackingNumber} copié dans le presse-papier.`);
  };

  const openCarrier = () => {
    const url = trackingUrlFor(partner);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <Surface padded style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Pastille couleur transporteur avec initiales */}
        <View
          style={{
            width: 46, height: 46, borderRadius: 12,
            backgroundColor: partner.color,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontFamily: TYPO.weights.bold, fontSize: 14, letterSpacing: -0.2 }}>
            {initials(partner.name)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
              {partner.name}
            </Text>
            <Pill tone="ghost">Tronçon 1 — premier km</Pill>
          </View>
          <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={1}>
            {partner.hub}
          </Text>
        </View>
      </View>

      {/* Pickup window */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: theme.bgSoft }}>
        <Icons.calendar size={16} color={theme.navy} stroke={1.8} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.7, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            Créneau d'enlèvement
          </Text>
          <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 1 }}>
            {partner.pickupEta}
          </Text>
        </View>
      </View>

      {showTracking ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <Pressable
            onPress={copyTracking}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
              borderWidth: 1, borderColor: theme.line,
              backgroundColor: pressed ? theme.bgSoft : theme.surface,
            })}
          >
            <Text style={{ fontSize: 10.5, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
              N° de suivi {partner.name}
            </Text>
            <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold, marginTop: 1, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
              {partner.trackingNumber}  ⧉
            </Text>
          </Pressable>
          <Pressable
            onPress={openCarrier}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 10,
              backgroundColor: pressed ? theme.navyDeep : theme.navy,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Icons.globe size={18} color="#F5F1E8" stroke={1.8} />
          </Pressable>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <Icons.shield size={14} color={theme.gold} stroke={1.8} />
        <Text style={{ flex: 1, fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 16 }}>
          Coût du tronçon refacturé sur ta facture Axis unique (tu ne paies qu'une seule fois).
        </Text>
      </View>
    </Surface>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}
