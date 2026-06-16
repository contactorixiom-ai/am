import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

export type ViewKey = 'top' | 'front' | 'rear' | 'left' | 'right';
export type DamageCode = 'R' | 'F' | 'E' | 'C' | 'M';

export interface Damage {
  id: string;
  view: ViewKey;
  x: number; // 0..1
  y: number; // 0..1
  code: DamageCode;
  note?: string;
  photo?: boolean;
}

export const DAMAGE_META: Record<DamageCode, { label: string; color: string }> = {
  R: { label: 'Rayure', color: '#C9A55C' },
  F: { label: 'Fissure', color: '#E0A04D' },
  E: { label: 'Enfoncement', color: '#D97A4E' },
  C: { label: 'Cassé', color: '#C0524B' },
  M: { label: 'Manquant', color: '#8E5BAE' },
};

interface Props {
  view: ViewKey;
  damages: Damage[];
  onAdd: (x: number, y: number) => void;
  onMarkerPress?: (id: string) => void;
  height?: number;
}

// Diagramme véhicule minimaliste, multi-vues, tappable pour placer un repère
// de dommage. Trait épuré navy, cohérent avec le design de l'app.
export function VehicleDiagram({ view, damages, onAdd, onMarkerPress, height = 240 }: Props) {
  const { theme } = useTheme();
  const [box, setBox] = useState({ w: 0, h: height });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setBox({ w: width, h });
  };

  const handlePress = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!box.w || !box.h) return;
    const x = Math.min(1, Math.max(0, e.nativeEvent.locationX / box.w));
    const y = Math.min(1, Math.max(0, e.nativeEvent.locationY / box.h));
    onAdd(x, y);
  };

  const stroke = theme.navy;
  const soft = theme.line;

  return (
    <Pressable onPress={handlePress} onLayout={onLayout} style={{ height, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line, overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox="0 0 200 240" preserveAspectRatio="xMidYMid meet">
        {view === 'top' && <CarTop stroke={stroke} soft={soft} />}
        {view === 'front' && <CarFront stroke={stroke} soft={soft} />}
        {view === 'rear' && <CarRear stroke={stroke} soft={soft} />}
        {view === 'left' && <CarSide stroke={stroke} soft={soft} flip={false} />}
        {view === 'right' && <CarSide stroke={stroke} soft={soft} flip />}
      </Svg>

      {/* Marqueurs overlay */}
      {damages.map((d, i) => (
        <Pressable
          key={d.id}
          onPress={() => onMarkerPress?.(d.id)}
          style={{
            position: 'absolute',
            left: d.x * box.w - 11,
            top: d.y * box.h - 11,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: DAMAGE_META[d.code].color,
            borderWidth: 2,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{d.code}</Text>
          {d.photo ? (
            <View style={{ position: 'absolute', right: -3, top: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: theme.navy, borderWidth: 1, borderColor: '#fff' }} />
          ) : null}
        </Pressable>
      ))}

      {/* Hint */}
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.bgSoft }}>
          <Text style={{ fontSize: 10.5, color: theme.muted, fontWeight: '600' }}>Touche le schéma pour marquer un dommage</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Vues véhicule (vector minimaliste) ─────────────────────────────────────

function CarTop({ stroke, soft }: { stroke: string; soft: string }) {
  return (
    <G fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
      {/* Carrosserie vue de dessus */}
      <Path d="M70 20 Q100 12 130 20 L138 60 Q140 120 138 180 L130 220 Q100 228 70 220 L62 180 Q60 120 62 60 Z" />
      {/* Pare-brise avant */}
      <Path d="M72 56 Q100 50 128 56 L122 84 Q100 80 78 84 Z" fill={soft} fillOpacity={0.5} />
      {/* Lunette arrière */}
      <Path d="M78 168 Q100 164 122 168 L128 192 Q100 198 72 192 Z" fill={soft} fillOpacity={0.5} />
      {/* Toit */}
      <Rect x={80} y={92} width={40} height={68} rx={6} stroke={soft} />
      {/* Rétroviseurs */}
      <Line x1={62} y1={70} x2={52} y2={66} />
      <Line x1={138} y1={70} x2={148} y2={66} />
      {/* Roues */}
      <Rect x={54} y={48} width={8} height={22} rx={3} fill={stroke} stroke="none" />
      <Rect x={138} y={48} width={8} height={22} rx={3} fill={stroke} stroke="none" />
      <Rect x={54} y={172} width={8} height={22} rx={3} fill={stroke} stroke="none" />
      <Rect x={138} y={172} width={8} height={22} rx={3} fill={stroke} stroke="none" />
    </G>
  );
}

function CarFront({ stroke, soft }: { stroke: string; soft: string }) {
  return (
    <G fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
      {/* Toit + capot */}
      <Path d="M40 150 L52 96 Q60 78 100 78 Q140 78 148 96 L160 150" />
      {/* Pare-brise */}
      <Path d="M62 96 Q100 88 138 96 L132 120 Q100 114 68 120 Z" fill={soft} fillOpacity={0.5} />
      {/* Bas de caisse */}
      <Rect x={36} y={150} width={128} height={34} rx={8} />
      {/* Phares */}
      <Rect x={46} y={156} width={20} height={12} rx={4} stroke={stroke} />
      <Rect x={134} y={156} width={20} height={12} rx={4} stroke={stroke} />
      {/* Calandre */}
      <Rect x={86} y={158} width={28} height={10} rx={3} stroke={soft} />
      {/* Roues */}
      <Rect x={40} y={182} width={26} height={10} rx={4} fill={stroke} stroke="none" />
      <Rect x={134} y={182} width={26} height={10} rx={4} fill={stroke} stroke="none" />
    </G>
  );
}

function CarRear({ stroke, soft }: { stroke: string; soft: string }) {
  return (
    <G fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M40 150 L52 100 Q60 84 100 84 Q140 84 148 100 L160 150" />
      {/* Lunette arrière */}
      <Path d="M62 100 Q100 92 138 100 L132 122 Q100 116 68 122 Z" fill={soft} fillOpacity={0.5} />
      <Rect x={36} y={150} width={128} height={34} rx={8} />
      {/* Feux arrière */}
      <Rect x={44} y={156} width={22} height={12} rx={3} stroke={stroke} />
      <Rect x={134} y={156} width={22} height={12} rx={3} stroke={stroke} />
      {/* Plaque */}
      <Rect x={84} y={158} width={32} height={10} rx={2} stroke={soft} />
      <Rect x={40} y={182} width={26} height={10} rx={4} fill={stroke} stroke="none" />
      <Rect x={134} y={182} width={26} height={10} rx={4} fill={stroke} stroke="none" />
    </G>
  );
}

function CarSide({ stroke, soft, flip }: { stroke: string; soft: string; flip: boolean }) {
  return (
    <G fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" transform={flip ? 'translate(200,0) scale(-1,1)' : undefined}>
      {/* Profil */}
      <Path d="M24 150 L40 150 Q50 120 72 116 L92 92 Q110 86 140 92 L156 116 Q172 120 176 150 L160 150" />
      <Path d="M24 150 Q22 168 40 168 L160 168 Q178 168 176 150" />
      {/* Vitres */}
      <Path d="M82 96 Q100 92 124 96 L132 116 L96 116 Z" fill={soft} fillOpacity={0.5} />
      <Path d="M70 116 L88 116 L88 100 Q78 104 70 116 Z" fill={soft} fillOpacity={0.5} />
      {/* Portes */}
      <Line x1={100} y1={116} x2={100} y2={150} stroke={soft} />
      <Line x1={92} y1={128} x2={108} y2={128} />
      {/* Roues */}
      <Circle cx={62} cy={158} r={16} fill="#fff" stroke={stroke} />
      <Circle cx={62} cy={158} r={6} fill={stroke} stroke="none" />
      <Circle cx={144} cy={158} r={16} fill="#fff" stroke={stroke} />
      <Circle cx={144} cy={158} r={6} fill={stroke} stroke="none" />
    </G>
  );
}
