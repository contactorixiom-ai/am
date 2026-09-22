import { apiFetch, clearSession, setSession } from './client';

export type UserRole = 'CLIENT' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
}

export async function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<AuthResult> {
  const r = await apiFetch<AuthResult>('/auth/register', {
    method: 'POST',
    body: { ...input, role: 'CLIENT' },
    skipAuth: true,
  });
  await setSession(r.accessToken, r.refreshToken);
  return r;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const r = await apiFetch<AuthResult>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
  await setSession(r.accessToken, r.refreshToken);
  return r;
}

export async function logout(): Promise<void> {
  try { await apiFetch('/auth/logout', { method: 'POST', body: {} }); } catch { /* ignore */ }
  await clearSession();
}

export async function fetchMe(): Promise<SessionUser> {
  return apiFetch<SessionUser>('/users/me');
}

/**
 * Supprime définitivement son compte.
 *
 * L'App Store exige que la suppression puisse être lancée depuis
 * l'application (règle 5.1.1(v)) : renvoyer vers une adresse de contact ne
 * suffit pas. Les pièces comptables et les documents signés sont conservés
 * au titre des obligations légales, l'accès et les données personnelles
 * directes sont supprimés.
 */
export async function deleteAccount(): Promise<{ deletedAt: string }> {
  return apiFetch<{ deletedAt: string }>('/users/me', { method: 'DELETE' });
}
