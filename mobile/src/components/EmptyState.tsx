import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

interface Props {
  /** Icône à afficher en grand au-dessus du titre. */
  iconKey?: keyof typeof Icons;
  title: string;
  subtitle?: string;
  /** Bouton d'action principal (optionnel). */
  cta?: { label: string; onPress: () => void };
  /** Variante visuelle : standard (centré) ou compact (plus petit). */
  variant?: 'standard' | 'compact';
}

// Composant réutilisable pour les états vides : pas de mission, pas de doc,
// pas d'historique, etc. Donne un repère visuel propre et propose une action.
export function EmptyState({ iconKey = 'box', title, subtitle, cta, variant = 'standard' }: Props) {
  const { theme } = useTheme();
  const IconComp = Icons[iconKey];
  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 26 : 36;
  const padV = isCompact ? 24 : 36;

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: padV,
        paddingHorizontal: 24,
        gap: isCompact ? 10 : 14,
      }}
    >
      <View
        style={{
          width: isCompact ? 56 : 72,
          height: isCompact ? 56 : 72,
          borderRadius: isCompact ? 16 : 20,
          backgroundColor: theme.bgSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconComp size={iconSize} color={theme.muted} stroke={1.5} />
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text
          style={{
            fontSize: isCompact ? 15 : 17,
            color: theme.ink,
            fontFamily: TYPO.weights.semibold,
            textAlign: 'center',
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: 13,
              color: theme.muted,
              fontFamily: TYPO.weights.medium,
              textAlign: 'center',
              maxWidth: 280,
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {cta ? (
        <Pressable
          onPress={cta.onPress}
          style={({ pressed }) => ({
            marginTop: 6,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: RADII.md,
            backgroundColor: pressed ? theme.navyDeep : theme.navy,
          })}
        >
          <Text style={{ color: '#F5F1E8', fontSize: 13, fontFamily: TYPO.weights.semibold }}>
            {cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
