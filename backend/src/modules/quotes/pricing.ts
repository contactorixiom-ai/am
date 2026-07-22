import { PickupMode, QuoteOptionKind, QuoteService } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────
// TARIFS AXIS IMPORT (HT, en cents pour éviter les arrondis flottants)
// Source : grille tarifaire Convoyage 2026 + tarifs colis.
//   - Convoyage : tarif €/km HT par catégorie de véhicule (voir grille)
//   - Forfait minimum convoyage : 40 € HT pour toute mission < 60 km
//   - Colis aérien     : à partir de 8,50 €/kg HT
//   - Colis maritime   : à partir de 4,50 €/kg HT (plus long, moins cher)
//   - Véhicule export Afrique : forcément maritime (calculé sur volume + poids)
// ─────────────────────────────────────────────────────────────────────

// Grille tarifaire Convoyage 2026 — prix au kilomètre HT par catégorie.
// Inclus dans le prix : chauffeur pro, RC pro, assurance dommages véhicule.
// Refacturés au réel (hors prix km) : carburant, péages.
export const VEHICLE_CATEGORY_RATE_CENTS: Record<string, number> = {
  moto: 60,
  citadine: 65,
  berline: 70,
  break: 75,
  coupe: 75,
  electrique: 80,
  hybride: 80,
  monospace: 85,
  suv: 85,
  '4x4': 85,
  camping_car: 85,
  poids_lourd: 90,
  utilitaire: 100,
  luxe: 110,
  collection: 130,
};

// Forfait minimum : 40 € HT pour toute mission de moins de 60 km.
export const CONVOY_MIN_FORFAIT_CENTS = 4000;
export const CONVOY_MIN_FORFAIT_KM = 60;

// Tarif appliqué si la catégorie n'est pas précisée (repli prudent).
const CONVOY_DEFAULT_RATE_CENTS: Record<'CONVOY_CAR' | 'CONVOY_MOTO', number> = {
  CONVOY_CAR: 70,  // berline
  CONVOY_MOTO: 60, // moto
};

// Normalise un libellé de catégorie (« SUV », « 4×4 », « Camping-car »,
// « Poids lourd »…) vers une clé de VEHICLE_CATEGORY_RATE_CENTS.
export function normalizeVehicleCategory(raw?: string): string | null {
  if (!raw) return null;
  const k = raw
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les accents
    .replace(/×/g, 'x')
    .replace(/[\s-]+/g, '_')
    .trim();
  if (k in VEHICLE_CATEGORY_RATE_CENTS) return k;
  // Quelques alias courants
  const alias: Record<string, string> = {
    '4_4': '4x4', '4x4': '4x4', quatre_quatre: '4x4',
    campingcar: 'camping_car', camping_car: 'camping_car',
    poidslourd: 'poids_lourd', poids_lourd: 'poids_lourd',
    suv: 'suv', vehicule_de_luxe: 'luxe', collection: 'collection',
  };
  return alias[k] ?? null;
}

export type TransportMode = 'ROAD' | 'AIR' | 'SEA';

export const PRICING = {
  CONVOY_CAR: {
    baseCents: 0,
    perKmCents: 66,            // 0,66 €/km HT
    minCents: 5000,            // 50 € HT minimum
    uncertaintyPct: null as number | null,
    defaultMode: 'ROAD' as TransportMode,
  },
  CONVOY_MOTO: {
    baseCents: 0,
    perKmCents: 55,            // 0,55 €/km HT (moins coûteux qu'une voiture)
    minCents: 4000,
    uncertaintyPct: null as number | null,
    defaultMode: 'ROAD' as TransportMode,
  },
  PARCEL: {
    // Selon le mode de transport choisi par le client
    air: { baseCents: 0, perKgCents: 850, minCents: 8500 }, // 8,50 €/kg, mini 1 kg
    sea: { baseCents: 0, perKgCents: 450, minCents: 9000 }, // 4,50 €/kg, mini 20 kg
    uncertaintyPct: 8,          // ±8 % (douanes, fluctuations fret)
    defaultMode: 'AIR' as TransportMode,
  },
  MERCHANDISE: {
    // Maritime par défaut pour la marchandise lourde / véhicules export
    air: { baseCents: 0, perKgCents: 850, perM3Cents: 25000, minCents: 15000 },
    sea: { baseCents: 0, perKgCents: 320, perM3Cents: 18000, minCents: 12000 },
    uncertaintyPct: 8,
    defaultMode: 'SEA' as TransportMode,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────
// FIRST-MILE / PICKUP — récupération du colis
// ─────────────────────────────────────────────────────────────────────
// Coût additionnel selon le mode choisi par le client.
// HUB_DROP_OFF : gratuit (client apporte au hub Axis)
// RELAY_DROP_OFF : prix d'un point relais (Mondial Relay / La Poste / etc.)
// HOME_PICKUP : enlèvement à domicile par notre transporteur partenaire
export const PICKUP_PRICING: Record<PickupMode, { baseCents: number; perKgCents: number; minCents: number; label: string }> = {
  HUB_DROP_OFF: {
    baseCents: 0, perKgCents: 0, minCents: 0,
    label: 'Dépôt au hub Axis',
  },
  RELAY_DROP_OFF: {
    baseCents: 500, perKgCents: 0, minCents: 500,
    label: 'Enlèvement en point relais',
  },
  HOME_PICKUP: {
    baseCents: 2500, perKgCents: 0, minCents: 2500,
    label: 'Récupération du colis (domicile)',
  },
};

// Enlèvement à domicile facturé au forfait (25 €) — pas de supplément kilométrique.
export const HOME_PICKUP_PER_KM_CENTS_HT = 0;

// ─────────────────────────────────────────────────────────────────────
// ADD-ONS / OPTIONS
// ─────────────────────────────────────────────────────────────────────
export const OPTIONS_CATALOG: Record<QuoteOptionKind, { label: string; flatCents: number; pctOfSubtotal: number }> = {
  EXPRESS:           { label: 'Express 24h',               flatCents: 0,     pctOfSubtotal: 15 },
  PREMIUM_INSURANCE: { label: 'Assurance Premium (350k€)', flatCents: 2961,  pctOfSubtotal: 0 },
  WEEKEND_PICKUP:    { label: 'Enlèvement weekend',         flatCents: 6000,  pctOfSubtotal: 0 },
  EXTRA_DRIVER:      { label: 'Convoyeur supplémentaire',   flatCents: 12000, pctOfSubtotal: 0 },
  DOOR_TO_DOOR:      { label: 'Porte-à-porte',              flatCents: 0,     pctOfSubtotal: 0 },
  CUSTOMS_HANDLING:  { label: 'Démarches douanières',       flatCents: 6000,  pctOfSubtotal: 0 },
};

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────
export interface QuoteComputationInput {
  service: QuoteService;
  transportMode?: TransportMode;
  pickupMode?: PickupMode;
  distanceKm?: number;
  weightKg?: number;
  volumeM3?: number;
  units?: number;
  options: QuoteOptionKind[];
  /** Catégorie de véhicule pour le convoyage (berline, SUV, utilitaire…). */
  vehicleCategory?: string;
  /** Distance du premier km (domicile → hub) pour l'enlèvement à domicile. */
  pickupDistanceKm?: number;
}

export interface ComputedOption {
  kind: QuoteOptionKind;
  label: string;
  priceCents: number;
}

export interface ComputedQuote {
  transportMode: TransportMode;
  pickupMode: PickupMode;
  basePriceCents: number;
  variablePriceCents: number;
  pickupFeeCents: number;
  addonsPriceCents: number;
  subtotalCents: number;
  taxRate: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  uncertaintyPct: number | null;
  disclaimer: string | null;
  options: ComputedOption[];
  // Smart hints — value-add pour aider le client à choisir
  hints: QuoteHint[];
}

export interface QuoteHint {
  kind: 'SAVE_WITH_SEA' | 'FAST_WITH_AIR' | 'CHEAPER_AT_RELAY' | 'INSURANCE_RECOMMENDED' | 'CONSOLIDATE';
  label: string;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────
// CALCUL
// ─────────────────────────────────────────────────────────────────────
export function computeQuote(input: QuoteComputationInput): ComputedQuote {
  const currency = 'EUR';
  let basePriceCents = 0;
  let variablePriceCents = 0;
  let minCents = 0;
  let uncertaintyPct: number | null = null;
  let transportMode: TransportMode;

  if (input.service === 'CONVOY_CAR' || input.service === 'CONVOY_MOTO') {
    const rules = PRICING[input.service];
    const km = input.distanceKm ?? 0;
    if (km <= 0) {
      throw new Error('distanceKm est requis pour un convoyage (ou ville reconnue)');
    }
    // Tarif au km selon la catégorie de véhicule (grille Convoyage 2026).
    const catKey = normalizeVehicleCategory(input.vehicleCategory);
    const perKmCents = (catKey && VEHICLE_CATEGORY_RATE_CENTS[catKey])
      || CONVOY_DEFAULT_RATE_CENTS[input.service];
    transportMode = rules.defaultMode;
    basePriceCents = 0;
    variablePriceCents = Math.round(km * perKmCents);
    // Forfait minimum 40 € HT pour les missions courtes (< 60 km).
    minCents = km < CONVOY_MIN_FORFAIT_KM ? CONVOY_MIN_FORFAIT_CENTS : 0;
    uncertaintyPct = rules.uncertaintyPct;
  } else if (input.service === 'PARCEL') {
    const rules = PRICING.PARCEL;
    transportMode = input.transportMode ?? rules.defaultMode;
    if (transportMode === 'ROAD') transportMode = rules.defaultMode;
    const tier = transportMode === 'SEA' ? rules.sea : rules.air;
    const kg = input.weightKg ?? 0;
    if (kg <= 0) {
      throw new Error('weightKg est requis pour un colis');
    }
    basePriceCents = tier.baseCents;
    variablePriceCents = Math.round(kg * tier.perKgCents);
    minCents = tier.minCents;
    uncertaintyPct = rules.uncertaintyPct;
  } else if (input.service === 'MERCHANDISE') {
    const rules = PRICING.MERCHANDISE;
    transportMode = input.transportMode ?? rules.defaultMode;
    if (transportMode === 'ROAD') transportMode = rules.defaultMode;
    const tier = transportMode === 'AIR' ? rules.air : rules.sea;
    const kg = input.weightKg ?? 0;
    const m3 = input.volumeM3 ?? 0;
    if (kg <= 0 && m3 <= 0) {
      throw new Error('weightKg ou volumeM3 requis pour la marchandise');
    }
    const byKg = Math.round(kg * tier.perKgCents);
    const byM3 = Math.round(m3 * tier.perM3Cents);
    basePriceCents = tier.baseCents;
    variablePriceCents = Math.max(byKg, byM3);
    minCents = tier.minCents;
    uncertaintyPct = rules.uncertaintyPct;
  } else {
    throw new Error('Service non supporté');
  }

  // First-mile pickup (uniquement pour colis / marchandise)
  let pickupFeeCents = 0;
  let pickupMode: PickupMode = input.pickupMode ?? 'HUB_DROP_OFF';
  if (input.service === 'PARCEL' || input.service === 'MERCHANDISE') {
    const pickupRules = PICKUP_PRICING[pickupMode];
    const kg = input.weightKg ?? 0;
    const computed = pickupRules.baseCents + Math.round(kg * pickupRules.perKgCents);
    pickupFeeCents = Math.max(pickupRules.minCents, computed);
    // Enlèvement à domicile : supplément 0,75 €/km TTC (≈ 0,63 €/km HT) sur la
    // distance domicile → hub, si elle est connue.
    if (pickupMode === 'HOME_PICKUP' && (input.pickupDistanceKm ?? 0) > 0) {
      pickupFeeCents += Math.round((input.pickupDistanceKm as number) * HOME_PICKUP_PER_KM_CENTS_HT);
    }
  }

  const rawSubtotal = basePriceCents + variablePriceCents + pickupFeeCents;

  // Add-ons
  const computedOptions: ComputedOption[] = input.options.map((kind) => {
    const cfg = OPTIONS_CATALOG[kind];
    const price = cfg.flatCents + Math.round(rawSubtotal * cfg.pctOfSubtotal / 100);
    return { kind, label: cfg.label, priceCents: price };
  });
  const addonsPriceCents = computedOptions.reduce((s, o) => s + o.priceCents, 0);

  let subtotalCents = rawSubtotal + addonsPriceCents;
  if (subtotalCents < minCents) subtotalCents = minCents;

  // TVA 20 % (FR B2C). Pour B2B et exports hors UE on ajustera plus tard.
  const taxRate = 0.20;
  const taxCents = Math.round(subtotalCents * taxRate);
  const totalCents = subtotalCents + taxCents;

  const disclaimer = uncertaintyPct != null
    ? `Devis estimé ±${uncertaintyPct} % — frais de douane et fluctuations de fret possibles.`
    : null;

  // Smart hints — moteur de recommandation
  const hints = computeHints({ ...input, transportMode, pickupMode, weightKg: input.weightKg ?? 0, totalCents, hasInsurance: input.options.includes('PREMIUM_INSURANCE') });

  return {
    transportMode,
    pickupMode,
    basePriceCents,
    variablePriceCents,
    pickupFeeCents,
    addonsPriceCents,
    subtotalCents,
    taxRate,
    taxCents,
    totalCents,
    currency,
    uncertaintyPct,
    disclaimer,
    options: computedOptions,
    hints,
  };
}

// ─────────────────────────────────────────────────────────────────────
// SMART HINTS — recommandations intelligentes pour la conversion
// ─────────────────────────────────────────────────────────────────────
interface HintInput {
  service: QuoteService;
  transportMode: TransportMode;
  pickupMode: PickupMode;
  weightKg: number;
  totalCents: number;
  hasInsurance: boolean;
}

function computeHints(input: HintInput): QuoteHint[] {
  const hints: QuoteHint[] = [];

  // Colis aérien lourd → suggère maritime
  if (input.service === 'PARCEL' && input.transportMode === 'AIR' && input.weightKg >= 20) {
    const seaWeight = input.weightKg * PRICING.PARCEL.sea.perKgCents;
    const airWeight = input.weightKg * PRICING.PARCEL.air.perKgCents;
    const savePct = Math.round((1 - seaWeight / airWeight) * 100);
    hints.push({
      kind: 'SAVE_WITH_SEA',
      label: `Économise ~${savePct} % en maritime`,
      detail: `Pour ${input.weightKg} kg, le maritime coûte environ ${savePct} % de moins. Délai : 30-45 jours.`,
    });
  }

  // Colis maritime urgent → préviens du délai
  if (input.service === 'PARCEL' && input.transportMode === 'SEA' && input.weightKg < 5) {
    hints.push({
      kind: 'FAST_WITH_AIR',
      label: 'Pour ce petit colis, l\'aérien est conseillé',
      detail: 'En dessous de 5 kg, la différence de prix avec l\'aérien est minime et tu reçois en 5-10 jours.',
    });
  }

  // Mode pickup HOME → suggère relais pour économiser
  if (input.pickupMode === 'HOME_PICKUP' && input.weightKg < 15) {
    hints.push({
      kind: 'CHEAPER_AT_RELAY',
      label: 'Dépose au point relais et économise',
      detail: 'L\'enlèvement à domicile (25 €) coûte 20 € de plus que le point relais (5 €). Pour un colis < 15 kg, le point relais suffit largement.',
    });
  }

  // Pas d'assurance et valeur potentiellement élevée
  if (!input.hasInsurance && input.totalCents > 15000) {
    hints.push({
      kind: 'INSURANCE_RECOMMENDED',
      label: 'Assurance Premium recommandée',
      detail: 'Pour 29,61 € seulement, tu couvres ton colis jusqu\'à 350 000 €. Recommandé au-delà de 150 € de valeur.',
    });
  }

  return hints;
}
