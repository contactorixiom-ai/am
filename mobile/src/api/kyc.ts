import { apiFetch } from './client';

// Types alignés sur l'enum Prisma KycDocumentType côté backend.
export type KycDocumentType =
  | 'IDENTITY_CARD'
  | 'PASSPORT'
  | 'DRIVER_LICENSE'
  | 'PROOF_OF_ADDRESS'
  | 'COMPANY_REGISTRATION'
  | 'VAT_CERTIFICATE'
  | 'INSURANCE'
  | 'OTHER';

export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type GlobalKycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KycDocument {
  id: string;
  userId: string;
  type: KycDocumentType;
  status: KycStatus;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  notes?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KycOverview {
  status: GlobalKycStatus;
  documents: KycDocument[];
  counts: { total: number; pending: number; approved: number; rejected: number };
}

export interface UploadResult {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/** Uploade un fichier (base64 ou data URL) et renvoie son URL publique. */
export async function uploadFile(input: {
  fileName: string;
  mimeType: string;
  data: string;
  folder?: 'kyc' | 'signatures' | 'documents' | 'avatars' | 'misc';
}): Promise<UploadResult> {
  return apiFetch<UploadResult>('/storage/upload', { method: 'POST', body: input });
}

/** Récupère la liste des documents KYC + statut global de l'utilisateur. */
export async function fetchKycOverview(): Promise<KycOverview> {
  return apiFetch<KycOverview>('/users/me/kyc');
}

/** Dépose un document KYC (le fichier doit déjà être uploadé via uploadFile). */
export async function submitKycDocument(input: {
  type: KycDocumentType;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  notes?: string;
}): Promise<KycDocument> {
  return apiFetch<KycDocument>('/users/me/kyc', { method: 'POST', body: input });
}

/**
 * Upload + dépôt en une seule opération : pratique pour l'écran KYC.
 */
export async function uploadAndSubmitKyc(input: {
  type: KycDocumentType;
  fileName: string;
  mimeType: string;
  data: string;
  notes?: string;
}): Promise<KycDocument> {
  const uploaded = await uploadFile({
    fileName: input.fileName,
    mimeType: input.mimeType,
    data: input.data,
    folder: 'kyc',
  });
  return submitKycDocument({
    type: input.type,
    fileUrl: uploaded.url,
    fileName: uploaded.fileName,
    mimeType: uploaded.mimeType,
    fileSize: uploaded.fileSize,
    notes: input.notes,
  });
}

/** [ADMIN] Approuve ou rejette un document KYC. */
export async function reviewKycDocument(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  notes?: string,
): Promise<KycDocument> {
  return apiFetch<KycDocument>(`/users/kyc/${id}/review`, {
    method: 'PATCH',
    body: { status, notes },
  });
}
