import React, { useRef, useState } from 'react';
import { GestureResponderEvent, Image, LayoutChangeEvent, Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { SKETCHES, SketchKind } from '../utils/vehicleViews';

export type ViewKey = 'top' | 'front' | 'rear' | 'left' | 'right';
export type DamageCode = 'R' | 'F' | 'E' | 'C' | 'M';

export interface Damage {
  id: string;
  view: ViewKey;
  /** Position relative à la vue (0..1), identique sur le contrat PDF. */
  x: number;
  y: number;
  code: DamageCode;
  /** Ancien relevé moto par zone (avant la planche moto). */
  zone?: string;
  note?: string;
  photo?: boolean;
  /** URI de la photo jointe au dommage (preuve en cas de litige). */
  photoUri?: string;
}

export const DAMAGE_META: Record<DamageCode, { label: string; color: string }> = {
  R: { label: 'Rayure', color: '#C9A55C' },
  F: { label: 'Fissure', color: '#E0A04D' },
  E: { label: 'Enfoncement', color: '#D97A4E' },
  C: { label: 'Cassé', color: '#C0524B' },
  M: { label: 'Manquant', color: '#8E5BAE' },
};

export const VIEW_CAPTION: Record<ViewKey, string> = {
  top: 'Vue de dessus · avant à gauche',
  left: 'Côté gauche (conducteur)',
  right: 'Côté droit (passager)',
  front: 'Face avant',
  rear: 'Face arrière',
};

interface Props {
  kind: SketchKind;
  view: ViewKey;
  damages: Damage[];
  onAdd: (x: number, y: number, zone?: string) => void;
  onMarkerPress?: (id: string) => void;
  height?: number;
}

const PAD = 14;
const HINT_H = 34;
const CAPTION_H = 26;

// Planche technique découpée par vue (la même que sur le contrat PDF). Le
// convoyeur touche l'endroit abîmé ; le repère est placé en coordonnées de la
// vue, donc au même endroit sur le PDF.
export function VehicleDiagram({ kind, view, damages, onAdd, onMarkerPress, height = 280 }: Props) {
  const { theme } = useTheme();
  const [box, setBox] = useState({ w: 0, h: height });
  const ref = useRef<View>(null);

  const sketch = SKETCHES[kind];
  const crop = sketch.views[view];
  const availW = Math.max(0, box.w - PAD * 2);
  const availH = Math.max(0, box.h - CAPTION_H - HINT_H - PAD);
  const scale = box.w ? Math.min(availW / crop.w, availH / crop.h) : 0;
  const rect = {
    w: crop.w * scale,
    h: crop.h * scale,
    left: (box.w - crop.w * scale) / 2,
    top: CAPTION_H + (availH - crop.h * scale) / 2,
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setBox({ w: width, h });
  };

  // Position du toucher dans le cadre. Sur le web, locationX n'est pas
  // fiable (relatif à l'élément touché, parfois absent) : on part des
  // coordonnées de page et du rectangle du cadre.
  const pointIn = (e: GestureResponderEvent): { x: number; y: number } | null => {
    const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number; pageX?: number; pageY?: number; clientX?: number; clientY?: number };
    if (Platform.OS === 'web') {
      const el = ref.current as unknown as { getBoundingClientRect?: () => { left: number; top: number } } | null;
      const r = el?.getBoundingClientRect?.();
      const cx = ne.clientX ?? (ne.pageX != null ? ne.pageX - (typeof window !== 'undefined' ? window.scrollX : 0) : undefined);
      const cy = ne.clientY ?? (ne.pageY != null ? ne.pageY - (typeof window !== 'undefined' ? window.scrollY : 0) : undefined);
      if (r && cx != null && cy != null) return { x: cx - r.left, y: cy - r.top };
    }
    if (Number.isFinite(ne.locationX) && Number.isFinite(ne.locationY)) return { x: ne.locationX as number, y: ne.locationY as number };
    return null;
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (!rect.w || !rect.h) return;
    const pt = pointIn(e);
    if (!pt) return;
    const rx = (pt.x - rect.left) / rect.w;
    const ry = (pt.y - rect.top) / rect.h;
    // Un toucher hors du dessin (marges) n'est pas un dommage.
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx < -0.03 || rx > 1.03 || ry < -0.03 || ry > 1.03) return;
    onAdd(Math.min(1, Math.max(0, rx)), Math.min(1, Math.max(0, ry)));
  };

  return (
    <Pressable
      ref={ref}
      onPress={handlePress}
      onLayout={onLayout}
      style={{ height, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.line, overflow: 'hidden' }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, color: '#6B7686', fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {kind === 'van' && view === 'top' ? 'Vue de dessus · avant en haut' : VIEW_CAPTION[view]}
        </Text>
        {damages.length > 0 ? (
          <Text style={{ fontSize: 11, color: '#6B7686', fontWeight: '700' }}>
            {damages.length} repère{damages.length > 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>

      {scale > 0 ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.w, height: rect.h, overflow: 'hidden' }}
        >
          <Image
            source={{ uri: sketch.uri }}
            style={{
              position: 'absolute',
              left: -crop.x * scale,
              top: -crop.y * scale,
              width: sketch.width * scale,
              height: sketch.height * scale,
            }}
            resizeMode="stretch"
          />
        </View>
      ) : null}

      {scale > 0
        ? damages.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => onMarkerPress?.(d.id)}
              hitSlop={8}
              style={{
                position: 'absolute',
                left: rect.left + d.x * rect.w - 12,
                top: rect.top + d.y * rect.h - 12,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: DAMAGE_META[d.code].color,
                borderWidth: 2,
                borderColor: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                elevation: 3,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{d.code}</Text>
              {d.photo || d.photoUri ? (
                <View style={{ position: 'absolute', right: -3, top: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: theme.navy, borderWidth: 1, borderColor: '#fff' }} />
              ) : null}
            </Pressable>
          ))
        : null}

      <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.bgSoft }}>
          <Text style={{ fontSize: 10.5, color: theme.muted, fontWeight: '600' }}>Touche l'endroit exact du dommage</Text>
        </View>
      </View>
    </Pressable>
  );
}
