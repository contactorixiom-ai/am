import { PickupMode, QuoteOptionKind, QuoteService } from '@prisma/client';
import {
  AIR_PER_KG_CENTS,
  CUSTOMS_FEE_CENTS,
  MINIMUM_CHARGE_CENTS,
  TariffLine,
  TariffLineInput,
  vehicleDeparturePort,
  priceTariffLines,
  tariffItem,
} from './tariffs';

/** Parcours d'envoi particuliers : voiture vers l'Afrique, import Afrique → Europe. */
export type ShipmentFlow = 'VEHICLE' | 'IMPORT';

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
  // Transport de personnes (chauffeur titulaire du permis D, FIMO voyageurs)
  minibus: 95,
  bus: 120,
  autocar: 130,
};

// Transport sur plateau (camion porte-voiture) : le véhicule ne roule pas.
// Pour un véhicule neuf, de collection, non roulant ou sans plaques.
// Tarif €/km HT du camion, carburant et péages du camion inclus.
export const FLATBED_RATE_CENTS: Record<string, number> = {
  default: 160,
  citadine: 160,
  berline: 160,
  break: 165,
  coupe: 165,
  electrique: 165,
  hybride: 165,
  monospace: 175,
  suv: 180,
  '4x4': 180,
  utilitaire: 190,
  camping_car: 220,
  luxe: 190,
  collection: 190,
  moto: 120,
};
export const FLATBED_MIN_FORFAIT_CENTS = 15000; // 150 € HT minimum (mise à disposition du camion)
export const BUS_MIN_FORFAIT_CENTS = 9000;      // 90 € HT minimum

// Forfait minimum : 40 € HT pour toute mission de moins de 60 km.
export const CONVOY_MIN_FORFAIT_CENTS = 4000;
export const CONVOY_MIN_FORFAIT_KM = 60;

// Tarif appliqué si la catégorie n'est pas précisée (repli prudent).
export type ConvoyService = 'CONVOY_CAR' | 'CONVOY_MOTO' | 'CONVOY_BUS' | 'CONVOY_FLATBED';
export const CONVOY_SERVICES: ConvoyService[] = ['CONVOY_CAR', 'CONVOY_MOTO', 'CONVOY_BUS', 'CONVOY_FLATBED'];
export function isConvoyService(service: string | null | undefined): service is ConvoyService {
  return CONVOY_SERVICES.includes(service as ConvoyService);
}
const CONVOY_DEFAULT_RATE_CENTS: Record<ConvoyService, number> = {
  CONVOY_CAR: 70,      // berline
  CONVOY_MOTO: 60,     // moto
  CONVOY_BUS: 120,     // bus
  CONVOY_FLATBED: 160, // plateau, véhicule léger
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
    minibus: 'minibus', bus: 'bus', autobus: 'bus', autocar: 'autocar', car: 'autocar', coach: 'autocar',
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
  CONVOY_BUS: {
    baseCents: 0,
    perKmCents: 120,           // 1,20 €/km HT (chauffeur permis D)
    minCents: 9000,
    uncertaintyPct: null as number | null,
    defaultMode: 'ROAD' as TransportMode,
  },
  CONVOY_FLATBED: {
    baseCents: 0,
    perKmCents: 160,           // 1,60 €/km HT (camion porte-voiture)
    minCents: 15000,
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
  NON_ROLLING:       { label: 'Véhicule non roulant (treuil)', flatCents: 3500, pctOfSubtotal: 0 },
  VIP_HANDOVER:      { label: 'Mise en main VIP',           flatCents: 2900,  pctOfSubtotal: 0 },
  EXPRESS_WASH:      { label: 'Lavage express',             flatCents: 2500,  pctOfSubtotal: 0 },
};

// ─────────────────────────────────────────────────────────────────────
// CONVOYAGE — grilles 2026 (documents « Grille tarifaire » d'Axis Import)
// ─────────────────────────────────────────────────────────────────────
// Deux grilles selon le client :
// - PARTICULIERS : prix TTC tout inclus (chauffeur, carburant, péages,
//   assurance), frais de dossier + tarif au km ; tarif « longue distance »
//   appliqué à tout le trajet au-delà de 350 km ; minimum 69 € TTC sous 50 km.
// - PROFESSIONNELS : prix HT ; forfait urbain (≤ 20 km) ou régional
//   (21-50 km), puis tarif au km ; carburant et péages refacturés au réel.
export type CustomerType = 'INDIVIDUAL' | 'PROFESSIONAL';

type ConvoyGroup = 'moto' | 'citadine' | 'berline' | 'electrique' | 'utilitaire' | 'prestige';
function convoyGroup(catKey: string | null): ConvoyGroup {
  switch (catKey) {
    case 'moto': return 'moto';
    case 'citadine': return 'citadine';
    case 'electrique': case 'hybride': return 'electrique';
    case 'utilitaire': case 'camping_car': return 'utilitaire';
    case 'luxe': case 'collection': case 'poids_lourd': return 'prestige';
    default: return 'berline'; // berline, break, coupé, SUV, monospace, 4×4
  }
}

/** Particuliers (TTC) : frais de dossier, €/km < 350 km, €/km > 350 km. */
const INDIVIDUAL_CONVOY_TTC: Record<ConvoyGroup, { feeCents: number; shortCents: number; longCents: number }> = {
  moto:       { feeCents: 2900, shortCents: 72,  longCents: 65 },  // hors grille : 0,60 € HT + TVA (à confirmer)
  citadine:   { feeCents: 2900, shortCents: 89,  longCents: 79 },
  berline:    { feeCents: 2900, shortCents: 98,  longCents: 88 },
  electrique: { feeCents: 3900, shortCents: 105, longCents: 95 },
  utilitaire: { feeCents: 4900, shortCents: 135, longCents: 122 },
  prestige:   { feeCents: 4900, shortCents: 135, longCents: 122 },
};
export const INDIVIDUAL_CONVOY_LONG_KM = 350;
export const INDIVIDUAL_CONVOY_MIN_TTC_CENTS = 6900; // trajets < 50 km
export const INDIVIDUAL_CONVOY_MIN_KM = 50;

/** Professionnels (HT) : forfait ≤ 20 km, forfait 21-50 km, puis €/km. */
const PRO_CONVOY_HT: Record<ConvoyGroup, { urbanCents: number; regionalCents: number; perKmCents: number }> = {
  moto:       { urbanCents: 4500, regionalCents: 6500,  perKmCents: 60 },
  citadine:   { urbanCents: 4500, regionalCents: 6500,  perKmCents: 65 },
  berline:    { urbanCents: 4500, regionalCents: 6500,  perKmCents: 70 },
  electrique: { urbanCents: 5500, regionalCents: 7500,  perKmCents: 75 },
  utilitaire: { urbanCents: 5500, regionalCents: 7500,  perKmCents: 90 },
  prestige:   { urbanCents: 7500, regionalCents: 10500, perKmCents: 120 },
};
// SUV, monospace, 4×4 : 0,75 € HT/km (même forfait que berline).
const PRO_CONVOY_SUV_PER_KM = 75;

// Plateau (camion porte-voiture, groupage) : forfait ≤ 200 km, €/km
// 201-500 km, €/km au-delà de 500 km. Quatre colonnes de la grille.
type FlatbedGroup = 'citadine' | 'berline' | 'utilitaire' | 'electrique';
function flatbedGroup(catKey: string | null, nonRolling: boolean): FlatbedGroup {
  if (nonRolling) return 'electrique'; // colonne « Électrique / hors d'usage »
  switch (catKey) {
    case 'citadine': case 'moto': return 'citadine';
    case 'utilitaire': case 'camping_car': case 'poids_lourd': return 'utilitaire';
    case 'electrique': case 'hybride': return 'electrique';
    default: return 'berline'; // berline, SUV, monospace, luxe, collection…
  }
}
const FLATBED_TIERS: Record<CustomerType, Record<FlatbedGroup, { flatCents: number; midCents: number; longCents: number }>> = {
  INDIVIDUAL: { // TTC
    citadine:   { flatCents: 18000, midCents: 68, longCents: 52 },
    berline:    { flatCents: 21000, midCents: 75, longCents: 58 },
    utilitaire: { flatCents: 26000, midCents: 88, longCents: 69 },
    electrique: { flatCents: 23000, midCents: 82, longCents: 64 },
  },
  PROFESSIONAL: { // HT
    citadine:   { flatCents: 14500, midCents: 55, longCents: 42 },
    berline:    { flatCents: 16900, midCents: 62, longCents: 48 },
    utilitaire: { flatCents: 21000, midCents: 72, longCents: 56 },
    electrique: { flatCents: 18500, midCents: 68, longCents: 52 },
  },
};
export const FLATBED_FLAT_KM = 200;
export const FLATBED_LONG_KM = 500;

function flatbedPrice(tier: { flatCents: number; midCents: number; longCents: number }, km: number): number {
  if (km <= FLATBED_FLAT_KM) return tier.flatCents;
  // Jamais moins cher qu'un trajet plus court : le palier précédent sert de plancher.
  const mid = Math.max(tier.flatCents, Math.round(km * tier.midCents));
  if (km <= FLATBED_LONG_KM) return mid;
  return Math.max(Math.round(FLATBED_LONG_KM * tier.midCents), Math.round(km * tier.longCents));
}

/** Options en TTC pour un particulier (grille particuliers), HT pour un pro. */
function optionPrice(kind: QuoteOptionKind, customer: CustomerType, service: ConvoyService, base: number): number {
  const cfg = OPTIONS_CATALOG[kind];
  if (customer === 'INDIVIDUAL') {
    const ttc: Partial<Record<QuoteOptionKind, number>> = { WEEKEND_PICKUP: 3900, NON_ROLLING: 4500, VIP_HANDOVER: 2900, EXPRESS_WASH: 2500 };
    if (ttc[kind] != null) return ttc[kind] as number;
    if (kind === 'EXPRESS') return Math.round(base * 15 / 100);
    return Math.round(cfg.flatCents * (1 + TAX_RATE)) + Math.round(base * cfg.pctOfSubtotal / 100);
  }
  // Pro : plateau prioritaire +10 %, convoyage express +15 %.
  if (kind === 'EXPRESS') return Math.round(base * (service === 'CONVOY_FLATBED' ? 10 : 15) / 100);
  return cfg.flatCents + Math.round(base * cfg.pctOfSubtotal / 100);
}

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
  /** Particulier (grille TTC tout inclus) ou professionnel (grille HT). */
  customerType?: CustomerType;
  /** Pays de destination (port d'embarquement des véhicules, règles locales). */
  toCountry?: string;
  /** Distance du premier km (domicile → hub) pour l'enlèvement à domicile. */
  pickupDistanceKm?: number;
  /** Articles de la grille (fûts, cartons, m³, palettes…) — envois maritimes. */
  items?: TariffLineInput[];
  /** Voiture vers l'Afrique ou import Afrique → Europe (sinon colis / marchandise). */
  flow?: ShipmentFlow;
  /** Voiture : distance routière jusqu'au port, si Axis y convoie le véhicule. */
  convoyToPortKm?: number;
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
  if (isConvoyService(input.service)) {
    return computeConvoyQuote(input);
  }
  if (input.service === 'PARCEL' || input.service === 'MERCHANDISE') {
    return computeShipmentQuote(input);
  }
  throw new Error('Service non supporté');
}

// Convoyage : grilles 2026 (voir CONVOYAGE ci-dessus). Bus et autocar :
// tarif HT au km, en attendant une grille dédiée.
function computeConvoyQuote(input: QuoteComputationInput): ComputedQuote {
  const service = input.service as ConvoyService;
  const rules = PRICING[service];
  const customer: CustomerType = input.customerType ?? 'INDIVIDUAL';
  const km = input.distanceKm ?? 0;
  if (km <= 0) {
    throw new Error('distanceKm est requis pour un convoyage (ou ville reconnue)');
  }
  const catKey = normalizeVehicleCategory(input.vehicleCategory);
  const transportMode = rules.defaultMode;
  const pickupMode: PickupMode = input.pickupMode ?? 'HUB_DROP_OFF';
  const uncertaintyPct = rules.uncertaintyPct;
  const lines: QuoteLine[] = [];
  const nonRolling = input.options.includes('NON_ROLLING');

  // Montant « de base » (hors options) dans l'unité de la grille : TTC pour
  // un particulier, HT pour un professionnel (et pour les bus).
  let basePriceCents = 0;
  let variablePriceCents = 0;
  let minCents = 0;
  let grossIsTtc = customer === 'INDIVIDUAL';
  let note: string | null = null;

  if (service === 'CONVOY_FLATBED') {
    const tier = FLATBED_TIERS[customer][flatbedGroup(catKey, nonRolling)];
    variablePriceCents = flatbedPrice(tier, km);
    lines.push({
      code: 'FLATBED', unit: 'forfait', quantity: 1, unitCents: variablePriceCents, totalCents: variablePriceCents,
      label: km <= FLATBED_FLAT_KM
        ? `Transport sur plateau, forfait jusqu'à ${FLATBED_FLAT_KM} km`
        : `Transport sur plateau, ${km} km`,
    });
    note = customer === 'INDIVIDUAL'
      ? 'Groupage sur camion porte-voiture (6 à 8 véhicules) : zéro kilomètre au compteur. Camion complet (3 à 8 véhicules) : sur devis.'
      : 'Tarifs HT, groupage réseau porte-voitures. Camion complet ou transfert de parc : sur devis ; remise de 8 % dès 10 véhicules par mois.';
  } else if (service === 'CONVOY_BUS') {
    grossIsTtc = false;
    const perKm = (catKey && VEHICLE_CATEGORY_RATE_CENTS[catKey]) || CONVOY_DEFAULT_RATE_CENTS.CONVOY_BUS;
    variablePriceCents = Math.round(km * perKm);
    minCents = BUS_MIN_FORFAIT_CENTS;
    lines.push({ code: 'CONVOY_KM', unit: 'fee', quantity: 1, unitCents: variablePriceCents, totalCents: variablePriceCents, label: `Convoyage ${km} km, chauffeur permis D` });
    note = 'Chauffeur titulaire du permis D, convoyage à vide. Carburant et péages refacturés au réel.';
  } else if (customer === 'PROFESSIONAL') {
    const group = convoyGroup(catKey);
    const g = PRO_CONVOY_HT[group];
    const perKm = catKey && ['suv', 'monospace', '4x4'].includes(catKey) ? PRO_CONVOY_SUV_PER_KM : g.perKmCents;
    if (km <= 20) {
      basePriceCents = g.urbanCents;
      lines.push({ code: 'CONVOY_FORFAIT', unit: 'forfait', quantity: 1, unitCents: g.urbanCents, totalCents: g.urbanCents, label: 'Forfait urbain (≤ 20 km), carburant et péages inclus' });
    } else if (km <= 50) {
      basePriceCents = g.regionalCents;
      lines.push({ code: 'CONVOY_FORFAIT', unit: 'forfait', quantity: 1, unitCents: g.regionalCents, totalCents: g.regionalCents, label: 'Forfait régional (21-50 km), carburant et péages inclus' });
    } else {
      variablePriceCents = Math.round(km * perKm);
      lines.push({ code: 'CONVOY_KM', unit: 'fee', quantity: 1, unitCents: variablePriceCents, totalCents: variablePriceCents, label: `Convoyage ${km} km × ${(perKm / 100).toFixed(2).replace('.', ',')} € HT` });
    }
    note = km > 50
      ? 'Tarif professionnel HT. Carburant et péages refacturés au réel sur justificatifs. Remise de 5 à 15 % selon le volume mensuel.'
      : 'Tarif professionnel HT, déplacement, carburant et péages inclus. Remise de 5 à 15 % selon le volume mensuel.';
  } else {
    const g = INDIVIDUAL_CONVOY_TTC[convoyGroup(catKey)];
    const perKm = km > INDIVIDUAL_CONVOY_LONG_KM ? g.longCents : g.shortCents;
    basePriceCents = g.feeCents;
    variablePriceCents = Math.round(km * perKm);
    if (km < INDIVIDUAL_CONVOY_MIN_KM) minCents = INDIVIDUAL_CONVOY_MIN_TTC_CENTS;
    lines.push({ code: 'CONVOY_FEE', unit: 'forfait', quantity: 1, unitCents: g.feeCents, totalCents: g.feeCents, label: 'Frais de dossier' });
    lines.push({ code: 'CONVOY_KM', unit: 'fee', quantity: 1, unitCents: variablePriceCents, totalCents: variablePriceCents, label: `Convoyage ${km} km × ${(perKm / 100).toFixed(2).replace('.', ',')} € TTC${km > INDIVIDUAL_CONVOY_LONG_KM ? ' (tarif longue distance)' : ''}` });
    note = 'Prix tout inclus : chauffeur, carburant, péages, assurance tous risques et RC pro. État des lieux contradictoire au départ et à l\'arrivée.';
  }

  const rawBase = basePriceCents + variablePriceCents;
  const computedOptions: ComputedOption[] = input.options.map((kind) => ({
    kind,
    label: OPTIONS_CATALOG[kind].label,
    priceCents: optionPrice(kind, grossIsTtc ? 'INDIVIDUAL' : 'PROFESSIONAL', service, rawBase),
  }));
  const addonsPriceCents = computedOptions.reduce((s, o) => s + o.priceCents, 0);
  let gross = rawBase + addonsPriceCents;
  if (gross < minCents) {
    lines.push({ code: 'CONVOY_MIN', unit: 'forfait', quantity: 1, unitCents: minCents - gross, totalCents: minCents - gross, label: grossIsTtc ? 'Minimum de perception (trajet court)' : 'Minimum de perception' });
    gross = minCents;
  }

  // Décomposition HT / TVA / TTC : la grille particuliers est en TTC.
  let subtotalCents: number;
  let taxCents: number;
  let totalCents: number;
  if (grossIsTtc) {
    totalCents = gross;
    subtotalCents = Math.round(gross / (1 + TAX_RATE));
    taxCents = totalCents - subtotalCents;
  } else {
    subtotalCents = gross;
    taxCents = Math.round(subtotalCents * TAX_RATE);
    totalCents = subtotalCents + taxCents;
  }
  if (!grossIsTtc) {
    // Les lignes restent en HT pour un pro : on le dit.
    for (const l of lines) l.label = `${l.label} (HT)`;
  }
  // Particulier : les montants de base sont TTC ; on les ramène en HT pour
  // garder des champs cohérents avec le total.
  if (grossIsTtc) {
    basePriceCents = Math.round(basePriceCents / (1 + TAX_RATE));
    variablePriceCents = subtotalCents - basePriceCents - Math.round(addonsPriceCents / (1 + TAX_RATE));
  }

  const disclaimer = note ?? (uncertaintyPct != null
    ? `Devis estimé ±${uncertaintyPct} % — frais de douane et fluctuations de fret possibles.`
    : null);
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
    addonsPriceCents: grossIsTtc ? Math.round(addonsPriceCents / (1 + TAX_RATE)) : addonsPriceCents,
    subtotalCents,
    taxRate: TAX_RATE,
    taxCents,
    totalCents,
    currency: 'EUR',
    uncertaintyPct,
    disclaimer,
    options: computedOptions,
    lines,
    hints,
  };
}

const eur = (cents: number) => `${(cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;

// Colis et marchandises : grille import-export, montants TTC. Le devis
// garde la décomposition HT / TVA attendue par la comptabilité, recalculée
// à partir du prix TTC pour que le client paie exactement le prix affiché.
function computeShipmentQuote(input: QuoteComputationInput): ComputedQuote {
  if (input.flow) return computeFlowQuote(input, input.flow);
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

// Voiture vers l'Afrique (RORO) et import Afrique → Europe : même logique
// TTC que les colis, avec leurs propres règles.
//   - voiture : prix RORO à la pièce ; si Axis convoie le véhicule jusqu'au
//     port, km × tarif de convoyage du type de véhicule (grille) ;
//   - import : épicerie aérienne au kg (30 kg minimum), artisanat au m³,
//     échantillons au forfait ; un seul mode par envoi ; minimum de
//     perception sur le fret ; dépôt chez le correspondant Axis au départ.
function computeFlowQuote(input: QuoteComputationInput, flow: ShipmentFlow): ComputedQuote {
  if (!input.items || input.items.length === 0) {
    throw new Error(flow === 'VEHICLE'
      ? 'Indique le type de véhicule à expédier.'
      : 'Indique ce que tu fais venir : épicerie, artisanat ou échantillons.');
  }
  const lines: QuoteLine[] = [...priceTariffLines(flow, input.items)];
  const pickupMode: PickupMode = input.pickupMode ?? 'HUB_DROP_OFF';
  let transportMode: TransportMode = 'SEA';

  if (flow === 'VEHICLE') {
    if (pickupMode === 'HOME_PICKUP') {
      const km = Math.round(input.convoyToPortKm ?? 0);
      const port = vehicleDeparturePort(input.toCountry);
      if (km <= 0) throw new Error(`Distance jusqu'au ${port.label} introuvable pour cette ville.`);
      for (const l of [...lines]) {
        const perKm = tariffItem(l.code)?.convoyPerKmCents ?? 0;
        if (!perKm) continue;
        const unitCents = Math.round(km * perKm);
        lines.push({
          code: 'CONVOY_TO_PORT',
          label: `Convoyage jusqu'au ${port.label} (${km} km${l.quantity > 1 ? `, ${l.quantity} véhicules` : ''})`,
          quantity: l.quantity,
          unit: 'fee',
          unitCents,
          totalCents: unitCents * l.quantity,
        });
      }
    } else if (pickupMode !== 'HUB_DROP_OFF') {
      throw new Error('Pour un véhicule : dépôt au port, ou convoyage jusqu\'au port par Axis.');
    }
  } else {
    if (pickupMode !== 'HUB_DROP_OFF') {
      throw new Error('Import : l\'envoi est déposé chez le correspondant Axis au départ.');
    }
    const modes = new Set(lines.map((l) => tariffItem(l.code)?.orderable?.mode));
    if (modes.size > 1) {
      throw new Error('Aérien et maritime partent séparément : fais une commande par mode.');
    }
    transportMode = modes.has('AIR') ? 'AIR' : 'SEA';
    const freight = lines.reduce((sum, l) => sum + l.totalCents, 0);
    if (freight < MINIMUM_CHARGE_CENTS) {
      lines.push({
        code: 'MINIMUM',
        label: `Minimum de perception (${eur(MINIMUM_CHARGE_CENTS)})`,
        quantity: 1,
        unit: 'fee',
        unitCents: MINIMUM_CHARGE_CENTS - freight,
        totalCents: MINIMUM_CHARGE_CENTS - freight,
      });
    }
  }

  const totalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const subtotalCents = Math.round(totalCents / (1 + TAX_RATE));
  const ranged = lines.filter((l) => l.maxUnitCents && l.maxUnitCents > l.unitCents);
  const disclaimer = ranged.length > 0
    ? `Prix de départ : ${ranged.map((l) => `${l.label.toLowerCase()} jusqu'à ${eur(l.maxUnitCents as number)}${l.unit === 'm3' ? ' le m³' : l.unit === 'kg' ? ' le kg' : ' l\'unité'}`).join(', ')} selon ${flow === 'VEHICLE' ? 'le gabarit et la destination' : 'la marchandise et l\'origine'}. Axis confirme le prix ${flow === 'VEHICLE' ? 'à la remise du véhicule' : 'au dépôt'}.`
    : null;
  const volumeM3 = Math.round(lines.reduce((v, l) => v + (l.unit === 'm3' ? l.quantity : 0), 0) * 100) / 100 || undefined;

  return {
    transportMode,
    pickupMode,
    basePriceCents: 0,
    variablePriceCents: subtotalCents,
    pickupFeeCents: 0,
    addonsPriceCents: 0,
    subtotalCents,
    taxRate: TAX_RATE,
    taxCents: totalCents - subtotalCents,
    totalCents,
    currency: 'EUR',
    uncertaintyPct: null,
    disclaimer,
    options: [],
    lines,
    volumeM3,
    hints: [],
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
