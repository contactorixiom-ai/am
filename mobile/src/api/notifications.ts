// Notifications de l'utilisateur connecté.
// Aligné sur backend/src/modules/notifications :
//   GET  /notifications           → liste paginée, la plus récente d'abord
//   POST /notifications/:id/read  → marquer une notification lue
//   POST /notifications/read-all  → tout marquer lu

import { apiFetch } from './client';

export type ServerNotificationType =
  | 'MISSION_CREATED' | 'MISSION_ACCEPTED' | 'MISSION_STARTED' | 'MISSION_DELIVERED'
  | 'MISSION_CANCELLED' | 'INSPECTION_REQUESTED' | 'INSPECTION_SIGNED'
  | 'NEW_MESSAGE' | 'CALL_INCOMING' | 'CALL_MISSED'
  | 'KYC_APPROVED' | 'KYC_REJECTED' | 'PARCEL_STATUS_UPDATE'
  | 'PAYMENT_RECEIVED' | 'REVIEW_RECEIVED' | 'SYSTEM';

export interface ServerNotification {
  id: string;
  type: ServerNotificationType;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export async function listNotifications(): Promise<ServerNotification[]> {
  const res = await apiFetch<{ data: ServerNotification[] }>('/notifications?pageSize=50');
  return res?.data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'POST' });
}
