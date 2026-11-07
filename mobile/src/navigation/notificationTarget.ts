// Où mène une notification (liste des notifications et appui sur une
// notification du téléphone) : la messagerie pour un message, Mon espace pour
// un billet ou une annonce, le bon onglet de l'espace de travail, etc.
import { RootStackParamList } from './types';

export type NotifTarget = { screen: keyof RootStackParamList; params?: Record<string, unknown> };

export function notificationTarget(type: string, payload: Record<string, unknown> | null | undefined): NotifTarget | undefined {
  const p = (payload ?? {}) as Record<string, unknown>;
  const kind = String(p.kind ?? '');
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const conversationId = str(p.conversationId);
  if (conversationId) return { screen: 'Messaging', params: { conversationId } };
  if (type === 'NEW_MESSAGE' || type === 'CALL_INCOMING' || type === 'CALL_MISSED') return { screen: 'Conversations' };
  if (kind === 'STAFF_FILE' || kind === 'STAFF_REQUEST' || kind === 'ANNOUNCEMENT') return { screen: 'MySpace' };
  if (kind === 'STAFF_EXPENSE') return { screen: 'Admin', params: { tab: 'expenses' } };
  if (kind === 'STAFF_DOCUMENT') return { screen: 'Admin', params: { tab: 'received' } };
  if (kind === 'KYC_SUBMITTED') return { screen: 'Admin', params: { tab: 'drivers' } };
  if (type.startsWith('KYC_')) return { screen: 'KycVerification' };
  const reference = str(p.reference);
  if (str(p.missionId) && reference) return { screen: 'MissionDetails', params: { reference } };
  if (str(p.parcelId) && reference) return { screen: 'Tracking', params: { kind: 'parcel', id: p.parcelId, reference } };
  if (type === 'PAYMENT_RECEIVED') return { screen: 'AppTabs', params: { screen: 'Documents' } };
  return undefined;
}
