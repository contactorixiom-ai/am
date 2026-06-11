import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { SAFE_AREA_BOTTOM, TYPO } from '../theme/tokens';
import { Icons } from './Icons';

type IconKey = 'home' | 'pin' | 'plus' | 'doc' | 'chat';

const TAB_CONFIG: Record<string, { label: string; icon: IconKey; isCenter?: boolean }> = {
  Home:      { label: 'Accueil',   icon: 'home' },
  Trips:     { label: 'Suivi',     icon: 'pin' },
  NewCenter: { label: 'Demander',  icon: 'plus', isCenter: true },
  Documents: { label: 'Documents', icon: 'doc' },
  Profile:   { label: 'Profil',    icon: 'chat' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
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

        // Center button → goes to ServicePicker (stack-level navigation)
        if (cfg.isCenter) {
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.getParent()?.navigate('ServicePicker' as never)}
              style={{ alignItems: 'center', justifyContent: 'flex-end', width: 64 }}
            >
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: theme.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -16,
                  shadowColor: theme.gold,
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <Icons.plus size={26} color={theme.navy} stroke={2.4} />
              </View>
              <Text
                style={{
                  fontSize: 10.5,
                  color: theme.gold,
                  marginTop: 4,
                  fontFamily: TYPO.weights.semibold,
                  letterSpacing: 0.2,
                }}
              >
                {cfg.label}
              </Text>
            </Pressable>
          );
        }

        const color = isFocused ? theme.select : theme.muted;
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
            style={{ alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <IconComp size={22} color={color} stroke={isFocused ? 1.9 : 1.5} />
            <Text
              style={{
                fontSize: 10.5,
                color,
                fontFamily: isFocused ? TYPO.weights.semibold : TYPO.weights.medium,
                letterSpacing: 0.2,
              }}
            >
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
