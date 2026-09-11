import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO, SAFE_AREA_TOP } from '../theme/tokens';
import { Icons } from './Icons';

// ─────────────────────────────────────────────────────────────────────────────
// ParcelWizard
// Composant réutilisable qui chapeaute les étapes du parcours d'envoi de colis.
// Inspiration : Chronopost, DHL, FedEx, Mondial Relay → un stepper en haut très
// visible + bouton "Retour" + bouton "Reprendre plus tard" optionnel.
//
// On ne gère PAS la navigation entre étapes ici : chaque écran décide quand
// passer au suivant via `onContinue`. L'idée est de garder une UI cohérente.
// ─────────────────────────────────────────────────────────────────────────────

export const PARCEL_STEPS: { label: string; short: string }[] = [
  { label: 'Trajet',       short: 'Trajet'      }, // 0
  { label: 'Quel colis',   short: 'Colis'       }, // 1
  { label: 'Contenu',      short: 'Contenu'     }, // 2
  { label: 'Récupération', short: 'Pickup'      }, // 3
  { label: 'Destinataire', short: 'Destinataire'}, // 4
  { label: 'Paiement',     short: 'Paiement'    }, // 5
];

interface ParcelWizardProps {
  /** Index 0-based de l'étape active. */
  step: number;
  onBack?: () => void;
  /** Si fourni, affiche le bouton "Reprendre plus tard" en haut à droite. */
  onSaveLater?: () => void;
  /** Pour les étapes annexes (relais / domicile) qui restent en step 3. */
  subtitle?: string;
}

export function ParcelWizard({ step, onBack, onSaveLater, subtitle }: ParcelWizardProps) {
  const { theme } = useTheme();
  const total = PARCEL_STEPS.length;
  const safeStep = Math.max(0, Math.min(step, total - 1));
  const current = PARCEL_STEPS[safeStep];

  return (
    <View
      style={{
        paddingTop: SAFE_AREA_TOP - 8,
        paddingBottom: 12,
        paddingHorizontal: 14,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.lineSoft,
        gap: 10,
      }}
    >
      {/* Ligne titre : retour + titre + reprendre plus tard */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityLabel="Retour"
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: pressed ? theme.line : theme.bgSoft,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Icons.arrowL size={18} color={theme.ink} stroke={1.6} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 10.5,
              color: theme.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              fontFamily: TYPO.weights.semibold,
            }}
          >
            Étape {safeStep + 1} / {total}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 16,
              color: theme.ink,
              fontFamily: TYPO.weights.semibold,
              letterSpacing: -0.2,
              marginTop: 1,
            }}
          >
            {current.label}
            {subtitle ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}>{` · ${subtitle}`}</Text> : null}
          </Text>
        </View>
        {onSaveLater ? (
          <Pressable
            onPress={onSaveLater}
            accessibilityLabel="Reprendre plus tard"
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: pressed ? theme.bgSoft : 'transparent',
            })}
          >
            <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.semibold }}>
              Reprendre plus tard
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Barre de progression — segments colorés */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {PARCEL_STEPS.map((s, i) => {
          const done = i < safeStep;
          const active = i === safeStep;
          const color = done ? theme.good : active ? theme.gold : theme.bgSoft;
          return (
            <View
              key={s.short}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
          );
        })}
      </View>

      {/* Mini-labels sous la barre — uniquement les étapes principales */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {PARCEL_STEPS.map((s, i) => (
          <Text
            key={`${s.short}-${i}`}
            style={{
              fontSize: 9.5,
              color: i === safeStep ? theme.ink : theme.faint,
              fontFamily: i === safeStep ? TYPO.weights.semibold : TYPO.weights.medium,
              letterSpacing: 0.2,
              flexShrink: 1,
              textAlign: 'center',
              flex: 1,
            }}
            numberOfLines={1}
          >
            {s.short}
          </Text>
        ))}
      </View>
    </View>
  );
}
