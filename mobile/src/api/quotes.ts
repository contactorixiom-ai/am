import { api } from './client';

export type QuoteService = 'CONVOY_CAR' | 'CONVOY_MOTO' | 'PARCEL' | 'MERCHANDISE';
export type QuoteOptionKind =
  | 'EXPRESS'
  | 'PREMIUM_INSURANCE'
  | 'WEEKEND_PICKUP'
  | 'EXTRA_DRIVER'
  | 'DOOR_TO_DOOR'
  | 'CUSTOMS_HANDLING';

export interface CreateQuoteInput {
  service: QuoteService;
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
  addonsPriceCents: number;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  uncertaintyPct: number | null;
  disclaimer: string | null;
  options: QuoteOption[];
}

export interface City {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  region: 'EU' | 'AFRICA';
}

export async function createQuote(input: CreateQuoteInput): Promise<QuoteResponse> {
  const r = await api.post<QuoteResponse>('/quotes', input);
  return r.data;
}

export async function listCities(region?: 'EU' | 'AFRICA'): Promise<City[]> {
  const r = await api.get<City[]>('/cities', { params: region ? { region } : {} });
  return r.data;
}
