import { apiFetch } from './client';
import { uploadFile } from './kyc';
import type { KycDocument } from './kyc';
import type { PickedFile } from '../utils/pickFile';

export type StaffFileKind = 'TRAVEL' | 'EXPENSE' | 'HR_DOCUMENT' | 'EMPLOYEE_DOCUMENT';
export type StaffFileStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';

export interface StaffFile {
  id: string;
  userId: string;
  kind: StaffFileKind;
  category: string;
  title: string;
  note: string | null;
  amountCents?: number | null;
  spentAt: string | null;
  missionId: string | null;
  missionRef: string | null;
  requestId: string | null;
  status: StaffFileStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
  uploadedByName: string;
  seenAt: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: string };
}

export interface StaffRequest {
  id: string;
  userId: string;
  title: string;
  message: string | null;
  dueAt: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  requestedByName: string;
  doneAt: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  authorName: string;
  audience?: 'ALL' | 'DRIVERS' | 'TEAM' | 'PEOPLE';
  recipientCount?: number;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  createdAt: string;
}

export interface MissionLite {
  id: string;
  reference: string;
  pickupCity: string;
  deliveryCity: string;
  pickupAt: string;
  status?: string;
}

export interface MySpace {
  files: StaffFile[];
  requests: StaffRequest[];
  announcements: Announcement[];
  missions: MissionLite[];
}

export interface Compliance {
  complete: boolean;
  items: { key: string; label: string; status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'MISSING' }[];
}

export interface PersonRow {
  id: string;
  accountNo?: number;
  avatarUrl?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  files: number;
  pendingExpenses: number;
  newDocuments: number;
  openRequests: number;
  compliance: Compliance | null;
}

export interface PersonDetail {
  user: Omit<PersonRow, 'files' | 'pendingExpenses' | 'newDocuments' | 'openRequests' | 'compliance'>;
  files: StaffFile[];
  requests: StaffRequest[];
  kyc: KycDocument[];
  missions: MissionLite[];
  compliance: Compliance | null;
}

/** Catégories proposées selon le type de pièce. */
export const CATEGORIES: Record<StaffFileKind, { key: string; label: string }[]> = {
  TRAVEL: [
    { key: 'TRAIN', label: 'Billet de train' },
    { key: 'BUS', label: 'Billet de bus' },
    { key: 'FLIGHT', label: 'Billet d\'avion' },
    { key: 'FERRY', label: 'Billet de bateau' },
    { key: 'HOTEL', label: 'Hébergement' },
    { key: 'OTHER', label: 'Autre' },
  ],
  EXPENSE: [
    { key: 'FUEL', label: 'Carburant' },
    { key: 'TOLL', label: 'Péage' },
    { key: 'RECEIPT', label: 'Ticket de caisse' },
    { key: 'PARKING', label: 'Stationnement' },
    { key: 'MEAL', label: 'Repas' },
    { key: 'TRANSPORT', label: 'Transport (taxi, métro…)' },
    { key: 'HOTEL', label: 'Hébergement' },
    { key: 'OTHER', label: 'Autre' },
  ],
  HR_DOCUMENT: [
    { key: 'CONTRACT', label: 'Contrat' },
    { key: 'INSURANCE', label: 'Assurance' },
    { key: 'PAYSLIP', label: 'Fiche de paie' },
    { key: 'CERTIFICATE', label: 'Attestation' },
    { key: 'OTHER', label: 'Autre' },
  ],
  EMPLOYEE_DOCUMENT: [
    { key: 'CONTRACT', label: 'Contrat signé' },
    { key: 'CERTIFICATE', label: 'Attestation' },
    { key: 'INSURANCE', label: 'Assurance' },
    { key: 'OTHER', label: 'Autre' },
  ],
};

export function categoryLabel(kind: StaffFileKind, key: string): string {
  return CATEGORIES[kind].find((c) => c.key === key)?.label
    ?? Object.values(CATEGORIES).flat().find((c) => c.key === key)?.label
    ?? 'Document';
}

export const STATUS_LABEL: Record<StaffFileStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Validé',
  REJECTED: 'Refusé',
  REIMBURSED: 'Remboursé',
};

async function upload(file: PickedFile) {
  const up = await uploadFile({ fileName: file.name, mimeType: file.mimeType, data: file.dataUrl, folder: 'staff' });
  return { fileUrl: up.url, fileName: up.fileName || file.name, mimeType: up.mimeType, fileSize: up.fileSize };
}

// ─── Mon espace ──────────────────────────────────────────────────────────────

export function getMySpace(): Promise<MySpace> {
  return apiFetch<MySpace>('/staff-space/me');
}

export async function sendMyFile(input: {
  kind: 'EXPENSE' | 'EMPLOYEE_DOCUMENT';
  category: string;
  file: PickedFile;
  title?: string;
  note?: string;
  amountCents?: number;
  spentAt?: string;
  missionId?: string;
  requestId?: string;
}): Promise<StaffFile> {
  const { file, ...rest } = input;
  const uploaded = await upload(file);
  return apiFetch<StaffFile>('/staff-space/me/files', { method: 'POST', body: { ...rest, ...uploaded } });
}

export function markFileSeen(id: string) {
  return apiFetch(`/staff-space/me/files/${id}/seen`, { method: 'PATCH' });
}

export function removeMyFile(id: string) {
  return apiFetch(`/staff-space/me/files/${id}`, { method: 'DELETE' });
}

// ─── Équipe Axis ─────────────────────────────────────────────────────────────

export function listPeople(q?: string): Promise<PersonRow[]> {
  return apiFetch<PersonRow[]>(`/staff-space/people${q ? `?q=${encodeURIComponent(q)}` : ''}`);
}

export function getPerson(id: string): Promise<PersonDetail> {
  return apiFetch<PersonDetail>(`/staff-space/people/${id}`);
}

export async function addPersonFile(userId: string, input: {
  kind: 'TRAVEL' | 'HR_DOCUMENT';
  category: string;
  file: PickedFile;
  title?: string;
  note?: string;
  spentAt?: string;
  missionId?: string;
}): Promise<StaffFile> {
  const { file, ...rest } = input;
  const uploaded = await upload(file);
  return apiFetch<StaffFile>(`/staff-space/people/${userId}/files`, { method: 'POST', body: { ...rest, ...uploaded } });
}

export function removeStaffFile(id: string) {
  return apiFetch(`/staff-space/files/${id}`, { method: 'DELETE' });
}

export function requestDocument(userId: string, input: { title: string; message?: string; dueAt?: string }): Promise<StaffRequest> {
  return apiFetch<StaffRequest>(`/staff-space/people/${userId}/requests`, { method: 'POST', body: input });
}

export function cancelRequest(id: string) {
  return apiFetch(`/staff-space/requests/${id}/cancel`, { method: 'PATCH' });
}

export function listExpenses(status?: StaffFileStatus): Promise<StaffFile[]> {
  return apiFetch<StaffFile[]>(`/staff-space/expenses${status ? `?status=${status}` : ''}`);
}

export function reviewExpense(id: string, status: StaffFileStatus, note?: string): Promise<StaffFile> {
  return apiFetch<StaffFile>(`/staff-space/expenses/${id}`, { method: 'PATCH', body: { status, note } });
}

export function listReceivedDocuments(status?: StaffFileStatus): Promise<StaffFile[]> {
  return apiFetch<StaffFile[]>(`/staff-space/documents${status ? `?status=${status}` : ''}`);
}

export function reviewDocument(id: string, status: StaffFileStatus, note?: string): Promise<StaffFile> {
  return apiFetch<StaffFile>(`/staff-space/documents/${id}`, { method: 'PATCH', body: { status, note } });
}

export async function sendAnnouncement(input: {
  title: string;
  body: string;
  audience: 'ALL' | 'DRIVERS' | 'TEAM' | 'PEOPLE';
  recipientIds?: string[];
  attachment?: PickedFile | null;
}): Promise<Announcement> {
  const { attachment, ...rest } = input;
  let extra = {};
  if (attachment) {
    const up = await upload(attachment);
    extra = { attachmentUrl: up.fileUrl, attachmentName: attachment.name, attachmentMime: up.mimeType };
  }
  return apiFetch<Announcement>('/staff-space/announcements', { method: 'POST', body: { ...rest, ...extra } });
}

export function listAnnouncements(): Promise<Announcement[]> {
  return apiFetch<Announcement[]>('/staff-space/announcements');
}

export function euros(cents?: number | null): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
