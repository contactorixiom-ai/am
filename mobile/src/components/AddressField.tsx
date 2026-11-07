// Champ d'adresse avec suggestions pendant la saisie, comme sur Google Maps :
// adresses officielles en France (Base Adresse Nationale), OpenStreetMap en
// Europe et en Afrique. Une adresse introuvable peut toujours être écrite à
// la main (quartier, villa…, fréquent en Afrique).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInputProps, View, ViewStyle } from 'react-native';
import { AddressSuggestion, searchAddresses } from '../api/quotes';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { Field } from './Field';
import { Icons } from './Icons';

interface Props extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Adresse choisie dans la liste (code postal, ville, pays, position). */
  onSelect?: (s: AddressSuggestion) => void;
  /** Pays (ISO) où chercher : FR, SN, CI… */
  country?: string;
  /** Ville déjà choisie : affine la recherche. */
  city?: string;
  /** « line » : seulement numéro et rue (la ville a son propre champ). */
  fill?: 'label' | 'line';
  containerStyle?: ViewStyle;
}

export function AddressField({ label, hint, value, onChangeText, onSelect, country, city, fill = 'label', containerStyle, editable, ...input }: Props) {
  const { theme } = useTheme();
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  // Pas de nouvelle recherche juste après avoir choisi une suggestion.
  const picked = useRef<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (!focused || editable === false || q.length < 4 || picked.current === value) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    const id = ++req.current;
    setLoading(true);
    const t = setTimeout(() => {
      searchAddresses(q, { country, city })
        .then((r) => { if (id === req.current) setItems(r); })
        .catch(() => { if (id === req.current) setItems([]); })
        .finally(() => { if (id === req.current) setLoading(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [value, focused, country, city, editable]);

  const choose = (s: AddressSuggestion) => {
    const text = fill === 'line' ? s.line : s.label;
    picked.current = text;
    onChangeText(text);
    onSelect?.(s);
    setItems([]);
  };

  const showList = focused && (items.length > 0 || loading);

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      <Field
        {...input}
        label={label}
        hint={showList ? undefined : hint}
        value={value}
        editable={editable}
        onChangeText={(t) => { picked.current = null; onChangeText(t); }}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        // Laisse le temps au toucher sur une suggestion d'être pris en compte.
        onBlur={(e) => { setTimeout(() => setFocused(false), 200); input.onBlur?.(e); }}
        autoComplete={input.autoComplete ?? 'street-address'}
        autoCorrect={false}
      />
      {showList ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.line,
            borderRadius: RADII.md,
            backgroundColor: theme.surface,
            overflow: 'hidden',
          }}
        >
          {loading && items.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
              <ActivityIndicator size="small" color={theme.muted} />
              <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Recherche de l'adresse…</Text>
            </View>
          ) : null}
          {items.map((s, i) => (
            <Pressable
              key={`${s.label}-${i}`}
              onPress={() => choose(s)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 11,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.lineSoft,
                backgroundColor: pressed ? theme.bgSoft : 'transparent',
              })}
            >
              <Icons.pin size={16} color={theme.gold} stroke={1.9} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{s.line}</Text>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
                  {[s.postalCode, s.city, s.country !== 'FR' ? s.country : ''].filter(Boolean).join(' ') || s.label}
                </Text>
              </View>
            </Pressable>
          ))}
          {items.length > 0 ? (
            <Text style={{ fontSize: 11, color: theme.faint, fontFamily: TYPO.weights.medium, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 2 }}>
              Pas dans la liste ? Continue à écrire, ton adresse sera acceptée telle quelle.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
