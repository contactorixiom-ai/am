// Calendrier mensuel pour choisir une date (enlèvement d'un colis, passage
// du convoyeur). Le client voit le mois entier et peut avancer de mois en
// mois, au lieu de trois créneaux imposés.
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { Icons } from './Icons';

interface Props {
  value: Date | null;
  onChange: (d: Date) => void;
  /** Premier jour sélectionnable (défaut : demain). */
  minDate?: Date;
  /** Nombre de jours ouverts à la réservation (défaut : 90). */
  maxDays?: number;
  /** Jours fermés (0 = dimanche). Défaut : dimanche. */
  closedWeekdays?: number[];
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function CalendarPicker({ value, onChange, minDate, maxDays = 90, closedWeekdays = [0] }: Props) {
  const { theme } = useTheme();
  const today = startOfDay(new Date());
  const min = startOfDay(minDate ?? new Date(today.getTime() + 86400_000));
  const max = new Date(min.getTime() + maxDays * 86400_000);
  const [month, setMonth] = useState(() => {
    const base = value ?? min;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    // Lundi en premier : décalage de 0 (lundi) à 6 (dimanche).
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < offset; i += 1) out.push(null);
    for (let d = 1; d <= days; d += 1) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  const canPrev = new Date(month.getFullYear(), month.getMonth(), 0) >= new Date(min.getFullYear(), min.getMonth(), 1);
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= max;
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const title = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => canPrev && shift(-1)}
          disabled={!canPrev}
          accessibilityLabel="Mois précédent"
          style={{ width: 36, height: 36, borderRadius: RADII.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgSoft, opacity: canPrev ? 1 : 0.35 }}
        >
          <Icons.arrowL size={16} color={theme.ink} stroke={2} />
        </Pressable>
        <Text style={{ fontSize: 14.5, color: theme.ink, fontFamily: TYPO.weights.bold, textTransform: 'capitalize' }}>{title}</Text>
        <Pressable
          onPress={() => canNext && shift(1)}
          disabled={!canNext}
          accessibilityLabel="Mois suivant"
          style={{ width: 36, height: 36, borderRadius: RADII.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgSoft, opacity: canNext ? 1 : 0.35 }}
        >
          <Icons.arrow size={16} color={theme.ink} stroke={2} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {DAY_LABELS.map((l, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.semibold }}>
            {l}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const closed = closedWeekdays.includes(d.getDay());
          const disabled = closed || d < min || d > max;
          const selected = !!value && startOfDay(value).getTime() === d.getTime();
          const isToday = d.getTime() === today.getTime();
          return (
            <View key={d.toISOString()} style={{ width: `${100 / 7}%`, height: 42, padding: 2 }}>
              <Pressable
                onPress={() => !disabled && onChange(d)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: RADII.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? theme.accent : pressed ? theme.bgSoft : 'transparent',
                  borderWidth: isToday && !selected ? 1 : 0,
                  borderColor: theme.gold,
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: selected ? TYPO.weights.bold : TYPO.weights.medium,
                    color: selected ? '#FFFFFF' : disabled ? theme.faint : theme.ink,
                    textDecorationLine: closed && !disabled ? 'none' : undefined,
                  }}
                >
                  {d.getDate()}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>
        {value
          ? `Choisi : ${value.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`
          : 'Touche un jour pour le choisir.'}
        {closedWeekdays.includes(0) ? ' Pas de passage le dimanche.' : ''}
      </Text>
    </View>
  );
}
