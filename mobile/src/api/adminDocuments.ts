import { apiFetch } from './client';

export interface AdminDocumentRecord {
  id: string;
  clientRef: string | null;
  typeId: string;
  typeLabel: string;
  reference: string;
  activity: string;
  values: Record<string, unknown>;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

/** Historique partagé des documents officiels générés par l'équipe. */
export function listAdminDocuments(take = 200): Promise<AdminDocumentRecord[]> {
  return apiFetch<AdminDocumentRecord[]>(`/admin-documents?take=${take}`);
}

export function saveAdminDocument(input: {
  clientRef?: string;
  typeId: string;
  typeLabel: string;
  reference: string;
  activity: string;
  values: Record<string, unknown>;
  createdAt?: string;
}): Promise<AdminDocumentRecord> {
  return apiFetch<AdminDocumentRecord>('/admin-documents', { method: 'POST', body: input });
}

/** Prochain numéro de l'année pour ce type (compteur commun à l'équipe). */
export function peekDocumentSequence(typeId: string): Promise<{ year: number; seq: number }> {
  return apiFetch(`/admin-documents/sequence/${encodeURIComponent(typeId)}`);
}

export function commitDocumentSequence(typeId: string, used: number): Promise<{ year: number; seq: number }> {
  return apiFetch(`/admin-documents/sequence/${encodeURIComponent(typeId)}/${used}`, { method: 'POST' });
}
