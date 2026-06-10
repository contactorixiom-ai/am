import { QuoteOptionKind, QuoteService } from '@prisma/client';

// Tarifs Axis — à ajuster avec la grille tarifaire finale du métier.
export const PRICING = {
  CONVOY_CAR: {
    baseCents: 12000,        // 120 €
    perKmCents: 95,          // 0,95 €/km
    minCents: 18000,         // 180 € minimum
    uncertaintyPct: null,
  },
  CONVOY_MOTO: {
    baseCents: 9000,         // 90 €
    perKmCents: 80,          // 0,80 €/km
    minCents: 14000,         // 140 € minimum
    uncertaintyPct: null,
  },
  PARCEL: {
    baseCents: 2500,         // 25 € frais fixes
    perKgCents: 480,         // 4,80 €/kg vers Afrique
    minCents: 3500,
    uncertaintyPct: 8,       // ±8 % (douanes / fluctuations fret)
  },
  MERCHANDISE: {
    baseCents: 8000,         // 80 € frais fixes
    perKgCents: 320,         // 3,20 €/kg
    perM3Cents: 25000,       // 250 €/m³
    minCents: 15000,
    uncertaintyPct: 8,
  },
} as const;

// Add-ons / options
export const OPTIONS_CATALOG: Record<QuoteOptionKind, { label: string; flatCents: number; pctOfSubtotal: number }> = {
  EXPRESS:           { label: 'Express 24h',              flatCents: 0,     pctOfSubtotal: 22 },
  PREMIUM_INSURANCE: { label: 'Assurance Premium (500k€)', flatCents: 3500,  pctOfSubtotal: 0 },
  WEEKEND_PICKUP:    { label: 'Enlèvement weekend',        flatCents: 4000,  pctOfSubtotal: 0 },
  EXTRA_DRIVER:      { label: 'Convoyeur supplémentaire',  flatCents: 12000, pctOfSubtotal: 0 },
  DOOR_TO_DOOR:      { label: 'Porte-à-porte',             flatCents: 0,     pctOfSubtotal: 15 },
  CUSTOMS_HANDLING:  { label: 'Démarches douanières',      flatCents: 6000,  pctOfSubtotal: 0 },
};

export interface QuoteComputationInput {
  service: QuoteService;
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

export function computeQuote(input: QuoteComputationInput): ComputedQuote {
  const rules = PRICING[input.service];
  const currency = 'EUR';

  let variablePriceCents = 0;

  if (input.service === 'CONVOY_CAR' || input.service === 'CONVOY_MOTO') {
    const km = input.distanceKm ?? 0;
    if (km <= 0) {
      throw new Error('distanceKm est requis pour un convoyage');
    }
    variablePriceCents = Math.round(km * rules.perKmCents);
  } else if (input.service === 'PARCEL') {
    const kg = input.weightKg ?? 0;
    if (kg <= 0) {
      throw new Error('weightKg est requis pour un colis');
    }
    variablePriceCents = Math.round(kg * rules.perKgCents);
  } else if (input.service === 'MERCHANDISE') {
    const kg = input.weightKg ?? 0;
    const m3 = input.volumeM3 ?? 0;
    if (kg <= 0 && m3 <= 0) {
      throw new Error('weightKg ou volumeM3 requis pour la marchandise');
    }
    const byKg = Math.round(kg * (rules as { perKgCents: number }).perKgCents);
    const byM3 = Math.round(m3 * (rules as { perM3Cents: number }).perM3Cents);
    variablePriceCents = Math.max(byKg, byM3);
  }

  const basePriceCents = rules.baseCents;
  const rawSubtotal = basePriceCents + variablePriceCents;

  // Compute add-ons
  const computedOptions: ComputedOption[] = input.options.map((kind) => {
    const cfg = OPTIONS_CATALOG[kind];
    const price = cfg.flatCents + Math.round(rawSubtotal * cfg.pctOfSubtotal / 100);
    return { kind, label: cfg.label, priceCents: price };
  });
  const addonsPriceCents = computedOptions.reduce((s, o) => s + o.priceCents, 0);

  let subtotalCents = rawSubtotal + addonsPriceCents;
  if (subtotalCents < rules.minCents) {
    subtotalCents = rules.minCents;
  }

  // TVA — 20 % France pour B2C. À affiner selon B2B / pays.
  const taxRate = 0.20;
  const taxCents = Math.round(subtotalCents * taxRate);
  const totalCents = subtotalCents + taxCents;

  const uncertaintyPct = rules.uncertaintyPct;
  const disclaimer =
    uncertaintyPct != null
      ? `Devis estimé ±${uncertaintyPct} % — frais de douane et fluctuations de fret possibles.`
      : null;

  return {
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
