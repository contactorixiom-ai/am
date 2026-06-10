import { api } from './client';

export type RelayCarrier = 'MONDIAL_RELAY' | 'LA_POSTE' | 'CHRONOPOST' | 'DPD' | 'UPS_ACCESS_POINT' | 'AXIS_HUB';

export interface RelayPoint {
  id: string;
  carrier: RelayCarrier;
  externalId: string | null;
  name: string;
  address: string;
  postalCode: string | null;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  openingHours: string | null;
  distanceKm?: number;
}

export interface SearchRelayParams {
  city?: string;
  country?: string;
  carrier?: RelayCarrier;
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
}

export async function searchRelayPoints(params: SearchRelayParams): Promise<RelayPoint[]> {
  const r = await api.get<RelayPoint[]>('/relay-points', { params });
  return r.data;
}

export const CARRIER_LABEL: Record<RelayCarrier, string> = {
  MONDIAL_RELAY:     'Mondial Relay',
  LA_POSTE:          'La Poste',
  CHRONOPOST:        'Chronopost',
  DPD:               'DPD',
  UPS_ACCESS_POINT:  'UPS Access Point',
  AXIS_HUB:          'Hub Axis (gratuit)',
};
