import { apiFetch } from './client';

export type MissionStatus =
  | 'DRAFT' | 'PUBLISHED' | 'ACCEPTED' | 'IN_PROGRESS'
  | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

export interface MissionSummary {
  id: string;
  reference: string;
  status: MissionStatus;
  pickupCity: string;
  pickupCountry: string;
  pickupAt: string;
  deliveryCity: string;
  deliveryCountry: string;
  vehicle: { make: string; model: string; year: number };
  driver?: { firstName: string; lastName: string } | null;
}

export interface CreateMissionInput {
  vehicleId: string;
  pickupAddress: string;
  pickupCity: string;
  pickupCountry: string;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAt: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  priority?: 'STANDARD' | 'EXPRESS' | 'URGENT';
  pickupNotes?: string;
  deliveryNotes?: string;
}

export async function createMission(input: CreateMissionInput): Promise<MissionSummary> {
  return apiFetch<MissionSummary>('/missions', { method: 'POST', body: input });
}

export async function listMissions(): Promise<{ data: MissionSummary[]; meta: { total: number } }> {
  return apiFetch('/missions');
}

export async function publishMission(id: string): Promise<MissionSummary> {
  return apiFetch<MissionSummary>(`/missions/${id}/publish`, { method: 'POST' });
}
