import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SHADOWS, SPACING, TYPO } from '../theme/tokens';

interface Props {
  emoji: string;
  title: string;
  subtitle: string;
  badge?: string;
  disabled?: boolean;
  onPress: () => void;
}

export function ServiceCard({ emoji, title, subtitle, badge, disabled, onPress }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flex: 1,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: RADII.lg,
          padding: SPACING.lg,
          minHeight: 150,
          justifyContent: 'space-between',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        SHADOWS.card,
      ]}
    >
      <View>
        <Text style={{ fontSize: 36 }}>{emoji}</Text>
      </View>
      <View>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.title }}>
          {title}
        </Text>
        <Text
          style={{
            color: theme.muted,
            fontFamily: TYPO.weights.medium,
            fontSize: TYPO.sizes.bodySm,
            marginTop: 4,
          }}
        >
          {subtitle}
        </Text>
        {badge ? (
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: RADII.pill,
              backgroundColor: theme.bgSoft,
            }}
          >
            <Text
              style={{
                color: theme.muted,
                fontFamily: TYPO.weights.semibold,
                fontSize: TYPO.sizes.caption,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
