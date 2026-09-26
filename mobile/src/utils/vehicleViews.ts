// Vues de l'état des lieux découpées dans les planches techniques
// (vehicleSketches.ts), celles qui figurent aussi sur le contrat PDF. Un repère
// de dommage est enregistré en coordonnées relatives à SA vue (0..1) : il se
// replace exactement au même endroit dans l'application et sur le PDF.

import {
  VEHICLE_SKETCH_CAR,
  VEHICLE_SKETCH_VAN,
} from './vehicleSketches';

export type SketchKind = 'car' | 'van' | 'moto';
export type SketchView = 'top' | 'front' | 'rear' | 'left' | 'right';

export interface Crop { x: number; y: number; w: number; h: number }

export interface Sketch {
  uri: string;
  width: number;
  height: number;
  views: Record<SketchView, Crop>;
}

const pad = (x0: number, y0: number, x1: number, y1: number, p = 14): Crop => ({
  x: x0 - p, y: y0 - p, w: x1 - x0 + 2 * p, h: y1 - y0 + 2 * p,
});

// Rectangles mesurés sur les planches (pixels de l'image source).
// Profil « gauche » = côté conducteur : véhicule tourné vers la gauche.
export const SKETCHES: Record<'car' | 'van', Sketch> = {
  car: {
    uri: VEHICLE_SKETCH_CAR,
    width: 1402,
    height: 1122,
    views: {
      top: pad(67, 119, 813, 468),
      left: pad(404, 520, 994, 714),
      right: pad(399, 793, 1002, 988),
      front: pad(35, 504, 340, 723),
      rear: pad(35, 778, 339, 997),
    },
  },
  van: {
    uri: VEHICLE_SKETCH_VAN,
    width: 1491,
    height: 1055,
    views: {
      top: pad(969, 156, 1168, 688),
      left: pad(385, 158, 925, 404),
      right: pad(394, 451, 918, 696),
      front: pad(63, 155, 331, 403),
      rear: pad(84, 454, 306, 703),
    },
  },
};

/** Planche à utiliser selon la catégorie saisie (« Utilitaire », « Moto »…). */
export function sketchKindFor(category?: string | null): SketchKind {
  const c = (category ?? '').toLowerCase();
  if (c.includes('moto') || c.includes('scooter')) return 'moto';
  if (c.includes('utilit') || c.includes('poids') || c.includes('camion') || c.includes('camping') || c === 'van' || c === 'truck') return 'van';
  return 'car';
}

// Moto : pas de planche fiable, on note le dommage par zone. Chaque zone a
// une position fixe (0..1) pour rester compatible avec le format des repères.
export const MOTO_ZONES: { key: string; label: string; x: number; y: number }[] = [
  { key: 'front_fairing', label: 'Carénage / optique avant', x: 0.1, y: 0.1 },
  { key: 'handlebar', label: 'Guidon, leviers, rétroviseurs', x: 0.3, y: 0.1 },
  { key: 'tank', label: 'Réservoir', x: 0.5, y: 0.1 },
  { key: 'seat', label: 'Selle', x: 0.7, y: 0.1 },
  { key: 'rear', label: 'Coque arrière / feu', x: 0.9, y: 0.1 },
  { key: 'left_side', label: 'Flanc gauche', x: 0.1, y: 0.5 },
  { key: 'right_side', label: 'Flanc droit', x: 0.3, y: 0.5 },
  { key: 'exhaust', label: 'Échappement', x: 0.5, y: 0.5 },
  { key: 'front_wheel', label: 'Roue / fourche avant', x: 0.7, y: 0.5 },
  { key: 'rear_wheel', label: 'Roue / bras arrière', x: 0.9, y: 0.5 },
];
