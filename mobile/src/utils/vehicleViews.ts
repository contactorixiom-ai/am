// Vues de l'état des lieux découpées dans les planches techniques
// (vehicleSketches.ts), celles qui figurent aussi sur le contrat PDF. Un repère
// de dommage est enregistré en coordonnées relatives à SA vue (0..1) : il se
// replace exactement au même endroit dans l'application et sur le PDF.

import {
  VEHICLE_SKETCH_BUS,
  VEHICLE_SKETCH_CAR,
  VEHICLE_SKETCH_MOTO,
  VEHICLE_SKETCH_VAN,
} from './vehicleSketches';

export type SketchKind = 'car' | 'van' | 'moto' | 'bus';
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
export const SKETCHES: Record<SketchKind, Sketch> = {
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
  moto: {
    uri: VEHICLE_SKETCH_MOTO,
    width: 1400,
    height: 900,
    views: {
      top: pad(779, 548, 1327, 772),
      left: pad(77, 64, 604, 401),
      right: pad(56, 504, 583, 841),
      front: pad(751, 59, 989, 401),
      rear: pad(1091, 59, 1329, 401),
    },
  },
  // Bus / autocar : profil gauche sans portes (côté conducteur), profil droit
  // avec portes ; la vue de dessus montre le toit, avant en haut.
  bus: {
    uri: VEHICLE_SKETCH_BUS,
    width: 1491,
    height: 1055,
    views: {
      top: pad(995, 120, 1205, 710, 10),
      left: pad(378, 156, 960, 372, 10),
      right: pad(400, 491, 982, 707, 10),
      front: pad(54, 105, 346, 427, 10),
      rear: pad(90, 470, 310, 792, 10),
    },
  },
};

/** Planche à utiliser selon la catégorie saisie (« Utilitaire », « Moto »…). */
export function sketchKindFor(category?: string | null): SketchKind {
  const c = (category ?? '').toLowerCase();
  if (c.includes('moto') || c.includes('scooter')) return 'moto';
  if (c.includes('bus') || c.includes('autocar') || c.includes('car ') || c === 'car' || c === 'coach') return 'bus';
  if (c.includes('utilit') || c.includes('poids') || c.includes('camion') || c.includes('camping') || c === 'van' || c === 'truck') return 'van';
  return 'car';
}
