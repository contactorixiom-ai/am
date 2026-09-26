import { apiFetch } from './client';

// Paiement via Stripe Checkout (cartes + Apple Pay + Google Pay + Link).
// Le backend crée la session ; l'app redirige vers la page hébergée Stripe,
// puis vérifie le statut au retour. En l'absence de clé Stripe côté serveur,
// le backend répond en mode « simulation » (aucun débit) et l'app finalise
// directement — le parcours reste démontrable.

export interface CheckoutSession {
  provider: 'stripe' | 'simulation';
  configured: boolean;
  id: string;
  url: string | null;
}

export interface PaymentSessionStatus {
  id: string;
  provider: 'stripe' | 'simulation';
  paid: boolean;
  status: string;
  amountTotal?: number | null;
  currency?: string | null;
}

export interface CreateCheckoutInput {
  amountCents: number;
  currency?: string;
  reference?: string;
  description?: string;
  /** Rattache le règlement au dossier : sans lui, Roger ne sait pas ce qui a été payé. */
  missionId?: string;
  parcelId?: string;
  successUrl: string;
  cancelUrl: string;
}

export type PaymentRecordStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface PaymentRecord {
  id: string;
  sessionId: string;
  provider: string;
  reference?: string | null;
  description?: string | null;
  amountCents: number;
  currency: string;
  status: PaymentRecordStatus;
  paidAt?: string | null;
  /** Numéro de facture légal, attribué au règlement. */
  invoiceNumber?: string | null;
  createdAt: string;
  missionId?: string | null;
  parcelId?: string | null;
  client?: { id: string; firstName: string; lastName: string; email: string } | null;
  mission?: { id: string; reference: string } | null;
  parcel?: { id: string; reference: string } | null;
}

export interface PaymentsSummary {
  collectedMonthCents: number;
  collectedMonthCount: number;
  pendingCents: number;
  pendingCount: number;
  collectedTotalCents: number;
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
  return apiFetch<CheckoutSession>('/payments/checkout-session', { method: 'POST', body: input });
}

export async function getPaymentSession(id: string): Promise<PaymentSessionStatus> {
  return apiFetch<PaymentSessionStatus>(`/payments/session/${encodeURIComponent(id)}`);
}

// Rattache un règlement à l'envoi créé juste après (paiement du devis).
export async function linkPayment(
  sessionId: string,
  target: { missionId?: string; parcelId?: string },
): Promise<void> {
  await apiFetch(`/payments/session/${encodeURIComponent(sessionId)}/link`, {
    method: 'POST',
    body: target,
  });
}

// Règlements enregistrés côté serveur : ceux du client, ou tous pour l'admin.
export async function listPayments(): Promise<{ data: PaymentRecord[] }> {
  const res = await apiFetch<{ data: PaymentRecord[] }>('/payments?pageSize=100');
  return { data: Array.isArray(res?.data) ? res.data : [] };
}

export async function getPaymentsSummary(): Promise<PaymentsSummary> {
  return apiFetch<PaymentsSummary>('/payments/summary');
}

export async function getPaymentsConfig(): Promise<{ configured: boolean }> {
  return apiFetch<{ configured: boolean }>('/payments/config', { skipAuth: true });
}

export type ManualMethod = 'TRANSFER' | 'CASH' | 'CHECK' | 'CARD_TERMINAL' | 'MOBILE_MONEY';

/** Admin : règlement reçu hors application ; attribue le numéro de facture. */
export async function recordManualPayment(input: {
  missionId?: string;
  parcelId?: string;
  amountCents: number;
  method: ManualMethod;
  note?: string;
}): Promise<PaymentRecord> {
  return apiFetch<PaymentRecord>('/payments/manual', { method: 'POST', body: input });
}
