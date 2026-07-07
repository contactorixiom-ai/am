import { apiFetch } from './client';

// ─── Types alignés sur le backend (modules/messaging + schema.prisma) ──────
// Message.body (PAS "content"), type enum MessageType, dates ISO en string.

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'LOCATION' | 'SYSTEM';
export type ConversationType = 'DIRECT' | 'MISSION' | 'PARCEL' | 'SUPPORT';

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  body: string | null;
  attachmentUrl: string | null;
  attachmentMime: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveredAt: string | null;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ConversationUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt: string | null;
  isMuted: boolean;
  user: ConversationUser;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  missionId: string | null;
  parcelId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  /** Présent sur GET /conversations (select id/reference/status). */
  mission?: { id: string; reference: string; status: string } | null;
  /** GET /conversations renvoie le dernier message (take 1, desc). */
  messages?: ApiMessage[];
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface SendMessageInput {
  /** Corps du message — champ `body` côté backend (SendMessageDto). */
  body: string;
  type?: MessageType;
  attachmentUrl?: string;
  attachmentMime?: string;
  latitude?: number;
  longitude?: number;
}

// ─── Appels API ────────────────────────────────────────────────────────────

export async function listConversations(page = 1, pageSize = 50): Promise<Paginated<ConversationSummary>> {
  return apiFetch<Paginated<ConversationSummary>>('/conversations', {
    params: { page, pageSize },
  });
}

export async function getConversation(id: string): Promise<ConversationSummary> {
  return apiFetch<ConversationSummary>(`/conversations/${id}`);
}

/**
 * Messages d'une conversation. Le backend renvoie du plus récent au plus
 * ancien (orderBy createdAt desc) — penser à inverser pour l'affichage.
 * pageSize max backend : 100.
 */
export async function listMessages(conversationId: string, page = 1, pageSize = 50): Promise<Paginated<ApiMessage>> {
  return apiFetch<Paginated<ApiMessage>>(`/conversations/${conversationId}/messages`, {
    params: { page, pageSize },
  });
}

export async function sendMessage(conversationId: string, input: SendMessageInput): Promise<ApiMessage> {
  return apiFetch<ApiMessage>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: input,
  });
}

export async function markRead(conversationId: string): Promise<void> {
  await apiFetch(`/conversations/${conversationId}/read`, { method: 'POST', body: {} });
}

// ─── Helpers partagés (liste + fil) ───────────────────────────────────────

/** Nom de l'interlocuteur (les autres participants que moi). */
export function conversationTitle(conv: ConversationSummary, myUserId?: string): string {
  const others = conv.participants?.filter((p) => p.userId !== myUserId) ?? [];
  if (others.length > 0) {
    return others
      .map((p) => `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim())
      .filter(Boolean)
      .join(', ') || fallbackTitle(conv.type);
  }
  return fallbackTitle(conv.type);
}

function fallbackTitle(type: ConversationType): string {
  switch (type) {
    case 'SUPPORT': return 'Support Axis';
    case 'MISSION': return 'Conversation mission';
    case 'PARCEL': return 'Conversation colis';
    default: return 'Conversation';
  }
}

/** Sous-titre contextuel : référence mission, type de fil… */
export function conversationSubtitle(conv: ConversationSummary): string | undefined {
  if (conv.mission?.reference) return `Convoyage · ${conv.mission.reference}`;
  if (conv.type === 'PARCEL') return 'Envoi de colis';
  if (conv.type === 'SUPPORT') return 'Support client';
  return undefined;
}

/** Aperçu texte d'un message (gère les pièces jointes / positions). */
export function messagePreview(m: ApiMessage): string {
  if (m.body) return m.body;
  switch (m.type) {
    case 'IMAGE': return 'Photo';
    case 'FILE': return 'Pièce jointe';
    case 'LOCATION': return 'Position partagée';
    default: return '';
  }
}

/**
 * Non-lu : le dernier message vient de quelqu'un d'autre et est postérieur
 * à mon lastReadAt (le backend n'expose pas de compteur — indicateur binaire).
 */
export function isConversationUnread(conv: ConversationSummary, myUserId?: string): boolean {
  const last = conv.messages?.[0];
  if (!last || !myUserId || last.senderId === myUserId) return false;
  const me = conv.participants?.find((p) => p.userId === myUserId);
  if (!me) return false;
  if (!me.lastReadAt) return true;
  return new Date(last.createdAt).getTime() > new Date(me.lastReadAt).getTime();
}
