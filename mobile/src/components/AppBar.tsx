import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SAFE_AREA_TOP, TYPO } from '../theme/tokens';
import { Icons } from './Icons';

interface AppBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
}

export function AppBar({ title, subtitle, onBack, trailing, leading }: AppBarProps) {
  const { theme } = useTheme();
  const nav = useNavigation();

  const handleBack = onBack ?? (nav.canGoBack() ? () => nav.goBack() : undefined);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: SAFE_AREA_TOP - 8,
        paddingBottom: 12,
        paddingHorizontal: 14,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.lineSoft,
      }}
    >
      {leading ?? (handleBack ? (
        <Pressable
          onPress={handleBack}
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
      ))}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 16,
            fontFamily: TYPO.weights.semibold,
            color: theme.ink,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: theme.muted,
              marginTop: 1,
              fontFamily: TYPO.weights.medium,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ?? <View style={{ width: 36 }} />}
    </View>
  );
}
