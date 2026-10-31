// Menu latéral de la version ordinateur. Sur téléphone, la barre d'onglets
// du bas reste ; sur grand écran, elle disparaît au profit de ce menu sobre à
// gauche, et le contenu occupe le reste de l'écran.
import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { isStaff } from '../utils/roles';
import { Avatar } from './Avatar';
import { Icons } from './Icons';

export const SIDE_NAV_WIDTH = 232;

type IconKey = 'home' | 'pin' | 'plus' | 'doc' | 'user' | 'truck' | 'sliders' | 'chat';

interface Item {
  key: string;
  label: string;
  icon: IconKey;
  /** Écran de la pile racine, ou onglet (avec `tab`). */
  screen: string;
  tab?: string;
  accent?: boolean;
}

interface Props {
  // Référence de navigation : le menu vit hors des navigateurs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigationRef: NavigationContainerRefWithCurrent<any>;
}

function currentKey(ref: Props['navigationRef']): string {
  const route = ref.isReady() ? ref.getCurrentRoute() : undefined;
  return route?.name ?? '';
}

export function SideNav({ navigationRef }: Props) {
  const { theme } = useTheme();
  const { user } = useSession();
  const [active, setActive] = useState(() => currentKey(navigationRef));

  useEffect(() => {
    const unsub = navigationRef.addListener('state', () => setActive(currentKey(navigationRef)));
    return unsub;
  }, [navigationRef]);

  if (!user) return null;
  const driver = user.role === 'DRIVER';
  const staff = isStaff(user.role);

  const items: Item[] = [
    { key: 'Home', label: 'Accueil', icon: 'home', screen: 'AppTabs', tab: 'Home' },
    { key: 'Trips', label: 'Suivi', icon: 'pin', screen: 'AppTabs', tab: 'Trips' },
    ...(driver
      ? [{ key: 'Missions', label: 'Mes missions', icon: 'truck' as IconKey, screen: 'AppTabs', tab: 'Missions' }]
      : [
          { key: 'ServicePicker', label: 'Nouvelle demande', icon: 'plus' as IconKey, screen: 'ServicePicker', accent: true },
          { key: 'Documents', label: 'Documents', icon: 'doc' as IconKey, screen: 'AppTabs', tab: 'Documents' },
        ]),
    { key: 'Conversations', label: 'Messages', icon: 'chat', screen: 'Conversations' },
    ...(staff ? [{ key: 'Admin', label: 'Espace admin', icon: 'sliders' as IconKey, screen: 'Admin' }] : []),
    { key: 'Profile', label: 'Profil', icon: 'user', screen: 'AppTabs', tab: 'Profile' },
  ];

  const go = (it: Item) => {
    if (!navigationRef.isReady()) return;
    if (it.tab) navigationRef.navigate('AppTabs', { screen: it.tab });
    else navigationRef.navigate(it.screen);
  };

  return (
    <View
      style={{
        width: SIDE_NAV_WIDTH,
        backgroundColor: theme.surface,
        borderRightWidth: 1,
        borderRightColor: theme.line,
        paddingVertical: 22,
        paddingHorizontal: 14,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, marginBottom: 18 }}>
        <Image source={require('../../assets/axis-mark.png')} style={{ width: 32, height: 32, resizeMode: 'contain' }} />
        <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold, letterSpacing: 0.3 }}>Axis Import</Text>
      </View>

      {items.map((it) => {
        const on = active === it.key || (it.tab != null && active === it.tab);
        const Icon = Icons[it.icon];
        if (it.accent) {
          return (
            <Pressable
              key={it.key}
              onPress={() => go(it)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: RADII.md,
                backgroundColor: pressed ? theme.goldDeep : theme.gold,
                marginVertical: 6,
              })}
            >
              <Icon size={18} color={theme.onGold} stroke={2.2} />
              <Text style={{ fontSize: 13.5, color: theme.onGold, fontFamily: TYPO.weights.bold }}>{it.label}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={it.key}
            onPress={() => go(it)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: RADII.md,
              backgroundColor: on ? theme.bgSoft : pressed ? theme.surface2 : 'transparent',
            })}
          >
            <Icon size={18} color={on ? theme.link : theme.muted} stroke={on ? 2 : 1.6} />
            <Text style={{ fontSize: 13.5, color: on ? theme.ink : theme.inkSoft, fontFamily: on ? TYPO.weights.semibold : TYPO.weights.medium }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.lineSoft }}>
        <Avatar name={`${user.firstName} ${user.lastName}`} size={30} tone={staff ? 'gold' : 'navy'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>{user.email}</Text>
        </View>
      </View>
    </View>
  );
}
