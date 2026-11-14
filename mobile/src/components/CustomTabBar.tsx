import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useLayout } from '../theme/layout';
import { SAFE_AREA_BOTTOM, TYPO } from '../theme/tokens';
import { Icons } from './Icons';
import { CountBadge } from './CountBadge';
import { useBadges } from '../state/badges';
import { useSession } from '../state/SessionContext';

type IconKey = 'home' | 'pin' | 'plus' | 'doc' | 'user' | 'truck' | 'chat';

// Onglets visibles, dans l'ordre de déclaration du navigateur. « Trips »
// (suivi) n'a pas d'onglet : il est joignable depuis l'accueil.
const TAB_CONFIG: Record<string, { label: string; icon: IconKey }> = {
  Home:      { label: 'Accueil',   icon: 'home' },
  Commander: { label: 'Commander', icon: 'plus' },
  Documents: { label: 'Documents', icon: 'doc' },
  // Onglet propre au convoyeur : ses missions et son suivi GPS.
  Missions:  { label: 'Missions',  icon: 'truck' },
  Messages:  { label: 'Messages',  icon: 'chat' },
  Profile:   { label: 'Compte',    icon: 'user' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { wide } = useLayout();
  const badges = useBadges(!wide);
  const { user } = useSession();
  // Client : l'accueil est la liste de ses envois.
  const homeLabel = user?.role === 'CLIENT' ? 'Mes envois' : 'Accueil';
  // Grand écran : le menu latéral remplace la barre du bas.
  if (wide) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        paddingTop: 8,
        paddingBottom: SAFE_AREA_BOTTOM,
        paddingHorizontal: 12,
        backgroundColor: theme.surface,
        borderTopWidth: 1,
        borderTopColor: theme.line,
      }}
    >
      {state.routes.map((route, index) => {
        const cfg = TAB_CONFIG[route.name];
        if (!cfg) return null;
        const isFocused = state.index === index;

        const color = isFocused ? theme.gold : theme.muted;
        const IconComp = Icons[cfg.icon];

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={{ flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 2, paddingVertical: 6 }}
          >
            <View>
              <IconComp size={24} color={color} stroke={isFocused ? 1.9 : 1.5} />
              {/* Messages : non lus ; Accueil : notifications. */}
              <CountBadge
                count={route.name === 'Messages' ? badges.messages : route.name === 'Home' ? badges.notifications : 0}
                size={17}
                border={theme.surface}
                style={{ position: 'absolute', top: -7, right: -12 }}
              />
            </View>
            <Text
              style={{
                fontSize: 11.5,
                color,
                fontFamily: isFocused ? TYPO.weights.semibold : TYPO.weights.medium,
                letterSpacing: 0.2,
              }}
            >
              {route.name === 'Home' ? homeLabel : cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
