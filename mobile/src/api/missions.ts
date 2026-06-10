import { api } from './client';

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
  const r = await api.post<MissionSummary>('/missions', input);
  return r.data;
}

export async function listMissions(): Promise<{ data: MissionSummary[]; meta: { total: number } }> {
  const r = await api.get('/missions');
  return r.data;
}

export async function publishMission(id: string): Promise<MissionSummary> {
  const r = await api.post<MissionSummary>(`/missions/${id}/publish`);
  return r.data;
}
