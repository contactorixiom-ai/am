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
