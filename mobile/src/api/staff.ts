import { apiFetch } from './client';

export type StaffRole = 'ADMIN' | 'MANAGER';

export interface StaffMember {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: StaffRole;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'DELETED';
  lastLoginAt?: string | null;
  createdAt: string;
}

/** L'équipe Axis (réservé à l'administrateur). */
export function listStaff(): Promise<StaffMember[]> {
  return apiFetch<StaffMember[]>('/users/staff');
}

export function createManager(input: { firstName: string; lastName: string; email: string; phone?: string }): Promise<StaffMember> {
  return apiFetch<StaffMember>('/users/staff', { method: 'POST', body: input });
}

export function revokeManager(id: string): Promise<{ id: string }> {
  return apiFetch(`/users/staff/${id}/revoke`, { method: 'PATCH' });
}

export function restoreManager(id: string): Promise<{ id: string }> {
  return apiFetch(`/users/staff/${id}/restore`, { method: 'PATCH' });
}
