import { apiFetch } from './client';

export interface AuthSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/** Liste les sessions (appareils) actives de l'utilisateur connecté. */
export async function fetchSessions(): Promise<AuthSession[]> {
  return apiFetch<AuthSession[]>('/auth/sessions');
}

/** Révoque une session précise (déconnecte l'appareil correspondant). */
export async function revokeSession(id: string): Promise<void> {
  await apiFetch(`/auth/sessions/${id}`, { method: 'DELETE' });
}

/** Signe électroniquement un document via son URL/data URL de signature. */
export async function signDocument(
  documentId: string,
  signatureUrl: string,
): Promise<{ id: string; signedAt: string; signatureUrl: string; signedBy: string }> {
  return apiFetch(`/documents/${documentId}/sign`, {
    method: 'POST',
    body: { signatureUrl },
  });
}
