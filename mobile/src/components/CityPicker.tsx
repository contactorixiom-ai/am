import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { City, listCities, searchCities } from '../api/quotes';
import { useTheme } from '../theme/ThemeProvider';
import { useLayout } from '../theme/layout';
import { RADII, SPACING, TYPO } from '../theme/tokens';
import { countryFlag, countryName } from '../utils/countries';

interface Props {
  label: string;
  value: City | null;
  onChange: (city: City) => void;
  region?: 'EU' | 'AFRICA';
}

export function CityPicker({ label, value, onChange, region }: Props) {
  const { theme } = useTheme();
  const { wide } = useLayout();
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    listCities(region)
      .then((r) => setCities(Array.isArray(r) ? r : []))
      .catch(() => setCities([]));
  }, [open, region]);

  // Au-delà des grandes villes du catalogue, on interroge le serveur, qui
  // cherche dans toutes les communes : sans cela, un client de Dijon ou de
  // Thiès ne pouvait pas commander.
  const [remote, setRemote] = useState<City[] | null>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setRemote(null); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchCities(q, region)
        .then((r) => { if (!cancelled) setRemote(r); })
        .catch(() => { if (!cancelled) setRemote(null); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, region]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    if (remote) return remote;
    return cities.filter(
      (c) => c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
    );
  }, [cities, query, remote]);

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
          {value ? `${countryFlag(value.country)} ${value.city}${value.postalCode ? ` (${value.postalCode.slice(0, 2)})` : ''} · ${countryName(value.country)}`.trim() : 'Sélectionner une ville'}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType={wide ? 'fade' : 'slide'}
        transparent={wide}
        presentationStyle={wide ? 'overFullScreen' : 'pageSheet'}
        onRequestClose={() => setOpen(false)}
      >
        {/* Ordinateur : fenêtre centrée et villes en grille de bulles ;
            téléphone : feuille plein écran et liste. */}
        <Pressable
          onPress={wide ? () => setOpen(false) : undefined}
          style={wide ? { flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 } : { flex: 1 }}
        >
          <Pressable
            onPress={() => undefined}
            style={
              wide
                ? { width: '100%', maxWidth: 900, height: '85%', backgroundColor: theme.bg, borderRadius: 24, overflow: 'hidden' }
                : { flex: 1 }
            }
          >
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
            <View style={{ padding: SPACING.lg, gap: SPACING.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS }}>
                  {label}
                </Text>
                <Pressable onPress={() => setOpen(false)}>
                  <Text style={{ color: theme.link, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
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
              key={wide ? 'grid' : 'list'}
              numColumns={wide ? 3 : 1}
              columnWrapperStyle={wide ? { gap: 10 } : undefined}
              data={filtered}
              keyExtractor={(item) => `${item.country}-${item.city}-${item.postalCode ?? ''}-${item.latitude}`}
              contentContainerStyle={{ padding: SPACING.lg, paddingTop: 0, gap: wide ? 10 : 0 }}
              ItemSeparatorComponent={wide ? undefined : () => <View style={{ height: 1, backgroundColor: theme.line }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={({ pressed }) =>
                    wide
                      ? {
                          flex: 1,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          backgroundColor: pressed ? theme.bgSoft : theme.surface,
                          borderRadius: RADII.xl,
                          borderWidth: 1,
                          borderColor: pressed ? theme.gold : theme.line,
                        }
                      : {
                          paddingVertical: SPACING.md,
                          paddingHorizontal: SPACING.sm,
                          backgroundColor: pressed ? theme.bgSoft : 'transparent',
                          borderRadius: RADII.md,
                        }
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>{countryFlag(item.country)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
                        {item.city}
                      </Text>
                      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
                        {item.postalCode ? `${item.postalCode} · ` : ''}{countryName(item.country)}
                      </Text>
                    </View>
                  </View>
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
                  {searching ? 'Recherche…' : 'Aucune ville trouvée. Vérifie l\'orthographe.'}
                </Text>
              }
            />
          </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
