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
  toCity: string;
  toCountry: string;
  distanceKm?: number;
  weightKg?: number;
  volumeM3?: number;
  units?: number;
  options?: QuoteOptionKind[];
}

export interface QuoteResponse {
  id: string;
  reference: string;
  service: QuoteService;
  fromCity: string;
  toCity: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  currency: string;
  uncertaintyPct: number | null;
  disclaimer: string | null;
  options: Array<{ kind: QuoteOptionKind; label: string; priceCents: number }>;
}

export async function createQuote(input: CreateQuoteInput): Promise<QuoteResponse> {
  const r = await api.post<QuoteResponse>('/quotes', input);
  return r.data;
}
