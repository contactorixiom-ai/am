// Choix des articles d'un envoi maritime, sur la grille tarifaire d'Axis :
// fûts, cartons, valises, électroménager (effets personnels) ou m³ et
// palettes (marchandise). Chaque article affiche son prix de grille ; le
// total est calculé par le serveur (barre de tarif en bas de l'écran).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { TariffFlow, TariffItem } from '../api/quotes';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';
import { eurShort, orderableItems, tariffEmoji, tariffUnitWord, useTariffs } from '../utils/tariffs';
import { Button } from './Button';
import { Icons } from './Icons';
import { Surface } from './Surface';

interface Props {
  service: TariffFlow;
  /** Import : n'affiche que les articles de ce mode (aérien ou maritime). */
  mode?: 'SEA' | 'AIR';
  counts: Record<string, number>;
  onChange: (counts: Record<string, number>) => void;
  onOpenTariffs: () => void;
}

const MAX_PIECES = 50;

function priceLine(item: TariffItem): string {
  const unit = tariffUnitWord(item);
  if (item.maxCents && item.maxCents > item.minCents) {
    return `dès\u00a0${eurShort(item.minCents)} ${unit} · jusqu'à\u00a0${eurShort(item.maxCents)}`;
  }
  return `${eurShort(item.minCents)} ${unit}`;
}

export function TariffItemsPicker({ service, mode, counts, onChange, onOpenTariffs }: Props) {
  const { theme } = useTheme();
  const { sheet, failed, reload } = useTariffs();

  const setCount = (code: string, q: number) => {
    const next = { ...counts };
    if (q > 0) next[code] = q;
    else delete next[code];
    onChange(next);
  };

  if (!sheet) {
    return (
      <Surface>
        {failed ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: 14 }}>
              Grille tarifaire indisponible
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12.5 }}>
              Vérifie ta connexion puis réessaie.
            </Text>
            <Button kind="outline" size="sm" onPress={reload} style={{ alignSelf: 'flex-start' }}>
              Réessayer
            </Button>
          </View>
        ) : (
          <ActivityIndicator color={theme.navy} />
        )}
      </Surface>
    );
  }

  const items = orderableItems(sheet, service, mode);
  return (
    <Surface>
      <Text
        style={{
          color: theme.muted,
          fontFamily: TYPO.weights.semibold,
          fontSize: TYPO.sizes.label,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: SPACING.sm,
        }}
      >
        {service === 'VEHICLE' ? 'Type de véhicule' : service === 'IMPORT' ? 'Ce que tu fais venir' : service === 'PARCEL' ? 'Ce que tu envoies' : 'Volume à expédier'}
      </Text>
      <View>
        {items.map((item, i) => (
          <View
            key={item.code}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 11,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.line,
            }}
          >
            <Text style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{tariffEmoji(item.code)}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: 14 }}>
                {item.label}
                {item.detail ? <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium }}> · {item.detail}</Text> : null}
              </Text>
              <Text style={{ color: theme.goldDeep, fontFamily: TYPO.weights.semibold, fontSize: 12.5, marginTop: 2 }}>
                {priceLine(item)}
              </Text>
              {item.included ? (
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, marginTop: 1 }}>
                  {item.included}
                </Text>
              ) : null}
              {service === 'IMPORT' && item.note ? (
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, marginTop: 1, lineHeight: 15 }}>
                  {item.note}
                </Text>
              ) : null}
            </View>
            {item.unit === 'm3' || item.unit === 'kg' ? (
              <VolumeInput value={counts[item.code]} onChange={(v) => setCount(item.code, v)} unit={item.unit} />
            ) : (
              <Stepper
                value={counts[item.code] ?? 0}
                onChange={(v) => setCount(item.code, v)}
                label={item.label}
                max={service === 'VEHICLE' ? 5 : item.unit === 'forfait' ? 10 : MAX_PIECES}
              />
            )}
          </View>
        ))}
      </View>

      <View
        style={{
          marginTop: 8,
          padding: 11,
          borderRadius: RADII.md,
          borderWidth: 1,
          borderColor: theme.gold + '66',
          backgroundColor: theme.gold + '14',
          gap: 3,
        }}
      >
        {service === 'VEHICLE' ? (
          <Text style={{ color: theme.goldDeep, fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
            Option à l'étape suivante : Axis convoie le véhicule jusqu'au port
          </Text>
        ) : service === 'PARCEL' ? (
          <Text style={{ color: theme.goldDeep, fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
            + {eurShort(sheet.customsFeeCents)} TTC de frais de douane par envoi
          </Text>
        ) : (
          <Text style={{ color: theme.goldDeep, fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
            Minimum de perception : {eurShort(sheet.minimumChargeCents)}
          </Text>
        )}
        <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 12, lineHeight: 16 }}>
          {service === 'VEHICLE'
            ? 'Prix « dès » : le prix de départ est réglé à la commande, Axis le confirme à la remise du véhicule selon le gabarit et la destination.'
            : 'Prix « dès » : le prix de départ est réglé à la commande, Axis le confirme au dépôt selon la taille et la destination.'}
        </Text>
      </View>

      <Pressable onPress={onOpenTariffs} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <Text style={{ color: theme.navy, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>Voir toute la grille tarifaire</Text>
        <Icons.chev size={14} color={theme.navy} stroke={2} />
      </Pressable>
    </Surface>
  );
}

function Stepper({ value, onChange, label, max = MAX_PIECES }: { value: number; onChange: (v: number) => void; label: string; max?: number }) {
  const { theme } = useTheme();
  const btn = (enabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: enabled ? theme.navy : theme.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.surface,
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        accessibilityLabel={`Retirer un ${label.toLowerCase()}`}
        style={btn(value > 0)}
      >
        <View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: value > 0 ? theme.navy : theme.faint }} />
      </Pressable>
      <Text style={{ minWidth: 22, textAlign: 'center', color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: 16, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityLabel={`Ajouter un ${label.toLowerCase()}`}
        style={[btn(true), { backgroundColor: theme.navy, borderColor: theme.navy }]}
      >
        <Icons.plus size={15} color="#fff" stroke={2.2} />
      </Pressable>
    </View>
  );
}

function VolumeInput({ value, onChange, unit = 'm3' }: { value?: number; onChange: (v: number) => void; unit?: 'm3' | 'kg' }) {
  const maxValue = unit === 'kg' ? 1000 : 100;
  const { theme } = useTheme();
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TextInput
        value={text}
        onChangeText={(t) => {
          const clean = t.replace(/[^0-9.,]/g, '');
          setText(clean);
          const n = parseFloat(clean.replace(',', '.'));
          onChange(Number.isFinite(n) && n > 0 ? Math.min(maxValue, Math.round(n * 100) / 100) : 0);
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.faint}
        accessibilityLabel={unit === 'kg' ? 'Poids en kilos' : 'Volume en mètres cubes'}
        style={{
          width: 64,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: RADII.md,
          borderWidth: 1,
          borderColor: theme.line,
          backgroundColor: theme.surface2,
          color: theme.ink,
          fontFamily: TYPO.weights.semibold,
          fontSize: 15,
          textAlign: 'right',
        }}
      />
      <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>{unit === 'kg' ? 'kg' : 'm³'}</Text>
    </View>
  );
}
