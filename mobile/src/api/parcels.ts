import { apiFetch } from './client';

export type ParcelStatus =
  | 'DRAFT' | 'AWAITING_DROP_OFF' | 'AWAITING_PICKUP' | 'RECEIVED' | 'IN_TRANSIT'
  | 'CUSTOMS' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'LOST';

export type PickupMode = 'HUB_DROP_OFF' | 'RELAY_DROP_OFF' | 'HOME_PICKUP';
export type ParcelTransportMode = 'AIR' | 'SEA';

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
  transportMode?: ParcelTransportMode;
  pickupMode?: PickupMode;
  relayPointId?: string;
  pickupAddress?: string;
  pickupAt?: string;
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
  return apiFetch<ParcelSummary>('/parcels', { method: 'POST', body: input });
}

export async function listParcels(): Promise<{ data: ParcelSummary[]; meta: { total: number } }> {
  return apiFetch('/parcels');
}

export async function trackParcel(reference: string): Promise<ParcelSummary> {
  return apiFetch<ParcelSummary>(`/parcels/track/${reference}`, { skipAuth: true });
}

// Détail d'un colis (inclut le journal des événements de suivi, trié).
export async function getParcel(id: string): Promise<ParcelSummary> {
  return apiFetch<ParcelSummary>(`/parcels/${id}`);
}

// Admin (Roger) : ajoute un événement de suivi et fait avancer le statut du colis.
export async function addParcelEvent(
  id: string,
  input: { status: ParcelStatus; location?: string; notes?: string },
): Promise<ParcelSummary> {
  return apiFetch<ParcelSummary>(`/parcels/${id}/events`, { method: 'POST', body: input });
}
