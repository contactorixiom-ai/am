import { apiFetch } from './client';

export type QuoteService = 'CONVOY_CAR' | 'CONVOY_MOTO' | 'PARCEL' | 'MERCHANDISE';
export type TransportMode = 'ROAD' | 'AIR' | 'SEA';
export type PickupMode = 'HUB_DROP_OFF' | 'RELAY_DROP_OFF' | 'HOME_PICKUP';
export type QuoteOptionKind =
  | 'EXPRESS'
  | 'PREMIUM_INSURANCE'
  | 'WEEKEND_PICKUP'
  | 'EXTRA_DRIVER'
  | 'DOOR_TO_DOOR'
  | 'CUSTOMS_HANDLING';

export interface QuoteHint {
  kind: 'SAVE_WITH_SEA' | 'FAST_WITH_AIR' | 'CHEAPER_AT_RELAY' | 'INSURANCE_RECOMMENDED' | 'CONSOLIDATE';
  label: string;
  detail: string;
}

/** Article de la grille import-export commandé (fût, carton, m³…). */
export interface QuoteItemInput {
  code: string;
  /** Nombre de pièces, ou volume en m³. */
  quantity: number;
}

/** Ligne TTC d'un devis colis / marchandise, calculée par le serveur. */
export interface QuoteLine {
  code: string;
  label: string;
  quantity: number;
  unit: 'piece' | 'm3' | 'kg' | 'forfait' | 'fee';
  unitCents: number;
  /** Borne haute d'une fourchette : prix de départ ajustable au dépôt. */
  maxUnitCents?: number;
  totalCents: number;
}

export interface CreateQuoteInput {
  service: QuoteService;
  transportMode?: TransportMode;
  pickupMode?: PickupMode;
  fromCity: string;
  fromCountry: string;
  fromLatitude?: number;
  fromLongitude?: number;
  toCity: string;
  toCountry: string;
  toLatitude?: number;
  toLongitude?: number;
  distanceKm?: number;
  weightKg?: number;
  volumeM3?: number;
  units?: number;
  options?: QuoteOptionKind[];
  /** Catégorie de véhicule pour le convoyage (grille tarifaire par catégorie). */
  vehicleCategory?: string;
  /** Distance domicile → hub (enlèvement à domicile). */
  pickupDistanceKm?: number;
  /** Envoi maritime : articles de la grille et quantités. */
  items?: QuoteItemInput[];
}

export interface QuoteOption {
  kind: QuoteOptionKind;
  label: string;
  priceCents: number;
}

// ─── Estimation en direct ──────────────────────────────────────────────────
// Même moteur de prix que le devis, sans rien enregistrer : le client voit
// son tarif se mettre à jour pendant qu'il remplit le formulaire.

export interface QuoteEstimate {
  transportMode: TransportMode;
  pickupMode: PickupMode;
  distanceKm: number | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  uncertaintyPct: number | null;
  basePriceCents: number;
  variablePriceCents: number;
  pickupFeeCents: number;
  addonsPriceCents: number;
  options: QuoteOption[];
  /** Lignes TTC (colis et marchandises) ; vide pour un convoyage. */
  lines?: QuoteLine[];
  disclaimer?: string | null;
  hints: QuoteHint[];
}

export async function estimateQuote(input: CreateQuoteInput): Promise<QuoteEstimate> {
  return apiFetch<QuoteEstimate>('/quotes/estimate', {
    method: 'POST',
    body: input,
    // Appel fréquent pendant la saisie : on échoue vite plutôt que d'attendre.
    timeoutMs: 8000,
  });
}

export interface QuoteResponse {
  id: string;
  reference: string;
  service: QuoteService;
  transportMode: TransportMode;
  pickupMode: PickupMode;
  fromCity: string;
  fromCountry: string;
  fromLatitude: number | null;
  fromLongitude: number | null;
  toCity: string;
  toCountry: string;
  toLatitude: number | null;
  toLongitude: number | null;
  distanceKm: number | null;
  weightKg: number | null;
  volumeM3?: number | null;
  /** Lignes TTC de la grille (colis et marchandises). */
  lines?: QuoteLine[] | null;
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
  options: QuoteOption[];
  hints?: QuoteHint[];
}

export interface City {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  region: 'EU' | 'AFRICA';
  postalCode?: string;
}

/** Recherche d'une commune au-delà du catalogue (France, Europe, Afrique). */
export async function searchCities(q: string, region?: 'EU' | 'AFRICA'): Promise<City[]> {
  const res = await apiFetch<City[]>('/cities/search', {
    skipAuth: true,
    params: region ? { q, region } : { q },
  });
  return Array.isArray(res) ? res : [];
}

export async function createQuote(input: CreateQuoteInput): Promise<QuoteResponse> {
  return apiFetch<QuoteResponse>('/quotes', { method: 'POST', body: input, skipAuth: true });
}

export async function listCities(region?: 'EU' | 'AFRICA'): Promise<City[]> {
  // Défensif : une réponse inattendue (erreur renvoyée en 200, passage à un
  // format paginé) ne doit pas faire planter l'écran de réservation, qui est
  // le plus coûteux à perdre.
  const res = await apiFetch<City[] | { data?: City[] }>('/cities', {
    skipAuth: true,
    params: region ? { region } : undefined,
  });
  if (Array.isArray(res)) return res;
  return Array.isArray(res?.data) ? res.data : [];
}

// ─── Grille tarifaire import-export ────────────────────────────────────────
// Servie par l'API : l'écran « Nos tarifs » et le choix des articles d'un
// envoi maritime affichent exactement les prix qui serviront au devis.

export type TariffUnit = 'piece' | 'm3' | 'kg' | 'forfait';
export type TariffSectionId = 'EFFECTS' | 'GENERAL' | 'VEHICLES' | 'AIR' | 'EXPORT';

export interface TariffItem {
  code: string;
  section: TariffSectionId;
  label: string;
  detail?: string;
  unit: TariffUnit;
  minCents: number;
  maxCents?: number;
  included?: string;
  note?: string;
  convoyPerKmCents?: number;
  orderable?: { service: 'PARCEL' | 'MERCHANDISE'; mode: 'SEA' };
  onQuote?: boolean;
}

export interface TariffSection {
  id: TariffSectionId;
  title: string;
  subtitle?: string;
  mode: 'SEA' | 'AIR' | 'MIXED';
}

export interface TariffSheet {
  version: string;
  currency: string;
  sections: TariffSection[];
  items: TariffItem[];
  customsFeeCents: number;
  minimumChargeCents: number;
  airPerKgCents: number;
  notes: { customs: string; extraVolume: string; minimum: string; ranges: string };
}

let tariffRequest: Promise<TariffSheet> | null = null;

/** Grille tarifaire (une requête par session ; relancée après un échec). */
export function getTariffs(): Promise<TariffSheet> {
  if (!tariffRequest) {
    tariffRequest = apiFetch<TariffSheet>('/quotes/tariffs', { skipAuth: true }).catch((e) => {
      tariffRequest = null;
      throw e;
    });
  }
  return tariffRequest;
}
