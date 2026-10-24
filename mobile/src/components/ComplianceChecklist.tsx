import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { Pill } from './Pill';
import { Surface } from './Surface';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';

interface Props {
  /** Nom du pays de destination (ex « Sénégal »). */
  countryName: string;
  /** Libellé du bordereau requis (BSC / BESC / ECTN…), ou null. */
  trackingLabel?: string | null;
  /** Organisme émetteur du bordereau (COSEC, OGEFREM…). */
  authority?: string | null;
  /** Nombre de documents conformes (générés / fournis / signés). */
  conform: number;
  /** Nombre total de documents requis pour cette destination. */
  total: number;
  /** Source des données : API ou repli démo. */
  demo?: boolean;
  /** Lien « voir la réglementation par pays ». */
  onSeeRegulation?: () => void;
}

// Carte de conformité globale : barre de progression « X/Y documents
// conformes » pour la destination choisie, plus le bordereau de suivi
// requis. Reste lisible même sans bordereau (zone sans BSC).
export function ComplianceChecklist({
  countryName,
  trackingLabel,
  authority,
  conform,
  total,
  demo,
  onSeeRegulation,
}: Props) {
  const { theme } = useTheme();
  const pct = total > 0 ? Math.round((conform / total) * 100) : 0;
  const complete = total > 0 && conform >= total;
  const bg = complete ? '#0F4D2C' : theme.navy;

  return (
    <Surface padded flat style={{ padding: 16, backgroundColor: bg, borderColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: 'rgba(245,241,232,0.12)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {complete
            ? <Icons.check size={22} color={theme.goldHi} stroke={2.4} />
            : <Icons.shield size={22} color={theme.goldHi} stroke={1.8} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            Conformité · {countryName}
          </Text>
          <Text style={{ fontSize: 18, color: '#F5F1E8', fontFamily: TYPO.weights.bold, marginTop: 2, letterSpacing: -0.2 }}>
            {complete ? 'Dossier complet' : `${conform}/${total} documents conformes`}
          </Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(245,241,232,0.15)', marginTop: 14 }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: theme.gold, borderRadius: 2 }} />
      </View>

      {/* Bordereau requis */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Pill tone="gold">
          {trackingLabel ? 'Bordereau requis' : 'Aucun bordereau spécifique'}
        </Pill>
        {demo ? <Pill tone="ghost">Données de démonstration</Pill> : null}
      </View>
      {trackingLabel ? (
        <Text style={{ fontSize: 12.5, color: '#F5F1E8', marginTop: 8, lineHeight: 17, fontFamily: TYPO.weights.medium }}>
          {trackingLabel}
          {authority ? (
            <Text style={{ color: 'rgba(245,241,232,0.62)' }}>{`  ·  émis par ${authority}`}</Text>
          ) : null}
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: 'rgba(245,241,232,0.62)', marginTop: 8, fontFamily: TYPO.weights.medium }}>
          Cette destination n'exige pas de bordereau de suivi de cargaison.
        </Text>
      )}

      {onSeeRegulation ? (
        <Pressable
          onPress={onSeeRegulation}
          style={({ pressed }) => ({
            marginTop: 12, paddingVertical: 8, alignItems: 'center', borderRadius: 10,
            backgroundColor: pressed ? 'rgba(245,241,232,0.10)' : 'transparent',
          })}
        >
          <Text style={{ fontSize: 12.5, color: theme.goldHi, fontFamily: TYPO.weights.semibold }}>
            Voir la réglementation par pays →
          </Text>
        </Pressable>
      ) : null}
    </Surface>
  );
}
