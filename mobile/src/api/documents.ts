import { API_BASE_URL, apiFetch } from './client';

// Documents enregistrés côté serveur. Pour l'instant, un seul usage : la
// signature du contrat de convoyage par le client. Le contrat lui-même n'est
// pas stocké — il se régénère à l'identique depuis les données de la mission —
// mais la signature, elle, est conservée : c'est la preuve.

export type DocumentCategory =
  | 'CONTRACT' | 'INVOICE' | 'CMR' | 'CUSTOMS' | 'INSURANCE'
  | 'ID' | 'TRANSPORT_ORDER' | 'DELIVERY_NOTE' | 'OTHER';

export interface DocumentRecord {
  id: string;
  category: DocumentCategory;
  title: string;
  description?: string | null;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  missionId?: string | null;
  parcelId?: string | null;
  signedAt?: string | null;
  signatureUrl?: string | null;
  signedBy?: string | null;
  /** Empreinte SHA-256 des termes du dossier, figée à la signature. */
  contentHash?: string | null;
  createdAt: string;
}

/** Adresse publique de vérification d'un contrat signé (imprimée en QR). */
export function contractVerifyUrl(documentId: string): string {
  return `${API_BASE_URL}/missions/contract-verification/${documentId}`;
}

export async function listDocuments(params?: {
  category?: DocumentCategory;
  missionId?: string;
}): Promise<DocumentRecord[]> {
  const qs = new URLSearchParams({ pageSize: '100' });
  if (params?.category) qs.set('category', params.category);
  if (params?.missionId) qs.set('missionId', params.missionId);
  const res = await apiFetch<{ data: DocumentRecord[] }>(`/documents?${qs.toString()}`);
  return Array.isArray(res?.data) ? res.data : [];
}

/** Appose la signature du client sur le contrat d'un convoyage. */
export async function signMissionContract(
  missionId: string,
  signatureUrl: string,
): Promise<{ id: string; signedAt: string | null; contentHash: string | null }> {
  return apiFetch(`/missions/${missionId}/contract-signature`, {
    method: 'POST',
    body: { signatureUrl },
  });
}
