import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './client';

export interface ResetPreview {
  missions: number;
  parcels: number;
  quotes: number;
  payments: number;
  documents: number;
  inspections: number;
  conversations: number;
  notifications: number;
  adminDocuments: number;
  vehicles: number;
  doneAt: string | null;
}

/** Ce que la remise à zéro effacerait (administrateur seulement). */
export function getResetPreview(): Promise<ResetPreview> {
  return apiFetch<ResetPreview>('/admin/reset');
}

export interface ResetOperation {
  kind: 'mission' | 'parcel';
  id: string;
  reference: string;
  createdAt: string;
  status: string;
  route: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  /** Véhicule (convoyage) ou contenu déclaré (colis). */
  detail: string;
  recipient: string;
  driverName: string;
  priceCents: number | null;
  paymentStatus: string | null;
  paidCents: number | null;
  invoiceNumber: string | null;
}

/** Toutes les opérations, la plus ancienne d'abord. */
export function listResetOperations(): Promise<ResetOperation[]> {
  return apiFetch<ResetOperation[]>('/admin/reset/operations');
}

/**
 * Efface l'activité de test, sauf les opérations gardées. Une seule fois ;
 * il faut taper « EFFACER ».
 */
export async function runReset(confirmation: string, keep: ResetOperation[] = []): Promise<ResetPreview & { kept: string[] }> {
  const res = await apiFetch<ResetPreview & { kept: string[] }>('/admin/reset', {
    method: 'POST',
    body: {
      confirmation,
      keepMissionIds: keep.filter((o) => o.kind === 'mission').map((o) => o.id),
      keepParcelIds: keep.filter((o) => o.kind === 'parcel').map((o) => o.id),
    },
  });
  await clearLocalActivity();
  return res;
}

// Copies locales de l'activité sur ce téléphone (brouillons, contrats signés,
// factures, historique et numérotation des documents) : vidées avec la base.
const LOCAL_KEYS = [
  'axis.docs.v1',
  'axis.contracts.v1',
  'axis.admin.seq.v1',
  'axis.admin.history.v1',
  'axis.parcelDraft.v2',
  'axis.convoyDraft.v1',
  'axis.activeMissionId',
];

async function clearLocalActivity() {
  try {
    const all = await AsyncStorage.getAllKeys();
    const drafts = all.filter((k) => k.startsWith('axis.inspection.v1.'));
    await AsyncStorage.multiRemove([...LOCAL_KEYS, ...drafts]);
  } catch {
    // Rien de bloquant : la base est déjà remise à zéro.
  }
}
