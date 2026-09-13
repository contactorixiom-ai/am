import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { City, listCities } from '../api/quotes';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

interface Props {
  label: string;
  value: City | null;
  onChange: (city: City) => void;
  region?: 'EU' | 'AFRICA';
}

export function CityPicker({ label, value, onChange, region }: Props) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    listCities(region).then(setCities).catch(() => setCities([]));
  }, [open, region]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) => c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
    );
  }, [cities, query]);

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: theme.muted,
          fontFamily: TYPO.weights.semibold,
          fontSize: TYPO.sizes.label,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: RADII.md,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.md,
        }}
      >
        <Text
          style={{
            color: value ? theme.ink : theme.faint,
            fontFamily: TYPO.weights.medium,
            fontSize: TYPO.sizes.body,
          }}
        >
          {value ? `${value.city} · ${value.country}` : 'Sélectionner une ville'}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS }}>
                {label}
              </Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ color: theme.navy, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
                  Fermer
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher une ville..."
              placeholderTextColor={theme.faint}
              autoFocus
              style={{
                backgroundColor: theme.surface2,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: RADII.md,
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.md,
                color: theme.ink,
                fontFamily: TYPO.weights.medium,
                fontSize: TYPO.sizes.body,
              }}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.country}-${item.city}`}
            contentContainerStyle={{ padding: SPACING.lg, paddingTop: 0 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.line }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                  setQuery('');
                }}
                style={({ pressed }) => ({
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.sm,
                  backgroundColor: pressed ? theme.bgSoft : 'transparent',
                  borderRadius: RADII.md,
                })}
              >
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
                  {item.city}
                </Text>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
                  {item.country} · {item.region === 'EU' ? 'Europe' : 'Afrique'}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text
                style={{
                  color: theme.muted,
                  fontFamily: TYPO.weights.medium,
                  fontSize: TYPO.sizes.body,
                  textAlign: 'center',
                  marginTop: SPACING.xxl,
                }}
              >
                Aucune ville trouvée
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
