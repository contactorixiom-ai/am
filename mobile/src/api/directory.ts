import { apiFetch } from './client';

export type DirectorySegment = 'all' | 'individual' | 'pro' | 'driver' | 'staff';

export interface DirectoryUser {
  id: string;
  email: string;
  phone: string | null;
  role: 'CLIENT' | 'DRIVER' | 'ADMIN' | 'MANAGER';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  accountType: 'INDIVIDUAL' | 'PROFESSIONAL';
  firstName: string;
  lastName: string;
  companyName: string | null;
  companySiret: string | null;
  companyVatId: string | null;
  companyAddress: string | null;
  billingAddress: string | null;
  emailVerifiedAt: string | null;
  termsAcceptedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  driverProfile: { baseCity: string | null; completedMissions: number; isAvailable: boolean } | null;
  missionsCount: number;
  driverMissionsCount: number;
  parcelsCount: number;
  vehiclesCount: number;
  kyc: { approved: number; pending: number; rejected: number };
  paidCents: number;
}

export interface DirectoryStats {
  total: number;
  individual: number;
  pro: number;
  driver: number;
  staff: number;
  new7: number;
  newMonth: number;
  active30: number;
  deleted: number;
}

export interface DirectoryEntry extends Omit<DirectoryUser, 'missionsCount' | 'driverMissionsCount' | 'parcelsCount' | 'vehiclesCount' | 'kyc' | 'paidCents' | 'driverProfile'> {
  termsVersion: string | null;
  driverProfile: { baseCity: string | null; completedMissions: number; licenseNumber: string; licenseExpiresAt: string; isAvailable: boolean } | null;
  kycDocuments: { id: string; type: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string }[];
  ownedVehicles: { id: string; make: string; model: string; licensePlate: string }[];
  missions: { id: string; reference: string; status: string; pickupCity: string; deliveryCity: string; createdAt: string; priceCents: number | null }[];
  driverMissions: { id: string; reference: string; status: string; pickupCity: string; deliveryCity: string; createdAt: string }[];
  parcels: { id: string; reference: string; status: string; originCity: string; destinationCity: string; createdAt: string; priceCents: number | null }[];
  payments: { id: string; reference: string | null; status: string; amountCents: number; paidAt: string | null; createdAt: string; invoiceNumber: string | null }[];
}

/** Annuaire de tous les inscrits (administrateur seulement). */
export function listDirectory(opts: { segment?: DirectorySegment; q?: string; page?: number; pageSize?: number } = {}) {
  const p = new URLSearchParams();
  if (opts.segment && opts.segment !== 'all') p.set('segment', opts.segment);
  if (opts.q?.trim()) p.set('q', opts.q.trim());
  p.set('page', String(opts.page ?? 1));
  p.set('pageSize', String(opts.pageSize ?? 50));
  return apiFetch<{ data: DirectoryUser[]; meta?: { total: number; totalPages: number }; total?: number }>(`/users/directory?${p.toString()}`);
}

export function getDirectoryStats(): Promise<DirectoryStats> {
  return apiFetch<DirectoryStats>('/users/directory/stats');
}

export function getDirectoryEntry(id: string): Promise<DirectoryEntry> {
  return apiFetch<DirectoryEntry>(`/users/directory/${id}`);
}
