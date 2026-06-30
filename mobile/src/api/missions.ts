import AsyncStorage from '@react-native-async-storage/async-storage';
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
  vehicle: { make: string; model: string; year: number; licensePlate?: string };
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

// ─── Brouillon de convoyage (threadé sans toucher navigation/types) ────────
// CarRequestScreen collecte les infos véhicule + trajet mais ne peut pas les
// passer en paramètres de route (navigation/types.ts est gelé). On persiste
// donc ces infos via AsyncStorage, et QuoteReviewScreen les relit au moment
// de la réservation pour créer le véhicule puis la mission.
export const CONVOY_DRAFT_KEY = 'axis.convoyDraft.v1';

export interface ConvoyDraft {
  // Véhicule
  vehicleMake?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleYear?: number;
  // Adresses (optionnelles — à défaut on retombe sur ville/pays du devis)
  pickupAddress?: string;
  deliveryAddress?: string;
  // Notes saisies par le client
  notes?: string;
  // Référence du devis associé, pour invalider un brouillon obsolète
  quoteReference?: string;
}

export async function saveConvoyDraft(draft: ConvoyDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(CONVOY_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Navigation privée / quota : on continue, le repli devis reste possible.
  }
}

export async function readConvoyDraft(): Promise<ConvoyDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(CONVOY_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConvoyDraft;
  } catch {
    return null;
  }
}

export async function clearConvoyDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CONVOY_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
