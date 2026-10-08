import { PickupMode, QuoteOptionKind, QuoteService } from '@prisma/client';
import {
  AIR_PER_KG_CENTS,
  CUSTOMS_FEE_CENTS,
  MINIMUM_CHARGE_CENTS,
  TariffLine,
  TariffLineInput,
  priceTariffLines,
} from './tariffs';

// ─────────────────────────────────────────────────────────────────────
// TARIFS AXIS IMPORT (en cents pour éviter les arrondis flottants)
//   - Convoyage : grille Convoyage 2026, tarif €/km HT par catégorie,
//     forfait minimum 40 € HT pour toute mission < 60 km ;
//   - Colis et marchandises : grille import-export (./tariffs.ts), prix
//     payés par le client TVA comprise — fûts, cartons, valises,
//     électroménager, m³, palettes en maritime ; 8,50 €/kg en aérien.
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
} as const;

// ─────────────────────────────────────────────────────────────────────
// FIRST-MILE / PICKUP — récupération du colis
// ─────────────────────────────────────────────────────────────────────
// Coût additionnel selon le mode choisi par le client, tel qu'affiché dans
// l'app (« Forfait 25 € ») : montant payé, TVA comprise.
// HUB_DROP_OFF : gratuit (client apporte au hub Axis)
// RELAY_DROP_OFF : prix d'un point relais (Mondial Relay / La Poste / etc.)
// HOME_PICKUP : enlèvement à domicile par notre transporteur partenaire
export const PICKUP_PRICING: Record<PickupMode, { baseCents: number; perKgCents: number; minCents: number; label: string }> = {
  HUB_DROP_OFF: {
    baseCents: 0, perKgCents: 0, minCents: 0,
    label: 'Dépôt chez Axis',
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
  /** Articles de la grille (fûts, cartons, m³, palettes…) — envois maritimes. */
  items?: TariffLineInput[];
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
  /**
   * Lignes TTC de la grille import-export (colis et marchandises), dans
   * l'ordre d'affichage. Vide pour un convoyage (décomposition HT).
   */
  lines: QuoteLine[];
  /** Volume total commandé (m³ + palettes), pour information. */
  volumeM3?: number;
  // Smart hints — value-add pour aider le client à choisir
  hints: QuoteHint[];
}

/** Ligne de devis affichée au client : article de la grille ou frais. */
export interface QuoteLine extends Omit<TariffLine, 'unit'> {
  unit: TariffLine['unit'] | 'fee';
}

export interface QuoteHint {
  kind: 'SAVE_WITH_SEA' | 'FAST_WITH_AIR' | 'CHEAPER_AT_RELAY' | 'INSURANCE_RECOMMENDED' | 'CONSOLIDATE';
  label: string;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────
// CALCUL
// ─────────────────────────────────────────────────────────────────────

// TVA 20 % (FR). Le traitement des transports internationaux est à valider
// avec le comptable : le prix payé par le client, lui, ne bouge pas.
const TAX_RATE = 0.20;

export function computeQuote(input: QuoteComputationInput): ComputedQuote {
  if (input.service === 'CONVOY_CAR' || input.service === 'CONVOY_MOTO') {
    return computeConvoyQuote(input);
  }
  if (input.service === 'PARCEL' || input.service === 'MERCHANDISE') {
    return computeShipmentQuote(input);
  }
  throw new Error('Service non supporté');
}

// Convoyage : tarif kilométrique HT, TVA ajoutée.
function computeConvoyQuote(input: QuoteComputationInput): ComputedQuote {
  const rules = PRICING[input.service as 'CONVOY_CAR' | 'CONVOY_MOTO'];
  const km = input.distanceKm ?? 0;
  if (km <= 0) {
    throw new Error('distanceKm est requis pour un convoyage (ou ville reconnue)');
  }
  // Tarif au km selon la catégorie de véhicule (grille Convoyage 2026).
  const catKey = normalizeVehicleCategory(input.vehicleCategory);
  const perKmCents = (catKey && VEHICLE_CATEGORY_RATE_CENTS[catKey])
    || CONVOY_DEFAULT_RATE_CENTS[input.service as 'CONVOY_CAR' | 'CONVOY_MOTO'];
  const transportMode = rules.defaultMode;
  const basePriceCents = 0;
  const variablePriceCents = Math.round(km * perKmCents);
  // Forfait minimum 40 € HT pour les missions courtes (< 60 km).
  const minCents = km < CONVOY_MIN_FORFAIT_KM ? CONVOY_MIN_FORFAIT_CENTS : 0;
  const uncertaintyPct = rules.uncertaintyPct;
  const pickupMode: PickupMode = input.pickupMode ?? 'HUB_DROP_OFF';

  const rawSubtotal = basePriceCents + variablePriceCents;
  const computedOptions: ComputedOption[] = input.options.map((kind) => {
    const cfg = OPTIONS_CATALOG[kind];
    const price = cfg.flatCents + Math.round(rawSubtotal * cfg.pctOfSubtotal / 100);
    return { kind, label: cfg.label, priceCents: price };
  });
  const addonsPriceCents = computedOptions.reduce((s, o) => s + o.priceCents, 0);

  let subtotalCents = rawSubtotal + addonsPriceCents;
  if (subtotalCents < minCents) subtotalCents = minCents;
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  const disclaimer = uncertaintyPct != null
    ? `Devis estimé ±${uncertaintyPct} % — frais de douane et fluctuations de fret possibles.`
    : null;
  const hints = computeHints({
    service: input.service, transportMode, pickupMode, weightKg: input.weightKg ?? 0,
    totalCents, hasInsurance: input.options.includes('PREMIUM_INSURANCE'),
  });

  return {
    transportMode,
    pickupMode,
    basePriceCents,
    variablePriceCents,
    pickupFeeCents: 0,
    addonsPriceCents,
    subtotalCents,
    taxRate: TAX_RATE,
    taxCents,
    totalCents,
    currency: 'EUR',
    uncertaintyPct,
    disclaimer,
    options: computedOptions,
    lines: [],
    hints,
  };
}

const eur = (cents: number) => `${(cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;

// Colis et marchandises : grille import-export, montants TTC. Le devis
// garde la décomposition HT / TVA attendue par la comptabilité, recalculée
// à partir du prix TTC pour que le client paie exactement le prix affiché.
function computeShipmentQuote(input: QuoteComputationInput): ComputedQuote {
  const service = input.service as 'PARCEL' | 'MERCHANDISE';
  let transportMode: TransportMode = input.transportMode === 'SEA' || input.transportMode === 'AIR'
    ? input.transportMode
    : service === 'PARCEL' ? 'AIR' : 'SEA';

  const lines: QuoteLine[] = [];
  let volumeM3: number | undefined;
  let applyMinimum = true;

  if (transportMode === 'AIR') {
    const kg = input.weightKg ?? 0;
    if (kg <= 0) throw new Error('Indique le poids de l\'envoi pour un transport aérien.');
    const quantity = Math.round(kg * 100) / 100;
    lines.push({
      code: 'AIR_KG',
      label: 'Fret aérien express (toutes zones)',
      quantity,
      unit: 'kg',
      unitCents: AIR_PER_KG_CENTS,
      totalCents: Math.round(quantity * AIR_PER_KG_CENTS),
    });
  } else {
    transportMode = 'SEA';
    if (!input.items || input.items.length === 0) {
      throw new Error(service === 'PARCEL'
        ? 'Indique ce que tu envoies : fûts, cartons, valises, électroménager.'
        : 'Indique le volume en m³ ou le nombre de palettes.');
    }
    const tariffLines = priceTariffLines(service, input.items);
    lines.push(...tariffLines);
    if (service === 'PARCEL') {
      // Effets personnels : prix à la pièce, frais de douane en sus.
      applyMinimum = false;
      lines.push({
        code: 'CUSTOMS_FEE',
        label: 'Frais de douane (forfait)',
        quantity: 1,
        unit: 'fee',
        unitCents: CUSTOMS_FEE_CENTS,
        totalCents: CUSTOMS_FEE_CENTS,
      });
    } else {
      // Palette standard 120 × 100 × 150 cm = 1,8 m³.
      volumeM3 = Math.round(tariffLines.reduce(
        (v, l) => v + (l.unit === 'm3' ? l.quantity : l.code === 'PALLET' ? l.quantity * 1.8 : 0), 0,
      ) * 100) / 100;
    }
  }

  // Minimum de perception sur le transport (courrier, petit colis, premier
  // m³ ou fraction).
  const freight = lines.reduce((s, l) => s + l.totalCents, 0);
  if (applyMinimum && freight < MINIMUM_CHARGE_CENTS) {
    lines.push({
      code: 'MINIMUM',
      label: `Minimum de perception (${eur(MINIMUM_CHARGE_CENTS)})`,
      quantity: 1,
      unit: 'fee',
      unitCents: MINIMUM_CHARGE_CENTS - freight,
      totalCents: MINIMUM_CHARGE_CENTS - freight,
    });
  }

  // Récupération du colis (montant affiché au client, TVA comprise).
  const pickupMode: PickupMode = input.pickupMode ?? 'HUB_DROP_OFF';
  const pickupRules = PICKUP_PRICING[pickupMode];
  let pickupTtc = Math.max(pickupRules.minCents, pickupRules.baseCents + Math.round((input.weightKg ?? 0) * pickupRules.perKgCents));
  if (pickupMode === 'HOME_PICKUP' && (input.pickupDistanceKm ?? 0) > 0) {
    pickupTtc += Math.round((input.pickupDistanceKm as number) * HOME_PICKUP_PER_KM_CENTS_HT);
  }
  if (pickupTtc > 0) {
    lines.push({ code: 'PICKUP', label: pickupRules.label, quantity: 1, unit: 'fee', unitCents: pickupTtc, totalCents: pickupTtc });
  }

  // Options (catalogue en HT) : converties en TTC pour rester homogènes.
  const baseTtc = lines.reduce((s, l) => s + l.totalCents, 0);
  const computedOptions: ComputedOption[] = input.options.map((kind) => {
    const cfg = OPTIONS_CATALOG[kind];
    const ht = cfg.flatCents + Math.round((baseTtc / (1 + TAX_RATE)) * cfg.pctOfSubtotal / 100);
    return { kind, label: cfg.label, priceCents: ht };
  });
  computedOptions.forEach((o) => {
    const ttc = Math.round(o.priceCents * (1 + TAX_RATE));
    lines.push({ code: `OPTION_${o.kind}`, label: o.label, quantity: 1, unit: 'fee', unitCents: ttc, totalCents: ttc });
  });

  const totalCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const subtotalCents = Math.round(totalCents / (1 + TAX_RATE));
  const taxCents = totalCents - subtotalCents;
  const pickupFeeCents = pickupTtc > 0 ? Math.round(pickupTtc / (1 + TAX_RATE)) : 0;
  const addonsPriceCents = computedOptions.reduce((s, o) => s + o.priceCents, 0);
  const variablePriceCents = subtotalCents - pickupFeeCents - addonsPriceCents;

  // Fourchettes : prix de départ facturé, ajustement possible au dépôt.
  const ranged = lines.filter((l) => l.maxUnitCents && l.maxUnitCents > l.unitCents);
  const disclaimer = ranged.length > 0
    ? `Prix de départ : ${ranged.map((l) => `${l.label.toLowerCase()} jusqu'à ${eur(l.maxUnitCents as number)}${l.unit === 'm3' ? ' le m³' : ' l\'unité'}`).join(', ')} selon la taille et la destination. Axis confirme le prix au dépôt.`
    : null;

  const hints = computeHints({
    service: input.service, transportMode, pickupMode, weightKg: input.weightKg ?? 0,
    totalCents, hasInsurance: input.options.includes('PREMIUM_INSURANCE'),
  });

  return {
    transportMode,
    pickupMode,
    basePriceCents: 0,
    variablePriceCents,
    pickupFeeCents,
    addonsPriceCents,
    subtotalCents,
    taxRate: TAX_RATE,
    taxCents,
    totalCents,
    currency: 'EUR',
    uncertaintyPct: null,
    disclaimer,
    options: computedOptions,
    lines,
    volumeM3,
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
