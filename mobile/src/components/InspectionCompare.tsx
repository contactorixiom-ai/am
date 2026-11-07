import React from 'react';
import { Text, View } from 'react-native';
import { Inspection } from '../api/inspections';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { AuthImage } from './AuthImage';
import { DAMAGE_META } from './VehicleDiagram';

const VIEW_LABEL: Record<string, string> = { top: 'Dessus', left: 'Côté gauche', right: 'Côté droit', front: 'Avant', rear: 'Arrière' };

/**
 * Départ et arrivée côte à côte, photo par photo : en cas de litige, Roger
 * voit en un coup d'œil ce qui a changé pendant le convoyage. Les dommages
 * relevés à l'arrivée sans équivalent proche au départ sont signalés comme
 * nouveaux.
 */
export function InspectionCompare({ departure, arrival }: { departure: Inspection; arrival: Inspection }) {
  const { theme } = useTheme();
  const depDamages = departure.damages ?? [];
  const arrDamages = arrival.damages ?? [];
  const isNew = (d: (typeof arrDamages)[number]) =>
    !depDamages.some((p) => p.view === d.view && Math.hypot(p.x - d.x, p.y - d.y) < 0.08);
  const newDamages = arrDamages.filter(isNew);
  const km = departure.mileage != null && arrival.mileage != null ? arrival.mileage - departure.mileage : null;
  const fuel = departure.fuelLevel != null && arrival.fuelLevel != null ? arrival.fuelLevel - departure.fuelLevel : null;

  // Photos appariées par libellé (« Face avant », « Roue avant droite »…).
  const depPhotos = departure.photos ?? [];
  const arrPhotos = arrival.photos ?? [];
  const labels: string[] = [];
  for (const p of [...depPhotos, ...arrPhotos]) {
    const l = p.caption ?? p.tag ?? 'Photo';
    if (!labels.includes(l)) labels.push(l);
  }
  const pick = (list: typeof depPhotos, l: string) => list.find((p) => (p.caption ?? p.tag ?? 'Photo') === l);

  const Stat = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
    <View style={{ flex: 1, padding: 10, borderRadius: RADII.md, backgroundColor: warn ? theme.warn + '18' : theme.surface2 }}>
      <Text style={{ fontSize: 10.5, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: TYPO.weights.medium }}>{label}</Text>
      <Text style={{ fontSize: 16, color: warn ? theme.warn : theme.ink, fontFamily: TYPO.weights.bold, marginTop: 2 }}>{value}</Text>
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Parcourus" value={km != null ? `${km.toLocaleString('fr-FR')} km` : '—'} warn={km != null && km < 0} />
        <Stat label="Carburant" value={fuel != null ? `${fuel > 0 ? '+' : ''}${fuel} %` : '—'} />
        <Stat label="Nouveaux dommages" value={String(newDamages.length)} warn={newDamages.length > 0} />
      </View>

      {newDamages.length > 0 ? (
        <View style={{ padding: 12, borderRadius: RADII.md, borderWidth: 1, borderColor: theme.warn + '55', backgroundColor: theme.warn + '10', gap: 4 }}>
          <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Relevés à l'arrivée, absents au départ</Text>
          {newDamages.map((d, i) => (
            <Text key={i} style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
              · {DAMAGE_META[d.code]?.label ?? d.code} — {d.zone ?? VIEW_LABEL[d.view] ?? d.view}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 12.5, color: theme.good, fontFamily: TYPO.weights.semibold }}>
          Aucun nouveau dommage relevé à l'arrivée.
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 11, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: TYPO.weights.semibold, textAlign: 'center' }}>Départ</Text>
        <Text style={{ flex: 1, fontSize: 11, color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: TYPO.weights.semibold, textAlign: 'center' }}>Arrivée</Text>
      </View>
      {labels.map((l) => {
        const a = pick(depPhotos, l);
        const b = pick(arrPhotos, l);
        return (
          <View key={l} style={{ gap: 4 }}>
            <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{l}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[a, b].map((p, i) => (
                <View key={i} style={{ flex: 1 }}>
                  {p ? (
                    <AuthImage url={p.url} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: RADII.sm }} label={l} />
                  ) : (
                    <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: RADII.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.line, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>Pas de photo</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
