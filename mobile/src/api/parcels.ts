import { api } from './client';

export type ParcelStatus =
  | 'DRAFT' | 'AWAITING_DROP_OFF' | 'RECEIVED' | 'IN_TRANSIT'
  | 'CUSTOMS' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'LOST';

export type ParcelCategory =
  | 'PERSONAL_EFFECTS' | 'ELECTRONICS' | 'CLOTHING' | 'FOOD'
  | 'COMMERCIAL_GOODS' | 'DOCUMENTS' | 'VEHICLE_PARTS' | 'OTHER';

export interface ParcelTrackingEvent {
  status: ParcelStatus;
  location?: string;
  notes?: string;
  occurredAt: string;
}

export interface ParcelSummary {
  id: string;
  reference: string;
  status: ParcelStatus;
  originCountry: string;
  originCity: string;
  destinationCountry: string;
  destinationCity: string;
  weightKg: number;
  trackingEvents?: ParcelTrackingEvent[];
}

export interface CreateParcelInput {
  category?: ParcelCategory;
  weightKg: number;
  description?: string;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  recipientEmail?: string;
  originCountry: string;
  originCity: string;
  originAddress?: string;
  destinationCountry: string;
  destinationCity: string;
  destinationAddress: string;
}

export async function createParcel(input: CreateParcelInput): Promise<ParcelSummary> {
  const r = await api.post<ParcelSummary>('/parcels', input);
  return r.data;
}

export async function listParcels(): Promise<{ data: ParcelSummary[]; meta: { total: number } }> {
  const r = await api.get('/parcels');
  return r.data;
}

export async function trackParcel(reference: string): Promise<ParcelSummary> {
  const r = await api.get<ParcelSummary>(`/parcels/track/${reference}`);
  return r.data;
}
