import { isStaff } from '../utils/roles';
import { apiFetch } from './client';

// ─── Types alignés sur le backend (modules/messaging + schema.prisma) ──────
// Message.body (PAS "content"), type enum MessageType, dates ISO en string.

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'LOCATION' | 'SYSTEM';
export type ConversationType = 'DIRECT' | 'MISSION' | 'PARCEL' | 'SUPPORT' | 'GROUP';

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
  role?: string;
  phone?: string | null;
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
  /** Nom d'un groupe interne. */
  title?: string | null;
  createdById?: string | null;
  /** Messages non lus (liste des conversations). */
  unreadCount?: number;
}

export interface InternalContact {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  phone: string | null;
  accountNo?: number;
}

export interface Badges {
  notifications: number;
  messages: number;
  conversations: number;
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

/** Ouvre (ou retrouve) le fil avec l'équipe Axis. */
export async function openSupportConversation(): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/conversations/support', { method: 'POST' });
}

/** Pastilles : notifications et messages non lus. */
export function getBadges(): Promise<Badges> {
  return apiFetch<Badges>('/conversations/badges');
}

/** Messagerie interne : équipe, convoyeurs et administrateur. */
export function listInternalContacts(): Promise<InternalContact[]> {
  return apiFetch<InternalContact[]>('/conversations/contacts');
}

/** Ouvre (ou retrouve) un fil direct avec une personne. */
export function openDirectConversation(userId: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/conversations/direct', { method: 'POST', body: { userId } });
}

/** Administrateur : créer un groupe. */
export function createGroup(title: string, memberIds: string[]): Promise<{ id: string; title: string }> {
  return apiFetch('/conversations/groups', { method: 'POST', body: { title, memberIds } });
}

/** Administrateur : renommer, ajouter ou retirer des membres. */
export function updateGroup(id: string, input: { title?: string; addIds?: string[]; removeIds?: string[] }): Promise<ConversationSummary> {
  return apiFetch(`/conversations/groups/${id}`, { method: 'PATCH', body: input });
}

/** Administrateur : supprimer un groupe. */
export function deleteGroup(id: string): Promise<void> {
  return apiFetch(`/conversations/groups/${id}`, { method: 'DELETE' });
}

/** Quitter un groupe. */
export function leaveGroup(id: string): Promise<void> {
  return apiFetch(`/conversations/groups/${id}/leave`, { method: 'POST', body: {} });
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
  // Fil support : « Support Axis » pour le client ; pour Roger, le nom du
  // client (pas la liste des administrateurs).
  if (conv.type === 'GROUP') return conv.title || 'Groupe';
  if (conv.type === 'SUPPORT') {
    const me = conv.participants?.find((p) => p.userId === myUserId);
    if (!isStaff((me?.user as { role?: string } | undefined)?.role)) return 'Support Axis';
    const customer = conv.participants?.find((p) => !isStaff((p.user as { role?: string } | undefined)?.role));
    const name = `${customer?.user?.firstName ?? ''} ${customer?.user?.lastName ?? ''}`.trim();
    return name ? `${name} · support` : 'Support Axis';
  }
  const others = conv.participants?.filter((p) => p.userId !== myUserId) ?? [];
  if (others.length > 0) {
    return others
      .map((p) => `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim())
      .filter(Boolean)
      .join(', ') || fallbackTitle(conv.type);
  }
  return fallbackTitle(conv.type);
}

/**
 * Numéro à appeler depuis le fil : le standard d'Axis pour le client en
 * support, le client pour Roger, l'autre partie (client ou convoyeur) sur un
 * dossier. Jamais le numéro personnel d'un administrateur.
 */
export function conversationPhone(conv: ConversationSummary, myUserId: string | undefined, axisPhone: string): string | null {
  const me = conv.participants?.find((p) => p.userId === myUserId);
  const iAmAdmin = isStaff(me?.user?.role);
  if (conv.type === 'SUPPORT' && !iAmAdmin) return axisPhone.trim() || null;
  const other = conv.participants?.find(
    (p) => p.userId !== myUserId && !isStaff(p.user?.role) && p.user?.phone,
  );
  return other?.user?.phone ?? null;
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
  if (conv.type === 'GROUP') return `Groupe · ${conv.participants?.length ?? 0} membres`;
  if (conv.type === 'DIRECT') return 'Messagerie interne';
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
  if (typeof conv.unreadCount === 'number') return conv.unreadCount > 0;
  const last = conv.messages?.[0];
  if (!last || !myUserId || last.senderId === myUserId) return false;
  const me = conv.participants?.find((p) => p.userId === myUserId);
  if (!me) return false;
  if (!me.lastReadAt) return true;
  return new Date(last.createdAt).getTime() > new Date(me.lastReadAt).getTime();
}
