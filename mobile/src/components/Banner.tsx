import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icons } from './Icons';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

export type BannerTone = 'info' | 'success' | 'warn' | 'error';

interface Props {
  tone?: BannerTone;
  title: string;
  message?: string;
  /** Action contextuelle à droite : « Réessayer », « Mettre à jour »… */
  action?: { label: string; onPress: () => void };
  /** Bouton de fermeture (croix à droite). */
  onClose?: () => void;
}

// Bannière contextuelle : info, succès, alerte, erreur. À placer en haut d'un
// écran ou au-dessus d'une carte. Conçue pour être discrète mais identifiable
// d'un coup d'œil grâce à la couleur de tonalité.
export function Banner({ tone = 'info', title, message, action, onClose }: Props) {
  const { theme } = useTheme();
  const meta = META[tone](theme);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: RADII.lg,
        backgroundColor: meta.bg,
        borderWidth: 1,
        borderColor: meta.border,
      }}
    >
      <View style={{ paddingTop: 1 }}>
        <meta.Icon size={16} color={meta.icon} stroke={1.8} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 12.5, color: meta.text, fontFamily: TYPO.weights.semibold }}>
          {title}
        </Text>
        {message ? (
          <Text style={{ fontSize: 11.5, color: meta.text, opacity: 0.85, fontFamily: TYPO.weights.medium, lineHeight: 16 }}>
            {message}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => ({
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: pressed ? meta.actionPressed : meta.actionBg,
          })}
        >
          <Text style={{ fontSize: 12, color: meta.actionText, fontFamily: TYPO.weights.semibold }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
      {onClose ? (
        <Pressable onPress={onClose} style={{ padding: 4 }}>
          <Icons.x size={14} color={meta.icon} stroke={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Tonalités. On utilise des couleurs du thème + des compositions opacifiées
// pour rester cohérent avec le design system Axis.
const META: Record<BannerTone, (theme: ReturnType<typeof useTheme>['theme']) => {
  Icon: typeof Icons.bell;
  bg: string;
  border: string;
  icon: string;
  text: string;
  actionBg: string;
  actionPressed: string;
  actionText: string;
}> = {
  info: (theme) => ({
    Icon: Icons.bell,
    bg: theme.bgSoft,
    border: theme.line,
    icon: theme.navy,
    text: theme.ink,
    actionBg: theme.navy,
    actionPressed: theme.navyDeep,
    actionText: '#F5F1E8',
  }),
  success: (theme) => ({
    Icon: Icons.check,
    bg: theme.good + '14',
    border: theme.good + '40',
    icon: theme.good,
    text: theme.ink,
    actionBg: theme.good,
    actionPressed: theme.good,
    actionText: '#FFFFFF',
  }),
  warn: (theme) => ({
    Icon: Icons.warn,
    bg: theme.warn + '15',
    border: theme.warn + '40',
    icon: theme.warn,
    text: theme.ink,
    actionBg: theme.warn,
    actionPressed: theme.warn,
    actionText: '#FFFFFF',
  }),
  error: (theme) => ({
    Icon: Icons.warn,
    bg: theme.bad + '14',
    border: theme.bad + '40',
    icon: theme.bad,
    text: theme.ink,
    actionBg: theme.bad,
    actionPressed: theme.bad,
    actionText: '#FFFFFF',
  }),
};
