import { QuoteOptionKind, QuoteService } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────
// TARIFS AXIS IMPORT (HT, en cents pour éviter les arrondis flottants)
// Source : grille tarifaire métier validée juin 2026.
//   - Convoyage Europe : 0,66 €/km HT
//   - Colis aérien     : à partir de 8,50 €/kg HT
//   - Colis maritime   : à partir de 4,50 €/kg HT (plus long, moins cher)
//   - Véhicule export Afrique : forcément maritime (calculé sur volume + poids)
// ─────────────────────────────────────────────────────────────────────

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
// ADD-ONS / OPTIONS
// ─────────────────────────────────────────────────────────────────────
export const OPTIONS_CATALOG: Record<QuoteOptionKind, { label: string; flatCents: number; pctOfSubtotal: number }> = {
  EXPRESS:           { label: 'Express 24h',               flatCents: 0,     pctOfSubtotal: 22 },
  PREMIUM_INSURANCE: { label: 'Assurance Premium (500k€)', flatCents: 3500,  pctOfSubtotal: 0 },
  WEEKEND_PICKUP:    { label: 'Enlèvement weekend',         flatCents: 4000,  pctOfSubtotal: 0 },
  EXTRA_DRIVER:      { label: 'Convoyeur supplémentaire',   flatCents: 12000, pctOfSubtotal: 0 },
  DOOR_TO_DOOR:      { label: 'Porte-à-porte',              flatCents: 0,     pctOfSubtotal: 15 },
  CUSTOMS_HANDLING:  { label: 'Démarches douanières',       flatCents: 6000,  pctOfSubtotal: 0 },
};

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────
export interface QuoteComputationInput {
  service: QuoteService;
  transportMode?: TransportMode;
  distanceKm?: number;
  weightKg?: number;
  volumeM3?: number;
  units?: number;
  options: QuoteOptionKind[];
}

export interface ComputedOption {
  kind: QuoteOptionKind;
  label: string;
  priceCents: number;
}

export interface ComputedQuote {
  transportMode: TransportMode;
  basePriceCents: number;
  variablePriceCents: number;
  addonsPriceCents: number;
  subtotalCents: number;
  taxRate: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  uncertaintyPct: number | null;
  disclaimer: string | null;
  options: ComputedOption[];
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
    transportMode = rules.defaultMode;
    basePriceCents = rules.baseCents;
    variablePriceCents = Math.round(km * rules.perKmCents);
    minCents = rules.minCents;
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

  const rawSubtotal = basePriceCents + variablePriceCents;

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

  return {
    transportMode,
    basePriceCents,
    variablePriceCents,
    addonsPriceCents,
    subtotalCents,
    taxRate,
    taxCents,
    totalCents,
    currency,
    uncertaintyPct,
    disclaimer,
    options: computedOptions,
  };
}
