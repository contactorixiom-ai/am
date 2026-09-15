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
  pickupAddress?: string;
  pickupAt: string;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryAddress?: string;
  deliveryAt?: string | null;
  distanceKm?: number | null;
  priceCents?: number | null;
  vehicle: {
    make: string;
    model: string;
    year: number;
    licensePlate?: string;
    type?: 'CAR' | 'SUV' | 'VAN' | 'TRUCK' | 'MOTORCYCLE' | 'OTHER' | null;
  };
  driver?: { id?: string; firstName: string; lastName: string; phone?: string | null } | null;
  client?: { firstName: string; lastName: string } | null;
}

export interface MissionStatusEvent {
  status: MissionStatus;
  notes?: string | null;
  createdAt: string;
}

export interface MissionDetail extends MissionSummary {
  acceptedAt?: string | null;
  startedAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  durationMinutes?: number | null;
  statusHistory?: MissionStatusEvent[];
  vehicle: MissionSummary['vehicle'] & { type?: string | null; vin?: string | null };
}

export async function getMission(id: string): Promise<MissionDetail> {
  return apiFetch<MissionDetail>(`/missions/${id}`);
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

// ─── Espace admin (Roger) ─────────────────────────────────────────────────
// Roger prend les commandes par téléphone et affecte lui-même ses convoyeurs.
// Ces routes sont réservées au rôle ADMIN côté backend.

export interface DriverOption {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  driverProfile?: { baseCity?: string | null; rating?: number | null } | null;
}

export interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  companyName?: string | null;
}

export async function listDrivers(city?: string): Promise<DriverOption[]> {
  const qs = city ? `?pageSize=100&city=${encodeURIComponent(city)}` : '?pageSize=100';
  const res = await apiFetch<{ data: DriverOption[] }>(`/users/drivers${qs}`);
  return res?.data ?? [];
}

export async function listClients(q?: string): Promise<ClientOption[]> {
  const qs = q ? `?pageSize=50&q=${encodeURIComponent(q)}` : '?pageSize=50';
  const res = await apiFetch<{ data: ClientOption[] }>(`/users/clients${qs}`);
  return res?.data ?? [];
}

export async function assignDriver(missionId: string, driverId: string): Promise<MissionSummary> {
  return apiFetch<MissionSummary>(`/missions/${missionId}/assign`, {
    method: 'POST',
    body: { driverId },
  });
}

export interface AdminCreateMissionInput {
  clientId?: string;
  clientEmail?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientPhone?: string;
  vehicleId?: string;
  vehicleType?: 'CAR' | 'SUV' | 'VAN' | 'TRUCK' | 'MOTORCYCLE' | 'OTHER';
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehiclePlate?: string;
  vehicleVin?: string;
  driverId?: string;
  priority?: 'STANDARD' | 'EXPRESS' | 'URGENT';
  pickupAddress: string;
  pickupCity: string;
  pickupCountry?: string;
  pickupPostalCode?: string;
  pickupAt: string;
  pickupNotes?: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryCountry?: string;
  deliveryPostalCode?: string;
  deliveryAt?: string;
  deliveryNotes?: string;
  priceCents?: number;
  distanceKm?: number;
}

export async function adminCreateMission(
  input: AdminCreateMissionInput,
): Promise<MissionSummary> {
  return apiFetch<MissionSummary>('/missions/admin', { method: 'POST', body: input });
}

// ─── Brouillon de convoyage (threadé sans toucher navigation/types) ────────
// CarRequestScreen collecte les infos véhicule + trajet mais ne peut pas les
// passer en paramètres de route (navigation/types.ts est gelé). On persiste
// donc ces infos via AsyncStorage, et QuoteReviewScreen les relit au moment
// de la réservation pour créer le véhicule puis la mission.
export const CONVOY_DRAFT_KEY = 'axis.convoyDraft.v1';

export interface ConvoyDraft {
  // Véhicule
  vehicleCategory?: string;
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
