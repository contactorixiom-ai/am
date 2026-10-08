import { apiFetch } from './client';

// ─── Suivi GPS d'une mission de convoyage ───────────────────────────────────
// Aligné sur backend/src/modules/gps :
//   POST /missions/:missionId/gps          → envoyer un point (chauffeur assigné,
//                                            mission IN_PROGRESS uniquement)
//   GET  /missions/:missionId/gps/latest   → dernière position connue
//   GET  /missions/:missionId/gps/trail    → historique des positions

export interface TrackPositionInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speedKmh?: number;
  heading?: number;
  altitude?: number;
}

// Miroir du modèle Prisma MissionLocation renvoyé par le backend.
export interface GpsPoint {
  id: string;
  missionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speedKmh?: number | null;
  heading?: number | null;
  altitude?: number | null;
  recordedAt: string; // ISO 8601
}

/** Chauffeur : envoie une position GPS pour la mission en cours. */
export async function trackPosition(
  missionId: string,
  input: TrackPositionInput,
): Promise<GpsPoint> {
  return apiFetch<GpsPoint>(`/missions/${missionId}/gps`, {
    method: 'POST',
    body: input,
    // Envoi fréquent en tâche de fond : on échoue vite plutôt que de bloquer.
    timeoutMs: 10000,
  });
}

/** Dernière position connue du véhicule (null si aucun point encore émis). */
export async function getLatestPosition(missionId: string): Promise<GpsPoint | null> {
  return apiFetch<GpsPoint | null>(`/missions/${missionId}/gps/latest`, { timeoutMs: 10000 });
}

/** Trace complète de la mission (points ordonnés du plus ancien au plus récent). */
export async function getTrail(missionId: string): Promise<GpsPoint[]> {
  return apiFetch<GpsPoint[]>(`/missions/${missionId}/gps/trail`);
}
