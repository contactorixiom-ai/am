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
}

export interface QuoteOption {
  kind: QuoteOptionKind;
  label: string;
  priceCents: number;
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
}

export async function createQuote(input: CreateQuoteInput): Promise<QuoteResponse> {
  return apiFetch<QuoteResponse>('/quotes', { method: 'POST', body: input, skipAuth: true });
}

export async function listCities(region?: 'EU' | 'AFRICA'): Promise<City[]> {
  return apiFetch<City[]>('/cities', { skipAuth: true, params: region ? { region } : undefined });
}
