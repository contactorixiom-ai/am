import { api, clearSession, setSession } from './client';

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
  const r = await api.post<AuthResult>('/auth/register', { ...input, role: 'CLIENT' });
  await setSession(r.data.accessToken, r.data.refreshToken);
  return r.data;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const r = await api.post<AuthResult>('/auth/login', { email, password });
  await setSession(r.data.accessToken, r.data.refreshToken);
  return r.data;
}

export async function logout(): Promise<void> {
  try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
  await clearSession();
}

export async function fetchMe(): Promise<SessionUser> {
  const r = await api.get<SessionUser>('/users/me');
  return r.data;
}
