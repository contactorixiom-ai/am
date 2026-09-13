import { apiFetch } from './client';

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
  return apiFetch<RelayPoint[]>('/relay-points', {
    skipAuth: true,
    params: {
      city: params.city,
      country: params.country,
      carrier: params.carrier,
      lat: params.lat,
      lng: params.lng,
      radius: params.radius,
      limit: params.limit,
    },
  });
}

export const CARRIER_LABEL: Record<RelayCarrier, string> = {
  MONDIAL_RELAY:     'Mondial Relay',
  LA_POSTE:          'La Poste',
  CHRONOPOST:        'Chronopost',
  DPD:               'DPD',
  UPS_ACCESS_POINT:  'UPS Access Point',
  AXIS_HUB:          'Hub Axis (gratuit)',
};
