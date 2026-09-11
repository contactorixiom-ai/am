import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ParcelDimensions as Dims, PARCEL_PRESETS } from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

interface Props {
  value: Dims | undefined;
  onChange: (next: Dims) => void;
  /** Pour les presets, on signale le poids estimé attaché. */
  onPickPreset?: (preset: { lengthCm: number; widthCm: number; heightCm: number; weightHint: string }) => void;
}

// Sélecteur de dimensions L × l × H. Inspiré de DHL : 3 inputs côte à côte +
// presets ("Carton S/M/L") pour les non-experts.
export function ParcelDimensions({ value, onChange, onPickPreset }: Props) {
  const { theme } = useTheme();
  const v = value ?? {};

  const renderInput = (key: keyof Dims, label: string) => (
    <View style={{ flex: 1, gap: 4 }} key={key}>
      <Text
        style={{
          fontSize: 10.5,
          color: theme.muted,
          letterSpacing: 0.9,
          textTransform: 'uppercase',
          fontFamily: TYPO.weights.semibold,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: RADII.md,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
        }}
      >
        <TextInput
          value={v[key]?.toString() ?? ''}
          onChangeText={(text) => {
            const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
            onChange({ ...v, [key]: Number.isNaN(num) ? undefined : num });
          }}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={theme.faint}
          style={{
            flex: 1,
            color: theme.ink,
            fontFamily: TYPO.weights.semibold,
            fontSize: 16,
            padding: 0,
            // @ts-expect-error : web-only outline removal
            outlineStyle: 'none',
          }}
        />
        <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.semibold, marginLeft: 4 }}>
          cm
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ gap: SPACING.md }}>
      {/* Presets */}
      <View>
        <Text
          style={{
            fontSize: 10.5,
            color: theme.muted,
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            fontFamily: TYPO.weights.semibold,
            marginBottom: 8,
          }}
        >
          Tailles courantes
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {PARCEL_PRESETS.map((p) => {
            const active =
              v.lengthCm === p.lengthCm && v.widthCm === p.widthCm && v.heightCm === p.heightCm;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  onChange({ lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm });
                  onPickPreset?.(p);
                }}
                style={({ pressed }) => ({
                  flexGrow: 1,
                  flexBasis: '30%',
                  padding: SPACING.md,
                  borderRadius: RADII.md,
                  borderWidth: 1,
                  borderColor: active ? theme.navy : theme.line,
                  backgroundColor: active ? theme.bgSoft : pressed ? theme.bgSoft : theme.surface,
                })}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.ink,
                    fontFamily: TYPO.weights.semibold,
                  }}
                >
                  {p.label}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.muted,
                    marginTop: 2,
                    fontFamily: TYPO.weights.medium,
                  }}
                >
                  {p.weightHint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Inputs L × l × H */}
      <View>
        <Text
          style={{
            fontSize: 10.5,
            color: theme.muted,
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            fontFamily: TYPO.weights.semibold,
            marginBottom: 8,
          }}
        >
          Dimensions précises
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          {renderInput('lengthCm', 'L')}
          {renderInput('widthCm', 'l')}
          {renderInput('heightCm', 'H')}
        </View>
        <Text
          style={{
            fontSize: 11.5,
            color: theme.muted,
            marginTop: 6,
            fontFamily: TYPO.weights.regular,
          }}
        >
          Mesure le carton fermé. On utilise ces dimensions pour calculer le poids volumétrique.
        </Text>
      </View>
    </View>
  );
}
